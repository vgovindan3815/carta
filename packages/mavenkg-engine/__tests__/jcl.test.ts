import { parseJclV2 } from '../src/parsers/jcl';

const BANKMAIN_JCL = `
//BANKMAIN JOB (ACCT),'BANK DEMO',CLASS=A,MSGCLASS=X
//*
//STEP010  EXEC PGM=BBANK00P,REGION=4M
//STEPLIB  DD  DSN=BANK.LOADLIB,DISP=SHR
//SYSPRINT DD  SYSOUT=*
//CUSTFILE DD  DSN=BANK.CUSTOMERS,DISP=SHR
//OUTFILE  DD  DSN=BANK.RESULTS,DISP=(NEW,CATLG,DELETE)
//*
//STEP020  EXEC PGM=SORT
//SORTIN   DD  DSN=BANK.RESULTS,DISP=SHR
//SORTOUT  DD  DSN=BANK.SORTED,DISP=(NEW,CATLG,DELETE)
//SYSIN    DD  *
  SORT FIELDS=(1,8,AN,A)
//STEP030  EXEC PROC=BANKRPTS
`;

describe('JCL Parser v2', () => {
  const result = parseJclV2(BANKMAIN_JCL, 'BANKMAIN.jcl', {
    knownPrograms: new Set(['BBANK00P', 'SORT']),
    knownProcs: new Set(['BANKRPTS']),
    knownDatasets: new Set(['BANK.CUSTOMERS', 'BANK.LOADLIB']),
  });
  const { report } = result;

  it('extracts JOB name', () => {
    expect(report.name).toBe('BANKMAIN');
  });

  it('language is JCL', () => {
    expect(report.language).toBe('JCL');
  });

  it('detects STEP010 EXEC PGM=BBANK00P — DETERMINISTIC', () => {
    const edge = report.edges.find(e => e.to === 'BBANK00P');
    expect(edge).toBeDefined();
    expect(edge!.confidenceLevel).toBe('DETERMINISTIC');
  });

  it('detects STEP020 EXEC PGM=SORT — DETERMINISTIC', () => {
    const edge = report.edges.find(e => e.to === 'SORT');
    expect(edge).toBeDefined();
    expect(edge!.confidenceLevel).toBe('DETERMINISTIC');
  });

  it('detects STEP030 EXEC PROC=BANKRPTS — DETERMINISTIC', () => {
    const edge = report.edges.find(e => e.to === 'BANKRPTS');
    expect(edge).toBeDefined();
    expect(edge!.type).toBe('proc');
    expect(edge!.confidenceLevel).toBe('DETERMINISTIC');
  });

  it('detects CUSTFILE DD DSN=BANK.CUSTOMERS as INPUT', () => {
    const edge = report.edges.find(e => e.to === 'BANK.CUSTOMERS');
    expect(edge).toBeDefined();
    expect(edge!.type).toBe('data');
    expect(edge!.label).toBe('READS');
    expect(edge!.confidenceLevel).toBe('DETERMINISTIC');
  });

  it('detects OUTFILE DD DSN=BANK.RESULTS,DISP=(NEW,...) as OUTPUT', () => {
    // NEW disposition → write
    const edge = report.edges.find(e => e.to === 'BANK.RESULTS' && e.label === 'WRITES');
    expect(edge).toBeDefined();
    expect(edge!.confidenceLevel).toBe('DETERMINISTIC');
  });

  it('populates evidence records with source lines', () => {
    expect(report.evidenceRecords.length).toBeGreaterThan(0);
    for (const ev of report.evidenceRecords) {
      expect(ev.startLine).toBeGreaterThan(0);
    }
  });

  it('produces KG nodes for each step', () => {
    const stepNodes = report.kgNodes.filter(n => n.nodeType === 'JOB_STEP');
    expect(stepNodes.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── PROC expansion ───────────────────────────────────────────────────────────

const JCL_WITH_INLINE_PROC = `
//TESTJOB  JOB (ACCT),'TEST'
//MYPROC   PROC PGM1=DEFAULT1
//PS1      EXEC PGM=&PGM1
//SYSPRINT DD   SYSOUT=*
/         PEND
//STEP1    EXEC PROC=MYPROC,PGM1=BBANK99P
`;

describe('JCL Parser v2 — PROC expansion', () => {
  const result = parseJclV2(JCL_WITH_INLINE_PROC, 'TESTJOB.jcl', {
    knownPrograms: new Set(['BBANK99P', 'DEFAULT1']),
  });
  const { report } = result;

  it('expands inline PROC with symbolic override', () => {
    const edge = report.edges.find(e => e.to === 'BBANK99P');
    expect(edge).toBeDefined();
    expect(edge!.confidenceLevel).toBe('RESOLVED');
  });
});

// ─── Missing PROC detection ───────────────────────────────────────────────────

describe('JCL Parser v2 — missing PROC', () => {
  const jcl = `
//JOB1     JOB (X),'TEST'
//STEP1    EXEC PROC=UNKNOWNP
`;
  const result = parseJclV2(jcl, 'JOB1.jcl', { knownProcs: new Set() });
  const { report } = result;

  it('marks unknown PROC as MISSING', () => {
    const edge = report.edges.find(e => e.to === 'UNKNOWNP');
    expect(edge!.confidenceLevel).toBe('MISSING');
  });

  it('emits PROC_NOT_FOUND diagnostic', () => {
    const diag = report.diagnostics.find(d => d.code === 'PROC_NOT_FOUND');
    expect(diag).toBeDefined();
  });
});
