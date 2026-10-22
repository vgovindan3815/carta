import { NextResponse } from 'next/server';

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'No database configured' }, { status: 503 });
  }

  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL);

    const rows = await sql`
      SELECT
        pg_database_size(current_database()) AS bytes,
        pg_size_pretty(pg_database_size(current_database())) AS pretty
    `;

    const row = rows[0] as { bytes: string; pretty: string };
    const bytes = parseInt(row.bytes, 10);
    const limitBytes = 500 * 1024 * 1024; // 500MB Neon free tier
    const usedPct = Math.round((bytes / limitBytes) * 100);

    return NextResponse.json({
      bytes,
      pretty: row.pretty,
      limitMb: 500,
      usedPct,
      status: usedPct >= 80 ? 'warning' : 'ok',
      message:
        usedPct >= 80
          ? `Database at ${usedPct}% capacity — consider archiving old data`
          : 'ok',
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
