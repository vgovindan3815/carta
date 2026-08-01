'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useScan } from './ScanContext';

export function ScanToast() {
  const { scan, dismissScan } = useScan();
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss after 6 s on completion
  useEffect(() => {
    if (scan?.status === 'completed') {
      dismissTimerRef.current = setTimeout(dismissScan, 6000);
    }
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [scan?.status, dismissScan]);

  if (!scan) return null;

  const pct = scan.total > 0 ? Math.round((scan.done / scan.total) * 100) : 0;
  const isRunning = scan.status === 'running';
  const isDone = scan.status === 'completed';
  const isFailed = scan.status === 'failed';

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 9999,
      width: 320,
      background: '#fff',
      border: `2px solid ${isDone ? '#16A34A' : isFailed ? '#DC2626' : '#1C7293'}`,
      borderRadius: 14,
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      overflow: 'hidden',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px 10px',
        background: isDone ? '#F0FDF4' : isFailed ? '#FEF2F2' : '#EBF4FF',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{ fontSize: 18 }}>
          {isDone ? '✅' : isFailed ? '❌' : '🔄'}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 700,
            fontSize: 13,
            color: isDone ? '#15803D' : isFailed ? '#B91C1C' : '#1C7293',
            lineHeight: 1.2,
          }}>
            {isDone
              ? `Scan complete — ${scan.done} files indexed`
              : isFailed
              ? 'Scan failed'
              : `Scanning repo… ${scan.done}${scan.total > 0 ? ` / ${scan.total}` : ''} files`}
          </div>
          {isFailed && scan.error && (
            <div style={{ fontSize: 11, color: '#DC2626', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {scan.error}
            </div>
          )}
        </div>
        <button
          onClick={dismissScan}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 16, lineHeight: 1, padding: 2, flexShrink: 0 }}
          aria-label="Dismiss"
        >✕</button>
      </div>

      {/* Progress bar (only while running) */}
      {isRunning && (
        <div style={{ padding: '8px 14px 10px' }}>
          <div style={{ background: '#E5E7EB', borderRadius: 99, height: 6, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${scan.total > 0 ? pct : 30}%`,
              background: 'linear-gradient(90deg, #1C7293, #4DAAC7)',
              borderRadius: 99,
              transition: 'width 0.4s ease',
              animation: scan.total === 0 ? 'maven-pulse 1.5s ease-in-out infinite' : undefined,
            }} />
          </div>
          {scan.total > 0 && (
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4, textAlign: 'right' }}>{pct}%</div>
          )}
        </div>
      )}

      {/* Footer actions */}
      <div style={{ padding: '0 14px 12px', display: 'flex', gap: 8 }}>
        <Link
          href="/programs"
          style={{
            flex: 1,
            textAlign: 'center',
            background: isDone ? '#16A34A' : isFailed ? '#DC2626' : '#1C7293',
            color: '#fff',
            borderRadius: 7,
            padding: '7px 0',
            fontSize: 12,
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          {isDone ? '→ View Programs' : 'View Programs'}
        </Link>
      </div>

      <style>{`
        @keyframes maven-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
