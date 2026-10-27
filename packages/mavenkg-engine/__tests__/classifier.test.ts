import { classify, isCopybook } from '../src/classifier';

describe('Artifact Classifier', () => {
  describe('extension-based (DETERMINISTIC)', () => {
    it.each([
      ['BBANK20P.cbl', 'COBOL'],
      ['BANKMAIN.jcl', 'JCL'],
      ['SORTPROC.proc', 'PROC'],
      ['BANKMOD.pli', 'PLI'],
      ['BBANK00D.cpy', 'COPYBOOK'],
    ])('%s → %s', (filename, expected) => {
      const r = classify(filename);
      expect(r.language).toBe(expected);
      expect(r.confidence).toBe('DETERMINISTIC');
    });
  });

  describe('content-based (RESOLVED or CANDIDATE)', () => {
    it('detects COBOL from content', () => {
      const src = `
       IDENTIFICATION DIVISION.
       PROGRAM-ID. TEST.
       PROCEDURE DIVISION.
       MAIN. STOP RUN.
      `;
      const r = classify('NOEXT', src);
      expect(r.language).toBe('COBOL');
      expect(['RESOLVED', 'CANDIDATE']).toContain(r.confidence);
    });

    it('detects JCL from content', () => {
      const src = `//TESTJOB JOB (X),'TEST'\n//STEP1 EXEC PGM=IEFBR14\n//*`;
      const r = classify('MYFILE', src);
      expect(r.language).toBe('JCL');
    });

    it('detects PROC from content', () => {
      const src = `//MYPRC   PROC\n//PS1     EXEC PGM=SORT\n/ PEND`;
      const r = classify('MYPRC', src);
      expect(r.language).toBe('PROC');
    });

    it('returns SKIP for non-mainframe extension', () => {
      const r = classify('config.xml', '<config></config>');
      expect(r.language).toBe('SKIP');
    });

    it('returns UNKNOWN for truly unrecognised extension with no content match', () => {
      const r = classify('config.xyz', 'random binary data 12345');
      expect(r.language).toBe('UNKNOWN');
    });
  });

  describe('isCopybook', () => {
    it('returns true for .cpy extension', () => {
      expect(isCopybook('BBANK00D.cpy')).toBe(true);
    });

    it('returns true for COBOL data structure without PROCEDURE DIVISION', () => {
      const src = `
       01 CUSTOMER-RECORD.
          05 CUST-ID       PIC 9(10).
          05 CUST-NAME     PIC X(40).
      `;
      expect(isCopybook('BBANK00D.cbl', src)).toBe(true);
    });

    it('returns false for COBOL with PROCEDURE DIVISION', () => {
      const src = `
       IDENTIFICATION DIVISION.
       PROGRAM-ID. TEST.
       PROCEDURE DIVISION.
       MAIN. STOP RUN.
      `;
      expect(isCopybook('TEST.cbl', src)).toBe(false);
    });
  });
});
