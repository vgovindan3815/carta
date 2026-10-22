import { NextRequest } from 'next/server';

export const maxDuration = 120;

const MAX_TURNS = 5;

export async function POST(req: NextRequest) {
  const { FF_AGENTS_V2 } = await import('@/lib/flags');
  if (!FF_AGENTS_V2) {
    return Response.json({ error: 'Agents v2 not enabled' }, { status: 403 });
  }

  const body = await req.json();
  const { agentId, messages, projectId, repoId } = body as {
    agentId: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    projectId?: string;
    repoId?: string;
  };

  if (!agentId || !messages?.length) {
    return Response.json({ error: 'agentId and messages are required' }, { status: 400 });
  }

  const { getAgent } = await import('@/lib/agents/agents');
  const { toolRegistry } = await import('@/lib/agents/registry');
  const { executeTool } = await import('@/lib/agents/executor');
  const { createAgentRun, updateAgentRun } = await import('@/lib/db/queries');

  const agent = getAgent(agentId);
  if (!agent) return Response.json({ error: `Unknown agent: ${agentId}` }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });
  }

  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';

  const run = await createAgentRun({
    repoId,
    query: lastUserMessage.slice(0, 1000),
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
  });

  try {
    const availableTools = toolRegistry.filter(t => agent.tools.includes(t.name));
    const toolDescriptions = availableTools
      .map(t => `- ${t.name}: ${t.purpose}`)
      .join('\n');

    const systemPrompt = `${agent.systemPrompt}

Available tools (JSON format):
${toolDescriptions}

To call a tool, output EXACTLY on its own line: <tool>{"tool":"name","args":{...}}</tool>
After the tool result is injected, continue your response.
Never call the same tool with the same arguments twice.
When you have enough information to answer, stop calling tools and give your final answer.`;

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    let conversationMessages = [...messages];
    const allToolResults: Array<{ turn: number; call: unknown; result: unknown }> = [];
    let totalTokens = 0;
    let finalResponse = '';

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        messages: conversationMessages,
      });

      totalTokens += response.usage.input_tokens + response.usage.output_tokens;

      const assistantText = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as { type: 'text'; text: string }).text)
        .join('');

      // Parse tool calls (ES2017 compat — no /s flag)
      const toolCallRegex = /<tool>([^]*?)<\/tool>/g;
      const toolCalls: Array<{ raw: string; parsed: { tool: string; args: Record<string, unknown> } | null }> = [];
      let match;
      while ((match = toolCallRegex.exec(assistantText)) !== null) {
        try {
          const parsed = JSON.parse(match[1]);
          toolCalls.push({ raw: match[1], parsed });
        } catch {
          toolCalls.push({ raw: match[1], parsed: null });
        }
      }

      if (toolCalls.length === 0 || response.stop_reason === 'end_turn') {
        finalResponse = assistantText.replace(/<tool>[^]*?<\/tool>/g, '').trim();
        break;
      }

      let toolResultText = assistantText;
      for (const tc of toolCalls) {
        if (!tc.parsed) continue;
        const result = await executeTool(
          { name: tc.parsed.tool, args: tc.parsed.args },
          { projectId, repoId }
        );
        allToolResults.push({ turn, call: tc.parsed, result });

        const resultJson = JSON.stringify(result.data ?? { error: result.error }, null, 2);
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

    await updateAgentRun(run.id, {
      status: 'completed',
      response: finalResponse,
      toolCalls: allToolResults,
      tokensUsed: totalTokens,
    });

    return Response.json({
      agentId,
      runId: run.id,
      response: finalResponse,
      toolResults: allToolResults,
      totalTokens,
    });
  } catch (err) {
    await updateAgentRun(run.id, { status: 'failed', error: String(err) });
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
