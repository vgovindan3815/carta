const FACT_KEY_PATTERN = /\{\{FACT:([^}]+)\}\}/g;

export interface CitationCheckResult {
  valid: string[];
  stripped: string[];
  cleanedContent: string;
}

export function verifyCitations(
  content: string,
  knownFactKeys: Set<string>
): CitationCheckResult {
  const valid: string[] = [];
  const stripped: string[] = [];

  const cleanedContent = content.replace(FACT_KEY_PATTERN, (match, key) => {
    if (knownFactKeys.has(key)) {
      valid.push(key);
      return match;
    } else {
      stripped.push(key);
      return '[unverified citation removed]';
    }
  });

  return { valid, stripped, cleanedContent };
}

export function buildFactKeySet(manifestData: Record<string, unknown>): Set<string> {
  const keys = new Set<string>();
  function walk(obj: unknown, prefix: string) {
    if (typeof obj === 'object' && obj !== null) {
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        const path = prefix ? `${prefix}:${k}` : k;
        keys.add(path);
        walk(v, path);
      }
    }
  }
  walk(manifestData, '');
  return keys;
}
