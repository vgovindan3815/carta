import type {
  SseLogLine,
  ParsedCobolProgram,
  BusinessRulesSection,
  BusinessRule,
  ChangeImpactItem,
  SpecSection,
  GraphNode,
  GraphEdge,
  ModuleFacts,
  RuleCard,
  GraphDiscrepancy,
  AppCapability,
} from '../parser/types';
import type { CallLLM } from './types';
import {
  SYSTEM_PROMPT,
  businessRulesPrompt,
  changeImpactPrompt,
  modSpecPrompt,
  depGraphPrompt,
  moduleFactsPrompt,
  capabilityClusteringPrompt,
  appBrdPrompt,
  appModSpecPrompt,
} from './prompts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function logLine(lv: SseLogLine['lv'], t: string, d = 0): SseLogLine {
  return { lv, t, d };
}

function extractJson<T>(raw: string): T {
  const match = /<output>([\s\S]*?)<\/output>/i.exec(raw);
  const jsonStr = match ? match[1].trim() : raw.trim();
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    const arrMatch = /(\[[\s\S]*\]|\{[\s\S]*\})/.exec(jsonStr);
    if (arrMatch) return JSON.parse(arrMatch[1]) as T;
    throw new Error(`Failed to extract JSON from LLM response. Raw: ${raw.slice(0, 300)}`);
  }
}

/**
 * Citation verification pass (§3.1) — deterministic string-match, no LLM.
 * For each Rule Card, checks that the cited source lines contain at least one
 * parameter literal, a field name from plain_english, or a category keyword.
 */
function verifyCitations(rules: RuleCard[], sourceText: string): RuleCard[] {
  if (!sourceText || !rules.length) return rules;
  const lines = sourceText.split('\n');
  return rules.map((rule) => {
    const start = Math.max(0, (rule.source_line_start ?? 1) - 1);
    const end = Math.min(lines.length, rule.source_line_end ?? start + 10);
    const window = lines.slice(start, end).join('\n').toUpperCase();

    const paramCheck = Object.values(rule.parameters ?? {}).some((v) =>
      window.includes(String(v).toUpperCase())
    );

    const fieldWords = (rule.plain_english ?? '').match(/\b[A-Z][A-Z0-9-]{2,}\b/gi) ?? [];
    const fieldCheck = fieldWords.some((w) => window.includes(w.toUpperCase()));

    const keywordMap: Record<string, string[]> = {
      Calculation: ['COMPUTE', 'ADD', 'SUBTRACT', 'MULTIPLY', 'DIVIDE'],
      Validation: ['IF ', 'EVALUATE', 'WHEN '],
      Lifecycle: ['OPEN ', 'CLOSE ', 'READ ', 'WRITE ', 'DELETE ', 'REWRITE'],
      Policy: ['IF ', 'EVALUATE', 'PERFORM ', 'CALL '],
    };
    const keywords = keywordMap[rule.category] ?? [];
    const keywordCheck = keywords.some((k) => window.includes(k));

    return { ...rule, citationVerified: paramCheck || fieldCheck || keywordCheck };
  });
}

