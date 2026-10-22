import { NextRequest } from 'next/server';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { FF_AGENTS_V2 } = await import('@/lib/flags');
  if (!FF_AGENTS_V2) {
    return Response.json({ error: 'Agents v2 not enabled' }, { status: 403 });
  }

  const body = await req.json();
  const { agentId, messages, projectId, repoId } = body as {
    agentId: string;
    messages: Array<{ role: string; content: string }>;
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

  const hasLLM = !!(process.env.ANTHROPIC_API_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY);
  if (!hasLLM) return Response.json({ error: 'No LLM provider configured' }, { status: 503 });

  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
  const provider = process.env.ANTHROPIC_API_KEY ? 'anthropic'
    : process.env.GROQ_API_KEY ? 'groq'
    : 'openai';

  // createAgentRun requires query, provider, model (existing schema)
  const run = await createAgentRun({
    repoId: repoId,
    query: lastUserMessage.slice(0, 1000),
    provider,
    model: provider === 'anthropic' ? 'claude-sonnet-4-6' : provider === 'groq' ? 'llama3-70b-8192' : 'gpt-4o',
  });

  try {
    const availableTools = toolRegistry.filter(t => agent.tools.includes(t.name));
    const toolDescriptions = availableTools
      .map(t => `- ${t.name}: ${t.purpose}`)
      .join('\n');

    const systemPrompt = `${agent.systemPrompt}

Available tools (call with JSON: {"tool": "name", "args": {...}}):
${toolDescriptions}

When using a tool, output EXACTLY: <tool>{"tool":"toolname","args":{...}}</tool>
After getting tool results, continue your response naturally.`;

    let llmResponse = '';

    if (provider === 'anthropic') {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: systemPrompt,
        messages: messages as Array<{ role: 'user' | 'assistant'; content: string }>,
      });
      llmResponse = response.content[0].type === 'text' ? response.content[0].text : '';
    }

    // Parse and execute tool calls embedded in response
    // Use [^]* instead of dotall flag for ES2017 compat
    const toolCallRegex = /<tool>([^]*?)<\/tool>/g;
    const toolResults: Array<{ call: unknown; result: unknown }> = [];
    let match;
    while ((match = toolCallRegex.exec(llmResponse)) !== null) {
      try {
        const call = JSON.parse(match[1]);
        const result = await executeTool({ name: call.tool, args: call.args ?? {} }, { projectId, repoId });
        toolResults.push({ call, result });
      } catch { /* skip malformed tool calls */ }
    }

    const cleanResponse = llmResponse.replace(/<tool>[^]*?<\/tool>/g, '').trim();

    await updateAgentRun(run.id, {
      status: 'completed',
      response: cleanResponse,
      toolCalls: toolResults,
    });

    return Response.json({
      agentId,
      runId: run.id,
      response: cleanResponse,
      toolResults,
    });
  } catch (err) {
    await updateAgentRun(run.id, { status: 'failed', error: String(err) });
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
