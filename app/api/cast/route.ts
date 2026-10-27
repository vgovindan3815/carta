import { NextRequest, NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';
import { createRepo, getRepo, upsertProgram, createJob, updateJob, saveDepGraph, saveBizRules, saveChangeImpact, saveModSpec } from '@/lib/db/queries';
import { layoutCircular } from '@/lib/llm';
import type { GraphNode, GraphEdge, CircularLayout } from '@/lib/parser/types';

// ---------------------------------------------------------------------------
// POST /api/cast
// Accepts a multipart/form-data body with:
//   file   — .json or .xml CAST-compatible report
//   name   — project name (optional, defaults to filename)
// Parses the report, upserts programs and dep graphs in the DB.
// ---------------------------------------------------------------------------

const MAX_CAST_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

export async function POST(req: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'No database configured' }, { status: 503 });
  }
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const projectName = (formData.get('name') as string | null) || 'CAST Import';
    const repoId = formData.get('repoId') as string | null;

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    if (file.size > MAX_CAST_FILE_BYTES) {
      return NextResponse.json({ error: 'File exceeds the 20 MB limit' }, { status: 413 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['json', 'xml'].includes(ext ?? '')) {
      return NextResponse.json({ error: 'Only .json and .xml files are supported' }, { status: 400 });
    }

    const text = await file.text();

    // Parse programs array from the report
    let programs: CastProgram[];
    if (ext === 'json') {
      programs = parseJson(text);
    } else {
      programs = parseXml(text);
    }

    if (!programs.length) {
      return NextResponse.json({ error: 'No programs found in report' }, { status: 422 });
    }

    // Use existing repo if repoId provided, otherwise create a synthetic one
    let repo: Awaited<ReturnType<typeof createRepo>>;
    if (repoId) {
      const existing = await getRepo(repoId);
      if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      repo = existing;
    } else {
      repo = await createRepo({
        projectName,
        githubUrl: `cast://import/${encodeURIComponent(file.name)}`,
        owner: 'cast-import',
        repo: file.name.replace(/\.[^.]+$/, ''),
        branch: 'deterministic',
      });
    }

    let imported = 0;
    const errors: string[] = [];

    for (const prog of programs) {
      try {
        const dbProg = await upsertProgram({
          repoId: repo.id,
          name: prog.name,
          language: prog.language,
          loc: prog.loc,
          domain: prog.domain ?? undefined,
          desc: prog.desc ?? `COBOL program ${prog.name} — imported from CAST report`,
          filePath: prog.filePath ?? `${prog.name}.cbl`,
        });

        // Create a synthetic completed job for the dep graph
        const job = await createJob(dbProg.id);
        await updateJob(job.id, {
          status: 'completed',
          phase: 'CAST Import',
          progressPct: 100,
          startedAt: new Date(),
          completedAt: new Date(),
          tokensUsed: 0,
          log: [{ lv: 'OK', t: `Imported from CAST report: ${file.name}`, ts: Date.now() }],
        });

        // Build nodes — ensure hero node exists
        const nodes: GraphNode[] = buildNodes(prog);
        const edges: GraphEdge[] = buildEdges(prog);

        // Layout the dep graph circularly
        const cLayout: CircularLayout = layoutCircular(nodes, edges);

        await saveDepGraph(dbProg.id, job.id, {
          nodes,
          edges,
          coveragePct: prog.coveragePct ?? 100,
          cLayoutNodes: cLayout.nodes,
        });

        // Insert minimal placeholder artifacts so the Hub page can render the dep graph immediately.
        // The user can trigger LLM analysis later to populate full content.
        const callEdges = edges.filter((e) => e.type === 'call' || e.type === 'dyn');
        await saveBizRules(dbProg.id, job.id, [
          {
            section: 'Dependency Summary (CAST)',
            rules: callEdges.length
              ? callEdges.map((e) => ({
                  text: `Calls ${e.to} via ${e.label ?? 'CALL'} [edge: ${prog.name} → ${e.to} (${e.type})]`,
                  citations: [{ label: e.label ?? 'CALL', edge: `${prog.name} → ${e.to}` }],
                }))
              : [{ text: 'No outbound call dependencies detected in CAST report.', citations: [] }],
          },
        ]);

        await saveChangeImpact(dbProg.id, job.id, {
          items: callEdges.map((e) => ({
            prog: e.to,
            rel: `${prog.name} → ${e.to}`,
            severity: 'medium' as const,
            reason: `${prog.name} directly invokes ${e.to} — changes may propagate via ${e.label ?? 'CALL'}`,
            edge: `${prog.name} → ${e.to} (${e.type})`,
          })),
          coveragePct: prog.coveragePct ?? 100,
          coverageNote: 'Derived deterministically from CAST report. Run LLM analysis to enrich with semantic context.',
        });

        await saveModSpec(dbProg.id, job.id, [
          {
            num: 1,
            title: 'CAST Import Note',
            content: `<p>This program was imported from a CAST dependency report. The dependency graph is deterministic (100% confidence on all static calls). Run <strong>LLM Analysis</strong> to generate full business rules, change impact analysis, and a modernization specification.</p>`,
          },
          {
            num: 2,
            title: 'Detected Dependencies',
            content: callEdges.length
              ? `<ul>${callEdges.map((e) => `<li><code>${prog.name}</code> → <code>${e.to}</code> via ${e.label ?? 'CALL'}</li>`).join('')}</ul>`
              : '<p>No outbound program calls detected.</p>',
          },
        ]);

        imported++;
      } catch (e) {
        errors.push(`${prog.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return NextResponse.json({
      ok: true,
      imported,
      total: programs.length,
      projectId: repo.id,
      projectName,
      errors: errors.length ? errors : undefined,
    });
  } catch (e) {
    console.error('[POST /api/cast]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Types for the parsed intermediate representation
// ---------------------------------------------------------------------------

interface CastProgram {
  name: string;
  language: string;
  loc: number;
  filePath?: string;
  domain?: string;
  desc?: string;
  coveragePct?: number;
  nodes?: Array<{ id: string; label: string; sub?: string; type?: string }>;
  edges?: Array<{ from?: string; to: string; type?: string; label?: string; confidence?: number }>;
}

// ---------------------------------------------------------------------------
// JSON parser — matches carddemo-cast-report.json format
// ---------------------------------------------------------------------------

function parseJson(text: string): CastProgram[] {
  const data = JSON.parse(text);
  // Support:
  //   - top-level array                 (CAST export, --format mkp)
  //   - { programs: [...] }             (legacy CAST JSON)
  //   - { artifacts: [...] }            (mavenkg-engine full report)
  const list: unknown[] = Array.isArray(data)
    ? data
    : (data.programs ?? data.artifacts ?? []);
  return list.map((p: unknown) => {
    const item = p as Record<string, unknown>;
    return {
      name: String(item.name ?? ''),
      language: String(item.language ?? 'COBOL'),
      loc: Number(item.loc ?? 0),
      filePath: item.filePath ? String(item.filePath) : undefined,
      domain: item.domain ? String(item.domain) : undefined,
      desc: item.desc ? String(item.desc) : undefined,
      coveragePct: item.coveragePct !== undefined ? Number(item.coveragePct) : 100,
      nodes: Array.isArray(item.nodes) ? (item.nodes as CastProgram['nodes']) : [],
      edges: Array.isArray(item.edges) ? (item.edges as CastProgram['edges']) : [],
    };
  }).filter((p) => {
    if (!p.name) return false;
    // Skip SQL DDL files and copybook-only artifacts — they are data definitions,
    // not programs.  MKP's program model expects COBOL / JCL / PLI / HLASM units.
    const lang = p.language.toUpperCase();
    return !['SQL', 'COPYBOOK', 'CSD', 'CTLCARD', 'UNKNOWN'].includes(lang);
  });
}

// ---------------------------------------------------------------------------
// XML parser — uses fast-xml-parser (safe, no ReDoS risk)
// ---------------------------------------------------------------------------

function parseXml(text: string): CastProgram[] {
  const parser = new XMLParser({ ignoreAttributes: false, isArray: (name) => ['program', 'node', 'edge'].includes(name) });
  let root: Record<string, unknown>;
  try {
    root = parser.parse(text) as Record<string, unknown>;
  } catch {
    return [];
  }

  const report = (root.report ?? root) as Record<string, unknown>;
  const rawPrograms = (report.programs as Record<string, unknown>)?.program ??
    report.program ?? [];
  if (!Array.isArray(rawPrograms)) return [];

  return (rawPrograms as Record<string, unknown>[]).map((p) => {
    const str = (v: unknown) => (v !== undefined && v !== null ? String(v).trim() : undefined);
    const rawNodes = ((p.nodes as Record<string, unknown>)?.node ?? []) as Record<string, unknown>[];
    const rawEdges = ((p.edges as Record<string, unknown>)?.edge ?? []) as Record<string, unknown>[];

    return {
      name: str(p.name) ?? '',
      language: str(p.language) ?? 'COBOL',
      loc: Number(p.loc ?? 0),
      filePath: str(p.filePath),
      domain: str(p.domain),
      desc: str(p.desc),
      coveragePct: p.coveragePct !== undefined ? Number(p.coveragePct) : 100,
      nodes: rawNodes.map((n) => ({
        id: str(n.id) ?? '',
        label: str(n.label) ?? str(n.id) ?? '',
        sub: str(n.sub),
        type: str(n.type),
      })).filter((n) => n.id),
      edges: rawEdges.map((e) => ({
        from: str(e.from),
        to: str(e.to) ?? '',
        type: str(e.type) ?? 'call',
        label: str(e.label),
        confidence: e.confidence !== undefined ? Number(e.confidence) : 100,
      })).filter((e) => e.to),
    };
  }).filter((p) => p.name);
}

// ---------------------------------------------------------------------------
// Node / edge builders
// ---------------------------------------------------------------------------

function buildNodes(prog: CastProgram): GraphNode[] {
  if (prog.nodes?.length) {
    // Ensure hero node is present
    const hasHero = prog.nodes.some((n) => n.type === 'hero' || n.id === prog.name);
    const mapped: GraphNode[] = prog.nodes.map((n) => ({
      id: n.id,
      label: n.label ?? n.id,
      sub: n.sub ?? (n.type === 'data' ? 'Data Resource' : 'Program'),
      type: (n.type as GraphNode['type']) ?? 'prog',
    }));
    if (!hasHero) {
      mapped.unshift({ id: prog.name, label: prog.name, sub: 'Main Program', type: 'hero' });
    }
    return mapped;
  }

  // Derive nodes from edges
  const ids = new Set<string>();
  const nodes: GraphNode[] = [{ id: prog.name, label: prog.name, sub: 'Main Program', type: 'hero' }];
  ids.add(prog.name);

  for (const e of prog.edges ?? []) {
    if (!ids.has(e.to)) {
      ids.add(e.to);
      nodes.push({
        id: e.to,
        label: e.to,
        sub: e.type === 'data' || e.type === 'sql' ? 'Data Resource' : 'Called Program',
        type: e.type === 'data' || e.type === 'sql' ? 'data' : 'prog',
      });
    }
  }
  return nodes;
}

function buildEdges(prog: CastProgram): GraphEdge[] {
  return (prog.edges ?? []).map((e) => ({
    from: e.from ?? prog.name,
    to: e.to,
    type: (e.type as GraphEdge['type']) ?? 'call',
    label: e.label ?? e.type ?? 'CALL',
    confidence: e.confidence ?? 100,
  }));
}
