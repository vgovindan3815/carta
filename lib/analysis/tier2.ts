/**
 * Tier 2 pipeline — application-level modernization analysis (§1, §5.1, §3 Chains 5-8).
 *
 * Chains 5-8 compose from Tier 1 moduleFacts outputs and never touch raw source.
 * This pipeline is always user-initiated — never triggered automatically.
 *
 * Build sequence: capability clustering (5) → impact aggregation (6) → BRD (7) → mod spec (8)
 */

import type { SseLogLine } from '../parser/types';
import { createLLMProvider } from '../llm/index';
import type { LLMConfig } from '../llm/types';
import {
  getAppScope,
  getModuleFactsForPrograms,
  listPrograms,
  getGlossaryForRepo,
  saveAppCapabilityMap,
  saveAppBrd,
  saveAppModSpec,
  saveAppImpact,
  getAppCapabilityMap,
  getAppBrd,
  getMostRecentBizRules,
  getProgramById,
} from '../db/queries';
import type { ModuleFacts, RuleCard, AppCapability, ChangeImpactItem, SpecSection } from '../parser/types';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function info(t: string): SseLogLine { return { lv: 'INFO', t, d: 0 }; }
function done(t: string): SseLogLine { return { lv: 'DONE', t, d: 0 }; }
function warn(t: string): SseLogLine { return { lv: 'WARN', t, d: 0 }; }

/** Hash of concatenated moduleFacts sourceHashes — detects if any member program changed. */
function computeSourceFactsHash(factsRows: Array<{ sourceHash: string }>): string {
  const combined = factsRows.map((f) => f.sourceHash).sort().join('|');
  return createHash('sha256').update(combined).digest('hex').slice(0, 16);
}

function factsToText(programName: string, facts: ModuleFacts): string {
  const rules = facts.businessRules ?? [];
  const p0 = rules.filter((r) => r.priority === 'P0');
  return `[${programName}]
Entry points: ${(facts.entryPoints ?? []).join(', ') || 'none'}
Business rules: ${rules.length} total (${p0.length} P0)
P0 rules: ${p0.map((r) => `${r.id}: ${r.plain_english}`).join('; ') || 'none'}
Data objects: ${(facts.dataObjects ?? []).map((d) => d.name).join(', ') || 'none'}
Observations: ${(facts.observations ?? []).join('; ') || 'none'}`;
}

function capabilityToText(cap: AppCapability): string {
  return `Capability: ${cap.name} (${cap.id})
Programs: ${cap.memberPrograms.join(', ')}
Data domains: ${cap.dataDomains.join(', ')}
P0 rules: ${cap.p0RuleCount}
Description: ${cap.description}`;
}

// ---------------------------------------------------------------------------
// Main Tier 2 pipeline
// ---------------------------------------------------------------------------

