'use client';

import Link from 'next/link';

const ARTIFACTS = [
  {
    icon: '🔗',
    title: 'Dependency Graph',
    badge: 'LLM · Graph Analysis',
    badgeColor: '#1C7293',
    desc: 'Visual call and data-flow map of every COBOL program. Shows static CALL edges, EXEC SQL table dependencies, CICS transactions, and dynamic calls with confidence scores.',
    detail: 'Nodes: hero / prog / data / asm · Edge types: call · data · cics · dyn',
  },
  {
    icon: '📋',
    title: 'Business Rules',
    badge: 'LLM · Grounded in Graph',
    badgeColor: '#27AE60',
    desc: 'Plain-language extraction of what the program does — grouped into sections (Input Processing, Core Logic, Data Persistence, External Integrations, Error Handling). Every claim cites a graph edge.',
    detail: '5 sections · Multi-sentence rules · COBOL field citations',
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
    desc: '7-section specification targeting Java / Spring Boot: Executive Summary, Architecture Analysis, Modernization Strategy, Interface Contracts, Data Layer Migration, Migration Roadmap, Risk Assessment.',
    detail: 'Draft · engineer validation required before use',
  },
];

const PATH_A = [
  { icon: '📤', label: 'Upload CAST Reports', sub: 'Import deterministic dependency output from CAST static analysis (.xml or .json). This is the gold-standard source of truth.', badge: 'Required for full accuracy', badgeColor: '#059669' },
  { icon: '🐙', label: 'Connect GitHub Repo', sub: 'Link the repository holding your COBOL / HLASM source. MAVEN fetches files automatically via the GitHub REST API.', badge: 'REST v3', badgeColor: '#1C7293' },
  { icon: '🕸️', label: 'Deterministic Graph', sub: 'CAST provides a 100%-accurate call tree, SQL table deps, CICS transactions, and file I/O edges. No inference needed.', badge: '100% verified', badgeColor: '#059669' },
  { icon: '🤖', label: 'Groq LLM Analysis', sub: 'Three sequential Llama 3.3-70B chains generate Business Rules, Change Impact, and Mod Spec — fully grounded in the deterministic graph.', badge: 'Llama 3.3-70B', badgeColor: '#7C3AED' },
  { icon: '📑', label: 'Four Artifacts', sub: 'Clean, reviewer-ready documentation with no disclaimers. Each claim cites a graph edge. Engineer sign-off gates any action.', badge: '✓ Production-ready', badgeColor: '#059669' },
];

const PATH_B = [
  { icon: '⊘', label: 'No CAST Reports', sub: 'CAST output is not available. MAVEN falls back to LLM-based graph inference from source code.', badge: 'Skipped', badgeColor: '#9CA3AF', skip: true },
  { icon: '🐙', label: 'Connect GitHub Repo', sub: 'Same as Path A — MAVEN fetches COBOL / HLASM source files from the connected repository.', badge: 'REST v3', badgeColor: '#1C7293' },
  { icon: '🔍', label: 'LLM-Inferred Graph', sub: 'Regex extraction + Groq LLM reasoning builds a best-effort dependency graph. Dynamic CALLs ~71% coverage, static CALLs ~95%.', badge: '⚠ ~75% accuracy', badgeColor: '#D97706', warn: true },
  { icon: '🤖', label: 'Groq LLM Analysis', sub: 'Same LLM chains as Path A, but grounded in the inferred graph. Reduced confidence on dynamic call paths.', badge: 'Llama 3.3-70B', badgeColor: '#7C3AED', warn: true },
  { icon: '📑', label: 'Four Artifacts', sub: 'All four documents are generated with an amber disclaimer banner. Upload CAST reports at any time to upgrade to deterministic.', badge: '⚠ Review required', badgeColor: '#D97706', warn: true },
];

const LIMITATIONS = [
  { icon: '⚠', text: 'No CAST static analysis — dependency graphs are LLM-inferred from source, not deterministically computed. Accuracy ~70–85%; verify critical paths manually.' },
  { icon: '📏', text: 'Program size: recommended ≤ 1,500 LOC per file for reliable LLM extraction. Larger programs are truncated to the first 12–14 k characters.' },
  { icon: '⏱', text: 'Groq free tier rate limits apply. Analysis of one program takes 20–60 seconds. Parallel analysis is not supported in demo mode.' },
  { icon: '🔗', text: 'Dynamic CALL targets (variable-name CALLs) are resolved at ~71% confidence. Assembler dependencies are partially covered.' },
  { icon: '🗄', text: 'Results are persisted to Neon PostgreSQL. Each project is isolated; delete a project to reclaim storage.' },
];

