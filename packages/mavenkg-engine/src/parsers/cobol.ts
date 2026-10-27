/**
 * COBOL Parser v2 — Deterministic static analysis with evidence + confidence.
 *
 * Improvements over MKP's lib/parser/cobol.ts:
 *  - Evidence records with source line numbers per edge (spec §8)
 *  - Semantic confidence vocabulary: DETERMINISTIC/RESOLVED/CANDIDATE/UNRESOLVED/MISSING (spec §9)
 *  - Typed relationship edges: CALLS_STATIC, CALLS_DYNAMIC, READS, WRITES, UPDATES,
 *    INSERTS, DELETES_FROM, SELECTS_FROM, USES_COPYBOOK, XCTL_TO (spec §7.1, §7.3)
 *  - MISSING_ARTIFACT nodes for unresolved CALL and COPY targets (spec §29)
 *  - Two-pass VALUE-clause + MOVE constant propagation for dynamic CALLs (spec §23)
 *  - Paragraph-level CFG with TRUE/FALSE/PERFORM/LOOP edges (spec §24)
 */

import { randomUUID } from 'crypto';
import type { KgNode, KgEdge, EvidenceRecord, UnresolvedReference, Diagnostic } from '../ontology';
import type { ArtifactReport, MkpCompatNode, MkpCompatEdge, ParagraphInfo, CfgEdge, ProgramFlow } from '../output';
import { SymbolTable, isValidIdentifier, extractLiteral } from '../resolver/symbols';

// ─── Internal types ───────────────────────────────────────────────────────────

interface RawEdge {
  to: string;
  relType: string;
  mkpType: MkpCompatEdge['type'];
  label?: string;
  confidence: number;           // 0–100 numeric (MKP compat)
  confidenceLevel: string;      // semantic vocab
  sourcePara?: string;
  sourceLine: number;
  constructType: string;
}

// ─── Reserved word sets ───────────────────────────────────────────────────────

