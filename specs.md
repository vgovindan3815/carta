# MAVEN / CARTA — Project Specification

> **Version:** current (as of commit 69cce8e)  
> **Stack:** Next.js 16.2.12 (App Router, Turbopack) · React 19 · TypeScript 5 · Tailwind CSS 4 · Drizzle ORM · Neon PostgreSQL

---

## 1. Purpose

MAVEN/CARTA is a **mainframe modernization intelligence platform**. It ingests COBOL, HLASM, PL/I, and JCL source code from GitHub repositories, runs a zero-cost deterministic static parser, and then optionally routes to LLM chains to produce:

- Dependency graphs
- Internal program control-flow diagrams (paragraph/PERFORM analysis)
- Business rules in Given/When/Then format
- Change-impact blast-radius reports
- Modernization specifications

The platform is split into two tiers:

| Tier | Scope | LLM? |
|---|---|---|
| **Tier 1** | Per-module (single program) | Optional (3 chains) |
| **Tier 2** | Application-level (scope of programs) | Required (4 chains) |

---

## 2. Repository Layout

```
maven-carta/
├── app/
│   ├── api/                          # Next.js route handlers
│   │   ├── agents/chat/route.ts      # Agentic chat endpoint
│   │   ├── agents/runs/route.ts      # Agent run history
│   │   ├── admin/route.ts            # Admin stats / clear data
│   │   ├── cast/route.ts             # CAST highlight upload
│   │   ├── jobs/[jobId]/route.ts     # Full LLM pipeline SSE stream
│   │   ├── jobs/[jobId]/status/route.ts
│   │   ├── programs/route.ts         # List / create programs
│   │   ├── programs/upload/route.ts  # Upload single source file
│   │   ├── programs/[name]/route.ts  # Get program data (serves ProgramData)
│   │   ├── programs/[name]/analyze/route.ts   # Trigger LLM pipeline
│   │   ├── programs/[name]/graph-only/route.ts # Deterministic analysis SSE
│   │   ├── programs/[name]/source/route.ts    # Source viewer
│   │   ├── programs/[name]/refresh/route.ts   # Re-run analysis
│   │   ├── programs/[name]/staleness/route.ts # Check source staleness
│   │   ├── repos/route.ts
│   │   ├── repos/[id]/route.ts
│   │   ├── repos/[id]/scan/[jobId]/route.ts   # Async repo scan SSE
│   │   ├── repos/[id]/programs/route.ts
│   │   ├── repos/[id]/copybooks/route.ts
│   │   ├── repos/[id]/glossary/route.ts
│   │   ├── scopes/route.ts           # App scopes (Tier 2)
│   │   ├── scopes/[id]/route.ts
│   │   ├── scopes/[id]/generate/route.ts # Tier 2 pipeline SSE
│   │   ├── settings/route.ts
│   │   └── validate/[name]/route.ts
│   └── programs/[name]/page.tsx      # Program hub page (6 tabs)
├── components/panels/
│   ├── OverviewDashboard.tsx         # Tab: Overview (3-panel dashboard)
│   ├── DependencyView.tsx            # Tab: Dependency graph (SVG)
│   ├── BusinessRules.tsx             # Tab: Business rules
│   ├── ChangeImpact.tsx              # Tab: Change impact
│   ├── ModernizationSpec.tsx         # Tab: Modernization spec
│   └── InternalFlowTab.tsx           # Tab: Internal flow (paragraph flowchart)
├── lib/
│   ├── db/
│   │   ├── schema.ts                 # Drizzle table definitions
│   │   └── queries.ts                # All DB access functions (~1400 lines)
│   ├── parser/
│   │   ├── types.ts                  # Shared TypeScript interfaces
│   │   ├── cobol.ts                  # COBOL static parser
│   │   ├── pli.ts                    # PL/I static parser
│   │   ├── jcl.ts                    # JCL static parser
│   │   └── copybook.ts               # .cpy copybook parser
│   ├── analysis/
│   │   ├── orchestrate.ts            # Tier 1 LLM pipeline orchestrator
│   │   └── tier2.ts                  # Tier 2 LLM pipeline orchestrator
│   ├── llm/
│   │   ├── index.ts                  # Provider factory
│   │   ├── types.ts                  # LLMConfig, CallLLM, StreamResult
│   │   ├── anthropic.ts              # Anthropic SDK adapter
│   │   ├── groq.ts                   # Groq SDK adapter
│   │   └── openai.ts                 # OpenAI SDK adapter
│   ├── context/
│   │   ├── portfolio.ts              # Portfolio context builder
│   │   └── glossary.ts               # Domain glossary matcher
│   ├── github.ts                     # GitHub REST API helpers
│   └── crypto.ts                     # PAT encryption/decryption
└── drizzle/                          # Migration SQL files
    ├── 0000_goofy_iron_lad.sql       # Initial schema
    ├── 0001_moaning_chronomancer.sql
    ├── 0002_v22_spec.sql             # v2.2 tables
    ├── 0002_fair_guardian.sql
    └── 0003_internal_flow.sql        # Add internal_flow JSONB column
```

