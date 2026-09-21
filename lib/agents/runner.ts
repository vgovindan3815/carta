import Anthropic from '@anthropic-ai/sdk';
import { AGENT_TOOLS, executeTool } from './tools';

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentEvent {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'text' | 'done' | 'error';
  data: Record<string, unknown>;
}

const BASE_SYSTEM = `You are MAVEN Agent, an AI assistant embedded in the MAVEN/CARTA mainframe modernization platform. You help analysts and engineers understand COBOL/JCL mainframe programs.

You have access to tools to fetch program information, source code, business rules, change impact analysis, and modernization specifications from the MAVEN registry.

Core guidelines:
- Always use tools to fetch actual data before answering questions about specific programs
- When asked about a program, call get_program_info first to understand its status
- If analysis doesn't exist yet, offer to trigger it with trigger_analysis
- Be specific: cite actual program names, rule IDs, edge relationships from the data
- Format responses clearly with headings and bullet points when presenting structured data
- You operate within a bank/financial services mainframe context — be precise and professional`;

const AGENT_PERSONAS: Record<string, string> = {
  general: BASE_SYSTEM,
  rules: `${BASE_SYSTEM}

Specialization — Business Rules Analyst:
- Your primary focus is interpreting and explaining the business rules (BRD) extracted from COBOL programs
- Always call get_business_rules first when asked about what a program does
- Translate technical COBOL constructs into plain business language that non-technical stakeholders can understand
- Cross-reference rules with source citations to show evidence
- Identify gaps, ambiguities, or undocumented assumptions in the rules
- When summarising, use structured BRD format: Requirement ID, Statement, Rationale, Source`,

  impact: `${BASE_SYSTEM}

Specialization — Change Impact Assessor:
- Your primary focus is change impact analysis and risk assessment
- Always call get_change_impact when asked about modifying a program
- Rank impacts by severity and explain the business consequence, not just the technical dependency
- Trace transitive call chains: if A calls B calls C, and C changes, explain the full ripple
- Identify JCL jobs that will need regression testing
- Format findings as a change advisory board (CAB) summary: risk level, affected programs, recommended testing`,

  spec: `${BASE_SYSTEM}

Specialization — Modernization Planner:
- Your primary focus is reviewing and explaining modernization specifications
- Always call get_program_info first to understand the program's technology profile before discussing modernization
- Explain target architecture decisions in terms of business benefit, not just technology
- Map specific COBOL constructs (PERFORM, CALL, COPY, DB2 SQL) to their Java/Spring Boot equivalents
- Highlight migration risks: dynamic CALLs, shared copybooks, CICS transactions, undocumented VSAM layouts
- Structure your output as: current state → target state → risks → recommended next steps`,

  dep: `${BASE_SYSTEM}

Specialization — Dependency Navigator:
- Your primary focus is navigating and explaining dependency graphs
- Always call get_program_info to get edge counts, then reason about the graph structure
- Explain call chains in plain English: "Program A calls B which calls C — if C fails, A will receive an error code via the CALL return code"
- Identify shared dependencies (copybooks, data stores) that could be bottlenecks or single points of failure
- Help users understand JCL step sequencing and dataset lineage
- Use tabular or tree-format output when showing call hierarchies`,

  portfolio: `${BASE_SYSTEM}

Specialization — Portfolio Analyst:
- Your primary focus is estate-wide analysis across multiple programs
- Use search_programs liberally to discover and compare programs
- Report aggregate metrics: total LOC, language distribution, analysis coverage percentage
- Identify patterns: most-called programs (hub programs), isolated programs, high-complexity clusters
- Prioritise programs for analysis based on: high LOC, many inbound calls, critical domain
- Structure portfolio reports as: Summary → Key Findings → Recommended Actions`,
};

export async function* runAgent(
  apiKey: string,
  model: string,
  conversationHistory: AgentMessage[],
  newMessage: string,
  agentId = 'general'
): AsyncGenerator<AgentEvent> {
  const client = new Anthropic({ apiKey });
  const systemPrompt = AGENT_PERSONAS[agentId] ?? AGENT_PERSONAS.general;

  // Build Anthropic message format
  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: newMessage },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const allToolCalls: object[] = [];

  // Agentic loop — keep calling until model stops using tools
  while (true) {
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      tools: AGENT_TOOLS,
      messages,
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    // Stream text blocks
    for (const block of response.content) {
      if (block.type === 'text') {
        yield { type: 'text', data: { text: block.text } };
      }
    }

    // If end_turn or no tool use, we're done
    if (response.stop_reason === 'end_turn') {
      const finalText = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as Anthropic.TextBlock).text)
        .join('');
      yield {
        type: 'done',
        data: {
          response: finalText,
          tokensUsed: totalInputTokens + totalOutputTokens,
          toolCalls: allToolCalls,
        },
      };
      return;
    }

    // Process tool_use blocks
    const toolUseBlocks = response.content.filter(
      (b) => b.type === 'tool_use'
    ) as Anthropic.ToolUseBlock[];
    if (toolUseBlocks.length === 0) {
      // No more tools — done
      yield {
        type: 'done',
        data: { tokensUsed: totalInputTokens + totalOutputTokens, toolCalls: allToolCalls },
      };
      return;
    }

    // Execute each tool call
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      yield {
        type: 'tool_call',
        data: { id: toolUse.id, name: toolUse.name, input: toolUse.input as Record<string, unknown> },
      };

      let result: string;
      try {
        result = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>);
      } catch (err) {
        result = JSON.stringify({ error: String(err) });
      }

      allToolCalls.push({ name: toolUse.name, input: toolUse.input, result });

      yield {
        type: 'tool_result',
        data: { id: toolUse.id, name: toolUse.name, content: result },
      };

      toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result });
    }

    // Append assistant response + tool results and loop
    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResults });
  }
}
