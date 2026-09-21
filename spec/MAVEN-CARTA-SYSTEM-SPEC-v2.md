# MAVEN/CARTA — System Specification v2.1
**Version:** 2.1
**Date:** 2 August 2026
**Status:** Architecture rebuild — addresses v1 limitations L1–L15, improvement backlog A/B/C/D, and scope-resolution/verification requirements finalized in review
**Purpose:** Production-ready redesign for on-demand mainframe understanding at two tiers: module maintenance and application-level modernization, with deterministic-graph-anchored scope resolution and no silent LLM overwrite of ground-truth dependency data.

---

## 0. What Changed from v1, and Why

v1 treated "documentation" as one artifact tier (per-program) and "modernization" as an on-demand extension of the same tier. Three requirements you've now added break that model:

1. **App-level modernization output** — requires a second artifact tier that aggregates across programs, not a bigger prompt on the same program-scoped chain.
2. **Click-to-source** — requires source to exist in the DB post-scan, plus line-level anchors from Stage 1 extraction carried through every downstream document.
3. **No LLM call per click** — requires an explicit staleness model (source hash vs. last-analyzed hash) so "view" and "refresh" are different, deliberate actions, not the same code path.

None of these are prompt-wording fixes. They're schema and orchestration changes. The prompt-quality fixes you already logged (B1–B3) are still valid and are folded in below, but they were never the primary blocker — the primary blocker is that the system has no persistent, addressable notion of "module-level fact" versus "app-level fact," and no notion of "stale" versus "fresh."

**Design principle going forward:** this system is a fact cache with an LLM-powered elaboration layer on top, not an LLM pipeline with a database bolted on. Every UI click reads the cache. Only an explicit "Analyze" / "Refresh" action calls an LLM. If you keep this principle as the litmus test for every future feature, you won't regress into L2/L14/C6-style bugs again.

---

## 1. Two-Tier Artifact Model

### Tier 1 — Module (Maintenance) Artifacts
Scope: one COBOL/JCL program. Purpose: understand and maintain the application *in its current form*. On-demand, per program, cheap to regenerate.

| Artifact | Table | Regenerated when |
|---|---|---|
| Flow extraction (structured facts) | `moduleFacts` | source hash changes |
| Business rules doc | `bizRules` | `moduleFacts` changes, or manual refresh |
| Change impact (single-module blast radius) | `changeImpacts` | `moduleFacts` or neighbor `moduleFacts` changes |
| Current-state tech spec | `moduleTechSpecs` | same as bizRules |

### Tier 2 — Application (Modernization) Artifacts
Scope: the whole connected repo/portfolio, or a user-defined subset (e.g., "everything downstream of the ledger posting subsystem"). Purpose: modernization planning at the level an architect and a business sponsor actually make decisions at — nobody modernizes one COBOL paragraph in isolation.

| Artifact | Table | Regenerated when |
|---|---|---|
| Capability map (business capabilities → owning programs) | `appCapabilityMap` | any member module's `moduleFacts` changes, or manual refresh |
| App-level BRD (business case for modernizing this scope) | `appBrd` | manual refresh only (expensive, deliberate) |
| App-level modernization tech spec (target architecture, phased plan, Uplift/Transform/Reimagine per cluster) | `appModSpec` | manual refresh only |
| Cross-module impact/blast radius | `appImpact` | manual refresh, or invalidated when any member module's dep graph changes |

**Why this split matters operationally:** Tier 1 stays cheap and can run automatically on first view (as v1 does today). Tier 2 is expensive (it depends on Tier 1 for every module in scope) and must always be an explicit, user-initiated action — never triggered implicitly by opening a page. This directly satisfies "not building a knowledge base for millions of LOC": you are not pre-computing Tier 2 for the whole estate, only for the scope the user deliberately selects.

---

## 2. Schema Changes

