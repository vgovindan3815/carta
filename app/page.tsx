import Link from 'next/link';

const SUPPORTED_LANGUAGES = [
  { name: 'COBOL', desc: 'COBOL 85/2002 — batch and online programs (.cbl, .cob)', color: '#1C7293' },
  { name: 'JCL / PROC', desc: 'Job Control Language — step sequencing, dataset lineage', color: '#7C3AED' },
  { name: 'PL/I', desc: 'PL/I source — procedure calls, data structures', color: '#059669' },
  { name: 'HLASM', desc: 'High-Level Assembler — called-program detection', color: '#D97706' },
];

const ARTIFACTS = [
  {
    icon: '🔗',
    title: 'Dependency Graph',
    badge: 'Deterministic · LLM · Graph Analysis',
    badgeColor: '#1C7293',
    desc: 'Visual call and data-flow map of every program. The deterministic parser extracts static CALL edges, EXEC SQL table dependencies, CICS transactions, and file I/O. LLM inference fills dynamic call paths with confidence scores.',
    detail: 'Nodes: hero / prog / data / asm · Edge types: call · data · cics · dyn',
  },
  {
    icon: '📋',
    title: 'Business Rules',
    badge: 'LLM · Grounded in Graph',
    badgeColor: '#27AE60',
    desc: 'Plain-language extraction of what the program does — grouped into sections (Input Processing, Core Logic, Data Persistence, External Integrations, Error Handling). Every claim cites a graph edge.',
    detail: '5 sections · Multi-sentence rules · Field citations',
  },
  {
    icon: '💥',
    title: 'Change Impact',
    badge: 'LLM · Traced to Edges',
    badgeColor: '#E07B39',
    desc: 'Blast-radius analysis for any proposed change. Each affected program or data store is rated Critical / High / Medium / Unknown with the specific graph edge that proves the relationship.',
    detail: 'Severity: critical · high · medium · unknown · coverage %',
  },
  {
    icon: '🏗️',
    title: 'Modernization Spec',
    badge: 'LLM · Draft',
    badgeColor: '#9CA3AF',
    desc: '5-section specification targeting Java / Spring Boot: Executive Summary, Architecture Analysis, Modernization Strategy, Data Layer Migration, and Risk Assessment.',
    detail: 'Draft · engineer validation required before use',
  },
];

const PATH_A = [
  { icon: '📤', label: 'Upload CAST Reports', sub: 'Import deterministic dependency output from CAST static analysis (.xml or .json). Gold-standard source of truth.', badge: 'Required for full accuracy', badgeColor: '#059669' },
  { icon: '🐙', label: 'Connect GitHub Repo', sub: 'Link the repository holding COBOL / JCL / PL/I / HLASM source. Fetched automatically via GitHub REST API.', badge: 'REST v3', badgeColor: '#1C7293' },
  { icon: '🕸️', label: 'Deterministic Graph', sub: 'CAST provides a 100%-accurate call tree, SQL table deps, CICS transactions, and file I/O edges. No inference needed.', badge: '100% verified', badgeColor: '#059669' },
  { icon: '🤖', label: 'LLM Analysis', sub: 'Three sequential LLM chains generate Business Rules, Change Impact, and Mod Spec — fully grounded in the deterministic graph. Provider is configurable (Groq, Anthropic, and others).', badge: 'Configurable Provider', badgeColor: '#7C3AED' },
  { icon: '📑', label: 'Four Artifacts', sub: 'Reviewer-ready documentation with no disclaimers. Each claim cites a graph edge. Engineer sign-off gates any action.', badge: '✓ Production-ready', badgeColor: '#059669' },
];

const PATH_B = [
  { icon: '📂', label: 'Source Code Only', sub: 'No CAST reports. The built-in deterministic parser reads COBOL / JCL / PL/I / HLASM source and extracts a call graph directly — no LLM needed for the graph.', badge: 'Built-in parser', badgeColor: '#1C7293' },
  { icon: '🐙', label: 'Connect GitHub Repo', sub: 'Same as Path A — the platform fetches source files from the connected repository via GitHub REST API.', badge: 'REST v3', badgeColor: '#1C7293' },
  { icon: '⚙️', label: 'Deterministic Parse', sub: 'Static CALL detection, paragraph flow, SQL, CICS, file I/O extracted with 95–100% accuracy for static calls. Dynamic CALLs resolved at ~71% confidence via LLM.', badge: '95–100% static', badgeColor: '#059669' },
  { icon: '🤖', label: 'LLM Analysis', sub: 'Same three LLM chains as Path A, grounded in the code-level dependency graph. Confidence is lower on dynamic call paths than CAST.', badge: 'Configurable Provider', badgeColor: '#7C3AED' },
  { icon: '📑', label: 'Four Artifacts', sub: 'All four documents generated with an amber disclaimer. Upload CAST reports at any time to upgrade to full-deterministic.', badge: '⚠ Review required', badgeColor: '#D97706', warn: true },
];

