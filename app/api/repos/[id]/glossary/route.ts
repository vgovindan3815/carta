import { NextRequest, NextResponse } from 'next/server';

/**
 * GET    /api/repos/[id]/glossary — list all domain glossary entries
 * POST   /api/repos/[id]/glossary — create a new entry
 * DELETE /api/repos/[id]/glossary?id=xxx — delete an entry
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: repoId } = await params;
  const { getGlossaryForRepo } = await import('@/lib/db/queries');
  const entries = await getGlossaryForRepo(repoId);
  return NextResponse.json(entries);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: repoId } = await params;
  let body: { pattern?: string; description?: string; examples?: string[] };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.pattern || !body.description) {
    return NextResponse.json({ error: 'pattern and description are required' }, { status: 400 });
  }

  const { saveGlossaryEntry } = await import('@/lib/db/queries');
  await saveGlossaryEntry(repoId, body.pattern, body.description, body.examples ?? []);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  void params;
  const entryId = new URL(req.url).searchParams.get('id');
  if (!entryId) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { deleteGlossaryEntry } = await import('@/lib/db/queries');
  await deleteGlossaryEntry(entryId);

  return NextResponse.json({ ok: true });
}
