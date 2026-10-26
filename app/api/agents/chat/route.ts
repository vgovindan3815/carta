import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

const MAX_TURNS = 5;

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
      return NextResponse.json({ error: 'needs_api_key', message: 'No LLM API key configured. Go to Settings and enter your key.' }, { status: 401 });
    }

    // Use the configured provider's key for agents
    const activeProvider = apiConfig.provider;
    const activeKey = apiConfig.apiKey;
    if (isPlaceholderKey(activeKey)) {
      return NextResponse.json(
        {
          error: 'needs_api_key',
          message: 'No LLM API key configured. Go to Settings and enter your key.',
        },
        { status: 401 }
      );
    }

    // Select model based on active provider
    const model = apiConfig.model || (
      activeProvider === 'anthropic' ? 'claude-sonnet-4-6' :
      activeProvider === 'openai'    ? 'gpt-4o' :
      'llama-3.3-70b-versatile'
    );

    // Create a DB run record
    const run = await createAgentRun({
      repoId: body.repoId,
      programName: body.programName,
      query: body.query,
      provider: activeProvider,
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
          if (activeProvider === 'anthropic') {
            // Anthropic: use native tool_use with streaming agentic loop
            for await (const event of runAgent(activeKey, model, body.history ?? [], body.query, body.agentId ?? 'general')) {
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
          } else {
            // OpenAI / Groq: text-based tool loop (same pattern as /api/agents/v2/chat)
            const { toolRegistry } = await import('@/lib/agents/registry');
            const { getAgent } = await import('@/lib/agents/agents');
            const { executeTool } = await import('@/lib/agents/executor');

            const agentDef = getAgent(body.agentId ?? 'general');
            const availableTools = agentDef
              ? toolRegistry.filter(t => agentDef.tools.includes(t.name))
              : toolRegistry;

            const toolDescriptions = availableTools
              .map(t => `- ${t.name}: ${t.purpose}`)
              .join('\n');

            const systemPrompt = (agentDef?.systemPrompt ?? '') + `

Available tools (JSON format):
${toolDescriptions}

To call a tool, output EXACTLY on its own line: <tool>{"tool":"name","args":{...}}</tool>
After the tool result is injected, continue your response.
Never call the same tool with the same arguments twice.
When you have enough information to answer, stop calling tools and give your final answer.`;

            type CallResult = { text: string; totalTokens?: number };
            let callLLM: (system: string, user: string, maxTokens: number) => Promise<CallResult>;
            if (activeProvider === 'openai') {
              const { createOpenAICallLLM } = await import('@/lib/llm/openai');
              callLLM = createOpenAICallLLM(activeKey, model) as typeof callLLM;
            } else {
              const { createGroqCallLLM } = await import('@/lib/llm/groq');
              callLLM = createGroqCallLLM(activeKey, model) as typeof callLLM;
            }

            let conversationMessages = [
              ...(body.history ?? []),
              { role: 'user' as const, content: body.query },
            ];
            let totalTokens = 0;

            for (let turn = 0; turn < MAX_TURNS; turn++) {
              const userContent = conversationMessages
                .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
                .join('\n\n');

              const llmResult = await callLLM(systemPrompt, userContent, 2048);
              totalTokens += llmResult.totalTokens ?? 0;
              const assistantText = llmResult.text;

              const visibleText = assistantText.replace(/<tool>[^]*?<\/tool>/g, '').trim();
              if (visibleText) emit('text', { text: visibleText });

              const toolCallRegex = /<tool>([^]*?)<\/tool>/g;
              const toolCalls: Array<{ raw: string; parsed: { tool: string; args: Record<string, unknown> } | null }> = [];
              let match;
              while ((match = toolCallRegex.exec(assistantText)) !== null) {
                try { toolCalls.push({ raw: match[1], parsed: JSON.parse(match[1]) }); }
                catch { toolCalls.push({ raw: match[1], parsed: null }); }
              }

              if (toolCalls.length === 0) {
                finalResponse = assistantText.replace(/<tool>[^]*?<\/tool>/g, '').trim();
                break;
              }

              let toolResultText = assistantText;
              for (const tc of toolCalls) {
                if (!tc.parsed) continue;
                emit('tool_call', { name: tc.parsed.tool, input: tc.parsed.args });
                const toolResult = await executeTool(
                  { name: tc.parsed.tool, args: tc.parsed.args },
                  { repoId: body.repoId }
                );
                toolCallLog.push({ name: tc.parsed.tool, input: tc.parsed.args, result: toolResult });
                emit('tool_result', { name: tc.parsed.tool, content: toolResult });
                const resultJson = JSON.stringify(toolResult.data ?? { error: toolResult.error }, null, 2);
                toolResultText = toolResultText.replace(
                  `<tool>${tc.raw}</tool>`,
                  `<tool>${tc.raw}</tool>\n<tool_result>${resultJson}</tool_result>`
                );
              }

              conversationMessages = [
                ...conversationMessages,
                { role: 'assistant', content: toolResultText },
                { role: 'user', content: 'Continue based on the tool results above.' },
              ];

              if (turn === MAX_TURNS - 1) {
                finalResponse = assistantText.replace(/<tool>[^]*?<\/tool>/g, '').trim();
              }
            }

            emit('done', { response: finalResponse, tokensUsed: totalTokens, toolCalls: toolCallLog });

            await updateAgentRun(run.id, {
              status: 'completed',
              response: finalResponse,
              messages: [
                ...allMessages,
                { role: 'user', content: body.query },
                { role: 'assistant', content: finalResponse },
              ],
              toolCalls: toolCallLog,
              tokensUsed: totalTokens,
              completedAt: new Date(),
            });
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
