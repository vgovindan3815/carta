import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_PER_HOUR = 20;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + 3_600_000 });
    return true;
  }
  if (entry.count >= RATE_LIMIT_PER_HOUR) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Maximum 20 agent requests per hour per IP.' },
      { status: 429, headers: { 'Retry-After': '3600' } }
    );
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const body = (await req.json()) as {
      query: string;
      history?: { role: 'user' | 'assistant'; content: string }[];
      programName?: string;
      repoId?: string;
      agentId?: string;
    };

    const { createAgentRun, updateAgentRun } = await import('@/lib/db/queries');
    const { runAgent } = await import('@/lib/agents/runner');
    const { resolveApiConfig } = await import('@/lib/llm/resolveKey');
    const { isPlaceholderKey } = await import('@/lib/llm/types');

    const apiConfig = await resolveApiConfig(req);
    if (!apiConfig) {
      return NextResponse.json({ error: 'needs_api_key', message: 'Provide an Anthropic API key to use agent chat.' }, { status: 401 });
    }

    // Agent tool-use requires Anthropic — use anthropicKey regardless of the main provider setting
    const anthropicKey = apiConfig.source === 'byok' && apiConfig.provider === 'anthropic'
      ? apiConfig.apiKey
      : (apiConfig.anthropicKey || process.env.ANTHROPIC_API_KEY || '');
    if (isPlaceholderKey(anthropicKey)) {
      return NextResponse.json(
        {
          error: 'needs_api_key',
          message: 'Agent chat requires an Anthropic API key. Enter your Anthropic key to continue.',
        },
        { status: 401 }
      );
    }

    // Always use a capable Claude model for agents; respect model setting if provider is Anthropic
    const model = apiConfig.provider === 'anthropic' && apiConfig.model
      ? apiConfig.model
      : 'claude-sonnet-4-6';

    // Create a DB run record
    const run = await createAgentRun({
      repoId: body.repoId,
      programName: body.programName,
      query: body.query,
      provider: 'anthropic',
      model,
    });

    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        const emit = (event: string, data: object) => {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        emit('run_id', { runId: run.id });

        const allMessages = [...(body.history ?? [])];
        const toolCallLog: object[] = [];
        let finalResponse = '';

        try {
          for await (const event of runAgent(anthropicKey, model, body.history ?? [], body.query, body.agentId ?? 'general')) {
            emit(event.type, event.data);
            if (event.type === 'tool_call') toolCallLog.push(event.data);
            if (event.type === 'text') finalResponse += String(event.data.text ?? '');
            if (event.type === 'done') {
              await updateAgentRun(run.id, {
                status: 'completed',
                response: finalResponse,
                messages: [
                  ...allMessages,
                  { role: 'user', content: body.query },
                  { role: 'assistant', content: finalResponse },
                ],
                toolCalls: toolCallLog,
                tokensUsed: Number(event.data.tokensUsed ?? 0),
                completedAt: new Date(),
              });
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          emit('error', { error: msg });
          await updateAgentRun(run.id, { status: 'failed', error: msg, completedAt: new Date() });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