const TECH_STACK = [
  { name: 'Groq API', detail: 'Llama 3.3 70B', color: '#F55036', desc: 'LLM engine — free tier, OpenAI-compatible, ~200 token/s throughput' },
  { name: 'Next.js 14', detail: 'App Router + SSE', color: '#000000', desc: 'React framework — SSE streaming, API routes, server components' },
  { name: 'Neon', detail: 'Serverless Postgres', color: '#00A67E', desc: 'Stores all programs, graphs, and analysis results' },
  { name: 'GitHub API', detail: 'REST v3', color: '#24292F', desc: 'Source discovery — lists COBOL files, fetches content by SHA' },
  { name: 'Drizzle ORM', detail: 'Type-safe', color: '#C5A82E', desc: 'Schema-first ORM — migrations via drizzle-kit push' },
];

export default function HomePage() {
  return (
    <div style={{ fontFamily: '"Segoe UI", Arial, sans-serif', color: '#1F2937', background: '#F4F7FA', minHeight: '100vh' }}>

      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg, #1F3864 0%, #2E4D7B 60%, #1C7293 100%)', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 900, fontSize: 18, color: '#4DAAC7', letterSpacing: 2 }}>MAVEN</span>
          <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#fff', lineHeight: 1 }}>CARTA</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.5, lineHeight: 1, marginTop: 2 }}>Mainframe Intelligence</div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ background: 'rgba(224,123,57,0.25)', border: '1px solid rgba(224,123,57,0.6)', color: '#FCD58A', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
          DEMO · Groq API
        </span>
        <Link href="/admin" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, textDecoration: 'none', padding: '4px 10px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6 }}>
          Admin
        </Link>
      </header>

      {/* Hero */}
      <section style={{ background: 'linear-gradient(160deg, #0F1E3A 0%, #1F3864 50%, #1a4a6a 100%)', padding: '72px 32px 80px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(28,114,147,0.25)', border: '1px solid rgba(77,170,199,0.4)', borderRadius: 20, padding: '5px 14px', marginBottom: 28, fontSize: 12, color: '#4DAAC7', fontWeight: 600 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4DAAC7', display: 'inline-block' }} />
          Demo Mode · Groq Llama 3.3 70B · LLM Dependency Analysis · No CAST Reports
        </div>
        <h1 style={{ fontSize: 'clamp(32px, 5vw, 54px)', fontWeight: 800, color: '#fff', margin: '0 0 18px', lineHeight: 1.15, letterSpacing: -1 }}>
          COBOL Intelligence Platform
        </h1>
        <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.72)', maxWidth: 640, margin: '0 auto 36px', lineHeight: 1.7 }}>
          On-demand dependency mapping, business rules extraction, change impact analysis,
          and modernization planning for your mainframe COBOL estate — powered by AI and grounded in your source code.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
          <Link href="/programs" style={{ background: 'linear-gradient(135deg, #1C7293, #4DAAC7)', color: '#fff', padding: '14px 36px', borderRadius: 8, fontWeight: 700, fontSize: 15, textDecoration: 'none', boxShadow: '0 4px 20px rgba(28,114,147,0.5)' }}>
            Launch Demo →
          </Link>
          <a href="#how-it-works" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', padding: '14px 36px', borderRadius: 8, fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>
            How it works ↓
          </a>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {['Dependency Graph', 'Business Rules', 'Change Impact', 'Modernization Spec'].map((f) => (
            <span key={f} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, padding: '5px 14px', fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{f}</span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" style={{ padding: '72px 32px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#1C7293', textTransform: 'uppercase', marginBottom: 10 }}>Process Flow</div>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: '#1F3864', margin: '0 0 12px' }}>How MAVEN/CARTA Works</h2>
          <p style={{ fontSize: 14, color: '#6B7280', maxWidth: 560, margin: '0 auto' }}>Two paths depending on whether CAST deterministic reports are available. Both produce the same four artifacts — accuracy and confidence differ.</p>
        </div>

        {/* Path A */}
        {[{ steps: PATH_A, isA: true }, { steps: PATH_B, isA: false }].map(({ steps, isA }) => (
          <div key={String(isA)} style={{ marginBottom: 40 }}>
            {/* Path label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderRadius: 20, background: isA ? 'rgba(5,150,105,0.08)' : 'rgba(217,119,6,0.08)', border: `1px solid ${isA ? 'rgba(5,150,105,0.3)' : 'rgba(217,119,6,0.35)'}` }}>
                <span style={{ fontSize: 13 }}>{isA ? '✓' : '⚠'}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: isA ? '#059669' : '#D97706', letterSpacing: 0.5 }}>
                  {isA ? 'Path A — Full Pipeline (CAST reports available)' : 'Path B — Fallback Mode (no CAST reports)'}
                </span>
              </div>
              <div style={{ flex: 1, height: 1, background: isA ? 'rgba(5,150,105,0.2)' : 'rgba(217,119,6,0.2)' }} />
            </div>

            {/* Steps row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
              {steps.map((s, i) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'flex-start', flex: 1 }}>
                  {/* Node */}
                  <div style={{ flex: 1, textAlign: 'center', padding: '0 8px' }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: '50%', margin: '0 auto 10px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                      background: (s as {skip?: boolean}).skip ? '#F3F4F6' : '#fff',
                      border: `2.5px solid ${(s as {skip?: boolean}).skip ? '#D1D5DB' : (s as {warn?: boolean}).warn ? '#D97706' : isA && i === 0 ? '#059669' : '#1C7293'}`,
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
                  {/* Arrow connector */}
                  {i < steps.length - 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', paddingTop: 26, flexShrink: 0 }}>
                      <div style={{ width: 24, height: 2, background: isA && !((steps[i+1] as {warn?: boolean}).warn) ? '#1C7293' : (s as {skip?: boolean}).skip ? '#D1D5DB' : '#D97706' }} />
                      <div style={{ width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: `6px solid ${isA && !((steps[i+1] as {warn?: boolean}).warn) ? '#1C7293' : (s as {skip?: boolean}).skip ? '#D1D5DB' : '#D97706'}` }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Upgrade callout */}
        <div style={{ marginTop: 8, background: '#EBF4FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>💡</span>
          <div style={{ fontSize: 13, color: '#1D4ED8', lineHeight: 1.6 }}>
            <strong>Upgrading from Path B to Path A:</strong> upload CAST reports for any project at any time. MAVEN will replace the LLM-inferred graph with the deterministic one and remove all amber disclaimers from that project's artifacts.
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
        </div>
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', padding: 32, overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', minWidth: 700, justifyContent: 'center', gap: 0 }}>
            {[
              { label: 'GitHub', sub: 'REST API', bg: '#24292F', icon: '🐙', arrow: 'fetch' },
              { label: 'Ingest', sub: 'File fetch + parse', bg: '#1F3864', icon: '⬇', arrow: 'stream' },
              { label: 'Groq LLM', sub: 'Llama 3.3 70B', bg: '#1C7293', icon: '🤖', arrow: 'save' },
              { label: 'Neon DB', sub: 'PostgreSQL', bg: '#00875A', icon: '🗄', arrow: 'render' },
              { label: 'Hub UI', sub: 'Next.js', bg: '#2E4D7B', icon: '📊', arrow: '' },
            ].map((box, i, arr) => (
              <div key={box.label} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ background: box.bg, color: '#fff', borderRadius: 10, padding: '16px 22px', textAlign: 'center', minWidth: 110 }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{box.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{box.label}</div>
                  <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{box.sub}</div>
                </div>
                {i < arr.length - 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 6px', gap: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ width: 32, height: 2, background: '#1C7293' }} />
                      <span style={{ color: '#1C7293', fontSize: 12, lineHeight: 1 }}>▶</span>
                    </div>
                    <span style={{ fontSize: 9, color: '#9CA3AF' }}>{box.arrow}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['SSE Streaming', 'Real-time log lines', 'Drizzle ORM', 'Type-safe schema', 'Engineer validation gate'].map((c) => (
              <span key={c} style={{ fontSize: 11, background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#6B7280', borderRadius: 20, padding: '4px 12px', fontWeight: 500 }}>{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Limitations */}
      <section style={{ background: '#FFF8EC', borderTop: '1px solid #FDE68A', borderBottom: '1px solid #FDE68A', padding: '60px 32px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#92400E', textTransform: 'uppercase', marginBottom: 10 }}>Demo Mode Constraints</div>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: '#78350F', margin: 0 }}>Current Limitations</h2>
            <p style={{ fontSize: 14, color: '#92400E', marginTop: 8 }}>This demo uses Groq API without a CAST static analysis engine. Understand these constraints before relying on output.</p>
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
              <strong style={{ color: '#4DAAC7' }}>Production path:</strong> Replace LLM graph extraction with CAST static analysis for deterministic, ~100% accurate dependency graphs. The three LLM documentation chains remain unchanged — they consume the graph regardless of source.
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
        <h2 style={{ fontSize: 30, fontWeight: 800, color: '#fff', margin: '0 0 12px' }}>Ready to analyse your COBOL estate?</h2>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.75)', margin: '0 0 32px' }}>Connect a GitHub repository and get dependency maps, business rules, and modernization specs in under 60 seconds.</p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/programs" style={{ background: '#fff', color: '#1F3864', padding: '14px 40px', borderRadius: 8, fontWeight: 800, fontSize: 15, textDecoration: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            Launch Demo →
          </Link>
          <Link href="/admin" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '14px 32px', borderRadius: 8, fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>
            Admin / Maintenance
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#0F1E3A', padding: '24px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 900, fontSize: 14, color: '#4DAAC7' }}>MAVEN/CARTA</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>— Illustrative Prototype · Not for production use</span>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          {([['Demo', '/programs'], ['Admin', '/admin']] as const).map(([label, href]) => (
            <Link key={label} href={href} style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>{label}</Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
