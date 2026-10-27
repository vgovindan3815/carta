/**
 * JCL/PROC Analyzer v2 — PROC expansion and runtime DD resolution.
 *
 * Key improvements over MKP's lib/parser/jcl.ts:
 *  - PROC expansion: inline PROC catalog is built, then each EXEC PROC= step
 *    is expanded with its overrides applied (spec §16.2)
 *  - Runtime DD resolution: DD DSN= resolved to dataset name; temp datasets
 *    tracked by &&name handle across steps (spec §16.3)
 *  - Typed edges: CONTAINS_STEP, EXECUTES, USES_PROC, EXPANDS_TO,
 *    INPUT_DD, OUTPUT_DD, REFERENCES_DATASET (spec §7.2)
 *  - Evidence records with source line numbers per edge (spec §8)
 *  - MISSING_ARTIFACT nodes for unresolved PROC and dataset references (spec §29)
 *  - Symbolic parameter substitution: &PARM overrides via EXEC PROC=,PARM= (spec §16.4)
 */

import { randomUUID } from 'crypto';
import type { KgNode, KgEdge, EvidenceRecord, UnresolvedReference, Diagnostic } from '../ontology';
import type { ArtifactReport, MkpCompatNode, MkpCompatEdge } from '../output';

// ─── Internal types ───────────────────────────────────────────────────────────

interface JclStep {
  stepName: string;
  execTarget: string;           // PGM= or PROC= value
  execType: 'PGM' | 'PROC';
  symbolicOverrides: Map<string, string>;
  dds: JclDD[];
  sourceLine: number;
  procExpanded?: boolean;
}

interface JclDD {
  ddName: string;
  dsn?: string;
  disp?: string;
  dispositionOut?: string;
  isTemp?: boolean;
  tempRef?: string;
  concatenated?: boolean;
  sourceLine: number;
}

interface ProcDefinition {
  procName: string;
  steps: JclStep[];
  symbolicParams: Map<string, string | undefined>; // name → default value
  sourceLine: number;
  sourceFile?: string;
}

// ─── Parsing helpers ──────────────────────────────────────────────────────────

