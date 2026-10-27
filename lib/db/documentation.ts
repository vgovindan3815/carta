import { eq, desc, and, inArray, count, sql } from 'drizzle-orm';
import { getDb } from './client';
import * as schema from './schema';
import type {
  ProgramData,
  CircularLayout,
  MetaChip,
  ChangeImpact,
  ModernizationSpec,
  ModuleFacts,
} from '../parser/types';

export async function createJob(
  programId: string
): Promise<typeof schema.analysisJobs.$inferSelect> {
  const db = getDb();
  const [row] = await db
    .insert(schema.analysisJobs)
    .values({ programId, status: 'pending', phase: null, progressPct: 0, log: [], startedAt: null, completedAt: null, error: null })
    .returning();
  return row;
}

export async function updateJob(
  id: string,
  data: Partial<typeof schema.analysisJobs.$inferInsert>
): Promise<void> {
  const db = getDb();
  await db.update(schema.analysisJobs).set(data).where(eq(schema.analysisJobs.id, id));
}

export async function getJob(id: string): Promise<typeof schema.analysisJobs.$inferSelect | undefined> {
  const db = getDb();
  const [row] = await db.select().from(schema.analysisJobs).where(eq(schema.analysisJobs.id, id)).limit(1);
  return row;
}

export async function appendJobLog(
  id: string,
  line: { lv: string; t: string; ts: number }
): Promise<void> {
  const db = getDb();
  // Cap at 500 entries: keep last 499 + new entry to prevent runaway JSONB growth
  await db
    .update(schema.analysisJobs)
    .set({
      log: sql`(
        SELECT jsonb_agg(e)
        FROM (
          SELECT e FROM jsonb_array_elements(
            COALESCE(${schema.analysisJobs.log}, '[]'::jsonb) || ${JSON.stringify([line])}::jsonb
          ) AS e
          ORDER BY (e->>'ts')::bigint
          LIMIT 500
          OFFSET GREATEST(0,
            jsonb_array_length(COALESCE(${schema.analysisJobs.log}, '[]'::jsonb)) + 1 - 500
          )
        ) sub
      )`,
    })
    .where(eq(schema.analysisJobs.id, id));
}

export async function saveBizRules(
  programId: string,
  jobId: string,
  sections: (typeof schema.bizRules.$inferInsert)['sections']
): Promise<void> {
  const db = getDb();
  await db.insert(schema.bizRules).values({ programId, jobId, sections });
}

export async function saveChangeImpact(
  programId: string,
  jobId: string,
  data: { items: (typeof schema.changeImpacts.$inferInsert)['items']; coveragePct: number; coverageNote: string }
): Promise<void> {
  const db = getDb();
  await db.insert(schema.changeImpacts).values({ programId, jobId, ...data });
}

export async function saveModSpec(
  programId: string,
  jobId: string,
  sections: (typeof schema.modSpecs.$inferInsert)['sections']
): Promise<void> {
  const db = getDb();
  await db.insert(schema.modSpecs).values({ programId, jobId, sections });
}

export async function getMostRecentBizRules(
  programId: string
): Promise<typeof schema.bizRules.$inferSelect | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.bizRules)
    .where(eq(schema.bizRules.programId, programId))
    .orderBy(desc(schema.bizRules.createdAt))
    .limit(1);
  return row;
}

export async function countCompletedJobs(programId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ c: count() })
    .from(schema.analysisJobs)
    .where(and(eq(schema.analysisJobs.programId, programId), eq(schema.analysisJobs.status, 'completed')));
  return Number(row?.c ?? 0);
}

export async function saveModuleFacts(
  programId: string,
  jobId: string,
  sourceHash: string,
  facts: ModuleFacts
): Promise<void> {
  const db = getDb();
  await db.insert(schema.moduleFacts).values({
    programId, jobId, sourceHash,
    entryPoints: facts.entryPoints,
    businessRules: facts.businessRules,
    decisionPoints: facts.decisionPoints,
    dataTransformations: facts.dataTransformations,
    exceptionPaths: facts.exceptionPaths,
    dataObjects: facts.dataObjects,
    outOfScopeRefs: facts.outOfScopeRefs,
    flows: facts.flows,
    observations: facts.observations,
    injectionFlags: facts.injectionFlags,
  });
}

export async function getModuleFacts(
  programId: string
): Promise<typeof schema.moduleFacts.$inferSelect | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.moduleFacts)
    .where(eq(schema.moduleFacts.programId, programId))
    .orderBy(desc(schema.moduleFacts.extractedAt))
    .limit(1);
  return row;
}

