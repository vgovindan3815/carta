/**
 * SQL DDL Parser — extracts DB2 table/view/index definitions.
 *
 * Parses standalone .sql / .ddl files (CREATE TABLE, CREATE VIEW, CREATE INDEX)
 * and produces KG nodes so the COBOL and JCL parsers can resolve SQL references
 * against known table names.
 *
 * Not a full SQL parser — just enough to extract entity names for the registry.
 */

import { randomUUID } from 'crypto';
import type { KgNode, EvidenceRecord, Diagnostic } from '../ontology';
import type { ArtifactReport, MkpCompatNode } from '../output';

// ─── Patterns ─────────────────────────────────────────────────────────────────

// Matches: CREATE [OR REPLACE] [GLOBAL TEMPORARY] TABLE schema.name (
const CREATE_TABLE_RE =
  /CREATE\s+(?:OR\s+REPLACE\s+)?(?:GLOBAL\s+TEMPORARY\s+)?TABLE\s+([A-Z#@$][A-Z0-9#@$_.]{0,63})/gi;

// Matches: CREATE [OR REPLACE] VIEW schema.name AS
const CREATE_VIEW_RE =
  /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+([A-Z#@$][A-Z0-9#@$_.]{0,63})\s+AS/gi;

// Matches: CREATE [UNIQUE] INDEX name ON schema.table
const CREATE_INDEX_RE =
  /CREATE\s+(?:UNIQUE\s+)?INDEX\s+[A-Z#@$][A-Z0-9#@$_.]*\s+ON\s+([A-Z#@$][A-Z0-9#@$_.]{0,63})/gi;

// Matches: CREATE ALIAS alias FOR schema.table
const CREATE_ALIAS_RE =
  /CREATE\s+ALIAS\s+([A-Z#@$][A-Z0-9#@$_.]{0,63})\s+FOR/gi;

function stripSchema(name: string): string {
  return name.split('.').pop()!.toUpperCase();
}

function countLoc(source: string): number {
  return source.split(/\r?\n/).filter(l => {
    const t = l.trim();
    return t.length > 0 && !t.startsWith('--') && !t.startsWith('/*');
  }).length;
}

export interface ParsedSqlResult {
  report: ArtifactReport;
  /** All table/view names defined — used to seed the knownDatasets registry */
  definedEntities: Set<string>;
}

export function parseSqlDdl(
  source: string,
  filename: string,
  artifactId?: string
): ParsedSqlResult {
  const id = artifactId ?? filename;
  const loc = countLoc(source);
  const up = source.toUpperCase();

  const kgNodes: KgNode[] = [];
  const evidenceRecords: EvidenceRecord[] = [];
  const diagnostics: Diagnostic[] = [];
  const mkpNodes: MkpCompatNode[] = [];
  const definedEntities = new Set<string>();
  const added = new Set<string>();

  function addEntity(
    rawName: string,
    nodeType: 'DB2_TABLE' | 'DB2_VIEW',
    matchIndex: number
  ) {
    const name = stripSchema(rawName);
    if (!name || added.has(name)) return;
    added.add(name);
    definedEntities.add(name);

    // Approximate line number from character offset
    const lineNum = source.slice(0, matchIndex).split('\n').length;

    const evId = randomUUID();
    evidenceRecords.push({
      id: evId,
      artifactId: id,
      startLine: lineNum,
      endLine: lineNum,
      constructType: nodeType === 'DB2_TABLE' ? 'CREATE_TABLE' : 'CREATE_VIEW',
      extractedValue: rawName,
      normalizedValue: name,
    });

    kgNodes.push({
      id: `${nodeType}:${name}`,
      nodeType,
      canonicalName: name,
      displayName: rawName.toUpperCase(),
      sourceArtifactId: id,
      technology: 'DB2',
    });

    mkpNodes.push({
      id: name,
      label: name,
      sub: nodeType === 'DB2_TABLE' ? 'TABLE' : 'VIEW',
      type: 'data',
    });
  }

  // Tables
  let m: RegExpExecArray | null;
  CREATE_TABLE_RE.lastIndex = 0;
  while ((m = CREATE_TABLE_RE.exec(up)) !== null) {
    addEntity(m[1], 'DB2_TABLE', m.index);
  }

  // Views
  CREATE_VIEW_RE.lastIndex = 0;
  while ((m = CREATE_VIEW_RE.exec(up)) !== null) {
    addEntity(m[1], 'DB2_VIEW', m.index);
  }

  // Aliases (expose as TABLE nodes — same shape from COBOL's perspective)
  CREATE_ALIAS_RE.lastIndex = 0;
  while ((m = CREATE_ALIAS_RE.exec(up)) !== null) {
    addEntity(m[1], 'DB2_TABLE', m.index);
  }

  const report: ArtifactReport = {
    name: filename.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '').toUpperCase() ?? filename,
    language: 'SQL',
    loc,
    filePath: filename,
    coveragePct: 100,
    nodes: mkpNodes,
    edges: [],
    kgNodes,
    kgEdges: [],
    evidenceRecords,
    unresolvedRefs: [],
    diagnostics,
  };

  return { report, definedEntities };
}
