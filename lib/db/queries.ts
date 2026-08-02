import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, desc, and, inArray, count, sum, sql } from 'drizzle-orm';
import * as schema from './schema';
import type {
  ProgramData,
  CircularLayout,
  MetaChip,
  ChangeImpact,
  ModernizationSpec,
} from '../parser/types';

// ---------------------------------------------------------------------------
// DB factory — called per-request (Neon serverless is stateless)
// ---------------------------------------------------------------------------

function getDb() {
  const sql = neon(process.env.DATABASE_URL!);
  return drizzle(sql, { schema });
}

// ---------------------------------------------------------------------------
// Repos
// ---------------------------------------------------------------------------

export async function createRepo(data: {
  projectName?: string;
  githubUrl: string;
  owner: string;
  repo: string;
  branch: string;
  patEncrypted?: string;
}): Promise<typeof schema.repos.$inferSelect> {
  const db = getDb();

  // Return existing repo if already connected — prevents duplicate rows on re-scan
  const [existing] = await db
    .select()
    .from(schema.repos)
    .where(eq(schema.repos.githubUrl, data.githubUrl))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(schema.repos)
      .set({
        projectName: data.projectName ?? existing.projectName,
        lastSyncedAt: new Date(),
        patEncrypted: data.patEncrypted ?? existing.patEncrypted,
      })
      .where(eq(schema.repos.id, existing.id))
      .returning();
    return updated;
  }

  const [row] = await db
    .insert(schema.repos)
    .values({
      projectName: data.projectName ?? 'Default Project',
      githubUrl: data.githubUrl,
      owner: data.owner,
      repo: data.repo,
      branch: data.branch,
      patEncrypted: data.patEncrypted ?? null,
    })
    .returning();
  return row;
}

export async function deleteProject(repoId: string): Promise<void> {
  const db = getDb();
  const progs = await db
    .select({ id: schema.programs.id })
    .from(schema.programs)
    .where(eq(schema.programs.repoId, repoId));
  const progIds = progs.map((p) => p.id);

  if (progIds.length > 0) {
    const jobs = await db
      .select({ id: schema.analysisJobs.id })
      .from(schema.analysisJobs)
      .where(inArray(schema.analysisJobs.programId, progIds));
    const jobIds = jobs.map((j) => j.id);

    if (jobIds.length > 0) {
      await db.delete(schema.depGraphs).where(inArray(schema.depGraphs.jobId, jobIds));
      await db.delete(schema.bizRules).where(inArray(schema.bizRules.jobId, jobIds));
      await db.delete(schema.changeImpacts).where(inArray(schema.changeImpacts.jobId, jobIds));
      await db.delete(schema.modSpecs).where(inArray(schema.modSpecs.jobId, jobIds));
      await db.delete(schema.analysisJobs).where(inArray(schema.analysisJobs.id, jobIds));
    }
    await db.delete(schema.validations).where(inArray(schema.validations.programId, progIds));
    await db.delete(schema.programs).where(inArray(schema.programs.id, progIds));
  }
  await db.delete(schema.repos).where(eq(schema.repos.id, repoId));
}

export async function clearAllProjects(): Promise<void> {
  const db = getDb();
  await db.delete(schema.depGraphs);
  await db.delete(schema.bizRules);
  await db.delete(schema.changeImpacts);
  await db.delete(schema.modSpecs);
  await db.delete(schema.validations);
  await db.delete(schema.analysisJobs);
  await db.delete(schema.programs);
  await db.delete(schema.repos);
}

export async function getAdminStats(): Promise<{
  repos: number; programs: number; jobs: number; totalTokens: number;
}> {
  const db = getDb();
  const [r] = await db.select({ c: count() }).from(schema.repos);
  const [p] = await db.select({ c: count() }).from(schema.programs);
  const [j] = await db.select({ c: count() }).from(schema.analysisJobs);
  const [t] = await db.select({ s: sum(schema.analysisJobs.tokensUsed) }).from(schema.analysisJobs);
  return {
    repos: Number(r.c),
    programs: Number(p.c),
    jobs: Number(j.c),
    totalTokens: Number(t.s ?? 0),
  };
}

// ---------------------------------------------------------------------------
// LLM Settings
// ---------------------------------------------------------------------------

import type { LLMProvider } from '../llm/types';
import { PLACEHOLDER_KEYS } from '../llm/types';

