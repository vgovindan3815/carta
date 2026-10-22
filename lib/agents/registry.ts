export type ToolRole = 'navigator' | 'analyst' | 'impact' | 'documentation';
export type ToolClass = 'read' | 'write' | 'search' | 'generate' | 'validate';

export interface ToolDefinition {
  name: string;
  purpose: string;
  role: ToolRole[];
  class: ToolClass;
  llmRequired: boolean;
  projectScoped: boolean;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

export const toolRegistry: ToolDefinition[] = [
  {
    name: 'get_program',
    purpose: 'Retrieve program metadata, dependency graph, and source location',
    role: ['navigator', 'analyst', 'impact', 'documentation'],
    class: 'read',
    llmRequired: false,
    projectScoped: true,
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    outputSchema: { type: 'object', properties: { program: { type: 'object' }, graph: { type: 'object' } } },
  },
  {
    name: 'list_programs',
    purpose: 'List all programs in the project with basic metadata',
    role: ['navigator', 'analyst', 'impact', 'documentation'],
    class: 'read',
    llmRequired: false,
    projectScoped: true,
    inputSchema: { type: 'object', properties: { filter: { type: 'string' } } },
    outputSchema: { type: 'object', properties: { programs: { type: 'array' } } },
  },
  {
    name: 'get_call_chain',
    purpose: 'Get the call chain for a program — what it calls and what calls it',
    role: ['analyst', 'impact'],
    class: 'search',
    llmRequired: false,
    projectScoped: true,
    inputSchema: { type: 'object', properties: { name: { type: 'string' }, depth: { type: 'number' } }, required: ['name'] },
    outputSchema: { type: 'object', properties: { callers: { type: 'array' }, callees: { type: 'array' } } },
  },
  {
    name: 'search_programs',
    purpose: 'Full-text search across program names, descriptions, and business rules',
    role: ['navigator', 'analyst', 'impact', 'documentation'],
    class: 'search',
    llmRequired: false,
    projectScoped: true,
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    outputSchema: { type: 'object', properties: { results: { type: 'array' } } },
  },
  {
    name: 'get_impact_analysis',
    purpose: 'Analyze the blast radius if a program or data structure changes',
    role: ['impact'],
    class: 'search',
    llmRequired: false,
    projectScoped: true,
    inputSchema: { type: 'object', properties: { name: { type: 'string' }, changeType: { type: 'string' } }, required: ['name'] },
    outputSchema: { type: 'object', properties: { impacted: { type: 'array' }, severity: { type: 'string' } } },
  },
  {
    name: 'get_business_rules',
    purpose: 'Retrieve AI-generated business rules for a program',
    role: ['analyst', 'documentation'],
    class: 'read',
    llmRequired: false,
    projectScoped: true,
    inputSchema: { type: 'object', properties: { programName: { type: 'string' } }, required: ['programName'] },
    outputSchema: { type: 'object', properties: { rules: { type: 'array' } } },
  },
  {
    name: 'generate_documentation',
    purpose: 'Generate or regenerate documentation for a program or scope',
    role: ['documentation'],
    class: 'generate',
    llmRequired: true,
    projectScoped: true,
    inputSchema: { type: 'object', properties: { targetId: { type: 'string' }, docKind: { type: 'string' } }, required: ['targetId', 'docKind'] },
    outputSchema: { type: 'object', properties: { documentId: { type: 'string' } } },
  },
];

export function getToolsForRole(role: ToolRole): ToolDefinition[] {
  return toolRegistry.filter(t => t.role.includes(role));
}

export function getTool(name: string): ToolDefinition | undefined {
  return toolRegistry.find(t => t.name === name);
}