---

## 3. Database Schema

All tables use Neon PostgreSQL via Drizzle ORM. All primary keys are UUIDs.

### Core tables

| Table | Purpose |
|---|---|
| `repos` | GitHub repos connected to the platform (owner, repo, branch, encrypted PAT) |
| `programs` | Individual programs discovered within a repo (name, language, LOC, filePath) |
| `analysis_jobs` | Per-program analysis run (status, phase, progress%, SSE log, tokensUsed) |
| `dep_graphs` | Static dependency graph (nodes, edges, coveragePct, cLayoutNodes, **internalFlow**) |
| `biz_rules` | LLM Chain 1 output — business rules grouped by section |
| `change_impacts` | LLM Chain 2 output — blast-radius items with severity |
| `mod_specs` | LLM Chain 3 output — modernization spec sections |
| `settings` | Key/value store (LLM provider, API keys) |
| `copybooks` | .cpy field definitions per repo |
| `domain_glossary` | Field-pattern → plain-English mappings per repo |
| `scan_jobs` | Async GitHub repo scan jobs |
| `program_sources` | Raw source text + SHA256 hash per program (enables offline analysis) |
| `validations` | Human review records for any artifact |
| `agent_runs` | Agentic chat session records |

### v2.2 tables

| Table | Purpose |
|---|---|
| `module_facts` | Chain 1 structured output: RuleCards, DataObjects, flows, injectionFlags |
| `graph_discrepancies` | Static parser vs LLM disagreements (reviewer workflow) |
| `scan_completeness` | Unresolved COPY refs, missing JCL DDs per scan job |

### Tier 2 tables

| Table | Purpose |
|---|---|
| `app_scopes` | Named set of programs for cross-module analysis |
| `app_capability_maps` | Chain 5 output — capability clusters per scope |
| `app_brds` | Chain 7 output — application-level BRD |
| `app_mod_specs` | Chain 8 output — application-level modernization spec |
| `app_impacts` | Chain 6 output — cross-module impact aggregation |

### Key JSONB column types

```
dep_graphs.nodes          → GraphNode[]
dep_graphs.edges          → GraphEdge[]
dep_graphs.cLayoutNodes   → GraphNode[]       (circular layout coords)
dep_graphs.internalFlow   → InternalFlow      (paragraphs + PERFORM edges)
module_facts.businessRules → RuleCard[]
module_facts.dataObjects  → DataObject[]
module_facts.flows        → PersonaFlow[]
```

---

## 4. Core Type System (`lib/parser/types.ts`)

### Graph primitives

```ts
NodeType = 'hero' | 'prog' | 'data' | 'asm' | 'jcl' | 'proc' | 'cpy' | 'sys' | 'impact'
EdgeType = 'call' | 'data' | 'cics' | 'dyn' | 'jcl' | 'proc' | 'copy' | 'impact'

GraphNode  { id, label, sub, type; x?, y?, w?, h?; cx?, cy?, r? }
GraphEdge  { from, to, type, label?, fd?, td?, confidence?, sourcePara? }
```

### Internal flow (paragraph analysis)

```ts
ParagraphNode  { name, lineStart, lineEnd, sectionName? }
PerformEdge    { from, to, type:'perform', isLoop, condition? }
InternalFlow   { paragraphs, sections, performEdges, entryParagraph }
```

### LLM artifacts

```ts
RuleCard       { id:'RULE-NNN', name, category, priority:'P0|P1|P2',
                 source_line_start, source_line_end, plain_english,
                 given, when, then, parameters, edge_cases,
                 suspected_defect, confidence, confidence_note }

DataObject     { name, kind, source_line, fields, consumed_by_rules, produced_by_rules }
PersonaFlow    { name, persona, description, smePending, steps }
AppCapability  { id, name, description, memberPrograms, dataDomains, p0RuleCount }
```

### Page data contract

```ts
ProgramData {
  name, language, loc, domain, desc
  chips: MetaChip[]           // header chips (language, LOC, etc.)
  overviewQuery, overviewNarrative, overviewEdges[]
  cLayout: CircularLayout     // circular dep graph for overview tab
  graph: { title, nodes, edges }  // rect layout for dependency tab
  businessRules: BusinessRulesSection[]
  changeImpact: ChangeImpact
  spec: ModernizationSpec
  pipelineStatus?: PipelineStatus
  internalFlow?: InternalFlow
}
```