const SETTINGS_KEYS = ['llm_provider', 'llm_model', 'groq_api_key', 'openai_api_key', 'anthropic_api_key'] as const;

export interface LLMSettings {
  provider: LLMProvider;
  model?: string;
  groqKey: string;
  openaiKey: string;
  anthropicKey: string;
}

export async function getLLMSettings(): Promise<LLMSettings & { apiKey: string }> {
  const db = getDb();
  try {
    const rows = await db.select().from(schema.settings)
      .where(inArray(schema.settings.key, [...SETTINGS_KEYS]));
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const provider = ((map.llm_provider as LLMProvider) || 'groq');
    const model = map.llm_model || undefined;
    const groqKey = map.groq_api_key || process.env.GROQ_API_KEY || '';
    const openaiKey = map.openai_api_key || PLACEHOLDER_KEYS.openai;
    const anthropicKey = map.anthropic_api_key || PLACEHOLDER_KEYS.anthropic;
    const apiKey =
      provider === 'groq' ? groqKey :
      provider === 'openai' ? openaiKey :
      anthropicKey;
    return { provider, model, groqKey, openaiKey, anthropicKey, apiKey };
  } catch {
    return {
      provider: 'groq',
      model: undefined,
      groqKey: process.env.GROQ_API_KEY || '',
      openaiKey: PLACEHOLDER_KEYS.openai,
      anthropicKey: PLACEHOLDER_KEYS.anthropic,
      apiKey: process.env.GROQ_API_KEY || '',
    };
  }
}

export async function saveLLMSettings(s: LLMSettings): Promise<void> {
  const db = getDb();
  const entries: { key: string; value: string }[] = [
    { key: 'llm_provider', value: s.provider },
    { key: 'llm_model', value: s.model ?? '' },
    { key: 'groq_api_key', value: s.groqKey },
    { key: 'openai_api_key', value: s.openaiKey },
    { key: 'anthropic_api_key', value: s.anthropicKey },
  ];
  for (const entry of entries) {
    await db.insert(schema.settings)
      .values({ key: entry.key, value: entry.value })
      .onConflictDoUpdate({
        target: schema.settings.key,
        set: { value: entry.value, updatedAt: new Date() },
      });
  }
}

// ---------------------------------------------------------------------------
// Scan Jobs
// ---------------------------------------------------------------------------

export async function createScanJob(repoId: string): Promise<{ id: string }> {
  const db = getDb();
  const [row] = await db.insert(schema.scanJobs).values({ repoId }).returning({ id: schema.scanJobs.id });
  return row;
}

export async function updateScanJob(
  id: string,
  patch: Partial<{ status: string; scannedFiles: number; totalFiles: number; error: string; completedAt: Date }>
): Promise<void> {
  const db = getDb();
  await db.update(schema.scanJobs).set(patch as Record<string, unknown>).where(eq(schema.scanJobs.id, id));
}

export async function getScanJob(id: string): Promise<typeof schema.scanJobs.$inferSelect | undefined> {
  const db = getDb();
  const [row] = await db.select().from(schema.scanJobs).where(eq(schema.scanJobs.id, id)).limit(1);
  return row;
}

export async function getLatestScanJob(repoId: string): Promise<typeof schema.scanJobs.$inferSelect | undefined> {
  const db = getDb();
  const [row] = await db.select().from(schema.scanJobs)
    .where(eq(schema.scanJobs.repoId, repoId))
    .orderBy(desc(schema.scanJobs.createdAt))
    .limit(1);
  return row;
}

// ---------------------------------------------------------------------------
// LLM Settings (model field added)
// ---------------------------------------------------------------------------

export async function listRepos(): Promise<typeof schema.repos.$inferSelect[]> {
  const db = getDb();
  return db.select().from(schema.repos).orderBy(desc(schema.repos.createdAt));
}

export async function getRepo(
  id: string
): Promise<typeof schema.repos.$inferSelect | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.repos)
    .where(eq(schema.repos.id, id))
    .limit(1);
  return row;
}

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------

