import { NextRequest, NextResponse } from 'next/server';
import { getLLMSettings } from '@/lib/db/queries';
import { runTier2Pipeline } from '@/lib/analysis/tier2';
import type { SseLogLine } from '@/lib/parser/types';

export const maxDuration = 300;

/**
 * POST /api/scopes/[id]/generate
 * Triggers the Tier 2 pipeline (Chains 5-8) for a scope.
 * Streams SSE progress and saves artifacts to DB on completion.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: scopeId } = await params;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const emit = (line: SseLogLine) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(line)}\n\n`));
        } catch { /* stream closed */ }
      };

      try {
        const settings = await getLLMSettings();
        const llmConfig = { provider: settings.provider, apiKey: settings.apiKey, model: settings.model };

        await runTier2Pipeline(scopeId, emit, llmConfig);

        controller.enqueue(enc.encode(`data: ${JSON.stringify({ lv: 'DONE', t: 'Tier 2 generation complete', d: 0 })}\n\n`));
        controller.enqueue(enc.encode('event: done\ndata: {}\n\n'));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ lv: 'WARN', t: `Error: ${msg}`, d: 0 })}\n\n`));
        controller.enqueue(enc.encode(`event: error\ndata: ${JSON.stringify({ error: msg })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
