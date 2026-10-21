import type {
  ParsedCobolProgram,
  GraphNode,
  GraphEdge,
  DependencyGraph,
  NodeType,
} from './types';

// ---------------------------------------------------------------------------
// Layout constants (match cobol.ts)
// ---------------------------------------------------------------------------

const NODE_R = 36;
const R_HERO = 44;
const R_INNER = 150;
const R_OUTER = 250;
const MARGIN = 20;
const CX = R_OUTER + NODE_R + MARGIN; // 306
const CY = R_OUTER + NODE_R + MARGIN; // 306

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normName(raw: string): string {
  return raw.replace(/['"]/g, '').trim().toUpperCase();
}

/** Strip block comments from a line (single-line occurrences). */
function stripLineComments(line: string): string {
  // Remove block comments on the same line
  return line.replace(/\/\*[^*]*\*\//g, ' ');
}

/** Build logical lines: strip block comments and blank lines. */
function buildLogicalLines(source: string): string[] {
  const rawLines = source.split(/\r?\n/);
  const logical: string[] = [];
  let inBlockComment = false;

  for (let raw of rawLines) {
    if (inBlockComment) {
      const closeIdx = raw.indexOf('*/');
      if (closeIdx !== -1) {
        inBlockComment = false;
        raw = raw.slice(closeIdx + 2);
      } else {
        continue;
      }
    }

    // Remove inline block comment pairs
    raw = stripLineComments(raw);

    // Check for an opening block comment that wasn't closed on the same line
    const openIdx = raw.indexOf('/*');
    if (openIdx !== -1) {
      raw = raw.slice(0, openIdx);
      inBlockComment = true;
    }

    const trimmed = raw.trim();
    if (trimmed.length > 0) {
      logical.push(trimmed.toUpperCase());
    }
  }

  return logical;
}

/** Count non-blank, non-comment lines of source. */
function countLoc(source: string): number {
  const rawLines = source.split(/\r?\n/);
  let loc = 0;
  let inBlockComment = false;

  for (const raw of rawLines) {
    let line = raw.trim();
    if (!line) continue;

    if (inBlockComment) {
      const closeIdx = line.indexOf('*/');
      if (closeIdx !== -1) {
        inBlockComment = false;
        line = line.slice(closeIdx + 2).trim();
        if (line.length > 0) loc++;
      }
      continue;
    }

    // Check for block comment start
    const openIdx = line.indexOf('/*');
    if (openIdx !== -1) {
      if (line.slice(0, openIdx).trim().length > 0) loc++;
      const closeIdx = line.indexOf('*/', openIdx + 2);
      if (closeIdx === -1) {
        inBlockComment = true;
      }
      continue;
    }

    loc++;
  }

  return loc;
}

// ---------------------------------------------------------------------------
// Circular layout (same as cobol.ts)
// ---------------------------------------------------------------------------

function buildCircularLayout(
  heroId: string,
  nodes: GraphNode[],
  edges: GraphEdge[]
): GraphNode[] {
  const callees = new Set<string>();
  const outer = new Set<string>();

  for (const e of edges) {
    if (e.from === heroId && (e.type === 'call' || e.type === 'dyn')) callees.add(e.to);
    else if (e.from === heroId && (e.type === 'data' || e.type === 'cics' || e.type === 'copy')) outer.add(e.to);
    else if (e.to === heroId && (e.type === 'data' || e.type === 'cics')) outer.add(e.from);
  }

  // Remove overlap
  for (const id of callees) outer.delete(id);

  const innerIds = [...callees];
  const outerIds = [...outer];

  return nodes.map((n) => {
    if (n.id === heroId) {
      return { ...n, cx: CX, cy: CY, r: R_HERO };
    }
    const innerIdx = innerIds.indexOf(n.id);
    if (innerIdx !== -1) {
      const angle = (2 * Math.PI * innerIdx) / Math.max(innerIds.length, 1);
      return { ...n, cx: Math.round(CX + R_INNER * Math.cos(angle)), cy: Math.round(CY + R_INNER * Math.sin(angle)), r: NODE_R };
    }
    const outerIdx = outerIds.indexOf(n.id);
    if (outerIdx !== -1) {
      const angle = (2 * Math.PI * outerIdx) / Math.max(outerIds.length, 1);
      return { ...n, cx: Math.round(CX + R_OUTER * Math.cos(angle)), cy: Math.round(CY + R_OUTER * Math.sin(angle)), r: NODE_R };
    }
    return { ...n, r: NODE_R };
  });
}

// ---------------------------------------------------------------------------
// Dependency extraction
// ---------------------------------------------------------------------------

interface Deps {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

function extractDependencies(heroId: string, lines: string[]): Deps {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const nodeSet = new Set<string>();
  const edgeSet = new Set<string>();

  function addNode(id: string, label: string, sub: string, type: NodeType) {
    if (!nodeSet.has(id)) {
      nodeSet.add(id);
      nodes.push({ id, label, sub, type });
    }
  }

  function addEdge(from: string, to: string, type: GraphEdge['type'], label?: string) {
    const key = `${from}→${to}:${type}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      edges.push({ from, to, type, ...(label ? { label } : {}) });
    }
  }

  // Track ENTRY/VARIABLE declarations for dynamic call detection
  const entryVars = new Set<string>();

  for (const line of lines) {
    // ENTRY variable declarations: DECLARE name ENTRY or DECLARE name VARIABLE ENTRY
    const declMatch = line.match(/DECLARE\s+(\w+)\s+.*ENTRY/);
    if (declMatch) entryVars.add(normName(declMatch[1]));

    // Static CALL: CALL progname(  or  CALL progname;
    const callMatch = line.match(/\bCALL\s+([A-Z$#@][\w$#@]*)\s*[;(]/);
    if (callMatch) {
      const callee = normName(callMatch[1]);
      if (callee !== heroId) {
        const isDyn = entryVars.has(callee);
        addNode(callee, callee, isDyn ? 'dyn-call' : 'called program', 'prog');
        addEdge(heroId, callee, isDyn ? 'dyn' : 'call');
      }
    }

    // EXEC SQL
    const sqlMatch = line.match(/EXEC\s+SQL\s+(\w+(?:\s+\w+)?)/);
    if (sqlMatch) {
      const verb = sqlMatch[1].trim().replace(/\s+/g, ' ');
      // Extract table name from SELECT/INSERT/UPDATE/DELETE/FETCH
      const tableMatch = line.match(/(?:FROM|INTO|UPDATE|JOIN)\s+([A-Z][\w.]*)/);
      const tableName = tableMatch ? normName(tableMatch[1].split('.').pop() ?? tableMatch[1]) : `SQL_${verb.split(' ')[0]}`;
      addNode(tableName, tableName, `SQL ${verb}`, 'data');
      addEdge(heroId, tableName, 'data', verb);
    }

    // File I/O: READ/WRITE/OPEN FILE(name)
    const fileMatch = line.match(/\b(?:READ|WRITE|OPEN|CLOSE|REWRITE|DELETE)\s+FILE\s*\(\s*([A-Z][\w]*)\s*\)/);
    if (fileMatch) {
      const fname = normName(fileMatch[1]);
      const verb = line.match(/\b(READ|WRITE|OPEN|CLOSE|REWRITE|DELETE)\b/)?.[1] ?? 'FILE';
      addNode(fname, fname, `FILE ${verb}`, 'data');
      addEdge(heroId, fname, 'data', verb);
    }

    // %INCLUDE or COPY (copybooks / include members)
    const includeMatch = line.match(/%INCLUDE\s+([A-Z][\w]*)|COPY\s+([A-Z][\w]*)/);
    if (includeMatch) {
      const incName = normName(includeMatch[1] ?? includeMatch[2]);
      addNode(incName, incName, 'include member', 'cpy');
      addEdge(heroId, incName, 'copy');
    }

    // EXEC CICS (basic detection)
    const cicsMatch = line.match(/EXEC\s+CICS\s+(\w+)/);
    if (cicsMatch) {
      const verb = cicsMatch[1];
      // Look for PROGRAM or TRANSID
      const pgmMatch = line.match(/PROGRAM\s*\(\s*([A-Z][\w]*)\s*\)/);
      if (pgmMatch) {
        const pgm = normName(pgmMatch[1]);
        addNode(pgm, pgm, `CICS ${verb}`, 'sys');
        addEdge(heroId, pgm, 'cics', verb);
      } else {
        const sysId = `CICS_${verb}`;
        addNode(sysId, verb, `CICS ${verb}`, 'sys');
        addEdge(heroId, sysId, 'cics', verb);
      }
    }
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function parsePliFile(filename: string, source: string): ParsedCobolProgram {
  // Derive program name
  let progName = filename
    .split(/[/\\]/)
    .pop()
    ?.replace(/\.(pl1|pli)$/i, '')
    .toUpperCase() ?? filename.toUpperCase();

  const lines = buildLogicalLines(source);

  // Try to detect PROCEDURE/PROC statement to get the declared program name
  for (const line of lines.slice(0, 50)) {
    const procMatch = line.match(/^(\w+)\s*:\s*(?:PROCEDURE|PROC)\b/);
    if (procMatch) {
      progName = normName(procMatch[1]);
      break;
    }
  }

  const loc = countLoc(source);
  const heroId = progName;

  const { nodes: depNodes, edges } = extractDependencies(heroId, lines);

  // Hero node first
  const heroNode: GraphNode = {
    id: heroId,
    label: heroId,
    sub: 'PL/I Program',
    type: 'hero',
    cx: CX, cy: CY, r: R_HERO,
  };

  const allNodes = [heroNode, ...depNodes];
  const layoutNodes = buildCircularLayout(heroId, allNodes, edges);

  const graph: DependencyGraph = {
    nodes: layoutNodes,
    edges,
    coveragePct: 100,
  };

  return {
    name: progName,
    language: 'PLI',
    loc,
    source,
    graph,
  };
}
