import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; scanId: string }> },
) {
  const { scanId } = await params;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const emit = (event: string, data: unknown) => {
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const { getP1Scan, getScanStages, getScanIssues } = await import('@/lib/db/queries');

      let polls = 0;
      const maxPolls = 180; // 3 min at 1s intervals

      while (polls < maxPolls) {
        const scan = await getP1Scan(scanId);
        if (!scan) { emit('error', { error: 'Scan not found' }); break; }

        const stages = await getScanStages(scanId);
        emit('status', { scan, stages });

        if (scan.status === 'completed' || scan.status === 'failed') {
          const issues = await getScanIssues(scanId);
          emit('done', { scan, stages, issues });
          break;
        }

        await new Promise(r => setTimeout(r, 1000));
        polls++;
      }

      if (polls >= maxPolls) {
        emit('timeout', { message: 'Scan is taking longer than expected — check back later' });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
