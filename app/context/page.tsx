'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Repo {
  id: string;
  projectName: string;
  owner: string;
  repo: string;
}

interface GlossaryEntry {
  id: string;
  pattern: string;
  description: string;
  examples: string[];
  createdAt: string;
}

interface CopybookDef {
  name: string;
  fields: { level: number; name: string; pic?: string; occurs?: number }[];
}

interface ProgramRow {
  id: string;
  name: string;
  language: string;
  loc: number;
  desc: string | null;
  filePath: string | null;
  analyzed: boolean;
  fullyAnalyzed: boolean;
  castOnly: boolean;
}

interface DepGraphEdge {
  from: string;
  to: string;
  type: string;
}

interface CalleeInfo {
  name: string;
  analyzed: boolean;
}

const ROLE_MAP: Record<string, string> = {
  COBOL: 'COBOL Program',
  HLASM: 'Assembler',
  JCL: 'Batch Job',
  PROC: 'JCL Procedure',
  CPY: 'Copybook',
};

export default function ContextPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [activeTab, setActiveTab] = useState<'glossary' | 'copybooks' | 'portfolio'>('glossary');

  // Glossary state
  const [glossary, setGlossary] = useState<GlossaryEntry[]>([]);
  const [glossaryLoading, setGlossaryLoading] = useState(false);
  const [newPattern, setNewPattern] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newExamples, setNewExamples] = useState('');
  const [addingEntry, setAddingEntry] = useState(false);
  const [glossaryError, setGlossaryError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Copybooks state
  const [copybooks, setCopybooks] = useState<CopybookDef[]>([]);
  const [copybooksLoading, setCopybooksLoading] = useState(false);
  const [expandedCpy, setExpandedCpy] = useState<string | null>(null);

  // Portfolio state
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<ProgramRow | null>(null);
  const [callees, setCallees] = useState<CalleeInfo[] | null>(null);
  const [calleesLoading, setCalleesLoading] = useState(false);
  const [portfolioFilter, setPortfolioFilter] = useState<'all' | 'analyzed' | 'pending'>('all');

  useEffect(() => {
    fetch('/api/repos').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setRepos(data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedRepo) return;
    loadGlossary();
    loadCopybooks();
    loadPrograms();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRepo]);

  async function loadGlossary() {
    if (!selectedRepo) return;
    setGlossaryLoading(true);
    try {
      const r = await fetch(`/api/repos/${selectedRepo.id}/glossary`);
      const data = await r.json();
      setGlossary(Array.isArray(data) ? data : []);
    } catch { setGlossary([]); }
    finally { setGlossaryLoading(false); }
  }

  async function loadCopybooks() {
    if (!selectedRepo) return;
    setCopybooksLoading(true);
    try {
      const r = await fetch(`/api/repos/${selectedRepo.id}/copybooks`);
      const data = await r.json();
      setCopybooks(Array.isArray(data) ? data : []);
    } catch { setCopybooks([]); }
    finally { setCopybooksLoading(false); }
  }

  async function loadPrograms() {
    if (!selectedRepo) return;
    setPortfolioLoading(true);
    setSelectedProgram(null);
    setCallees(null);
    try {
      const r = await fetch(`/api/repos/${selectedRepo.id}/programs`);
      const data = await r.json();
      const list: ProgramRow[] = Array.isArray(data.programs) ? data.programs : [];
      list.sort((a, b) => b.loc - a.loc);
      setPrograms(list);
    } catch { setPrograms([]); }
    finally { setPortfolioLoading(false); }
  }

  async function loadCallees(prog: ProgramRow) {
    setSelectedProgram(prog);
    setCallees(null);
    if (!prog.analyzed) return;
    setCalleesLoading(true);
    try {
      const r = await fetch(`/api/programs/${encodeURIComponent(prog.name)}`);
      const data = await r.json();
      const edges: DepGraphEdge[] = data?.graph?.edges ?? data?.depGraph?.edges ?? [];
      const calleeNames = [...new Set(
        edges
          .filter((e: DepGraphEdge) => e.type === 'call' || e.type === 'dyn' || e.type === 'proc')
          .map((e: DepGraphEdge) => e.to)
      )];
      if (calleeNames.length === 0) {
        setCallees([]);
        return;
      }
      // Check which callees are analyzed
      const programMap = new Map(programs.map(p => [p.name, p]));
      const infos: CalleeInfo[] = calleeNames.map(name => ({
        name,
        analyzed: programMap.get(name)?.analyzed ?? false,
      }));
      setCallees(infos);
    } catch { setCallees([]); }
    finally { setCalleesLoading(false); }
  }

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRepo || !newPattern.trim() || !newDesc.trim()) return;
    setAddingEntry(true);
    setGlossaryError('');
    try {
      const examples = newExamples.split(',').map(s => s.trim()).filter(Boolean);
      const res = await fetch(`/api/repos/${selectedRepo.id}/glossary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: newPattern.trim(), description: newDesc.trim(), examples }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      setNewPattern(''); setNewDesc(''); setNewExamples('');
      setShowAddForm(false);
      await loadGlossary();
    } catch (err) {
      setGlossaryError(err instanceof Error ? err.message : 'Failed to add entry');
    } finally { setAddingEntry(false); }
  }

  async function handleDeleteEntry(id: string) {
    if (!selectedRepo) return;
    await fetch(`/api/repos/${selectedRepo.id}/glossary?id=${id}`, { method: 'DELETE' });
    setGlossary(prev => prev.filter(e => e.id !== id));
  }

  const fieldCount = copybooks.reduce((sum, cb) => sum + cb.fields.length, 0);
  const analyzedCount = programs.filter(p => p.analyzed).length;
  const totalLoc = programs.reduce((s, p) => s + (p.loc || 0), 0);
  const filteredPrograms = programs.filter(p =>
    portfolioFilter === 'all' ? true :
    portfolioFilter === 'analyzed' ? p.analyzed :
    !p.analyzed
  );

  const analyzedCallees = callees?.filter(c => c.analyzed).length ?? 0;
  const totalCallees = callees?.length ?? 0;
  const coveragePct = totalCallees > 0 ? Math.round((analyzedCallees / totalCallees) * 100) : 0;

  return (
    <div style={{ minHeight: '100vh', background: '#F4F7FA', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg,#1F3864 0%,#2E4D7B 60%,#1C7293 100%)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <span style={{ fontFamily: 'Consolas,monospace', fontWeight: 900, fontSize: 18, color: '#4DAAC7', letterSpacing: 2 }}>MAVEN</span>
          <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#fff', lineHeight: 1 }}>CARTA</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.5 }}>Mainframe Intelligence</div>
          </div>
        </Link>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>/</span>
        <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600 }}>Contextual Engineering</span>
        <div style={{ flex: 1 }} />
        <Link href="/programs" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, textDecoration: 'none', padding: '4px 12px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6 }}>← Programs</Link>
        <Link href="/settings" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, textDecoration: 'none', padding: '4px 10px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6 }}>⚙ LLM</Link>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar */}
        <aside style={{ width: 260, flexShrink: 0, background: '#fff', borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', overflow: 'auto', padding: '16px 12px' }}>
          <div style={{ fontWeight: 800, fontSize: 12, color: '#1F3864', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 }}>Select Project</div>

          {repos.length === 0 ? (
            <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '24px 8px' }}>
              No projects found. Connect a repository first.
            </div>
          ) : repos.map(r => {
            const sel = selectedRepo?.id === r.id;
            return (
              <button key={r.id} onClick={() => { setSelectedRepo(r); setSelectedProgram(null); setCallees(null); }}
                style={{ textAlign: 'left', background: sel ? '#EBF4FF' : '#FAFAFA', border: `1.5px solid ${sel ? '#1C7293' : '#E5E7EB'}`, borderRadius: 8, padding: '10px 12px', marginBottom: 8, cursor: 'pointer' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: sel ? '#1C7293' : '#1F3864' }}>{r.projectName}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{r.owner}/{r.repo}</div>
              </button>
            );
          })}

          {selectedRepo && (
            <div style={{ marginTop: 16, padding: '12px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', marginBottom: 6 }}>Context Status</div>
              <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.7 }}>
                <div>📚 {copybooks.length} copybook{copybooks.length !== 1 ? 's' : ''} · {fieldCount} fields</div>
                <div>📖 {glossary.length} glossary entr{glossary.length !== 1 ? 'ies' : 'y'}</div>
                <div>🔬 {analyzedCount}/{programs.length} programs analyzed</div>
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>

          {!selectedRepo ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🧠</div>
              <div style={{ fontWeight: 800, fontSize: 20, color: '#1F3864', marginBottom: 8 }}>Contextual Engineering</div>
              <div style={{ fontSize: 14, color: '#6B7280', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
                Select a project to manage the domain knowledge that gets injected into every LLM analysis — glossary entries, copybook definitions, and portfolio context.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, maxWidth: 640, margin: '32px auto 0' }}>
                {[
                  { icon: '📖', title: 'Domain Glossary', desc: 'Map field name patterns to plain-English business meanings. Injected into business rules prompts.' },
                  { icon: '📚', title: 'Copybook Registry', desc: 'View copybooks parsed from .cpy files. Fields are injected into every analysis as data-structure context.' },
                  { icon: '🗺', title: 'Application Portfolio', desc: 'See all programs, their analysis status, and the callee coverage that drives portfolio context injection.' },
                ].map(c => (
                  <div key={c.title} style={{ background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 12, padding: '20px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{c.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1F3864', marginBottom: 6 }}>{c.title}</div>
                    <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.6 }}>{c.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                  <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1F3864', margin: 0 }}>{selectedRepo.projectName}</h1>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{selectedRepo.owner}/{selectedRepo.repo}</div>
                </div>
              </div>

              {/* Tab bar */}
              <div style={{ display: 'flex', borderBottom: '2px solid #E5E7EB', marginBottom: 24, gap: 0 }}>
                {([
                  { id: 'glossary' as const, label: '📖 Domain Glossary', count: glossary.length },
                  { id: 'copybooks' as const, label: '📚 Copybook Registry', count: copybooks.length },
                  { id: 'portfolio' as const, label: '🗺 Application Portfolio', count: programs.length },
                ] as const).map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    style={{ padding: '10px 20px', border: 'none', borderBottom: activeTab === tab.id ? '2px solid #1C7293' : '2px solid transparent', marginBottom: -2, background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500, color: activeTab === tab.id ? '#1C7293' : '#6B7280' }}>
                    {tab.label}
                    <span style={{ marginLeft: 6, background: activeTab === tab.id ? '#EBF4FF' : '#F3F4F6', color: activeTab === tab.id ? '#1C7293' : '#9CA3AF', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>{tab.count}</span>
                  </button>
                ))}
              </div>

              {/* ── GLOSSARY TAB ── */}
              {activeTab === 'glossary' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#1F3864' }}>Domain Glossary</div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                        Field name patterns → plain-English meanings. MAVEN matches these during analysis and injects them into business rules prompts.
                      </div>
                    </div>
                    <button onClick={() => { setShowAddForm(!showAddForm); setGlossaryError(''); }}
                      style={{ background: showAddForm ? '#FEE2E2' : 'linear-gradient(135deg,#1F3864,#1C7293)', color: showAddForm ? '#DC2626' : '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      {showAddForm ? '✕ Cancel' : '+ Add Entry'}
                    </button>
                  </div>

                  {showAddForm && (
                    <form onSubmit={handleAddEntry} style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 12 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Field Pattern *</label>
                          <input value={newPattern} onChange={e => setNewPattern(e.target.value)} required
                            placeholder="e.g. ACCT-STATUS-CD"
                            style={{ width: '100%', border: '1.5px solid #D1D5DB', borderRadius: 6, padding: '8px 10px', fontSize: 12, fontFamily: 'Consolas,monospace', boxSizing: 'border-box' }} />
                          <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 3 }}>Substring match — case-insensitive</div>
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Business Description *</label>
                          <input value={newDesc} onChange={e => setNewDesc(e.target.value)} required
                            placeholder="e.g. Account status: 00=Active, 01=Closed, 02=Suspended"
                            style={{ width: '100%', border: '1.5px solid #D1D5DB', borderRadius: 6, padding: '8px 10px', fontSize: 12, boxSizing: 'border-box' }} />
                        </div>
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Example values (comma-separated, optional)</label>
                        <input value={newExamples} onChange={e => setNewExamples(e.target.value)}
                          placeholder="e.g. 00, 01, 02"
                          style={{ width: '100%', border: '1.5px solid #D1D5DB', borderRadius: 6, padding: '8px 10px', fontSize: 12, boxSizing: 'border-box' }} />
                      </div>
                      {glossaryError && <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 8 }}>{glossaryError}</div>}
                      <button type="submit" disabled={addingEntry}
                        style={{ background: addingEntry ? '#9CA3AF' : 'linear-gradient(135deg,#1F3864,#1C7293)', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: addingEntry ? 'not-allowed' : 'pointer' }}>
                        {addingEntry ? 'Saving…' : '✓ Save Entry'}
                      </button>
                    </form>
                  )}

                  {glossaryLoading ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading glossary…</div>
                  ) : glossary.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, background: '#fff', border: '1.5px dashed #E5E7EB', borderRadius: 10 }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📖</div>
                      <div style={{ fontWeight: 700, color: '#1F3864', marginBottom: 4 }}>No glossary entries yet</div>
                      <div style={{ fontSize: 12, color: '#9CA3AF' }}>Add entries to help MAVEN understand your domain-specific field names and business codes.</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {glossary.map(entry => (
                        <div key={entry.id} style={{ background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <code style={{ background: '#EBF4FF', color: '#1C7293', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{entry.pattern}</code>
                              {entry.examples?.length > 0 && (
                                <span style={{ fontSize: 10, color: '#9CA3AF' }}>values: {entry.examples.join(', ')}</span>
                              )}
                            </div>
                            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{entry.description}</div>
                          </div>
                          <button onClick={() => handleDeleteEntry(entry.id)}
                            style={{ background: 'none', border: '1px solid #FCA5A5', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#DC2626', cursor: 'pointer', flexShrink: 0 }}>
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ── COPYBOOKS TAB ── */}
              {activeTab === 'copybooks' && (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#1F3864' }}>Copybook Registry</div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                      COBOL copybooks parsed from .cpy files in your repository. Fields are automatically injected into business rules and modernization spec prompts.
                    </div>
                  </div>

                  {copybooksLoading ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading copybooks…</div>
                  ) : copybooks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, background: '#fff', border: '1.5px dashed #E5E7EB', borderRadius: 10 }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📚</div>
                      <div style={{ fontWeight: 700, color: '#1F3864', marginBottom: 4 }}>No copybooks registered</div>
                      <div style={{ fontSize: 12, color: '#9CA3AF', maxWidth: 400, margin: '0 auto' }}>
                        Copybooks are auto-discovered when you connect a GitHub repo containing .cpy files, or can be uploaded via the CAST import pipeline.
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ background: '#EBF4FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 12, color: '#1D4ED8' }}>
                        {copybooks.length} copybook{copybooks.length !== 1 ? 's' : ''} · {fieldCount} total fields indexed — all injected into analysis prompts
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {copybooks.map(cb => (
                          <div key={cb.name} style={{ background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
                            <button onClick={() => setExpandedCpy(expandedCpy === cb.name ? null : cb.name)}
                              style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                              <code style={{ fontFamily: 'Consolas,monospace', fontWeight: 800, fontSize: 13, color: '#059669', background: '#F0FDF4', padding: '2px 8px', borderRadius: 4 }}>{cb.name}</code>
                              <span style={{ fontSize: 12, color: '#9CA3AF' }}>{cb.fields.length} field{cb.fields.length !== 1 ? 's' : ''}</span>
                              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6B7280' }}>{expandedCpy === cb.name ? '▲' : '▼'}</span>
                            </button>
                            {expandedCpy === cb.name && (
                              <div style={{ borderTop: '1px solid #F3F4F6', padding: '12px 18px', overflowX: 'auto' }}>
                                <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
                                  <thead>
                                    <tr style={{ background: '#F9FAFB' }}>
                                      {['Level', 'Field Name', 'PIC', 'OCCURS'].map(h => (
                                        <th key={h} style={{ textAlign: 'left', padding: '6px 12px', fontWeight: 700, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {cb.fields.map((f, i) => (
                                      <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                        <td style={{ padding: '5px 12px', color: '#9CA3AF', fontFamily: 'Consolas,monospace' }}>{String(f.level).padStart(2, '0')}</td>
                                        <td style={{ padding: '5px 12px', fontFamily: 'Consolas,monospace', fontWeight: 600, color: '#1F3864' }}>{f.name}</td>
                                        <td style={{ padding: '5px 12px', fontFamily: 'Consolas,monospace', color: '#1C7293' }}>{f.pic ?? '—'}</td>
                                        <td style={{ padding: '5px 12px', color: '#6B7280' }}>{f.occurs ?? '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ── APPLICATION PORTFOLIO TAB ── */}
              {activeTab === 'portfolio' && (
                <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                  {/* Left: inventory */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#1F3864', marginBottom: 4 }}>Application Portfolio</div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>
                      All programs in this repository. Click a row to see its callee coverage for portfolio context injection.
                    </div>

                    {/* Summary cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
                      {[
                        { label: 'Total Programs', value: programs.length, color: '#1F3864', bg: '#EBF4FF' },
                        { label: 'Analyzed', value: analyzedCount, color: '#059669', bg: '#F0FDF4' },
                        { label: 'Pending', value: programs.length - analyzedCount, color: '#D97706', bg: '#FFFBEB' },
                        { label: 'Total LOC', value: totalLoc.toLocaleString(), color: '#7C3AED', bg: '#F5F3FF' },
                      ].map(card => (
                        <div key={card.label} style={{ background: card.bg, borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                          <div style={{ fontSize: 22, fontWeight: 900, color: card.color }}>{card.value}</div>
                          <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{card.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Filter */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                      {(['all', 'analyzed', 'pending'] as const).map(f => (
                        <button key={f} onClick={() => setPortfolioFilter(f)}
                          style={{ padding: '5px 14px', borderRadius: 20, border: '1.5px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            borderColor: portfolioFilter === f ? '#1C7293' : '#E5E7EB',
                            background: portfolioFilter === f ? '#EBF4FF' : '#fff',
                            color: portfolioFilter === f ? '#1C7293' : '#6B7280' }}>
                          {f === 'all' ? 'All' : f === 'analyzed' ? 'Analyzed' : 'Pending'}
                        </button>
                      ))}
                    </div>

                    {portfolioLoading ? (
                      <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading programs…</div>
                    ) : filteredPrograms.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 40, background: '#fff', border: '1.5px dashed #E5E7EB', borderRadius: 10 }}>
                        <div style={{ fontWeight: 700, color: '#1F3864', marginBottom: 4 }}>No programs found</div>
                        <div style={{ fontSize: 12, color: '#9CA3AF' }}>Connect a GitHub repo or import a CAST report to populate the portfolio.</div>
                      </div>
                    ) : (
                      <div style={{ background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
                        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                              {['Program', 'Language', 'LOC', 'Role', 'Status', ''].map(h => (
                                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, color: '#6B7280', fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredPrograms.map(p => {
                              const isSelected = selectedProgram?.id === p.id;
                              return (
                                <tr key={p.id}
                                  onClick={() => loadCallees(p)}
                                  style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer', background: isSelected ? '#EBF4FF' : 'white' }}>
                                  <td style={{ padding: '10px 14px' }}>
                                    <code style={{ fontFamily: 'Consolas,monospace', fontWeight: 700, color: isSelected ? '#1C7293' : '#1F3864', fontSize: 12 }}>{p.name}</code>
                                    {p.desc && <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.desc}</div>}
                                  </td>
                                  <td style={{ padding: '10px 14px', color: '#6B7280' }}>{p.language}</td>
                                  <td style={{ padding: '10px 14px', color: '#374151', fontFamily: 'Consolas,monospace' }}>{p.loc?.toLocaleString() ?? '—'}</td>
                                  <td style={{ padding: '10px 14px', color: '#6B7280' }}>{ROLE_MAP[p.language] ?? p.language}</td>
                                  <td style={{ padding: '10px 14px' }}>
                                    {p.fullyAnalyzed ? (
                                      <span style={{ background: '#F0FDF4', color: '#059669', border: '1px solid #BBF7D0', borderRadius: 12, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>Analyzed</span>
                                    ) : p.castOnly ? (
                                      <span style={{ background: '#EBF4FF', color: '#1C7293', border: '1px solid #BFDBFE', borderRadius: 12, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>CAST only</span>
                                    ) : (
                                      <span style={{ background: '#F9FAFB', color: '#9CA3AF', border: '1px solid #E5E7EB', borderRadius: 12, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>Not analyzed</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '10px 14px' }}>
                                    <Link href={`/programs/${encodeURIComponent(p.name)}`}
                                      onClick={e => e.stopPropagation()}
                                      style={{ fontSize: 11, color: '#1C7293', textDecoration: 'none', fontWeight: 600 }}>
                                      Hub →
                                    </Link>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Right: callee coverage panel */}
                  <div style={{ width: 280, flexShrink: 0, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 12, padding: '18px 16px', position: 'sticky', top: 0 }}>
                    {!selectedProgram ? (
                      <div style={{ textAlign: 'center', padding: '32px 8px', color: '#9CA3AF' }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>👆</div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>Click a program row</div>
                        <div style={{ fontSize: 11, marginTop: 4 }}>to see its portfolio context readiness</div>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#1F3864', marginBottom: 2 }}>
                          <code style={{ fontFamily: 'Consolas,monospace', color: '#1C7293' }}>{selectedProgram.name}</code>
                        </div>
                        <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 16 }}>Portfolio context readiness</div>

                        {!selectedProgram.analyzed ? (
                          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '12px', fontSize: 12, color: '#92400E' }}>
                            This program has not been analyzed yet. Run analysis to build callee summaries.
                          </div>
                        ) : calleesLoading ? (
                          <div style={{ textAlign: 'center', padding: 20, color: '#9CA3AF', fontSize: 12 }}>Loading callees…</div>
                        ) : !callees || callees.length === 0 ? (
                          <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px', fontSize: 12, color: '#6B7280' }}>
                            No callee programs detected in the dependency graph for this program.
                          </div>
                        ) : (
                          <>
                            {/* Coverage bar */}
                            <div style={{ marginBottom: 16 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>
                                <span>Portfolio coverage</span>
                                <span style={{ fontWeight: 700, color: coveragePct >= 80 ? '#059669' : coveragePct >= 40 ? '#D97706' : '#DC2626' }}>{coveragePct}%</span>
                              </div>
                              <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${coveragePct}%`, background: coveragePct >= 80 ? '#10B981' : coveragePct >= 40 ? '#F59E0B' : '#EF4444', borderRadius: 3, transition: 'width 0.4s' }} />
                              </div>
                              <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>{analyzedCallees} of {totalCallees} callees have summaries available</div>
                            </div>

                            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
                              Direct callees ({totalCallees})
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {callees.map(c => (
                                <div key={c.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: c.analyzed ? '#F0FDF4' : '#F9FAFB', border: `1px solid ${c.analyzed ? '#BBF7D0' : '#E5E7EB'}`, borderRadius: 7 }}>
                                  <code style={{ fontFamily: 'Consolas,monospace', fontSize: 11, color: '#1F3864', fontWeight: 600 }}>{c.name}</code>
                                  {c.analyzed ? (
                                    <span style={{ fontSize: 10, color: '#059669', fontWeight: 700 }}>✓ Summary ready</span>
                                  ) : (
                                    <span style={{ fontSize: 10, color: '#9CA3AF' }}>No summary yet</span>
                                  )}
                                </div>
                              ))}
                            </div>

                            {coveragePct < 100 && (
                              <div style={{ marginTop: 14, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: '#92400E' }}>
                                Analyze the missing callees to improve portfolio context quality before running spec generation on <strong>{selectedProgram.name}</strong>.
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
