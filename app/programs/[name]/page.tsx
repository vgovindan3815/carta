'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import OverviewDashboard from '@/components/panels/OverviewDashboard';
import DependencyView from '@/components/panels/DependencyView';
import BusinessRules from '@/components/panels/BusinessRules';
import ChangeImpact from '@/components/panels/ChangeImpact';
import ModernizationSpec from '@/components/panels/ModernizationSpec';
import type { ProgramData } from '@/lib/parser/types';

type Phase = 'processing' | 'hub';
type TabId = 'overview' | 'dependency' | 'business' | 'impact' | 'spec';

interface LogLine {
  lv: string;
  t: string;
  id: number;
}

// Pre-built simulation log for demo programs when no real API is running
const DEMO_LOGS: Record<string, LogLine[]> = {
  GTMSETL0: [
    { id: 0, lv: 'INFO', t: 'Locating <span class="hl">GTMSETL0</span> in estate index…' },
    { id: 1, lv: 'INFO', t: 'Source confirmed — COBOL 85 · <span class="hl">847 LOC</span> · batch scheduled' },
    { id: 2, lv: 'INFO', t: 'Parsing IDENTIFICATION and ENVIRONMENT divisions…' },
    { id: 3, lv: 'INFO', t: 'Scanning PROCEDURE DIVISION for CALL statements…' },
    { id: 4, lv: 'CALL', t: '→ <span class="hl">GTMPOST1</span> identified (static literal · 5000-EXECUTE-POSTING)' },
    { id: 5, lv: 'CALL', t: '→ <span class="hl">GTMVALD2</span> identified (static literal · 4000-VALIDATE-PENDING-TXNS)' },
    { id: 6, lv: 'WARN', t: '→ <span class="hl">GTMASM01</span> detected — DYNAMIC CALL, target resolved at 71% confidence' },
    { id: 7, lv: 'SQL',  t: '→ <span class="hl">SETL_CTRL</span>: SELECT (2000-GET-CONTROL-PARMS)' },
    { id: 8, lv: 'SQL',  t: '→ <span class="hl">SETL_CTRL</span>: UPDATE (6000-BROADCAST-CUTOFF)' },
    { id: 9, lv: 'DONE', t: 'Dependency graph complete — <span class="hl">8 nodes · 8 edges</span> · analysed in 2.3s ✓' },
    { id: 10, lv: 'LLM', t: 'Generating <span class="hl">business rules</span> — 4 sections, analyst readability target…' },
    { id: 11, lv: 'LLM', t: 'Grounding each claim against deterministic graph edges…' },
    { id: 12, lv: 'DONE', t: 'Business rules complete — <span class="hl">4 sections · 8 rules · 12 edge citations</span> ✓' },
    { id: 13, lv: 'LLM', t: 'Generating <span class="hl">change-impact analysis</span> — 5 dependent programs…' },
    { id: 14, lv: 'DONE', t: 'Change impact complete — <span class="hl">5 programs · coverage 91%</span> ✓' },
    { id: 15, lv: 'LLM', t: 'Generating <span class="hl">modernisation specification</span> (Java Spring Boot target)…' },
    { id: 16, lv: 'DONE', t: 'All documentation generated — <span class="hl">total elapsed 6.4s</span>' },
  ],
  GTMPOST1: [
    { id: 0, lv: 'INFO', t: 'Locating <span class="hl">GTMPOST1</span> in estate index…' },
    { id: 1, lv: 'INFO', t: 'Source confirmed — COBOL 85 · <span class="hl">612 LOC</span> · batch (called module)' },
    { id: 2, lv: 'INFO', t: 'Parsing LINKAGE SECTION — 3 parameters received from caller GTMSETL0…' },
    { id: 3, lv: 'SQL',  t: '→ <span class="hl">TRANS_PENDING</span>: SELECT with cursor (3000-FETCH-PENDING-TXNS)' },
    { id: 4, lv: 'SQL',  t: '→ <span class="hl">POST_AUDIT</span>: INSERT per transaction (4000-WRITE-AUDIT-RECORD)' },
    { id: 5, lv: 'DATA', t: '→ <span class="hl">GLEDGER</span>: WRITE SEQUENTIAL (4000-WRITE-GLEDGER-RECORD)' },
    { id: 6, lv: 'DONE', t: 'Dependency graph complete — <span class="hl">5 nodes · 4 edges</span> · analysed in 2.1s ✓' },
    { id: 7, lv: 'LLM', t: 'Generating <span class="hl">business rules</span> — 3 sections…' },
    { id: 8, lv: 'DONE', t: 'Business rules complete — <span class="hl">3 sections · 6 rules</span> ✓' },
    { id: 9, lv: 'LLM', t: 'Generating <span class="hl">change-impact analysis</span>…' },
    { id: 10, lv: 'DONE', t: 'Change impact complete — <span class="hl">4 items · coverage 96%</span> ✓' },
    { id: 11, lv: 'LLM', t: 'Generating <span class="hl">modernisation specification</span> (Spring Batch target)…' },
    { id: 12, lv: 'DONE', t: 'All documentation generated — <span class="hl">total elapsed 5.8s</span>' },
  ],
};

