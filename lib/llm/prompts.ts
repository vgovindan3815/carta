import type { ParsedCobolProgram, BusinessRulesSection } from '../parser/types';

export const SYSTEM_PROMPT = `You are MAVEN, a COBOL analysis and modernization AI embedded in the MAVEN/CARTA platform.

Rules you MUST follow:
1. Every factual claim about program behavior MUST cite a dependency graph edge in the format [edge: FROM → TO (type)].
2. Do NOT invent edges not present in the provided graph JSON. Only cite edges that exist in the data.
3. Be specific about COBOL field names, copybooks, file names, and SQL table names that appear in the source code.
4. Use precise COBOL terminology: WORKING-STORAGE, LINKAGE SECTION, FILE SECTION, PERFORM, CALL, EXEC SQL, EXEC CICS.
5. Severity ratings must be justified by the edge type: call/cics edges = critical or high; data edges = medium; dyn edges = high (unknown target); copy edges = low (structural dependency).
6. Output ONLY inside the <output>...</output> XML tags with valid JSON inside.
7. Do not add any commentary outside the <output> block.
8. When copybook context is provided, reference specific field names (with their PIC clauses) to make rules concrete and precise.
9. When JCL context is provided, include job scheduling and execution dependencies — which jobs invoke this program, what datasets they pass, and step sequencing.
10. When dependent module context is provided, reason across module boundaries — the modernization specification covers the portfolio, not just the focal program.`;

