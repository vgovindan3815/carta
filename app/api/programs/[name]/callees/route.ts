import { NextRequest, NextResponse } from 'next/server';

export interface CalleeInfo {
  name: string;
  analyzed: boolean;
  exists: boolean;
  language: string;
  loc: number;
  edgeType: string; // 'call' | 'dyn' | 'proc'
}

/**
 * GET /api/programs/[name]/callees
 * Returns the list of programs this module calls, with their analysis status.
 * Used by DependentModulesAlert to warn about unanalyzed callees.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  if (!process.env.DATABASE_URL) return NextResponse.json([]);

  try {
    const { getProgram } = await import('@/lib/db/programs');
    const { getMostRecentDepGraph } = await import('@/lib/db/knowledge');
    const { getMostRecentBizRules } = await import('@/lib/db/documentation');

    const prog = await getProgram(name);
    if (!prog) return NextResponse.json([], { status: 404 });

    const depGraph = await getMostRecentDepGraph(prog.id);
    if (!depGraph) return NextResponse.json([]);

    const edges = (depGraph.edges ?? []) as Array<{ from: string; to: string; type: string }>;

    // Collect unique callees from call / dyn / proc edges
    const calleeMap = new Map<string, string>(); // name → edge type
    for (const e of edges) {
      if ((e.type === 'call' || e.type === 'dyn' || e.type === 'proc') && e.to) {
        if (!calleeMap.has(e.to)) calleeMap.set(e.to, e.type);
      }
    }

    if (calleeMap.size === 0) return NextResponse.json([]);

    const results: CalleeInfo[] = await Promise.all(
      Array.from(calleeMap.entries()).map(async ([calleeName, edgeType]) => {
        const calleeProg = await getProgram(calleeName);
        if (!calleeProg) {
          return { name: calleeName, analyzed: false, exists: false, language: 'COBOL', loc: 0, edgeType };
        }
        const bizRules = await getMostRecentBizRules(calleeProg.id);
        const analyzed = !!(bizRules?.sections?.length);
        return { name: calleeName, analyzed, exists: true, language: calleeProg.language, loc: calleeProg.loc, edgeType };
      })
    );

    // Sort: unanalyzed first, then by name
    results.sort((a, b) => {
      if (a.analyzed !== b.analyzed) return a.analyzed ? 1 : -1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json(results);
  } catch (e) {
    console.error('[callees GET]', e);
    return NextResponse.json([], { status: 500 });
  }
}