export async function runTier2Pipeline(
  scopeId: string,
  onEvent: (line: SseLogLine) => void,
  llmConfig: LLMConfig = { provider: 'groq', apiKey: process.env.GROQ_API_KEY ?? '' }
): Promise<{ capabilityMap: AppCapability[]; brdSections: SpecSection[]; modSpecSections: SpecSection[]; totalTokens: number }> {
  const { generateCapabilityMap, generateAppBrd, generateAppModSpec, providerName, modelName } =
    createLLMProvider(llmConfig);

  onEvent(info(`Tier 2 pipeline starting — provider: <span class="hl">${providerName}</span> · <span class="hl">${modelName}</span>`));

  // 1. Load scope
  const scope = await getAppScope(scopeId);
  if (!scope) throw new Error(`Scope ${scopeId} not found`);
  onEvent(info(`Scope: <span class="hl">${scope.name}</span> · ${(scope.memberProgramIds as string[]).length} programs`));

  const memberIds = scope.memberProgramIds as string[];

  // 2. Load moduleFacts for all member programs
  const factsRows = await getModuleFactsForPrograms(memberIds);
  onEvent(info(`Module facts loaded: <span class="hl">${factsRows.length} of ${memberIds.length}</span> programs have facts`));

  if (factsRows.length === 0) {
    throw new Error('No module facts found for any member program. Run Tier 1 analysis on all programs first.');
  }

  const sourceFactsHash = computeSourceFactsHash(factsRows);

  // 3. Build program name map
  const progRows = await Promise.all(memberIds.map((id) => getProgramById(id)));
  const progNameMap = new Map<string, string>();
  for (const p of progRows) {
    if (p) progNameMap.set(p.id, p.name);
  }

  // 4. Build data-domain clusters (deterministic from shared data objects)
  const copyRefs = new Map<string, string[]>(); // copybook/data → programs that use it
  for (const row of factsRows) {
    const progName = progNameMap.get(row.programId) ?? row.programId;
    const facts = row as unknown as { dataObjects: ModuleFacts['dataObjects'] };
    const dataObjs = (facts.dataObjects ?? []) as ModuleFacts['dataObjects'];
    for (const obj of dataObjs) {
      if (obj.kind === 'copybook') {
        const existing = copyRefs.get(obj.name) ?? [];
        existing.push(progName);
        copyRefs.set(obj.name, existing);
      }
    }
  }

  const dataDomainClusters = Array.from(copyRefs.entries())
    .filter(([, progs]) => progs.length > 1)
    .map(([name, progs]) => `${name}: ${progs.join(', ')}`)
    .join('\n') || 'No shared copybook clusters detected — treating all programs as one cluster.';

  // 5. Load glossary
  const repoId = scope.repoId;
  let glossaryText = '';
  try {
    const glossaryEntries = await getGlossaryForRepo(repoId);
    if (glossaryEntries.length) {
      glossaryText = glossaryEntries.map((e) => `${e.pattern}: ${e.description}`).join('\n');
    }
  } catch { /* non-fatal */ }

  // 6. Build module facts text block for LLM
  const factsTextBlock = factsRows
    .map((row) => {
      const name = progNameMap.get(row.programId) ?? row.programId;
      return factsToText(name, row as unknown as ModuleFacts);
    })
    .join('\n\n');

  let totalTokens = 0;
  let capabilityMap: AppCapability[] = [];

  // -----------------------------------------------------------------------
  // Chain 5 — Capability Clustering
  // -----------------------------------------------------------------------
  onEvent(info('Starting Chain 5 — Capability Clustering…'));
  for await (const event of generateCapabilityMap(dataDomainClusters, factsTextBlock, glossaryText || undefined)) {
    if ('done' in event && event.done) {
      capabilityMap = event.capabilities;
      totalTokens += event.tokensUsed;
    } else {
      onEvent(event as SseLogLine);
    }
  }
  await saveAppCapabilityMap(scopeId, sourceFactsHash, capabilityMap);
  onEvent(done(`Capability map saved — ${capabilityMap.length} capabilities`));

  // -----------------------------------------------------------------------
  // Chain 6 — App-Level Impact (aggregate from member Tier 1 change impacts)
  // -----------------------------------------------------------------------
  onEvent(info('Aggregating cross-capability impact (Chain 6)…'));
  const appImpactItems: ChangeImpactItem[] = [];
  for (const cap of capabilityMap) {
    for (const progName of cap.memberPrograms) {
      const progRow = progRows.find((p) => p?.name === progName);
      if (!progRow) continue;
      // Each capability's members contribute their existing Tier 1 changeImpact
      // A full Chain 6 LLM call would aggregate these — for now we collect them
      appImpactItems.push({
        prog: cap.name,
        rel: `capability — ${cap.memberPrograms.length} programs`,
        severity: cap.p0RuleCount > 0 ? 'critical' : 'high',
        reason: `${cap.description} — ${cap.p0RuleCount} P0 rules require equivalence proof before phase ships.`,
        edge: `${cap.memberPrograms.join(', ')} (capability cluster)`,
      });
      break; // one entry per capability
    }
  }
  await saveAppImpact(scopeId, sourceFactsHash, appImpactItems);
  onEvent(done(`App impact saved — ${appImpactItems.length} capability entries`));

  // -----------------------------------------------------------------------
  // Chain 7 — App-Level BRD
  // -----------------------------------------------------------------------
  onEvent(info('Starting Chain 7 — App BRD…'));

  // Collect all P0 rules across member programs
  const p0RulesAll: Array<RuleCard & { programName: string }> = [];
  for (const row of factsRows) {
    const name = progNameMap.get(row.programId) ?? row.programId;
    const rules = (row as unknown as { businessRules: RuleCard[] }).businessRules ?? [];
    for (const rule of rules) {
      if (rule.priority === 'P0') p0RulesAll.push({ ...rule, programName: name });
    }
  }
  const p0Summary = p0RulesAll
    .map((r) => `[${r.programName}] ${r.id}: ${r.plain_english}${r.confidence !== 'High' ? ' ⚠ UNVERIFIED' : ''}`)
    .join('\n') || 'No P0 rules found across member programs.';

  const capMapText = capabilityMap.map(capabilityToText).join('\n\n');

  let brdSections: SpecSection[] = [];
  for await (const event of generateAppBrd(scope.name, capMapText, p0Summary)) {
    if ('done' in event && event.done) {
      brdSections = event.sections;
      totalTokens += event.tokensUsed;
    } else {
      onEvent(event as SseLogLine);
    }
  }
  await saveAppBrd(scopeId, sourceFactsHash, brdSections);
  onEvent(done(`App BRD saved — ${brdSections.length} sections`));

  // -----------------------------------------------------------------------
  // Chain 8 — App-Level Modernization Spec
  // -----------------------------------------------------------------------
  onEvent(info('Starting Chain 8 — App Modernization Spec (strangler-fig / leaf-first)…'));

  const appImpactText = appImpactItems
    .map((i) => `${i.prog} (${i.severity}): ${i.reason}`)
    .join('\n');
  const brdText = brdSections.map((s) => `${s.num}. ${s.title}: ${s.content.replace(/<[^>]+>/g, ' ').slice(0, 300)}`).join('\n');

  let modSpecSections: SpecSection[] = [];
  for await (const event of generateAppModSpec(
    scope.name,
    capMapText,
    appImpactText,
    brdText,
    undefined,
    scope.crossesClusters ?? false
  )) {
    if ('done' in event && event.done) {
      modSpecSections = event.sections;
      totalTokens += event.tokensUsed;
    } else {
      onEvent(event as SseLogLine);
    }
  }
  await saveAppModSpec(scopeId, sourceFactsHash, modSpecSections);
  onEvent(done(`App modernization spec saved — ${modSpecSections.length} sections`));

  onEvent({ lv: 'DONE', t: `<strong>Tier 2 complete</strong> — ${scope.name} · ${totalTokens.toLocaleString()} tokens`, d: 0 });

  return { capabilityMap, brdSections, modSpecSections, totalTokens };
}
