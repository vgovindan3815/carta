import Groq from 'groq-sdk';
import type {
  SseLogLine,
  ParsedCobolProgram,
  BusinessRulesSection,
  BusinessRule,
  ChangeImpactItem,
  SpecSection,
  GraphNode,
  GraphEdge,
  CircularLayout,
} from './parser/types';

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You are MAVEN, a COBOL analysis and modernization AI embedded in the MAVEN/CARTA platform.

Rules you MUST follow:
1. Every factual claim about program behavior MUST cite a dependency graph edge in the format [edge: FROM → TO (type)].
2. Do NOT invent edges not present in the provided graph JSON. Only cite edges that exist in the data.
3. Be specific about COBOL field names, copybooks, file names, and SQL table names that appear in the source code.
4. Use precise COBOL terminology: WORKING-STORAGE, LINKAGE SECTION, FILE SECTION, PERFORM, CALL, EXEC SQL, EXEC CICS.
5. Severity ratings must be justified by the edge type: call/cics edges = critical or high; data edges = medium; dyn edges = high (unknown target).
6. Output ONLY inside the <output>...</output> XML tags with valid JSON inside.
7. Do not add any commentary outside the <output> block.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function logLine(
  lv: SseLogLine['lv'],
  t: string,
  d = 0
): SseLogLine {
  return { lv, t, d };
}

interface StreamResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Collects the full streamed text from a Groq chat completion stream.
 * Captures token usage from the final chunk (requires stream_options.include_usage).
 */
async function collectStream(
  stream: AsyncIterable<Groq.Chat.Completions.ChatCompletionChunk>,
  onChunk: (chunk: string, totalSoFar: number) => void
): Promise<StreamResult> {
  let full = '';
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? '';
    if (text) {
      full += text;
      onChunk(text, full.length);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = (chunk as any).usage;
    if (u) {
      promptTokens = u.prompt_tokens ?? 0;
      completionTokens = u.completion_tokens ?? 0;
      totalTokens = u.total_tokens ?? 0;
    }
  }
  return { text: full, promptTokens, completionTokens, totalTokens };
}

/**
 * Extracts JSON from inside <output>...</output> tags.
 * Falls back to attempting JSON.parse on the whole string.
 */
function extractJson<T>(raw: string): T {
  const match = /<output>([\s\S]*?)<\/output>/i.exec(raw);
  const jsonStr = match ? match[1].trim() : raw.trim();
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    // Try to find a JSON array or object within the text
    const arrMatch = /(\[[\s\S]*\]|\{[\s\S]*\})/.exec(jsonStr);
    if (arrMatch) return JSON.parse(arrMatch[1]) as T;
    throw new Error(`Failed to extract JSON from LLM response. Raw: ${raw.slice(0, 300)}`);
  }
}

/** Build a compact graph summary string to include in prompts. */
function graphSummary(program: ParsedCobolProgram): string {
  const { graph } = program;
  const edgeList = graph.edges
    .map((e) => `  ${e.from} → ${e.to} (${e.type}${e.confidence && e.confidence < 100 ? `, confidence ${e.confidence}%` : ''})`)
    .join('\n');
  return `Program: ${program.name}
Language: ${program.language}
LOC: ${program.loc}
Coverage: ${graph.coveragePct}%
Nodes (${graph.nodes.length}): ${graph.nodes.map((n) => `${n.id}[${n.type}]`).join(', ')}
Edges (${graph.edges.length}):
${edgeList || '  (none)'}`;
}

// ---------------------------------------------------------------------------
// Chain 1: Business Rules
// ---------------------------------------------------------------------------

