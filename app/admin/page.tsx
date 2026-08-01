'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface AdminStats {
  repos: number;
  programs: number;
  jobs: number;
  totalTokens: number;
}

interface Project {
  id: string;
  projectName: string;
  githubUrl: string;
  owner: string;
  repo: string;
  lastSyncedAt: string | null;
  createdAt: string;
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [clearingAll, setClearingAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoadingStats(true);
    try {
      const [statsRes, projRes] = await Promise.all([
        fetch('/api/admin'),
        fetch('/api/repos'),
      ]);
      const statsData = await statsRes.json();
      const projData = await projRes.json();
      setStats(statsData);
      setProjects(Array.isArray(projData) ? projData : []);
    } catch {
      setStats({ repos: 0, programs: 0, jobs: 0, totalTokens: 0 });
    } finally {
      setLoadingStats(false);
    }
  }

  async function handleClearAll() {
    if (!confirm('Clear ALL data?\n\nThis will permanently delete every project, program, analysis job, dependency graph, and generated document in the database. This action cannot be undone.')) return;
    if (!confirm('Are you absolutely sure? All stored analysis and documentation will be lost.')) return;
    setClearingAll(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin', { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      setMessage({ type: 'success', text: 'All data cleared. The knowledge base is empty.' });
      setProjects([]);
      setStats({ repos: 0, programs: 0, jobs: 0, totalTokens: 0 });
    } catch (e: unknown) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to clear data' });
    } finally {
      setClearingAll(false);
    }
  }

  async function handleDeleteProject(project: Project) {
    if (!confirm(`Delete project "${project.projectName}"?\n\nThis removes all programs and analysis data for ${project.owner}/${project.repo}. This cannot be undone.`)) return;
    setDeletingId(project.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/repos/${project.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      setMessage({ type: 'success', text: `Project "${project.projectName}" deleted.` });
      await loadData();
    } catch (e: unknown) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to delete project' });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F7FA', display: 'flex', flexDirection: 'column' }}>

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
        <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600 }}>Admin &amp; Maintenance</span>
        <div style={{ flex: 1 }} />
        <Link href="/settings" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, textDecoration: 'none', padding: '4px 12px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6 }}>⚙ LLM Settings</Link>
        <Link href="/programs" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, textDecoration: 'none', padding: '4px 12px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6 }}>
          ← Program Knowledge Base
        </Link>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px', width: '100%' }}>

        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1F3864', margin: '0 0 4px' }}>Database Maintenance</h1>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 28px' }}>Manage projects, clear analysis data, and monitor storage usage.</p>

        {/* Feedback banner */}
        {message && (
          <div style={{
            background: message.type === 'success' ? '#F0FDF4' : '#FEF2F2',
            border: `1px solid ${message.type === 'success' ? '#BBF7D0' : '#FECACA'}`,
            color: message.type === 'success' ? '#16A34A' : '#DC2626',
            borderRadius: 8, padding: '12px 16px', marginBottom: 24, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8
          }}>
            <span>{message.type === 'success' ? '✓' : '✕'}</span>
            {message.text}
            <button onClick={() => setMessage(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: 14 }}>✕</button>
          </div>
        )}

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Projects', value: loadingStats ? '…' : String(stats?.repos ?? 0), icon: '📁', color: '#1F3864' },
            { label: 'Programs', value: loadingStats ? '…' : String(stats?.programs ?? 0), icon: '📄', color: '#1C7293' },
            { label: 'Analysis Jobs', value: loadingStats ? '…' : String(stats?.jobs ?? 0), icon: '⚙️', color: '#7C3AED' },
            { label: 'Tokens Used (total)', value: loadingStats ? '…' : (stats?.totalTokens ?? 0).toLocaleString(), icon: '🔢', color: '#D97706', sub: '/ 100K daily limit' },
          ].map((s) => (
            <div key={s.label} style={{ background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 12, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600 }}>{s.label}</div>
              {'sub' in s && s.sub && <div style={{ fontSize: 11, color: '#D97706', fontWeight: 500 }}>{s.sub}</div>}
            </div>
          ))}
        </div>

        {/* Projects table */}
        <div style={{ background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', marginBottom: 28 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1F3864' }}>Projects</div>
            <button
              onClick={loadData}
              style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#4B5563', cursor: 'pointer', fontWeight: 600 }}
            >
              ↻ Refresh
            </button>
          </div>

          {projects.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
              No projects in database.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {['Project', 'Repository', 'Created', 'Last Scan', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects.map((p, i) => (
                  <tr key={p.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #F3F4F6' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13, color: '#1F3864' }}>{p.projectName}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#4B5563', fontFamily: 'Consolas, monospace' }}>{p.owner}/{p.repo}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#9CA3AF' }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#9CA3AF' }}>{p.lastSyncedAt ? new Date(p.lastSyncedAt).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => handleDeleteProject(p)}
                        disabled={deletingId === p.id}
                        style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: deletingId === p.id ? 'not-allowed' : 'pointer', opacity: deletingId === p.id ? 0.5 : 1 }}
                      >
                        {deletingId === p.id ? 'Deleting…' : 'Delete Project'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Danger zone */}
        <div style={{ background: '#fff', border: '2px solid #FECACA', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ background: '#FEF2F2', padding: '14px 20px', borderBottom: '1px solid #FECACA', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#991B1B' }}>Danger Zone</div>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1F2937', marginBottom: 4 }}>Clear all data</div>
                <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>
                  Permanently deletes every project, program, dependency graph, business rules document, change impact analysis, and modernization spec from the database. The Neon database will be empty after this operation. This cannot be undone.
                </div>
              </div>
              <button
                onClick={handleClearAll}
                disabled={clearingAll}
                style={{
                  background: clearingAll ? '#9CA3AF' : '#DC2626',
                  border: 'none',
                  color: '#fff',
                  borderRadius: 8,
                  padding: '10px 20px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: clearingAll ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {clearingAll ? 'Clearing…' : 'Clear All Data'}
              </button>
            </div>
          </div>
        </div>

        {/* DB info */}
        <div style={{ marginTop: 24, padding: '14px 16px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🗄</span>
          <span>
            Storage: <strong>Neon serverless PostgreSQL</strong> · Schema: repos → programs → analysis_jobs, dep_graphs, biz_rules, change_impact, mod_specs
          </span>
        </div>
      </div>
    </div>
  );
}