export async function upsertProgram(data: {
  repoId: string;
  name: string;
  language: string;
  loc: number;
  domain?: string;
  desc?: string;
  filePath: string;
  lastCommitSha?: string;
}): Promise<typeof schema.programs.$inferSelect> {
  const db = getDb();

  // Key on name globally — re-scanning the same repo with a new repoId still finds the existing row
  const [existing] = await db
    .select()
    .from(schema.programs)
    .where(eq(schema.programs.name, data.name))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(schema.programs)
      .set({
        language: data.language,
        loc: data.loc,
        domain: data.domain ?? existing.domain,
        desc: data.desc ?? existing.desc,
        filePath: data.filePath,
        lastCommitSha: data.lastCommitSha ?? existing.lastCommitSha,
      })
      .where(eq(schema.programs.id, existing.id))
      .returning();
    return updated;
  }

  const [inserted] = await db
    .insert(schema.programs)
    .values({
      repoId: data.repoId,
      name: data.name,
      language: data.language,
      loc: data.loc,
      domain: data.domain ?? null,
      desc: data.desc ?? null,
      filePath: data.filePath,
      lastCommitSha: data.lastCommitSha ?? null,
    })
    .returning();
  return inserted;
}

export async function updateProgramDesc(id: string, desc: string): Promise<void> {
  const db = getDb();
  await db.update(schema.programs).set({ desc }).where(eq(schema.programs.id, id));
}

export async function listPrograms(
  repoId?: string
): Promise<typeof schema.programs.$inferSelect[]> {
  const db = getDb();
  const rows = await (repoId
    ? db.select().from(schema.programs).where(eq(schema.programs.repoId, repoId)).orderBy(schema.programs.name)
    : db.select().from(schema.programs).orderBy(desc(schema.programs.createdAt)));

  // Deduplicate by name — keep the first (most-recent) occurrence per program name
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (seen.has(r.name)) return false;
    seen.add(r.name);
    return true;
  });
}

/**
 * Returns 'documented' | 'cast_only' | 'not_analyzed' for each program id.
 * 'documented'  = at least one completed job with tokensUsed > 0
 * 'cast_only'   = completed jobs exist but all have tokensUsed = 0
 * 'not_analyzed'= no completed jobs
 */
export async function getDocStatusForPrograms(
  programIds: string[]
): Promise<Record<string, 'documented' | 'cast_only' | 'not_analyzed'>> {
  if (programIds.length === 0) return {};
  const db = getDb();

  const rows = await db
    .select({
      programId: schema.analysisJobs.programId,
      tokensUsed: schema.analysisJobs.tokensUsed,
    })
    .from(schema.analysisJobs)
    .where(
      and(
        inArray(schema.analysisJobs.programId, programIds),
        eq(schema.analysisJobs.status, 'completed')
      )
    );

  const result: Record<string, 'documented' | 'cast_only' | 'not_analyzed'> = {};
  for (const id of programIds) result[id] = 'not_analyzed';

  for (const row of rows) {
    const id = row.programId;
    if ((row.tokensUsed ?? 0) > 0) {
      result[id] = 'documented';
    } else if (result[id] !== 'documented') {
      result[id] = 'cast_only';
    }
  }

  return result;
}

export async function getProgram(
  name: string
): Promise<typeof schema.programs.$inferSelect | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.programs)
    .where(eq(schema.programs.name, name))
    .limit(1);
  return row;
}

export async function getProgramById(
  id: string
): Promise<typeof schema.programs.$inferSelect | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.programs)
    .where(eq(schema.programs.id, id))
    .limit(1);
  return row;
}

// ---------------------------------------------------------------------------
// Analysis jobs
// ---------------------------------------------------------------------------

export async function createJob(
  programId: string
): Promise<typeof schema.analysisJobs.$inferSelect> {
  const db = getDb();
  const [row] = await db
    .insert(schema.analysisJobs)
    .values({
      programId,
      status: 'pending',
      phase: null,
      progressPct: 0,
      log: [],
      startedAt: null,
      completedAt: null,
      error: null,
    })
    .returning();
  return row;
}

export async function updateJob(
  id: string,
  data: Partial<typeof schema.analysisJobs.$inferInsert>
): Promise<void> {
  const db = getDb();
  await db
    .update(schema.analysisJobs)
    .set(data)
    .where(eq(schema.analysisJobs.id, id));
}

export async function getJob(
  id: string
): Promise<typeof schema.analysisJobs.$inferSelect | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.analysisJobs)
    .where(eq(schema.analysisJobs.id, id))
    .limit(1);
  return row;
}

