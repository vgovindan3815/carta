'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useScan } from '@/components/ScanContext';
import { SkeletonTable } from '@/components/Skeleton';

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

// ── Source viewer modal ──────────────────────────────────────────────────────
function SourceModal({ name, onClose }: { name: string; onClose: () => void }) {
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/programs/${encodeURIComponent(name)}/source`);
        const data = await res.json();
        if (data.sourceText) setSource(data.sourceText);
        else setError(data.error ?? 'Source not available for this program.');
      } catch (e) {
        setError(String(e));
      } finally { setLoading(false); }
    })();
  }, [name]);

  const lines = source ? source.split('\n') : [];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(15,23,42,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0F172A', border: '1px solid #1E293B', borderRadius: 10,
          width: '90vw', maxWidth: 1100, height: '85vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid #1E293B', flexShrink: 0 }}>
          <span style={{ fontFamily: 'Consolas,monospace', fontWeight: 800, fontSize: 15, color: '#38BDF8' }}>{name}</span>
          {source && (
            <span style={{ fontSize: 12, color: '#64748B', background: '#1E293B', padding: '2px 10px', borderRadius: 20 }}>
              {lines.length.toLocaleString()} lines
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{ background: 'none', border: '1px solid #334155', borderRadius: 6, padding: '4px 12px', color: '#94A3B8', cursor: 'pointer', fontSize: 13 }}
          >
            ✕ Close
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748B', fontSize: 14 }}>Loading source…</div>
          )}
          {error && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#F87171', fontSize: 14 }}>{error}</div>
          )}
          {source && (
            <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: 'Consolas,monospace', fontSize: 13 }}>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} style={{ lineHeight: 1.5 }}>
                    <td style={{
                      padding: '0 14px 0 16px', color: '#475569', textAlign: 'right',
                      userSelect: 'none', width: 48, borderRight: '1px solid #1E293B',
                      background: '#0D1526', fontSize: 11,
                    }}>
                      {i + 1}
                    </td>
                    <td style={{ padding: '0 16px', color: '#CBD5E1', whiteSpace: 'pre', background: i % 2 === 0 ? '#0F172A' : '#0D1526' }}>
                      {line || ' '}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Status helpers ───────────────────────────────────────────────────────────
type DotState = 'ok' | 'cast' | 'warn' | 'none';

const DOT_COLOR: Record<DotState, string> = {
  ok:   '#16A34A',
  cast: '#D97706',
  warn: '#9CA3AF',
  none: '#D1D5DB',
};

function StatusDot({ state, label }: { state: DotState; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: DOT_COLOR[state], flexShrink: 0, display: 'inline-block' }} />
      <span style={{ fontSize: 13, color: state === 'none' ? '#9CA3AF' : '#374151' }}>{label}</span>
    </span>
  );
}

function getGraphState(ds: string | undefined): { state: DotState; label: string } {
  if (ds === 'documented') return { state: 'ok',   label: 'Deterministic' };
  if (ds === 'cast_only')  return { state: 'cast', label: 'CAST import' };
  return                          { state: 'none', label: 'None' };
}

function getBizState(ds: string | undefined): { state: DotState; label: string } {
  if (ds === 'documented') return { state: 'ok',   label: 'Generated' };
  if (ds === 'cast_only')  return { state: 'warn', label: 'Pending' };
  return                          { state: 'none', label: 'None' };
}

function getDocsState(ds: string | undefined): { state: DotState; label: string } {
  if (ds === 'documented') return { state: 'ok',   label: 'Complete' };
  return                          { state: 'none', label: 'None' };
}

// ── Action button ────────────────────────────────────────────────────────────
function ActionBtn({
  label, kind, onClick,
}: {
  label: string;
  kind: 'green' | 'amber' | 'blue' | 'gray';
  onClick: () => void;
}) {
  const map = {
    green: { bg: '#F0FDF4', border: '#86EFAC', color: '#15803D' },
    amber: { bg: '#FFFBEB', border: '#FCD34D', color: '#92400E' },
    blue:  { bg: '#EFF6FF', border: '#93C5FD', color: '#1D4ED8' },
    gray:  { bg: '#F9FAFB', border: '#E5E7EB', color: '#6B7280' },
  }[kind];
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        fontSize: 12, padding: '4px 12px',
        border: `1px solid ${map.border}`, borderRadius: 6,
        background: map.bg, color: map.color,
        cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600,
      }}
    >
      {label}
    </button>
  );
}

// ── Program table row ────────────────────────────────────────────────────────
function ProgramTableRow({ prog, onOpen, onViewSource, highlighted, rowRef }: {
  prog: ProgramRow;
  onOpen: () => void;
  onViewSource: () => void;
  highlighted?: boolean;
  rowRef?: React.Ref<HTMLTableRowElement>;
}) {
  const ds = prog.docStatus ?? (prog.status === 'analyzed' ? 'documented' : 'not_analyzed');
  const graph = getGraphState(ds);
  const biz   = getBizState(ds);
  const docs  = getDocsState(ds);
  const isComplete = ds === 'documented';
  const hasCast    = ds === 'cast_only';

  return (
    <tr
      ref={rowRef}
      onClick={onOpen}
      style={{ cursor: 'pointer', borderBottom: '1px solid #F3F4F6', transition: 'background .1s', background: highlighted ? '#EBF4FF' : undefined }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = highlighted ? '#DBEAFE' : '#F8FAFD'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = highlighted ? '#EBF4FF' : ''; }}
    >
      {/* Name */}
      <td style={{ padding: '11px 16px' }}>
        <div style={{ fontFamily: 'Consolas,monospace', fontWeight: 700, fontSize: 14, color: highlighted ? '#1C7293' : '#1F3864' }}>{prog.name}</div>
        {prog.domain && prog.domain !== 'Unknown' && (
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{prog.domain}</div>
        )}
      </td>
      {/* Lang */}
      <td style={{ padding: '11px 12px', fontSize: 13, color: '#6B7280', whiteSpace: 'nowrap' }}>{prog.language}</td>
      {/* LOC */}
      <td style={{ padding: '11px 12px', fontSize: 13, color: '#6B7280', textAlign: 'right', whiteSpace: 'nowrap' }}>
        {prog.loc ? prog.loc.toLocaleString() : '—'}
      </td>
      {/* Dep graph */}
      <td style={{ padding: '11px 12px' }}><StatusDot {...graph} /></td>
      {/* Biz rules */}
      <td style={{ padding: '11px 12px' }}><StatusDot {...biz} /></td>
      {/* Docs */}
      <td style={{ padding: '11px 12px' }}><StatusDot {...docs} /></td>
      {/* Actions */}
      <td style={{ padding: '11px 12px 11px 8px' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {isComplete ? (
            <>
              <ActionBtn label="Open docs" kind="green" onClick={onOpen} />
              <ActionBtn label="Refresh graph" kind="gray" onClick={onOpen} />
            </>
          ) : hasCast ? (
            <>
              <ActionBtn label="Generate docs" kind="amber" onClick={onOpen} />
              <ActionBtn label="Re-run rules" kind="gray" onClick={onOpen} />
            </>
          ) : (
            <>
              <ActionBtn label="Build graph" kind="blue" onClick={onOpen} />
              <ActionBtn label="Analyse" kind="gray" onClick={onOpen} />
            </>
          )}
          <ActionBtn label="View source" kind="gray" onClick={onViewSource} />
        </div>
      </td>
    </tr>
  );
}

// ── Program table ────────────────────────────────────────────────────────────
function ProgramTable({
  programs,
  loading,
  query,
  onNavigate,
  onViewSource,
  highlightModule,
  highlightRowRef,
}: {
  programs: ProgramRow[];
  loading: boolean;
  query: string;
  onNavigate: (name: string) => void;
  onViewSource: (name: string) => void;
  highlightModule?: string | null;
  highlightRowRef?: React.Ref<HTMLTableRowElement>;
}) {
  const filtered = query.trim()
    ? programs.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.desc ?? '').toLowerCase().includes(query.toLowerCase()) ||
        (p.domain ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : programs;

  if (loading) {
    return (
      <div style={{ padding: '16px 0' }} aria-label="Loading programs" aria-busy="true">
        <SkeletonTable rows={6} cols={5} />
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
        <div style={{ fontWeight: 700, color: '#1F3864', fontSize: 16, marginBottom: 6 }}>
          {programs.length === 0 ? 'No programs found' : 'No results match your search'}
        </div>
        <div style={{ color: '#6B7280', fontSize: 14 }}>
          {programs.length === 0
            ? 'Re-scan the repository to discover COBOL files.'
            : 'Try a different search term.'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '22%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '24%' }} />
        </colgroup>
        <thead>
          <tr style={{ background: '#F8FAFD', borderBottom: '1.5px solid #E5E7EB' }}>
            {[
              { label: 'Program', align: 'left' },
              { label: 'Lang',    align: 'left' },
              { label: 'LOC',     align: 'right' },
              { label: 'Dep graph',  align: 'left' },
              { label: 'Biz rules',  align: 'left' },
              { label: 'Docs',       align: 'left' },
              { label: 'Actions',    align: 'left' },
            ].map(col => (
              <th
                key={col.label}
                style={{
                  padding: '9px 12px', fontSize: 11, fontWeight: 700,
                  color: '#9CA3AF', textTransform: 'uppercase' as const,
                  letterSpacing: '0.6px', textAlign: col.align as 'left' | 'right',
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map(prog => (
            <ProgramTableRow
              key={prog.name}
              prog={prog}
              onOpen={() => onNavigate(prog.name)}
              onViewSource={() => onViewSource(prog.name)}
              highlighted={prog.name === highlightModule}
              rowRef={prog.name === highlightModule ? highlightRowRef : undefined}
            />
          ))}
        </tbody>
      </table>
      <div style={{ padding: '10px 16px', fontSize: 12, color: '#9CA3AF', borderTop: '1px solid #F3F4F6' }}>
        {filtered.length} program{filtered.length !== 1 ? 's' : ''}
        {query.trim() ? ` matching "${query}"` : ''}
      </div>
    </div>
  );
}

// ── New project form ─────────────────────────────────────────────────────────
function NewProjectForm({ onDone, onError }: { onDone: (msg: string) => void; onError: (msg: string) => void }) {
  const { startScan } = useScan();
  const [tab, setTab]               = useState<'github' | 'cast' | 'upload'>('github');
  const [connecting, setConnecting] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [url, setUrl]               = useState('');
  const [pat, setPat]               = useState('');
  const [castFile, setCastFile]     = useState<File | null>(null);
  const [castName, setCastName]     = useState('');
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [uploadName, setUploadName] = useState('');

  async function handleGithub(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || !projectName.trim()) return;
    setConnecting(true);
    try {
      const res  = await fetch('/api/repos', {
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
    } finally { setConnecting(false); }
  }

  async function handleCast() {
    if (!castFile) return;
    setConnecting(true);
    try {
      const fd = new FormData();
      fd.append('file', castFile);
      fd.append('name', castName || castFile.name.replace(/\.[^.]+$/, ''));
      const res  = await fetch('/api/cast', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      onDone(`Imported ${data.imported} of ${data.total} programs`);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Upload failed');
    } finally { setConnecting(false); }
  }

  async function handleUpload() {
    if (!uploadFiles || uploadFiles.length === 0) return;
    setConnecting(true);
    try {
      const fd = new FormData();
      fd.append('projectName', uploadName || 'Uploaded Project');
      for (let i = 0; i < uploadFiles.length; i++) fd.append('files', uploadFiles[i]);
      const res  = await fetch('/api/programs/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      onDone(`Imported ${data.imported} of ${data.total} file(s)`);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Upload failed');
    } finally { setConnecting(false); }
  }

  const tabSt = (t: typeof tab): React.CSSProperties => ({
    flex: 1, padding: '7px 4px', border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: 700,
    background: tab === t ? '#1F3864' : '#F9FAFB',
    color: tab === t ? '#fff' : '#6B7280',
  });

  const inp: React.CSSProperties = {
    border: '1.5px solid #D1D5DB', borderRadius: 6, padding: '8px 10px',
    fontSize: 13, fontFamily: 'inherit', width: '100%',
  };

  const sub = (dis: boolean): React.CSSProperties => ({
    background: dis ? '#F3F4F6' : 'linear-gradient(135deg,#1F3864,#1C7293)',
    color: dis ? '#9CA3AF' : '#fff', border: '1px solid #E5E7EB',
    borderRadius: 6, padding: '9px', fontSize: 13, fontWeight: 700,
    cursor: dis ? 'not-allowed' : 'pointer', width: '100%',
  });

  return (
    <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #F3F4F6' }}>
      <div style={{ display: 'flex', border: '1.5px solid #E5E7EB', borderRadius: 7, overflow: 'hidden', marginBottom: 12 }}>
        {(['github', 'cast', 'upload'] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)} style={tabSt(t)}>
            {t === 'github' ? '🐙 GitHub' : t === 'cast' ? '📤 CAST' : '📁 Upload'}
          </button>
        ))}
      </div>

      {tab === 'github' && (
        <form onSubmit={handleGithub} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input placeholder="Project name *" value={projectName} onChange={e => setProjectName(e.target.value)} required style={inp} />
          <input type="url" placeholder="GitHub URL *" value={url} onChange={e => setUrl(e.target.value)} required style={inp} />
          <input type="password" placeholder="GitHub PAT (optional)" value={pat} onChange={e => setPat(e.target.value)} style={inp} />
          <button type="submit" disabled={connecting} style={sub(connecting)}>
            {connecting ? 'Scanning repo…' : 'Connect & Scan →'}
          </button>
        </form>
      )}

      {tab === 'cast' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input placeholder="Project name" value={castName} onChange={e => setCastName(e.target.value)} style={inp} />
          <input type="file" accept=".xml,.json" onChange={e => setCastFile(e.target.files?.[0] ?? null)} style={inp} />
          {castFile && <div style={{ fontSize: 12, color: '#059669' }}>✓ {castFile.name}</div>}
          <button disabled={!castFile || connecting} onClick={handleCast} style={sub(!castFile || connecting)}>
            {connecting ? 'Uploading…' : 'Upload CAST Report →'}
          </button>
        </div>
      )}

      {tab === 'upload' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input placeholder="Project name" value={uploadName} onChange={e => setUploadName(e.target.value)} style={inp} />
          <input type="file" multiple accept=".zip,.cbl,.cob,.cobol,.jcl,.cpy,.pli" onChange={e => setUploadFiles(e.target.files)} style={inp} />
          {uploadFiles && uploadFiles.length > 0 && (
            <div style={{ fontSize: 12, color: '#059669' }}>✓ {uploadFiles.length} file(s)</div>
          )}
          <button disabled={!uploadFiles || uploadFiles.length === 0 || connecting} onClick={handleUpload} style={sub(!uploadFiles || uploadFiles.length === 0 || connecting)}>
            {connecting ? 'Uploading…' : 'Upload & Import →'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sidebar project item ─────────────────────────────────────────────────────
function SidebarProject({
  project,
  selected,
  programCount,
  graphCount,
  docCount,
  onSelect,
  onDelete,
  deleting,
}: {
  project: Project;
  selected: boolean;
  programCount: number | null;
  graphCount: number;
  docCount: number;
  onSelect: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const isCast   = project.githubUrl.startsWith('cast://');
  const isUpload = project.githubUrl.startsWith('upload://');
  const subtitle = isCast ? 'CAST import' : isUpload ? 'File upload' : `${project.owner}/${project.repo}`;
  const date     = project.lastSyncedAt
    ? `Synced ${new Date(project.lastSyncedAt).toLocaleDateString()}`
    : `Added ${new Date(project.createdAt).toLocaleDateString()}`;

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '12px 14px',
        background: selected ? '#EBF4FF' : '#fff',
        borderLeft: `3px solid ${selected ? '#1C7293' : 'transparent'}`,
        borderBottom: '1px solid #F3F4F6',
        cursor: 'pointer',
        transition: 'background .12s',
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = '#F8FAFD'; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = '#fff'; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: selected ? '#1C7293' : '#1F3864', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected ? '◆ ' : ''}{project.projectName}
          </div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>
          <div style={{ fontSize: 11, color: '#B0B7C3', marginTop: 4 }}>{date}</div>

          {/* Mini status bar */}
          {programCount !== null && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <MiniChip label={`${graphCount} graphs`} color={graphCount > 0 ? 'green' : 'gray'} />
              <MiniChip label={`${docCount} docs`}     color={docCount > 0  ? 'blue'  : 'gray'} />
              <MiniChip label={`${programCount} total`} color="gray" />
            </div>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          disabled={deleting}
          title="Delete project"
          style={{ background: 'none', border: '1px solid #FCA5A5', borderRadius: 4, padding: '3px 7px', fontSize: 12, color: '#DC2626', cursor: 'pointer', flexShrink: 0, marginTop: 2 }}
        >
          {deleting ? '…' : '🗑'}
        </button>
      </div>
    </div>
  );
}

function MiniChip({ label, color }: { label: string; color: 'green' | 'blue' | 'gray' }) {
  const map = {
    green: { bg: '#F0FDF4', border: '#BBF7D0', color: '#15803D' },
    blue:  { bg: '#EBF4FF', border: '#BFDBFE', color: '#1D4ED8' },
    gray:  { bg: '#F9FAFB', border: '#E5E7EB', color: '#9CA3AF' },
  }[color];
  return (
    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, border: `1px solid ${map.border}`, background: map.bg, color: map.color, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
const DEMO_PROGRAMS: ProgramRow[] = [
  { name: 'GTMSETL0', language: 'COBOL', loc: 847,  domain: 'Settlement / GTM', desc: 'Settlement cutoff calculation', status: 'analyzed', docStatus: 'documented',   lastAnalyzedAt: null },
  { name: 'GTMPOST1', language: 'COBOL', loc: 612,  domain: 'Settlement / GTM', desc: 'Transaction posting',           status: 'analyzed', docStatus: 'documented',   lastAnalyzedAt: null },
  { name: 'GTMVALD2', language: 'COBOL', loc: 534,  domain: 'Settlement / GTM', desc: 'Pre-cutoff validation',         status: 'pending',  docStatus: 'cast_only',    lastAnalyzedAt: null },
  { name: 'GTMDB2IO', language: 'COBOL', loc: 489,  domain: 'Settlement / GTM', desc: 'DB2 access module',             status: 'pending',  docStatus: 'not_analyzed', lastAnalyzedAt: null },
  { name: 'GTMASM01', language: 'HLASM', loc: 143,  domain: 'Utilities',        desc: 'Assembler bit-field utility',   status: 'pending',  docStatus: 'not_analyzed', lastAnalyzedAt: null },
];

function ProgramsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [projects, setProjects]         = useState<Project[]>([]);
  const [selectedProject, setSelected]  = useState<Project | null>(null);
  const [programsMap, setProgramsMap]   = useState<Map<string, ProgramRow[]>>(new Map());
  const [loadingIds, setLoadingIds]     = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [showNewForm, setShowNewForm]   = useState(false);
  const [projectsPanelCollapsed, setProjectsPanelCollapsed] = useState(false);
  const [query, setQuery]               = useState('');
  const [toast, setToast]               = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);
  const [sourceViewer, setSourceViewer] = useState<string | null>(null);
  const [isRealData, setIsRealData]     = useState(false);
  const [highlightModule, setHighlightModule] = useState<string | null>(null);
  const highlightRowRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => { fetchProjects(); }, []);

  // Restore last-viewed module when navigating back from a program detail page
  useEffect(() => {
    const moduleName = searchParams.get('module');
    if (!moduleName) return;
    setHighlightModule(moduleName);
    // Read which project owns this module from sessionStorage
    try {
      const stored = sessionStorage.getItem('maven_last_program');
      if (stored) {
        const { repoId } = JSON.parse(stored) as { name: string; repoId: string };
        if (repoId && projects.length > 0) {
          const proj = projects.find(p => p.id === repoId);
          if (proj) setSelected(proj);
        }
      }
    } catch { /* ignore */ }
  }, [searchParams, projects]);

  // Scroll to highlighted row once programs are loaded
  useEffect(() => {
    if (highlightModule && highlightRowRef.current) {
      highlightRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightModule, programsMap]);

  useEffect(() => {
    if (selectedProject) {
      loadPrograms(selectedProject.id);
    }
  }, [selectedProject]);

  async function fetchProjects() {
    try {
      const res  = await fetch('/api/repos');
      const data = await res.json();
      if (Array.isArray(data)) {
        setProjects(data);
        setIsRealData(data.length > 0);
      }
    } catch { setProjects([]); }
  }

  const loadPrograms = useCallback(async (repoId: string) => {
    if (programsMap.has(repoId)) return;
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

  async function handleDelete(project: Project) {
    if (!confirm(`Delete "${project.projectName}"?\n\nAll programs, graphs, and documentation will be permanently removed.`)) return;
    setDeletingId(project.id);
    try {
      const res = await fetch(`/api/repos/${project.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      if (selectedProject?.id === project.id) setSelected(null);
      setProgramsMap(m => { const n = new Map(m); n.delete(project.id); return n; });
      showToast('Project deleted', 'ok');
      await fetchProjects();
    } catch {
      showToast('Failed to delete project', 'err');
    } finally { setDeletingId(null); }
  }

  function showToast(msg: string, kind: 'ok' | 'err') {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4000);
  }

  const currentPrograms = selectedProject
    ? (programsMap.get(selectedProject.id) ?? [])
    : (isRealData ? [] : DEMO_PROGRAMS);

  const isLoading = selectedProject ? loadingIds.has(selectedProject.id) : false;

  function statsFor(repoId: string) {
    const rows = programsMap.get(repoId);
    if (!rows) return { programCount: null, graphCount: 0, docCount: 0 };
    return {
      programCount: rows.length,
      graphCount:   rows.filter(p => p.docStatus === 'documented' || p.docStatus === 'cast_only').length,
      docCount:     rows.filter(p => p.docStatus === 'documented').length,
    };
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#F4F7FA' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 74, right: 24, zIndex: 9999,
          background: toast.kind === 'ok' ? '#F0FDF4' : '#FEF2F2',
          border: `1px solid ${toast.kind === 'ok' ? '#BBF7D0' : '#FECACA'}`,
          color: toast.kind === 'ok' ? '#15803D' : '#DC2626',
          borderRadius: 8, padding: '11px 18px', fontSize: 14, fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        }}>
          {toast.kind === 'ok' ? '✓' : '✕'} {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── LEFT SIDEBAR ─────────────────────────────────────────────── */}
        <aside style={{
          width: projectsPanelCollapsed ? 40 : 290,
          flexShrink: 0,
          background: '#fff',
          borderRight: '1px solid #E5E7EB',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'width 0.2s ease',
          position: 'relative',
        }}>

          {projectsPanelCollapsed ? (
            /* ── Collapsed strip ── */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 12, gap: 4, flex: 1 }}>
              {/* Expand button */}
              <button
                onClick={() => setProjectsPanelCollapsed(false)}
                title="Expand projects"
                aria-label="Expand projects panel"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#6B7280', fontSize: 14, padding: '6px 0', width: '100%',
                  display: 'flex', justifyContent: 'center',
                }}
              >
                ▶
              </button>
              {/* Project folder icons */}
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setSelected(p); setProjectsPanelCollapsed(false); }}
                  title={p.projectName}
                  aria-label={`Open project: ${p.projectName}`}
                  style={{
                    background: selectedProject?.id === p.id ? '#EBF4FF' : 'none',
                    border: 'none', cursor: 'pointer',
                    color: selectedProject?.id === p.id ? '#1F3864' : '#9CA3AF',
                    fontSize: 16, padding: '6px 0', width: '100%',
                    display: 'flex', justifyContent: 'center',
                    borderRadius: 4,
                  }}
                >
                  📁
                </button>
              ))}
            </div>
          ) : (
            /* ── Expanded panel ── */
            <>
              {/* Sidebar header */}
              <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #F3F4F6' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#1F3864', letterSpacing: 0.5, textTransform: 'uppercase' }}>Projects</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => { setShowNewForm(v => !v); }}
                      style={{
                        background: showNewForm ? '#FEE2E2' : '#EBF4FF',
                        border: 'none', borderRadius: 6, padding: '5px 11px',
                        fontSize: 12, fontWeight: 700,
                        color: showNewForm ? '#DC2626' : '#1F3864', cursor: 'pointer',
                      }}
                    >
                      {showNewForm ? '✕ Cancel' : '+ New'}
                    </button>
                    <button
                      onClick={() => { setProjectsPanelCollapsed(true); setShowNewForm(false); }}
                      title="Collapse projects"
                      aria-label="Collapse projects panel"
                      style={{
                        background: 'none', border: '1px solid #E5E7EB', borderRadius: 6,
                        padding: '5px 8px', fontSize: 12, color: '#9CA3AF', cursor: 'pointer',
                      }}
                    >
                      ◀
                    </button>
                  </div>
                </div>
              </div>

              {/* New project form */}
              {showNewForm && (
                <NewProjectForm
                  onDone={(msg) => { showToast(msg, 'ok'); setShowNewForm(false); fetchProjects(); }}
                  onError={(msg) => showToast(msg, 'err')}
                />
              )}

              {/* Project list */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {projects.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9CA3AF' }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>📁</div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, color: '#6B7280' }}>No projects yet</div>
                    <div style={{ fontSize: 13, lineHeight: 1.6 }}>Connect a GitHub repo, upload CAST reports, or drop COBOL files.</div>
                  </div>
                ) : (
                  projects.map(p => {
                    const s = statsFor(p.id);
                    return (
                      <SidebarProject
                        key={p.id}
                        project={p}
                        selected={selectedProject?.id === p.id}
                        programCount={s.programCount}
                        graphCount={s.graphCount}
                        docCount={s.docCount}
                        onSelect={() => setSelected(prev => prev?.id === p.id ? null : p)}
                        onDelete={() => handleDelete(p)}
                        deleting={deletingId === p.id}
                      />
                    );
                  })
                )}
              </div>
            </>
          )}
        </aside>

        {/* ── MAIN CONTENT ─────────────────────────────────────────────── */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Main toolbar */}
          <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1F3864', margin: 0 }}>
                {selectedProject ? selectedProject.projectName : 'Program Knowledge Base'}
              </h1>
              <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 3 }}>
                {selectedProject
                  ? (() => {
                      const isCast   = selectedProject.githubUrl.startsWith('cast://');
                      const isUpload = selectedProject.githubUrl.startsWith('upload://');
                      const src = isCast ? 'CAST import' : isUpload ? 'File upload' : `${selectedProject.owner}/${selectedProject.repo} · ${selectedProject.branch}`;
                      return src;
                    })()
                  : isRealData
                  ? 'Select a project from the sidebar'
                  : 'Demo data — select a project or connect a real repo'
                }
              </div>
            </div>

            {/* Pipeline status chips (shown when project selected and programs loaded) */}
            {selectedProject && !isLoading && currentPrograms.length > 0 && (() => {
              const total  = currentPrograms.length;
              const graphs = currentPrograms.filter(p => p.docStatus === 'documented' || p.docStatus === 'cast_only').length;
              const docs   = currentPrograms.filter(p => p.docStatus === 'documented').length;
              return (
                <div style={{ display: 'flex', gap: 8 }}>
                  <MiniChip label={`${graphs} / ${total} graphs`} color={graphs === total ? 'green' : graphs > 0 ? 'blue' : 'gray'} />
                  <MiniChip label={`${docs} / ${total} docs`}     color={docs === total   ? 'green' : docs > 0   ? 'blue' : 'gray'} />
                </div>
              );
            })()}

            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: 8, padding: '7px 14px', width: 260 }}>
              <span style={{ color: '#9CA3AF', fontSize: 16 }}>⌕</span>
              <input
                type="text"
                placeholder="Search programs…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, fontFamily: 'inherit', color: '#1F2937', background: 'transparent' }}
              />
              {query && (
                <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 14, padding: 0 }}>✕</button>
              )}
            </div>
          </div>

          {/* Program table or empty state */}
          <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
            {!selectedProject && !isRealData ? (
              <>
                {/* Demo table */}
                <ProgramTable
                  programs={DEMO_PROGRAMS}
                  loading={false}
                  query={query}
                  onNavigate={name => router.push(`/programs/${name}`)}
                  onViewSource={name => setSourceViewer(name)}
                  highlightModule={highlightModule}
                  highlightRowRef={highlightRowRef}
                />
                <div style={{ padding: '12px 16px', background: '#FFFBEB', borderTop: '1px solid #FDE68A', fontSize: 13, color: '#92400E' }}>
                  Demo data — connect a project in the sidebar to analyse real COBOL programs.
                </div>
              </>
            ) : !selectedProject ? (
              <div style={{ textAlign: 'center', padding: '80px 0', color: '#9CA3AF' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>👈</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#1F3864', marginBottom: 6 }}>Select a project</div>
                <div style={{ fontSize: 14 }}>Click a project in the sidebar to view its programs.</div>
              </div>
            ) : (
              <ProgramTable
                programs={currentPrograms}
                loading={isLoading}
                query={query}
                onNavigate={name => {
                  try { sessionStorage.setItem('maven_last_program', JSON.stringify({ name, repoId: selectedProject?.id })); } catch { /* ignore */ }
                  router.push(`/programs/${name}`);
                }}
                onViewSource={name => setSourceViewer(name)}
                highlightModule={highlightModule}
                highlightRowRef={highlightRowRef}
              />
            )}
          </div>
        </main>
      </div>

      {/* Source viewer modal */}
      {sourceViewer && (
        <SourceModal name={sourceViewer} onClose={() => setSourceViewer(null)} />
      )}
    </div>
  );
}

export default function ProgramsPage() {
  return (
    <Suspense fallback={null}>
      <ProgramsPageContent />
    </Suspense>
  );
}
