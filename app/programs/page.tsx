'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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

interface ProgramRow {
  name: string;
  language: string;
  loc: number;
  domain: string;
  desc: string;
  status: string;
  docStatus?: 'documented' | 'cast_only' | 'not_analyzed';
  lastAnalyzedAt: string | null;
}

// ── Dot status ──────────────────────────────────────────────────────────────
type DotState = 'ok' | 'warn' | 'none';
const DOT_COLORS: Record<DotState, string> = {
  ok:   '#16A34A',
  warn: '#D97706',
  none: '#D1D5DB',
};
const DOT_LABELS: Record<DotState, Record<string, string>> = {
  ok:   { graph: 'Deterministic', biz: 'Generated', docs: 'Complete', cast: 'CAST import' },
  warn: { graph: 'LLM-inferred',  biz: 'Partial',   docs: 'Partial',  cast: '' },
  none: { graph: 'None',          biz: 'None',       docs: 'None',     cast: '' },
};

function Dot({ state, col }: { state: DotState; col: string }) {
  const label = state === 'ok' && col === 'graph' ? 'Deterministic'
    : state === 'warn' && col === 'graph' ? 'LLM-inferred'
    : DOT_LABELS[state][col];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: DOT_COLORS[state], flexShrink: 0, display: 'inline-block' }} />
      <span style={{ color: state === 'none' ? '#9CA3AF' : '#374151' }}>{label}</span>
    </span>
  );
}

function castDot(docStatus: string | undefined, col: 'graph' | 'biz' | 'docs'): DotState {
  if (col === 'graph') {
    if (docStatus === 'documented' || docStatus === 'cast_only') return 'ok';
    return 'none';
  }
  if (col === 'biz' || col === 'docs') {
    if (docStatus === 'documented') return 'ok';
    return 'none';
  }
  return 'none';
}

function graphLabel(docStatus: string | undefined): string {
  if (docStatus === 'cast_only') return 'CAST import';
  if (docStatus === 'documented') return 'Deterministic';
  return 'None';
}