```
-- NEW: source storage (fixes L5, L14, enables click-to-source and diffing)
program_sources (
  id, programId, commitSha, sourceText, sourceHash (sha256),
  loc, capturedAt
)
-- Latest row per programId = current source. Historical rows enable diff (C4).

-- NEW: module-level structured facts — the "Stage 1" extraction, cached
moduleFacts (
  id, programId, sourceHash,           -- ties facts to the exact source version analyzed
  entryPoints, businessRules, decisionPoints,
  dataTransformations, exceptionPaths,
  dataStructuresUsed, outOfScopeRefs,  -- JSON, each item carries source_line_start/end
  extractedAt
)

-- CHANGED: program dedup key (fixes L4)
programs: unique(repoId, name)   -- was: unique(name)

-- NEW: app-level tier
appScopes (
  id, repoId, name, memberProgramIds[],
  seedMethod: 'cluster' | 'job-chain' | 'manual',
  seedRef: string,            -- capability cluster id, JCL job name, or null
  crossesClusters: boolean,   -- true if a job-chain seed spans >1 capability cluster
  createdBy, createdAt
)
appCapabilityMap (id, scopeId, sourceFactsHash, capabilities JSON, generatedAt)
appBrd            (id, scopeId, sourceFactsHash, sections JSON, generatedAt)
appModSpec        (id, scopeId, sourceFactsHash, sections JSON, generatedAt)
appImpact         (id, scopeId, sourceFactsHash, items JSON, generatedAt)

-- NEW: deterministic-vs-LLM discrepancy log (Chain 1 verification, never silent overwrite)
graphDiscrepancies (
  id, programId, sourceHash,
  staticEdge JSON,        -- what the deterministic parser asserted (type, target, confidence)
  llmObservation JSON,    -- what the LLM saw in the actual code during extraction
  status: 'unreviewed' | 'confirmed_static' | 'confirmed_llm' | 'dismissed',
  reviewedBy, reviewedAt
)

-- NEW: staleness tracking, replaces implicit "latest row wins"
-- Every Tier 1/Tier 2 artifact stores the hash of its inputs at generation time.
-- UI computes staleness by comparing current input hash to stored hash — no LLM call needed to know a doc is stale.
```

**`sourceHash` / `sourceFactsHash` is the mechanism that eliminates "LLM call per click."** The UI always has enough information, from hashes alone, to show: *fresh*, *stale (source changed)*, or *not yet generated* — and to gate the refresh button accordingly, without ever calling an LLM to find out.

---

## 3. Chain Architecture (Revised)

### Module tier (per program, mirrors v1 Chains 0–2 but fixes B1–B3)

| Chain | Input | Output | Notes |
|---|---|---|---|
| 0 — Dep graph enrichment | static parser graph | enriched graph | **Skip unconditionally when graph source is CAST or when a valid enriched graph already exists for this sourceHash** (fixes B3 fully, including the refresh-route gap) |
| 1 — Flow extraction + verification | source for the **target program only**, plus the deterministic edge list for its direct dependencies, plus **cached `moduleFacts` for any direct dependency that already has a fresh entry** (structured JSON, not source) | `moduleFacts` (strict JSON schema, source-line-anchored) + `graphDiscrepancies` (any mismatch between what the static parser asserted and what the LLM observed in the target's own code) | New. Runs once per `sourceHash` — **per program**, not per caller. This is the only chain that ever sends raw source to an LLM, and it sends only the target's own source; a neighbor's code is never re-sent just because a different program calls it. If a direct dependency has no cached `moduleFacts` yet, or its source has changed since its last extraction, it is queued for its own Chain 1 run — that result is written once under its own `programId` and reused by every future caller, not regenerated per caller. Edge verification (checking the target's own CALL/COPY/SQL statements against the static graph) only requires the target's own code, since the call site lives there; a neighbor's cached facts provide context (its known interface/behavior) without requiring its source again. Disagreements between static and observed edges are written to `graphDiscrepancies` as `unreviewed`; the static edge remains authoritative until a person confirms otherwise. |
| 2 — Business rules doc | `moduleFacts` | `bizRules` | Elaboration only — no source in context |
| 3 — Change impact (module) | `moduleFacts` (target + neighbors) + dep graph | `changeImpacts` | Coverage-checked: every graph-listed caller/callee must appear in output or in an explicit `coverageGaps` list |
| 4 — Current-state tech spec | `moduleFacts` + `bizRules` | `moduleTechSpecs` | New — this is what makes the maintenance-form doc self-sufficient without re-reading source |

### App tier (per scope, new)