export async function* generateBusinessRules(
  program: ParsedCobolProgram
): AsyncGenerator<SseLogLine | { done: true; sections: BusinessRulesSection[]; tokensUsed: number }> {
  yield logLine('LLM', `Sending <span class="hl">${program.name}</span> source + graph to Groq…`, 0);

  const graphSummaryText = graphSummary(program);
  const sourceExcerpt = program.source.slice(0, 12000); // cap to avoid token overflow

  const prompt = `Analyze the COBOL program below and extract its business rules.

## Dependency Graph
\`\`\`
${graphSummaryText}
\`\`\`

## COBOL Source (first 12,000 characters)
\`\`\`cobol
${sourceExcerpt}
\`\`\`
${program.linkageSection ? `\n## LINKAGE SECTION\n\`\`\`cobol\n${program.linkageSection}\n\`\`\`` : ''}

## Task
Extract business rules grouped into logical sections. For each rule write a detailed explanation (2–4 sentences):
- Start with what the business outcome is (not a code description)
- Include specific COBOL field names, DB2 table names, file names, and any key values (e.g. flag values, status codes) found in the source
- Explain the conditions, logic, or sequence involved so a non-programmer can understand the rule
- Cite at least one graph edge as evidence using format [edge: FROM → TO (type)]
- Use <strong> tags around important field names and program names for emphasis

Produce a JSON array with exactly these sections (include all that apply, skip empty ones):
1. "Input Processing" — how data enters the program
2. "Core Business Logic" — calculations, decisions, validations
3. "Data Persistence" — database reads/writes, file I/O
4. "External Integrations" — calls to other programs, CICS interactions
5. "Error Handling" — error conditions, abend handling, rollback

Output schema:
\`\`\`json
[
  {
    "section": "section name",
    "rules": [
      {
        "text": "Business rule statement referencing specific COBOL fields/tables",
        "citations": [
          { "label": "Edge label", "edge": "FROM → TO (type)" }
        ]
      }
    ]
  }
]
\`\`\`

<output>
[your JSON here]
</output>`;

  let lastLogAt = 0;

  yield logLine('LLM', 'Streaming business rules from model…', 100);

  const stream = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    stream: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stream_options: { include_usage: true },
  } as any) as unknown as AsyncIterable<Groq.Chat.Completions.ChatCompletionChunk>;

  const { text: raw, promptTokens, completionTokens, totalTokens } = await collectStream(stream, (_chunk, total) => {
    if (total - lastLogAt > 500) {
      lastLogAt = total;
    }
  });

  yield logLine('LLM', `Received ${raw.length} chars from model. Parsing…`, 50);
  yield logLine('INFO', `Tokens — prompt: <span class="hl">${promptTokens.toLocaleString()}</span> · completion: <span class="hl">${completionTokens.toLocaleString()}</span> · total: <span class="hl">${totalTokens.toLocaleString()}</span>`, 0);

  let sections: BusinessRulesSection[] = [];
  try {
    sections = extractJson<BusinessRulesSection[]>(raw);
    // Validate structure
    if (!Array.isArray(sections)) throw new Error('Expected array');
    sections = sections.filter(
      (s) => s && typeof s.section === 'string' && Array.isArray(s.rules)
    );
  } catch (err) {
    yield logLine('WARN', `JSON parse failed — returning raw sections: ${String(err)}`, 0);
    sections = [
      {
        section: 'Extracted Rules',
        rules: [
          {
            text: raw.replace(/<[^>]+>/g, '').slice(0, 500),
            citations: [],
          },
        ],
      },
    ];
  }

  const totalRules = sections.reduce((sum, s) => sum + (s.rules?.length ?? 0), 0);
  yield logLine(
    'DONE',
    `Business rules complete — <span class="hl">${sections.length} sections</span>, ${totalRules} rules`,
    0
  );

  yield { done: true, sections, tokensUsed: totalTokens };
}

// ---------------------------------------------------------------------------
// Chain 2: Change Impact
// ---------------------------------------------------------------------------

export async function* generateChangeImpact(
  program: ParsedCobolProgram,
  allPrograms: string[]
): AsyncGenerator<
  | SseLogLine
  | {
      done: true;
      tokensUsed: number;
      impact: {
        items: ChangeImpactItem[];
        coveragePct: number;
        coverageNote: string;
      };
    }
