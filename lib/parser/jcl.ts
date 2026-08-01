import type { ParsedCobolProgram, GraphNode, GraphEdge, EdgeType, NodeType } from './types';

// ---------------------------------------------------------------------------
// JCL / PROC parser
// Extracts program calls (EXEC PGM=), proc calls (EXEC PROC=),
// and dataset dependencies (DD DSN=) from JCL/PROC source.
// Detects IBM system utilities and resolves IKJEFT01 SYSTSIN to the real program.
// ---------------------------------------------------------------------------

interface RawJclEdge {
  to: string;
  type: EdgeType;
  label?: string;
  confidence: number;
  isSys?: boolean;
}

// IBM system utilities — displayed with a 'sys' node type in the dependency graph
export const SYSTEM_PROGRAMS_SET = new Set([
  'IEFBR14', 'IDCAMS', 'SORT', 'DFSORT', 'IEBGENER', 'IEBCOPY',
  'IEBUPDTE', 'IEHPROGM', 'IKJEFT01', 'DSNUTILB', 'DSNTIAD',
  'DSNUPROC', 'ICETOOL', 'IEBPTPCH', 'IEHLIST', 'IFASMFDP',
]);

/** Normalise a dataset name to its last non-parenthetical qualifier. */
function normaliseDataset(dsn: string): string {
  const withoutMember = dsn.replace(/\([^)]*\)$/, '');
  const parts = withoutMember.split('.');
  return (parts[parts.length - 1] ?? withoutMember).toUpperCase().trim();
}

/** Extract the job name from the JOB card (//JOBNAME JOB ...). */
function extractJobName(source: string, filename: string): string {
  const m = /^\/\/([A-Z][A-Z0-9]{0,7})\s+JOB\b/im.exec(source);
  if (m) return m[1].toUpperCase();
  return filename.split(/[/\\]/).pop()!.replace(/\.[^.]+$/, '').toUpperCase();
}

