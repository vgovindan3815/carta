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
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Fetch program data from API (falls back to embedded demo data)
  async function fetchProgramData(): Promise<ProgramData | null> {
    try {
      const res = await fetch(`/api/programs/${name}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.status === 'not_analyzed') return null;
      return data as ProgramData;
    } catch {
      return null;
    }
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
        setLogs((prev) => [...prev, line]);
        setProgress(Math.round(((i + 1) / total) * 100));
        if (line.lv === 'INFO' || line.lv === 'LLM') {
          setStatusText(line.t.replace(/<[^>]+>/g, ''));
        }
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
        // Auto-advance to hub when done
        if (i === total - 1) {
          setTimeout(enterHub, 900);
        }
      }, delay);
      timerRefs.current.push(t);
    });
  }

  // Try real SSE pipeline, fall back to demo
  async function startProcessing() {
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
    let lineId = 0;
    const es = new EventSource(`/api/jobs/${jobId}`);
    esRef.current = es;

    es.onmessage = (evt) => {
      try {
        const line = JSON.parse(evt.data) as { lv: string; t: string };
        setLogs((prev) => [...prev, { ...line, id: lineId++ }]);
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
      setTimeout(enterHub, 900);
    });

    es.addEventListener('error', () => {
      es.close();
      // Fall back to demo if SSE fails
      runDemoSimulation();
    });

    es.onerror = () => {
      es.close();
      runDemoSimulation();
    };
  }

  async function enterHub() {
    timerRefs.current.forEach(clearTimeout);
    if (esRef.current) esRef.current.close();

    // Try to load real data; fall back to demo static data
    let data = await fetchProgramData();
    if (!data) {
      data = await getDemoData(name!);
    }
    setProgramData(data);
    setPhase('hub');
    setActiveTab('overview');
  }

  // Skip processing
  async function skipProcessing() {
    timerRefs.current.forEach(clearTimeout);
    if (esRef.current) esRef.current.close();
    let data = await fetchProgramData();
    if (!data) data = await getDemoData(name!);
    setProgramData(data);
    setPhase('hub');
    setActiveTab('overview');
  }

  useEffect(() => {
    if (name) startProcessing();
    return () => {
      timerRefs.current.forEach(clearTimeout);
      if (esRef.current) esRef.current.close();
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
                  <div className="proc-subtitle">MAVEN Analysis Engine &nbsp;·&nbsp; Running simulation</div>
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
                  {progress === 100 ? (
                    <span className="proc-ready-msg">✓ Analysis complete — documentation ready</span>
                  ) : (
                    statusText
                  )}
                </div>
              </div>
              {progress === 100 && (
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

  // Hub view
  if (!programData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ color: 'var(--text-3)' }}>Loading…</div>
      </div>
    );
  }

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
        <span className="prototype-badge">ILLUSTRATIVE PROTOTYPE</span>
      </header>

      {!disclaimerDismissed && (
        <div className="sim-disclaimer">
          <div className="disclaimer-inner">
            <span className="disclaimer-icon">ℹ</span>
            <div className="disclaimer-text">
              <strong>Simulation Mode</strong> — The analysis workflow above was simulated for
              demonstration purposes. Documentation rendered below is pre-authored on a synthetic
              COBOL estate. In production, MAVEN executes live deterministic analysis (CAST engine)
              and on-demand LLM generation, producing this output in real time against your actual
              codebase.
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

      <div className="hub-body">
        <div className="program-identity">
          <div>
            <div className="prog-name">{programData.name}</div>
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
              <ChangeImpact program={programData} />
            </div>
          )}
          {activeTab === 'spec' && (
            <div className="tab-panel">
              <ModernizationSpec program={programData} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Demo data loader ── returns full ProgramData from the embedded prototype dataset
async function getDemoData(name: string): Promise<ProgramData> {
  const { PROGRAMS } = await import('@/lib/demo-data');
  return PROGRAMS[name] ?? PROGRAMS['GTMSETL0'];
}