const PATH_C = [
  { icon: '⊘', label: 'No CAST or Parser', sub: 'Neither CAST reports nor parseable source is available. The platform falls back to pure LLM-based graph inference.', badge: 'Fallback only', badgeColor: '#9CA3AF', skip: true },
  { icon: '🐙', label: 'Connect GitHub Repo', sub: 'Same as other paths — source files fetched from the connected repository.', badge: 'REST v3', badgeColor: '#1C7293' },
  { icon: '🔍', label: 'LLM-Inferred Graph', sub: 'Regex extraction + LLM reasoning builds a best-effort dependency graph. Dynamic CALLs ~71% coverage, static CALLs ~95%.', badge: '⚠ ~75% accuracy', badgeColor: '#D97706', warn: true },
  { icon: '🤖', label: 'LLM Analysis', sub: 'Same LLM chains, but grounded in the inferred graph. Reduced confidence on dynamic call paths.', badge: 'Configurable Provider', badgeColor: '#7C3AED', warn: true },
  { icon: '📑', label: 'Four Artifacts', sub: 'All four documents generated with an amber disclaimer. Upload CAST reports or re-run analysis with source to upgrade.', badge: '⚠ Review required', badgeColor: '#D97706', warn: true },
];

const LIMITATIONS = [
  { icon: '⏱', text: 'LLM provider rate limits apply. Analysis of one program takes 20–60 seconds; multiple programs can be queued and run sequentially.' },
  { icon: '📏', text: 'Program size: recommended ≤ 1,500 LOC per file for reliable LLM extraction. Larger programs are truncated to the first 12–14 k characters for LLM chains.' },
  { icon: '🔗', text: 'Dynamic CALL targets (variable-name CALLs) are resolved at ~71% confidence. Assembler dependencies are partially covered by the deterministic parser.' },
  { icon: '🗄', text: 'Results are persisted to Neon PostgreSQL. Each project is isolated; delete a project to reclaim storage.' },
  { icon: '📝', text: 'Domain Glossary in Contextual Engineering requires manual entry — automatic extraction from source is not yet supported.' },
];

const TECH_STACK = [
  { name: 'LLM Engine', detail: 'Groq · Anthropic · OpenAI', color: '#7C3AED', desc: 'Multi-provider — Groq (Llama 3.3 70B), Anthropic (Claude), OpenAI — selectable in LLM Settings' },
  { name: 'Deterministic Parser', detail: 'COBOL · JCL · PL/I · HLASM', color: '#059669', desc: 'Built-in static parser extracts call graphs, SQL, CICS, and file I/O with no LLM required' },
  { name: 'Next.js 15', detail: 'App Router + SSE', color: '#000000', desc: 'React framework — SSE streaming, API routes, server components' },
  { name: 'Neon', detail: 'Serverless Postgres', color: '#00A67E', desc: 'Stores all programs, graphs, and analysis results' },
  { name: 'GitHub API', detail: 'REST v3', color: '#24292F', desc: 'Source discovery — lists files, fetches content by SHA' },
  { name: 'Drizzle ORM', detail: 'Type-safe', color: '#C5A82E', desc: 'Schema-first ORM — migrations via drizzle-kit push' },
];