export async function appendJobLog(
  id: string,
  line: { lv: string; t: string; ts: number }
): Promise<void> {
  const db = getDb();
  // Fetch existing log, append, then update.
  // Note: For high-throughput scenarios, prefer a jsonb_array_append DB function.
  const [job] = await db
    .select({ log: schema.analysisJobs.log })
    .from(schema.analysisJobs)
    .where(eq(schema.analysisJobs.id, id))
    .limit(1);

  const existing = (job?.log as { lv: string; t: string; ts: number }[]) ?? [];
  await db
    .update(schema.analysisJobs)
    .set({ log: [...existing, line] })
    .where(eq(schema.analysisJobs.id, id));
}

// ---------------------------------------------------------------------------
// Analysis result persistence
// ---------------------------------------------------------------------------

export async function saveDepGraph(
  programId: string,
  jobId: string,
  data: {
    nodes: (typeof schema.depGraphs.$inferInsert)['nodes'];
    edges: (typeof schema.depGraphs.$inferInsert)['edges'];
    coveragePct: number;
    cLayoutNodes?: (typeof schema.depGraphs.$inferInsert)['cLayoutNodes'];
  }
): Promise<void> {
  const db = getDb();
  await db.insert(schema.depGraphs).values({
    programId,
    jobId,
    nodes: data.nodes,
    edges: data.edges,
    coveragePct: data.coveragePct,
    cLayoutNodes: data.cLayoutNodes ?? null,
  });

  // Mark the program as recently analyzed
  await db
    .update(schema.programs)
    .set({ lastAnalyzedAt: new Date() })
    .where(eq(schema.programs.id, programId));
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
  data: {
    items: (typeof schema.changeImpacts.$inferInsert)['items'];
    coveragePct: number;
    coverageNote: string;
  }
): Promise<void> {
  const db = getDb();
  await db.insert(schema.changeImpacts).values({
    programId,
    jobId,
    items: data.items,
    coveragePct: data.coveragePct,
    coverageNote: data.coverageNote,
  });
}

export async function saveModSpec(
  programId: string,
  jobId: string,
  sections: (typeof schema.modSpecs.$inferInsert)['sections']
): Promise<void> {
  const db = getDb();
  await db.insert(schema.modSpecs).values({ programId, jobId, sections });
}

// ---------------------------------------------------------------------------
// Full program data (for hub API)
// ---------------------------------------------------------------------------

/**
 * Assembles a ProgramData object from all DB tables.
 * Each artifact is fetched independently (most recent for the program),
 * so a CAST import job and an LLM analysis job can coexist without conflict.
 * Returns null if the program does not exist or has not been analyzed.
 */
