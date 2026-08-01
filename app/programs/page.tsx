'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useScan } from '@/components/ScanContext';

interface Project {
  id: string;
  projectName: string;
  githubUrl: string;
  owner: string;
  repo: string;
  branch: string;
  lastSyncedAt: string | null;
  createdAt: string;
}

interface ProgramListItem {
  name: string;
  language: string;
  loc: number;
  domain: string;
  desc: string;
  status: string;
  docStatus?: 'documented' | 'cast_only' | 'not_analyzed';
  lastAnalyzedAt: string | null;
}

const DEMO_PROGRAMS: ProgramListItem[] = [
  { name: 'GTMSETL0', language: 'COBOL', loc: 847, domain: 'Settlement / GTM', desc: 'Settlement cutoff calculation — determines and broadcasts the daily transaction cutoff timestamp for all GTM payment flows.', status: 'analyzed', lastAnalyzedAt: null },
  { name: 'GTMPOST1', language: 'COBOL', loc: 612, domain: 'Settlement / GTM', desc: 'Transaction posting — processes pending transactions against the settlement cutoff and writes to the GLEDGER feed.', status: 'analyzed', lastAnalyzedAt: null },
];

const UNAVAILABLE_PROGRAMS = [
  { name: 'GTMVALD2', language: 'COBOL', loc: 534, desc: 'Pre-cutoff validation — validates all pending transactions before the settlement run proceeds.' },
  { name: 'GTMCICS4', language: 'COBOL', loc: 328, desc: 'CICS online transaction — allows online users to query the current settlement cutoff status at runtime.' },
  { name: 'GTMDB2IO', language: 'COBOL', loc: 489, desc: 'DB2 access module — owns all I/O operations against the SETL_CTRL table; called by GTMVALD2.' },
  { name: 'GTMASM01', language: 'HLASM', loc: 143, desc: 'Assembler bit-field utility — called dynamically by GTMVALD2 for packed-byte flag manipulation. Partial coverage.' },
];