---

## 5. Parsers

### COBOL (`lib/parser/cobol.ts`)

Fixed-format COBOL (cols 1-72, Area A = cols 8-11, Area B = cols 12-72).

**Extracts:**
- Static CALL literals → `type: 'call'`
- Dynamic CALL via variable → `type: 'dyn'` (71% confidence)
- EXEC SQL tables (FROM/INTO/UPDATE/JOIN) → `type: 'data'`
- EXEC CICS PROGRAM/FILE → `type: 'cics'`
- FD file names (READ/WRITE/OPEN) → `type: 'data'`
- COPY members → `type: 'copy'`
- **Paragraph names** (Area A, ending with `.`) — builds `ParagraphNode[]`
- **PERFORM edges** — `PerformEdge[]` with loop detection (UNTIL/VARYING)
- **Source paragraph** (`sourcePara`) annotated on every external edge

**Layout:** Two-ring circular layout (hero at center, called programs inner ring, data/CICS outer ring). Coordinates: CX=306, CY=306, R_INNER=150, R_OUTER=250, NODE_R=36.

### PL/I (`lib/parser/pli.ts`)

Free-format PL/I. Extracts CALL, EXEC SQL, file I/O, EXEC CICS, %INCLUDE. Same circular layout.

### JCL (`lib/parser/jcl.ts`)

Extracts EXEC PGM, EXEC PROC, DD DSN references, JCLLIB.

---

## 6. Analysis Pipeline

### Tier 1 — Per-module (`lib/analysis/orchestrate.ts`)

Three sequential LLM chains, all optional:

| Chain | Output | Table |
|---|---|---|
| **Phase 0** | Static dep graph (deterministic, 0 tokens) | `dep_graphs` |
| **Chain 1** | Module facts — RuleCards, DataObjects, flows | `module_facts` + `biz_rules` |
| **Chain 2** | Change-impact blast radius | `change_impacts` |
| **Chain 3** | Modernization specification | `mod_specs` |

SSE stream: each log line is `{ lv: 'INFO'|'CALL'|'SQL'|'DATA'|'WARN'|'LLM'|'DONE', t: string, d: number }`.

### Deterministic-only mode (`/api/programs/[name]/graph-only`)

Runs Phase 0 (static parser) only. Zero tokens. Produces dep graph + internal flow. Available from the Agents tab → "Deterministic" tool.

### Tier 2 — Application-level (`lib/analysis/tier2.ts`)

Four LLM chains, user-initiated from an App Scope:

| Chain | Output | Table |
|---|---|---|
| **Chain 5** | Capability clustering | `app_capability_maps` |
| **Chain 6** | Cross-module impact aggregation | `app_impacts` |
| **Chain 7** | Application-level BRD | `app_brds` |
| **Chain 8** | Application-level modernization spec | `app_mod_specs` |

Input: `module_facts` rows for all programs in the scope. Never touches raw source.

---

## 7. LLM Providers

Configured via `settings` table (key/value). Supported providers:

| Provider | SDK | Default model |
|---|---|---|
| Anthropic | `@anthropic-ai/sdk` | claude-* (configurable) |
| Groq | `groq-sdk` | `llama-3.1-8b-instant` |
| OpenAI | `openai` | configurable |

Provider selected at runtime via `lib/llm/index.ts → createLLMProvider(config)`. All providers expose `CallLLM(systemPrompt, userPrompt, maxTokens, onChunk?) → StreamResult`.

---

## 8. API Routes

### Program lifecycle

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/programs` | List all programs |
| POST | `/api/programs/upload` | Upload source file |
| GET | `/api/programs/[name]` | Get `ProgramData` (serves all tab content) |
| GET | `/api/programs/[name]/analyze` | SSE: trigger full LLM pipeline |
| GET | `/api/programs/[name]/graph-only` | SSE: deterministic analysis only |
| GET | `/api/programs/[name]/source` | Raw source text |
| GET | `/api/programs/[name]/refresh` | Re-analyze with latest source |
| GET | `/api/programs/[name]/staleness` | Check if source changed since last analysis |
| POST | `/api/validate/[name]` | Submit human review |

### Repo management

| Method | Route | Purpose |
|---|---|---|
| GET/POST | `/api/repos` | List / connect repo |
| GET/PUT/DELETE | `/api/repos/[id]` | Get / update / disconnect repo |
| GET | `/api/repos/[id]/scan/[jobId]` | SSE: async repo scan |
| GET | `/api/repos/[id]/programs` | Programs in repo |
| GET/POST | `/api/repos/[id]/copybooks` | Copybook registry |
| GET/POST | `/api/repos/[id]/glossary` | Domain glossary |

### Jobs & agents

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/jobs/[jobId]` | Job status + log |
| GET | `/api/jobs/[jobId]/status` | Lightweight status poll |
| GET/POST | `/api/agents/chat` | Agentic chat (SSE stream) |
| GET | `/api/agents/runs` | Agent run history |
| GET/POST | `/api/scopes` | App scopes |
| GET/PUT/DELETE | `/api/scopes/[id]` | Scope detail |
| GET | `/api/scopes/[id]/generate` | SSE: Tier 2 pipeline |
| POST | `/api/cast` | CAST Highlight XML upload |
| GET | `/api/settings` | LLM settings |
| GET | `/api/admin` | Admin stats / clear |

