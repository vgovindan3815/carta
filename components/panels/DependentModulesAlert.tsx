'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useApiKey } from '@/hooks/useApiKey';
import type { CalleeInfo } from '@/app/api/programs/[name]/callees/route';

interface Props {
  programName: string;
}

type RunStatus = 'queued' | 'running' | 'done' | 'error';

const EDGE_LABEL: Record<string, string> = {
  call: 'CALL',
  dyn: 'DYN CALL',
  proc: 'PROC',
};

export default function DependentModulesAlert({ programName }: Props) {
  const [callees, setCallees] = useState<CalleeInfo[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [queue, setQueue] = useState<Map<string, RunStatus>>(new Map());
  const [running, setRunning] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const { byokHeaders, byokParams } = useApiKey();

  useEffect(() => {
    fetch(`/api/programs/${encodeURIComponent(programName)}/callees`)
      .then(r => r.json())
      .then((data: CalleeInfo[]) => {
        setCallees(data);
        // Auto-expand if any unanalyzed modules exist
        if (data.some(c => !c.analyzed && c.exists)) setExpanded(true);
      })
      .catch(() => setCallees([]));
  }, [programName]);

  const unanalyzed = callees?.filter(c => !c.analyzed && c.exists) ?? [];
  const analyzed = callees?.filter(c => c.analyzed) ?? [];
  const missing = callees?.filter(c => !c.exists) ?? [];

  const toggleSelect = useCallback((name: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  const selectAllUnanalyzed = useCallback(() => {
    setSelected(new Set(unanalyzed.map(c => c.name)));
  }, [unanalyzed]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  // Process one module at a time via SSE
  const analyzeModule = useCallback((name: string): Promise<void> => {
    return new Promise((resolve) => {
      setQueue(prev => new Map(prev).set(name, 'running'));

      fetch(`/api/programs/${encodeURIComponent(name)}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...byokHeaders() },
      })
        .then(r => r.json())
        .then(({ jobId }) => {
          if (!jobId) {
            setQueue(prev => new Map(prev).set(name, 'error'));
            resolve();
            return;
          }
          if (esRef.current) esRef.current.close();
          const es = new EventSource(`/api/jobs/${jobId}${byokParams()}`);
          esRef.current = es;

          es.addEventListener('done', () => {
            es.close();
            setQueue(prev => new Map(prev).set(name, 'done'));
            resolve();
          });

          es.addEventListener('error', () => {
            es.close();
            setQueue(prev => new Map(prev).set(name, 'error'));
            resolve();
          });

          es.onerror = () => {
            es.close();
            setQueue(prev => new Map(prev).set(name, 'error'));
            resolve();
          };
        })
        .catch(() => {
          setQueue(prev => new Map(prev).set(name, 'error'));
          resolve();
        });
    });
  }, [byokHeaders, byokParams]);

  const startQueue = useCallback(async () => {
    if (selected.size === 0 || running) return;
    setRunning(true);
    setAllDone(false);

    const toRun = Array.from(selected);
    const initialQueue = new Map<string, RunStatus>(toRun.map(n => [n, 'queued']));
    setQueue(initialQueue);

    for (const name of toRun) {
      await analyzeModule(name);
    }

    setRunning(false);
    setAllDone(true);
    // Refresh callee list to show updated analysis status
    fetch(`/api/programs/${encodeURIComponent(programName)}/callees`)
      .then(r => r.json())
      .then((data: CalleeInfo[]) => setCallees(data))
      .catch(() => {});
  }, [selected, running, analyzeModule, programName]);

  // Nothing to show until loaded
  if (callees === null) return null;
  if (callees.length === 0) return null;

  const unanalyzedCount = unanalyzed.length;
  const allAnalyzed = unanalyzedCount === 0;

  return (
    <div style={{ marginTop: 20, border: `1.5px solid ${allAnalyzed ? '#D1FAE5' : '#FDE68A'}`, borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px', background: allAnalyzed ? '#F0FDF4' : '#FFFBEB',
          border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 16 }}>{allAnalyzed ? '✅' : '⚠️'}</span>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: allAnalyzed ? '#166534' : '#92400E' }}>
            Dependent module coverage
          </span>
          <span style={{ marginLeft: 10, fontSize: 12, color: '#6B7280' }}>
            {callees.filter(c => c.analyzed).length} of {callees.filter(c => c.exists).length} analyzed
            {unanalyzedCount > 0 && (
              <span style={{ marginLeft: 8, background: '#FEF3C7', color: '#92400E', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 12 }}>
                {unanalyzedCount} missing context
              </span>
            )}
            {missing.length > 0 && (
              <span style={{ marginLeft: 6, background: '#F3F4F6', color: '#6B7280', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 12 }}>
                {missing.length} not in registry
              </span>
            )}
          </span>
        </div>
        <span style={{ color: '#9CA3AF', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{ padding: '12px 16px' }}>
          {unanalyzedCount > 0 && !allDone && (
            <div style={{ fontSize: 12, color: '#92400E', background: '#FEF3C7', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>
              The LLM only received <strong>summaries for {analyzed.length} analyzed module(s)</strong> when generating business rules and change impact for <strong>{programName}</strong>.
              Analyzing the missing modules and re-running <em>Full Re-analysis</em> on <strong>{programName}</strong> will give the LLM richer context.
            </div>
          )}
          {allDone && (
            <div style={{ fontSize: 12, color: '#166534', background: '#D1FAE5', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>
              ✓ All selected modules analyzed. Run <strong>Full Re-analysis</strong> on {programName} to incorporate the new context.
            </div>
          )}

          {/* Toolbar */}
          {unanalyzedCount > 0 && !running && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={selectAllUnanalyzed}
                style={{ fontSize: 11, fontWeight: 700, background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 5, padding: '4px 10px', cursor: 'pointer' }}
              >
                Select all unanalyzed
              </button>
              {selected.size > 0 && (
                <button
                  onClick={clearSelection}
                  style={{ fontSize: 11, fontWeight: 700, background: '#fff', color: '#6B7280', border: '1px solid #E5E7EB', borderRadius: 5, padding: '4px 10px', cursor: 'pointer' }}
                >
                  Clear
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button
                onClick={startQueue}
                disabled={selected.size === 0}
                style={{
                  fontSize: 12, fontWeight: 700,
                  background: selected.size === 0 ? '#E5E7EB' : 'linear-gradient(135deg,#1F3864,#1C7293)',
                  color: selected.size === 0 ? '#9CA3AF' : '#fff',
                  border: 'none', borderRadius: 6, padding: '6px 16px', cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                ▶ Analyze selected ({selected.size})
              </button>
            </div>
          )}
          {running && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 12, color: '#1F3864' }}>
              <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
              Analyzing modules… {Array.from(queue.values()).filter(s => s === 'done').length} / {queue.size} done
            </div>
          )}

          {/* Module list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {callees.filter(c => c.exists).map(c => {
              const status = queue.get(c.name);
              const isChecked = selected.has(c.name);

              return (
                <div
                  key={c.name}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 10px', borderRadius: 6,
                    background: status === 'running' ? '#EFF6FF' : status === 'done' ? '#F0FDF4' : status === 'error' ? '#FEF2F2' : '#F9FAFB',
                    border: `1px solid ${status === 'running' ? '#BFDBFE' : status === 'done' ? '#BBF7D0' : status === 'error' ? '#FECACA' : '#E5E7EB'}`,
                  }}
                >
                  {/* Checkbox — only for unanalyzed, not-in-queue */}
                  {!c.analyzed && !status && !running && (
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelect(c.name)}
                      style={{ width: 14, height: 14, cursor: 'pointer', flexShrink: 0 }}
                    />
                  )}
                  {(c.analyzed || !!status || running) && (
                    <div style={{ width: 14, height: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                      {c.analyzed && !status ? '✓' :
                       status === 'done' ? '✓' :
                       status === 'error' ? '✕' :
                       status === 'running' ? '⟳' :
                       status === 'queued' ? '⋯' : ''}
                    </div>
                  )}

                  {/* Name + link */}
                  <a
                    href={`/programs/${encodeURIComponent(c.name)}`}
                    style={{ fontFamily: 'Consolas,monospace', fontWeight: 700, fontSize: 12, color: '#1F3864', textDecoration: 'none', flexShrink: 0 }}
                  >
                    {c.name}
                  </a>

                  {/* Edge type badge */}
                  <span style={{ fontSize: 10, fontWeight: 700, background: '#EEF2FF', color: '#4F46E5', padding: '1px 6px', borderRadius: 10, flexShrink: 0 }}>
                    {EDGE_LABEL[c.edgeType] ?? c.edgeType}
                  </span>

                  <span style={{ fontSize: 11, color: '#6B7280' }}>{c.language} · {c.loc.toLocaleString()} LOC</span>

                  <div style={{ flex: 1 }} />

                  {/* Analysis status */}
                  {!status && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                      background: c.analyzed ? '#D1FAE5' : '#FEF3C7',
                      color: c.analyzed ? '#166534' : '#92400E',
                    }}>
                      {c.analyzed ? 'analyzed' : 'not analyzed'}
                    </span>
                  )}
                  {status === 'running' && <span style={{ fontSize: 11, color: '#1D4ED8', fontWeight: 600 }}>analyzing…</span>}
                  {status === 'done' && <span style={{ fontSize: 11, color: '#166534', fontWeight: 600 }}>✓ done</span>}
                  {status === 'error' && <span style={{ fontSize: 11, color: '#991B1B', fontWeight: 600 }}>✕ failed</span>}
                  {status === 'queued' && <span style={{ fontSize: 11, color: '#6B7280' }}>queued</span>}
                </div>
              );
            })}

            {missing.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: '#9CA3AF', margin: '6px 0 2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Not in registry ({missing.length})
                </div>
                {missing.map(c => (
                  <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 6, background: '#F9FAFB', border: '1px solid #E5E7EB', opacity: 0.6 }}>
                    <span style={{ fontFamily: 'Consolas,monospace', fontSize: 12, color: '#6B7280' }}>{c.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, background: '#F3F4F6', color: '#6B7280', padding: '1px 6px', borderRadius: 10 }}>
                      {EDGE_LABEL[c.edgeType] ?? c.edgeType}
                    </span>
                    <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 'auto' }}>import to add</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
