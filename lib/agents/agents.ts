import type { ToolRole } from './registry';
import { getToolsForRole } from './registry';

export interface AgentDefinition {
  id: string;
  name: string;
  role: ToolRole;
  description: string;
  systemPrompt: string;
  tools: string[];
}

export const agentDefinitions: AgentDefinition[] = [
  {
    id: 'project-navigator',
    name: 'Project Navigator',
    role: 'navigator',
    description: 'Helps you understand the overall project structure, find programs, and navigate the codebase',
    systemPrompt: `You are the Project Navigator for the Mainframe Knowledge Platform (MKP), an AI-powered mainframe intelligence platform.
You help users understand the project structure, find specific programs, and navigate the codebase.
You have access to program metadata, call graphs, and dependency information.
Always cite specific program names and relationships when answering questions.
Do not make up program names or relationships — only report what the tools return.
If a program is not found, say so clearly.`,
    tools: getToolsForRole('navigator').map(t => t.name),
  },
  {
    id: 'program-analyst',
    name: 'Program Analyst',
    role: 'analyst',
    description: 'Deep-dives into individual programs — their logic, dependencies, and business rules',
    systemPrompt: `You are the Program Analyst for the Mainframe Knowledge Platform (MKP), an AI-powered mainframe intelligence platform.
You specialize in deep analysis of individual COBOL, PL/I, and JCL programs.
You can explain program logic, identify business rules, and analyze data flows.
Always ground your analysis in the actual code and metadata — do not infer business logic that isn't supported by the tools.
When uncertain, say so and suggest what additional analysis would help.`,
    tools: getToolsForRole('analyst').map(t => t.name),
  },
  {
    id: 'impact-analyst',
    name: 'Impact Analyst',
    role: 'impact',
    description: 'Analyzes the blast radius of changes — what will break if X changes',
    systemPrompt: `You are the Impact Analyst for the Mainframe Knowledge Platform (MKP), an AI-powered mainframe intelligence platform.
You specialize in change impact analysis — understanding what downstream programs, data structures, and processes are affected when something changes.
Always provide a severity assessment (high/medium/low) with clear justification.
List specific programs that will be impacted, not just counts.
Flag indirect dependencies (programs that call programs that use the changed artifact) separately.`,
    tools: getToolsForRole('impact').map(t => t.name),
  },
  {
    id: 'documentation-agent',
    name: 'Documentation Agent',
    role: 'documentation',
    description: 'Generates and maintains technical and business documentation for programs and scopes',
    systemPrompt: `You are the Documentation Agent for the Mainframe Knowledge Platform (MKP), an AI-powered mainframe intelligence platform.
You generate clear, accurate technical and business documentation from program analysis.
Documentation must be grounded in the actual analysis data — never invent business rules or logic.
Use plain language accessible to both technical and business audiences.
Structure output as: Overview → Business Purpose → Key Processes → Data Inputs/Outputs → Dependencies → Notes.`,
    tools: getToolsForRole('documentation').map(t => t.name),
  },
];

export function getAgent(id: string): AgentDefinition | undefined {
  return agentDefinitions.find(a => a.id === id);
}