---

## 9. Program Hub Page (`app/programs/[name]/page.tsx`)

Single-page, client-side, SSE-driven. Six tabs:

| Tab ID | Component | Condition |
|---|---|---|
| `overview` | `OverviewDashboard` | Always |
| `dependency` | `DependencyView` | Always |
| `business` | `BusinessRules` | Always |
| `impact` | `ChangeImpact` | Always |
| `spec` | `ModernizationSpec` | Always |
| `flow` | `InternalFlowTab` | Only when `internalFlow` present |

**Page states:** `processing` (SSE animation) → `hub` (tab view) → `not-found`.

**Analysis modes:**
- `full`: runs full LLM pipeline via `/api/programs/[name]/analyze`
- `graph-only`: deterministic only via `/api/programs/[name]/graph-only`

**Staleness detection:** polls `/api/programs/[name]/staleness` to detect if GitHub source changed since last analysis.

**Demo mode:** pre-built log sequences for `GTMSETL0` and `GTMPOST1` when no database is available.

---

## 10. Internal Flow Tab (`components/panels/InternalFlowTab.tsx`)

Shows three panels for COBOL programs only:

**A — Paragraph control flow (SVG)**
- Top-down hierarchy, up to 14 nodes across 3 levels
- Node colors: entry=purple, control (0000-*)=blue, cleanup (9000-*)=teal, loop=amber, worker=gray
- Arrows via SVG `<line>` + `<marker>` (no external library)
- Loop badge: `↻ loop` subtitle on looping nodes

**B — External call chain**
- Filters `graph.edges` for `type='call'|'dyn'`
- Shows `sourcePara` annotation, confidence badge (static 100% / dynamic 71%)

**C — Data access**
- Grouped by SQL / Files / CICS
- Each entry: resource name, operation, source paragraph

---

## 11. GitHub Integration (`lib/github.ts`)

- Uses `@octokit/rest` with optional PAT (stored AES-256 encrypted in DB)
- `listCobolFiles(owner, repo, branch, pat)` — lists all COBOL/HLASM/JCL/PL/I/CPY files
- `fetchFileContent(owner, repo, path, branch, pat)` — fetches single file by path
- `findProgramSource(owner, repo, branch, name, pat)` — fallback name-based search (COBOL only)
- Supports `cast://` and `upload://` pseudo-URLs for non-GitHub sources

---

## 12. Source Storage Flow

1. **Scan** (`/api/repos/[id]/scan/[jobId]`): fetches source → `upsertProgram` → `saveProgramSource`
2. **Deterministic analysis** (`/api/programs/[name]/graph-only`): tries live GitHub first → falls back to `getProgramSource` from DB
3. **Full pipeline** (`lib/analysis/orchestrate.ts`): same fallback chain; source hash compared to detect staleness

---

## 13. Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `ENCRYPTION_KEY` | 32-char AES-256 key for PAT encryption |
| `ANTHROPIC_API_KEY` | (optional) Default Anthropic key |
| `GROQ_API_KEY` | (optional) Default Groq key |

LLM provider and API keys can also be configured at runtime via Settings UI (stored in `settings` table).

---

## 14. Known Gaps / Open Items

- **Paragraph detection** is COBOL fixed-format only; PL/I/HLASM/JCL have no internal flow
- **PERFORM THRU** ranges are detected but not modeled as range edges in the current SVG (treated as simple `perform`)
- **Section-level PERFORM** (PERFORM section-name) not distinguished from paragraph PERFORM
- **Free-format COBOL** (cols 1-250) is not supported by the paragraph extractor
- **Scan completeness** table (`scan_completeness`) is populated but no UI surfaces unresolved COPY refs
- **Graph discrepancies** workflow has DB tables and queries but no review UI
- **Validation workflow** (`validations` table) has no frontend
- **DB migration 0002** has two conflicting files (`0002_v22_spec.sql` and `0002_fair_guardian.sql`) — only one should be applied
- `npx drizzle-kit push` must be run manually after pulling `0003_internal_flow.sql`
