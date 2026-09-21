import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, desc } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ sourceText: null, error: 'Database not configured' });
  }
  try {
    const { name } = await params;
    const db = drizzle(neon(process.env.DATABASE_URL), { schema });

    // Find program by name
    const prog = await db.query.programs.findFirst({
      where: eq(schema.programs.name, name.toUpperCase()),
    });
    if (!prog) return NextResponse.json({ sourceText: null });

    // Find most recent source
    const src = await db.query.programSources.findFirst({
      where: eq(schema.programSources.programId, prog.id),
      orderBy: (t, { desc: d }) => [d(t.capturedAt)],
    });
    return NextResponse.json({ sourceText: src?.sourceText ?? null, loc: src?.loc ?? 0 });
  } catch (err) {
    return NextResponse.json({ sourceText: null, error: String(err) });
  }
}