> {
  yield logLine(
    'LLM',
    `Analyzing change impact for <span class="hl">${program.name}</span> across ${allPrograms.length} programs in repo…`,
    0
  );

  const graphSummaryText = graphSummary(program);
  const otherPrograms = allPrograms
    .filter((p) => p !== program.name)
    .slice(0, 50)
    .join(', ');

  const prompt = `You are analyzing the blast radius of modifying COBOL program ${program.name}.

## Dependency Graph for ${program.name}
\`\`\`
${graphSummaryText}
\`\`\`

## Other Programs in the Repository
${otherPrograms || '(none listed)'}

## Task
Determine what would be impacted if ${program.name} were modified. For each affected program or data resource:
- Assess severity: "critical" (direct synchronous call, CICS link), "high" (dynamic call, data dependency with writes), "medium" (read-only data dependency), "unknown" (unresolved dynamic call)
- State the precise relationship using the edge type
- Reference the specific edge that creates the dependency

Output JSON with this schema:
\`\`\`json
{
  "items": [
    {
      "prog": "affected program or resource name",
      "rel": "relationship description (e.g., 'Called synchronously', 'Reads from shared table')",
      "severity": "critical|high|medium|unknown",
      "reason": "Specific reason this would be impacted, naming COBOL fields or SQL tables",
      "edge": "FROM → TO (type)"
    }
  ],
  "coveragePct": 85,
  "coverageNote": "Explanation of any gaps (e.g., dynamic calls with unresolved targets)"
}
\`\`\`

Rules:
- Include ${program.name} itself as the first item with severity "critical" (the program being changed)
- For each graph edge, determine if the target would be impacted by an interface or behavioral change
- Dynamic calls (type: dyn) should be listed as "unknown" severity with a note about unresolvability
- Do not invent programs not in the graph or the repository list

<output>
{ your JSON here }
</output>`;

  yield logLine('LLM', 'Grounding change impact against graph edges…', 100);

  const stream = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 3000,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    stream: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stream_options: { include_usage: true },
  } as any) as unknown as AsyncIterable<Groq.Chat.Completions.ChatCompletionChunk>;

  const { text: raw, promptTokens, completionTokens, totalTokens } = await collectStream(stream, () => {});

  yield logLine('LLM', `Parsing change impact response (${raw.length} chars)…`, 50);
  yield logLine('INFO', `Tokens — prompt: <span class="hl">${promptTokens.toLocaleString()}</span> · completion: <span class="hl">${completionTokens.toLocaleString()}</span> · total: <span class="hl">${totalTokens.toLocaleString()}</span>`, 0);

  let result: {
    items: ChangeImpactItem[];
    coveragePct: number;
    coverageNote: string;
  } = {
    items: [],
    coveragePct: program.graph.coveragePct,
    coverageNote: '',
  };

  try {
    const parsed = extractJson<typeof result>(raw);
    result = {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      coveragePct: typeof parsed.coveragePct === 'number' ? parsed.coveragePct : program.graph.coveragePct,
      coverageNote: parsed.coverageNote ?? '',
    };
  } catch (err) {
    yield logLine('WARN', `Change impact JSON parse failed: ${String(err)}`, 0);
    // Best-effort fallback: create one item per graph edge
    result.items = program.graph.edges.map((e) => ({
      prog: e.to,
      rel: `${e.type} dependency`,
      severity: e.type === 'call' ? 'critical' : e.type === 'cics' ? 'critical' : e.type === 'dyn' ? 'unknown' : 'medium',
      reason: `Direct ${e.type} dependency from ${e.from}`,
      edge: `${e.from} → ${e.to} (${e.type})`,
    }));
    result.coverageNote = 'Impact generated from graph edges (LLM parse failed)';
  }

  yield logLine(
    'DONE',
    `Change impact complete — <span class="hl">${result.items.length} affected components</span>, coverage ${result.coveragePct}%`,
    0
  );

  yield { done: true, impact: result, tokensUsed: totalTokens };
}

// ---------------------------------------------------------------------------
// Chain 3: Modernization Spec
// ---------------------------------------------------------------------------

