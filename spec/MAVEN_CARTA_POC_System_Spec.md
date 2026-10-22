# MAVEN / CARTA — POC System Specification

**Working name — confirm with leadership.** MAVEN = Mainframe Analysis, Visualization & Engineering iNtelligence.

**Document purpose.** This specifies a **proposal demonstration** of MAVEN/CARTA — a clickable prototype that shows how the tool will function from a user's point of view. It is **not** a working system: the deterministic analysis and LLM generation are performed **ahead of time**, and the demo displays pre-generated, reviewed content. This is deliberate and appropriate for a proposal — it shows the intended experience reliably, with nothing to fail live.

---

## 1. What this POC is — and is not

**IS:**
- A clickable, Figma-style prototype that walks a viewer through the MAVEN experience.
- Driven by **pre-authored synthetic COBOL** and **pre-generated documentation** stored as static content.
- A faithful illustration of the *target* user experience: enter a program name, view all its documentation.

**IS NOT:**
- A live system. No parser runs, no LLM is called, no dependency graph is computed at demo time.
- Connected to any BNY code or environment.
- The product. The real MAVEN (deterministic CAST analysis + BNY-internal LLM + human-validation gate, per the program architecture) is the build that *follows* a successful proposal.

**Framing rule (non-negotiable for credibility).** In every setting — internal and client-facing — this is presented as *"an illustrative prototype of the intended MAVEN experience."* No one on the BNY side should be led to believe it is live-analyzing code. The prototype demonstrates the experience; the proposal describes the engine that will produce it for real. Misrepresenting a canned demo as a live system is a credibility landmine that surfaces later. State the framing on the opening screen and in the proposal narrative.

---

## 2. POC objective

Prove, convincingly and on realistic-looking code, that MAVEN delivers **four documentation outputs** on demand from a single program name:

1. **Dependency view** — what this program calls, what calls it, what data it touches.
2. **Business rules** — what the program does, in business terms a non-COBOL reader understands.
3. **Change-impact analysis** — what breaks if this program changes, and why.
4. **Modernization spec** — a target-state (Java) specification draft for the program.

And that MAVEN does this **trustworthily**: structure shown as deterministic, narrative shown as grounded in that structure, coverage/limits shown honestly, and a human-validation gate before anything is acted on.

The single most important thing to leave the room believing: *MAVEN does not guess about our core banking code — it explains a structure that was determined, not inferred.*

---

## 3. The synthetic estate

A small, self-authored COBOL set that resembles the BNY estate (Payments / Global Transaction Management flavor) without using any real BNY code. Because it is authored for this POC, the **ground-truth dependency graph is known in advance** — which lets the demo show verifiable accuracy ("here is the real call structure; here is what MAVEN recovered — they match").

**Scope: 5-6 programs**, one bounded domain, enough interdependency to make the dependency view and change-impact interesting, small enough to fully document by hand.

Suggested set (settlement-cutoff scenario):
| Program | Role | Key dependencies |
|---|---|---|
| `GTMSETL0` | Settlement cutoff calculation (the "hero" program the demo centers on) | calls GTMPOST1, GTMVALD2; reads DB2 SETL_CTRL |
| `GTMPOST1` | Transaction posting | consumes cutoff timestamp; writes GLEDGER feed |
| `GTMVALD2` | Validation | consumes cutoff; calls GTMDB2IO |
| `GTMCICS4` | CICS online transaction | reads cutoff at runtime |
| `GTMDB2IO` | DB2 access module | owns SETL_CTRL table I/O |
| `GTMASM01` | Assembler utility (partial-coverage example) | called dynamically — used to demonstrate honest coverage flagging |

**Demo entry points: 1-2 program names given to the user** — `GTMSETL0` (rich, central) and optionally `GTMPOST1`. The other programs exist to populate the dependency graph and change-impact.