| Chain | Input | Output | Notes |
|---|---|---|---|
| 5 — Capability clustering | `moduleFacts` for every member program + full dep graph for scope | `appCapabilityMap` | Groups programs into business capabilities using shared data structures and call clusters, not just naming — this is where "context engineering" needs to actually work (see §5). Runs estate-wide, deterministically, ahead of any scope selection — see §5.1 for how a scope is then seeded from these clusters. |
| 6 — App-level impact | `appCapabilityMap` + `changeImpacts` for all members | `appImpact` | Aggregated blast radius: which capabilities, not just which programs, are affected |
| 7 — App-level BRD | `appCapabilityMap` + member `bizRules` summaries | `appBrd` | Business case, not module description — different audience, different prompt (see §6) |
| 8 — App-level mod spec | `appCapabilityMap` + `appImpact` + `appBrd` + user-specified scope constraints | `appModSpec` | Uplift/Transform/Reimagine recommendation **per capability cluster**, phased sequence across the whole scope, not per program |

Chains 5–8 never touch raw source. They compose from Tier 1 outputs. This is the token-optimization lever you asked for: an app-level brief over 40 programs costs roughly 40× `moduleFacts` reads (small, structured JSON) plus one aggregation call — not 40× full-source re-ingestion.

---

## 4. Output Format Fix (B1, applied)

Replace JSON-with-embedded-HTML with tagged sections, parsed by a tolerant reader instead of `JSON.parse`:

```
<section id="2" title="Current Business Behavior">
<content>
...prose or markdown, not escaped HTML...
</content>
<sourceRefs>
  <ref programId="..." lines="120-145"/>
</sourceRefs>
</section>
```

Every `<section>` carries `<sourceRefs>` — this is what powers "click a section, show the equivalent mainframe code": the UI resolves `programId + lines` against `program_sources` and renders a code panel, with zero LLM involvement. This is only possible because Stage 1 (`moduleFacts`) carried `source_line_start/end` on every rule/transformation/decision point, and every later chain is instructed to preserve those anchors rather than dropping them during elaboration — make that a non-negotiable field in every chain's output schema.

---

## 5. Context Engineering — What "Weak" Actually Means Here

v1's context engineering is a glossary CRUD table and a copybook accordion — both passive, user-maintained, and not fed back into clustering or scoping decisions. To make Chain 5 (capability clustering) actually work, context engineering needs to produce three things automatically, not just store what users type in:

1. **Data-domain map** — cluster programs by shared copybooks/tables (deterministic, from the dep graph — no LLM needed). This is the backbone Chain 5 clusters against; glossary terms are annotations on top of it, not the primary signal.
2. **Capability naming** — LLM assigns human-readable capability names to data-domain clusters (e.g., "Customer Onboarding," "Nightly Settlement") — one small call per scope generation, not per program.
3. **Glossary-as-constraint, not glossary-as-decoration** — when a user has defined a glossary term matching a pattern, that term is injected as a **fact**, not a hint, into Chain 5/7/8 prompts: "the following terms are authoritative business definitions and must be used verbatim in generated documents." Currently glossary matching is decorative context; make it binding vocabulary.