export async function* generateModSpec(
  program: ParsedCobolProgram,
  businessRules: BusinessRulesSection[]
): AsyncGenerator<SseLogLine | { done: true; sections: SpecSection[]; tokensUsed: number }> {
  yield logLine(
    'LLM',
    `Building modernization spec for <span class="hl">${program.name}</span>…`,
    0
  );

  const graphSummaryText = graphSummary(program);
  const rulesText = businessRules
    .map((s) => `### ${s.section}\n${s.rules.map((r) => `- ${r.text}`).join('\n')}`)
    .join('\n\n');
  const sourceExcerpt = program.source.slice(0, 8000);

  const prompt = `Generate a detailed modernization specification for the COBOL program ${program.name}.

## Dependency Graph
\`\`\`
${graphSummaryText}
\`\`\`

## Extracted Business Rules
${rulesText || '(none extracted)'}

## COBOL Source Excerpt
\`\`\`cobol
${sourceExcerpt}
\`\`\`
${program.linkageSection ? `\n## LINKAGE SECTION\n\`\`\`cobol\n${program.linkageSection}\n\`\`\`` : ''}

## Task
Produce a modernization specification document with these exact sections in order:

1. **Executive Summary** — What this program does, its business criticality, modernization priority
2. **Current Architecture Analysis** — COBOL structure, data flows, external integrations, technical debt indicators
3. **Modernization Strategy** — Recommended target architecture (Java microservice / Spring Boot / Node.js), strangler-fig or big-bang approach, rationale
4. **Interface Contracts** — Input/output parameters from LINKAGE SECTION, API endpoint design for the modern equivalent, JSON schemas
5. **Data Layer Migration** — SQL tables and file-based data sources, ORM mapping suggestions, transaction boundaries
6. **Migration Roadmap** — Phased plan with milestones, estimated complexity (LOC-based), dependencies between phases
7. **Risk Assessment** — Dynamic calls, undocumented CICS transactions, LOC-based effort estimate, regression test strategy

For each section, write the content as HTML (use <p>, <ul>, <li>, <table>, <strong>, <code> tags). Reference specific COBOL fields, copybooks, and edge citations [edge: FROM → TO (type)] throughout.

Output JSON array:
\`\`\`json
[
  {
    "num": 1,
    "title": "Executive Summary",
    "content": "<p>HTML content...</p>"
  },
  ...
]
\`\`\`

<output>
[your JSON here]
</output>`;

  yield logLine('LLM', 'Generating modernization specification — section 1/7…', 100);

  const stream = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 6000,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    stream: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stream_options: { include_usage: true },
  } as any) as unknown as AsyncIterable<Groq.Chat.Completions.ChatCompletionChunk>;

  let sectionsLogged = 1;
  let lastTotal = 0;

  const { text: raw, promptTokens, completionTokens, totalTokens } = await collectStream(stream, (_chunk, total) => {
    const approxSection = Math.min(7, Math.floor(total / 850) + 1);
    if (approxSection > sectionsLogged && total - lastTotal > 600) {
      sectionsLogged = approxSection;
      lastTotal = total;
    }
  });

  yield logLine('LLM', `Parsing specification (${raw.length} chars)…`, 50);
  yield logLine('INFO', `Tokens — prompt: <span class="hl">${promptTokens.toLocaleString()}</span> · completion: <span class="hl">${completionTokens.toLocaleString()}</span> · total: <span class="hl">${totalTokens.toLocaleString()}</span>`, 0);

  let sections: SpecSection[] = [];

  try {
    sections = extractJson<SpecSection[]>(raw);
    if (!Array.isArray(sections)) throw new Error('Expected array');
    sections = sections
      .filter((s) => s && typeof s.num === 'number' && typeof s.title === 'string')
      .map((s) => ({
        num: s.num,
        title: s.title,
        content: s.content ?? '',
      }));
  } catch (err) {
    yield logLine('WARN', `Spec JSON parse failed: ${String(err)}`, 0);
    // Fallback: wrap the raw text as a single section
    sections = [
      {
        num: 1,
        title: 'Modernization Specification',
        content: `<p>${raw.replace(/<[^>]+>/g, '').slice(0, 2000)}</p>`,
      },
    ];
  }

  yield logLine(
    'DONE',
    `Modernization spec complete — <span class="hl">${sections.length} sections</span>`,
    0
  );

  yield { done: true, sections, tokensUsed: totalTokens };
}

// ---------------------------------------------------------------------------
// Layout helper — assigns cx/cy/r positions for circular graph rendering
// ---------------------------------------------------------------------------

export function layoutCircular(
  nodes: Pick<GraphNode, 'id' | 'label' | 'sub' | 'type'>[],
  edges: GraphEdge[],
  W = 580,
  H = 468
): CircularLayout {
  const hero = nodes.find((n) => n.type === 'hero') ?? nodes[0];
  const progs = nodes.filter((n) => n.type === 'prog' || n.type === 'asm');
  const datas = nodes.filter((n) => n.type === 'data');

  const cx = W / 2;
  const cy = H / 2 - 10;

  const laid: GraphNode[] = [];

  if (hero) laid.push({ ...hero, cx, cy, r: 44 });

  const innerR = Math.min(155, (W / 2) - 65);
  progs.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(progs.length, 1) - Math.PI / 2;
    laid.push({
      ...n,
      cx: Math.round(cx + innerR * Math.cos(angle)),
      cy: Math.round(cy + innerR * Math.sin(angle)),
      r: n.type === 'asm' ? 23 : 30,
    });
  });

  const outerR = Math.min(230, (W / 2) - 30);
  datas.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(datas.length, 1) - Math.PI / 6;
    laid.push({
      ...n,
      cx: Math.round(cx + outerR * Math.cos(angle)),
      cy: Math.round(cy + outerR * Math.sin(angle)),
      r: 24,
    });
  });

  return { w: W, h: H, nodes: laid, edges };
}