export default function ProgramHubPage() {
  const params = useParams();
  const name = Array.isArray(params.name) ? params.name[0] : params.name;

  const [phase, setPhase] = useState<Phase>('processing');
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [programData, setProgramData] = useState<ProgramData | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Initialising analysis engine…');
  const [isFromCache, setIsFromCache] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const logIdRef = useRef(0);
  const castFallbackRef = useRef<ProgramData | null>(null);

  // Fetch program data from API — returns raw JSON including castOnly flag
  async function fetchProgramRaw(): Promise<{ data: ProgramData | null; castOnly: boolean }> {
    try {
      const res = await fetch(`/api/programs/${name}`);
      if (!res.ok) return { data: null, castOnly: false };
      const json = await res.json();
      if (json.status === 'not_analyzed' || json.status === 'not_found') return { data: null, castOnly: false };
      const castOnly = json.castOnly === true;
      return { data: json as ProgramData, castOnly };
    } catch {
      return { data: null, castOnly: false };
    }
  }

  // Fetch program data from API (falls back to embedded demo data)
  async function fetchProgramData(): Promise<ProgramData | null> {
    const { data } = await fetchProgramRaw();
    return data;
  }

  // Run demo simulation (no real API needed)
  function runDemoSimulation() {
    const demoLines = DEMO_LOGS[name!] ?? DEMO_LOGS['GTMSETL0'];
    const total = demoLines.length;
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];

    demoLines.forEach((line, i) => {
      const delay = 400 + i * 380;
      const t = setTimeout(() => {
        const uid = logIdRef.current++;
        setLogs((prev) => [...prev, { ...line, id: uid }]);
        setProgress(Math.round(((i + 1) / total) * 100));
        if (line.lv === 'INFO' || line.lv === 'LLM') {
          setStatusText(line.t.replace(/<[^>]+>/g, ''));
        }
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
        // Auto-advance to hub when done
        if (i === total - 1) {
          const t2 = setTimeout(enterHub, 900);
          timerRefs.current.push(t2);
        }
      }, delay);
      timerRefs.current.push(t);
    });
  }

  // Try real SSE pipeline, fall back to demo
  async function startProcessing() {
    logIdRef.current = 0;
    setAnalysisError(null);
    setLogs([]);
    setProgress(0);
    setStatusText('Initialising analysis engine…');

    // Try to create a real job
    try {
      const res = await fetch(`/api/programs/${name}/analyze`, { method: 'POST' });
      if (res.ok) {
        const { jobId } = await res.json();
        if (jobId) {
          openSSE(jobId);
          return;
        }
      }
    } catch {
      // fall through to demo
    }

    runDemoSimulation();
  }

  function openSSE(jobId: string) {
    if (esRef.current) esRef.current.close();
    const es = new EventSource(`/api/jobs/${jobId}`);
    esRef.current = es;

    es.onmessage = (evt) => {
      try {
        const line = JSON.parse(evt.data) as { lv: string; t: string };
        const uid = logIdRef.current++;
        setLogs((prev) => [...prev, { ...line, id: uid }]);
        if (line.lv === 'INFO' || line.lv === 'LLM') {
          setStatusText(line.t.replace(/<[^>]+>/g, ''));
        }
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
      } catch {}
    };

    es.addEventListener('done', () => {
      es.close();
      setProgress(100);
      const t2 = setTimeout(enterHub, 900);
      timerRefs.current.push(t2);
    });

    // Custom 'error' event = pipeline failed on the server — show real error, don't fake success
    es.addEventListener('error', (evt) => {
      es.close();
      let errMsg = 'Analysis pipeline failed — check server logs.';
      try {
        const d = JSON.parse((evt as MessageEvent).data ?? '{}');
        if (d.error) {
          const raw = String(d.error);
          if (raw.includes('rate_limit_exceeded') || raw.includes('Rate limit reached')) {
            const retry = raw.match(/try again in ([\w\d ]+)\./i);
            errMsg = `Groq API daily token limit reached.${retry ? ` Try again in ${retry[1].trim()}.` : ' Try again later (resets in ~24h).'}`;
          } else if (raw.includes('context_length_exceeded') || raw.includes('context window')) {
            errMsg = 'Program exceeds LLM context window. Try a smaller file (< 1,500 LOC).';
          } else {
            errMsg = raw.replace(/^Error:\s*/i, '').slice(0, 200);
          }
        }
      } catch {}
      const uid = logIdRef.current++;
      setLogs((prev) => [...prev, { lv: 'ERROR', t: `<span style="color:#FCA5A5">${errMsg}</span>`, id: uid }]);
      setStatusText('Analysis failed');
      setProgress(100);
      setAnalysisError(errMsg);
      const t2 = setTimeout(() => {
        // If we have CAST dep graph data, show it in the hub even after LLM failure
        setProgramData(castFallbackRef.current);
        setPhase('hub');
      }, 2000);
      timerRefs.current.push(t2);
    });

    // onerror = SSE connection dropped — fall back to demo simulation
    es.onerror = () => {
      es.close();
      runDemoSimulation();
    };
  }

  async function fetchWithRetry(attempts = 3, delayMs = 1500): Promise<ProgramData | null> {
    for (let i = 0; i < attempts; i++) {
      const data = await fetchProgramData();
      if (data) return data;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
    return null;
  }

  async function enterHub() {
    timerRefs.current.forEach(clearTimeout);
    if (esRef.current) esRef.current.close();
    // Retry a few times — DB write and SSE done can be very close together
    let data = await fetchWithRetry();
    if (!data) data = castFallbackRef.current;
    // Only fall back to demo data for known demo programs
    if (!data) data = await getDemoData(name!);
    setIsFromCache(false);
    setProgramData(data);
    setPhase('hub');
    setActiveTab('overview');
  }

  async function skipProcessing() {
    timerRefs.current.forEach(clearTimeout);
    if (esRef.current) esRef.current.close();
    let data = await fetchWithRetry(1); // single try on skip
    if (!data) data = castFallbackRef.current;
    if (!data) data = await getDemoData(name!);
    setIsFromCache(false);
    setProgramData(data);
    setPhase('hub');
    setActiveTab('overview');
  }

  async function reanalyze() {
    logIdRef.current = 0;
    setAnalysisError(null);
    setIsFromCache(false);
    setProgramData(null);
    setPhase('processing');
    setLogs([]);
    setProgress(0);
    setStatusText('Initialising analysis engine…');
    startProcessing();
  }

  useEffect(() => {
    if (!name) return;
    let cancelled = false;

    fetchProgramRaw().then(({ data: existing, castOnly }) => {
      if (cancelled) return;
      if (existing && !castOnly) {
        // Full data available — open hub directly
        setProgramData(existing);
        setIsFromCache(true);
        setPhase('hub');
        setActiveTab('overview');
      } else if (existing && castOnly) {
        // CAST dep graph exists but no LLM analysis yet — run LLM chains
        // Store CAST data for fallback if LLM fails
        castFallbackRef.current = existing;
        startProcessing();
      } else {
        // No data at all — run full pipeline
        startProcessing();
      }
    });

    return () => {
      cancelled = true;
      timerRefs.current.forEach(clearTimeout);
      timerRefs.current = [];
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  if (phase === 'processing') {
    return (
      <div className="proc-screen">
        <header className="app-header">
          <button onClick={skipProcessing} className="logo" style={{ background: 'none', border: 'none' }}>
            <span className="logo-mark">MAVEN</span>
            <div>
              <div className="logo-name">CARTA</div>
              <div className="logo-tagline">Mainframe Intelligence</div>
            </div>
          </button>
          <div className="header-spacer" />
          <span className="prototype-badge">ILLUSTRATIVE PROTOTYPE</span>
        </header>

        <div className="proc-body">
          <div className="proc-frame">
            <div className="proc-header">
              <div className="proc-title-row">
                <div>
                  <div className="proc-prog-name">{name}</div>
                  <div className="proc-subtitle">
                    MAVEN Analysis Engine &nbsp;·&nbsp; {analysisError ? <span style={{ color: '#FCA5A5' }}>Pipeline failed</span> : 'Running analysis'}
                  </div>
                </div>
                <button className="btn-ghost-light" onClick={skipProcessing}>
                  Skip to results →
                </button>
              </div>
            </div>

            <div className="terminal" ref={terminalRef}>
              {logs.map((line) => (
                <div key={line.id} className="log-line">
                  <span className={`lvl lvl-${line.lv}`}>{line.lv}</span>
                  <span
                    className="log-txt"
                    dangerouslySetInnerHTML={{ __html: line.t }}
                  />
                </div>
              ))}
              {logs.length > 0 && (
                <span className="cursor-blink" />
              )}
            </div>

            <div className="proc-footer">
              <div className="proc-progress-wrap">
                <div className="proc-progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="proc-status-row">
                <div className="proc-status">
                  {analysisError ? (
                    <span style={{ color: '#FCA5A5', fontWeight: 600 }}>✕ {analysisError.slice(0, 100)}{analysisError.length > 100 ? '…' : ''}</span>
                  ) : progress === 100 ? (
                    <span className="proc-ready-msg">✓ Analysis complete — documentation ready</span>
                  ) : (
                    statusText
                  )}
                </div>
              </div>
              {progress === 100 && !analysisError && (
                <div style={{ marginTop: 10 }}>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                    onClick={enterHub}
                  >
                    Open documentation →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Hub view — analysis failed or results unavailable
  if (phase === 'hub' && !programData) {
    const isRateLimit = analysisError?.toLowerCase().includes('rate limit') || analysisError?.toLowerCase().includes('token limit');
    const retryMatch = analysisError?.match(/try again in ([\w\d ]+)\./i);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#F4F7FA', gap: 16, padding: 32 }}>
        <div style={{ fontSize: 48 }}>{isRateLimit ? '⏱️' : '⚠️'}</div>
        <div style={{ fontWeight: 800, fontSize: 20, color: '#1F3864' }}>
          {isRateLimit ? 'Groq API rate limit reached' : 'Analysis results not available'}
        </div>
        {analysisError ? (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '12px 20px', maxWidth: 520, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#DC2626', fontWeight: 600, marginBottom: retryMatch ? 8 : 0 }}>{analysisError}</div>
            {retryMatch && (
              <div style={{ fontSize: 12, color: '#6B7280' }}>
                The free Groq tier allows 100,000 tokens/day. Limit resets daily. You can also upgrade at <strong>console.groq.com</strong>.
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', maxWidth: 420 }}>
            The analysis pipeline did not produce complete results for <strong>{name}</strong>. Check the terminal output above for details.
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          {!isRateLimit && (
            <button
              onClick={reanalyze}
              style={{ background: 'linear-gradient(135deg, #1F3864, #1C7293)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              ↺ Retry Analysis
            </button>
          )}
          {isRateLimit && (
            <a
              href="https://console.groq.com/settings/billing"
              target="_blank"
              rel="noopener noreferrer"
              style={{ background: '#F59E0B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}
            >
              Upgrade Groq Tier ↗
            </a>
          )}
          <a
            href="/programs"
            style={{ background: '#fff', color: '#1F3864', border: '1.5px solid #E5E7EB', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}
          >
            ← Back to Programs
          </a>
        </div>
      </div>
    );
  }

  if (!programData) return null;

  return (
    <div className="hub-screen">
      <header className="app-header">
        <Link href="/" className="logo">
          <span className="logo-mark">MAVEN</span>
          <div>
            <div className="logo-name">CARTA</div>
            <div className="logo-tagline">Mainframe Intelligence</div>
          </div>
        </Link>
        <div className="breadcrumb" style={{ marginLeft: 12 }}>
          <Link href="/programs" className="crumb-link">All Programs</Link>
          <span className="sep">/</span>
          <span className="crumb-current">{programData.name}</span>
        </div>
        <div className="header-spacer" />
        <Link href="/settings" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, textDecoration: 'none', padding: '4px 10px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6 }}>⚙ LLM</Link>
        <span className="prototype-badge">ILLUSTRATIVE PROTOTYPE</span>
      </header>

      {isFromCache && (
        <div style={{ background: '#EBF4FF', borderBottom: '1px solid #BFDBFE', padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14 }}>💾</span>
          <span style={{ fontSize: 12, color: '#1D4ED8', flex: 1 }}>
            Showing previously generated analysis. Source code changes since last scan will not be reflected until you refresh.
          </span>
          <button
            onClick={reanalyze}
            style={{ background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
          >
            ↺ Refresh Analysis
          </button>
        </div>
      )}

      <div className="hub-body">
        <div className="program-identity">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="prog-name">{programData.name}</div>
              {programData.version && programData.version > 0 && (
                <span style={{
                  background: '#EDE9FE', color: '#7C3AED',
                  fontSize: 11, fontWeight: 800,
                  padding: '2px 9px', borderRadius: 12,
                  fontFamily: 'Consolas, monospace',
                  verticalAlign: 'middle',
                }}>
                  v{programData.version}
                </span>
              )}
            </div>
            <div className="prog-desc">{programData.desc}</div>
            <div className="prog-meta-chips">
              {(programData.chips ?? []).map((chip) => (
                <span key={chip.label} className="meta-chip">
                  <span className="chip-label">{chip.label}</span>
                  {chip.val}
                </span>
              ))}
            </div>
          </div>
          <div className="identity-spacer" />
          <div className="trust-badges">
            <span className="badge badge-deterministic">
              <span className="badge-dot" />
              Structure: deterministic analysis
            </span>
            <span className="badge badge-llm">
              <span className="badge-dot" />
              Explanation: LLM, grounded in graph
            </span>
            <div className="freshness-note">
              <span className="freshness-dot" />
              Graph refreshed on last commit · just now
            </div>
          </div>
        </div>

        <nav className="tab-nav">
          {(
            [
              { id: 'overview' as TabId, label: 'Overview', icon: '⊞' },
              { id: 'dependency' as TabId, label: 'Dependency View', icon: '🔗' },
              { id: 'business' as TabId, label: 'Business Rules', icon: '📋' },
              { id: 'impact' as TabId, label: 'Change Impact', icon: '💥' },
              { id: 'spec' as TabId, label: 'Modernization Spec', icon: '🏗️' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </nav>

        <div className="tab-content">
          {activeTab === 'overview' && (
            <OverviewDashboard program={programData} onTabChange={setActiveTab} />
          )}
          {activeTab === 'dependency' && (
            <div className="tab-panel">
              <DependencyView program={programData} />
            </div>
          )}
          {activeTab === 'business' && (
            <div className="tab-panel">
              <BusinessRules program={programData} />
            </div>
          )}
          {activeTab === 'impact' && (
            <div className="tab-panel">
              <ChangeImpact program={programData} onTabChange={setActiveTab} />
            </div>
          )}
          {activeTab === 'spec' && (
            <div className="tab-panel">
              <ModernizationSpec
                program={programData}
                onRefreshed={(updated) => setProgramData(updated)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Demo data loader ── only returns data for known demo programs, never substitutes another
async function getDemoData(name: string): Promise<ProgramData | null> {
  const { PROGRAMS } = await import('@/lib/demo-data');
  return PROGRAMS[name] ?? null;
}
