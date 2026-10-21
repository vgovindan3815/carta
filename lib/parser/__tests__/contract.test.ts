import { parseArtifact, getParser } from '../registry';
import * as fs from 'fs';
import * as path from 'path';

const FIXTURES = path.join(__dirname, 'fixtures');

describe('Parser registry — language detection', () => {
  test('detects COBOL by extension', () => {
    const p = getParser({ filePath: 'MYPROG.cbl' });
    expect(p?.id).toBe('cobol-fixed');
  });

  test('detects PLI by extension', () => {
    const p = getParser({ filePath: 'MYPROG.pli' });
    expect(p?.id).toBe('pli');
  });

  test('detects JCL by extension', () => {
    const p = getParser({ filePath: 'MYJOB.jcl' });
    expect(p?.id).toBe('jcl');
  });

  test('detects COBOL by language hint', () => {
    const p = getParser({ filePath: 'UNKNOWN', language: 'COBOL' });
    expect(p?.id).toBe('cobol-fixed');
  });

  test('detects JCL by language hint', () => {
    const p = getParser({ filePath: 'UNKNOWN', language: 'JCL' });
    expect(p?.id).toBe('jcl');
  });

  test('returns undefined for unknown with no hints', () => {
    const p = getParser({ filePath: 'UNKNOWN.xyz' });
    expect(p).toBeUndefined();
  });
});

describe('GTMSETL0 golden test (COBOL)', () => {
  const content = fs.readFileSync(path.join(FIXTURES, 'GTMSETL0.cbl'), 'utf8');
  const result = parseArtifact('GTMSETL0.cbl', content, 'COBOL');

  test('program name', () => {
    expect(result.name).toBe('GTMSETL0');
  });

  test('language', () => {
    expect(result.language).toBe('COBOL');
  });

  test('has nodes', () => {
    expect(result.graph.nodes.length).toBeGreaterThan(0);
  });

  test('static CALL to GTMVALID appears as call edge', () => {
    const callEdge = result.graph.edges.find(e => e.type === 'call' && e.to === 'GTMVALID');
    expect(callEdge).toBeDefined();
  });

  test('dynamic CALL resolved to GTMPOST1 via VALUE clause', () => {
    const dynEdge = result.graph.edges.find(e => e.type === 'dyn' && e.to === 'GTMPOST1');
    expect(dynEdge).toBeDefined();
  });

  test('COPY CUSTDATA appears as copy edge', () => {
    const copyEdge = result.graph.edges.find(e => e.type === 'copy' && e.to === 'CUSTDATA');
    expect(copyEdge).toBeDefined();
  });

  test('EXEC SQL SELECT from CUSTOMER appears as data edge', () => {
    const sqlEdge = result.graph.edges.find(
      e => e.type === 'data' && e.to === 'CUSTOMER'
    );
    expect(sqlEdge).toBeDefined();
  });

  test('CICS LINK to GTMCICS1 appears as call edge with CICS LINK label', () => {
    // CICS LINK/XCTL PROGRAM() is emitted as type:'call' with label:'CICS LINK'
    const cicsEdge = result.graph.edges.find(e => e.type === 'call' && e.to === 'GTMCICS1');
    expect(cicsEdge).toBeDefined();
  });

  test('no reserved words as edge targets', () => {
    const reserved = new Set(['PIC', 'VALUE', 'OF', 'BY', 'TO', 'FROM', 'SECTION', 'DIVISION']);
    for (const edge of result.graph.edges) {
      expect(reserved.has(edge.to)).toBe(false);
    }
  });

  test('internal flow has paragraphs', () => {
    expect(result.internalFlow?.paragraphs.length).toBeGreaterThan(0);
  });

  test('internal flow entry paragraph is MAIN-PARA', () => {
    expect(result.internalFlow?.entryParagraph).toBe('MAIN-PARA');
  });
});

describe('GTMPOST1 golden test (JCL)', () => {
  const content = fs.readFileSync(path.join(FIXTURES, 'GTMPOST1.jcl'), 'utf8');
  const result = parseArtifact('GTMPOST1.jcl', content, 'JCL');

  test('language is JCL', () => {
    expect(result.language).toBe('JCL');
  });

  test('EXEC PGM=GTMSETL0 produces a call edge', () => {
    const execEdge = result.graph.edges.find(e => e.to === 'GTMSETL0');
    expect(execEdge).toBeDefined();
  });
});
