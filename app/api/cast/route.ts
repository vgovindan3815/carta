import { NextRequest, NextResponse } from 'next/server';
import { createRepo, upsertProgram, createJob, updateJob, saveDepGraph, saveBizRules, saveChangeImpact, saveModSpec } from '@/lib/db/queries';
import { layoutCircular } from '@/lib/llm';
import type { GraphNode, GraphEdge, CircularLayout } from '@/lib/parser/types';

// ---------------------------------------------------------------------------
// POST /api/cast
// Accepts a multipart/form-data body with:
//   file   — .json or .xml CAST-compatible report
//   name   — project name (optional, defaults to filename)
// Parses the report, upserts programs and dep graphs in the DB.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const projectName = (formData.get('name') as string | null) || 'CAST Import';

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

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

    // Create a synthetic "CAST" repo entry to group the import
    const repo = await createRepo({
      projectName,
      githubUrl: `cast://import/${encodeURIComponent(file.name)}`,
      owner: 'cast-import',
      repo: file.name.replace(/\.[^.]+$/, ''),
      branch: 'deterministic',
    });

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
  // Support both { programs: [...] } and top-level array
  const list: unknown[] = Array.isArray(data) ? data : (data.programs ?? []);
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
  }).filter((p) => p.name);
}

// ---------------------------------------------------------------------------
// XML parser — minimal hand-rolled parser for the CAST-compatible XML format
// ---------------------------------------------------------------------------

function parseXml(text: string): CastProgram[] {
  const programs: CastProgram[] = [];
  const progRx = /<program\b[^>]*>([\s\S]*?)<\/program>/gi;
  let pm: RegExpExecArray | null;

  while ((pm = progRx.exec(text)) !== null) {
    const block = pm[1];
    const get = (tag: string) => {
      const m = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i').exec(block);
      return m ? m[1].trim() : undefined;
    };

    const name = get('name') ?? '';
    if (!name) continue;

    const nodes: CastProgram['nodes'] = [];
    const edges: CastProgram['edges'] = [];

    const nodeRx = /<node\b[^>]*>([\s\S]*?)<\/node>/gi;
    let nm: RegExpExecArray | null;
    while ((nm = nodeRx.exec(block)) !== null) {
      const nb = nm[1];
      const nget = (t: string) => new RegExp(`<${t}>([^<]*)</${t}>`, 'i').exec(nb)?.[1].trim();
      const id = nget('id') ?? '';
      if (id) nodes.push({ id, label: nget('label') ?? id, sub: nget('sub'), type: nget('type') });
    }

    const edgeRx = /<edge\b[^>]*>([\s\S]*?)<\/edge>/gi;
    let em: RegExpExecArray | null;
    while ((em = edgeRx.exec(block)) !== null) {
      const eb = em[1];
      const eget = (t: string) => new RegExp(`<${t}>([^<]*)</${t}>`, 'i').exec(eb)?.[1].trim();
      const to = eget('to') ?? '';
      if (to) edges.push({
        from: eget('from'),
        to,
        type: eget('type') ?? 'call',
        label: eget('label'),
        confidence: eget('confidence') ? Number(eget('confidence')) : 100,
      });
    }

    programs.push({
      name,
      language: get('language') ?? 'COBOL',
      loc: Number(get('loc') ?? 0),
      filePath: get('filePath'),
      domain: get('domain'),
      desc: get('desc'),
      coveragePct: get('coveragePct') ? Number(get('coveragePct')) : 100,
      nodes,
      edges,
    });
  }

  return programs;
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
