import { NextRequest, NextResponse } from 'next/server';
import { createAppScope, listAppScopes } from '@/lib/db/queries';

export async function GET(req: NextRequest) {
  try {
    const repoId = req.nextUrl.searchParams.get('repoId');
    if (!repoId) return NextResponse.json({ error: 'repoId required' }, { status: 400 });
    const scopes = await listAppScopes(repoId);
    return NextResponse.json({ scopes });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      repoId: string;
      name: string;
      memberProgramIds: string[];
      seedMethod?: 'cluster' | 'job-chain' | 'manual';
      seedRef?: string;
      crossesClusters?: boolean;
      createdBy?: string;
    };

    if (!body.repoId || !body.name || !Array.isArray(body.memberProgramIds)) {
      return NextResponse.json({ error: 'repoId, name, and memberProgramIds are required' }, { status: 400 });
    }

    const scope = await createAppScope({
      repoId: body.repoId,
      name: body.name,
      memberProgramIds: body.memberProgramIds,
      seedMethod: body.seedMethod ?? 'manual',
      seedRef: body.seedRef,
      crossesClusters: body.crossesClusters ?? false,
      createdBy: body.createdBy,
    });

    return NextResponse.json({ scope });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
