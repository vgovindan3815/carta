'use client';

import Link from 'next/link';

export default function ArchitecturePage() {
  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <header style={{ background: '#0F1E3A', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 900, fontSize: 16, color: '#4DAAC7', letterSpacing: 1 }}>MAVEN</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 }}>/ CARTA</span>
        </Link>
        <nav style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          {([['Programs', '/programs'], ['Agents', '/agents'], ['Context', '/context'], ['Architecture', '/architecture'], ['Settings', '/settings']] as const).map(([label, href]) => (
            <Link key={label} href={href} style={{
              fontSize: 13, fontWeight: label === 'Architecture' ? 700 : 500,
              color: label === 'Architecture' ? '#4DAAC7' : 'rgba(255,255,255,0.6)',
              textDecoration: 'none',
              borderBottom: label === 'Architecture' ? '2px solid #4DAAC7' : 'none',
              paddingBottom: 2,
            }}>{label}</Link>
          ))}
        </nav>
      </header>

      {/* Page title */}
      <div style={{ background: '#1F3864', padding: '36px 48px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#4DAAC7', textTransform: 'uppercase', marginBottom: 8 }}>Platform Reference</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>System Architecture</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', margin: 0, lineHeight: 1.6 }}>
            End-to-end view of MAVEN/CARTA — ingestion, analysis pipeline, context/RAG layer, storage, and UI.
          </p>
        </div>
      </div>

      {/* Main content */}
      <main style={{ maxWidth: 1140, margin: '0 auto', padding: '40px 32px' }}>

        {/* --- DIAGRAM 1: Full flow --- */}
        <section style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '28px 28px 20px', marginBottom: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1F3864', margin: 0 }}>End-to-End Flow</h2>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>Ingestion → Pipeline → Storage → UI</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <svg viewBox="0 0 900 620" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', minWidth: 700 }} role="img" aria-label="MAVEN/CARTA end-to-end architecture">
              <defs>
                <marker id="a1" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#6B7280"/></marker>
                <marker id="a2" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#2E5FA3"/></marker>
                <marker id="a3" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#27AE60"/></marker>
                <marker id="a4" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#C55A11"/></marker>
              </defs>
              {/* Lane backgrounds */}
              <rect x="8" y="28" width="165" height="580" rx="8" fill="#F0F4FF" stroke="#C7D5F5" strokeWidth="1"/>
              <text x="90" y="48" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#2E5FA3" letterSpacing="1">INGESTION</text>
              <rect x="181" y="28" width="205" height="580" rx="8" fill="#F5F5F5" stroke="#D1D5DB" strokeWidth="1"/>
              <text x="283" y="48" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#4B5563" letterSpacing="1">ANALYSIS PIPELINE</text>
              <rect x="394" y="28" width="150" height="580" rx="8" fill="#F0FFF4" stroke="#BBF7D0" strokeWidth="1"/>
              <text x="469" y="48" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#27AE60" letterSpacing="1">STORAGE</text>
              <rect x="552" y="28" width="340" height="580" rx="8" fill="#FFF8F0" stroke="#FDE8C8" strokeWidth="1"/>
              <text x="722" y="48" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#C55A11" letterSpacing="1">USER INTERFACE</text>

              {/* Ingestion boxes */}
              <rect x="18" y="62" width="145" height="44" rx="5" fill="#1F3864"/>
              <text x="90" y="80" textAnchor="middle" fontSize="11" fontWeight="700" fill="white">GitHub Repo</text>
              <text x="90" y="94" textAnchor="middle" fontSize="8.5" fill="#A5B4D4">.cbl · .jcl · .cpy · .pli</text>
              <rect x="18" y="118" width="145" height="44" rx="5" fill="#1F3864"/>
              <text x="90" y="136" textAnchor="middle" fontSize="11" fontWeight="700" fill="white">CAST Reports</text>
              <text x="90" y="150" textAnchor="middle" fontSize="8.5" fill="#A5B4D4">XML dep graph import</text>
              <rect x="18" y="174" width="145" height="44" rx="5" fill="#1F3864"/>
              <text x="90" y="192" textAnchor="middle" fontSize="11" fontWeight="700" fill="white">File Upload</text>
              <text x="90" y="206" textAnchor="middle" fontSize="8.5" fill="#A5B4D4">ZIP · extensionless legacy</text>

              {/* Pipeline boxes */}
              <rect x="191" y="62" width="185" height="76" rx="5" fill="white" stroke="#D1D5DB" strokeWidth="1.5"/>
              <text x="283" y="81" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#1F3864">Parser / Scanner</text>
              <line x1="201" y1="88" x2="366" y2="88" stroke="#E5E7EB" strokeWidth="1"/>
              <text x="283" y="103" textAnchor="middle" fontSize="8.5" fill="#4B5563">COBOL · JCL · Copybook parser</text>
              <text x="283" y="116" textAnchor="middle" fontSize="8.5" fill="#4B5563">Content-detect · static dep graph</text>
              <text x="283" y="129" textAnchor="middle" fontSize="8.5" fill="#4B5563">Parallel batch fetch (GitHub API)</text>

              <rect x="191" y="152" width="185" height="54" rx="5" fill="white" stroke="#D1D5DB" strokeWidth="1.5"/>
              <text x="283" y="171" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#1F3864">Orchestrator</text>
              <line x1="201" y1="178" x2="366" y2="178" stroke="#E5E7EB" strokeWidth="1"/>
              <text x="283" y="192" textAnchor="middle" fontSize="8.5" fill="#4B5563">Job lifecycle · SSE stream</text>
              <text x="283" y="204" textAnchor="middle" fontSize="8.5" fill="#4B5563">Context assembly (copybooks, glossary)</text>

              <rect x="191" y="220" width="185" height="160" rx="5" fill="white" stroke="#D1D5DB" strokeWidth="1.5"/>
              <text x="283" y="239" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#1F3864">LLM Chains</text>
              <line x1="201" y1="246" x2="366" y2="246" stroke="#E5E7EB" strokeWidth="1"/>
              <rect x="200" y="252" width="167" height="17" rx="3" fill="#EEF2FF"/>
              <text x="283" y="264" textAnchor="middle" fontSize="8.5" fill="#2E5FA3" fontWeight="600">Chain 1 — Module Facts</text>
              <rect x="200" y="273" width="167" height="17" rx="3" fill="#EEF2FF"/>
              <text x="283" y="285" textAnchor="middle" fontSize="8.5" fill="#2E5FA3" fontWeight="600">Chain 2 — Business Rules (BRD)</text>
              <rect x="200" y="294" width="167" height="17" rx="3" fill="#EEF2FF"/>
              <text x="283" y="306" textAnchor="middle" fontSize="8.5" fill="#2E5FA3" fontWeight="600">Chain 3 — Change Impact</text>
              <rect x="200" y="315" width="167" height="17" rx="3" fill="#EEF2FF"/>
              <text x="283" y="327" textAnchor="middle" fontSize="8.5" fill="#2E5FA3" fontWeight="600">Chain 4 — Tech Spec</text>
              <rect x="200" y="336" width="167" height="17" rx="3" fill="#EEF2FF"/>
              <text x="283" y="348" textAnchor="middle" fontSize="8.5" fill="#2E5FA3" fontWeight="600">Chain 5 — Modernization Brief</text>
              <text x="283" y="368" textAnchor="middle" fontSize="8.5" fill="#9CA3AF">Groq · Anthropic · OpenAI</text>

              <rect x="191" y="396" width="185" height="52" rx="5" fill="white" stroke="#D1D5DB" strokeWidth="1.5"/>
              <text x="283" y="415" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#1F3864">Agent Runner</text>
              <line x1="201" y1="422" x2="366" y2="422" stroke="#E5E7EB" strokeWidth="1"/>
              <text x="283" y="436" textAnchor="middle" fontSize="8.5" fill="#4B5563">Anthropic tool-use loop</text>
              <text x="283" y="448" textAnchor="middle" fontSize="8.5" fill="#4B5563">DB tools · trigger analysis</text>

              {/* Storage */}
              <rect x="403" y="62" width="132" height="260" rx="5" fill="white" stroke="#BBF7D0" strokeWidth="1.5"/>
              <text x="469" y="81" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#1F3864">Neon PostgreSQL</text>
              <line x1="413" y1="88" x2="525" y2="88" stroke="#E5E7EB" strokeWidth="1"/>
              <text x="469" y="103" textAnchor="middle" fontSize="8" fill="#4B5563" fontWeight="600">repos · programs</text>
              <text x="469" y="116" textAnchor="middle" fontSize="8" fill="#4B5563">analysis_jobs</text>
              <text x="469" y="129" textAnchor="middle" fontSize="8" fill="#4B5563">dep_graphs · module_facts</text>
              <text x="469" y="142" textAnchor="middle" fontSize="8" fill="#4B5563">biz_rules · change_impacts</text>
              <text x="469" y="155" textAnchor="middle" fontSize="8" fill="#4B5563">mod_specs · tech_specs</text>
              <text x="469" y="168" textAnchor="middle" fontSize="8" fill="#4B5563">copybooks · domain_glossary</text>
              <text x="469" y="181" textAnchor="middle" fontSize="8" fill="#4B5563">scan_jobs · llm_settings</text>
              <text x="469" y="194" textAnchor="middle" fontSize="8" fill="#4B5563">agent_runs</text>
              <text x="469" y="214" textAnchor="middle" fontSize="8" fill="#27AE60" fontWeight="600">Drizzle ORM</text>
              <rect x="412" y="230" width="113" height="20" rx="3" fill="#F0FFF4"/>
              <text x="469" y="244" textAnchor="middle" fontSize="8" fill="#27AE60">Structured RAG retrieval</text>
              <text x="469" y="260" textAnchor="middle" fontSize="8" fill="#9CA3AF">SQL join → prompt inject</text>
              <text x="469" y="273" textAnchor="middle" fontSize="8" fill="#9CA3AF">No vectors (current)</text>
              <text x="469" y="286" textAnchor="middle" fontSize="8" fill="#9CA3AF">pgvector planned</text>
              <text x="469" y="299" textAnchor="middle" fontSize="7.5" fill="#6B7280" fontStyle="italic">program_sources</text>
              <text x="469" y="312" textAnchor="middle" fontSize="7.5" fill="#6B7280" fontStyle="italic">upload:// · cast://</text>

              {/* UI */}
              <rect x="562" y="62" width="136" height="118" rx="5" fill="white" stroke="#FDE8C8" strokeWidth="1.5"/>
              <text x="630" y="81" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#1F3864">Program Hub</text>
              <line x1="572" y1="88" x2="688" y2="88" stroke="#E5E7EB" strokeWidth="1"/>
              <text x="630" y="103" textAnchor="middle" fontSize="8.5" fill="#4B5563">Overview · Dep graph</text>
              <text x="630" y="116" textAnchor="middle" fontSize="8.5" fill="#4B5563">BRD · Change impact</text>
              <text x="630" y="129" textAnchor="middle" fontSize="8.5" fill="#4B5563">Modernization spec</text>
              <text x="630" y="142" textAnchor="middle" fontSize="8.5" fill="#4B5563">SSE progress stream</text>
              <text x="630" y="155" textAnchor="middle" fontSize="8.5" fill="#4B5563">Re-analyze / Refresh</text>
              <text x="630" y="168" textAnchor="middle" fontSize="8.5" fill="#4B5563">Pipeline status badges</text>

              <rect x="562" y="196" width="136" height="64" rx="5" fill="white" stroke="#FDE8C8" strokeWidth="1.5"/>
              <text x="630" y="215" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#1F3864">Agent Chat</text>
              <line x1="572" y1="222" x2="688" y2="222" stroke="#E5E7EB" strokeWidth="1"/>
              <text x="630" y="237" textAnchor="middle" fontSize="8.5" fill="#4B5563">Conversational Q&amp;A</text>
              <text x="630" y="250" textAnchor="middle" fontSize="8.5" fill="#4B5563">Tool-use · trigger analysis</text>

              <rect x="562" y="276" width="136" height="52" rx="5" fill="white" stroke="#FDE8C8" strokeWidth="1.5"/>
              <text x="630" y="295" textAnchor="middle" fontSize="10" fontWeight="700" fill="#1F3864">Context Engineering</text>
              <line x1="572" y1="302" x2="688" y2="302" stroke="#E5E7EB" strokeWidth="1"/>
              <text x="630" y="317" textAnchor="middle" fontSize="8.5" fill="#4B5563">Copybook registry</text>
              <text x="630" y="330" textAnchor="middle" fontSize="8.5" fill="#4B5563">Domain glossary · Portfolio</text>

              <rect x="706" y="62" width="178" height="266" rx="5" fill="white" stroke="#FDE8C8" strokeWidth="1.5"/>
              <text x="795" y="81" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#1F3864">Next.js 15 App Router</text>
              <line x1="716" y1="88" x2="874" y2="88" stroke="#E5E7EB" strokeWidth="1"/>
              <text x="795" y="104" textAnchor="middle" fontSize="8.5" fill="#6B7280" fontWeight="600">API Routes</text>
              <text x="795" y="118" textAnchor="middle" fontSize="8.5" fill="#4B5563">/api/repos  ·  /api/programs</text>
              <text x="795" y="131" textAnchor="middle" fontSize="8.5" fill="#4B5563">/api/programs/upload</text>
              <text x="795" y="144" textAnchor="middle" fontSize="8.5" fill="#4B5563">/api/jobs/[id] (SSE 300s)</text>
              <text x="795" y="157" textAnchor="middle" fontSize="8.5" fill="#4B5563">/api/agents/chat</text>
              <line x1="716" y1="167" x2="874" y2="167" stroke="#E5E7EB" strokeWidth="1"/>
              <text x="795" y="183" textAnchor="middle" fontSize="8.5" fill="#6B7280" fontWeight="600">Pages</text>
              <text x="795" y="197" textAnchor="middle" fontSize="8.5" fill="#4B5563">/programs  ·  /programs/[name]</text>
              <text x="795" y="210" textAnchor="middle" fontSize="8.5" fill="#4B5563">/agents  ·  /context</text>
              <text x="795" y="223" textAnchor="middle" fontSize="8.5" fill="#4B5563">/settings  ·  /architecture</text>
              <line x1="716" y1="233" x2="874" y2="233" stroke="#E5E7EB" strokeWidth="1"/>
              <text x="795" y="249" textAnchor="middle" fontSize="8.5" fill="#6B7280" fontWeight="600">Deploy</text>
              <text x="795" y="263" textAnchor="middle" fontSize="8.5" fill="#4B5563">Vercel (auto from master)</text>
              <text x="795" y="276" textAnchor="middle" fontSize="8.5" fill="#4B5563">Edge runtime · Neon serverless</text>
              <line x1="716" y1="286" x2="874" y2="286" stroke="#E5E7EB" strokeWidth="1"/>
              <text x="795" y="302" textAnchor="middle" fontSize="8.5" fill="#9CA3AF" fontWeight="600">Planned</text>
              <text x="795" y="316" textAnchor="middle" fontSize="8.5" fill="#B0B7C3">SAML 2.0 · Azure AD · RBAC</text>
              <text x="795" y="329" textAnchor="middle" fontSize="7.5" fill="#B0B7C3">Eclipse plugin · ZUNIT · pgvector</text>

              {/* Arrows */}
              <line x1="163" y1="84" x2="189" y2="92" stroke="#2E5FA3" strokeWidth="1.5" markerEnd="url(#a2)"/>
              <line x1="163" y1="140" x2="189" y2="118" stroke="#2E5FA3" strokeWidth="1.5" markerEnd="url(#a2)"/>
              <line x1="163" y1="196" x2="189" y2="128" stroke="#2E5FA3" strokeWidth="1.5" markerEnd="url(#a2)"/>
              <line x1="283" y1="138" x2="283" y2="150" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#a1)"/>
              <line x1="283" y1="206" x2="283" y2="218" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#a1)"/>
              <line x1="283" y1="380" x2="283" y2="394" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#a1)"/>
              <line x1="376" y1="110" x2="401" y2="130" stroke="#27AE60" strokeWidth="1.5" markerEnd="url(#a3)"/>
              <line x1="376" y1="290" x2="401" y2="200" stroke="#27AE60" strokeWidth="1.5" markerEnd="url(#a3)"/>
              <line x1="535" y1="150" x2="560" y2="120" stroke="#C55A11" strokeWidth="1.5" markerEnd="url(#a4)"/>
              <line x1="535" y1="200" x2="560" y2="238" stroke="#C55A11" strokeWidth="1.5" markerEnd="url(#a4)"/>
              <line x1="535" y1="290" x2="560" y2="310" stroke="#C55A11" strokeWidth="1.5" markerEnd="url(#a4)"/>
            </svg>
          </div>
        </section>

        {/* --- DIAGRAM 2: RAG focus --- */}
        <section style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '28px 28px 20px', marginBottom: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1F3864', margin: 0 }}>Context &amp; RAG Layer</h2>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>Structured RAG (current) · Vector RAG (planned)</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <svg viewBox="0 0 880 480" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', minWidth: 700 }} role="img" aria-label="MAVEN/CARTA RAG architecture detail">
              <defs>
                <marker id="b1" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#6B7280"/></marker>
                <marker id="b2" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#7C3AED"/></marker>
                <marker id="b3" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#27AE60"/></marker>
              </defs>

              {/* Orchestrator box */}
              <rect x="20" y="30" width="180" height="420" rx="8" fill="#F5F5F5" stroke="#D1D5DB" strokeWidth="1.5"/>
              <text x="110" y="52" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1F3864">Orchestrator / Chains</text>
              <line x1="30" y1="60" x2="190" y2="60" stroke="#E5E7EB" strokeWidth="1"/>
              {[
                ['Chain 1', 'Module Facts'],
                ['Chain 2', 'Business Rules'],
                ['Chain 3', 'Change Impact'],
                ['Chain 4', 'Tech Spec'],
                ['Chain 5', 'Mod Brief'],
                ['Agent', 'Tool-use loop'],
              ].map(([c, l], i) => (
                <g key={c}>
                  <rect x="30" y={72 + i * 58} width="160" height="44" rx="5" fill="white" stroke="#E5E7EB" strokeWidth="1"/>
                  <text x="110" y={90 + i * 58} textAnchor="middle" fontSize="9" fontWeight="700" fill="#2E5FA3">{c}</text>
                  <text x="110" y={103 + i * 58} textAnchor="middle" fontSize="8.5" fill="#6B7280">{l}</text>
                </g>
              ))}

              {/* Structured RAG */}
              <rect x="246" y="10" width="230" height="10" rx="3" fill="#7C3AED"/>
              <rect x="246" y="14" width="230" height="296" rx="8" fill="white" stroke="#7C3AED" strokeWidth="2"/>
              <text x="361" y="36" textAnchor="middle" fontSize="11" fontWeight="700" fill="#7C3AED">✦ Structured RAG — CURRENT</text>
              <line x1="256" y1="44" x2="466" y2="44" stroke="#E9D5FF" strokeWidth="1"/>

              <text x="264" y="62" fontSize="8.5" fill="#4B5563" fontWeight="600">Artifact store (Neon PostgreSQL)</text>
              {[
                'moduleFacts (Rule Cards, DataObjects)',
                'bizRules  ·  changeImpacts',
                'modSpecs  ·  module_tech_specs',
                'dep_graphs  ·  program_sources',
              ].map((t, i) => (
                <text key={t} x="270" y={78 + i * 14} fontSize="8" fill="#6B7280">{t}</text>
              ))}

              <line x1="256" y1="138" x2="466" y2="138" stroke="#E9D5FF" strokeWidth="0.75" strokeDasharray="3,3"/>
              <text x="264" y="154" fontSize="8.5" fill="#4B5563" fontWeight="600">Context registry</text>
              {[
                'copybooks  ·  domain_glossary',
                'scan_jobs  ·  llm_settings',
              ].map((t, i) => (
                <text key={t} x="270" y={168 + i * 14} fontSize="8" fill="#6B7280">{t}</text>
              ))}

              <line x1="256" y1="198" x2="466" y2="198" stroke="#E9D5FF" strokeWidth="0.75" strokeDasharray="3,3"/>
              <text x="264" y="214" fontSize="8.5" fill="#4B5563" fontWeight="600">Retrieval method</text>
              <text x="270" y="228" fontSize="8" fill="#6B7280">Drizzle ORM · SQL WHERE / JOIN</text>
              <text x="270" y="242" fontSize="8" fill="#6B7280">Neighbor moduleFacts → portfolio ctx</text>
              <text x="270" y="256" fontSize="8" fill="#6B7280">Copybook fields matched by name</text>
              <text x="270" y="270" fontSize="8" fill="#6B7280">Domain glossary → field annotations</text>
              <text x="361" y="292" textAnchor="middle" fontSize="7.5" fill="#7C3AED" fontStyle="italic">Deterministic · no embeddings · fast at current scale</text>

              {/* Vector RAG planned */}
              <rect x="246" y="328" width="230" height="122" rx="8" fill="#FAFAFA" stroke="#9CA3AF" strokeWidth="1.5" strokeDasharray="6,4"/>
              <text x="361" y="348" textAnchor="middle" fontSize="11" fontWeight="600" fill="#9CA3AF">◌ Vector RAG — PLANNED</text>
              <line x1="256" y1="355" x2="466" y2="355" stroke="#E5E7EB" strokeWidth="1"/>
              <text x="264" y="372" fontSize="8.5" fill="#9CA3AF" fontWeight="600">pgvector on Neon (same DB)</text>
              <text x="270" y="386" fontSize="8" fill="#B0B7C3">Embed biz rules · modSpec sections</text>
              <text x="270" y="400" fontSize="8" fill="#B0B7C3">Semantic: "find programs like this"</text>
              <text x="270" y="414" fontSize="8" fill="#B0B7C3">Agent fuzzy lookup · portfolio similarity</text>
              <text x="270" y="428" fontSize="8" fill="#B0B7C3">Trigger: portfolio &gt; ~500 programs</text>
              <text x="361" y="444" textAnchor="middle" fontSize="7.5" fill="#9CA3AF" fontStyle="italic">Embedding model: text-embedding-3-small or Granite (on-prem)</text>

              {/* LLM box on right */}
              <rect x="526" y="30" width="160" height="420" rx="8" fill="#F0F4FF" stroke="#C7D5F5" strokeWidth="1.5"/>
              <text x="606" y="52" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1F3864">LLM Providers</text>
              <line x1="536" y1="60" x2="676" y2="60" stroke="#E5E7EB" strokeWidth="1"/>
              {[
                ['Anthropic', 'Claude Sonnet / Opus', '#1F3864'],
                ['Groq', 'Llama 3.3-70B', '#1F3864'],
                ['OpenAI', 'GPT-4o', '#1F3864'],
              ].map(([name, model, c], i) => (
                <g key={name}>
                  <rect x="536" y={72 + i * 60} width="140" height="46" rx="5" fill="white" stroke="#E5E7EB" strokeWidth="1"/>
                  <text x="606" y={92 + i * 60} textAnchor="middle" fontSize="10" fontWeight="700" fill={c}>{name}</text>
                  <text x="606" y={106 + i * 60} textAnchor="middle" fontSize="8" fill="#6B7280">{model}</text>
                </g>
              ))}
              <text x="606" y="265" textAnchor="middle" fontSize="8" fill="#9CA3AF">Configurable via Settings</text>
              <text x="606" y="278" textAnchor="middle" fontSize="8" fill="#9CA3AF">Agents require Anthropic</text>
              <rect x="536" y="296" width="140" height="44" rx="5" fill="#F9FAFB" stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4,3"/>
              <text x="606" y="314" textAnchor="middle" fontSize="9" fontWeight="600" fill="#9CA3AF">On-prem (planned)</text>
              <text x="606" y="328" textAnchor="middle" fontSize="8" fill="#B0B7C3">IBM WatsonX · Azure OAI</text>

              {/* Arrows: chains ↔ structured RAG */}
              <line x1="200" y1="160" x2="244" y2="160" stroke="#7C3AED" strokeWidth="2" strokeDasharray="5,3" markerEnd="url(#b2)"/>
              <text x="222" y="154" textAnchor="middle" fontSize="7.5" fill="#7C3AED">inject</text>
              <line x1="244" y1="200" x2="200" y2="260" stroke="#27AE60" strokeWidth="1.5" markerEnd="url(#b3)"/>
              <text x="214" y="244" textAnchor="middle" fontSize="7.5" fill="#27AE60">save</text>

              {/* Arrows: chains → LLM */}
              <line x1="200" y1="130" x2="524" y2="130" stroke="#6B7280" strokeWidth="1" strokeDasharray="4,3" markerEnd="url(#b1)"/>
              <text x="362" y="124" textAnchor="middle" fontSize="7.5" fill="#9CA3AF">prompt + injected context → LLM</text>
            </svg>
          </div>
        </section>

        {/* Key architecture decisions */}
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1F3864', margin: '0 0 16px' }}>Key Design Decisions</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {[
              { title: 'Structured RAG over Vector RAG', color: '#7C3AED', bg: '#F5F3FF', body: 'Artifacts are retrieved via SQL joins and injected into prompts as structured text. No embeddings needed at current scale. pgvector can be added to the same Neon DB without infrastructure changes.' },
              { title: 'SSE for streaming jobs', color: '#2E5FA3', bg: '#EEF2FF', body: 'Analysis runs as a long-lived server-sent events stream (maxDuration = 300s on Vercel). The client receives log lines in real time and transitions to the hub when the pipeline completes.' },
              { title: 'Synthetic repo pattern', color: '#059669', bg: '#ECFDF5', body: 'CAST imports and file uploads create synthetic repos with cast:// or upload:// URLs. The job route detects these and loads source from the DB instead of GitHub, keeping the pipeline uniform.' },
              { title: 'Source-of-truth: repo URL', color: '#C55A11', bg: '#FFF7ED', body: 'Pipeline status badges (CAST ✓ / GitHub ✓) are derived from the repo\'s githubUrl, not from token count heuristics. This ensures accuracy regardless of which chains ran.' },
              { title: 'Content-based language detection', color: '#1F3864', bg: '#F0F4FF', body: 'Extensionless legacy COBOL files (the norm on mainframes) are classified by inspecting the first 3KB — JCL patterns, COBOL division markers, copybook level numbers — defaulting to COBOL.' },
              { title: 'Name-collision resolution', color: '#6B7280', bg: '#F9FAFB', body: 'When a COBOL program and a data file share the same name, both DB queries order by language priority (COBOL/JCL/PLI before DATA) so the executable program is always returned first.' },
            ].map(d => (
              <div key={d.title} style={{ background: d.bg, border: `1px solid ${d.color}22`, borderRadius: 10, padding: '16px 18px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: d.color, marginBottom: 6 }}>{d.title}</div>
                <div style={{ fontSize: 12, color: '#4B5563', lineHeight: 1.6 }}>{d.body}</div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ background: '#0F1E3A', padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 900, fontSize: 13, color: '#4DAAC7' }}>MAVEN/CARTA</span>
        <div style={{ display: 'flex', gap: 20 }}>
          {([['Home', '/'], ['Programs', '/programs'], ['Agents', '/agents'], ['Architecture', '/architecture']] as const).map(([label, href]) => (
            <Link key={label} href={href} style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>{label}</Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