This is also where you get leverage against "not building a KB for millions of LOC": the data-domain map is deterministic and cheap to compute for the whole repo up front (it's graph clustering, not LLM inference), so users can browse capability boundaries before choosing an app-level scope to actually run Chain 5–8 against — expensive LLM work stays scoped to what they select.

---

## 5.1 Scope Resolution and the Coverage Gate (Tier 2 entry point)

"Understand the whole application" is the wrong scope for a modernization decision — it recreates the millions-of-LOC knowledge-base problem you're explicitly avoiding. The right scope is the process or subsystem the decision is actually about, resolved deterministically before any Tier 2 chain runs.

**Seeding methods (both resolve to capability-cluster boundaries — see below):**

- **Capability-cluster seed (default).** User picks a cluster from the estate-wide `appCapabilityMap` (Chain 5, already computed deterministically ahead of time — free, no LLM). Scope = cluster's member programs.
- **Job-chain seed.** User picks a batch job. System parses the JCL execution chain to a program list, then maps each program to its capability cluster and shows the user which cluster(s) the job actually touches — it does **not** silently treat "this job's programs" as the scope.
  - If the job maps to one cluster: job-chain and cluster-based scope agree, proceed.
  - If the job spans multiple clusters: this is a finding, not a detail to hide. Surface it explicitly (e.g., *"This job crosses 3 capability clusters: Account Posting, Statement Generation, Audit Logging. Modernize together, or scope separately?"*) and set `crossesClusters: true` on the resulting `appScope`. This flag becomes an input fact to Chain 7/8 — the model must address why coupled clusters are being modernized together (or flag that they shouldn't be), rather than silently treating a job-chain scope as one coherent capability.
- **Manual seed.** User multi-selects programs directly. No cluster boundary applied — useful for small, already-understood subsystems; not recommended past ~10–15 programs since it's easy to miss a dependency by hand.

**Boundary rule for all cluster-based scopes:** stop the graph closure at the cluster edge, not at a hop limit alone. Shared utility copybooks (generic status/return-code structures common across an estate) will otherwise pull unrelated parts of the repo into scope through one common dependency.

**Coverage gate — mandatory before any Tier 2 chain (5–8) executes:**

Before generating an app-level artifact, the UI must show the resolved scope as a number, not a black box:

> *"This scope includes 47 programs. 32 already have fresh `moduleFacts`. 9 are stale (source changed since last extraction). 6 have never been analyzed."*

Generating `appCapabilityMap`, `appBrd`, `appImpact`, or `appModSpec` requires the missing/stale set to be extracted first (batched Chain 1 runs, in parallel, not one-per-click). This is the mechanism that prevents two failure modes at once: silently running Chain 1 for programs the user didn't expect to trigger, and silently producing an app-level brief with invisible coverage gaps in the blast radius. An executive-facing modernization document with six unread programs in its dependency closure is a worse failure than a slower UI.

**Fan-in note:** `moduleFacts` extraction is keyed by `programId + sourceHash`, not by `(caller, callee)` pair. A shared utility or validation routine referenced by dozens of programs is extracted exactly once and reused by every caller's Chain 1, every Chain 3 (impact) run, and the coverage gate above. A high-fan-in dependency being "missing" or "stale" in the coverage count means it hasn't been extracted at all (or its source changed) — not that it needs re-extraction once per caller that happens to reference it.

---

## 6. Prompt Templates

```
SYSTEM (Chain 1 — Flow Extraction + Graph Verification):
You are a legacy systems flow analyst. You are given:
1. STATIC_EDGES — the deterministic parser's asserted edges for this
   program's DIRECT dependencies (calls, copybooks, SQL/data refs), each
   with a confidence level.
2. SOURCE for the TARGET PROGRAM ONLY. You do not receive source for its
   dependencies — see NEIGHBOR_FACTS below instead.
3. NEIGHBOR_FACTS — previously extracted structured facts (not source)
   for any direct dependency that has already been analyzed. This may be
   partial or empty if a dependency has never been analyzed.

Your job has two parts:
(a) Extract business rules, decision points, data transformations,
    exception paths, and data structures used, each anchored to
    source_line_start/source_line_end, using ONLY the target program's
    own source. Use NEIGHBOR_FACTS for context on what a called module
    does, but do not fabricate detail about a neighbor beyond what
    NEIGHBOR_FACTS provides.
(b) For each edge in STATIC_EDGES, check whether the target program's
    own code (the CALL/COPY/SQL statement itself) is consistent with it.
    A dynamic CALL's resolution table, if present, lives in the target's
    own source — you do not need a neighbor's code to verify this. If you
    find a discrepancy, report it in "discrepancies" — do NOT alter your
    business-rule extraction to "correct" the static graph, and do NOT
    treat your own observation as authoritative. The static graph remains
    the system of record; your job is to flag disagreement for review.

If a CALL target or data reference falls outside STATIC_EDGES entirely,
list it under "out_of_scope_references" — do not resolve or guess its
behavior.

OUTPUT SCHEMA (strict JSON):
{
  "moduleFacts": { ...as defined in Tier 1 schema... },
  "discrepancies": [
    { "staticEdge": {...}, "observation": string, "confidence": "high|medium|low" }
  ]
}

STATIC_EDGES: {{static_edges_one_hop}}
NEIGHBOR_FACTS (cached, may be partial): {{neighbor_module_facts}}
SOURCE (target program only): {{target_source}}
```

**Tier 2 prompts** — these never receive raw source; they compose from `moduleFacts`, `appCapabilityMap`, and `appImpact` already stored.

```
SYSTEM (Chain 5 — Capability Clustering):
You are a portfolio architect. You are given a deterministic data-domain
clustering (programs grouped by shared copybooks/tables) and structured
facts for each program. Assign each cluster a business capability name and
a one-paragraph description. Do not merge or split clusters — the grouping
is ground truth from static analysis. Use any AUTHORITATIVE_GLOSSARY terms
verbatim where applicable.

INPUT: data_domain_clusters (deterministic), moduleFacts[] per program,
authoritative_glossary[]

OUTPUT: { capabilities: [{ id, name, description, memberPrograms[],
data_domains[] }] }
```

```
SYSTEM (Chain 8 — App-Level Modernization Spec):
You are writing a modernization tech spec for the capability scope
{{scope_name}}. Audience: architects and delivery leads deciding sequencing
and approach — not per-module engineers.

For EACH capability in appCapabilityMap, recommend Uplift / Transform /
Reimagine with a one-line justification tied to appImpact severity and
member program complexity. Then produce ONE phased sequence across ALL
capabilities in scope — do not produce isolated per-program plans.

Structure: Scope & Capabilities / Recommendation per Capability / Cross-
Capability Dependencies & Sequencing Risk / Phased Plan / Rollback &
Validation Strategy / Open Questions.

Every dependency claim must trace to appImpact. Do not infer sequencing
risk not evidenced there.

INPUTS:
appCapabilityMap: {{appCapabilityMap}}
appImpact: {{appImpact}}
appBrd: {{appBrd}}
scope_constraints (user-specified): {{scope_constraints}}
```

---

## 7. Caching / Staleness Model (kills "LLM call per click")

UI state machine per artifact, computed client-side from hashes already in the DB row — **no LLM call to determine this**:

- `sourceHash(program)` unchanged since `moduleFacts.sourceHash` → **Fresh**. Render from DB.
- `sourceHash(program)` changed → **Stale**. Render last-known DB content with a "Source changed — refresh to update" banner and button. User decides.
- No row exists → **Not generated**. Show CTA, not a spinner-on-load.

Same pattern one level up: `appCapabilityMap.sourceFactsHash` is a hash of the concatenated `moduleFacts.sourceHash` values for all member programs. If any member changes, the scope shows **Stale** — but Tier 2 refresh is never automatic, even then, because it's expensive and cross-cutting. This is the deliberate exception to "always show fresh": Tier 1 can auto-regenerate on stale detection if you want (it's cheap, single-program); Tier 2 should always require an explicit click, full stop.

This also gives you diff view (C4) essentially for free: when `sourceHash` changes, you already have the prior `moduleFacts` row and the new one — diff the JSON, not the prose.

---

## 8. Remaining v1 Fixes Folded In (unchanged from your backlog, now scheduled)

Carried forward as-is, sequenced into the build plan below: A2 (composite key — done in schema above), A3 (PAT encryption), B2 (prompt caching extended to copybook/glossary blocks, and now also to `moduleFacts` blocks in Tier 2 prompts — these are the most repeated, most stable context and the biggest cache-hit opportunity in the whole system), B4/B5 (progress + retry), C1/C2/C3/C5/C6, D1/D2/D3. These are still correct as originally scoped; nothing above changes them.

---

## 9. Build Sequence

Don't build all of this at once — sequence by what unblocks what:

1. **Source storage (`program_sources`) + composite program key.** Unblocks everything else: click-to-source, diffing, re-analysis without re-scan.
2. **`moduleFacts` (Chain 1) + hash-based staleness model.** This is the one new chain that changes your token economics and kills redundant re-extraction across Tier 1 docs. Validate against a few known programs before touching anything else.
3. **Rewire existing Chains 1–2 (v1 numbering) to consume `moduleFacts`** instead of raw source. You should see immediate consistency gains and the click-to-source feature becomes trivial once source anchors flow through.
4. **Deterministic data-domain clustering** (no LLM) — cheap, and it's the prerequisite ground truth for Chain 5. Include a lightweight discrepancy-review queue at this point too: surface `graphDiscrepancies` from steps 2–3 to a human reviewer before clustering leans on the static graph at scale — an unreviewed backlog of disagreements undermines confidence in the cluster boundaries downstream.
5. **Scope resolution + coverage gate (§5.1)** — capability-cluster and job-chain seeding, `appScopes` with `crossesClusters` detection, and the coverage-gate UI showing fresh/stale/missing counts before any Tier 2 generation is allowed to fire.
6. **Tier 2 chains (5–8)** for user-selected modernization scope. Build this last — it's the most expensive path and depends on everything above being solid first.

**Risk to flag now:** capability clustering (Chain 5) quality is bounded by how clean your dep graph's data-domain signal is. If many programs share a "utility" copybook (common in older estates — a generic status/return-code structure used everywhere), naive clustering will falsely merge unrelated capabilities around that shared structure. `[Guessing: need context]` — does your copybook registry already distinguish business-data copybooks from generic/utility copybooks? If not, that distinction needs to exist before Chain 5, or your capability map will need manual correction on every large repo.
