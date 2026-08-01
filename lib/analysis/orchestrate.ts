import type { SseLogLine, ParsedCobolProgram, GraphNode, GraphEdge } from '../parser/types';
import { parseCobolFile } from '../parser/cobol';
import { createLLMProvider } from '../llm/index';
import { layoutCircular } from '../llm/layout';
import type { LLMConfig } from '../llm/types';
import {
  saveDepGraph,
  saveBizRules,
  saveChangeImpact,
  saveModSpec,
  updateJob,
  appendJobLog,
  getProgramById,
  getRepo,
  getCopybooksByNames,
  getJclCallers,
  updateProgramDesc,
} from '../db/queries';
import { buildPortfolioContext } from '../context/portfolio';
import { matchGlossary } from '../context/glossary';
import { formatCopybookContext } from '../parser/copybook';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../db/schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function info(t: string, d = 0): SseLogLine {
  return { lv: 'INFO', t, d };
}

function done(t: string): SseLogLine {
  return { lv: 'DONE', t, d: 0 };
}

function warn(t: string): SseLogLine {
  return { lv: 'WARN', t, d: 0 };
}

/** Persist a log line to the DB and forward it to the SSE callback. */
async function emit(
  jobId: string,
  line: SseLogLine,
  onEvent: (line: SseLogLine) => void
): Promise<void> {
  onEvent(line);
  try {
    await appendJobLog(jobId, { lv: line.lv, t: line.t, ts: Date.now() });
  } catch {
    // Non-fatal — log persistence failure should not break the pipeline
  }
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

/**
 * End-to-end analysis pipeline:
 *   Phase 1 — Deterministic COBOL parsing (graph extraction)
 *   Phase 2 — LLM documentation (3 sequential chains)
 *
 * All progress is forwarded to `onEvent` as SSE log lines and persisted to
 * the analysis_jobs.log column in Neon.
 */
export async function runAnalysisPipeline(
  jobId: string,
  programId: string,
  programName: string,
  source: string,
  filename: string,
  allProgramNames: string[],
  onEvent: (line: SseLogLine) => void,
  llmConfig: LLMConfig = { provider: 'groq', apiKey: process.env.GROQ_API_KEY ?? '' }
): Promise<void> {
  const { generateDepGraph, generateBusinessRules, generateChangeImpact, generateModSpec, providerName, modelName } =
    createLLMProvider(llmConfig);
  // Mark job as running
  await updateJob(jobId, {
    status: 'running',
    startedAt: new Date(),
    phase: 'parsing',
    progressPct: 0,
  });

  let totalTokensUsed = 0;

  try {
    // -----------------------------------------------------------------------
    // Phase 1 — Deterministic Analysis
    // -----------------------------------------------------------------------

    await emit(jobId, info(`LLM provider: <span class="hl">${providerName}</span> · Model: <span class="hl">${modelName}</span>`), onEvent);
    await emit(jobId, info(`Starting deterministic analysis of <span class="hl">${programName}</span>…`), onEvent);

    const parsed = parseCobolFile(filename, source);

    await emit(jobId, info(`Detected language: <span class="hl">${parsed.language}</span> · LOC: <span class="hl">${parsed.loc.toLocaleString()}</span>`), onEvent);

    const callEdges = parsed.graph.edges.filter(
      (e) => e.type === 'call' || e.type === 'dyn'
    );
    const sqlEdges = parsed.graph.edges.filter((e) => e.type === 'data');
    const cicsEdges = parsed.graph.edges.filter((e) => e.type === 'cics');
    const dynEdges = parsed.graph.edges.filter((e) => e.type === 'dyn');

    // Emit per-edge log lines (CALL, SQL, DATA, CICS)
    for (const edge of callEdges) {
      const lv: SseLogLine['lv'] = edge.type === 'dyn' ? 'WARN' : 'CALL';
      const confidence =
        edge.confidence !== undefined && edge.confidence < 100
          ? ` <span class="dim">(dyn, ${edge.confidence}% confidence)</span>`
          : '';
      await emit(
        jobId,
        { lv, t: `CALL <span class="hl">${edge.to}</span>${confidence}`, d: 0 },
        onEvent
      );
    }

    for (const edge of sqlEdges) {
      await emit(
        jobId,
        {
          lv: 'SQL',
          t: `DATA → <span class="hl">${edge.to}</span>${edge.label ? ` <span class="dim">(${edge.label})</span>` : ''}`,
          d: 0,
        },
        onEvent
      );
    }

    for (const edge of cicsEdges) {
      await emit(
        jobId,
        {
          lv: 'DATA',
          t: `CICS → <span class="hl">${edge.to}</span>${edge.label ? ` <span class="dim">(${edge.label})</span>` : ''}`,
          d: 0,
        },
        onEvent
      );
    }

    if (dynEdges.length > 0) {
      await emit(
        jobId,
        warn(
          `${dynEdges.length} dynamic CALL(s) detected — targets unresolvable at parse time`
        ),
        onEvent
      );
    }

    await emit(
      jobId,
      info(
        `Graph: <span class="hl">${parsed.graph.nodes.length} nodes</span>, ${parsed.graph.edges.length} edges · Coverage: <span class="hl">${parsed.graph.coveragePct}%</span>`
      ),
      onEvent
    );

    // Save dependency graph
    const cLayoutNodes = parsed.graph.nodes.filter(
      (n) => n.cx !== undefined && n.cy !== undefined
    );

    await saveDepGraph(programId, jobId, {
      nodes: parsed.graph.nodes,
      edges: parsed.graph.edges,
      coveragePct: parsed.graph.coveragePct,
      cLayoutNodes: cLayoutNodes.length > 0 ? cLayoutNodes : undefined,
    });

    await emit(jobId, done('Phase 1 complete — deterministic graph saved'), onEvent);

    // -----------------------------------------------------------------------
    // Phase 1.5 — LLM Dependency Graph (CAST not available)
    // -----------------------------------------------------------------------

    await emit(
      jobId,
      { lv: 'INFO', t: 'Running LLM dependency enrichment (no static CAST graph available)…', d: 0 },
      onEvent
    );

    let llmNodes = parsed.graph.nodes;
    let llmEdges = parsed.graph.edges;
    let llmCoverage = parsed.graph.coveragePct;

    for await (const event of generateDepGraph(programName, source)) {
      if ('done' in event && event.done) {
        llmNodes = event.nodes;
        llmEdges = event.edges;
        llmCoverage = event.coveragePct;
        totalTokensUsed += event.tokensUsed;
      } else {
        await emit(jobId, event as SseLogLine, onEvent);
      }
    }

    // Build circular layout from LLM nodes and save
    const llmLayout = layoutCircular(llmNodes, llmEdges);

    await saveDepGraph(programId, jobId, {
      nodes: llmNodes,
      edges: llmEdges,
      coveragePct: llmCoverage,
      cLayoutNodes: llmLayout.nodes,
    });

    await emit(
      jobId,
      { lv: 'DONE', t: 'LLM dependency graph saved — graph source: <span class="hl">LLM (no CAST)</span>', d: 0 },
      onEvent
    );

    await updateJob(jobId, {
      phase: 'llm',
      progressPct: 20,
    });

    // -----------------------------------------------------------------------
    // Phase 2 — Context Assembly
    // -----------------------------------------------------------------------

    // Load repo for context queries
    const progRecord = await getProgramById(programId);
    const repoRecord = progRecord?.repoId ? await getRepo(progRecord.repoId) : undefined;
    const repoId = repoRecord?.id ?? '';

    // Copybook context — names from COPY edges
    const copyNames = parsed.graph.edges
      .filter((e) => e.type === 'copy')
      .map((e) => e.to);
    let copybookCtx = '';
    if (copyNames.length && repoId) {
      try {
        const cbDefs = await getCopybooksByNames(repoId, copyNames);
        copybookCtx = formatCopybookContext(cbDefs);
        await emit(jobId, info(`Loaded <span class="hl">${cbDefs.length}</span> copybook(s) for context injection`), onEvent);
      } catch { /* non-fatal */ }
    }

    // Domain glossary — match against program name, copybook names, and all graph node IDs
    let glossaryCtx = '';
    if (repoId) {
      try {
        const graphNodeIds = parsed.graph.nodes.map((n) => n.id);
        const fieldNames = [parsed.name, ...copyNames, ...graphNodeIds];
        glossaryCtx = await matchGlossary(repoId, fieldNames);
        if (glossaryCtx) await emit(jobId, info('Domain glossary matches found — injecting into prompt'), onEvent);
      } catch { /* non-fatal */ }
    }

    // JCL callers
    let jclCallers: string[] = [];
    if (repoId) {
      try {
        jclCallers = await getJclCallers(parsed.name, repoId);
        if (jclCallers.length) await emit(jobId, info(`JCL callers: <span class="hl">${jclCallers.join(', ')}</span>`), onEvent);
      } catch { /* non-fatal */ }
    }

    // Portfolio context — analyzed callees
    let portfolioCtx = '';
    if (repoId) {
      try {
        const calleeNames = parsed.graph.edges
          .filter((e) => e.type === 'call' || e.type === 'dyn' || e.type === 'proc')
          .map((e) => e.to);
        const { text, callees } = await buildPortfolioContext(programId, repoId, calleeNames);
        portfolioCtx = text;
        const analyzedCount = callees.filter((c) => c.analyzed).length;
        await emit(jobId, info(`Portfolio context: <span class="hl">${analyzedCount} of ${callees.length}</span> callee(s) analyzed`), onEvent);
      } catch { /* non-fatal */ }
    }

    // -----------------------------------------------------------------------
    // Phase 3 — LLM Documentation (3 sequential chains)
    // -----------------------------------------------------------------------

    // --- Chain 1: Business Rules ---

    await emit(
      jobId,
      { lv: 'LLM', t: 'Starting Chain 1 — Business Rules…', d: 0 },
      onEvent
    );

    let businessRulesSections: Parameters<typeof saveBizRules>[2] = [];

    for await (const event of generateBusinessRules(parsed, copybookCtx || undefined, glossaryCtx || undefined, jclCallers.length ? jclCallers : undefined)) {
      if ('done' in event && event.done) {
        businessRulesSections = event.sections;
        totalTokensUsed += event.tokensUsed;
      } else {
        await emit(jobId, event as SseLogLine, onEvent);
      }
    }

    await saveBizRules(programId, jobId, businessRulesSections);

    await emit(
      jobId,
      done(`Business rules saved — ${businessRulesSections.length} sections`),
      onEvent
    );

    await updateJob(jobId, { progressPct: 50 });

    // --- Chain 2: Change Impact ---

    await emit(
      jobId,
      { lv: 'LLM', t: 'Starting Chain 2 — Change Impact…', d: 0 },
      onEvent
    );

    let changeImpactResult: {
      items: Parameters<typeof saveChangeImpact>[2]['items'];
      coveragePct: number;
      coverageNote: string;
    } = { items: [], coveragePct: parsed.graph.coveragePct, coverageNote: '' };

    for await (const event of generateChangeImpact(parsed, allProgramNames, jclCallers.length ? jclCallers : undefined, copybookCtx || undefined)) {
      if ('done' in event && event.done) {
        changeImpactResult = event.impact;
        totalTokensUsed += event.tokensUsed;
      } else {
        await emit(jobId, event as SseLogLine, onEvent);
      }
    }

    await saveChangeImpact(programId, jobId, changeImpactResult);

    await emit(
      jobId,
      done(`Change impact saved — ${changeImpactResult.items.length} items`),
      onEvent
    );

    await updateJob(jobId, { progressPct: 75 });

    // --- Chain 3: Modernization Spec ---

    await emit(
      jobId,
      { lv: 'LLM', t: 'Starting Chain 3 — Modernization Spec (10 sections)…', d: 0 },
      onEvent
    );

    let specSections: Parameters<typeof saveModSpec>[2] = [];

    for await (const event of generateModSpec(parsed, businessRulesSections, portfolioCtx || undefined, copybookCtx || undefined, glossaryCtx || undefined)) {
      if ('done' in event && event.done) {
        specSections = event.sections;
        totalTokensUsed += event.tokensUsed;
      } else {
        await emit(jobId, event as SseLogLine, onEvent);
      }
    }

    await saveModSpec(programId, jobId, specSections);

    // Extract a plain-text description from the Executive Summary (section 1)
    const sec1 = specSections.find((s) => s.num === 1) ?? specSections[0];
    if (sec1?.content) {
      const plain = sec1.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const shortDesc = plain.slice(0, 220).replace(/\s\S*$/, '').trim() + (plain.length > 220 ? '…' : '');
      if (shortDesc.length > 20) {
        await updateProgramDesc(programId, shortDesc).catch(() => {});
      }
    }

    await emit(
      jobId,
      done(`Modernization spec saved — ${specSections.length} sections`),
      onEvent
    );

    // -----------------------------------------------------------------------
    // Finalize
    // -----------------------------------------------------------------------

    await updateJob(jobId, {
      status: 'completed',
      phase: 'done',
      progressPct: 100,
      completedAt: new Date(),
      tokensUsed: totalTokensUsed,
    });

    await emit(
      jobId,
      {
        lv: 'INFO',
        t: `Total Groq tokens consumed: <span class="hl">${totalTokensUsed.toLocaleString()}</span> / 100,000 daily limit`,
        d: 0,
      },
      onEvent
    );

    await emit(
      jobId,
      {
        lv: 'DONE',
        t: `<strong>Analysis complete</strong> — ${programName} fully documented`,
        d: 0,
      },
      onEvent
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : String(err);

    await emit(
      jobId,
      warn(`Pipeline error: ${message}`),
      onEvent
    );

    await updateJob(jobId, {
      status: 'failed',
      phase: 'error',
      error: message,
      completedAt: new Date(),
    });

    throw err;
  }
}

// ---------------------------------------------------------------------------
// CAST pipeline — runs LLM doc chains on an already-imported dep graph.
// Used when the program came from a CAST report (no GitHub source available).
// ---------------------------------------------------------------------------

export async function runCastLLMPipeline(
  jobId: string,
  programId: string,
  programName: string,
  allProgramNames: string[],
  onEvent: (line: SseLogLine) => void,
  llmConfig: LLMConfig = { provider: 'groq', apiKey: process.env.GROQ_API_KEY ?? '' }
): Promise<void> {
  const { generateBusinessRules, generateChangeImpact, generateModSpec, providerName, modelName } =
    createLLMProvider(llmConfig);

  await updateJob(jobId, { status: 'running', startedAt: new Date(), phase: 'llm', progressPct: 0 });

  let totalTokensUsed = 0;

  try {
    await emit(jobId, info(`LLM provider: <span class="hl">${providerName}</span> · Model: <span class="hl">${modelName}</span>`), onEvent);
    await emit(jobId, info(`CAST import detected — using deterministic dep graph, running LLM documentation chains…`), onEvent);

    // Load the most recent dep graph for this program from the DB
    const db = drizzle(neon(process.env.DATABASE_URL!), { schema });
    const [depGraphRow] = await db
      .select()
      .from(schema.depGraphs)
      .where(eq(schema.depGraphs.programId, programId))
      .orderBy(desc(schema.depGraphs.createdAt))
      .limit(1);

    if (!depGraphRow) throw new Error('No dep graph found for CAST program — re-upload the CAST report first.');

    const prog = await getProgramById(programId);

    // Reconstruct a ParsedCobolProgram shell from DB data (no source needed for doc chains)
    const nodes = depGraphRow.nodes as (typeof schema.depGraphs.$inferSelect)['nodes'];
    const edges = depGraphRow.edges as (typeof schema.depGraphs.$inferSelect)['edges'];

    const castParsed: ParsedCobolProgram = {
      name: programName,
      language: (prog?.language as 'COBOL' | 'HLASM') ?? 'COBOL',
      loc: prog?.loc ?? 0,
      source: `* CAST-imported program — source not available\n* Program: ${programName}\n* LOC: ${prog?.loc ?? 0}`,
      graph: {
        nodes: nodes as ParsedCobolProgram['graph']['nodes'],
        edges: edges as ParsedCobolProgram['graph']['edges'],
        coveragePct: depGraphRow.coveragePct ?? 100,
      },
    };

    const callEdges = castParsed.graph.edges.filter((e) => e.type === 'call' || e.type === 'dyn');
    await emit(jobId, info(`Graph loaded — <span class="hl">${nodes.length} nodes</span>, ${edges.length} edges · Coverage: <span class="hl">${Math.round(depGraphRow.coveragePct ?? 100)}%</span>`), onEvent);
    for (const e of callEdges) {
      await emit(jobId, { lv: 'CALL', t: `CALL <span class="hl">${e.to}</span>`, d: 0 }, onEvent);
    }

    // --- Context assembly ---
    const repoId = prog?.repoId ?? '';
    const copyNames = castParsed.graph.edges.filter((e) => e.type === 'copy').map((e) => e.to);
    let copybookCtx = '';
    if (copyNames.length && repoId) {
      try {
        const cbDefs = await getCopybooksByNames(repoId, copyNames);
        copybookCtx = formatCopybookContext(cbDefs);
        if (copybookCtx) await emit(jobId, info(`Copybooks loaded: <span class="hl">${cbDefs.length}</span>`), onEvent);
      } catch { /* non-fatal */ }
    }
    let glossaryCtx = '';
    if (repoId) {
      try {
        const castGraphNodeIds = castParsed.graph.nodes.map((n) => n.id);
        glossaryCtx = await matchGlossary(repoId, [programName, ...copyNames, ...castGraphNodeIds]);
      } catch { /* non-fatal */ }
    }
    let jclCallers: string[] = [];
    if (repoId) {
      try {
        jclCallers = await getJclCallers(programName, repoId);
        if (jclCallers.length) await emit(jobId, info(`JCL callers: <span class="hl">${jclCallers.join(', ')}</span>`), onEvent);
      } catch { /* non-fatal */ }
    }
    let portfolioCtx = '';
    if (repoId) {
      try {
        const calleeNames = castParsed.graph.edges
          .filter((e) => e.type === 'call' || e.type === 'dyn').map((e) => e.to);
        const { text, callees } = await buildPortfolioContext(programId, repoId, calleeNames);
        portfolioCtx = text;
        const ac = callees.filter((c) => c.analyzed).length;
        await emit(jobId, info(`Portfolio context: <span class="hl">${ac} of ${callees.length}</span> callee(s) analyzed`), onEvent);
      } catch { /* non-fatal */ }
    }

    // --- Chain 1: Business Rules ---
    await emit(jobId, { lv: 'LLM', t: 'Starting Chain 1 — Business Rules…', d: 0 }, onEvent);
    let businessRulesSections: Parameters<typeof saveBizRules>[2] = [];
    for await (const event of generateBusinessRules(castParsed, copybookCtx || undefined, glossaryCtx || undefined, jclCallers.length ? jclCallers : undefined)) {
      if ('done' in event && event.done) {
        businessRulesSections = event.sections;
        totalTokensUsed += event.tokensUsed;
      } else {
        await emit(jobId, event as SseLogLine, onEvent);
      }
    }
    await saveBizRules(programId, jobId, businessRulesSections);
    await emit(jobId, done(`Business rules saved — ${businessRulesSections.length} sections`), onEvent);
    await updateJob(jobId, { progressPct: 40 });

    // --- Chain 2: Change Impact ---
    await emit(jobId, { lv: 'LLM', t: 'Starting Chain 2 — Change Impact…', d: 0 }, onEvent);
    let changeImpactResult: { items: Parameters<typeof saveChangeImpact>[2]['items']; coveragePct: number; coverageNote: string } =
      { items: [], coveragePct: castParsed.graph.coveragePct, coverageNote: '' };
    for await (const event of generateChangeImpact(castParsed, allProgramNames, jclCallers.length ? jclCallers : undefined, copybookCtx || undefined)) {
      if ('done' in event && event.done) {
        changeImpactResult = event.impact;
        totalTokensUsed += event.tokensUsed;
      } else {
        await emit(jobId, event as SseLogLine, onEvent);
      }
    }
    await saveChangeImpact(programId, jobId, changeImpactResult);
    await emit(jobId, done(`Change impact saved — ${changeImpactResult.items.length} items`), onEvent);
    await updateJob(jobId, { progressPct: 70 });

    // --- Chain 3: Modernization Spec ---
    await emit(jobId, { lv: 'LLM', t: 'Starting Chain 3 — Modernization Spec (10 sections)…', d: 0 }, onEvent);
    let specSections: Parameters<typeof saveModSpec>[2] = [];
    for await (const event of generateModSpec(castParsed, businessRulesSections, portfolioCtx || undefined, copybookCtx || undefined, glossaryCtx || undefined)) {
      if ('done' in event && event.done) {
        specSections = event.sections;
        totalTokensUsed += event.tokensUsed;
      } else {
        await emit(jobId, event as SseLogLine, onEvent);
      }
    }
    await saveModSpec(programId, jobId, specSections);
    const sec1b = specSections.find((s) => s.num === 1) ?? specSections[0];
    if (sec1b?.content) {
      const plain = sec1b.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const shortDesc = plain.slice(0, 220).replace(/\s\S*$/, '').trim() + (plain.length > 220 ? '…' : '');
      if (shortDesc.length > 20) await updateProgramDesc(programId, shortDesc).catch(() => {});
    }
    await emit(jobId, done(`Modernization spec saved — ${specSections.length} sections`), onEvent);

    await updateJob(jobId, {
      status: 'completed',
      phase: 'done',
      progressPct: 100,
      completedAt: new Date(),
      tokensUsed: totalTokensUsed,
    });

    await emit(jobId, { lv: 'INFO', t: `Total tokens consumed: <span class="hl">${totalTokensUsed.toLocaleString()}</span>`, d: 0 }, onEvent);
    await emit(jobId, { lv: 'DONE', t: `<strong>Analysis complete</strong> — ${programName} fully documented`, d: 0 }, onEvent);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await emit(jobId, warn(`Pipeline error: ${message}`), onEvent);
    await updateJob(jobId, { status: 'failed', phase: 'error', error: message, completedAt: new Date() });
    throw err;
  }
}
