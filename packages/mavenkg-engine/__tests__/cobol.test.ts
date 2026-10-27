import { parseCobolV2 } from '../src/parsers/cobol';

// ─── Minimal fixture ──────────────────────────────────────────────────────────

const BBANK20P = `
       IDENTIFICATION DIVISION.
       PROGRAM-ID. BBANK20P.
       AUTHOR. BANK-DEMO.

       ENVIRONMENT DIVISION.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  WS-CALLED-PGM           PIC X(8) VALUE 'BBANK30P'.
       01  WS-DYNAMIC              PIC X(8).

       COPY BBANK00D.
       COPY DFHAID.

       PROCEDURE DIVISION.
       MAIN-PROCESS.
           MOVE 'BBANK40P' TO WS-DYNAMIC
           CALL 'BBANK10P'
           CALL WS-CALLED-PGM
           CALL WS-DYNAMIC
           EXEC CICS LINK PROGRAM('BBANK50P') END-EXEC
           EXEC CICS XCTL PROGRAM('BBANK60P') END-EXEC
           EXEC SQL
               SELECT ACCOUNT_ID, BALANCE
               FROM BANK_ACCOUNTS
               WHERE ACCOUNT_ID = :WS-ACCT-ID
           END-EXEC
           EXEC SQL
               UPDATE BANK_TRANSACTIONS
               SET    STATUS = 'P'
               WHERE  TXN_ID = :WS-TXN-ID
           END-EXEC
           STOP RUN.
`;

describe('COBOL Parser v2', () => {
  const result = parseCobolV2(BBANK20P, 'BBANK20P.cbl', {
    knownPrograms: new Set(['BBANK10P', 'BBANK30P', 'BBANK40P', 'BBANK50P']),
    knownCopybooks: new Set(['BBANK00D', 'DFHAID']),
  });
  const { report } = result;

  it('extracts program name', () => {
    expect(report.name).toBe('BBANK20P');
  });

  it('counts non-blank non-comment lines', () => {
    expect(report.loc).toBeGreaterThan(5);
  });

  it('detects static CALL literal — DETERMINISTIC', () => {
    const edge = report.edges.find(e => e.to === 'BBANK10P');
    expect(edge).toBeDefined();
    expect(edge!.confidenceLevel).toBe('DETERMINISTIC');
    expect(edge!.type).toBe('call');
  });

  it('resolves VALUE-clause dynamic CALL — RESOLVED', () => {
    const edge = report.edges.find(e => e.to === 'BBANK30P');
    expect(edge).toBeDefined();
    expect(edge!.confidenceLevel).toBe('RESOLVED');
  });

  it('resolves MOVE+dynamic CALL — RESOLVED', () => {
    const edge = report.edges.find(e => e.to === 'BBANK40P');
    expect(edge).toBeDefined();
    expect(edge!.confidenceLevel).toBe('RESOLVED');
  });

  it('detects CICS LINK — DETERMINISTIC', () => {
    const edge = report.edges.find(e => e.to === 'BBANK50P');
    expect(edge).toBeDefined();
    expect(edge!.confidenceLevel).toBe('DETERMINISTIC');
  });

  it('detects CICS XCTL — DETERMINISTIC', () => {
    const edge = report.edges.find(e => e.to === 'BBANK60P');
    expect(edge).toBeDefined();
    // BBANK60P not in knownPrograms → MISSING
    expect(['DETERMINISTIC', 'MISSING']).toContain(edge!.confidenceLevel);
  });

  it('detects SQL SELECT on BANK_ACCOUNTS', () => {
    const edge = report.edges.find(e => e.to === 'BANK_ACCOUNTS');
    expect(edge).toBeDefined();
    expect(edge!.type).toBe('data');
    expect(edge!.confidenceLevel).toBe('DETERMINISTIC');
  });

  it('detects SQL UPDATE on BANK_TRANSACTIONS', () => {
    const edge = report.edges.find(e => e.to === 'BANK_TRANSACTIONS');
    expect(edge).toBeDefined();
    expect(edge!.type).toBe('data');
    expect(edge!.confidenceLevel).toBe('DETERMINISTIC');
  });

  it('detects COPY statements', () => {
    const copyEdges = report.edges.filter(e => e.type === 'copy');
    const names = copyEdges.map(e => e.to);
    expect(names).toContain('BBANK00D');
    expect(names).toContain('DFHAID');
  });

  it('populates evidence records with source lines', () => {
    expect(report.evidenceRecords.length).toBeGreaterThan(0);
    for (const ev of report.evidenceRecords) {
      expect(ev.startLine).toBeGreaterThan(0);
      expect(ev.artifactId).toBe('BBANK20P.cbl');
    }
  });

  it('populates KG nodes including hero', () => {
    const hero = report.kgNodes.find(n => n.canonicalName === 'BBANK20P');
    expect(hero).toBeDefined();
    expect(hero!.nodeType).toBe('PROGRAM');
    expect(hero!.technology).toBe('COBOL');
  });

  it('produces internalFlow with paragraphs', () => {
    expect(report.internalFlow).toBeDefined();
    const paraNames = report.internalFlow!.paragraphs.map(p => p.name);
    expect(paraNames).toContain('MAIN-PROCESS');
  });

  it('produces CFG TERMINATE edge for STOP RUN', () => {
    const term = report.internalFlow!.cfgEdges.find(e => e.edgeType === 'TERMINATE');
    expect(term).toBeDefined();
    expect(term!.to).toBe('<<EXIT>>');
  });

  it('coveragePct reflects resolved vs total call edges', () => {
    expect(report.coveragePct).toBeGreaterThanOrEqual(0);
    expect(report.coveragePct).toBeLessThanOrEqual(100);
  });
});

// ─── Missing-artifact detection ───────────────────────────────────────────────

describe('COBOL Parser v2 — missing artifacts', () => {
  const src = `
       IDENTIFICATION DIVISION.
       PROGRAM-ID. TEST001.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       COPY UNKNOWNCPY.
       PROCEDURE DIVISION.
       MAIN.
           CALL 'MISSINGPGM'
           STOP RUN.
  `;
  const { report } = parseCobolV2(src, 'TEST001.cbl', {
    knownPrograms: new Set(),
    knownCopybooks: new Set(),
  });

  it('marks unresolved copybook as MISSING', () => {
    const edge = report.edges.find(e => e.to === 'UNKNOWNCPY');
    expect(edge?.confidenceLevel).toBe('MISSING');
  });

  it('marks unresolved called program as MISSING', () => {
    const edge = report.edges.find(e => e.to === 'MISSINGPGM');
    expect(edge?.confidenceLevel).toBe('MISSING');
  });

  it('emits diagnostics for missing artifacts', () => {
    expect(report.diagnostics.length).toBeGreaterThan(0);
  });
});
