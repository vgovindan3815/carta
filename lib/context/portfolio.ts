import { getProgram, getMostRecentBizRules, getMostRecentDepGraph } from '../db/queries';

export interface CalleeSummary {
  name: string;
  language: string;
  loc: number;
  bizRulesSummary: string;
  edges: string[];
  analyzed: boolean;
}

/**
 * Builds a portfolio context string by fetching stored analysis data for each
 * callee program in the focal program's dependency graph.
 *
 * Returns { text, callees } where text is formatted for LLM injection and
 * callees is the structured data for UI display.
 */
export async function buildPortfolioContext(
  _programId: string,
  _repoId: string,
  calleeNames: string[]
): Promise<{ text: string; callees: CalleeSummary[] }> {
  if (!calleeNames.length) return { text: '', callees: [] };

  const callees: CalleeSummary[] = [];

  for (const name of calleeNames.slice(0, 50)) {
    const prog = await getProgram(name);
    if (!prog) {
      callees.push({ name, language: 'COBOL', loc: 0, bizRulesSummary: '', edges: [], analyzed: false });
      continue;
    }

    const [bizRules, depGraph] = await Promise.all([
      getMostRecentBizRules(prog.id),
      getMostRecentDepGraph(prog.id),
    ]);

    if (!bizRules && !depGraph) {
      callees.push({ name, language: prog.language, loc: prog.loc, bizRulesSummary: '', edges: [], analyzed: false });
      continue;
    }

    // Extract first 5 rules from the first section for a richer summary
    const firstSection = bizRules?.sections?.[0];
    const summaryRules = (firstSection?.rules ?? []).slice(0, 5);
    const bizSummary = summaryRules.length
      ? summaryRules.map((r) => r.text.replace(/<[^>]+>/g, '').slice(0, 600)).join(' ')
      : firstSection?.section ?? '';

    // All outbound edges
    const edges = (depGraph?.edges ?? []).map(
      (e) => `${e.from} → ${e.to} (${e.type})`
    );

    callees.push({
      name,
      language: prog.language,
      loc: prog.loc,
      bizRulesSummary: bizSummary,
      edges,
      analyzed: true,
    });
  }

  const analyzedCount = callees.filter((c) => c.analyzed).length;

  if (!analyzedCount) {
    return {
      text: `DEPENDENT MODULE CONTEXT: ${callees.length} callee(s) identified but none have been analyzed yet.\nCallees: ${calleeNames.join(', ')}`,
      callees,
    };
  }

  const lines: string[] = [
    `DEPENDENT MODULE CONTEXT (${analyzedCount} analyzed of ${callees.length} total callee(s)):`,
    '',
  ];

  for (const c of callees) {
    if (c.analyzed) {
      lines.push(`[${c.name} — ${c.language}, ${c.loc.toLocaleString()} LOC]`);
      if (c.bizRulesSummary) lines.push(`Business function: ${c.bizRulesSummary}`);
      if (c.edges.length) lines.push(`Key dependencies: ${c.edges.slice(0, 15).join(', ')}`);
      lines.push('');
    } else {
      lines.push(`[${c.name} — not yet analyzed]`);
      lines.push('');
    }
  }

  return { text: lines.join('\n'), callees };
}
