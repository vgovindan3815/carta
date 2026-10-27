/**
 * Artifact Classifier — extension + content-signature classification (spec §10.4).
 *
 * Classifies mainframe source files into Language categories so the engine
 * can route each to the correct parser.  Uses:
 *  1. File extension (fast path)
 *  2. Content-signature heuristics (for extension-less files or .cbl/.cob ambiguity)
 *  3. Confidence level attached to each classification
 */

export type ArtifactLanguage =
  | 'COBOL' | 'JCL' | 'PROC' | 'PLI' | 'HLASM' | 'EASYTRIEVE'
  | 'REXX' | 'CLIST' | 'COPYBOOK' | 'UNKNOWN';

export interface ClassificationResult {
  language: ArtifactLanguage;
  /** DETERMINISTIC = extension match; RESOLVED = content match; CANDIDATE = heuristic */
  confidence: 'DETERMINISTIC' | 'RESOLVED' | 'CANDIDATE';
  reason: string;
}

// ─── Extension map ─────────────────────────────────────────────────────────────

const EXTENSION_MAP: Record<string, ArtifactLanguage> = {
  cbl: 'COBOL', cob: 'COBOL', cobol: 'COBOL',
  jcl: 'JCL', job: 'JCL',
  proc: 'PROC', prc: 'PROC',
  pli: 'PLI', pl1: 'PLI', pls: 'PLI',
  asm: 'HLASM', hlasm: 'HLASM', mac: 'HLASM',
  ezt: 'EASYTRIEVE', ezy: 'EASYTRIEVE',
  rex: 'REXX', rexx: 'REXX', rxe: 'REXX',
  clist: 'CLIST', clst: 'CLIST',
  cpy: 'COPYBOOK', copy: 'COPYBOOK', cpb: 'COPYBOOK',
};

// ─── Content signatures ────────────────────────────────────────────────────────

interface ContentSignature {
  language: ArtifactLanguage;
  patterns: RegExp[];
  /** minimum number of patterns that must match */
  minMatches: number;
}

const CONTENT_SIGNATURES: ContentSignature[] = [
  {
    language: 'JCL',
    patterns: [
      /^\/\/[A-Z#@$][A-Z0-9#@$-]{0,7}\s+JOB\b/im,
      /^\/\/[A-Z#@$]?[A-Z0-9#@$-]{0,7}\s+EXEC\s+(?:PGM|PROC)=/im,
      /^\/\/\*/m,
    ],
    minMatches: 2,
  },
  {
    language: 'PROC',
    patterns: [
      /^\/\/[A-Z#@$][A-Z0-9#@$-]{0,7}\s+PROC\b/im,
      /^\/\s+PEND\b/m,
    ],
    minMatches: 1,
  },
  {
    language: 'COBOL',
    patterns: [
      /\bIDENTIFICATION\s+DIVISION\b/i,
      /\bPROGRAM-ID\s*\./i,
      /\bPROCEDURE\s+DIVISION\b/i,
      /\bWORKING-STORAGE\s+SECTION\b/i,
      /\b(PERFORM|MOVE|COMPUTE|DISPLAY|ACCEPT)\b/i,
    ],
    minMatches: 2,
  },
  {
    language: 'COPYBOOK',
    patterns: [
      /^\s+\d{2}\s+[A-Z#@$][A-Z0-9#@$-]*\s+PIC\b/im,
      /^\s+\d{2}\s+[A-Z#@$][A-Z0-9#@$-]*\s+REDEFINES\b/im,
    ],
    minMatches: 1,
  },
  {
    language: 'PLI',
    patterns: [
      /\bPROCEDURE\s+OPTIONS\s*\(/i,
      /\bDECLARE\b.*\bCHARACTER\b/i,
      /\bDO\s+WHILE\b/i,
      /\bEND\s*;/i,
    ],
    minMatches: 2,
  },
  {
    language: 'HLASM',
    patterns: [
      /^\s+[A-Z]+\s+\d+,\d+/m,       // operands like  MVC  0(5,R1),0(R2)
      /^\s+CSECT\b/im,
      /^\s+DSECT\b/im,
      /^\s+DC\s+[CXBHFZP]'/im,
      /^\s+DS\s+[CXBHFZP]'/im,
    ],
    minMatches: 2,
  },
  {
    language: 'EASYTRIEVE',
    patterns: [
      /^\s+FILE\s+[A-Z]/im,
      /^\s+FIELD\s+[A-Z]/im,
      /^\s+REPORT\b/im,
    ],
    minMatches: 2,
  },
  {
    language: 'REXX',
    patterns: [
      /^\/\*\s*REXX\b/im,
      /\bSAY\s+/i,
      /\bPARSE\s+ARG\b/i,
    ],
    minMatches: 1,
  },
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Classify a single mainframe source artifact.
 *
 * @param filename   Full or relative file path — extension is extracted from this.
 * @param content    Source text (or first 4096 bytes as a string is sufficient).
 */
export function classify(filename: string, content?: string): ClassificationResult {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';

  // 1. Extension match (DETERMINISTIC)
  const extLang = EXTENSION_MAP[ext];
  if (extLang) {
    return { language: extLang, confidence: 'DETERMINISTIC', reason: `extension .${ext}` };
  }

  // 2. Content-signature match (RESOLVED or CANDIDATE)
  if (content) {
    const sample = content.slice(0, 8192); // cap for performance

    for (const sig of CONTENT_SIGNATURES) {
      let matches = 0;
      for (const pat of sig.patterns) if (pat.test(sample)) matches++;
      if (matches >= sig.minMatches) {
        const conf = matches >= sig.patterns.length ? 'RESOLVED' : 'CANDIDATE';
        return {
          language: sig.language,
          confidence: conf,
          reason: `${matches}/${sig.patterns.length} content patterns matched`,
        };
      }
    }
  }

  return { language: 'UNKNOWN', confidence: 'CANDIDATE', reason: 'no extension or content match' };
}

/**
 * Classify a batch of files.  Returns a map from filename to result.
 */
export function classifyAll(
  files: Array<{ filename: string; content?: string }>
): Map<string, ClassificationResult> {
  const results = new Map<string, ClassificationResult>();
  for (const f of files) {
    results.set(f.filename, classify(f.filename, f.content));
  }
  return results;
}

/**
 * True if the file should be treated as a copybook (header/struct definition,
 * not a standalone compilable unit).
 */
export function isCopybook(filename: string, content?: string): boolean {
  const r = classify(filename, content);
  if (r.language === 'COPYBOOK') return true;
  // COBOL file with no PROCEDURE DIVISION is likely a copybook
  if (r.language === 'COBOL' && content && !/\bPROCEDURE\s+DIVISION\b/i.test(content)) return true;
  return false;
}
