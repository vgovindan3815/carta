import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, desc, and } from 'drizzle-orm';
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
  githubUrl: string;
  owner: string;
  repo: string;
  branch: string;
  patEncrypted?: string;
}): Promise<typeof schema.repos.$inferSelect> {
  const db = getDb();
  const [row] = await db
    .insert(schema.repos)
    .values({
      githubUrl: data.githubUrl,
      owner: data.owner,
      repo: data.repo,
      branch: data.branch,
      patEncrypted: data.patEncrypted ?? null,
    })
    .returning();
  return row;
}

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

  // Try to find an existing record for this repo + name combination
  const [existing] = await db
    .select()
    .from(schema.programs)
    .where(
      and(
        eq(schema.programs.repoId, data.repoId),
        eq(schema.programs.name, data.name)
      )
    )
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

export async function listPrograms(
  repoId?: string
): Promise<typeof schema.programs.$inferSelect[]> {
  const db = getDb();
  if (repoId) {
    return db
      .select()
      .from(schema.programs)
      .where(eq(schema.programs.repoId, repoId))
      .orderBy(schema.programs.name);
  }
  return db.select().from(schema.programs).orderBy(schema.programs.name);
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
 * Returns null if the program does not exist or has not been analyzed.
 */
export async function getProgramFullData(name: string): Promise<ProgramData | null> {
  const db = getDb();

  // Fetch the program record
  const [prog] = await db
    .select()
    .from(schema.programs)
    .where(eq(schema.programs.name, name))
    .limit(1);

  if (!prog) return null;

  // Fetch the most recent completed job
  const [job] = await db
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

  if (!job) return null;

  // Fetch all artifact tables for this job
  const [depGraph] = await db
    .select()
    .from(schema.depGraphs)
    .where(
      and(
        eq(schema.depGraphs.programId, prog.id),
        eq(schema.depGraphs.jobId, job.id)
      )
    )
    .limit(1);

  const [bizRule] = await db
    .select()
    .from(schema.bizRules)
    .where(
      and(
        eq(schema.bizRules.programId, prog.id),
        eq(schema.bizRules.jobId, job.id)
      )
    )
    .limit(1);

  const [changeImpact] = await db
    .select()
    .from(schema.changeImpacts)
    .where(
      and(
        eq(schema.changeImpacts.programId, prog.id),
        eq(schema.changeImpacts.jobId, job.id)
      )
    )
    .limit(1);

  const [modSpec] = await db
    .select()
    .from(schema.modSpecs)
    .where(
      and(
        eq(schema.modSpecs.programId, prog.id),
        eq(schema.modSpecs.jobId, job.id)
      )
    )
    .limit(1);

  // Guard — if any required artifact is missing, the analysis is incomplete
  if (!depGraph || !bizRule || !changeImpact || !modSpec) return null;

  // Build circular layout
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

  // Modernization spec assembly
  const specSections = modSpec.sections as typeof modSpec.sections;
  const modernSpec: ModernizationSpec = {
    title: `${prog.name} — Modernization Specification`,
    subtitle: `Generated by MAVEN/ELISA · ${new Date(job.completedAt ?? Date.now()).toLocaleDateString()}`,
    sections: specSections as ModernizationSpec['sections'],
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
  };

  return programData;
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