export default function ProgramsPage() {
  const router = useRouter();
  const { startScan } = useScan();

  const [llmProvider, setLlmProvider] = useState<string>('Groq');
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      const names: Record<string, string> = { groq: 'Groq', openai: 'OpenAI', anthropic: 'Claude' };
      setLlmProvider(names[d.provider] ?? 'Groq');
    }).catch(() => {});
  }, []);

  // Projects state
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newFormTab, setNewFormTab] = useState<'github' | 'cast'>('github');
  const [projectName, setProjectName] = useState('');
  const [connectUrl, setConnectUrl] = useState('');
  const [connectPat, setConnectPat] = useState('');
  const [castFile, setCastFile] = useState<File | null>(null);
  const [castProjectName, setCastProjectName] = useState('');
  const [sidebarCastFile, setSidebarCastFile] = useState<File | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [connectSuccess, setConnectSuccess] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Programs state
  const [programs, setPrograms] = useState<ProgramListItem[]>([]);
  const [query, setQuery] = useState('');
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [isRealData, setIsRealData] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadPrograms(selectedProject.id);
    } else {
      // Load all programs when no project selected
      fetch('/api/programs')
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) { setPrograms(data); setIsRealData(true); }
          else setPrograms(DEMO_PROGRAMS);
        })
        .catch(() => setPrograms(DEMO_PROGRAMS));
    }
  }, [selectedProject]);

  async function fetchProjects() {
    try {
      const res = await fetch('/api/repos');
      const data = await res.json();
      if (Array.isArray(data)) setProjects(data);
    } catch {
      setProjects([]);
    }
  }

  async function loadPrograms(repoId: string) {
    setLoadingPrograms(true);
    try {
      const res = await fetch(`/api/programs?repoId=${repoId}`);
      const data = await res.json();
      const seen = new Set<string>();
      const deduped = (Array.isArray(data) ? data : []).filter((p: ProgramListItem) => {
        if (seen.has(p.name)) return false;
        seen.add(p.name);
        return true;
      });
      setPrograms(deduped.length > 0 ? deduped : []);
    } catch {
      setPrograms([]);
    } finally {
      setLoadingPrograms(false);
    }
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!connectUrl.trim() || !projectName.trim()) return;
    setConnecting(true);
    setConnectError('');
    setConnectSuccess('');
    try {
      const res = await fetch('/api/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName, githubUrl: connectUrl, pat: connectPat || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect repo');

      // Kick off async scan — user can navigate freely while it runs
      if (data.repoId && data.scanJobId) {
        startScan(data.repoId, data.scanJobId);
        setConnectSuccess('Repository connected — scanning in background');
      } else {
        setConnectSuccess('Repository connected');
      }

      setProjectName('');
      setConnectUrl('');
      setConnectPat('');
      setShowNewForm(false);
      await fetchProjects();
    } catch (err: unknown) {
      setConnectError(err instanceof Error ? err.message : 'Failed to connect repository');
    } finally {
      setConnecting(false);
    }
  }

  async function handleCastUpload(file: File, name: string) {
    setConnecting(true);
    setConnectError('');
    setConnectSuccess('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', name || file.name.replace(/\.[^.]+$/, ''));
      const res = await fetch('/api/cast', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setConnectSuccess(`Imported ${data.imported} of ${data.total} programs from ${file.name}`);
      setCastFile(null);
      setCastProjectName('');
      setSidebarCastFile(null);
      setShowNewForm(false);
      await fetchProjects();
    } catch (err: unknown) {
      setConnectError(err instanceof Error ? err.message : 'CAST upload failed');
    } finally {
      setConnecting(false);
    }
  }

  async function handleDelete(project: Project) {
    if (!confirm(`Delete project "${project.projectName}"?\n\nThis will permanently remove all programs, analysis jobs, dependency graphs, and documentation for this project. This cannot be undone.`)) return;
    setDeletingId(project.id);
    try {
      const res = await fetch(`/api/repos/${project.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      if (selectedProject?.id === project.id) {
        setSelectedProject(null);
        setPrograms(DEMO_PROGRAMS);
      }
      await fetchProjects();
    } catch {
      alert('Failed to delete project. Try again or use the Admin page.');
    } finally {
      setDeletingId(null);
    }
  }

  const allPrograms = selectedProject ? programs : (programs.length > 0 ? programs : DEMO_PROGRAMS);
  const seen = new Set<string>();
  const deduped = allPrograms.filter((p) => { if (seen.has(p.name)) return false; seen.add(p.name); return true; });
  const filtered = deduped.filter((p) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q) || p.domain.toLowerCase().includes(q);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#F4F7FA' }}>

      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg, #1F3864 0%, #2E4D7B 60%, #1C7293 100%)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 900, fontSize: 18, color: '#4DAAC7', letterSpacing: 2 }}>MAVEN</span>
          <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#fff', lineHeight: 1 }}>CARTA</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.5 }}>Mainframe Intelligence</div>
          </div>
        </Link>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>/</span>
        <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600 }}>Program Knowledge Base</span>
        <div style={{ flex: 1 }} />
        <span style={{ background: 'rgba(224,123,57,0.25)', border: '1px solid rgba(224,123,57,0.6)', color: '#FCD58A', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>DEMO · {llmProvider} API</span>
        <Link href="/context" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, textDecoration: 'none', padding: '4px 10px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6 }}>🧠 Context</Link>
        <Link href="/settings" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, textDecoration: 'none', padding: '4px 10px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6 }}>⚙ LLM</Link>
        <Link href="/admin" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, textDecoration: 'none', padding: '4px 10px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6 }}>Admin</Link>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* LEFT — Project Sidebar */}
        <aside style={{ width: 300, flexShrink: 0, background: '#fff', borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>

          {/* Sidebar header */}
          <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#1F3864', letterSpacing: 0.5, textTransform: 'uppercase' }}>Projects</div>
              <button
                onClick={() => { setShowNewForm(!showNewForm); setConnectError(''); setConnectSuccess(''); }}
                style={{ background: showNewForm ? '#FEE2E2' : '#EBF4FF', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 700, color: showNewForm ? '#DC2626' : '#1F3864', cursor: 'pointer' }}
              >
                {showNewForm ? '✕ Cancel' : '+ New Project'}
              </button>
            </div>

            {/* New project form */}
            {showNewForm && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {/* Tab switcher */}
                <div style={{ display: 'flex', border: '1.5px solid #E5E7EB', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
                  {(['github', 'cast'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setNewFormTab(tab)}
                      style={{
                        flex: 1, padding: '7px 4px', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                        background: newFormTab === tab ? '#1F3864' : '#F9FAFB',
                        color: newFormTab === tab ? '#fff' : '#6B7280',
                        transition: 'all 0.12s',
                      }}
                    >
                      {tab === 'github' ? '🐙 GitHub' : '📤 CAST Reports'}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Project name *"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    required
                    style={{ border: '1.5px solid #D1D5DB', borderRadius: 6, padding: '7px 10px', fontSize: 12, fontFamily: 'inherit' }}
                  />

                  {newFormTab === 'github' ? (
                    <>
                      <input
                        type="url"
                        placeholder="GitHub URL *"
                        value={connectUrl}
                        onChange={(e) => setConnectUrl(e.target.value)}
                        required
                        style={{ border: '1.5px solid #D1D5DB', borderRadius: 6, padding: '7px 10px', fontSize: 12, fontFamily: 'inherit' }}
                      />
                      <input
                        type="password"
                        placeholder="GitHub PAT (optional — needed for private repos)"
                        value={connectPat}
                        onChange={(e) => setConnectPat(e.target.value)}
                        style={{ border: '1.5px solid #D1D5DB', borderRadius: 6, padding: '7px 10px', fontSize: 12, fontFamily: 'inherit' }}
                      />
                      <div style={{ fontSize: 10, color: '#9CA3AF', lineHeight: 1.5, padding: '0 2px' }}>
                        MAVEN will discover all COBOL / HLASM files and run LLM-based dependency analysis (Path B). Upload CAST reports after connecting to upgrade to Path A.
                      </div>
                      <button
                        type="submit"
                        disabled={connecting}
                        style={{ background: connecting ? '#9CA3AF' : 'linear-gradient(135deg, #1F3864, #1C7293)', color: '#fff', border: 'none', borderRadius: 6, padding: '8px', fontSize: 12, fontWeight: 700, cursor: connecting ? 'not-allowed' : 'pointer' }}
                      >
                        {connecting ? 'Scanning repo…' : 'Connect & Scan →'}
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 6, padding: '8px 10px', fontSize: 11, color: '#92400E', lineHeight: 1.5 }}>
                        <strong>Path A — Deterministic mode.</strong> Upload output from CAST Highlight, CAST Imaging, or the MAVEN static analyzer. Supported formats: <code>.xml</code>, <code>.json</code>
                      </div>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>Project name</span>
                        <input
                          type="text"
                          value={castProjectName}
                          onChange={(e) => setCastProjectName(e.target.value)}
                          placeholder="e.g. CardDemo CAST Import"
                          style={{ fontSize: 11, border: '1.5px solid #D1D5DB', borderRadius: 6, padding: '7px 10px', background: '#F9FAFB' }}
                        />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>CAST dependency report *</span>
                        <input
                          type="file"
                          accept=".xml,.json"
                          onChange={(e) => setCastFile(e.target.files?.[0] ?? null)}
                          style={{ fontSize: 11, border: '1.5px dashed #D1D5DB', borderRadius: 6, padding: '8px', background: '#F9FAFB', cursor: 'pointer' }}
                        />
                      </label>
                      {castFile && (
                        <div style={{ fontSize: 11, color: '#059669', background: '#F0FDF4', padding: '5px 8px', borderRadius: 4 }}>
                          ✓ {castFile.name} ({(castFile.size / 1024).toFixed(0)} KB)
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={!castFile || connecting}
                        onClick={() => castFile && handleCastUpload(castFile, castProjectName)}
                        style={{ background: (!castFile || connecting) ? '#F3F4F6' : 'linear-gradient(135deg, #1F3864, #1C7293)', border: '1px solid #E5E7EB', color: (!castFile || connecting) ? '#9CA3AF' : '#fff', borderRadius: 6, padding: '8px', fontSize: 12, fontWeight: 700, cursor: (!castFile || connecting) ? 'not-allowed' : 'pointer' }}
                      >
                        {connecting ? 'Uploading…' : 'Upload CAST Report →'}
                      </button>
                    </>
                  )}

                  {connectError && <div style={{ fontSize: 11, color: '#DC2626', background: '#FEF2F2', padding: '6px 8px', borderRadius: 4 }}>{connectError}</div>}
                  {connectSuccess && <div style={{ fontSize: 11, color: '#16A34A', background: '#F0FDF4', padding: '6px 8px', borderRadius: 4 }}>✓ {connectSuccess}</div>}
                </form>
              </div>
            )}
          </div>

          {/* Project list */}
          <div style={{ flex: 1, padding: '8px 12px', overflowY: 'auto' }}>
            {projects.length === 0 ? (
              <div style={{ padding: '24px 8px', textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>No projects yet</div>
                <div>Create a project by connecting a GitHub repository above.</div>
              </div>
            ) : (
              projects.map((p) => {
                const isSelected = selectedProject?.id === p.id;
                return (
                  <div
                    key={p.id}
                    style={{ borderRadius: 8, border: `1.5px solid ${isSelected ? '#1C7293' : '#E5E7EB'}`, background: isSelected ? '#EBF4FF' : '#FAFAFA', marginBottom: 8, padding: '10px 12px', cursor: 'pointer', transition: 'all 0.15s' }}
                    onClick={() => setSelectedProject(isSelected ? null : p)}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: isSelected ? '#1C7293' : '#1F3864', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {isSelected ? '◆ ' : ''}{p.projectName}
                        </div>
                        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.owner}/{p.repo}
                        </div>
                        <div style={{ fontSize: 10, color: '#6B7280', marginTop: 4 }}>
                          {p.lastSyncedAt ? `Last scan: ${new Date(p.lastSyncedAt).toLocaleDateString()}` : `Added: ${new Date(p.createdAt).toLocaleDateString()}`}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(p); }}
                        disabled={deletingId === p.id}
                        title="Delete project"
                        style={{ background: 'none', border: '1px solid #FCA5A5', borderRadius: 4, padding: '2px 6px', fontSize: 11, color: '#DC2626', cursor: 'pointer', flexShrink: 0 }}
                      >
                        {deletingId === p.id ? '…' : '🗑'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* CAST Reports section */}
          <div style={{ padding: '14px 16px', borderTop: '1px solid #F3F4F6', background: '#F9FAFB' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>CAST / Deterministic Reports</div>
            <div style={{ background: '#fff', border: '1px dashed #D1D5DB', borderRadius: 8, padding: '12px' }}>
              <div style={{ fontSize: 11, color: '#4B5563', marginBottom: 8, lineHeight: 1.5 }}>Upload <code>.json</code> or <code>.xml</code> from CAST or the MAVEN static analyzer to import deterministic dep graphs.</div>
              <label style={{ display: 'block', marginBottom: 6 }}>
                <input
                  type="file"
                  accept=".xml,.json"
                  onChange={(e) => setSidebarCastFile(e.target.files?.[0] ?? null)}
                  style={{ fontSize: 11, border: '1.5px dashed #D1D5DB', borderRadius: 6, padding: '6px', background: '#F9FAFB', cursor: 'pointer', width: '100%' }}
                />
              </label>
              {sidebarCastFile && (
                <div style={{ fontSize: 11, color: '#059669', marginBottom: 6 }}>✓ {sidebarCastFile.name}</div>
              )}
              <button
                disabled={!sidebarCastFile || connecting}
                onClick={() => sidebarCastFile && handleCastUpload(sidebarCastFile, sidebarCastFile.name.replace(/\.[^.]+$/, ''))}
                style={{ width: '100%', background: (!sidebarCastFile || connecting) ? '#F3F4F6' : 'linear-gradient(135deg, #1F3864, #1C7293)', border: '1px solid #E5E7EB', borderRadius: 6, padding: '7px', fontSize: 11, color: (!sidebarCastFile || connecting) ? '#9CA3AF' : '#fff', cursor: (!sidebarCastFile || connecting) ? 'not-allowed' : 'pointer', fontWeight: 700 }}
              >
                {connecting ? 'Uploading…' : '📤 Upload Report'}
              </button>
              {connectSuccess && <div style={{ fontSize: 11, color: '#059669', background: '#F0FDF4', padding: '5px 8px', borderRadius: 4, marginTop: 6 }}>✓ {connectSuccess}</div>}
              {connectError && <div style={{ fontSize: 11, color: '#DC2626', background: '#FEF2F2', padding: '5px 8px', borderRadius: 4, marginTop: 6 }}>{connectError}</div>}
            </div>
          </div>
        </aside>

        {/* RIGHT — Program Grid */}
        <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>

          {/* Context header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1F3864', margin: 0 }}>
                {selectedProject ? selectedProject.projectName : 'Program Knowledge Base'}
              </h1>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3 }}>
                {selectedProject
                  ? `${selectedProject.owner}/${selectedProject.repo} · ${selectedProject.branch}`
                  : isRealData
                  ? `${programs.length} programs across all projects`
                  : 'Select a project from the sidebar, or browse the demo programs below'}
              </div>
            </div>

            {/* Pipeline status — shown when a project is selected */}
            {selectedProject ? (
              <div style={{ background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 280 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>Pipeline Status</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { label: 'CAST', status: 'fail' as const },
                    { label: 'GitHub', status: 'success' as const },
                    { label: 'LLM Graph', status: 'llm' as const },
                    { label: 'Docs', status: 'success' as const },
                  ].map((step, i) => {
                    const colors = {
                      success: { bg: 'rgba(5,150,105,0.1)', border: 'rgba(5,150,105,0.3)', text: '#059669', icon: '✓' },
                      fail:    { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.25)', text: '#DC2626', icon: '✕' },
                      llm:     { bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.25)', text: '#7C3AED', icon: '~' },
                      pending: { bg: 'rgba(156,163,175,0.1)', border: '#E5E7EB', text: '#9CA3AF', icon: '…' },
                    };
                    const c = colors[step.status];
                    return (
                      <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700, color: c.text }}>
                          {c.icon} {step.label}
                        </span>
                        {i < 3 && <span style={{ color: '#D1D5DB', fontSize: 10 }}>→</span>}
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 10, color: '#D97706', fontWeight: 600 }}>
                  ⚠ CAST not connected — graph is LLM-inferred · <span style={{ color: '#1C7293', cursor: 'pointer', textDecoration: 'underline' }}>Upload reports to upgrade</span>
                </div>
              </div>
            ) : !isRealData ? (
              <span style={{ background: '#EBF4FF', border: '1px solid #BFDBFE', color: '#1D4ED8', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 600 }}>
                Demo data — connect a project to analyse real COBOL
              </span>
            ) : null}
          </div>

          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 8, padding: '8px 14px', marginBottom: 20 }}>
            <span style={{ color: '#9CA3AF', fontSize: 16 }}>⌕</span>
            <input
              type="text"
              placeholder="Search programs by name, domain, or description…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, fontFamily: 'inherit', color: '#1F2937' }}
            />
          </div>

          {loadingPrograms ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
              Loading programs…
            </div>
          ) : selectedProject && programs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
              <div style={{ fontWeight: 700, color: '#1F3864', fontSize: 16, marginBottom: 6 }}>No programs found</div>
              <div style={{ color: '#6B7280', fontSize: 13 }}>This project has no analyzed programs yet. Re-scan the repository to discover COBOL files.</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 32 }}>
                {filtered.map((prog) => {
                  const ds = prog.docStatus ?? (prog.status === 'analyzed' ? 'documented' : 'not_analyzed');
                  const isDoc = ds === 'documented';
                  const isCast = ds === 'cast_only';
                  const borderColor = isDoc ? '#16A34A' : isCast ? '#D97706' : '#E5E7EB';
                  const accentBg = isDoc ? '#F0FDF4' : isCast ? '#FFFBEB' : '#fff';
                  return (
                    <div
                      key={prog.name}
                      onClick={() => router.push(`/programs/${prog.name}`)}
                      style={{
                        background: '#fff', border: `1.5px solid ${borderColor}`,
                        borderRadius: 12, padding: '16px 18px',
                        cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.15s',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                        display: 'flex', flexDirection: 'column', gap: 0,
                      }}
                      onMouseEnter={(e) => { const d = e.currentTarget as HTMLDivElement; d.style.boxShadow = '0 4px 20px rgba(28,114,147,0.15)'; d.style.transform = 'translateY(-2px)'; }}
                      onMouseLeave={(e) => { const d = e.currentTarget as HTMLDivElement; d.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; d.style.transform = 'translateY(0)'; }}
                    >
                      {/* Top row: language tag + status badge */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ background: prog.language === 'HLASM' ? '#F0E8FF' : '#EBF4FF', color: prog.language === 'HLASM' ? '#4B2D80' : '#1F3864', borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>
                            {prog.language}
                          </span>
                          {prog.domain && prog.domain !== 'Unknown' && (
                            <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500 }}>{prog.domain}</span>
                          )}
                        </div>
                        {isDoc && (
                          <span style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#16A34A', borderRadius: 20, padding: '3px 8px', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                            ✓ Documented
                          </span>
                        )}
                        {isCast && (
                          <span style={{ background: '#FFFBEB', border: '1px solid #FCD34D', color: '#92400E', borderRadius: 20, padding: '3px 8px', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                            📊 CAST Imported
                          </span>
                        )}
                      </div>

                      {/* Program name */}
                      <div style={{ fontFamily: 'Consolas, monospace', fontWeight: 800, fontSize: 15, color: '#1F3864', marginBottom: 8 }}>
                        {prog.name}
                      </div>

                      {/* Description or state hint */}
                      <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6, marginBottom: 10, minHeight: 36 }}>
                        {isDoc && prog.desc
                          ? prog.desc.length > 120 ? prog.desc.slice(0, 118) + '…' : prog.desc
                          : isCast
                          ? <span style={{ color: '#D97706', fontStyle: 'italic' }}>Dependency graph imported from CAST — documentation not yet generated.</span>
                          : <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>Not yet analysed. Click to run the full analysis pipeline.</span>
                        }
                      </div>

                      {/* Bottom row: meta + CTA */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 8, borderTop: `1px solid ${accentBg === '#fff' ? '#F3F4F6' : borderColor}22` }}>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <span style={{ fontSize: 11, color: '#9CA3AF' }}>📏 {prog.loc?.toLocaleString() ?? '—'} LOC</span>
                          {prog.lastAnalyzedAt && (
                            <span style={{ fontSize: 11, color: '#9CA3AF' }}>🕐 {new Date(prog.lastAnalyzedAt).toLocaleDateString()}</span>
                          )}
                        </div>
                        <span style={{
                          fontSize: 12, fontWeight: 700, flexShrink: 0,
                          color: isDoc ? '#16A34A' : isCast ? '#D97706' : '#1C7293',
                        }}>
                          {isDoc ? 'Open Documentation →' : isCast ? 'Generate Documentation →' : 'Analyse →'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Unavailable programs (demo only) */}
              {!selectedProject && !isRealData && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                    Additional Programs (Not in Demo Scope)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
                    {UNAVAILABLE_PROGRAMS.map((prog) => (
                      <div key={prog.name} style={{ background: '#F9FAFB', border: '1.5px dashed #E5E7EB', borderRadius: 10, padding: '14px 16px', opacity: 0.75 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ background: prog.language === 'HLASM' ? '#F0E8FF' : '#F3F4F6', color: prog.language === 'HLASM' ? '#4B2D80' : '#6B7280', borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>{prog.language}</span>
                          <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 700, fontSize: 14, color: '#4B5563' }}>{prog.name}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.5, marginBottom: 8 }}>{prog.desc}</div>
                        <div style={{ fontSize: 10, color: '#9CA3AF' }}>📏 {prog.loc} LOC</div>
                        <div style={{ fontSize: 10, color: '#E07B39', marginTop: 4, fontWeight: 600 }}>
                          {prog.name === 'GTMASM01' ? '⚠ Partial coverage (71%)' : 'Available in full MAVEN build'}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
