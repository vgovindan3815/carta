import type {
  ParsedCobolProgram,
  GraphNode,
  GraphEdge,
  DependencyGraph,
  NodeType,
  EdgeType,
} from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip the fixed-format column 73-80 sequence area from a line. */
function stripSequenceArea(line: string): string {
  // COBOL fixed format: cols 1-6 sequence, col 7 indicator, cols 8-72 code, 73-80 sequence
  if (line.length > 72) return line.slice(0, 72);
  return line;
}

/** Return true when col 7 (index 6) is '*' or '/' — a comment line. */
function isCommentLine(line: string): boolean {
  return line.length >= 7 && (line[6] === '*' || line[6] === '/');
}

/** Return true when col 7 (index 6) is '-' — a continuation line. */
function isContinuationLine(line: string): boolean {
  return line.length >= 7 && line[6] === '-';
}

/** Normalise a COBOL program/table name to upper-case, no surrounding quotes. */
function normName(raw: string): string {
  return raw.replace(/['"]/g, '').trim().toUpperCase();
}

/**
 * Pre-process source lines:
 *  - Strip sequence area
 *  - Join continuation lines (col-7 = '-') into the previous logical line
 *  - Skip comment lines
 * Returns an array of logical COBOL source lines.
 */
function buildLogicalLines(source: string): string[] {
  const rawLines = source.split(/\r?\n/);
  const logical: string[] = [];

  for (const raw of rawLines) {
    const stripped = stripSequenceArea(raw);

    if (isCommentLine(stripped)) continue;

    if (isContinuationLine(stripped)) {
      // Continuation: append cols 12-72 (area B) to previous logical line
      const continuation = stripped.slice(11).trimEnd();
      if (logical.length > 0) {
        logical[logical.length - 1] += ' ' + continuation.trim();
      }
    } else {
      const code = stripped.trimEnd();
      if (code.trim().length > 0) {
        logical.push(code);
      }
    }
  }

  return logical;
}

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

function detectLanguage(filename: string, source: string): 'COBOL' | 'HLASM' {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'asm') return 'HLASM';

  // Check first few non-blank lines for HLASM signatures
  const lines = source.split(/\r?\n/);
  let checked = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    if (/\bCSECT\b|\bSTART\b|\bSTM\b/.test(trimmed)) return 'HLASM';
    if (++checked >= 10) break;
  }

  return 'COBOL';
}

// ---------------------------------------------------------------------------
// LOC counter
// ---------------------------------------------------------------------------

function countLoc(source: string): number {
  return source.split(/\r?\n/).filter((line) => {
    const t = line.trim();
    if (t.length === 0) return false;
    // Fixed-format comment
    if (line.length >= 7 && (line[6] === '*' || line[6] === '/')) return false;
    // Free-format COBOL comment (*>)
    if (t.startsWith('*>')) return false;
    return true;
  }).length;
}

// ---------------------------------------------------------------------------
// Program name
// ---------------------------------------------------------------------------

