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

  return `Generate a comprehensive full-stack application modernization blueprint for the application anchored by ${program.name}.

IMPORTANT: This is NOT a single-program migration plan. Treat ${program.name} and ALL programs in its dependency portfolio as ONE application to be rebuilt as a modern cloud-native system. Every section must cover the full application scope — do not scope any section to only the focal program.
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
Produce a 10-section application modernization blueprint. Section 1 MUST begin with "Generated: ${today}".

For every program listed in the Dependent Module Context, you MUST include it explicitly in sections 2, 3, and 4. Do not leave any program as "to be analyzed later."

1. **Application Overview & Modernization Mandate**
   First line: "Generated: ${today}"
   - What is the end-to-end business function of this application (not just the focal program)?
   - Name all programs involved, their collective LOC, and the business domain they serve
   - Modernization priority (Critical/High/Medium) with business justification
   - Recommended modernization approach: strangler-fig (incremental) vs. big-bang rewrite, with rationale

2. **Current Architecture Analysis**
   - Full COBOL application structure: list every program from the portfolio and its role (batch controller, business sub-program, data access layer, JCL orchestrator, copybook library)
   - Data flows between programs (cite specific call edges and data edges)
   - Technical debt inventory: dynamic CALLs, undocumented logic, hardcoded values, shared mutable copybooks, missing error handling

3. **Target Full-Stack Architecture**
   Recommend a specific target stack with justification from the source characteristics:
   - **Backend**: Java 21 + Spring Boot 3.x (preferred for batch-heavy, transaction-intensive COBOL) OR Node.js 22 + Express/NestJS (preferred for CICS/online, lightweight logic) — state which and why
   - **Frontend**: Angular 17 (preferred for complex data-entry workflows, CICS terminal replacements) OR React 18 + Next.js (preferred for modern UX, report/dashboard screens) — state which and why
   - **Data layer**: JPA/Hibernate + PostgreSQL (relational, transactional) or DB2 LUW migration; Redis for CICS state replacement; AWS S3 or object storage for sequential file datasets
   - **Batch processing**: Spring Batch (for JCL-heavy batch chains) or AWS Step Functions (serverless batch)
   - **Integration**: REST/JSON over HTTPS with OpenAPI 3.1 for external APIs; gRPC for high-throughput internal service calls replacing static COBOL CALL

4. **Service Decomposition & Portfolio Map**
   Group the COBOL programs into bounded microservices or modules. For each service:
   - Service name and responsibility
   - Programs included (from focal program + all portfolio context programs)
   - Each program's role within the service (entry point, domain logic, data access, utility)
   - Recommended Spring Boot module name or Node.js package name
   - Modernization priority for this service (High/Medium/Low)
   Every program from the dependency graph and portfolio context MUST appear in exactly one service group.

5. **API & Interface Design**
   - For each service from section 4: define the REST API contract
   - LINKAGE SECTION fields → JSON request/response schema (with field types derived from PIC clauses)
   - Proposed endpoint: method, path, request body, response body
   - Error codes mapped from COBOL status fields and SQLCODE values
   - OpenAPI 3.1 snippet for at least the focal program's primary operation

6. **Copybook-to-DTO Mapping**
   For each COPY member in the dependency graph (type "copy"):
   - Java record class definition with field names from PIC clauses (X = String, 9 = Integer/BigDecimal, S9 = signed numeric)
   - TypeScript interface equivalent
   - Bean Validation annotations (@NotNull, @Size, @Digits) derived from PIC constraints
   If no copybook context is provided, derive DTO fields from WORKING-STORAGE section field names in the source.

7. **Data Layer Migration**
   - All DB2 tables and VSAM/sequential files from the portfolio → JPA entity classes (cite specific table/file names from graph edges)
   - Transaction boundary design: which Spring @Transactional methods map to which COBOL COMMIT points
   - Index recommendations based on COBOL file key fields and SQL WHERE clauses
   - Data migration scripts: approach (bulk export/import, CDC, dual-write)

8. **Batch & JCL Migration**
   - Current JCL job chain structure (steps, step sequencing, DD datasets)
   - Spring Batch equivalent: Job → Step → ItemReader/ItemProcessor/ItemWriter mapping
   - OR AWS Step Functions state machine (if serverless batch is recommended)
   - DD statement → datasource bean or S3 bucket key mapping
   - Trigger mechanism: replaced JCL scheduler → Spring Batch job launcher, AWS EventBridge, or Quartz

9. **Migration Roadmap**
   Phase 1 — Foundation (weeks 1–4): API shell, data model, CI/CD pipeline, test harness
   Phase 2 — Business Logic Port (weeks 5–12): service-by-service migration starting with lowest-risk services
   Phase 3 — Batch Migration (weeks 13–18): JCL → Spring Batch, data pipeline migration
   Phase 4 — Decommission (weeks 19–24): shadow-run validation, traffic cutover, COBOL retirement
   Include estimated effort per phase based on total LOC and dependency count across the portfolio.

10. **Risk & Test Strategy**
    - Dynamic CALLs (unresolvable targets) — list each and risk level
    - Shared copybooks used by multiple programs — data structure change impact
    - Undocumented CICS transactions — discovery approach
    - Regression test strategy: record/replay of COBOL I/O for golden dataset comparison
    - Shadow-run approach: run COBOL and Java in parallel, compare outputs before cutover
    - Go/no-go criteria for each migration phase

For each section write HTML content (use <p>, <ul>, <li>, <table>, <strong>, <code>, <pre> tags). Reference COBOL fields, copybooks, and edges [edge: FROM → TO (type)] throughout. Be specific — name actual field names, table names, program names, and call chains from the provided context.

CRITICAL: The "content" value for every section MUST be valid HTML markup. NEVER put raw JSON, a nested JSON array, or plain untagged text inside "content". The outer structure is a JSON array of section objects; each section's "content" value is an HTML string starting with a tag like <p> or <ul>.

Output JSON array:
\`\`\`json
[
  { "num": 1, "title": "Application Overview & Modernization Mandate", "content": "<p>Generated: ${today}...</p>" },
  ...
]
\`\`\`

<output>
[your JSON here]
</output>`;
}