export async function getProgramFullData(name: string): Promise<(ProgramData & { castOnly: boolean }) | null> {
  const db = getDb();

  // 1. Fetch the program record
  const [prog] = await db
    .select()
    .from(schema.programs)
    .where(eq(schema.programs.name, name))
    .limit(1);

  if (!prog) return null;

  // 2. Find the most recent COMPLETED job for status/timestamps
  const [mainJob] = await db
    .select()
    .from(schema.analysisJobs)
    .where(
      and(
        eq(schema.analysisJobs.programId, prog.id),
        eq(schema.analysisJobs.status, 'completed')
      )
    )
    .orderBy(desc(schema.analysisJobs.completedAt))
    .limit(1);

  if (!mainJob) return null;

  // 3. Fetch the most recent dep graph for this program (independent of job)
  const [depGraph] = await db
    .select()
    .from(schema.depGraphs)
    .where(eq(schema.depGraphs.programId, prog.id))
    .orderBy(desc(schema.depGraphs.createdAt))
    .limit(1);

  // 4. Fetch the most recent biz_rules for this program
  const [bizRule] = await db
    .select()
    .from(schema.bizRules)
    .where(eq(schema.bizRules.programId, prog.id))
    .orderBy(desc(schema.bizRules.createdAt))
    .limit(1);

  // 5. Fetch the most recent change_impact for this program
  const [changeImpact] = await db
    .select()
    .from(schema.changeImpacts)
    .where(eq(schema.changeImpacts.programId, prog.id))
    .orderBy(desc(schema.changeImpacts.createdAt))
    .limit(1);

  // 6. Fetch the most recent mod_spec for this program
  const [modSpec] = await db
    .select()
    .from(schema.modSpecs)
    .where(eq(schema.modSpecs.programId, prog.id))
    .orderBy(desc(schema.modSpecs.createdAt))
    .limit(1);

  // 7. Guard — dep graph + biz rules + change impact are required; mod spec is optional (on-demand)
  if (!depGraph) return null;
  if (!bizRule || !changeImpact) return null;

  // 8. Fetch associated jobs to determine tokensUsed per artifact
  const [depGraphJob] = await db
    .select()
    .from(schema.analysisJobs)
    .where(eq(schema.analysisJobs.id, depGraph.jobId))
    .limit(1);

  const [docsJob] = await db
    .select()
    .from(schema.analysisJobs)
    .where(eq(schema.analysisJobs.id, bizRule.jobId))
    .limit(1);

  // 9. Determine pipeline source
  const hasCastDepGraph = depGraphJob?.tokensUsed === 0;
  const hasFullLLM = (docsJob?.tokensUsed ?? 0) > 0;

  // 10. Set pipelineStatus
  const pipelineStatus = {
    cast: hasCastDepGraph ? 'success' : 'fail',
    github: hasCastDepGraph ? 'skip' : 'success',
    llm: hasFullLLM ? 'success' : (hasCastDepGraph ? 'skip' : 'fail'),
    docs: hasFullLLM ? 'success' : (hasCastDepGraph ? 'skip' : 'fail'),
    graphSource: hasCastDepGraph ? 'cast' : 'llm',
  } as ProgramData['pipelineStatus'];

  // Build circular layout from the dep graph's cLayoutNodes
  const cLayoutNodes = (depGraph.cLayoutNodes ?? depGraph.nodes) as typeof depGraph.nodes;
  const allNodes = depGraph.nodes as typeof depGraph.nodes;
  const allEdges = depGraph.edges as typeof depGraph.edges;

  // Derive canvas size from node positions
  const maxCx = Math.max(...cLayoutNodes.map((n) => (n.cx ?? 0) + (n.r ?? 36) + 20));
  const maxCy = Math.max(...cLayoutNodes.map((n) => (n.cy ?? 0) + (n.r ?? 36) + 20));

  const cLayout: CircularLayout = {
    w: Math.max(560, maxCx),
    h: Math.max(460, maxCy),
    nodes: cLayoutNodes,
    edges: allEdges,
  };

  // Build metadata chips
  const chips: MetaChip[] = [
    { label: 'Language', val: prog.language },
    { label: 'LOC', val: prog.loc.toLocaleString() },
    { label: 'Nodes', val: String(allNodes.length) },
    { label: 'Edges', val: String(allEdges.length) },
    { label: 'Coverage', val: `${Math.round(depGraph.coveragePct ?? 100)}%` },
    { label: 'Domain', val: prog.domain ?? 'General' },
  ];

  // Overview: pick first few outgoing call edges for the narrative panel
  const callEdges = allEdges.filter(
    (e) => e.type === 'call' || e.type === 'dyn'
  );
  const overviewEdgeLabels = callEdges
    .slice(0, 5)
    .map((e) => `${e.from} → ${e.to} (${e.type})`);

  // Change impact assembly
  const ciItems = changeImpact.items as typeof changeImpact.items;
  const ciObj: ChangeImpact = {
    query: `What is the impact of modifying ${prog.name}?`,
    coverage: changeImpact.coveragePct,
    coverageNote: changeImpact.coverageNote ?? '',
    items: ciItems as ChangeImpact['items'],
  };

  // Modernization spec assembly — optional, may not exist yet (on-demand generation)
  const generatedAt = modSpec
    ? new Date(modSpec.createdAt ?? mainJob.completedAt ?? Date.now()).toLocaleDateString('en-GB', {
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
    : {
        title: '',
        subtitle: '',
        generatedAt: undefined,
        sections: [],
      };

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
    graph: {
      title: `${prog.name} Dependency Graph`,
      nodes: allNodes,
      edges: allEdges,
    },
    businessRules: bizRule.sections as ProgramData['businessRules'],
    changeImpact: ciObj,
    spec: modernSpec,
    pipelineStatus,
  };

  // 11. castOnly: CAST dep graph exists but no LLM docs yet
  const castOnly = hasCastDepGraph && !hasFullLLM;

  // 12. version = number of completed jobs (for living document indicator)
  const [versionRow] = await db
    .select({ c: count() })
    .from(schema.analysisJobs)
    .where(
      and(
        eq(schema.analysisJobs.programId, prog.id),
        eq(schema.analysisJobs.status, 'completed')
      )
    );
  const version = Number(versionRow?.c ?? 1);

  return { ...programData, castOnly, version };
}

// ---------------------------------------------------------------------------
// Copybooks
// ---------------------------------------------------------------------------

import type { CopybookField, CopybookDefinition } from '../parser/types';

export async function saveCopybook(
  repoId: string,
  name: string,
  source: string,
  fields: CopybookField[]
): Promise<void> {
  const db = getDb();
  await db
    .insert(schema.copybooks)
    .values({ repoId, name: name.toUpperCase(), source, fields })
    .onConflictDoNothing();
}

export async function getCopybooksForRepo(repoId: string): Promise<CopybookDefinition[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.copybooks)
    .where(eq(schema.copybooks.repoId, repoId));
  return rows.map((r) => ({
    name: r.name,
    source: r.source,
    fields: (r.fields ?? []) as CopybookField[],
  }));
}