export default function HomePage() {
  return (
    <div style={{ fontFamily: '"Segoe UI", Arial, sans-serif', color: '#1F2937', background: '#F4F7FA' }}>

      {/* Hero */}
      <section style={{ background: 'linear-gradient(160deg, #0F1E3A 0%, #1F3864 50%, #1a4a6a 100%)', padding: '72px 32px 80px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(28,114,147,0.25)', border: '1px solid rgba(77,170,199,0.4)', borderRadius: 20, padding: '5px 14px', marginBottom: 28, fontSize: 12, color: '#4DAAC7', fontWeight: 600 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4DAAC7', display: 'inline-block' }} />
          Groq · Anthropic · OpenAI · Deterministic Parser · CAST Integration
        </div>
        <h1 style={{ fontSize: 'clamp(32px, 5vw, 54px)', fontWeight: 800, color: '#fff', margin: '0 0 18px', lineHeight: 1.15, letterSpacing: -1 }}>
          Mainframe Knowledge Platform
        </h1>
        <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.72)', maxWidth: 640, margin: '0 auto 36px', lineHeight: 1.7 }}>
          On-demand dependency mapping, business rules extraction, change impact analysis,
          and modernization planning for your mainframe estate — powered by a deterministic parser and AI, grounded in your source code.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
          <Link href="/programs" style={{ background: 'linear-gradient(135deg, #1C7293, #4DAAC7)', color: '#fff', padding: '14px 36px', borderRadius: 8, fontWeight: 700, fontSize: 15, textDecoration: 'none', boxShadow: '0 4px 20px rgba(28,114,147,0.5)' }}>
            Browse Programs →
          </Link>
          <Link href="/architecture" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', padding: '14px 36px', borderRadius: 8, fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>
            Architecture →
          </Link>
          <a href="#how-it-works" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.75)', padding: '14px 28px', borderRadius: 8, fontWeight: 500, fontSize: 14, textDecoration: 'none' }}>
            How it works ↓
          </a>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          {['Dependency Graph', 'Business Rules', 'Change Impact', 'Modernization Spec'].map((f) => (
            <span key={f} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, padding: '5px 14px', fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{f}</span>
          ))}
        </div>
        {/* Supported languages pills */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', alignSelf: 'center' }}>Supports:</span>
          {SUPPORTED_LANGUAGES.map((l) => (
            <span key={l.name} style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${l.color}60`, borderRadius: 20, padding: '3px 10px', fontSize: 11, color: l.color, fontWeight: 600 }}>{l.name}</span>
          ))}
        </div>
      </section>

      {/* Supported Languages Detail */}
      <section style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '40px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#1C7293', textTransform: 'uppercase', marginBottom: 8 }}>Language Support</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1F3864', margin: 0 }}>Supported Mainframe Languages</h2>
            <p style={{ fontSize: 13, color: '#6B7280', marginTop: 8 }}>The built-in deterministic parser supports these languages without requiring a CAST installation.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {SUPPORTED_LANGUAGES.map((l) => (
              <div key={l.name} style={{ border: `1px solid ${l.color}30`, borderRadius: 10, padding: '16px 18px', background: `${l.color}08`, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.color, flexShrink: 0, marginTop: 4 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1F3864', marginBottom: 4 }}>{l.name}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>{l.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" style={{ padding: '72px 32px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#1C7293', textTransform: 'uppercase', marginBottom: 10 }}>Process Flow</div>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: '#1F3864', margin: '0 0 12px' }}>How the Mainframe Knowledge Platform Works</h2>
          <p style={{ fontSize: 14, color: '#6B7280', maxWidth: 640, margin: '0 auto' }}>Three paths depending on what source data is available. All paths produce the same four artifacts — accuracy and confidence differ.</p>
        </div>

        {[
          { steps: PATH_A, label: 'Path A — Full Pipeline (CAST reports available)', isGreen: true, labelColor: '#059669', borderColor: 'rgba(5,150,105,0.3)', bg: 'rgba(5,150,105,0.08)', lineColor: 'rgba(5,150,105,0.2)', icon: '✓' },
          { steps: PATH_B, label: 'Path B — Deterministic Parser (source code, no CAST)', isGreen: true, labelColor: '#1C7293', borderColor: 'rgba(28,114,147,0.3)', bg: 'rgba(28,114,147,0.06)', lineColor: 'rgba(28,114,147,0.2)', icon: '⚙' },
          { steps: PATH_C, label: 'Path C — Fallback Mode (LLM inference only)', isGreen: false, labelColor: '#D97706', borderColor: 'rgba(217,119,6,0.35)', bg: 'rgba(217,119,6,0.08)', lineColor: 'rgba(217,119,6,0.2)', icon: '⚠' },
        ].map(({ steps, label, labelColor, borderColor, bg, lineColor, icon }) => (
          <div key={label} style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderRadius: 20, background: bg, border: `1px solid ${borderColor}` }}>
                <span style={{ fontSize: 13 }}>{icon}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: labelColor, letterSpacing: 0.5 }}>{label}</span>
              </div>
              <div style={{ flex: 1, height: 1, background: lineColor }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
              {steps.map((s, i) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'flex-start', flex: 1 }}>
                  <div style={{ flex: 1, textAlign: 'center', padding: '0 8px' }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: '50%', margin: '0 auto 10px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                      background: (s as {skip?: boolean}).skip ? '#F3F4F6' : '#fff',
                      border: `2.5px solid ${(s as {skip?: boolean}).skip ? '#D1D5DB' : (s as {warn?: boolean}).warn ? '#D97706' : labelColor}`,
                      boxShadow: (s as {skip?: boolean}).skip ? 'none' : `0 4px 14px ${(s as {warn?: boolean}).warn ? 'rgba(217,119,6,0.15)' : 'rgba(28,114,147,0.15)'}`,
                      opacity: (s as {skip?: boolean}).skip ? 0.5 : 1,
                    }}>
                      {s.icon}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 12, color: (s as {skip?: boolean}).skip ? '#9CA3AF' : '#1F3864', marginBottom: 5, lineHeight: 1.3 }}>{s.label}</div>
                    <div style={{ fontSize: 10, color: '#6B7280', lineHeight: 1.6, marginBottom: 8, minHeight: 48 }}>{s.sub}</div>
                    <span style={{ display: 'inline-block', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: `${s.badgeColor}18`, color: s.badgeColor, border: `1px solid ${s.badgeColor}40` }}>
                      {s.badge}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', paddingTop: 26, flexShrink: 0 }}>
                      <div style={{ width: 24, height: 2, background: (s as {skip?: boolean}).skip ? '#D1D5DB' : labelColor }} />
                      <div style={{ width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: `6px solid ${(s as {skip?: boolean}).skip ? '#D1D5DB' : labelColor}` }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ marginTop: 8, background: '#EBF4FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>💡</span>
          <div style={{ fontSize: 13, color: '#1D4ED8', lineHeight: 1.6 }}>
            <strong>Upgrading paths:</strong> Upload CAST reports to move from Path B or C to Path A at any time. The platform replaces the inferred/parsed graph with the deterministic one and removes all amber disclaimers from that project's artifacts.
          </div>
        </div>
      </section>

      {/* Artifacts */}
      <section style={{ background: '#fff', padding: '72px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#1C7293', textTransform: 'uppercase', marginBottom: 10 }}>Output</div>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: '#1F3864', margin: 0 }}>Four Documentation Artifacts</h2>
            <p style={{ fontSize: 15, color: '#6B7280', marginTop: 10, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>Every artifact is grounded in the dependency graph and requires engineer sign-off before driving any action.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
            {ARTIFACTS.map((a) => (
              <div key={a.title} style={{ border: '1px solid #E5E7EB', borderRadius: 12, padding: 24, background: '#FAFAFA' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 28 }}>{a.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#1F3864' }}>{a.title}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: a.badgeColor, letterSpacing: 0.5, marginTop: 2 }}>{a.badge}</div>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.7, margin: '0 0 12px' }}>{a.desc}</p>
                <div style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'Consolas, monospace', background: '#F3F4F6', borderRadius: 6, padding: '6px 10px' }}>{a.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section style={{ padding: '72px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#1C7293', textTransform: 'uppercase', marginBottom: 10 }}>Architecture</div>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: '#1F3864', margin: 0 }}>System Pipeline</h2>
          <p style={{ fontSize: 14, color: '#6B7280', marginTop: 10 }}>Two parallel paths produce the dependency graph — deterministic parser (instant, no LLM) and LLM inference (fallback). LLM chains consume the graph regardless of source.</p>
        </div>
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', padding: 32 }}>
          {/* Deterministic path */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Deterministic Path (no LLM)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto' }}>
              {[
                { label: 'GitHub', sub: 'REST API', bg: '#24292F', icon: '🐙' },
                { label: 'Source Files', sub: 'COBOL·JCL·PL/I·HLASM', bg: '#1C7293', icon: '📄' },
                { label: 'Static Parser', sub: 'Built-in, no LLM', bg: '#059669', icon: '⚙️' },
                { label: 'Dep Graph', sub: 'Call·SQL·CICS·FileIO', bg: '#1F3864', icon: '🕸️' },
              ].map((box, i, arr) => (
                <div key={box.label} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ background: box.bg, color: '#fff', borderRadius: 10, padding: '12px 18px', textAlign: 'center', minWidth: 110 }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{box.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{box.label}</div>
                    <div style={{ fontSize: 10, opacity: 0.7, marginTop: 1 }}>{box.sub}</div>
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 6px' }}>
                      <div style={{ width: 24, height: 2, background: '#059669' }} />
                      <span style={{ color: '#059669', fontSize: 10 }}>▶</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* LLM path */}
          <div style={{ marginBottom: 24, paddingTop: 16, borderTop: '1px dashed #E5E7EB' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>LLM Analysis Path</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto' }}>
              {[
                { label: 'Dep Graph', sub: 'From parser or CAST', bg: '#1F3864', icon: '🕸️' },
                { label: 'LLM Engine', sub: 'Groq · Anthropic · OAI', bg: '#7C3AED', icon: '🤖' },
                { label: 'Neon DB', sub: 'PostgreSQL', bg: '#00875A', icon: '🗄' },
                { label: 'Hub UI', sub: 'Next.js 15', bg: '#2E4D7B', icon: '📊' },
              ].map((box, i, arr) => (
                <div key={box.label} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ background: box.bg, color: '#fff', borderRadius: 10, padding: '12px 18px', textAlign: 'center', minWidth: 110 }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{box.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{box.label}</div>
                    <div style={{ fontSize: 10, opacity: 0.7, marginTop: 1 }}>{box.sub}</div>
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 6px' }}>
                      <div style={{ width: 24, height: 2, background: '#7C3AED' }} />
                      <span style={{ color: '#7C3AED', fontSize: 10 }}>▶</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', paddingTop: 16, borderTop: '1px dashed #E5E7EB' }}>
            {['SSE Streaming', 'Real-time log lines', 'Drizzle ORM', 'Type-safe schema', 'Deterministic + LLM hybrid', 'Engineer validation gate'].map((c) => (
              <span key={c} style={{ fontSize: 11, background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#6B7280', borderRadius: 20, padding: '4px 12px', fontWeight: 500 }}>{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Limitations */}
      <section style={{ background: '#FFF8EC', borderTop: '1px solid #FDE68A', borderBottom: '1px solid #FDE68A', padding: '60px 32px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#92400E', textTransform: 'uppercase', marginBottom: 10 }}>Known Constraints</div>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: '#78350F', margin: 0 }}>Current Limitations</h2>
            <p style={{ fontSize: 14, color: '#92400E', marginTop: 8 }}>Understand these constraints before relying on generated output in production decisions.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
            {LIMITATIONS.map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, background: '#fff', borderRadius: 10, padding: '14px 16px', border: '1px solid #FDE68A', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{l.icon}</span>
                <span style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.6 }}>{l.text}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24, background: '#1F3864', borderRadius: 10, padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'center' }}>
            <span style={{ fontSize: 20 }}>🎯</span>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
              <strong style={{ color: '#4DAAC7' }}>Production path:</strong> Supplement or replace the built-in parser with CAST static analysis for 100% deterministic, CAST-verified dependency graphs. The LLM documentation chains remain unchanged — they consume the graph regardless of source.
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section style={{ padding: '60px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#1C7293', textTransform: 'uppercase', marginBottom: 10 }}>Built With</div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#1F3864', margin: 0 }}>Technology Stack</h2>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          {TECH_STACK.map((t) => (
            <div key={t.name} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '18px 20px', minWidth: 180, flex: '1 1 180px', maxWidth: 210 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1F3864' }}>{t.name}</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#1C7293', marginBottom: 6 }}>{t.detail}</div>
              <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>{t.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: 'linear-gradient(135deg, #1F3864, #1C7293)', padding: '60px 32px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 30, fontWeight: 800, color: '#fff', margin: '0 0 12px' }}>Ready to analyse your mainframe estate?</h2>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.75)', margin: '0 0 32px' }}>Connect a GitHub repository and get dependency maps, business rules, and modernization specs in under 60 seconds.</p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/programs" style={{ background: '#fff', color: '#1F3864', padding: '14px 40px', borderRadius: 8, fontWeight: 800, fontSize: 15, textDecoration: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            Browse Programs →
          </Link>
          <Link href="/admin" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '14px 32px', borderRadius: 8, fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>
            Admin / Maintenance
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#0F1E3A', padding: '24px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 900, fontSize: 14, color: '#4DAAC7' }}>MKP</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>— Mainframe Knowledge Platform</span>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          {([['Programs', '/programs'], ['Architecture', '/architecture'], ['Admin', '/admin']] as const).map(([label, href]) => (
            <Link key={label} href={href} style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>{label}</Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