// ── Program row ──────────────────────────────────────────────────────────────
function ProgramTableRow({ prog, onNavigate }: { prog: ProgramRow; onNavigate: (name: string) => void }) {
  const ds = prog.docStatus ?? (prog.status === 'analyzed' ? 'documented' : 'not_analyzed');
  const graphState: DotState = ds === 'documented' || ds === 'cast_only' ? 'ok' : 'none';
  const bizState: DotState   = ds === 'documented' ? 'ok' : 'none';
  const docsState: DotState  = ds === 'documented' ? 'ok' : 'none';
  const isComplete = ds === 'documented';
  const hasCast    = ds === 'cast_only';

  return (
    <tr
      onClick={() => onNavigate(prog.name)}
      style={{ cursor: 'pointer', borderBottom: '1px solid #F3F4F6' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#F8FAFD'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}
    >
      <td style={{ padding: '9px 14px', fontFamily: 'Consolas,monospace', fontWeight: 700, fontSize: 12, color: '#1F3864' }}>
        {prog.name}
      </td>
      <td style={{ padding: '9px 10px', fontSize: 11, color: '#6B7280' }}>{prog.language}</td>
      <td style={{ padding: '9px 10px', fontSize: 11, color: '#6B7280', textAlign: 'right' }}>
        {prog.loc ? prog.loc.toLocaleString() : '—'}
      </td>
      <td style={{ padding: '9px 10px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: DOT_COLORS[graphState], flexShrink: 0, display: 'inline-block' }} />
          <span style={{ color: graphState === 'none' ? '#9CA3AF' : '#374151' }}>
            {graphState === 'ok' ? graphLabel(ds) : 'None'}
          </span>
        </span>
      </td>
      <td style={{ padding: '9px 10px' }}><Dot state={bizState} col="biz" /></td>
      <td style={{ padding: '9px 10px' }}><Dot state={docsState} col="docs" /></td>
      <td style={{ padding: '9px 10px 9px 6px' }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
          {isComplete ? (
            <>
              <button onClick={() => onNavigate(prog.name)} style={btnStyle('ok')}>Open docs</button>
              <button onClick={() => onNavigate(prog.name)} style={btnStyle('gray')}>Refresh graph</button>
            </>
          ) : hasCast ? (
            <>
              <button onClick={() => onNavigate(prog.name)} style={btnStyle('warn')}>Generate docs</button>
              <button onClick={() => onNavigate(prog.name)} style={btnStyle('gray')}>Re-run rules</button>
            </>
          ) : (
            <>
              <button onClick={() => onNavigate(prog.name)} style={btnStyle('blue')}>Build graph</button>
              <button onClick={() => onNavigate(prog.name)} style={btnStyle('gray')}>Analyse</button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function btnStyle(kind: 'ok' | 'warn' | 'blue' | 'gray') {
  const map = {
    ok:   { bg: '#F0FDF4', border: '#BBF7D0', color: '#15803D' },
    warn: { bg: '#FFFBEB', border: '#FCD34D', color: '#92400E' },
    blue: { bg: '#EBF4FF', border: '#BFDBFE', color: '#1D4ED8' },
    gray: { bg: '#F9FAFB', border: '#E5E7EB', color: '#6B7280' },
  }[kind];
  return {
    fontSize: 10, padding: '3px 9px',
    border: `1px solid ${map.border}`, borderRadius: 5,
    background: map.bg, color: map.color,
    cursor: 'pointer', whiteSpace: 'nowrap' as const,
    fontWeight: 600,
  };
}

// ── Project accordion ────────────────────────────────────────────────────────
function ProjectAccordion({
  project,
  programs,
  loading,
  open,
  onToggle,
  onDelete,
  deletingId,
  onNavigate,
}: {
  project: Project;
  programs: ProgramRow[];
  loading: boolean;
  open: boolean;
  onToggle: () => void;
  onDelete: (p: Project) => void;
  deletingId: string | null;
  onNavigate: (name: string) => void;
}) {
  const total     = programs.length;
  const withGraph = programs.filter(p => p.docStatus === 'documented' || p.docStatus === 'cast_only').length;
  const withDocs  = programs.filter(p => p.docStatus === 'documented').length;
  const isCastRepo = project.githubUrl.startsWith('cast://');
  const isUpload   = project.githubUrl.startsWith('upload://');
  const sourceTag  = isCastRepo ? 'CAST' : isUpload ? 'Upload' : `${project.owner}/${project.repo}`;

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Header row */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
          background: open ? '#EBF4FF' : '#fff',
          border: `1.5px solid ${open ? '#93C5FD' : '#E5E7EB'}`,
          borderRadius: open ? '8px 8px 0 0' : 8,
          borderBottom: open ? '1px solid #DBEAFE' : undefined,
          cursor: 'pointer',
          transition: 'background .12s, border-color .12s',
        }}
        onMouseEnter={(e) => { if (!open) (e.currentTarget as HTMLDivElement).style.background = '#F8FAFD'; }}
        onMouseLeave={(e) => { if (!open) (e.currentTarget as HTMLDivElement).style.background = '#fff'; }}
      >
        {/* Chevron */}
        <span style={{ fontSize: 12, color: '#9CA3AF', transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .15s', display: 'inline-block' }}>▼</span>

        {/* Name + source */}
        <span style={{ fontWeight: 700, fontSize: 13, color: '#1F3864', minWidth: 0 }}>{project.projectName}</span>
        <span style={{ fontSize: 11, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {sourceTag}{!isCastRepo && !isUpload ? ` · ${project.branch}` : ''}
        </span>

        {/* Summary chips */}
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          {loading
            ? <span style={{ fontSize: 10, color: '#9CA3AF' }}>Loading…</span>
            : <>
                <Chip label={`${withGraph} graphs`}  color={withGraph > 0 ? 'green' : 'gray'} />
                <Chip label={`${withDocs} docs`}     color={withDocs > 0  ? 'blue'  : 'gray'} />
                <Chip label={`${total} programs`}    color="gray" />
              </>
          }
        </div>

        {/* Delete */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(project); }}
          disabled={deletingId === project.id}
          title="Delete project"
          style={{ background: 'none', border: '1px solid #FCA5A5', borderRadius: 4, padding: '2px 7px', fontSize: 11, color: '#DC2626', cursor: 'pointer', flexShrink: 0, marginLeft: 4 }}
        >
          {deletingId === project.id ? '…' : '🗑'}
        </button>
      </div>

      {/* Body */}
      {open && (
        <div style={{ border: '1.5px solid #93C5FD', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>Loading programs…</div>
          ) : programs.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>
              No programs found. Re-scan the repository or upload source files.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '18%' }} /><col style={{ width: '7%' }} /><col style={{ width: '7%' }} />
                <col style={{ width: '13%' }} /><col style={{ width: '12%' }} /><col style={{ width: '11%' }} />
                <col style={{ width: '32%' }} />
              </colgroup>
              <thead>
                <tr style={{ background: '#F8FAFD', borderBottom: '1px solid #E5E7EB' }}>
                  {['Program','Lang','LOC','Dep graph','Biz rules','Docs','Actions'].map(h => (
                    <th key={h} style={{ padding: '6px 10px', fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: h === 'LOC' ? 'right' : 'left' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {programs.map(prog => (
                  <ProgramTableRow key={prog.name} prog={prog} onNavigate={onNavigate} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ label, color }: { label: string; color: 'green' | 'blue' | 'gray' }) {
  const map = {
    green: { bg: '#F0FDF4', border: '#BBF7D0', color: '#15803D' },
    blue:  { bg: '#EBF4FF', border: '#BFDBFE', color: '#1D4ED8' },
    gray:  { bg: '#F9FAFB', border: '#E5E7EB', color: '#9CA3AF' },
  }[color];
  return (
    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, border: `1px solid ${map.border}`, background: map.bg, color: map.color, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

// ── New project form ─────────────────────────────────────────────────────────
function NewProjectForm({
  onDone,
  onError,
}: {
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const { startScan } = useScan();
  const [tab, setTab] = useState<'github' | 'cast' | 'upload'>('github');
  const [connecting, setConnecting] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [url, setUrl] = useState('');
  const [pat, setPat] = useState('');
  const [castFile, setCastFile] = useState<File | null>(null);
  const [castName, setCastName] = useState('');
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [uploadName, setUploadName] = useState('');

  async function handleGithub(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || !projectName.trim()) return;
    setConnecting(true);
    try {
      const res = await fetch('/api/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName, githubUrl: url, pat: pat || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      if (data.repoId && data.scanJobId) startScan(data.repoId, data.scanJobId);
      onDone('Repository connected — scanning in background');
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  }

  async function handleCast() {
    if (!castFile) return;
    setConnecting(true);
    try {
      const fd = new FormData();
      fd.append('file', castFile);
      fd.append('name', castName || castFile.name.replace(/\.[^.]+$/, ''));
      const res = await fetch('/api/cast', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      onDone(`Imported ${data.imported} of ${data.total} programs`);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setConnecting(false);
    }
  }

  async function handleUpload() {
    if (!uploadFiles || uploadFiles.length === 0) return;
    setConnecting(true);
    try {
      const fd = new FormData();
      fd.append('projectName', uploadName || 'Uploaded Project');
      for (let i = 0; i < uploadFiles.length; i++) fd.append('files', uploadFiles[i]);
      const res = await fetch('/api/programs/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      onDone(`Imported ${data.imported} of ${data.total} file(s)`);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setConnecting(false);
    }
  }

  const tabStyle = (t: typeof tab) => ({
    flex: 1, padding: '7px 4px', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
    background: tab === t ? '#1F3864' : '#F9FAFB',
    color: tab === t ? '#fff' : '#6B7280',
  } as React.CSSProperties);

  return (
    <div style={{ background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 10, padding: '16px 18px', marginBottom: 16, maxWidth: 520 }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#1F3864', marginBottom: 12 }}>Add a project</div>

      <div style={{ display: 'flex', border: '1.5px solid #E5E7EB', borderRadius: 7, overflow: 'hidden', marginBottom: 12 }}>
        {(['github', 'cast', 'upload'] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)} style={tabStyle(t)}>
            {t === 'github' ? '🐙 GitHub' : t === 'cast' ? '📤 CAST' : '📁 Upload'}
          </button>
        ))}
      </div>

      {tab === 'github' && (
        <form onSubmit={handleGithub} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input placeholder="Project name *" value={projectName} onChange={e => setProjectName(e.target.value)} required style={inputStyle} />
          <input type="url" placeholder="GitHub URL *" value={url} onChange={e => setUrl(e.target.value)} required style={inputStyle} />
          <input type="password" placeholder="GitHub PAT (optional — private repos)" value={pat} onChange={e => setPat(e.target.value)} style={inputStyle} />
          <button type="submit" disabled={connecting} style={submitStyle(connecting)}>
            {connecting ? 'Scanning repo…' : 'Connect & Scan →'}
          </button>
        </form>
      )}

      {tab === 'cast' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input placeholder="Project name" value={castName} onChange={e => setCastName(e.target.value)} style={inputStyle} />
          <input type="file" accept=".xml,.json" onChange={e => setCastFile(e.target.files?.[0] ?? null)} style={inputStyle} />
          {castFile && <div style={{ fontSize: 11, color: '#059669' }}>✓ {castFile.name}</div>}
          <button disabled={!castFile || connecting} onClick={handleCast} style={submitStyle(!castFile || connecting)}>
            {connecting ? 'Uploading…' : 'Upload CAST Report →'}
          </button>
        </div>
      )}

      {tab === 'upload' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input placeholder="Project name" value={uploadName} onChange={e => setUploadName(e.target.value)} style={inputStyle} />
          <input type="file" multiple accept=".zip,.cbl,.cob,.cobol,.jcl,.cpy,.pli" onChange={e => setUploadFiles(e.target.files)} style={inputStyle} />
          {uploadFiles && uploadFiles.length > 0 && <div style={{ fontSize: 11, color: '#059669' }}>✓ {uploadFiles.length} file(s) selected</div>}
          <button disabled={!uploadFiles || uploadFiles.length === 0 || connecting} onClick={handleUpload} style={submitStyle(!uploadFiles || uploadFiles.length === 0 || connecting)}>
            {connecting ? 'Uploading…' : 'Upload & Import →'}
          </button>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  border: '1.5px solid #D1D5DB', borderRadius: 6, padding: '7px 10px', fontSize: 12, fontFamily: 'inherit', width: '100%',
};
function submitStyle(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? '#F3F4F6' : 'linear-gradient(135deg, #1F3864, #1C7293)',
    color: disabled ? '#9CA3AF' : '#fff',
    border: '1px solid #E5E7EB', borderRadius: 6, padding: '8px', fontSize: 12, fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer', width: '100%',
  };
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function ProgramsPage() {
  const router = useRouter();

  const [projects, setProjects]       = useState<Project[]>([]);
  const [openIds, setOpenIds]         = useState<Set<string>>(new Set());
  const [programsMap, setProgramsMap] = useState<Map<string, ProgramRow[]>>(new Map());
  const [loadingIds, setLoadingIds]   = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [toast, setToast]             = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);
  const [query, setQuery]             = useState('');

  useEffect(() => { fetchProjects(); }, []);

  async function fetchProjects() {
    try {
      const res  = await fetch('/api/repos');
      const data = await res.json();
      if (Array.isArray(data)) setProjects(data);
    } catch { setProjects([]); }
  }

  const loadPrograms = useCallback(async (repoId: string) => {
    if (programsMap.has(repoId)) return; // already loaded
    setLoadingIds(s => new Set(s).add(repoId));
    try {
      const res  = await fetch(`/api/programs?repoId=${repoId}`);
      const data = await res.json();
      const rows: ProgramRow[] = Array.isArray(data) ? data : [];
      const seen = new Set<string>();
      const deduped = rows.filter(p => { if (seen.has(p.name)) return false; seen.add(p.name); return true; });
      setProgramsMap(m => new Map(m).set(repoId, deduped));
    } catch {
      setProgramsMap(m => new Map(m).set(repoId, []));
    } finally {
      setLoadingIds(s => { const n = new Set(s); n.delete(repoId); return n; });
    }
  }, [programsMap]);

  function toggleProject(id: string) {
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); loadPrograms(id); }
      return next;
    });
  }

  async function handleDelete(project: Project) {
    if (!confirm(`Delete "${project.projectName}"?\n\nAll programs, graphs, and documentation will be permanently removed.`)) return;
    setDeletingId(project.id);
    try {
      const res = await fetch(`/api/repos/${project.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setOpenIds(s => { const n = new Set(s); n.delete(project.id); return n; });
      setProgramsMap(m => { const n = new Map(m); n.delete(project.id); return n; });
      showToast('Project deleted', 'ok');
      await fetchProjects();
    } catch {
      showToast('Failed to delete project', 'err');
    } finally {
      setDeletingId(null);
    }
  }

  function showToast(msg: string, kind: 'ok' | 'err') {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4000);
  }

  function navigateToProgram(name: string) {
    router.push(`/programs/${name}`);
  }

  // Filter programs by search query across all loaded projects
  function getFilteredPrograms(repoId: string): ProgramRow[] {
    const rows = programsMap.get(repoId) ?? [];
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.desc ?? '').toLowerCase().includes(q) ||
      (p.domain ?? '').toLowerCase().includes(q)
    );
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
        <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600 }}>Program Knowledge Base</span>
        <div style={{ flex: 1 }} />
        <Link href="/context" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, textDecoration: 'none', padding: '4px 10px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6 }}>🧠 Context</Link>
        <Link href="/agents" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, textDecoration: 'none', padding: '4px 10px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6 }}>🤖 Agents</Link>
        <Link href="/settings" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, textDecoration: 'none', padding: '4px 10px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6 }}>⚙ LLM</Link>
        <Link href="/admin" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, textDecoration: 'none', padding: '4px 10px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6 }}>Admin</Link>
      </header>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 72, right: 24, zIndex: 9999,
          background: toast.kind === 'ok' ? '#F0FDF4' : '#FEF2F2',
          border: `1px solid ${toast.kind === 'ok' ? '#BBF7D0' : '#FECACA'}`,
          color: toast.kind === 'ok' ? '#15803D' : '#DC2626',
          borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        }}>
          {toast.kind === 'ok' ? '✓' : '✕'} {toast.msg}
        </div>
      )}

      <main style={{ flex: 1, padding: '28px 32px', maxWidth: 1100, width: '100%', margin: '0 auto' }}>

        {/* Page title row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1F3864', margin: 0 }}>Program Knowledge Base</h1>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3 }}>
              {projects.length} project{projects.length !== 1 ? 's' : ''} — click a project to expand its programs
            </div>
          </div>
          <div style={{ flex: 1 }} />
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 7, padding: '6px 12px', width: 280 }}>
            <span style={{ color: '#9CA3AF', fontSize: 15 }}>⌕</span>
            <input
              type="text"
              placeholder="Search programs…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 12, fontFamily: 'inherit', color: '#1F2937', background: 'transparent' }}
            />
          </div>
          <button
            onClick={() => setShowNewForm(v => !v)}
            style={{
              background: showNewForm ? '#FEE2E2' : '#1F3864',
              color: showNewForm ? '#DC2626' : '#fff',
              border: 'none', borderRadius: 7, padding: '8px 14px',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {showNewForm ? '✕ Cancel' : '+ New Project'}
          </button>
        </div>

        {/* New project form */}
        {showNewForm && (
          <NewProjectForm
            onDone={(msg) => { showToast(msg, 'ok'); setShowNewForm(false); fetchProjects(); }}
            onError={(msg) => showToast(msg, 'err')}
          />
        )}

        {/* Empty state */}
        {projects.length === 0 && !showNewForm && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#9CA3AF' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📁</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#1F3864', marginBottom: 6 }}>No projects yet</div>
            <div style={{ fontSize: 13, marginBottom: 20 }}>Connect a GitHub repository, upload CAST reports, or upload COBOL files directly.</div>
            <button
              onClick={() => setShowNewForm(true)}
              style={{ background: 'linear-gradient(135deg,#1F3864,#1C7293)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              + Add your first project
            </button>
          </div>
        )}

        {/* Accordion list */}
        <div>
          {projects.map(project => (
            <ProjectAccordion
              key={project.id}
              project={project}
              programs={getFilteredPrograms(project.id)}
              loading={loadingIds.has(project.id)}
              open={openIds.has(project.id)}
              onToggle={() => toggleProject(project.id)}
              onDelete={handleDelete}
              deletingId={deletingId}
              onNavigate={navigateToProgram}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
