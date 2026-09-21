import type { Tool } from '@anthropic-ai/sdk/resources/messages';

// Anthropic-format tool definitions
export const AGENT_TOOLS: Tool[] = [
  {
    name: 'get_program_info',
    description:
      'Get metadata, dependency graph summary, and analysis status for a COBOL/JCL program in the MAVEN registry.',
    input_schema: {
      type: 'object' as const,
      properties: {
        program_name: { type: 'string', description: 'Exact program name, e.g. COACTUPC' },
      },
      required: ['program_name'],
    },
  },
  {
    name: 'get_source_code',
    description:
      'Get the stored COBOL source code for a program. Returns null if source has not been captured.',
    input_schema: {
      type: 'object' as const,
      properties: {
        program_name: { type: 'string' },
      },
      required: ['program_name'],
    },
  },
  {
    name: 'get_business_rules',
    description:
      'Get the extracted business requirements (BRD sections and rules) for a program.',
    input_schema: {
      type: 'object' as const,
      properties: {
        program_name: { type: 'string' },
      },
      required: ['program_name'],
    },
  },
  {
    name: 'get_change_impact',
    description:
      'Get the change impact analysis (blast radius) for a program — which other programs are affected if this one changes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        program_name: { type: 'string' },
      },
      required: ['program_name'],
    },
  },
  {
    name: 'search_programs',
    description: 'Search the program registry by name prefix or domain keyword.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Name prefix or domain keyword, e.g. "COAC" or "user management"',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'trigger_analysis',
    description:
      'Trigger LLM analysis chains for a program. Use this when the user asks to analyze, refresh, or generate documentation for a program.',
    input_schema: {
      type: 'object' as const,
      properties: {
        program_name: { type: 'string' },
        chains: {
          type: 'array',
          items: { type: 'string', enum: ['rules', 'impact', 'spec'] },
          description:
            'Which chains to run. Omit or use all three for a full analysis.',
        },
      },
      required: ['program_name'],
    },
  },
];

// Tool executor — called by the agent runner
export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  const { getProgram, getProgramFullData, getProgramSource } = await import('../db/queries');

  if (name === 'get_program_info') {
    const pname = String(input.program_name ?? '');
    const data = await getProgramFullData(pname).catch(() => null);
    if (!data) {
      const prog = await getProgram(pname).catch(() => null);
      if (!prog) return JSON.stringify({ error: `Program ${pname} not found in registry` });
      return JSON.stringify({
        name: prog.name,
        language: prog.language,
        loc: prog.loc,
        analyzed: false,
      });
    }
    return JSON.stringify({
      name: data.name,
      language: data.language,
      loc: data.loc,
      domain: data.domain,
      desc: data.desc,
      nodes: data.graph?.nodes?.length ?? 0,
      edges: data.graph?.edges?.length ?? 0,
      businessRuleSections: data.businessRules?.length ?? 0,
      changeImpactItems: data.changeImpact?.items?.length ?? 0,
      hasModSpec: (data.spec?.sections?.length ?? 0) > 0,
      pipelineStatus: data.pipelineStatus,
    });
  }

  if (name === 'get_source_code') {
    const pname = String(input.program_name ?? '');
    const prog = await getProgram(pname).catch(() => null);
    if (!prog) return JSON.stringify({ error: `Program ${pname} not found` });
    const src = await getProgramSource(prog.id).catch(() => null);
    if (!src?.sourceText)
      return JSON.stringify({
        sourceText: null,
        message: 'Source not stored. Run analysis or connect GitHub.',
      });
    // Return first 4000 chars to keep context manageable
    return JSON.stringify({
      sourceText: src.sourceText.slice(0, 4000),
      loc: src.loc,
      truncated: src.sourceText.length > 4000,
    });
  }

  if (name === 'get_business_rules') {
    const pname = String(input.program_name ?? '');
    const data = await getProgramFullData(pname).catch(() => null);
    if (!data?.businessRules?.length)
      return JSON.stringify({
        error: `No business rules found for ${pname}. Run analysis first.`,
      });
    return JSON.stringify({ sections: data.businessRules });
  }

  if (name === 'get_change_impact') {
    const pname = String(input.program_name ?? '');
    const data = await getProgramFullData(pname).catch(() => null);
    if (!data?.changeImpact)
      return JSON.stringify({
        error: `No change impact found for ${pname}. Run analysis first.`,
      });
    return JSON.stringify({
      query: data.changeImpact.query,
      coverage: data.changeImpact.coverage,
      items: data.changeImpact.items,
    });
  }

  if (name === 'search_programs') {
    const q = String(input.query ?? '').toUpperCase();
    const { neon } = await import('@neondatabase/serverless');
    const { drizzle } = await import('drizzle-orm/neon-http');
    const { like, or } = await import('drizzle-orm');
    const schemaImport = await import('../db/schema');
    const db = drizzle(neon(process.env.DATABASE_URL!), { schema: schemaImport });
    const results = await db
      .select({
        name: schemaImport.programs.name,
        language: schemaImport.programs.language,
        loc: schemaImport.programs.loc,
        domain: schemaImport.programs.domain,
      })
      .from(schemaImport.programs)
      .where(
        or(
          like(schemaImport.programs.name, `%${q}%`),
          like(schemaImport.programs.domain, `%${q.toLowerCase()}%`)
        )
      )
      .limit(20);
    return JSON.stringify({ programs: results, count: results.length });
  }

  if (name === 'trigger_analysis') {
    const pname = String(input.program_name ?? '');
    const chains = (input.chains as string[] | undefined) ?? ['rules', 'impact', 'spec'];
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const res = await fetch(
      `${baseUrl}/api/programs/${encodeURIComponent(pname)}/refresh`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artifact: chains.length === 3 ? 'all' : chains[0] }),
      }
    ).catch(() => null);
    if (!res?.ok)
      return JSON.stringify({
        error: `Failed to trigger analysis for ${pname}`,
        status: res?.status,
      });
    const { jobId } = (await res.json()) as { jobId: string };
    return JSON.stringify({
      triggered: true,
      jobId,
      program: pname,
      chains,
      message: `Analysis started. Job ID: ${jobId}. Results will be available in the program hub once complete.`,
    });
  }

  return JSON.stringify({ error: `Unknown tool: ${name}` });
}