**Deliverable:** the COBOL source files (authored, commented, realistic), stored in the prototype's content library. These are illustrative artifacts, not production code.

---

## 4. Pre-generated content (the four doc types)

For each entry-point program, all four documents are generated once, reviewed for accuracy against the known ground truth, and stored as static content the prototype displays.

### 4.1 Dependency view
- Visual dependency graph: the program in focus (center), direct callers/callees, downstream data consumers.
- Distinguishes call edges from data edges (DB2 table access).
- Marks the Assembler dependency (`GTMASM01`) as **partial coverage** (dashed) — the honesty signal.
- Labelled: **"Structure: deterministic"** — this is what CAST determines, not what the LLM guesses.

### 4.2 Business rules
- Plain-language narrative of what the program does, for a business/analyst reader.
- Example for `GTMSETL0`: the settlement cutoff logic, the timing rules, what downstream processes depend on the cutoff, the business consequence of the cutoff moving.
- Labelled **"Explanation: LLM, grounded in the deterministic graph"** — clearly distinct from the structural layer.
- Each material claim cites the dependency edge it derives from (e.g. "GTMPOST1 consumes the cutoff — source: call edge GTMSETL0 → GTMPOST1").

### 4.3 Change-impact analysis
- "What breaks if I change the settlement cutoff in `GTMSETL0`?"
- Lists affected programs with the reason each is affected, traced to graph edges.
- Coverage/confidence indicator (e.g. "Coverage 91% — one Assembler dependency partially analyzed, verify manually").
- This is the screen that best proves the trust story — grounded, traceable, honest about limits.

### 4.4 Modernization spec (target-state)
- A drafted Java-target specification for the program: intended class/service structure, the business logic to preserve, data access mapping (DB2 → target), and interface contracts.
- Explicitly marked **"Draft — requires engineer validation before use"** (the human-gate principle rendered as a document state).

**Deliverable:** four static documents per entry-point program, reviewed and stored. Content authored to be accurate to the synthetic code's known ground truth.

---

## 5. The prototype (clickable, Figma-style)

A clickable flow — no backend, no computation. Screens and transitions only.

### 5.1 Screen inventory
1. **Opening / framing screen** — MAVEN/CARTA branding, one line: *"Illustrative prototype of the intended experience. Demonstration content; not a live system."* Working-name note.
2. **Entry screen** — the user is given 1-2 program names; a search/select field where they enter/pick `GTMSETL0`.
3. **Program overview (hub)** — once a program is selected, a hub screen showing the program identity (name, language, LOC, domain) and four tabs/cards: Dependency View · Business Rules · Change Impact · Modernization Spec. Plus the two trust badges (deterministic structure / grounded explanation) and a "graph refreshed on commit" indicator to imply currency.
4. **Dependency View screen** — the graph (§4.1).
5. **Business Rules screen** — the narrative with cited edges (§4.2).
6. **Change-Impact screen** — impact list + coverage indicator + validation gate (§4.3).
7. **Modernization Spec screen** — the draft spec with the "requires validation" state (§4.4).
8. **(Optional) second program** — same flow for `GTMPOST1` to show it generalizes.

### 5.2 Interaction model
- Click a program name → hub. Click a tab/card → that document. Back to hub. That's the whole flow.
- The **validation gate** appears on the change-impact and spec screens as a UI element ("Reviewed by: — awaiting engineer sign-off —" and a "Generate draft spec" / "Export" affordance) — shown, not functional.
- No text input processing, no live generation. Selecting a known program name reveals its stored content.

### 5.3 Visual design
- Reuse the established program palette so it's consistent with the deck: NAVY `#065A82` / `#1F3864`, TEAL `#1C7293`, MID `#21295C`, light greys. Cambria for headings feel / Arial body — or the tool's own clean sans.
- The reference wireframe already produced (`MAVEN_Wireframe.html`) is the visual starting point for the change-impact screen; extend its style to the other three doc screens for consistency.

