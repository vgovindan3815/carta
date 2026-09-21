import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
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

    const { getLLMSettings, createAgentRun, updateAgentRun } = await import('@/lib/db/queries');
    const { runAgent } = await import('@/lib/agents/runner');

    const settings = await getLLMSettings();

    // Agent tool-use requires Anthropic — use anthropicKey regardless of the main provider setting
    // so users who use Groq for analysis but also have an Anthropic key can still use agents
    const { isPlaceholderKey } = await import('@/lib/llm/types');
    const anthropicKey = settings.anthropicKey || process.env.ANTHROPIC_API_KEY || '';
    if (isPlaceholderKey(anthropicKey)) {
      return NextResponse.json(
        {
          error:
            'Agent chat requires an Anthropic API key. Go to Settings → enter your Anthropic key (your main provider can remain Groq or OpenAI).',
        },
        { status: 400 }
      );
    }

    // Always use a capable Claude model for agents; respect model setting if provider is Anthropic
    const model = settings.provider === 'anthropic' && settings.model
      ? settings.model
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