/** Repair HTML content: if a section's content looks like JSON or has no HTML tags, wrap it. */
function repairHtmlContent(sections: SpecSection[]): SpecSection[] {
  return sections.flatMap((s) => {
    const c = s.content ?? '';
    if (/^\s*[\[\{]/.test(c)) {
      try {
        const inner = JSON.parse(c) as SpecSection[];
        if (Array.isArray(inner) && inner[0]?.num) return inner;
      } catch { /* fall through */ }
      s.content = `<p>${c.replace(/[{}\[\]"]/g, ' ').replace(/\s+/g, ' ').slice(0, 2000)}</p>`;
    }
    if (!/<[a-z]/i.test(c) && c.length > 0) s.content = `<p>${c}</p>`;
    return s;
  });
}

function tokenLine(promptTokens: number, completionTokens: number, totalTokens: number): SseLogLine {
  return logLine(
    'INFO',
    `Tokens — prompt: <span class="hl">${promptTokens.toLocaleString()}</span> · completion: <span class="hl">${completionTokens.toLocaleString()}</span> · total: <span class="hl">${totalTokens.toLocaleString()}</span>`,
    0
  );
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createChains(callLLM: CallLLM) {

  // -------------------------------------------------------------------------
  // Chain 0: LLM Dependency Graph
  // -------------------------------------------------------------------------
  async function* generateDepGraph(
    programName: string,
    source: string
  ): AsyncGenerator<
    SseLogLine | { done: true; nodes: GraphNode[]; edges: GraphEdge[]; coveragePct: number; tokensUsed: number }
  > {
    yield logLine('LLM', `No CAST reports — running <span class="hl">LLM dependency analysis</span> on ${programName}…`, 0);
    yield logLine('LLM', 'Extracting CALL, SQL, CICS, and data edges from source…', 200);

    const { text: raw, promptTokens, completionTokens, totalTokens } = await callLLM(
      SYSTEM_PROMPT,
      depGraphPrompt(programName, source),
      3000
    );

    yield logLine('LLM', `Parsing LLM graph response (${raw.length} chars)…`, 50);
    yield tokenLine(promptTokens, completionTokens, totalTokens);

    let nodes: GraphNode[] = [{ id: programName, label: programName, sub: 'in focus', type: 'hero' }];
    let edges: GraphEdge[] = [];
    let coveragePct = 70;

    try {
      const parsed = extractJson<{ nodes: GraphNode[]; edges: GraphEdge[]; coveragePct: number }>(raw);
      if (Array.isArray(parsed.nodes) && parsed.nodes.length > 0) nodes = parsed.nodes;
      if (Array.isArray(parsed.edges)) edges = parsed.edges;
      if (typeof parsed.coveragePct === 'number') coveragePct = parsed.coveragePct;
    } catch (err) {
      yield logLine('WARN', `LLM graph parse failed — using minimal graph: ${String(err)}`, 0);
    }

    yield logLine(
      'DONE',
      `LLM dependency graph — <span class="hl">${nodes.length} nodes · ${edges.length} edges</span> · coverage ~${coveragePct}%`,
      0
    );

    yield { done: true, nodes, edges, coveragePct, tokensUsed: totalTokens };
  }

  // -------------------------------------------------------------------------
  // Chain 1: Business Rules
  // -------------------------------------------------------------------------
  async function* generateBusinessRules(
    program: ParsedCobolProgram,
    copybookContext?: string,
    glossaryContext?: string,
    jclCallers?: string[]
  ): AsyncGenerator<SseLogLine | { done: true; sections: BusinessRulesSection[]; tokensUsed: number }> {
    const contextParts: string[] = [];
    if (copybookContext) contextParts.push(`${copybookContext.split('\n').length - 1} copybook fields`);
    if (glossaryContext) contextParts.push('domain glossary');
    if (jclCallers?.length) contextParts.push(`${jclCallers.length} JCL caller(s)`);
    const ctxNote = contextParts.length ? ` + ${contextParts.join(', ')}` : '';

    yield logLine('LLM', `Sending <span class="hl">${program.name}</span> (${program.loc.toLocaleString()} LOC)${ctxNote} to LLM…`, 0);
    yield logLine('LLM', 'Streaming full business rules from model…', 100);

    let lastLogAt = 0;
    const { text: raw, promptTokens, completionTokens, totalTokens } = await callLLM(
      SYSTEM_PROMPT,
      businessRulesPrompt(program, copybookContext, glossaryContext, jclCallers),
      8192,
      (_chunk, total) => { lastLogAt = total; }
    );
    void lastLogAt;

    yield logLine('LLM', `Received ${raw.length} chars from model. Parsing…`, 50);
    yield tokenLine(promptTokens, completionTokens, totalTokens);

    let sections: BusinessRulesSection[] = [];
    try {
      sections = extractJson<BusinessRulesSection[]>(raw);
      if (!Array.isArray(sections)) throw new Error('Expected array');
      sections = sections.filter((s) => s && typeof s.section === 'string' && Array.isArray(s.rules));
    } catch (err) {
      yield logLine('WARN', `JSON parse failed — returning raw sections: ${String(err)}`, 0);
      sections = [{
        section: 'Extracted Rules',
        rules: [{ text: raw.replace(/<[^>]+>/g, '').slice(0, 500), citations: [] } as BusinessRule],
      }];
    }

    const totalRules = sections.reduce((sum, s) => sum + (s.rules?.length ?? 0), 0);
    yield logLine('DONE', `Business rules complete — <span class="hl">${sections.length} sections</span>, ${totalRules} rules`, 0);
    yield { done: true, sections, tokensUsed: totalTokens };
  }

  // -------------------------------------------------------------------------
  // Chain 2: Change Impact
  // -------------------------------------------------------------------------
  async function* generateChangeImpact(
    program: ParsedCobolProgram,
    allPrograms: string[],
    jclCallers?: string[],
    copybookContext?: string
  ): AsyncGenerator<
    SseLogLine | { done: true; tokensUsed: number; impact: { items: ChangeImpactItem[]; coveragePct: number; coverageNote: string } }
  > {
    const jclNote = jclCallers?.length ? ` · ${jclCallers.length} JCL caller(s)` : '';
    yield logLine('LLM', `Analyzing change impact for <span class="hl">${program.name}</span> across ${allPrograms.length} programs${jclNote}…`, 0);
    yield logLine('LLM', 'Grounding change impact against graph edges (1-hop + transitive)…', 100);

    const { text: raw, promptTokens, completionTokens, totalTokens } = await callLLM(
      SYSTEM_PROMPT,
      changeImpactPrompt(program, allPrograms, jclCallers, copybookContext),
      4000
    );

    yield logLine('LLM', `Parsing change impact response (${raw.length} chars)…`, 50);
    yield tokenLine(promptTokens, completionTokens, totalTokens);

    let result: { items: ChangeImpactItem[]; coveragePct: number; coverageNote: string } = {
      items: [],
      coveragePct: program.graph.coveragePct,
      coverageNote: '',
    };

    try {
      const parsed = extractJson<typeof result>(raw);
      result = {
        items: Array.isArray(parsed.items) ? parsed.items : [],
        coveragePct: typeof parsed.coveragePct === 'number' ? parsed.coveragePct : program.graph.coveragePct,
        coverageNote: parsed.coverageNote ?? '',
      };
    } catch (err) {
      yield logLine('WARN', `Change impact JSON parse failed: ${String(err)}`, 0);
      result.items = program.graph.edges.map((e) => ({
        prog: e.to,
        rel: `${e.type} dependency`,
        severity: e.type === 'call' || e.type === 'cics' ? 'critical' : e.type === 'dyn' ? 'unknown' : 'medium',
        reason: `Direct ${e.type} dependency from ${e.from}`,
        edge: `${e.from} → ${e.to} (${e.type})`,
      }));
      result.coverageNote = 'Impact generated from graph edges (LLM parse failed)';
    }

    yield logLine('DONE', `Change impact complete — <span class="hl">${result.items.length} affected components</span>, coverage ${result.coveragePct}%`, 0);
    yield { done: true, impact: result, tokensUsed: totalTokens };
  }

  // -------------------------------------------------------------------------
  // Chain 3: Modernization Spec
  // -------------------------------------------------------------------------
  async function* generateModSpec(
    program: ParsedCobolProgram,
    businessRules: BusinessRulesSection[],
    portfolioContext?: string,
    copybookContext?: string,
    glossaryContext?: string
  ): AsyncGenerator<SseLogLine | { done: true; sections: SpecSection[]; tokensUsed: number }> {
    const ctxParts: string[] = [];
    if (portfolioContext) ctxParts.push('portfolio context');
    if (copybookContext) ctxParts.push('copybook DTOs');
    if (glossaryContext) ctxParts.push('domain glossary');
    const ctxNote = ctxParts.length ? ` with ${ctxParts.join(' + ')}` : '';

    yield logLine('LLM', `Building cross-portfolio modernization spec for <span class="hl">${program.name}</span>${ctxNote}…`, 0);
    yield logLine('LLM', 'Generating 10-section modernization specification…', 100);

    const { text: raw, promptTokens, completionTokens, totalTokens } = await callLLM(
      SYSTEM_PROMPT,
      modSpecPrompt(program, businessRules, portfolioContext, copybookContext, glossaryContext),
      10000
    );

    yield logLine('LLM', `Parsing specification (${raw.length} chars)…`, 50);
    yield tokenLine(promptTokens, completionTokens, totalTokens);

    let sections: SpecSection[] = [];
    try {
      sections = extractJson<SpecSection[]>(raw);
      if (!Array.isArray(sections)) throw new Error('Expected array');
      sections = sections
        .filter((s) => s && typeof s.num === 'number' && typeof s.title === 'string')
        .map((s) => ({ num: s.num, title: s.title, content: s.content ?? '' }));

      // Content repair: if any section's content looks like JSON or has no HTML tags, fix it
      sections = sections.flatMap((s) => {
        const c = s.content;
        if (/^\s*[\[\{]/.test(c)) {
          try {
            const inner = JSON.parse(c) as SpecSection[];
            if (Array.isArray(inner) && inner[0]?.num) return inner;
          } catch { /* fall through */ }
          s.content = `<p>${c.replace(/[{}\[\]"]/g, ' ').replace(/\s+/g, ' ').slice(0, 2000)}</p>`;
        }
        if (!/<[a-z]/i.test(c) && c.length > 0) s.content = `<p>${c}</p>`;
        return s;
      });
    } catch (err) {
      yield logLine('WARN', `Spec JSON parse failed: ${String(err)}`, 0);
      sections = [{ num: 1, title: 'Modernization Specification', content: `<p>${raw.replace(/<[^>]+>/g, '').slice(0, 2000)}</p>` }];
    }

    yield logLine('DONE', `Modernization spec complete — <span class="hl">${sections.length} sections</span>`, 0);
    yield { done: true, sections, tokensUsed: totalTokens };
  }

  // -------------------------------------------------------------------------
  // Chain 0.5: Module Facts Extraction (v2.2 new Chain 1)
  // Outputs structured ModuleFacts + GraphDiscrepancy[] for the citation
  // verification pass that runs before DB write.
  // -------------------------------------------------------------------------
  async function* generateModuleFacts(
    programName: string,
    source: string,
    staticEdges: string,
    neighborFacts?: string
  ): AsyncGenerator<
    SseLogLine | {
      done: true;
      moduleFacts: ModuleFacts;
      discrepancies: GraphDiscrepancy[];
      tokensUsed: number;
    }
  > {
    yield logLine('LLM', `Running <span class="hl">Chain 1 — Module Facts Extraction</span> for ${programName}…`, 0);
    yield logLine('LLM', 'Extracting Rule Cards, DataObjects, flows, observations…', 100);

    const { text: raw, promptTokens, completionTokens, totalTokens } = await callLLM(
      SYSTEM_PROMPT,
      moduleFactsPrompt(programName, source, staticEdges, neighborFacts),
      8192
    );

    yield logLine('LLM', `Parsing module facts (${raw.length} chars)…`, 50);
    yield tokenLine(promptTokens, completionTokens, totalTokens);

    const emptyFacts: ModuleFacts = {
      entryPoints: [], businessRules: [], decisionPoints: [], dataTransformations: [],
      exceptionPaths: [], dataObjects: [], outOfScopeRefs: [], flows: [], observations: [], injectionFlags: [],
    };
    let moduleFacts: ModuleFacts = emptyFacts;
    let discrepancies: GraphDiscrepancy[] = [];

    try {
      const parsed = extractJson<{ moduleFacts: ModuleFacts; discrepancies: GraphDiscrepancy[] }>(raw);
      if (parsed?.moduleFacts) {
        moduleFacts = { ...emptyFacts, ...parsed.moduleFacts };
      }
      if (Array.isArray(parsed?.discrepancies)) {
        discrepancies = parsed.discrepancies;
      }
    } catch (err) {
      yield logLine('WARN', `Module facts parse failed — using empty facts: ${String(err)}`, 0);
    }

    // Apply citation verification pass (§3.1) — deterministic, no LLM
    moduleFacts.businessRules = verifyCitations(moduleFacts.businessRules, source);

    const p0Count = moduleFacts.businessRules.filter((r) => r.priority === 'P0').length;
    const unverified = moduleFacts.businessRules.filter((r) => r.priority === 'P0' && r.citationVerified === false).length;
    yield logLine(
      'DONE',
      `Module facts complete — <span class="hl">${moduleFacts.businessRules.length} Rule Cards</span> (${p0Count} P0) · ${moduleFacts.dataObjects.length} data objects · ${discrepancies.length} discrepancies${unverified > 0 ? ` · <span style="color:var(--orange)">⚠ ${unverified} P0 unverified</span>` : ''}`,
      0
    );

    yield { done: true, moduleFacts, discrepancies, tokensUsed: totalTokens };
  }

  // -------------------------------------------------------------------------
  // Chain 5: Capability Clustering (Tier 2)
  // -------------------------------------------------------------------------
  async function* generateCapabilityMap(
    dataDomainClusters: string,
    moduleFactsText: string,
    glossary?: string
  ): AsyncGenerator<
    SseLogLine | { done: true; capabilities: AppCapability[]; tokensUsed: number }
  > {
    yield logLine('LLM', 'Running <span class="hl">Chain 5 — Capability Clustering</span>…', 0);

    const { text: raw, promptTokens, completionTokens, totalTokens } = await callLLM(
      SYSTEM_PROMPT,
      capabilityClusteringPrompt(dataDomainClusters, moduleFactsText, glossary),
      4096
    );

    yield tokenLine(promptTokens, completionTokens, totalTokens);

    let capabilities: AppCapability[] = [];
    try {
      const parsed = extractJson<{ capabilities: AppCapability[] }>(raw);
      if (Array.isArray(parsed?.capabilities)) capabilities = parsed.capabilities;
    } catch (err) {
      yield logLine('WARN', `Capability map parse failed: ${String(err)}`, 0);
    }

    yield logLine('DONE', `Capability map — <span class="hl">${capabilities.length} capabilities</span>`, 0);
    yield { done: true, capabilities, tokensUsed: totalTokens };
  }

  // -------------------------------------------------------------------------
  // Chain 7: App-Level BRD (Tier 2)
  // -------------------------------------------------------------------------
  async function* generateAppBrd(
    scopeName: string,
    capabilityMap: string,
    p0Rules: string
  ): AsyncGenerator<
    SseLogLine | { done: true; sections: SpecSection[]; tokensUsed: number }
  > {
    yield logLine('LLM', `Running <span class="hl">Chain 7 — App BRD</span> for ${scopeName}…`, 0);

    const { text: raw, promptTokens, completionTokens, totalTokens } = await callLLM(
      SYSTEM_PROMPT,
      appBrdPrompt(scopeName, capabilityMap, p0Rules),
      8192
    );

    yield tokenLine(promptTokens, completionTokens, totalTokens);

    let sections: SpecSection[] = [];
    try {
      sections = extractJson<SpecSection[]>(raw);
      if (!Array.isArray(sections)) throw new Error('Expected array');
      sections = sections.filter((s) => s?.num && s?.title).map((s) => ({
        num: s.num, title: s.title, content: s.content ?? '',
      }));
      sections = repairHtmlContent(sections);
    } catch (err) {
      yield logLine('WARN', `App BRD parse failed: ${String(err)}`, 0);
    }

    yield logLine('DONE', `App BRD complete — <span class="hl">${sections.length} sections</span>`, 0);
    yield { done: true, sections, tokensUsed: totalTokens };
  }

  // -------------------------------------------------------------------------
  // Chain 8: App-Level Modernization Spec (Tier 2, strangler-fig / leaf-first)
  // -------------------------------------------------------------------------
  async function* generateAppModSpec(
    scopeName: string,
    capabilityMap: string,
    appImpact: string,
    appBrd: string,
    scopeConstraints?: string,
    crossesClusters?: boolean
  ): AsyncGenerator<
    SseLogLine | { done: true; sections: SpecSection[]; tokensUsed: number }
  > {
    yield logLine('LLM', `Running <span class="hl">Chain 8 — App Modernization Spec</span> for ${scopeName}…`, 0);
    yield logLine('LLM', 'Determining method (Uplift/Refactor/Transform/Reimagine) + phased sequence…', 100);

    const { text: raw, promptTokens, completionTokens, totalTokens } = await callLLM(
      SYSTEM_PROMPT,
      appModSpecPrompt(scopeName, capabilityMap, appImpact, appBrd, scopeConstraints, crossesClusters),
      10000
    );

    yield logLine('LLM', `Parsing app spec (${raw.length} chars)…`, 50);
    yield tokenLine(promptTokens, completionTokens, totalTokens);

    let sections: SpecSection[] = [];
    try {
      sections = extractJson<SpecSection[]>(raw);
      if (!Array.isArray(sections)) throw new Error('Expected array');
      sections = sections.filter((s) => s?.num && s?.title).map((s) => ({
        num: s.num, title: s.title, content: s.content ?? '',
      }));
      sections = repairHtmlContent(sections);
    } catch (err) {
      yield logLine('WARN', `App spec parse failed: ${String(err)}`, 0);
      sections = [{ num: 1, title: 'Modernization Specification', content: `<p>${raw.replace(/<[^>]+>/g, '').slice(0, 2000)}</p>` }];
    }

    yield logLine('DONE', `App spec complete — <span class="hl">${sections.length} sections</span>`, 0);
    yield { done: true, sections, tokensUsed: totalTokens };
  }

  return {
    generateDepGraph,
    generateBusinessRules,
    generateChangeImpact,
    generateModSpec,
    generateModuleFacts,
    generateCapabilityMap,
    generateAppBrd,
    generateAppModSpec,
  };
}
