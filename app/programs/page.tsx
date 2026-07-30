'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ProgramListItem {
  name: string;
  language: string;
  loc: number;
  domain: string;
  desc: string;
  status: string;
  lastAnalyzedAt: string | null;
}

// Static fallback programs for demo — shown when no programs in DB
const DEMO_PROGRAMS: ProgramListItem[] = [
  {
    name: 'GTMSETL0',
    language: 'COBOL',
    loc: 847,
    domain: 'Settlement / GTM',
    desc: 'Settlement cutoff calculation — determines and broadcasts the daily transaction cutoff timestamp for all GTM payment flows.',
    status: 'analyzed',
    lastAnalyzedAt: null,
  },
  {
    name: 'GTMPOST1',
    language: 'COBOL',
    loc: 612,
    domain: 'Settlement / GTM',
    desc: 'Transaction posting — processes pending transactions against the settlement cutoff and writes to the GLEDGER feed.',
    status: 'analyzed',
    lastAnalyzedAt: null,
  },
];

const UNAVAILABLE_PROGRAMS = [
  { name: 'GTMVALD2', language: 'COBOL', loc: 534, desc: 'Pre-cutoff validation — validates all pending transactions before the settlement run proceeds.' },
  { name: 'GTMCICS4', language: 'COBOL', loc: 328, desc: 'CICS online transaction — allows online users to query the current settlement cutoff status at runtime.' },
  { name: 'GTMDB2IO', language: 'COBOL', loc: 489, desc: 'DB2 access module — owns all I/O operations against the SETL_CTRL table; called by GTMVALD2.' },
  { name: 'GTMASM01', language: 'HLASM', loc: 143, desc: 'Assembler bit-field utility — called dynamically by GTMVALD2 for packed-byte flag manipulation. Partial coverage.' },
];