/** Count non-blank, non-comment JCL statements. */
function countLoc(source: string): number {
  return source.split(/\r?\n/).filter((l) => {
    const t = l.trim();
    if (!t) return false;
    if (t.startsWith('//*')) return false;
    return true;
  }).length;
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function parseJclFile(filename: string, source: string): ParsedCobolProgram {
  const isProc = filename.toLowerCase().endsWith('.proc') ||
    /^\s*\/\/[A-Z0-9]+\s+PROC\b/im.test(source);
  const language = isProc ? 'PROC' : 'JCL';
  const jobName = extractJobName(source, filename);
  const loc = countLoc(source);

  const edges: RawJclEdge[] = [];
  const seen = new Set<string>();

  function addEdge(e: RawJclEdge) {
    const key = `${e.type}:${e.to}`;
    if (!seen.has(key) && e.to !== jobName && e.to.length > 0) {
      seen.add(key);
      edges.push(e);
    }
  }

  function removeEdge(to: string) {
    const idx = edges.findIndex((e) => e.to === to);
    if (idx !== -1) {
      edges.splice(idx, 1);
      seen.delete(`call:${to}`);
    }
  }

  // Join continuation lines (lines that start with // and have content after col 71,
  // or explicitly start with // and continue with spaces in cols 3-15)
  const rawLines = source.split(/\r?\n/);
  const logicalLines: string[] = [];
  for (const raw of rawLines) {
    const stripped = raw.length > 80 ? raw.slice(0, 80) : raw;
    if (/^\/\/\s{2,15}\S/.test(stripped) && logicalLines.length > 0) {
      logicalLines[logicalLines.length - 1] += ' ' + stripped.replace(/^\/\/\s+/, '');
    } else {
      logicalLines.push(stripped);
    }
  }

  // State for IKJEFT01 SYSTSIN resolution
  let currentStepIsIkjeft01 = false;
  let collectingSystsin = false;
  let systsinContent = '';

  function parseSystsin() {
    if (!systsinContent.trim()) return;
    const runMatch = /RUN\s+PROGRAM\s*\(\s*([A-Z0-9#@$]+)\s*\)/i.exec(systsinContent);
    const callMatch = /CALL\s+'([A-Z0-9#@$]+)'/i.exec(systsinContent);
    const progName = (runMatch?.[1] ?? callMatch?.[1] ?? '').toUpperCase();
    if (progName) {
      removeEdge('IKJEFT01');
      addEdge({ to: progName, type: 'call', label: 'via IKJEFT01', confidence: 95 });
    }
    systsinContent = '';
  }

  for (const line of logicalLines) {
    const isJclLine = /^\/\//.test(line);

    // Collect SYSTSIN inline data (non-JCL lines while collectingSystsin is active)
    if (collectingSystsin) {
      if (/^\/\*/.test(line)) {
        collectingSystsin = false;
        parseSystsin();
        continue;
      }
      if (isJclLine) {
        collectingSystsin = false;
        parseSystsin();
        // Fall through to process this JCL line below
      } else {
        systsinContent += ' ' + line.trim();
        continue;
      }
    }

    // Skip JCL comments and blank lines
    if (/^\/\/\*/.test(line) || !line.trim()) continue;
    if (!isJclLine) continue;

    // EXEC PGM=progname
    const execPgm = /\/\/[A-Z0-9#@$]*\s+EXEC\s+PGM=([A-Z0-9#@$-]+)/i.exec(line);
    if (execPgm) {
      const pgm = execPgm[1].toUpperCase();
      currentStepIsIkjeft01 = pgm === 'IKJEFT01';
      collectingSystsin = false;
      systsinContent = '';
      const isSys = SYSTEM_PROGRAMS_SET.has(pgm);
      addEdge({ to: pgm, type: 'call', label: isSys ? 'EXEC PGM (system)' : 'EXEC PGM', confidence: 100, isSys });
      continue;
    }

    // EXEC PROC=procname or EXEC procname (shorthand)
    const execProc = /\/\/[A-Z0-9#@$]*\s+EXEC\s+(?:PROC=)?([A-Z0-9#@$-]+)(?=\s|,|$)/i.exec(line);
    if (execProc && !line.toUpperCase().includes('PGM=')) {
      const procName = execProc[1].toUpperCase();
      if (!JCL_KEYWORDS.has(procName)) {
        currentStepIsIkjeft01 = false;
        addEdge({ to: procName, type: 'proc', label: 'EXEC PROC', confidence: 100 });
      }
      continue;
    }

    // SYSTSIN DD — check if this is the SYSTSIN DD for an IKJEFT01 step
    if (currentStepIsIkjeft01) {
      const systsinDd = /\/\/[A-Z0-9#@$]*SYSTSIN\s+DD\s+(?:\*|DATA)\b/i.test(line);
      if (systsinDd) {
        collectingSystsin = true;
        systsinContent = '';
        continue;
      }
    }

    // DD DSN=dataset — standard dataset reference
    const ddDsn = /\/\/[A-Z0-9#@$]*\s+DD\s+(?:.*\s)?DSN=([*A-Z0-9#@$.()-]+)/i.exec(line);
    if (ddDsn) {
      const rawDsn = ddDsn[1];
      if (rawDsn.startsWith('*.')) {
        const parts = rawDsn.slice(2).split('.');
        const stepRef = parts[0]?.toUpperCase() ?? 'UNKNOWN';
        addEdge({ to: stepRef, type: 'jcl', label: 'REFERBACK', confidence: 85 });
      } else {
        const dsNode = normaliseDataset(rawDsn);
        if (dsNode && !JCL_KEYWORDS.has(dsNode)) {
          addEdge({ to: dsNode, type: 'data', label: 'DD DSN', confidence: 100 });
        }
      }
    }
  }

  // Flush any remaining SYSTSIN content at EOF
  if (collectingSystsin) parseSystsin();

  // Build nodes
  const nodes: GraphNode[] = [
    { id: jobName, label: jobName, sub: language, type: 'hero' as NodeType },
  ];
  const added = new Set<string>([jobName]);

  for (const e of edges) {
    if (!added.has(e.to)) {
      added.add(e.to);
      let nodeType: NodeType;
      if (e.isSys || SYSTEM_PROGRAMS_SET.has(e.to)) {
        nodeType = 'sys';
      } else if (e.type === 'call') {
        nodeType = 'prog';
      } else if (e.type === 'proc') {
        nodeType = 'proc';
      } else if (e.type === 'jcl') {
        nodeType = 'jcl';
      } else {
        nodeType = 'data';
      }
      const sub =
        nodeType === 'sys'  ? 'System utility' :
        e.type === 'call'   ? 'Program'         :
        e.type === 'proc'   ? 'Proc'            :
        e.type === 'jcl'    ? 'Step ref'        : 'Dataset';
      nodes.push({ id: e.to, label: e.to, sub, type: nodeType });
    }
  }

  const graphEdges: GraphEdge[] = edges.map((e) => ({
    from: jobName,
    to: e.to,
    type: e.type,
    label: e.label,
    confidence: e.confidence,
  }));

  // Circular layout — simple ring
  const CX = 280, CY = 230, R = 180, NODE_R = 36;
  const cLayoutNodes: GraphNode[] = nodes.map((n, i) => {
    if (n.type === 'hero') return { ...n, cx: CX, cy: CY, r: 44 };
    const angle = (2 * Math.PI * (i - 1)) / Math.max(nodes.length - 1, 1) - Math.PI / 2;
    return {
      ...n,
      cx: Math.round(CX + R * Math.cos(angle)),
      cy: Math.round(CY + R * Math.sin(angle)),
      r: NODE_R,
    };
  });

  return {
    name: jobName,
    language: language as 'COBOL' | 'HLASM',
    loc,
    source,
    graph: {
      nodes: cLayoutNodes,
      edges: graphEdges,
      coveragePct: 100,
    },
  };
}

// ---------------------------------------------------------------------------
// JCL keywords that should not be treated as proc/program names
// ---------------------------------------------------------------------------

const JCL_KEYWORDS = new Set([
  'EXEC', 'DD', 'JOB', 'PROC', 'PEND', 'IF', 'THEN', 'ELSE', 'ENDIF',
  'SET', 'INCLUDE', 'JCLLIB', 'OUTPUT', 'XMIT', 'COMMAND',
  'SYSOUT', 'DUMMY', 'NULLFILE', 'INTRDR',
]);
