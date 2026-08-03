import { NextRequest, NextResponse } from 'next/server';
import {
  getAppScope,
  getScopeCoverageGate,
  getAppCapabilityMap,
  getAppBrd,
  getAppModSpec,
  getAppImpact,
} from '@/lib/db/queries';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const scope = await getAppScope(id);
    if (!scope) return NextResponse.json({ error: 'Scope not found' }, { status: 404 });

    const [coverage, capMap, brd, modSpec, impact] = await Promise.all([
      getScopeCoverageGate(id),
      getAppCapabilityMap(id),
      getAppBrd(id),
      getAppModSpec(id),
      getAppImpact(id),
    ]);

    return NextResponse.json({
      scope,
      coverage,
      capabilityMap: capMap ?? null,
      brd: brd ?? null,
      modSpec: modSpec ?? null,
      impact: impact ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
