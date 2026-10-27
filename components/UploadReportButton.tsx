'use client';

import { useState, useRef } from 'react';

interface UploadReportButtonProps {
  projectId: string;
  projectName: string;
}

export function UploadReportButton({ projectId, projectName }: UploadReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', projectName);
      fd.append('repoId', projectId);
      const res = await fetch('/api/cast', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setResult({ ok: true, msg: `Imported ${data.imported} of ${data.total} programs into this project.` });
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (err: unknown) {
      setResult({ ok: false, msg: err instanceof Error ? err.message : 'Upload failed' });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <button
        onClick={() => { setOpen(v => !v); setResult(null); }}
        style={{
          padding: '8px 16px',
          background: open ? '#1E293B' : '#0F172A',
          color: open ? '#94A3B8' : '#38BDF8',
          border: '1px solid #1E293B',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {open ? '✕ Cancel' : '📤 Upload Analysis Report'}
      </button>

      {open && (
        <div style={{
          marginTop: 12,
          padding: 16,
          background: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxWidth: 400,
        }}>
          <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>
            Upload a <code style={{ color: '#38BDF8' }}>mavenkg analyze</code> or CAST JSON/XML report.
            Programs will be added to <strong style={{ color: '#CBD5E1' }}>{projectName}</strong>.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept=".json,.xml"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            style={{
              fontSize: 13,
              color: '#94A3B8',
              background: '#1E293B',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: '6px 10px',
            }}
          />

          {file && (
            <div style={{ fontSize: 12, color: '#34D399' }}>✓ {file.name} ({(file.size / 1024).toFixed(0)} KB)</div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            style={{
              padding: '9px',
              background: !file || uploading ? '#1E293B' : 'linear-gradient(135deg,#1D4ED8,#0369A1)',
              color: !file || uploading ? '#475569' : '#fff',
              border: '1px solid #334155',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 700,
              cursor: !file || uploading ? 'not-allowed' : 'pointer',
            }}
          >
            {uploading ? 'Uploading…' : 'Import Report →'}
          </button>

          {result && (
            <div style={{
              fontSize: 13,
              padding: '8px 12px',
              borderRadius: 6,
              background: result.ok ? '#052E16' : '#450A0A',
              color: result.ok ? '#4ADE80' : '#FCA5A5',
              border: `1px solid ${result.ok ? '#166534' : '#7F1D1D'}`,
            }}>
              {result.ok ? '✓' : '✕'} {result.msg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
