export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  name: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export async function executeTool(
  call: ToolCall,
  context: { projectId?: string; repoId?: string }
): Promise<ToolResult> {
  try {
    switch (call.name) {
      case 'get_program': {
        const { getProgram } = await import('@/lib/db/queries');
        const prog = await getProgram(call.args.name as string);
        return { name: call.name, success: true, data: { program: prog } };
      }
      case 'list_programs': {
        const { listPrograms } = await import('@/lib/db/queries');
        const programs = await listPrograms(context.repoId);
        const filter = (call.args.filter as string | undefined)?.toLowerCase();
        const filtered = filter
          ? programs.filter((p: { name: string; desc?: string | null }) =>
              p.name.toLowerCase().includes(filter) || (p.desc ?? '').toLowerCase().includes(filter))
          : programs;
        return { name: call.name, success: true, data: { programs: filtered.slice(0, 50) } };
      }
      case 'search_programs': {
        const { listPrograms } = await import('@/lib/db/queries');
        const programs = await listPrograms(context.repoId);
        const q = (call.args.query as string).toLowerCase();
        const results = programs.filter((p: { name: string; desc?: string | null; domain?: string | null }) =>
          p.name.toLowerCase().includes(q) ||
          (p.desc ?? '').toLowerCase().includes(q) ||
          (p.domain ?? '').toLowerCase().includes(q)
        ).slice(0, 20);
        return { name: call.name, success: true, data: { results } };
      }
      case 'get_business_rules': {
        const { getProgram, getProgramFullData } = await import('@/lib/db/queries');
        const prog = await getProgram(call.args.programName as string);
        if (!prog) return { name: call.name, success: false, error: 'Program not found' };
        const data = await getProgramFullData(prog.id);
        return { name: call.name, success: true, data: { rules: data?.businessRules ?? [] } };
      }
      default:
        return { name: call.name, success: false, error: `Tool ${call.name} not implemented` };
    }
  } catch (err) {
    return { name: call.name, success: false, error: String(err) };
  }
}