export default function ProgramsPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<ProgramListItem[]>([]);
  const [query, setQuery] = useState('');
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectUrl, setConnectUrl] = useState('');
  const [connectPat, setConnectPat] = useState('');
  const [connectError, setConnectError] = useState('');
  const [connectSuccess, setConnectSuccess] = useState('');

  useEffect(() => {
    fetch('/api/programs')
      .then((r) => r.json())
      .then((data: ProgramListItem[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setPrograms(data);
        } else {
          setPrograms(DEMO_PROGRAMS);
        }
      })
      .catch(() => setPrograms(DEMO_PROGRAMS));
  }, []);

  const allPrograms = programs.length > 0 ? programs : DEMO_PROGRAMS;
  const filtered = allPrograms.filter((p) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.desc.toLowerCase().includes(q) ||
      p.domain.toLowerCase().includes(q)
    );
  });

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!connectUrl.trim()) return;
    setConnecting(true);
    setConnectError('');
    setConnectSuccess('');
    try {
      const res = await fetch('/api/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubUrl: connectUrl, pat: connectPat || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect repo');
      setConnectSuccess(`Connected — found ${data.programCount} COBOL/HLASM program(s)`);
      setConnectUrl('');
      setConnectPat('');
      // Refresh program list
      const list = await fetch('/api/programs').then((r) => r.json());
      if (Array.isArray(list) && list.length > 0) setPrograms(list);
    } catch (err: any) {
      setConnectError(err.message || 'Failed to connect repository');
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="app-header">
        <Link href="/" className="logo">
          <span className="logo-mark">MAVEN</span>
          <div>
            <div className="logo-name">CARTA</div>
            <div className="logo-tagline">Mainframe Intelligence</div>
          </div>
        </Link>
        <div className="header-spacer" />
        <span className="prototype-badge">ILLUSTRATIVE PROTOTYPE</span>
      </header>

      {!disclaimerDismissed && (
        <div className="sim-disclaimer">
          <div className="disclaimer-inner">
            <span className="disclaimer-icon">ℹ</span>
            <div className="disclaimer-text">
              <strong>Simulation Mode</strong> — Selecting a program below will run a live
              simulation of the MAVEN analysis workflow: deterministic dependency analysis
              followed by on-demand LLM documentation generation. The content rendered is
              pre-authored on a synthetic COBOL estate for this demonstration. In production,
              MAVEN executes this workflow live against your actual codebase.
            </div>
            <button
              className="disclaimer-dismiss"
              onClick={() => setDisclaimerDismissed(true)}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="entry-body">
        <div className="entry-hero">
          <h1>Program Knowledge Base</h1>
          <p>
            Select a program to analyse. MAVEN will run deterministic dependency mapping, then
            generate all four documentation types on demand.
          </p>
        </div>

        {/* Connect repo form */}
        <div className="connect-repo-section">
          <h2>Connect a GitHub repository</h2>
          <p>Point MAVEN at a repo containing COBOL or HLASM source to scan it automatically.</p>
          <form onSubmit={handleConnect}>
            <div className="connect-repo-fields">
              <input
                type="url"
                placeholder="https://github.com/owner/repo"
                value={connectUrl}
                onChange={(e) => setConnectUrl(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="GitHub PAT (optional — for private repos)"
                value={connectPat}
                onChange={(e) => setConnectPat(e.target.value)}
              />
              <button
                type="submit"
                className="btn btn-navy btn-sm"
                disabled={connecting}
                style={{ alignSelf: 'flex-start' }}
              >
                {connecting ? 'Scanning…' : 'Connect & Scan'}
              </button>
              {connectError && (
                <div style={{ color: 'var(--danger)', fontSize: 12 }}>{connectError}</div>
              )}
              {connectSuccess && (
                <div style={{ color: 'var(--success)', fontSize: 12 }}>{connectSuccess}</div>
              )}
            </div>
          </form>
        </div>

        <div className="search-bar">
          <span style={{ color: 'var(--text-3)', fontSize: 18 }}>⌕</span>
          <input
            type="text"
            placeholder="Enter program name (e.g. GTMSETL0)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="section-label">Settlement / GTM Domain — Synthetic Estate</div>

        <div className="program-grid">
          {filtered.map((prog, i) => (
            <div
              key={prog.name}
              className={`program-card ${i === 0 ? 'hero-card' : ''}`}
              onClick={() => router.push(`/programs/${prog.name}`)}
            >
              <div className="card-header">
                <div>
                  <span className={`lang-pill${prog.language === 'HLASM' ? ' asm' : ''}`}>
                    {prog.language === 'HLASM' ? 'HLASM' : 'COBOL'}
                  </span>
                  <div className="card-name" style={{ marginTop: 6 }}>
                    {prog.name}
                  </div>
                </div>
                {i === 0 && <div style={{ fontSize: 20, opacity: 0.6 }}>★</div>}
              </div>
              <div className="card-role">{prog.desc}</div>
              <div className="card-meta">
                <span>📏 {prog.loc.toLocaleString()} LOC</span>
                <span>🗓 Active</span>
              </div>
              <div className="card-action">
                <span className="open-link">Analyse with MAVEN →</span>
                <span className="badge badge-deterministic">
                  <span className="badge-dot" />
                  Rich coverage
                </span>
              </div>
            </div>
          ))}

          {/* Static unavailable programs */}
          {UNAVAILABLE_PROGRAMS.map((prog) => (
            <div key={prog.name} className="program-card unavailable">
              <div className="card-header">
                <span className={`lang-pill${prog.language === 'HLASM' ? ' asm' : ''}`}>
                  {prog.language === 'HLASM' ? 'HLASM' : 'COBOL'}
                </span>
                <div className="card-name" style={{ marginTop: 6 }}>
                  {prog.name}
                </div>
              </div>
              <div className="card-role">{prog.desc}</div>
              <div className="card-meta">
                <span>📏 {prog.loc} LOC</span>
                <span>🗓 Active</span>
              </div>
              <div className="card-unavailable-note">
                {prog.name === 'GTMASM01'
                  ? '⚠ Partial coverage (71%) — assembler analysis limited'
                  : 'Available in full MAVEN build · Not in demo scope'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
