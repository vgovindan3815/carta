import { NextRequest, NextResponse } from 'next/server';

/**
 * GET  /api/repos/[id]/copybooks — list all copybooks for a repo
 * POST /api/repos/[id]/copybooks — upload a .cpy file, parse & store
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: repoId } = await params;
  const { getCopybooksForRepo } = await import('@/lib/db/queries');
  const defs = await getCopybooksForRepo(repoId);
  return NextResponse.json(defs);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: repoId } = await params;
  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  if (!file.name.toLowerCase().endsWith('.cpy')) {
    return NextResponse.json({ error: 'Only .cpy files are supported' }, { status: 400 });
  }

  const source = await file.text();
  const name = file.name.replace(/\.cpy$/i, '').toUpperCase();

  const { parseCopybook } = await import('@/lib/parser/copybook');
  const { saveCopybook } = await import('@/lib/db/queries');

  const def = parseCopybook(name, source);
  await saveCopybook(repoId, def.name, def.source, def.fields);

  return NextResponse.json({ ok: true, name: def.name, fieldCount: def.fields.length });
}