export async function getCopybooksByNames(
  repoId: string,
  names: string[]
): Promise<CopybookDefinition[]> {
  if (!names.length) return [];
  const db = getDb();
  const upperNames = names.map((n) => n.toUpperCase());
  const rows = await db
    .select()
    .from(schema.copybooks)
    .where(
      and(
        eq(schema.copybooks.repoId, repoId),
        inArray(schema.copybooks.name, upperNames)
      )
    );
  return rows.map((r) => ({
    name: r.name,
    source: r.source,
    fields: (r.fields ?? []) as CopybookField[],
  }));
}

// ---------------------------------------------------------------------------
// Domain Glossary
// ---------------------------------------------------------------------------

export interface GlossaryEntry {
  id: string;
  pattern: string;
  description: string;
  examples: string[];
}

export async function saveGlossaryEntry(
  repoId: string,
  pattern: string,
  description: string,
  examples: string[] = []
): Promise<void> {
  const db = getDb();
  await db.insert(schema.domainGlossary).values({ repoId, pattern, description, examples });
}

export async function getGlossaryForRepo(repoId: string): Promise<GlossaryEntry[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.domainGlossary)
    .where(eq(schema.domainGlossary.repoId, repoId))
    .orderBy(schema.domainGlossary.pattern);
  return rows.map((r) => ({
    id: r.id,
    pattern: r.pattern,
    description: r.description,
    examples: (r.examples ?? []) as string[],
  }));
}

export async function deleteGlossaryEntry(id: string): Promise<void> {
  const db = getDb();
  await db.delete(schema.domainGlossary).where(eq(schema.domainGlossary.id, id));
}

// ---------------------------------------------------------------------------
// Artifact helpers used by context layer
// ---------------------------------------------------------------------------

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

export async function getMostRecentDepGraph(
  programId: string
): Promise<typeof schema.depGraphs.$inferSelect | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.depGraphs)
    .where(eq(schema.depGraphs.programId, programId))
    .orderBy(desc(schema.depGraphs.createdAt))
    .limit(1);
  return row;
}

export async function getJclCallers(
  programName: string,
  repoId: string
): Promise<string[]> {
  const db = getDb();
  // Find all JCL programs in this repo
  const jclProgs = await db
    .select()
    .from(schema.programs)
    .where(
      and(
        eq(schema.programs.repoId, repoId),
        inArray(schema.programs.language, ['JCL', 'PROC'])
      )
    );

  const callers: string[] = [];
  const upperName = programName.toUpperCase();

  for (const jclProg of jclProgs) {
    const [dg] = await db
      .select()
      .from(schema.depGraphs)
      .where(eq(schema.depGraphs.programId, jclProg.id))
      .orderBy(desc(schema.depGraphs.createdAt))
      .limit(1);

    if (!dg) continue;
    const edges = dg.edges as Array<{ from: string; to: string; type: string }>;
    if (edges.some((e) => e.to.toUpperCase() === upperName)) {
      callers.push(jclProg.name);
    }
  }
  return callers;
}

export async function countCompletedJobs(programId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ c: count() })
    .from(schema.analysisJobs)
    .where(
      and(
        eq(schema.analysisJobs.programId, programId),
        eq(schema.analysisJobs.status, 'completed')
      )
    );
  return Number(row?.c ?? 0);
}

// ---------------------------------------------------------------------------
// Validations
// ---------------------------------------------------------------------------

export async function createValidation(data: {
  programId: string;
  artifactType: string;
  reviewer: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
}): Promise<void> {
  const db = getDb();
  await db.insert(schema.validations).values({
    programId: data.programId,
    artifactType: data.artifactType,
    reviewer: data.reviewer,
    notes: data.notes ?? null,
    status: data.status,
  });
}