export function graphSummary(program: ParsedCobolProgram): string {
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
// Chain 0 — Dependency Graph (LLM fallback when no CAST/parser graph available)
// ---------------------------------------------------------------------------

export function depGraphPrompt(programName: string, source: string): string {
  return `Analyze the source below and extract a complete dependency graph.

## Source: ${programName}
\`\`\`
${source}
\`\`\`

## Task
Determine the source type and extract all dependencies:

**If COBOL source** (contains IDENTIFICATION DIVISION or PROGRAM-ID):
- CALL 'LITERAL' → type "call", confidence 100
- CALL data-name → type "dyn", confidence 71
- EXEC SQL … FROM/INTO/UPDATE/JOIN table → type "data"
- EXEC CICS LINK/XCTL PROGRAM(name) → type "call"
- EXEC CICS FILE(name) → type "cics"
- READ/WRITE/OPEN filename → type "data"
- COPY copybook-name → type "copy", node type "cpy"

**If JCL/PROC source** (contains //jobname JOB or //step EXEC PGM=):
- EXEC PGM=progname → type "call"
- EXEC PROC=procname → type "proc"
- DD DSN=dataset → type "data"

For each node:
- "id": name (uppercase, no spaces)
- "label": same as id
- "sub": e.g. "DB2 Table", "Called Program", "Copybook", "JCL Proc", "Dataset"
- "type": "hero" | "prog" | "data" | "asm" | "jcl" | "proc" | "cpy"

For each edge:
- "from": source node id
- "to": target node id
- "type": "call" | "data" | "cics" | "dyn" | "jcl" | "proc" | "copy"
- "label": short description
- "confidence": 100 for static/deterministic, 71 for dynamic, 85 for JCL referback

Estimate coveragePct (0–100): confidence the graph is complete.

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
}

// ---------------------------------------------------------------------------
// Chain 1 — Business Rules (full source, copybook + glossary context)
// ---------------------------------------------------------------------------

export function businessRulesPrompt(
  program: ParsedCobolProgram,
  copybookContext?: string,
  glossaryContext?: string,
  jclCallers?: string[]
): string {
  const graphText = graphSummary(program);

  const copybookSection = copybookContext
    ? `\n## Copybook Field Definitions\n\`\`\`\n${copybookContext}\n\`\`\``
    : '';

  const glossarySection = glossaryContext
    ? `\n## Domain Glossary\n\`\`\`\n${glossaryContext}\n\`\`\``
    : '';

  const jclSection = jclCallers?.length
    ? `\n## JCL Jobs That Invoke This Program\n${jclCallers.map((j) => `- ${j}`).join('\n')}`
    : '';

  return `Analyze the COBOL program below and extract its complete business rules.

## Dependency Graph
\`\`\`
${graphText}
\`\`\`
${copybookSection}
${glossarySection}
${jclSection}

## Full COBOL Source (${program.loc.toLocaleString()} LOC)
\`\`\`cobol
${program.source}
\`\`\`
${program.linkageSection ? `\n## LINKAGE SECTION\n\`\`\`cobol\n${program.linkageSection}\n\`\`\`` : ''}

## Task
Extract ALL business rules from the ENTIRE source — not just the first few paragraphs. Scan the full PROCEDURE DIVISION including every SECTION and every PARAGRAPH. For each rule write a detailed explanation (2–4 sentences):
- Start with the business outcome (not a code description)
- Reference specific COBOL field names, PIC clauses from copybooks (if provided), DB2 table names, file names, status codes, and flag values found in the source
- Explain the conditions, logic, or sequence involved
- Cite at least one graph edge as evidence [edge: FROM → TO (type)]
- Use <strong> tags around important field names and program names

Produce a JSON array with ALL applicable sections (skip only if truly empty for this program):
1. "Input Processing" — how data enters the program (LINKAGE, files, DB reads)
2. "Core Business Logic" — calculations, decisions, validations, EVALUATE/IF blocks
3. "Data Persistence" — database reads/writes (cite SQL tables), file I/O (cite file names)
4. "External Integrations" — calls to other programs, CICS interactions
5. "Error Handling" — error conditions, abend handling, rollback, status code checks
6. "JCL/Batch Execution Context" — how this program fits in the batch job, step inputs/outputs, DD datasets (include only if JCL callers are provided)
7. "Copybook Field Dependencies" — key data structures defined in copybooks that drive this program's logic (include only if copybook context is provided)

IMPORTANT — "text" format: Each rule's "text" field MUST be a complete HTML fragment structured as a Business Requirements Document entry:
1. Open with: <strong>BR-[SECTION_ABBREV]-[NNN]</strong> (e.g. <strong>BR-INP-001</strong>, <strong>BR-CBL-002</strong>)
2. Follow with: <p class="brd-statement">The system SHALL [business requirement in plain English — not COBOL jargon].</p>
3. Add: <p class="brd-rationale"><em>Rationale:</em> [why this rule exists — regulatory, risk, operational].</p>
4. Add: <p class="brd-source"><em>Implementation:</em> [specific COBOL fields with PIC clauses, SQL table names, program calls that implement this requirement].</p>
Use <strong> tags around COBOL field names and program names. The SECTION_ABBREV is a 2-3 letter code derived from the section name (e.g. INP=Input Processing, CBL=Core Business Logic, DAT=Data Persistence, EXT=External Integrations, ERR=Error Handling, JCL=JCL/Batch, CPY=Copybook).

Output schema:
\`\`\`json
[
  {
    "section": "section name",
    "rules": [
      {
        "text": "<strong>BR-INP-001</strong><p class=\"brd-statement\">The system SHALL...</p><p class=\"brd-rationale\"><em>Rationale:</em> ...</p><p class=\"brd-source\"><em>Implementation:</em> ...</p>",
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
}

// ---------------------------------------------------------------------------
// Chain 2 — Change Impact (transitive awareness + JCL callers)
// ---------------------------------------------------------------------------

export function changeImpactPrompt(
  program: ParsedCobolProgram,
  allPrograms: string[],
  jclCallers?: string[],
  copybookContext?: string
): string {
  const graphText = graphSummary(program);
  const otherPrograms = allPrograms.filter((p) => p !== program.name).slice(0, 100).join(', ');
  const jclSection = jclCallers?.length
    ? `\n## JCL Jobs That Invoke ${program.name}\n${jclCallers.map((j) => `- ${j}`).join('\n')}\n`
    : '';
  const copybookSection = copybookContext
    ? `\n## Copybook Field Definitions\n\`\`\`\n${copybookContext}\n\`\`\``
    : '';

  return `You are analyzing the blast radius of modifying COBOL program ${program.name}.

## Dependency Graph for ${program.name}
\`\`\`
${graphText}
\`\`\`
${jclSection}${copybookSection}
## Other Programs in the Repository
${otherPrograms || '(none listed)'}

## Task
Determine what would be impacted if ${program.name} were modified. For each affected program, data resource, or JCL job:
- Assess severity: "critical" (direct synchronous call, CICS link), "high" (dynamic call, data dependency with writes), "medium" (read-only data dependency), "unknown" (unresolved dynamic call)
- State whether the impact is **direct (1-hop)** or **transitive (via an intermediate program)** — cite the full call chain for transitive impacts
- Reference the specific edge(s) that create the dependency

Output JSON:
\`\`\`json
{
  "items": [
    {
      "prog": "affected program, resource, or JCL job name",
      "rel": "relationship description",
      "severity": "critical|high|medium|unknown",
      "reason": "Specific reason — name COBOL fields, SQL tables, or call chain",
      "edge": "FROM → TO (type)"
    }
  ],
  "coveragePct": 85,
  "coverageNote": "Explanation of any gaps"
}
\`\`\`

Rules:
- Include ${program.name} itself as the first item with severity "critical"
- For JCL jobs that invoke this program: add them with severity "high" and rel "JCL caller — must be retested if interface changes"
- For each graph edge, determine if the target would be impacted by an interface or behavioral change
- Dynamic calls (type: dyn) → "unknown" severity with a note about unresolvability
- Do not invent programs not in the graph or the repository list

IMPORTANT — "reason" format: Write each reason as a business impact statement for a Business Analyst audience:
- Lead with the business function that would be affected (not the COBOL mechanism)
- State the downstream consequence (which processes, reports, or end-users are affected)
- Reference the technical dependency only at the end as supporting evidence in brackets
- Example: "The nightly account reconciliation process will require full regression testing — it directly invokes this program for every active account record. [edge: CBSTM03A → CBACT02C (call)]"

<output>
{ your JSON here }
</output>`;
}

// ---------------------------------------------------------------------------
// Chain 3 — Modernization Spec (full source, portfolio + copybook context, 10 sections)
// ---------------------------------------------------------------------------

export function modSpecPrompt(
  program: ParsedCobolProgram,
  businessRules: BusinessRulesSection[],
  portfolioContext?: string,
  copybookContext?: string,
  glossaryContext?: string
): string {
  const graphText = graphSummary(program);
  const rulesText = businessRules
    .map((s) => `### ${s.section}\n${s.rules.map((r) => `- ${r.text.replace(/<[^>]+>/g, '')}`).join('\n')}`)
    .join('\n\n');

  const portfolioSection = portfolioContext
    ? `\n## Dependent Module Context\n${portfolioContext}`
    : '';

  const copybookSection = copybookContext
    ? `\n## Copybook Field Definitions\n\`\`\`\n${copybookContext}\n\`\`\``
    : '';

  const glossarySection = glossaryContext
    ? `\n## Domain Glossary\n\`\`\`\n${glossaryContext}\n\`\`\``
    : '';

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return `You are producing a Modernization Brief for the COBOL program ${program.name}. This document is generated on-demand when an engineer explicitly requests it — it is NOT produced automatically.

The Modernization Brief answers: "What would it take to enhance or modernize this mainframe program?" It follows the code-modernization plugin's brief format.
${portfolioSection}
${copybookSection}
${glossarySection}

## Dependency Graph for ${program.name}
\`\`\`
${graphText}
\`\`\`

## Extracted Business Rules
${rulesText || '(none extracted)'}

## Full COBOL Source (${program.loc.toLocaleString()} LOC)
\`\`\`cobol
${program.source}
\`\`\`
${program.linkageSection ? `\n## LINKAGE SECTION\n\`\`\`cobol\n${program.linkageSection}\n\`\`\`` : ''}

## Task

Produce an 8-section Modernization Brief. Read the source carefully and be specific — use actual field names, program names, and edge references throughout.

**Section 1 — Objective**
One paragraph: from what, to what, and why now. State the modernization method:
- **Uplift** — same-stack enhancement (COBOL stays COBOL, but modernized: structured code, DB2, CICS TS, external APIs). Choose this when the program is actively enhanced and the mainframe is staying.
- **Transform** — cross-stack rewrite (COBOL → Java/Node.js). Choose this when full technology migration is planned.
- **Reimagine** — greenfield rebuild of the business function. Choose this when the domain is well-understood but the code is too entangled to port.
Justify your choice from the source characteristics (LOC, CICS vs batch, SQL vs VSAM, dynamic CALLs, etc.).

**Section 2 — Target Architecture**
A plain-text description of the end-state architecture. Map every program and file in the dependency graph to its target component. For Uplift: describe the enhanced COBOL structure (CICS TS queues replacing getmains, DB2 stored procedures replacing inline SQL, structured error handling). For Transform/Reimagine: describe the target stack (Spring Boot, Angular, PostgreSQL, etc.).

**Section 3 — Phased Sequence**
Break the work into 3–5 phases. Order leaf dependencies first (programs with no further callees before the programs that call them). For each phase:
- Scope: which programs or components
- Entry criteria: what must be ready
- Exit criteria: what tests prove it's done
- Scale: S / M / L / XL (relative size, NOT a time estimate)
- Risk level: Low / Medium / High + top 2 risks + mitigation

**Section 4 — Business Walkthroughs**
For each major business flow visible in the dependency graph (entry points, call chains, data flows), write a short walkthrough: persona → what they do → which programs execute → which phase modernizes each step. This is the section non-technical approvers read. If no clear personas are visible, derive 2–3 flows from the program's file I/O and call structure and note they need SME confirmation.

**Section 5 — Behavior Contract**
List the P0 rules — business rules that MUST be proven equivalent before any phase ships:
- Rules involving monetary calculations, account balances, regulatory codes
- Rules that touch shared copybooks or external interfaces
- Rules with error/status codes that downstream programs depend on
Flag any rule where the source is ambiguous or dynamic (dynamic CALL, EVALUATE with unclear conditions) as requiring SME confirmation.

**Section 6 — Validation Strategy**
State which combination applies for this program and justify:
- Characterization tests (capture COBOL I/O, replay against new code)
- Contract tests (verify interface payloads match expected schema)
- Parallel-run / dual-execution diff (run old and new in parallel, compare outputs)
- Property-based tests (for calculation-heavy programs)
- Manual UAT (for CICS terminal screens)

**Section 7 — Open Questions**
List anything requiring human/SME decision before Phase 1 starts. Format each as a checkbox item the approver must tick. Common questions: undocumented business rules, dynamic CALL targets, shared file ownership, regulatory requirements.

**Section 8 — Approval Block**
Include an approval block stating:
- "Modernization method: [Uplift | Transform | Reimagine]"
- "Generated: ${today} by MAVEN"
- "Approved by: ________________  Date: __________"
- "Approval covers: Phase 1 only | Full plan"

RULES FOR OUTPUT FORMAT:
- You MUST return a JSON array. The array has exactly 8 objects.
- Each object has exactly three keys: "num" (integer 1–8), "title" (string), "content" (string).
- The "content" value MUST be an HTML string. It MUST start with an HTML tag such as <p>, <ul>, or <table>.
- NEVER put JSON, markdown, raw text, or another array inside "content". Only HTML.
- Example of correct content: "<p>This program handles...</p><ul><li>Phase 1: ...</li></ul>"
- Example of WRONG content: "[ { \\"phase\\": 1 } ]" or "Phase 1: scope..." (no HTML tags)

<output>
[
  { "num": 1, "title": "Objective", "content": "<p>Generated: ${today}. ..." },
  { "num": 2, "title": "Target Architecture", "content": "<p>..." },
  { "num": 3, "title": "Phased Sequence", "content": "<p>..." },
  { "num": 4, "title": "Business Walkthroughs", "content": "<p>..." },
  { "num": 5, "title": "Behavior Contract", "content": "<p>..." },
  { "num": 6, "title": "Validation Strategy", "content": "<p>..." },
  { "num": 7, "title": "Open Questions", "content": "<ul><li>..." },
  { "num": 8, "title": "Approval Block", "content": "<p>Modernization method: ..." }
]
</output>`;
}
