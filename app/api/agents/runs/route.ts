import { NextResponse } from 'next/server';

export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json({ runs: [] });
  const { listAgentRuns } = await import('@/lib/db/queries');
  const runs = await listAgentRuns(50);
  return NextResponse.json({ runs });
}