const COBOL_RESERVED = new Set([
  'ACCEPT','ACCESS','ADD','ADDRESS','ADVANCING','AFTER','ALL','ALLOCATE',
  'ALPHABET','ALPHABETIC','ALPHABETIC-LOWER','ALPHABETIC-UPPER','ALPHANUMERIC',
  'ALPHANUMERIC-EDITED','ALSO','ALTER','ALTERNATE','AND','ANY','APPLY',
  'ARE','AREA','AREAS','ASCENDING','ASSIGN','AT','AUTHOR',
  'BASIS','BEFORE','BEGINNING','BINARY','BLANK','BLOCK','BOTTOM','BY',
  'CALL','CANCEL','CD','CF','CH','CHARACTER','CHARACTERS','CLASS',
  'CLOCK-UNITS','CLOSE','CODE','CODE-SET','COLLATING','COLUMN','COMMA',
  'COMMUNICATION','COMPUTE','CONFIGURATION','CONTAINS','CONTENT','CONTINUE',
  'CONTROL','CONTROLS','CONVERTING','COPY','CORR','CORRESPONDING',
  'COUNT','CURRENCY','DATA','DATE','DATE-COMPILED','DATE-WRITTEN',
  'DAY','DAY-OF-WEEK','DE','DEBUG-CONTENTS','DEBUG-ITEM','DEBUG-LINE',
  'DEBUG-NAME','DEBUG-SUB-1','DEBUG-SUB-2','DEBUG-SUB-3','DEBUGGING',
  'DECIMAL-POINT','DECLARATIVES','DELETE','DELIMITED','DELIMITER',
  'DEPENDING','DESCENDING','DESTINATION','DETAIL','DISABLE','DISPLAY',
  'DIVIDE','DIVISION','DOWN','DUPLICATES','DYNAMIC',
  'EGI','ELSE','EMI','ENABLE','END','END-ADD','END-CALL','END-COMPUTE',
  'END-DELETE','END-DIVIDE','END-EVALUATE','END-IF','END-MULTIPLY',
  'END-OF-PAGE','END-PERFORM','END-READ','END-RECEIVE','END-RETURN',
  'END-REWRITE','END-SEARCH','END-START','END-STRING','END-SUBTRACT',
  'END-UNSTRING','END-WRITE','ENTER','ENVIRONMENT','EOP','EQUAL',
  'ERROR','ESI','EVALUATE','EXCEPTION','EXIT','EXTEND','EXTERNAL',
  'FALSE','FD','FILE','FILE-CONTROL','FILLER','FINAL','FIRST','FOOTING',
  'FOR','FREE','FROM','GENERATE','GIVING','GLOBAL','GO','GOBACK',
  'GREATER','GROUP','HEADING','HIGH-VALUE','HIGH-VALUES',
  'I-O','I-O-CONTROL','ID','IDENTIFICATION','IN','INDEX','INDEXED',
  'INDICATE','INITIAL','INITIALIZE','INITIATE','INPUT','INPUT-OUTPUT',
  'INSPECT','INSTALLATION','INTO','INVALID','IS',
  'JUST','JUSTIFIED','KEY','LABEL','LAST','LEADING','LEFT',
  'LENGTH','LESS','LIMIT','LIMITS','LINAGE','LINAGE-COUNTER','LINE',
  'LINE-COUNTER','LINES','LINKAGE','LOCK','LOW-VALUE','LOW-VALUES',
  'MEMORY','MERGE','MESSAGE','MODE','MODULES','MOVE','MULTIPLE','MULTIPLY',
  'NATIVE','NEGATIVE','NEXT','NO','NOT','NULL','NULLS','NUMBER','NUMERIC',
  'NUMERIC-EDITED','OBJECT-COMPUTER','OCCURS','OF','OFF','OMITTED',
  'ON','OPEN','OPTIONAL','OR','ORDER','ORGANIZATION','OTHER','OUTPUT',
  'OVERFLOW','PACKED-DECIMAL','PADDING','PAGE','PAGE-COUNTER','PERFORM',
  'PF','PH','PIC','PICTURE','PLUS','POINTER','POSITION','POSITIVE',
  'PRINTING','PROCEDURE','PROGRAM','PROGRAM-ID','PURGE',
  'QUEUE','QUOTE','QUOTES',
  'RANDOM','RD','READ','RECEIVE','RECORD','RECORDS','REDEFINES',
  'REEL','REFERENCE','REFERENCES','RELATIVE','RELEASE','REMAINDER',
  'REMOVAL','RENAMES','REPLACING','REPORT','REPORTING','REPORTS',
  'RESERVE','RESET','RETURN','REVERSED','REWIND','REWRITE','RF','RH',
  'RIGHT','ROUNDED','RUN',
  'SAME','SD','SEARCH','SECTION','SECURITY','SEGMENT','SEGMENT-LIMIT',
  'SELECT','SEND','SENTENCE','SEPARATE','SEQUENCE','SEQUENTIAL',
  'SET','SIGN','SIZE','SORT','SORT-MERGE','SOURCE','SOURCE-COMPUTER',
  'SPECIAL-NAMES','STANDARD','STANDARD-1','STANDARD-2','START',
  'STATUS','STOP','STRING','SUB-QUEUE-1','SUB-QUEUE-2','SUB-QUEUE-3',
  'SUBTRACT','SUM','SUPPRESS','SYMBOLIC','SYNC','SYNCHRONIZED',
  'TABLE','TALLYING','TAPE','TERMINAL','TERMINATE','TEST','TEXT',
  'THAN','THEN','THROUGH','THRU','TIME','TIMES','TO','TOP','TRAILING',
  'TRUE','TYPE',
  'UNIT','UNSTRING','UNTIL','UP','UPON','USAGE','USE','USING',
  'VALUE','VALUES','VARYING',
  'WHEN','WITH','WORDS','WORKING-STORAGE','WRITE',
  'ZERO','ZEROES','ZEROS',
]);

const CLAUSE_WORDS = new Set([
  'SECTION','DIVISION','IDENTIFICATION','ENVIRONMENT','DATA','PROCEDURE',
  'WORKING-STORAGE','LOCAL-STORAGE','LINKAGE','FILE','COMMUNICATION',
  'REPORT','SCREEN','INPUT-OUTPUT',
]);

const SQL_KEYWORDS = new Set([
  'SELECT','FROM','WHERE','AND','OR','NOT','IN','NULL','AS','ON','SET',
  'INSERT','INTO','UPDATE','DELETE','MERGE','DECLARE','CURSOR','OPEN',
  'FETCH','CLOSE','COMMIT','ROLLBACK','VALUES','TABLE','VIEW','INDEX',
  'CREATE','DROP','ALTER','GRANT','REVOKE','WITH','DISTINCT','GROUP',
  'ORDER','BY','HAVING','UNION','ALL','EXISTS','BETWEEN','LIKE','CASE',
  'WHEN','THEN','ELSE','END','INNER','OUTER','LEFT','RIGHT','JOIN',
  'CROSS','NATURAL','FULL','CALL','EXECUTE','EXEC','SQL',
]);

const PERFORM_MODIFIER_WORDS = new Set([
  'UNTIL','VARYING','TIMES','THRU','THROUGH','WITH','TEST','AFTER',
  'FROM','BY','END','SENTENCE','RETURNING','GIVING',
]);