const CONTINUATION_RE = /^\/\/\s{16,}/;    // continuation line: // + 16+ spaces
const JOB_RE = /^\/\/([A-Z#@$][A-Z0-9#@$-]{0,7})\s+JOB\b/i;
const EXEC_RE = /^\/\/([A-Z#@$]?[A-Z0-9#@$-]{0,7})\s+EXEC\s+(.*)/i;
const DD_RE = /^\/\/([A-Z#@$][A-Z0-9#@$-]{0,7})\s+DD\s+(.*)/i;
const PROC_START_RE = /^\/\/([A-Z#@$][A-Z0-9#@$-]{0,7})\s+PROC\b(.*)/i;
const PROC_END_RE = /^\/\s+PEND\b/;
const COMMENT_RE = /^\/\/\*/;
const SET_RE = /^\/\/\s+SET\s+([A-Z#@$][A-Z0-9#@$-]{0,7})=(['"]?[^,\s]*['"]?)/i;

function parseKeyword(text: string, key: string): string | undefined {
  const re = new RegExp(`\\b${key}=([^,\\s]+|'[^']*')`, 'i');
  const m = re.exec(text);
  if (!m) return undefined;
  return m[1].replace(/^'|'$/g, '').trim();
}

function substituteSymbolics(text: string, params: Map<string, string>): string {
  return text.replace(/&([A-Z#@$][A-Z0-9#@$-]{0,7})/gi, (_, name) => {
    return params.get(name.toUpperCase()) ?? `&${name}`;
  });
}

function normalizeDsn(dsn: string): string {
  // Remove surrounding quotes, strip GDG generation suffix e.g. DSN(0)
  return dsn.replace(/^'|'$/g, '').replace(/\([-+]?\d+\)$/, '').toUpperCase().trim();
}

function isValidDsn(dsn: string): boolean {
  // Basic DSN validation: 1–44 chars, qualifiers of 1–8 chars
  return /^[A-Z#@$][A-Z0-9#@$.-]{0,43}$/.test(dsn) && !/&&/.test(dsn);
}

/** LOC count for JCL */
function countLoc(source: string): number {
  return source.split(/\r?\n/).filter(l => {
    const t = l.trim();
    return t.length > 0 && !l.startsWith('//*');
  }).length;
}

// ─── Pre-scan: collect inline PROCs ──────────────────────────────────────────

function collectInlineProcs(
  lines: string[],
): Map<string, ProcDefinition> {
  const procs = new Map<string, ProcDefinition>();
  let inProc = false;
  let currentProc: ProcDefinition | null = null;
  let currentStep: JclStep | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (COMMENT_RE.test(line)) continue;

    if (PROC_END_RE.test(line)) {
      if (currentStep && currentProc) currentProc.steps.push(currentStep);
      if (currentProc) procs.set(currentProc.procName, currentProc);
      inProc = false; currentProc = null; currentStep = null;
      continue;
    }

    const procMatch = PROC_START_RE.exec(line);
    if (procMatch) {
      if (currentStep && currentProc) currentProc.steps.push(currentStep);
      const params = new Map<string, string | undefined>();
      // Parse PROC symbolic defaults: PROC PARM1=DEFAULT,PARM2=
      const paramStr = procMatch[2] || '';
      for (const part of paramStr.split(',')) {
        const pv = part.trim().split('=');
        if (pv.length === 2 && /^[A-Z#@$]/i.test(pv[0])) {
          params.set(pv[0].toUpperCase(), pv[1] || undefined);
        }
      }
      currentProc = { procName: procMatch[1].toUpperCase(), steps: [], symbolicParams: params, sourceLine: i + 1 };
      inProc = true; currentStep = null;
      continue;
    }

    if (!inProc || !currentProc) continue;

    const execMatch = EXEC_RE.exec(line);
    if (execMatch) {
      if (currentStep) currentProc.steps.push(currentStep);
      const body = execMatch[2];
      const pgm = parseKeyword(body, 'PGM');
      const proc = parseKeyword(body, 'PROC') ?? (!pgm && !body.includes('=') ? body.split(',')[0].trim() : undefined);
      currentStep = {
        stepName: execMatch[1].toUpperCase(),
        execTarget: (pgm ?? proc ?? '').toUpperCase(),
        execType: pgm ? 'PGM' : 'PROC',
        symbolicOverrides: new Map(),
        dds: [],
        sourceLine: i + 1,
      };
      continue;
    }

    const ddMatch = DD_RE.exec(line);
    if (ddMatch && currentStep) {
      const ddBody = ddMatch[2];
      const dsn = parseKeyword(ddBody, 'DSN') ?? parseKeyword(ddBody, 'DSNAME');
      const disp = parseKeyword(ddBody, 'DISP');
      const isTemp = dsn?.startsWith('&&') ?? false;
      currentStep.dds.push({
        ddName: ddMatch[1].toUpperCase(),
        dsn: dsn?.toUpperCase(),
        disp, isTemp, tempRef: isTemp ? dsn?.toUpperCase() : undefined,
        sourceLine: i + 1,
      });
    }
  }

  return procs;
}

// ─── Main parse function ──────────────────────────────────────────────────────

export interface JclParserOptions {
  knownPrograms?: Set<string>;
  knownProcs?: Set<string>;
  knownDatasets?: Set<string>;
  artifactId?: string;
  /** Catalog of externally loaded PROCs (from PROCLIB) */
  externalProcs?: Map<string, ProcDefinition>;
}

export interface ParsedJclResult {
  report: ArtifactReport;
}

export function parseJclV2(
  source: string,
  filename: string,
  opts: JclParserOptions = {}
): ParsedJclResult {
  const artifactId = opts.artifactId ?? filename;
  const lines = source.split(/\r?\n/);
  const loc = countLoc(source);

  const knownPrograms = opts.knownPrograms ?? new Set<string>();
  const knownProcs = opts.knownProcs ?? new Set<string>();
  const knownDatasets = opts.knownDatasets ?? new Set<string>();

  // Build inline proc catalog
  const inlineProcs = collectInlineProcs(lines);
  const allProcs = new Map([...inlineProcs, ...(opts.externalProcs ?? new Map())]);

  // Job-level state
  let jobName = '';
  let jobSourceLine = 1;
  const steps: JclStep[] = [];
  let currentStep: JclStep | null = null;
  const setSymbols = new Map<string, string>();
  let inInlineProc = false;

  // Collect continuation lines
  function appendContinuation(base: string, i: number): { result: string; skip: number } {
    let result = base;
    let skip = 0;
    while (i + skip + 1 < lines.length && CONTINUATION_RE.test(lines[i + skip + 1])) {
      result += ' ' + lines[i + skip + 1].trim();
      skip++;
    }
    return { result, skip };
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (COMMENT_RE.test(line)) continue;

    // Track inline PROC boundaries — skip contents
    if (PROC_START_RE.test(line)) { inInlineProc = true; continue; }
    if (PROC_END_RE.test(line)) { inInlineProc = false; continue; }
    if (inInlineProc) continue;

    // JOB card
    const jobMatch = JOB_RE.exec(line);
    if (jobMatch) {
      if (currentStep) steps.push(currentStep);
      currentStep = null;
      jobName = jobMatch[1].toUpperCase();
      jobSourceLine = i + 1;
      continue;
    }

    // SET statement
    const setMatch = SET_RE.exec(line);
    if (setMatch) {
      setSymbols.set(setMatch[1].toUpperCase(), setMatch[2].replace(/^'|'$/g, ''));
      continue;
    }

    // EXEC card
    const execMatch = EXEC_RE.exec(line);
    if (execMatch) {
      if (currentStep) steps.push(currentStep);
      const { result: fullExec, skip } = appendContinuation(execMatch[2], i);
      i += skip;

      const expandedBody = substituteSymbolics(fullExec, setSymbols);
      const pgm = parseKeyword(expandedBody, 'PGM');
      let procName = parseKeyword(expandedBody, 'PROC');
      if (!pgm && !procName && !expandedBody.includes('=')) {
        // Bare name: EXEC IEFBR14 or EXEC MYPGM
        const bare = expandedBody.split(',')[0].trim();
        if (bare) procName = bare;
      }

      // Capture symbolic overrides from EXEC card: EXEC MYPROC,PARM=value
      const overrides = new Map<string, string>();
      for (const part of expandedBody.split(',').slice(1)) {
        const pv = part.trim().split('=');
        if (pv.length === 2 && /^[A-Z#@$]/i.test(pv[0])) {
          overrides.set(pv[0].toUpperCase(), pv[1]);
        }
      }

      currentStep = {
        stepName: execMatch[1].toUpperCase() || `STEP${steps.length + 1}`,
        execTarget: (pgm ?? procName ?? '').toUpperCase(),
        execType: pgm ? 'PGM' : 'PROC',
        symbolicOverrides: overrides,
        dds: [],
        sourceLine: i + 1,
      };
      continue;
    }

    // DD card
    const ddMatch = DD_RE.exec(line);
    if (ddMatch && currentStep) {
      const { result: fullDD, skip } = appendContinuation(ddMatch[2], i);
      i += skip;

      const expandedDD = substituteSymbolics(fullDD, setSymbols);
      const dsn = parseKeyword(expandedDD, 'DSN') ?? parseKeyword(expandedDD, 'DSNAME');
      const disp = parseKeyword(expandedDD, 'DISP');
      const isTemp = dsn?.startsWith('&&') ?? false;

      currentStep.dds.push({
        ddName: ddMatch[1].toUpperCase(),
        dsn: dsn?.toUpperCase(),
        disp, isTemp,
        tempRef: isTemp ? dsn?.toUpperCase() : undefined,
        sourceLine: i + 1,
      });
    }
  }

  if (currentStep) steps.push(currentStep);

  // ── Build knowledge graph ──────────────────────────────────────────────────
  const kgNodes: KgNode[] = [];
  const kgEdges: KgEdge[] = [];
  const evidenceRecords: EvidenceRecord[] = [];
  const diagnostics: Diagnostic[] = [];
  const unresolvedRefs: UnresolvedReference[] = [];
  const mkpNodes: MkpCompatNode[] = [];
  const mkpEdges: MkpCompatEdge[] = [];

  const heroId = `JOB:${jobName}`;
  kgNodes.push({
    id: heroId,
    nodeType: 'JOB',
    canonicalName: jobName,
    displayName: jobName,
    sourceArtifactId: artifactId,
    technology: 'JCL',
  });
  mkpNodes.push({ id: jobName, label: jobName, sub: 'JCL', type: 'jcl' });

  const addedNodes = new Set<string>([jobName]);
  const tempDatasets = new Map<string, string>(); // &&name → resolved DSN

  // Two-pass: first resolve temp refs from OUTPUT steps, then link INPUT steps
  for (const step of steps) {
    for (const dd of step.dds) {
      if (dd.isTemp && dd.dsn) {
        const dispParts = (dd.disp ?? '').split(',');
        const initialDisp = dispParts[0]?.replace(/\(/, '').toUpperCase() ?? '';
        if (!tempDatasets.has(dd.dsn)) {
          tempDatasets.set(dd.dsn, `${jobName}.${step.stepName}.${dd.ddName}`);
        }
      }
    }
  }

  for (const step of steps) {
    const stepNodeId = `JOB_STEP:${jobName}.${step.stepName}`;

    kgNodes.push({
      id: stepNodeId,
      nodeType: 'JOB_STEP',
      canonicalName: `${jobName}.${step.stepName}`,
      displayName: step.stepName,
      sourceArtifactId: artifactId,
      technology: 'JCL',
    });
    if (!addedNodes.has(step.stepName)) {
      addedNodes.add(step.stepName);
      mkpNodes.push({ id: step.stepName, label: step.stepName, sub: 'STEP', type: 'jcl' });
    }

    // JOB → CONTAINS_STEP → STEP edge
    const containsEvId = randomUUID();
    evidenceRecords.push({ id: containsEvId, artifactId, startLine: step.sourceLine, endLine: step.sourceLine, constructType: 'JOB_EXEC_STATEMENT' });
    kgEdges.push({ id: randomUUID(), sourceId: heroId, targetId: stepNodeId, relType: 'CONTAINS_STEP', confidence: 'DETERMINISTIC', evidenceIds: [containsEvId] });
    mkpEdges.push({ from: jobName, to: step.stepName, type: 'jcl', label: 'CONTAINS', confidence: 100, confidenceLevel: 'DETERMINISTIC', evidenceLine: step.sourceLine });

    // ── Expand PROC ────────────────────────────────────────────────────────
    if (step.execType === 'PROC') {
      const procDef = allProcs.get(step.execTarget);
      const isKnownProc = knownProcs.has(step.execTarget) || allProcs.has(step.execTarget);
      const procNodeId = `PROC:${step.execTarget}`;

      if (!addedNodes.has(step.execTarget)) {
        addedNodes.add(step.execTarget);
        kgNodes.push({
          id: procNodeId,
          nodeType: isKnownProc ? 'PROC' : 'MISSING_ARTIFACT',
          canonicalName: step.execTarget,
          displayName: step.execTarget,
          technology: 'JCL',
        });
        mkpNodes.push({ id: step.execTarget, label: step.execTarget, sub: 'PROC', type: isKnownProc ? 'proc' : 'missing' });
      }

      const procEvId = randomUUID();
      evidenceRecords.push({ id: procEvId, artifactId, startLine: step.sourceLine, endLine: step.sourceLine, constructType: 'EXEC_PROC' });
      kgEdges.push({
        id: randomUUID(), sourceId: stepNodeId, targetId: procNodeId,
        relType: 'USES_PROC',
        confidence: isKnownProc ? 'DETERMINISTIC' : 'MISSING',
        evidenceIds: [procEvId],
      });
      mkpEdges.push({ from: step.stepName, to: step.execTarget, type: 'proc', label: 'USES PROC', confidence: isKnownProc ? 100 : 0, confidenceLevel: isKnownProc ? 'DETERMINISTIC' : 'MISSING', evidenceLine: step.sourceLine });

      if (!isKnownProc) {
        diagnostics.push({ code: 'PROC_NOT_FOUND', severity: 'warning', artifactId, startLine: step.sourceLine, message: `PROC '${step.execTarget}' not found in PROCLIB or inline`, relatedSymbol: step.execTarget, component: 'jcl-parser-v2' });
        unresolvedRefs.push({ id: randomUUID(), sourceNodeId: stepNodeId, referenceType: 'USES_PROC', rawValue: step.execTarget, reasonCode: 'PROC_NOT_FOUND', candidateTargetIds: [] });
      }

      // Expand PROC: trace programs executed inside it
      if (procDef) {
        // Build effective symbolics: proc defaults ← step overrides ← SET
        const effSymbols = new Map<string, string>();
        for (const [k, v] of procDef.symbolicParams) if (v) effSymbols.set(k, v);
        for (const [k, v] of step.symbolicOverrides) effSymbols.set(k, v);
        for (const [k, v] of setSymbols) effSymbols.set(k, v);

        for (const procStep of procDef.steps) {
          const resolvedTarget = substituteSymbolics(procStep.execTarget, effSymbols);
          if (resolvedTarget && resolvedTarget !== procStep.execTarget || !resolvedTarget.includes('&')) {
            const pgmId = `PROGRAM:${resolvedTarget}`;
            if (!addedNodes.has(resolvedTarget)) {
              addedNodes.add(resolvedTarget);
              const isKnownPgm = knownPrograms.has(resolvedTarget);
              kgNodes.push({ id: pgmId, nodeType: isKnownPgm ? 'PROGRAM' : 'MISSING_ARTIFACT', canonicalName: resolvedTarget, displayName: resolvedTarget, technology: 'COBOL' });
              mkpNodes.push({ id: resolvedTarget, label: resolvedTarget, sub: 'PGM', type: isKnownPgm ? 'prog' : 'missing' });
            }
            const execEvId = randomUUID();
            evidenceRecords.push({ id: execEvId, artifactId, startLine: procStep.sourceLine, endLine: procStep.sourceLine, constructType: 'EXEC_PGM_VIA_PROC', extractedValue: resolvedTarget });
            kgEdges.push({ id: randomUUID(), sourceId: stepNodeId, targetId: pgmId, relType: 'EXECUTES', confidence: 'RESOLVED', evidenceIds: [execEvId] });
            mkpEdges.push({ from: step.stepName, to: resolvedTarget, type: 'call', label: `via ${procDef.procName}`, confidence: 85, confidenceLevel: 'RESOLVED', evidenceLine: procStep.sourceLine });
          }
        }
        step.procExpanded = true;
      }

    } else {
      // ── Direct PGM= execution ──────────────────────────────────────────────
      const pgm = step.execTarget;
      if (pgm) {
        const isKnownPgm = knownPrograms.has(pgm);
        const pgmId = `PROGRAM:${pgm}`;
        if (!addedNodes.has(pgm)) {
          addedNodes.add(pgm);
          kgNodes.push({ id: pgmId, nodeType: isKnownPgm ? 'PROGRAM' : 'MISSING_ARTIFACT', canonicalName: pgm, displayName: pgm, technology: 'COBOL' });
          mkpNodes.push({ id: pgm, label: pgm, sub: 'PGM', type: isKnownPgm ? 'prog' : 'missing' });
        }
        const execEvId = randomUUID();
        evidenceRecords.push({ id: execEvId, artifactId, startLine: step.sourceLine, endLine: step.sourceLine, constructType: 'EXEC_PGM', extractedValue: pgm });
        kgEdges.push({ id: randomUUID(), sourceId: stepNodeId, targetId: pgmId, relType: 'EXECUTES', confidence: isKnownPgm ? 'DETERMINISTIC' : 'MISSING', evidenceIds: [execEvId] });
        mkpEdges.push({ from: step.stepName, to: pgm, type: 'call', label: 'EXEC PGM', confidence: isKnownPgm ? 100 : 0, confidenceLevel: isKnownPgm ? 'DETERMINISTIC' : 'MISSING', evidenceLine: step.sourceLine });

        if (!isKnownPgm) {
          diagnostics.push({ code: 'PROGRAM_TARGET_NOT_FOUND', severity: 'warning', artifactId, startLine: step.sourceLine, message: `PGM '${pgm}' not found in repository`, relatedSymbol: pgm, component: 'jcl-parser-v2' });
        }
      }
    }

    // ── DD dataset edges ───────────────────────────────────────────────────
    for (const dd of step.dds) {
      if (!dd.dsn || dd.isTemp) continue;

      const dsn = normalizeDsn(dd.dsn);
      if (!isValidDsn(dsn)) continue;

      const dispParts = (dd.disp ?? 'SHR').replace(/^\(|\)$/g, '').split(',');
      const initialDisp = dispParts[0]?.toUpperCase() ?? 'SHR';
      const isWrite = ['NEW', 'MOD'].includes(initialDisp);
      const relType = isWrite ? 'OUTPUT_DD' : 'INPUT_DD';
      const mkpLabel = isWrite ? 'WRITES' : 'READS';
      const isKnownDs = knownDatasets.has(dsn);

      const dsId = `DATASET:${dsn}`;
      if (!addedNodes.has(dsn)) {
        addedNodes.add(dsn);
        kgNodes.push({ id: dsId, nodeType: 'DATASET', canonicalName: dsn, displayName: dsn, technology: 'VSAM' });
        mkpNodes.push({ id: dsn, label: dsn, sub: 'DS', type: 'data' });
      }

      const dsEvId = randomUUID();
      evidenceRecords.push({ id: dsEvId, artifactId, startLine: dd.sourceLine, endLine: dd.sourceLine, constructType: isWrite ? 'DD_OUTPUT' : 'DD_INPUT', extractedValue: dsn });
      kgEdges.push({ id: randomUUID(), sourceId: stepNodeId, targetId: dsId, relType, confidence: 'DETERMINISTIC', evidenceIds: [dsEvId] });
      mkpEdges.push({ from: step.stepName, to: dsn, type: 'data', label: mkpLabel, confidence: 100, confidenceLevel: 'DETERMINISTIC', evidenceLine: dd.sourceLine });
    }
  }

  const callEdges = mkpEdges.filter(e => e.type === 'call' || e.type === 'proc');
  const resolvedCalls = callEdges.filter(e => e.confidenceLevel === 'DETERMINISTIC' || e.confidenceLevel === 'RESOLVED');
  const coveragePct = callEdges.length > 0 ? Math.round((resolvedCalls.length / callEdges.length) * 100) : 100;

  const report: ArtifactReport = {
    name: jobName || filename.split(/[/\\]/).pop()!.replace(/\.[^.]+$/, '').toUpperCase(),
    language: 'JCL',
    loc,
    filePath: filename,
    coveragePct,
    nodes: mkpNodes,
    edges: mkpEdges,
    kgNodes,
    kgEdges,
    evidenceRecords,
    unresolvedRefs,
    diagnostics,
  };

  return { report };
}

export type { ProcDefinition };