---

## 6. Demo script (the narrative the presenter follows)

1. **Frame it** (opening screen): "This is a prototype of how MAVEN will work. The content is pre-generated on sample code so we can show you the experience reliably. Behind it, the real tool uses deterministic analysis plus a grounded LLM — which I'll describe."
2. **Enter a program** (`GTMSETL0`): "An engineer facing this settlement-cutoff program asks MAVEN about it — by name, no hunting through documentation."
3. **Dependency view**: "First, the structure. This graph is *determined*, not guessed — every edge comes from parsing the code. Notice the Assembler module is flagged as partial coverage; MAVEN tells you what it doesn't fully know."
4. **Business rules**: "Now the plain-language explanation — and see how each statement cites the dependency it came from. The AI narrates the deterministic structure; it never invents it."
5. **Change impact** (the money screen): "The engineer asks 'what breaks if I change the cutoff?' — here's every affected program, why, and an honest coverage number. And nothing proceeds without engineer sign-off — that gate is built in."
6. **Modernization spec**: "And when it's time to modernize, MAVEN drafts the target Java spec — as a draft, for an engineer to validate."
7. **Close**: "That's dead documentation replaced by living, on-demand, grounded comprehension. The proposal covers building this against your estate, with CAST as the deterministic engine and your internal LLM."

---

## 7. Success criteria

The POC succeeds if, after the demo, a BNY stakeholder believes:
- MAVEN's answers are **grounded and verifiable**, not LLM guesswork (the cited-edges + deterministic-badge + coverage-honesty design carries this).
- The experience is **genuinely useful** to an engineer (by-name, on-demand, all four doc types in one place).
- The approach is **safe for core banking** (validation gate, honest coverage, deterministic structure).
- It is credibly buildable at estate scale (the proposal's CAST + internal-LLM architecture backs this).

It does **not** need to: run live, scale, cover all languages, or touch real code. Those are the build, not the demo.

---

## 8. Build plan & effort (indicative)

| Workstream | What | Rough effort |
|---|---|---|
| Synthetic COBOL authoring | 5-6 interdependent programs, commented, realistic | 2-3 days |
| Content generation (4 doc types × 1-2 programs) | Author + review dependency/rules/impact/spec docs | 4-6 days |
| Prototype build | 7-8 clickable screens, styled, wired transitions | 5-7 days |
| Demo rehearsal + framing polish | Script, opening frame, dry-run | 1-2 days |
| **Total** | | **~2.5-3.5 weeks, 1-2 people** |

This is a demo build, not a product build — effort is content and design, not engineering.

---

## 9. Honest limitations to disclose

- **Pre-generated content.** Everything shown is prepared in advance on synthetic code. Stated up front (§1 framing rule).
- **Synthetic, not BNY, code.** Resembles the estate; is not the estate. No real dependencies proven.
- **No real deterministic engine in the POC.** The real product uses CAST (not yet available for this POC); the demo asserts the structure rather than computing it. The proposal must clearly describe CAST as the engine that makes the demonstrated experience real.
- **Coverage/accuracy claims** in the demo are true *of the synthetic code* (whose ground truth is known); they are illustrative of what the real tool would achieve, not a measured result on BNY's estate.
- **Not a commitment to specific UI.** The prototype illustrates the experience; final UI is a design activity in the build.

---

## 10. Relationship to the real MAVEN (what the proposal builds next)

The prototype shows the *experience*; the proposal funds the *engine*:
- **CAST** performs deterministic analysis across the estate (all 323M LOC, all languages) — the real source of the dependency graph the prototype mocks.
- **BNY-internal LLM** generates the narratives, specs, and impact analyses — grounded in the CAST graph, never constructing structure.
- **Human-validation gate** before any generated artifact informs a code change.
- **Scope:** the stay estate (disposition-defined), all languages — per the program architecture.

The demo is the promise; this architecture is how the promise is kept.