function extractProgramName(source: string, filename: string): string {
  const match = /PROGRAM-ID\s*\.\s*([A-Z0-9#@$-]+)/i.exec(source);
  if (match) return match[1].toUpperCase();
  // Fallback: use filename without extension
  return filename.split(/[/\\]/).pop()!.replace(/\.[^.]+$/, '').toUpperCase();
}

// ---------------------------------------------------------------------------
// LINKAGE SECTION extractor
// ---------------------------------------------------------------------------

function extractLinkageSection(source: string): string | undefined {
  const upper = source.toUpperCase();
  const start = upper.indexOf('LINKAGE SECTION');
  if (start === -1) return undefined;
  // Take up to the next SECTION or DIVISION
  const rest = upper.slice(start + 15);
  const nextSection = rest.search(/\b(?:WORKING-STORAGE|LOCAL-STORAGE|FILE|PROCEDURE)\s+(?:SECTION|DIVISION)\b/);
  const end = nextSection === -1 ? Math.min(rest.length, 4000) : nextSection;
  return source.slice(start, start + 15 + end).trim();
}

// ---------------------------------------------------------------------------
// Dependency extraction
// ---------------------------------------------------------------------------

interface RawEdge {
  to: string;
  type: EdgeType;
  label?: string;
  confidence?: number;
}

function extractDependencies(logicalLines: string[], programName: string): RawEdge[] {
  const edges: RawEdge[] = [];
  const seen = new Set<string>();

  function addEdge(raw: RawEdge) {
    const key = `${raw.type}:${raw.to}`;
    if (!seen.has(key) && raw.to !== programName) {
      seen.add(key);
      edges.push(raw);
    }
  }

  // Join all logical lines for multi-line EXEC block detection
  const fullText = logicalLines.join('\n').toUpperCase();

  // --- EXEC SQL blocks (multi-line) ---
  // Match EXEC SQL ... END-EXEC
  const execSqlRe = /EXEC\s+SQL\s+([\s\S]+?)END-EXEC/gi;
  let sqlMatch: RegExpExecArray | null;
  const fullTextOrig = logicalLines.join('\n');
  const fullTextUp = fullText;

  while ((sqlMatch = execSqlRe.exec(fullTextUp)) !== null) {
    const sqlBody = sqlMatch[1];
    // Extract table names from FROM, INTO, UPDATE, INSERT INTO
    const tableRe = /(?:FROM|INTO|UPDATE|JOIN)\s+([A-Z0-9#@$_-]+)/g;
    let tMatch: RegExpExecArray | null;
    while ((tMatch = tableRe.exec(sqlBody)) !== null) {
      const tname = tMatch[1].trim();
      if (tname && !SQL_KEYWORDS.has(tname)) {
        addEdge({ to: tname, type: 'data', label: 'SQL', confidence: 100 });
      }
    }
  }

  // --- EXEC CICS blocks ---
  const execCicsRe = /EXEC\s+CICS\s+([\s\S]+?)END-EXEC/gi;
  let cicsMatch: RegExpExecArray | null;
  while ((cicsMatch = execCicsRe.exec(fullTextUp)) !== null) {
    const cicsBody = cicsMatch[1];
    // FILE(name) or PROGRAM(name)
    const fileRe = /FILE\s*\(\s*['"]?([A-Z0-9#@$_-]+)['"]?\s*\)/g;
    const progRe = /PROGRAM\s*\(\s*['"]?([A-Z0-9#@$_-]+)['"]?\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = fileRe.exec(cicsBody)) !== null) {
      addEdge({ to: m[1].trim(), type: 'cics', label: 'CICS READ', confidence: 100 });
    }
    while ((m = progRe.exec(cicsBody)) !== null) {
      addEdge({ to: m[1].trim(), type: 'call', label: 'CICS LINK', confidence: 100 });
    }
  }

  // --- Process line by line for CALL and file I/O ---
  for (const line of logicalLines) {
    const up = line.toUpperCase().trim();

    // Skip EXEC blocks — already handled above
    if (/^EXEC\s+(SQL|CICS)/.test(up)) continue;

    // Static CALL: CALL 'PROGNAME' or CALL "PROGNAME"
    const staticCallRe = /\bCALL\s+['"]([A-Z0-9#@$-]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = staticCallRe.exec(up)) !== null) {
      addEdge({ to: normName(m[1]), type: 'call', confidence: 100 });
    }

    // Dynamic CALL: CALL identifier (no quotes, not a literal already captured)
    // Must not match CALL 'x' — those are handled above
    const dynCallRe = /\bCALL\s+([A-Z][A-Z0-9-]{1,29})(?:\s|$)/g;
    while ((m = dynCallRe.exec(up)) !== null) {
      const id = m[1].trim();
      if (!id.startsWith("'") && !id.startsWith('"') && !COBOL_RESERVED.has(id)) {
        addEdge({ to: id, type: 'dyn', label: 'dynamic', confidence: 71 });
      }
    }

    // File READ: READ filename
    const readRe = /\bREAD\s+([A-Z][A-Z0-9-]{1,29})(?:\s|$)/g;
    while ((m = readRe.exec(up)) !== null) {
      const id = m[1].trim();
      if (!COBOL_RESERVED.has(id) && !COBOL_IO_RESERVED.has(id)) {
        addEdge({ to: id, type: 'data', label: 'READ', confidence: 100 });
      }
    }

    // File WRITE: WRITE record-name [FROM ...]
    const writeRe = /\bWRITE\s+([A-Z][A-Z0-9-]{1,29})(?:\s|$)/g;
    while ((m = writeRe.exec(up)) !== null) {
      const id = m[1].trim();
      if (!COBOL_RESERVED.has(id) && !COBOL_IO_RESERVED.has(id)) {
        addEdge({ to: id, type: 'data', label: 'WRITE', confidence: 100 });
      }
    }

    // OPEN input-output files
    const openRe = /\bOPEN\s+(?:INPUT|OUTPUT|I-O|EXTEND)\s+([A-Z][A-Z0-9-]{1,29})/g;
    while ((m = openRe.exec(up)) !== null) {
      const id = m[1].trim();
      if (!COBOL_RESERVED.has(id)) {
        addEdge({ to: id, type: 'data', label: 'FILE', confidence: 100 });
      }
    }

    // COPY copybook-name (may appear with REPLACING clause — just capture the name)
    const copyRe = /\bCOPY\s+([A-Z][A-Z0-9-]{0,29})\b/g;
    while ((m = copyRe.exec(up)) !== null) {
      const id = m[1].trim();
      if (!COBOL_RESERVED.has(id)) {
        addEdge({ to: id, type: 'copy', label: 'COPY', confidence: 100 });
      }
    }
  }

  return edges;
}

// ---------------------------------------------------------------------------
// Reserved word sets (prevent false-positive node creation)
// ---------------------------------------------------------------------------

const SQL_KEYWORDS = new Set([
  'WHERE', 'AND', 'OR', 'NOT', 'ON', 'SET', 'VALUES', 'SELECT',
  'INSERT', 'UPDATE', 'DELETE', 'TABLE', 'VIEW', 'INDEX',
  'CURSOR', 'ORDER', 'GROUP', 'BY', 'HAVING', 'DISTINCT', 'ALL',
  'INNER', 'OUTER', 'LEFT', 'RIGHT', 'FULL', 'CROSS',
]);

const COBOL_RESERVED = new Set([
  'VARYING', 'UNTIL', 'AFTER', 'BEFORE', 'NEXT', 'END',
  'SENTENCE', 'ELSE', 'TRUE', 'FALSE', 'CORR', 'CORRESPONDING',
  'AT', 'INTO', 'FROM', 'BY', 'ON', 'GIVING', 'ROUNDED', 'SIZE',
  'ERROR', 'OVERFLOW', 'EXCEPTION', 'INVALID', 'KEY', 'NOT',
  'AND', 'OR', 'TO', 'THRU', 'THROUGH', 'PERFORM', 'MOVE',
  'COMPUTE', 'ADD', 'SUBTRACT', 'MULTIPLY', 'DIVIDE',
  'IF', 'EVALUATE', 'WHEN', 'OTHER', 'STOP', 'RUN',
  'GO', 'GOBACK', 'EXIT', 'PROGRAM', 'SECTION', 'PARAGRAPH',
  'USING', 'RETURNING', 'CONTENT', 'REFERENCE', 'LENGTH',
]);

const COBOL_IO_RESERVED = new Set([
  'RECORD', 'LINE', 'PAGE', 'TAPE', 'DISK', 'PRINTER', 'TERMINAL',
]);

// ---------------------------------------------------------------------------
// Layout algorithms
// ---------------------------------------------------------------------------

function buildRectLayout(
  heroName: string,
  edges: RawEdge[]
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const W = 140; const H = 44; const GAP_X = 30; const GAP_Y = 60;

  const callees = edges.filter((e) => e.type === 'call' || e.type === 'dyn').map((e) => e.to);
  const dataNodes = edges.filter((e) => e.type === 'data' || e.type === 'cics').map((e) => e.to);

  // De-duplicate while preserving order
  const uniqueCallees = [...new Set(callees)];
  const uniqueData = [...new Set(dataNodes)];

  const nodes: GraphNode[] = [];
  const nodeMap = new Map<string, GraphNode>();

  // Center the hero
  const heroX = Math.max(400, ((uniqueCallees.length - 1) * (W + GAP_X)) / 2 + 60);
  const heroNode: GraphNode = {
    id: heroName, label: heroName, sub: 'COBOL', type: 'hero',
    x: heroX, y: 80, w: W, h: H,
  };
  nodes.push(heroNode);
  nodeMap.set(heroName, heroNode);

  // Callees — row below hero
  uniqueCallees.forEach((name, i) => {
    const n: GraphNode = {
      id: name, label: name, sub: 'PROG', type: 'prog',
      x: i * (W + GAP_X) + 60, y: 80 + H + GAP_Y, w: W, h: H,
    };
    nodes.push(n);
    nodeMap.set(name, n);
  });

  // Data nodes — bottom row
  uniqueData.forEach((name, i) => {
    const n: GraphNode = {
      id: name, label: name, sub: 'DATA', type: 'data',
      x: i * (W + GAP_X) + 60, y: 80 + (H + GAP_Y) * 2, w: W, h: H,
    };
    nodes.push(n);
    nodeMap.set(name, n);
  });

  // Build GraphEdge list
  const graphEdges: GraphEdge[] = edges.map((e) => ({
    from: heroName,
    to: e.to,
    type: e.type,
    label: e.label,
    confidence: e.confidence,
    fd: 'bottom',
    td: 'top',
  }));

  return { nodes, edges: graphEdges };
}

function buildCircularLayout(
  heroName: string,
  edges: RawEdge[],
  rectNodes: GraphNode[]
): GraphNode[] {
  const CX = 280; const CY = 230;
  const R_HERO = 44;
  const R_INNER = 150;
  const R_OUTER = 250;
  const NODE_R = 36;

  // Classify nodes
  const directCallees = edges
    .filter((e) => e.type === 'call' || e.type === 'dyn')
    .map((e) => e.to);
  const dataAndCics = edges
    .filter((e) => e.type === 'data' || e.type === 'cics')
    .map((e) => e.to);

  const uniqueInner = [...new Set(directCallees)];
  const uniqueOuter = [...new Set(dataAndCics)];

  const cNodes: GraphNode[] = [];

  // Hero at center
  const heroRect = rectNodes.find((n) => n.id === heroName);
  cNodes.push({
    ...(heroRect ?? { id: heroName, label: heroName, sub: 'COBOL', type: 'hero' as NodeType }),
    cx: CX, cy: CY, r: R_HERO,
  });

  // Inner ring — direct program calls
  uniqueInner.forEach((name, i) => {
    const angle = (2 * Math.PI * i) / Math.max(uniqueInner.length, 1) - Math.PI / 2;
    const rect = rectNodes.find((n) => n.id === name);
    cNodes.push({
      ...(rect ?? { id: name, label: name, sub: 'PROG', type: 'prog' as NodeType }),
      cx: Math.round(CX + R_INNER * Math.cos(angle)),
      cy: Math.round(CY + R_INNER * Math.sin(angle)),
      r: NODE_R,
    });
  });

  // Outer ring — data/CICS
  uniqueOuter.forEach((name, i) => {
    const angle = (2 * Math.PI * i) / Math.max(uniqueOuter.length, 1) - Math.PI / 2;
    const rect = rectNodes.find((n) => n.id === name);
    cNodes.push({
      ...(rect ?? { id: name, label: name, sub: 'DATA', type: 'data' as NodeType }),
      cx: Math.round(CX + R_OUTER * Math.cos(angle)),
      cy: Math.round(CY + R_OUTER * Math.sin(angle)),
      r: NODE_R,
    });
  });

  return cNodes;
}

// ---------------------------------------------------------------------------
// Coverage estimate
// ---------------------------------------------------------------------------

/**
 * Coverage = percentage of program dependencies that could be resolved
 * to a known named program (static calls = 100%, dynamic = 71%).
 */
function computeCoverage(edges: RawEdge[]): number {
  if (edges.length === 0) return 100;
  const callEdges = edges.filter((e) => e.type === 'call' || e.type === 'dyn');
  if (callEdges.length === 0) return 100;
  const total = callEdges.reduce((sum, e) => sum + (e.confidence ?? 100), 0);
  return Math.round(total / callEdges.length);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function parseCobolFile(filename: string, source: string): ParsedCobolProgram {
  const language = detectLanguage(filename, source);
  const loc = countLoc(source);
  const programName = extractProgramName(source, filename);
  const linkageSection = extractLinkageSection(source);

  const logicalLines = buildLogicalLines(source);
  const rawEdges = extractDependencies(logicalLines, programName);

  const { nodes: rectNodes, edges: graphEdges } = buildRectLayout(programName, rawEdges);
  const circularNodes = buildCircularLayout(programName, rawEdges, rectNodes);

  // Attach circular coords back onto rect nodes for unified node list
  const mergedNodes: GraphNode[] = rectNodes.map((n) => {
    const cn = circularNodes.find((c) => c.id === n.id);
    return cn ? { ...n, cx: cn.cx, cy: cn.cy, r: cn.r } : n;
  });

  const coveragePct = computeCoverage(rawEdges);

  const graph: DependencyGraph = {
    nodes: mergedNodes,
    edges: graphEdges,
    coveragePct,
  };

  return {
    name: programName,
    language,
    loc,
    source,
    graph,
    linkageSection,
  };
}