// ---------------------------------------------------------------------------
// Chain 0: LLM Dependency Graph (used when no CAST reports available)
// ---------------------------------------------------------------------------

export async function* generateDepGraph(
  programName: string,
  source: string
): AsyncGenerator<
  SseLogLine | { done: true; nodes: GraphNode[]; edges: GraphEdge[]; coveragePct: number; tokensUsed: number }
> {
  yield logLine('LLM', `No CAST reports — running <span class="hl">LLM dependency analysis</span> on ${programName}…`, 0);

  const sourceExcerpt = source.slice(0, 14000);

  const prompt = `Analyze the COBOL source below and extract a complete dependency graph.

## COBOL Source: ${programName}
\`\`\`cobol
${sourceExcerpt}
\`\`\`

## Task
Extract all dependencies from the source code:
- CALL statements → type "call" (static literal) or "dyn" (variable/data-name)
- EXEC SQL ... FROM TABLE → type "data"
- EXEC CICS LINK/XCTL PROGRAM → type "cics"
- READ/WRITE file-name → type "data"
- The program itself is the "hero" node

For each node provide:
- "id": program or table name (uppercase, no spaces)
- "label": same as id
- "sub": brief description (e.g., "DB2 table", "batch module", "CICS transaction")
- "type": "hero" | "prog" | "data" | "asm"

For each edge:
- "from": source node id
- "to": target node id
- "type": "call" | "data" | "cics" | "dyn"
- "label": short description (e.g., "CALL — posting", "EXEC SQL SELECT")
- "confidence": 100 for static, 71 for dynamic calls

Estimate coveragePct (0–100): how confident you are the graph is complete based on the source clarity.

Output JSON:
\`\`\`json
{
  "nodes": [...],
  "edges": [...],
  "coveragePct": 85
}
\`\`\`

<output>
{ your JSON here }
</output>`;

  yield logLine('LLM', 'Extracting CALL, SQL, CICS, and data edges from source…', 200);

  const stream = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 3000,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    stream: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stream_options: { include_usage: true },
  } as any) as unknown as AsyncIterable<Groq.Chat.Completions.ChatCompletionChunk>;

  const { text: raw, promptTokens, completionTokens, totalTokens } = await collectStream(stream, () => {});

  yield logLine('LLM', `Parsing LLM graph response (${raw.length} chars)…`, 50);
  yield logLine('INFO', `Tokens — prompt: <span class="hl">${promptTokens.toLocaleString()}</span> · completion: <span class="hl">${completionTokens.toLocaleString()}</span> · total: <span class="hl">${totalTokens.toLocaleString()}</span>`, 0);

  let nodes: GraphNode[] = [{ id: programName, label: programName, sub: 'in focus', type: 'hero' }];
  let edges: GraphEdge[] = [];
  let coveragePct = 70;

  try {
    const parsed = extractJson<{ nodes: GraphNode[]; edges: GraphEdge[]; coveragePct: number }>(raw);
    if (Array.isArray(parsed.nodes) && parsed.nodes.length > 0) nodes = parsed.nodes;
    if (Array.isArray(parsed.edges)) edges = parsed.edges;
    if (typeof parsed.coveragePct === 'number') coveragePct = parsed.coveragePct;
  } catch (err) {
    yield logLine('WARN', `LLM graph parse failed — using minimal graph: ${String(err)}`, 0);
  }

  yield logLine(
    'DONE',
    `LLM dependency graph — <span class="hl">${nodes.length} nodes · ${edges.length} edges</span> · coverage ~${coveragePct}%`,
    0
  );

  yield { done: true, nodes, edges, coveragePct, tokensUsed: totalTokens };
}
