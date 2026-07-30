import type { SseLogLine } from '../parser/types';
import { parseCobolFile } from '../parser/cobol';
import {
  generateBusinessRules,
  generateChangeImpact,
  generateModSpec,
} from '../claude';
import {
  saveDepGraph,
  saveBizRules,
  saveChangeImpact,
  saveModSpec,
  updateJob,
  appendJobLog,
} from '../db/queries';

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
  onEvent: (line: SseLogLine) => void
): Promise<void> {
  // Mark job as running
  await updateJob(jobId, {
    status: 'running',
    startedAt: new Date(),
    phase: 'parsing',
    progressPct: 0,
  });

  try {
    // -----------------------------------------------------------------------
    // Phase 1 — Deterministic Analysis
    // -----------------------------------------------------------------------

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

    await emit(jobId, done('Phase 1 complete — dependency graph saved'), onEvent);

    await updateJob(jobId, {
      phase: 'llm',
      progressPct: 20,
    });

    // -----------------------------------------------------------------------
    // Phase 2 — LLM Documentation (3 sequential chains)
    // -----------------------------------------------------------------------

    // --- Chain 1: Business Rules ---

    await emit(
      jobId,
      { lv: 'LLM', t: 'Starting Chain 1 — Business Rules…', d: 0 },
      onEvent
    );

    let businessRulesSections: Parameters<typeof saveBizRules>[2] = [];

    for await (const event of generateBusinessRules(parsed)) {
      if ('done' in event && event.done) {
        businessRulesSections = event.sections;
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

    for await (const event of generateChangeImpact(parsed, allProgramNames)) {
      if ('done' in event && event.done) {
        changeImpactResult = event.impact;
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
      { lv: 'LLM', t: 'Starting Chain 3 — Modernization Spec…', d: 0 },
      onEvent
    );

    let specSections: Parameters<typeof saveModSpec>[2] = [];

    for await (const event of generateModSpec(parsed, businessRulesSections)) {
      if ('done' in event && event.done) {
        specSections = event.sections;
      } else {
        await emit(jobId, event as SseLogLine, onEvent);
      }
    }

    await saveModSpec(programId, jobId, specSections);

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
    });

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
