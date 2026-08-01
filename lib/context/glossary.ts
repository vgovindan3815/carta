import { getGlossaryForRepo } from '../db/queries';

/**
 * Given a list of COBOL field names and a repoId, fetches all domain glossary entries
 * whose pattern matches any field name (case-insensitive substring match) and returns
 * a formatted block ready to inject into LLM prompts.
 */
export async function matchGlossary(
  repoId: string,
  fieldNames: string[]
): Promise<string> {
  if (!fieldNames.length) return '';

  const entries = await getGlossaryForRepo(repoId);
  if (!entries.length) return '';

  const upperNames = fieldNames.map((n) => n.toUpperCase());
  const matched = entries.filter((e) =>
    upperNames.some((n) => n.includes(e.pattern.toUpperCase()) || e.pattern.toUpperCase().includes(n))
  );

  if (!matched.length) return '';

  const lines = ['DOMAIN GLOSSARY MATCHES:'];
  for (const e of matched) {
    const examples = e.examples?.length ? ` (e.g. ${e.examples.slice(0, 3).join(', ')})` : '';
    lines.push(`  - ${e.pattern}: ${e.description}${examples}`);
  }
  return lines.join('\n');
}
