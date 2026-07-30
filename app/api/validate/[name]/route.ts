import { NextRequest, NextResponse } from 'next/server';

// POST /api/validate/[name] — record engineer sign-off
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  let body: {
    artifactType?: string;
    reviewer?: string;
    notes?: string;
    status?: 'approved' | 'rejected';
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { artifactType = 'change_impact', reviewer, notes, status = 'approved' } = body;

  if (!reviewer) {
    return NextResponse.json({ error: 'reviewer is required' }, { status: 400 });
  }
  if (!['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'status must be approved or rejected' }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    // Demo mode — just acknowledge
    return NextResponse.json({
      ok: true,
      message: `Sign-off recorded for ${reviewer} on ${artifactType} of ${name} (demo mode — no DB)`,
    });
  }

  try {
    const { getProgram, createValidation } = await import('@/lib/db/queries');

    const prog = await getProgram(name);
    if (!prog) {
      return NextResponse.json({ error: `Program ${name} not found` }, { status: 404 });
    }

    await createValidation({
      programId: prog.id,
      artifactType,
      reviewer,
      notes,
      status,
    });

    return NextResponse.json({ ok: true, message: `Sign-off recorded for ${reviewer}` });
  } catch (e) {
    console.error(`[/api/validate/${name} POST]`, e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