function isValidId(s: string): boolean {
  return /^[A-Z#@$][A-Z0-9#@$-]{0,29}$/.test(s) && !COBOL_RESERVED.has(s) && !CLAUSE_WORDS.has(s);
}

// ─── Fixed-format helpers ─────────────────────────────────────────────────────

function stripSequenceArea(line: string): string {
  return line.length > 72 ? line.slice(0, 72) : line;
}

function isCommentLine(line: string): boolean {
  return line.length >= 7 && (line[6] === '*' || line[6] === '/');
}

function isContinuationLine(line: string): boolean {
  return line.length >= 7 && line[6] === '-';
}

/** Returns { logical, rawLineMap } where rawLineMap[i] is the 1-based source line of logical[i]. */
function buildLogicalLines(source: string): { logical: string[]; lineMap: number[] } {
  const rawLines = source.split(/\r?\n/);
  const logical: string[] = [];
  const lineMap: number[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    const stripped = stripSequenceArea(raw);
    if (isCommentLine(stripped)) continue;

    if (isContinuationLine(stripped)) {
      const cont = stripped.slice(11).trimEnd();
      if (logical.length > 0) {
        logical[logical.length - 1] += ' ' + cont.trim();
      }
    } else {
      const code = stripped.trimEnd();
      if (code.trim().length > 0) {
        logical.push(code);
        lineMap.push(i + 1);  // 1-based source line
      }
    }
  }

  return { logical, lineMap };
}

// ─── LOC counter ──────────────────────────────────────────────────────────────

function countLoc(source: string): number {
  return source.split(/\r?\n/).filter(line => {
    const t = line.trim();
    if (t.length === 0) return false;
    if (line.length >= 7 && (line[6] === '*' || line[6] === '/')) return false;
    if (t.startsWith('*>')) return false;
    return true;
  }).length;
}

// ─── Program name extractor ───────────────────────────────────────────────────

function extractProgramName(source: string, filename: string): string {
  const m = /PROGRAM-ID\s*\.\s*([A-Z0-9#@$-]+)/i.exec(source);
  if (m) return m[1].toUpperCase();
  return filename.split(/[/\\]/).pop()!.replace(/\.[^.]+$/, '').toUpperCase();
}

// ─── ID generator ─────────────────────────────────────────────────────────────

function mkId(prefix: string, name: string): string {
  return `${prefix}:${name}`;
}

// ─── Main parser function ─────────────────────────────────────────────────────

export interface ParsedCobolResult {
  report: ArtifactReport;
}

export interface CobolParserOptions {
  /** Known copybook names in the repository — used to classify COPY targets */
  knownCopybooks?: Set<string>;
  /** Known program names in the repository — used to classify CALL targets */
  knownPrograms?: Set<string>;
  /** Artifact ID for this source file */
  artifactId?: string;
}

export function parseCobolV2(
  source: string,
  filename: string,
  opts: CobolParserOptions = {}
): ParsedCobolResult {
  const artifactId = opts.artifactId ?? filename;
  const programName = extractProgramName(source, filename);
  const loc = countLoc(source);
  const { logical, lineMap } = buildLogicalLines(source);

  const knownCopybooks = opts.knownCopybooks ?? new Set<string>();
  const knownPrograms = opts.knownPrograms ?? new Set<string>();

  // Assign a stable ID for the hero program node
  const heroId = mkId('PROGRAM', programName);

  // ── Pass 1: Symbol table construction (VALUE clauses + MOVE propagation) ──
  const symTable = new SymbolTable();
  buildSymbolTable(logical, lineMap, programName, symTable);

  // ── Pass 2: Dependency extraction ──
  const rawEdges: RawEdge[] = [];
  const diagnostics: Diagnostic[] = [];
  const unresolvedRefs: UnresolvedReference[] = [];
  extractDependencies(logical, lineMap, programName, symTable, rawEdges, diagnostics, unresolvedRefs, knownCopybooks, knownPrograms);

  // ── Pass 3: CFG from paragraphs / sections ──
  const internalFlow = extractInternalFlow(logical, lineMap, programName);

  // ── Build KG nodes and edges ──
  const kgNodes: KgNode[] = [];
  const kgEdges: KgEdge[] = [];
  const evidenceRecords: EvidenceRecord[] = [];

  // Hero node
  kgNodes.push({
    id: heroId,
    nodeType: 'PROGRAM',
    canonicalName: programName,
    displayName: programName,
    sourceArtifactId: artifactId,
    technology: 'COBOL',
  });

  // Derive MKP-compat nodes / edges and KG edges from raw edges
  const mkpNodes: MkpCompatNode[] = [{
    id: programName,
    label: programName,
    sub: 'COBOL',
    type: 'hero',
  }];
  const mkpEdges: MkpCompatEdge[] = [];
  const addedNodes = new Set<string>([programName]);

  for (const raw of rawEdges) {
    // Evidence record
    const evId = randomUUID();
    const ev: EvidenceRecord = {
      id: evId,
      artifactId,
      startLine: raw.sourceLine,
      endLine: raw.sourceLine,
      constructType: raw.constructType,
      extractedValue: raw.to,
      normalizedValue: raw.to.toUpperCase(),
    };
    evidenceRecords.push(ev);

    // Determine target node type for KG
    let targetNodeType: KgNode['nodeType'] = 'PROGRAM';
    let mkpType: MkpCompatNode['type'] = 'prog';
    let targetTech: KgNode['technology'] = 'COBOL';

    if (raw.mkpType === 'data') {
      targetNodeType = 'DB2_TABLE';
      mkpType = 'data';
      targetTech = 'DB2';
    } else if (raw.mkpType === 'copy') {
      targetNodeType = 'COPYBOOK';
      mkpType = 'cpy';
      targetTech = 'COBOL';
    } else if (raw.confidenceLevel === 'MISSING') {
      targetNodeType = 'MISSING_ARTIFACT';
      mkpType = 'missing';
    }

    const targetId = mkId(
      raw.mkpType === 'data' ? 'DB2_TABLE' :
      raw.mkpType === 'copy' ? 'COPYBOOK' : 'PROGRAM',
      raw.to
    );

    // Add target KG node
    if (!addedNodes.has(raw.to)) {
      addedNodes.add(raw.to);
      kgNodes.push({
        id: targetId,
        nodeType: targetNodeType,
        canonicalName: raw.to,
        displayName: raw.to,
        technology: targetTech,
      });
      mkpNodes.push({ id: raw.to, label: raw.to, sub: '', type: mkpType });
    }

    // KG edge
    const kgEdgeId = randomUUID();
    kgEdges.push({
      id: kgEdgeId,
      sourceId: heroId,
      targetId,
      relType: raw.relType as KgEdge['relType'],
      confidence: raw.confidenceLevel as KgEdge['confidence'],
      resolutionMethod: raw.confidenceLevel === 'DETERMINISTIC' ? 'direct' : 'constant-propagation',
      evidenceIds: [evId],
    });

    // MKP-compat edge
    mkpEdges.push({
      from: programName,
      to: raw.to,
      type: raw.mkpType,
      label: raw.label,
      confidence: raw.confidence,
      confidenceLevel: raw.confidenceLevel as MkpCompatEdge['confidenceLevel'],
      sourcePara: raw.sourcePara,
      evidenceLine: raw.sourceLine,
    });
  }

  // Compute coverage: deterministic + resolved / all (excluding copy)
  const callLike = rawEdges.filter(e => e.mkpType !== 'copy' && e.mkpType !== 'data');
  const resolved = callLike.filter(e =>
    e.confidenceLevel === 'DETERMINISTIC' || e.confidenceLevel === 'RESOLVED'
  );
  const coveragePct = callLike.length > 0
    ? Math.round((resolved.length / callLike.length) * 100)
    : 100;

  const report: ArtifactReport = {
    name: programName,
    language: 'COBOL',
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
    internalFlow,
  };

  return { report };
}

// ─── Pass 1: Symbol table construction ───────────────────────────────────────

function buildSymbolTable(
  logical: string[],
  lineMap: number[],
  programName: string,
  symTable: SymbolTable
): void {
  const SCOPE = programName;
  let inWS = false;

  for (let i = 0; i < logical.length; i++) {
    const up = logical[i].toUpperCase().trim();

    if (/\bWORKING-STORAGE\s+SECTION\b/.test(up)) { inWS = true; continue; }
    if (/\b(LINKAGE|FILE|LOCAL-STORAGE|PROCEDURE)\s+(SECTION|DIVISION)\b/.test(up)) {
      inWS = false; continue;
    }
    if (!inWS) continue;

    // Level 77 or 01 declarations with PIC clause — register the symbol
    const defMatch = /^(\d{2})\s+([A-Z#@$][A-Z0-9#@$-]*)\s/.exec(up);
    if (defMatch) {
      symTable.define(defMatch[2], SCOPE, lineMap[i]);
    }

    // VALUE clause: 05 WS-PGM PIC X(8) VALUE 'CUST100'.
    const valMatch = /\bVALUE\s+['"]([A-Z0-9#@$-]{1,30})['"]/i.exec(up);
    if (valMatch && defMatch) {
      symTable.setLiteral(defMatch[2], SCOPE, valMatch[1]);
    }
  }

  // Pass over PROCEDURE DIVISION for MOVE statements
  let inProc = false;
  for (let i = 0; i < logical.length; i++) {
    const up = logical[i].toUpperCase().trim();
    if (/\bPROCEDURE\s+DIVISION\b/.test(up)) { inProc = true; continue; }
    if (/\b(IDENTIFICATION|ENVIRONMENT|DATA)\s+DIVISION\b/.test(up)) { inProc = false; continue; }
    if (!inProc) continue;

    // MOVE 'LITERAL' TO identifier
    const moveLitMatch = /\bMOVE\s+['"]([A-Z0-9#@$-]{1,30})['"]\s+TO\s+([A-Z#@$][A-Z0-9#@$-]*)\b/.exec(up);
    if (moveLitMatch) {
      symTable.move(moveLitMatch[2], SCOPE, moveLitMatch[1]);
      continue;
    }

    // MOVE identifier TO identifier — unknown assignment, widen
    const moveIdMatch = /\bMOVE\s+([A-Z#@$][A-Z0-9#@$-]*)\s+TO\s+([A-Z#@$][A-Z0-9#@$-]*)\b/.exec(up);
    if (moveIdMatch) {
      // Only widen if source state is unknown
      const srcState = symTable.resolve(moveIdMatch[1], SCOPE);
      if (srcState.kind === 'literal') {
        symTable.move(moveIdMatch[2], SCOPE, srcState.value);
      } else {
        symTable.move(moveIdMatch[2], SCOPE, null); // widen
      }
    }
  }
}

// ─── Pass 2: Dependency extraction ───────────────────────────────────────────

function extractDependencies(
  logical: string[],
  lineMap: number[],
  programName: string,
  symTable: SymbolTable,
  rawEdges: RawEdge[],
  diagnostics: Diagnostic[],
  unresolvedRefs: UnresolvedReference[],
  knownCopybooks: Set<string>,
  knownPrograms: Set<string>
): void {
  const SCOPE = programName;
  const seen = new Set<string>();
  let inProcedure = false;
  let currentPara: string | undefined;

  function addEdge(e: RawEdge) {
    const key = `${e.mkpType}:${e.to}`;
    if (!seen.has(key) && e.to !== programName) {
      seen.add(key);
      rawEdges.push(e);
    }
  }

  // Build full text for multi-line EXEC block matching
  const fullTextUp = logical.join('\n').toUpperCase();

  // ── SQL blocks ──
  const execSqlRe = /EXEC\s+SQL\s+([\s\S]+?)END-EXEC/g;
  let sm: RegExpExecArray | null;
  while ((sm = execSqlRe.exec(fullTextUp)) !== null) {
    const body = sm[1];

    // Detect operation type for the first SQL verb
    const verbMatch = /^\s*(SELECT|INSERT|UPDATE|DELETE|MERGE|CALL|DECLARE|OPEN|FETCH|CLOSE)/i.exec(body.trimStart());
    const verb = verbMatch ? verbMatch[1].toUpperCase() : 'SELECT';

    const sqlRelMap: Record<string, string> = {
      SELECT: 'SELECTS_FROM', INSERT: 'INSERTS', UPDATE: 'UPDATES',
      DELETE: 'DELETES_FROM', MERGE: 'MERGES_INTO',
      CALL: 'CALLS_STATIC', OPEN: 'SELECTS_FROM', FETCH: 'SELECTS_FROM', CLOSE: 'SELECTS_FROM',
      DECLARE: 'SELECTS_FROM',
    };
    const relType = sqlRelMap[verb] ?? 'SELECTS_FROM';

    // Find line number: scan logical lines for first match
    let sqlLine = 0;
    for (let i = 0; i < logical.length; i++) {
      if (/\bEXEC\s+SQL\b/i.test(logical[i])) { sqlLine = lineMap[i]; break; }
    }

    const tableRe = /(?:FROM|INTO|UPDATE|JOIN)\s+([A-Z0-9#@$_.-]+)/g;
    let tm: RegExpExecArray | null;
    while ((tm = tableRe.exec(body)) !== null) {
      const tname = tm[1].trim().split('.').pop() ?? tm[1].trim(); // strip schema
      // SQL table names allow underscores; use a relaxed check
      const isValidSqlName = /^[A-Z][A-Z0-9_#@$-]{0,63}$/.test(tname) && !SQL_KEYWORDS.has(tname);
      if (tname && isValidSqlName) {
        addEdge({
          to: tname, relType, mkpType: 'data',
          label: verb === 'SELECT' ? 'SQL READ' : `SQL ${verb}`,
          confidence: 100, confidenceLevel: 'DETERMINISTIC',
          sourcePara: currentPara, sourceLine: sqlLine,
          constructType: `SQL_${verb}`,
        });
      }
    }
  }

  // ── EXEC CICS blocks ──
  const execCicsRe = /EXEC\s+CICS\s+([\s\S]+?)END-EXEC/g;
  let cm: RegExpExecArray | null;
  while ((cm = execCicsRe.exec(fullTextUp)) !== null) {
    const body = cm[1];
    let cicsLine = 0;
    for (let i = 0; i < logical.length; i++) {
      if (/\bEXEC\s+CICS\b/i.test(logical[i])) { cicsLine = lineMap[i]; break; }
    }

    const cicsVerbMatch = /^\s*(\w+)/.exec(body.trimStart());
    const cicsVerb = cicsVerbMatch ? cicsVerbMatch[1].toUpperCase() : 'COMMAND';

    // XCTL PROGRAM('PROG') or LINK PROGRAM('PROG')
    const progMatch = /PROGRAM\s*\(\s*['"]?([A-Z0-9#@$-]+)['"]?\s*\)/i.exec(body);
    if (progMatch) {
      const relType = cicsVerb === 'XCTL' ? 'XCTL_TO' : 'CALLS_STATIC';
      const mkpType = cicsVerb === 'XCTL' ? 'call' : 'call';
      addEdge({
        to: progMatch[1], relType, mkpType,
        label: `CICS ${cicsVerb}`,
        confidence: 100, confidenceLevel: 'DETERMINISTIC',
        sourcePara: currentPara, sourceLine: cicsLine,
        constructType: `CICS_${cicsVerb}`,
      });
    }

    // FILE('FILENAME')
    const fileMatch = /FILE\s*\(\s*['"]?([A-Z0-9#@$-]+)['"]?\s*\)/i.exec(body);
    if (fileMatch) {
      addEdge({
        to: fileMatch[1], relType: 'ACCESSES_CICS_FILE', mkpType: 'data',
        label: `CICS ${cicsVerb}`,
        confidence: 100, confidenceLevel: 'DETERMINISTIC',
        sourcePara: currentPara, sourceLine: cicsLine,
        constructType: 'CICS_FILE_ACCESS',
      });
    }
  }

  // ── Line-by-line pass ──
  for (let i = 0; i < logical.length; i++) {
    const line = logical[i];
    const up = line.toUpperCase().trim();
    const srcLine = lineMap[i];

    // Division tracking
    if (/\bPROCEDURE\s+DIVISION\b/.test(up)) { inProcedure = true; continue; }
    if (/\b(IDENTIFICATION|ENVIRONMENT|DATA)\s+DIVISION\b/.test(up)) { inProcedure = false; continue; }

    // Paragraph tracking (Area A: col 8 non-space, col 7 space)
    if (inProcedure) {
      const col7 = line.length > 6 ? line[6] : ' ';
      const col8 = line.length > 7 ? line[7] : ' ';
      if (col8 !== ' ' && col7 === ' ') {
        const areaContent = line.slice(7).trimEnd().toUpperCase();
        const paraMatch = /^([A-Z0-9][A-Z0-9#@$-]*)\s*\./.exec(areaContent);
        if (paraMatch && !CLAUSE_WORDS.has(paraMatch[1]) && !COBOL_RESERVED.has(paraMatch[1])) {
          currentPara = paraMatch[1];
        }
      }
    }

    if (!inProcedure) {
      // COPY in DATA DIVISION
      const copyMatch = /\bCOPY\s+([A-Z0-9#@$-]+)/.exec(up);
      if (copyMatch) {
        const cpName = copyMatch[1].replace(/[."]/g, '');
        if (isValidId(cpName) && cpName !== programName) {
          const isKnown = knownCopybooks.has(cpName);
          addEdge({
            to: cpName, relType: 'USES_COPYBOOK', mkpType: 'copy',
            label: 'COPY',
            confidence: 100,
            confidenceLevel: isKnown ? 'DETERMINISTIC' : 'MISSING',
            sourceLine: srcLine,
            constructType: 'COPY_STATEMENT',
          });
          if (!isKnown) {
            diagnostics.push({
              code: 'COPYBOOK_NOT_FOUND', severity: 'warning',
              artifactId: programName, startLine: srcLine,
              message: `COPY target '${cpName}' not found in repository`,
              relatedSymbol: cpName, component: 'cobol-parser-v2',
            });
          }
        }
      }
      continue;
    }

    // Skip EXEC blocks (handled above)
    if (/\bEXEC\s+(SQL|CICS)\b/.test(up)) continue;

    // Static CALL 'LITERAL'
    const staticCallMatch = /\bCALL\s+['"]([A-Z0-9#@$-]{1,30})['"]/i.exec(up);
    if (staticCallMatch) {
      const target = staticCallMatch[1].toUpperCase();
      if (isValidId(target)) {
        const isKnown = knownPrograms.has(target);
        addEdge({
          to: target, relType: 'CALLS_STATIC', mkpType: 'call',
          confidence: 100,
          confidenceLevel: isKnown ? 'DETERMINISTIC' : 'MISSING',
          sourcePara: currentPara, sourceLine: srcLine,
          constructType: 'CALL_LITERAL',
        });
        if (!isKnown) {
          diagnostics.push({
            code: 'PROGRAM_TARGET_NOT_FOUND', severity: 'warning',
            artifactId: programName, startLine: srcLine,
            message: `Called program '${target}' not found in repository`,
            relatedSymbol: target, component: 'cobol-parser-v2',
          });
        }
      }
      continue;
    }

    // Dynamic CALL identifier
    const dynCallMatch = /\bCALL\s+([A-Z#@$][A-Z0-9#@$-]{0,29})\b/.exec(up);
    if (dynCallMatch && !COBOL_RESERVED.has(dynCallMatch[1])) {
      const varName = dynCallMatch[1];
      const state = symTable.resolve(varName, SCOPE);

      if (state.kind === 'literal') {
        const target = state.value;
        if (isValidId(target)) {
          const isKnown = knownPrograms.has(target);
          addEdge({
            to: target, relType: 'CALLS_DYNAMIC', mkpType: 'dyn',
            confidence: 85, confidenceLevel: isKnown ? 'RESOLVED' : 'MISSING',
            sourcePara: currentPara, sourceLine: srcLine,
            constructType: 'CALL_IDENTIFIER_RESOLVED',
          });
        }
      } else if (state.kind === 'candidates') {
        for (const cand of state.values) {
          if (isValidId(cand)) {
            addEdge({
              to: cand, relType: 'POSSIBLE_CALL_TARGET', mkpType: 'dyn',
              confidence: 60, confidenceLevel: 'CANDIDATE',
              sourcePara: currentPara, sourceLine: srcLine,
              constructType: 'CALL_IDENTIFIER_CANDIDATE',
            });
          }
        }
      } else {
        // Unresolvable dynamic call — create UNRESOLVED_REFERENCE
        const refId = randomUUID();
        unresolvedRefs.push({
          id: refId,
          sourceNodeId: mkId('PROGRAM', programName),
          referenceType: 'CALLS_DYNAMIC',
          rawValue: varName,
          reasonCode: 'DYNAMIC_CALL_UNRESOLVED',
          candidateTargetIds: [],
        });
        diagnostics.push({
          code: 'DYNAMIC_CALL_UNRESOLVED', severity: 'warning',
          artifactId: programName, startLine: srcLine,
          message: `Dynamic CALL through '${varName}' could not be resolved`,
          relatedSymbol: varName, component: 'cobol-parser-v2',
        });
        addEdge({
          to: `<DYNAMIC:${varName}>`, relType: 'CALLS_DYNAMIC', mkpType: 'dyn',
          confidence: 0, confidenceLevel: 'UNRESOLVED',
          sourcePara: currentPara, sourceLine: srcLine,
          constructType: 'CALL_IDENTIFIER_UNRESOLVED',
        });
      }
      continue;
    }

    // File I/O operations: READ/WRITE/REWRITE file-name
    const ioMatch = /\b(READ|WRITE|REWRITE|DELETE|START|OPEN(?:\s+(?:INPUT|OUTPUT|I-O|EXTEND))?)\s+([A-Z#@$][A-Z0-9#@$-]{0,29})\b/.exec(up);
    if (ioMatch) {
      const opVerb = ioMatch[1].replace(/\s+/g, '_').toUpperCase();
      const fileName = ioMatch[2];
      const relTypeMap: Record<string, string> = {
        READ: 'READS', WRITE: 'WRITES', REWRITE: 'REWRITES',
        DELETE: 'DELETES_FROM', START: 'STARTS_ON',
        OPEN_INPUT: 'OPENS_INPUT', OPEN_OUTPUT: 'OPENS_OUTPUT',
        OPEN_I_O: 'OPENS_IO', OPEN_EXTEND: 'OPENS_OUTPUT',
      };
      if (isValidId(fileName) && !COBOL_RESERVED.has(opVerb.split('_')[0])) {
        const relType = relTypeMap[opVerb] ?? 'READS';
        addEdge({
          to: fileName, relType, mkpType: 'data',
          label: opVerb.replace(/_/g, ' '),
          confidence: 100, confidenceLevel: 'DETERMINISTIC',
          sourcePara: currentPara, sourceLine: srcLine,
          constructType: `FILE_${opVerb}`,
        });
      }
    }
  }

  // ── COPY statements anywhere in source (catch ones in PROCEDURE DIVISION too) ──
  const copyRe = /\bCOPY\s+([A-Z0-9#@$-]+)/gi;
  let cpMatch: RegExpExecArray | null;
  let lineIdx = 0;
  for (let i = 0; i < logical.length; i++) {
    copyRe.lastIndex = 0;
    const cpm = copyRe.exec(logical[i].toUpperCase());
    if (!cpm) continue;
    const cpName = cpm[1].replace(/[."]/g, '');
    if (!isValidId(cpName) || cpName === programName) continue;
    const key = `copy:${cpName}`;
    if (!seen.has(key)) {
      seen.add(key);
      const isKnown = knownCopybooks.has(cpName);
      rawEdges.push({
        to: cpName, relType: 'USES_COPYBOOK', mkpType: 'copy',
        label: 'COPY',
        confidence: 100,
        confidenceLevel: isKnown ? 'DETERMINISTIC' : 'MISSING',
        sourceLine: lineMap[i],
        constructType: 'COPY_STATEMENT',
      });
    }
  }
}

// ─── Pass 3: Internal flow (paragraph-level CFG) ──────────────────────────────

function extractInternalFlow(
  logical: string[],
  lineMap: number[],
  programName: string
): ProgramFlow {
  const paragraphs: ParagraphInfo[] = [];
  const sections: string[] = [];
  const cfgEdges: CfgEdge[] = [];
  const seen = new Set<string>();

  let inProcedure = false;
  let currentPara: string = programName;
  let currentSection: string | undefined;

  for (let i = 0; i < logical.length; i++) {
    const line = logical[i];
    const up = line.toUpperCase();

    if (/\bPROCEDURE\s+DIVISION\b/.test(up)) { inProcedure = true; continue; }
    if (/\b(IDENTIFICATION|ENVIRONMENT|DATA)\s+DIVISION\b/.test(up)) { inProcedure = false; continue; }
    if (!inProcedure) continue;

    const col7 = line.length > 6 ? line[6] : ' ';
    const col8 = line.length > 7 ? line[7] : ' ';

    if (col8 !== ' ' && col7 === ' ') {
      const areaContent = line.slice(7).trimEnd().toUpperCase();

      const secMatch = /^([A-Z0-9][A-Z0-9-]*)\s+SECTION\s*\./.exec(areaContent);
      if (secMatch && !CLAUSE_WORDS.has(secMatch[1])) {
        currentSection = secMatch[1];
        sections.push(currentSection);
        continue;
      }

      const paraMatch = /^([A-Z0-9][A-Z0-9#@$-]*)\s*\./.exec(areaContent);
      if (paraMatch && !CLAUSE_WORDS.has(paraMatch[1]) && !COBOL_RESERVED.has(paraMatch[1])
          && !PERFORM_MODIFIER_WORDS.has(paraMatch[1])) {
        const name = paraMatch[1];
        if (paragraphs.length > 0 && paragraphs[paragraphs.length - 1].lineEnd === -1) {
          paragraphs[paragraphs.length - 1].lineEnd = lineMap[i] - 1;
        }
        currentPara = name;
        paragraphs.push({
          name,
          lineStart: lineMap[i],
          lineEnd: -1,
          sectionName: currentSection,
        });
      }
    }

    const upTrimmed = up.trim();

    // PERFORM <para> [THRU <para>] [UNTIL/VARYING/TIMES]
    const PERFORM_RE = /\bPERFORM\s+([A-Z0-9][A-Z0-9-]{1,29})(?:\s+(?:THRU|THROUGH)\s+([A-Z0-9][A-Z0-9-]{1,29}))?(?:\s+(UNTIL|VARYING|TIMES)\b)?/g;
    let pm: RegExpExecArray | null;
    PERFORM_RE.lastIndex = 0;
    while ((pm = PERFORM_RE.exec(upTrimmed)) !== null) {
      const target = pm[1];
      const isLoop = !!pm[3];
      if (!PERFORM_MODIFIER_WORDS.has(target) && !COBOL_RESERVED.has(target)) {
        const key = `${currentPara}:${target}`;
        if (!seen.has(key)) {
          seen.add(key);
          cfgEdges.push({
            from: currentPara, to: target,
            edgeType: isLoop ? 'LOOP_BACK' : 'PERFORM',
            evidenceLine: lineMap[i],
          });
        }
      }
    }

    // IF ... ELSE — record TRUE/FALSE branches at paragraph level
    if (/\bIF\b/.test(upTrimmed)) {
      const condMatch = /\bIF\s+(.{5,60}?)(?:\s+THEN\b|$)/.exec(upTrimmed);
      if (condMatch) {
        cfgEdges.push({
          from: currentPara, to: currentPara,
          edgeType: 'TRUE',
          condition: condMatch[1].trim().slice(0, 80),
          evidenceLine: lineMap[i],
        });
      }
    }

    // GO TO <para>
    const gotoMatch = /\bGO\s+TO\s+([A-Z0-9][A-Z0-9-]{1,29})\b/.exec(upTrimmed);
    if (gotoMatch && !COBOL_RESERVED.has(gotoMatch[1])) {
      const key = `goto:${currentPara}:${gotoMatch[1]}`;
      if (!seen.has(key)) {
        seen.add(key);
        cfgEdges.push({
          from: currentPara, to: gotoMatch[1],
          edgeType: 'GOTO', evidenceLine: lineMap[i],
        });
      }
    }

    // STOP RUN / GOBACK
    if (/\b(STOP\s+RUN|GOBACK)\b/.test(upTrimmed)) {
      cfgEdges.push({
        from: currentPara, to: '<<EXIT>>',
        edgeType: 'TERMINATE', evidenceLine: lineMap[i],
      });
    }
  }

  // Close last paragraph
  if (paragraphs.length > 0 && paragraphs[paragraphs.length - 1].lineEnd === -1) {
    paragraphs[paragraphs.length - 1].lineEnd = lineMap[logical.length - 1] ?? 0;
  }

  const entryParagraph = paragraphs.length > 0 ? paragraphs[0].name : programName;
  return { paragraphs, sections, cfgEdges, entryParagraph };
}
