import type { CopybookDefinition } from '../parser/types';
import { formatCopybookContext } from '../parser/copybook';
import { getCopybooksByNames } from '../db/queries';

/**
 * Given a list of copybook names (from COPY edges in a dep graph) and a repoId,
 * fetches their stored field definitions and returns a formatted context string
 * ready to inject into LLM prompts.
 */
export async function buildCopybookContext(
  repoId: string,
  copybookNames: string[]
): Promise<string> {
  if (!copybookNames.length) return '';
  const defs = await getCopybooksByNames(repoId, copybookNames);
  return formatCopybookContext(defs);
}

export { formatCopybookContext };
export type { CopybookDefinition };