export async function getModuleFactsForPrograms(
  programIds: string[]
): Promise<(typeof schema.moduleFacts.$inferSelect)[]> {
  if (!programIds.length) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.moduleFacts)
    .where(inArray(schema.moduleFacts.programId, programIds))
    .orderBy(desc(schema.moduleFacts.extractedAt));
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (seen.has(r.programId)) return false;
    seen.add(r.programId);
    return true;
  });
}

export async function getProgramFullData(name: string): Promise<(ProgramData & { castOnly: boolean }) | null> {
  const db = getDb();

  const [prog] = await db
    .select()
    .from(schema.programs)
    .where(eq(schema.programs.name, name))
    .orderBy(sql`CASE WHEN ${schema.programs.language} IN ('COBOL','JCL','PLI','PROC','COPYBOOK') THEN 0 ELSE 1 END`)
    .limit(1);

  if (!prog) return null;

  const [mainJob] = await db
    .select()
    .from(schema.analysisJobs)
    .where(and(eq(schema.analysisJobs.programId, prog.id), eq(schema.analysisJobs.status, 'completed')))
    .orderBy(desc(schema.analysisJobs.completedAt))
    .limit(1);

  const [depGraph] = await db
    .select()
    .from(schema.depGraphs)
    .where(eq(schema.depGraphs.programId, prog.id))
    .orderBy(desc(schema.depGraphs.createdAt))
    .limit(1);

  const [bizRule] = await db
    .select()
    .from(schema.bizRules)
    .where(eq(schema.bizRules.programId, prog.id))
    .orderBy(desc(schema.bizRules.createdAt))
    .limit(1);

  const [changeImpact] = await db
    .select()
    .from(schema.changeImpacts)
    .where(eq(schema.changeImpacts.programId, prog.id))
    .orderBy(desc(schema.changeImpacts.createdAt))
    .limit(1);

  const [modSpec] = await db
    .select()
    .from(schema.modSpecs)
    .where(eq(schema.modSpecs.programId, prog.id))
    .orderBy(desc(schema.modSpecs.createdAt))
    .limit(1);

  if (!depGraph) return null;

  const [depGraphJob] = await db
    .select()
    .from(schema.analysisJobs)
    .where(eq(schema.analysisJobs.id, depGraph.jobId))
    .limit(1);

  const docsJobId = (bizRule ?? changeImpact)?.jobId ?? mainJob?.id;
  const [docsJob] = docsJobId
    ? await db.select().from(schema.analysisJobs).where(eq(schema.analysisJobs.id, docsJobId)).limit(1)
    : [];

  const [repo] = await db
    .select({ githubUrl: schema.repos.githubUrl })
    .from(schema.repos)
    .where(eq(schema.repos.id, prog.repoId))
    .limit(1);

  const repoUrl = repo?.githubUrl ?? '';
  const isCastRepo   = repoUrl.startsWith('cast://');
  const isUploadRepo = repoUrl.startsWith('upload://');
  const isGitHubRepo = !isCastRepo && !isUploadRepo;

  const hasCastDepGraph = isCastRepo || depGraphJob?.tokensUsed === 0;
  const hasFullLLM = !!(bizRule && changeImpact);

  // Detect mavenkg-engine v2 upload: at least one edge carries a confidenceLevel field
  const rawEdges = (depGraph.edges ?? []) as Array<{ confidenceLevel?: string }>;
  const isEngineGraph = rawEdges.some((e) => e.confidenceLevel != null);

  const graphSource: 'engine' | 'cast' | 'parser' | 'llm' =
    isEngineGraph ? 'engine' : hasCastDepGraph ? 'cast' : isGitHubRepo ? 'parser' : 'llm';

  const pipelineStatus = {
    cast:   (isCastRepo || isEngineGraph) ? 'success' : 'fail',
    github: isGitHubRepo ? 'success' : 'skip',
    llm:    hasFullLLM   ? 'success' : (hasCastDepGraph || isEngineGraph ? 'skip' : 'fail'),
    docs:   hasFullLLM   ? 'success' : (hasCastDepGraph || isEngineGraph ? 'skip' : 'fail'),
    graphSource,
  } as ProgramData['pipelineStatus'];

  const cLayoutNodes = (depGraph.cLayoutNodes ?? depGraph.nodes) as typeof depGraph.nodes;
  const allNodes = depGraph.nodes as typeof depGraph.nodes;
  const allEdges = depGraph.edges as typeof depGraph.edges;

  const PADDING = 20;
  const minCx = Math.min(...cLayoutNodes.map((n) => (n.cx ?? 0) - (n.r ?? 36)));
  const minCy = Math.min(...cLayoutNodes.map((n) => (n.cy ?? 0) - (n.r ?? 36)));
  const shiftX = minCx < PADDING ? PADDING - minCx : 0;
  const shiftY = minCy < PADDING ? PADDING - minCy : 0;
  const normalizedNodes = (shiftX > 0 || shiftY > 0)
    ? cLayoutNodes.map((n) => ({ ...n, cx: (n.cx ?? 0) + shiftX, cy: (n.cy ?? 0) + shiftY }))
    : cLayoutNodes;

  const maxCx = Math.max(...normalizedNodes.map((n) => (n.cx ?? 0) + (n.r ?? 36) + PADDING));
  const maxCy = Math.max(...normalizedNodes.map((n) => (n.cy ?? 0) + (n.r ?? 36) + PADDING));

  const cLayout: CircularLayout = {
    w: Math.max(560, maxCx),
    h: Math.max(460, maxCy),
    nodes: normalizedNodes,
    edges: allEdges,
  };

  const chips: MetaChip[] = [
    { label: 'Language', val: prog.language },
    { label: 'LOC', val: prog.loc.toLocaleString() },
    { label: 'Nodes', val: String(allNodes.length) },
    { label: 'Edges', val: String(allEdges.length) },
    { label: 'Coverage', val: `${Math.round(depGraph.coveragePct ?? 100)}%` },
    { label: 'Domain', val: prog.domain ?? 'General' },
  ];

  const callEdges = allEdges.filter((e) => e.type === 'call' || e.type === 'dyn');
  const overviewEdgeLabels = callEdges.slice(0, 5).map((e) => `${e.from} → ${e.to} (${e.type})`);

  const ciObj: ChangeImpact = changeImpact
    ? {
        query: `What is the impact of modifying ${prog.name}?`,
        coverage: changeImpact.coveragePct,
        coverageNote: changeImpact.coverageNote ?? '',
        items: changeImpact.items as ChangeImpact['items'],
      }
    : {
        query: `What is the impact of modifying ${prog.name}?`,
        coverage: 0,
        coverageNote: 'Not yet analyzed',
        items: [],
      };

  const generatedAt = modSpec
    ? new Date(modSpec.createdAt ?? mainJob?.completedAt ?? Date.now()).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : undefined;
  const modernSpec: ModernizationSpec = modSpec
    ? {
        title: `${prog.name} — Modernization Brief`,
        subtitle: `Generated by MAVEN · ${generatedAt}`,
        generatedAt,
        sections: modSpec.sections as ModernizationSpec['sections'],
      }
    : { title: '', subtitle: '', generatedAt: undefined, sections: [] };

  const programData: ProgramData = {
    name: prog.name,
    language: prog.language,
    loc: prog.loc,
    domain: prog.domain ?? 'General',
    desc: prog.desc ?? `COBOL program ${prog.name}`,
    chips,
    overviewQuery: `How does ${prog.name} interact with its dependencies?`,
    overviewNarrative: `${prog.name} is a ${prog.language} program with ${prog.loc.toLocaleString()} lines of code. It has ${callEdges.length} program call(s) and ${allEdges.length - callEdges.length} data dependency(ies). Dependency graph coverage is ${Math.round(depGraph.coveragePct ?? 100)}%.`,
    overviewEdges: overviewEdgeLabels,
    cLayout,
    graph: { title: `${prog.name} Dependency Graph`, nodes: allNodes, edges: allEdges },
    businessRules: (bizRule?.sections ?? []) as ProgramData['businessRules'],
    changeImpact: ciObj,
    spec: modernSpec,
    pipelineStatus,
    internalFlow: (depGraph.internalFlow as import('../parser/types').InternalFlow | null) ?? undefined,
  };

  const castOnly = !bizRule && !changeImpact;

  const [versionRow] = await db
    .select({ c: count() })
    .from(schema.analysisJobs)
    .where(and(eq(schema.analysisJobs.programId, prog.id), eq(schema.analysisJobs.status, 'completed')));
  const version = Number(versionRow?.c ?? 1);

  // suppress unused variable warning for docsJob
  void docsJob;

  return { ...programData, castOnly, version };
}
