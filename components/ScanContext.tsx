'use client';

import { createContext, useContext, useRef, useState } from 'react';

export interface ScanState {
  repoId: string;
  jobId: string;
  status: 'running' | 'completed' | 'failed';
  done: number;
  total: number;
  error?: string;
}

interface ScanContextValue {
  scan: ScanState | null;
  startScan: (repoId: string, jobId: string) => void;
  dismissScan: () => void;
}

const ScanContext = createContext<ScanContextValue>({
  scan: null,
  startScan: () => {},
  dismissScan: () => {},
});

export function useScan() {
  return useContext(ScanContext);
}

export function ScanProvider({ children }: { children: React.ReactNode }) {
  const [scan, setScan] = useState<ScanState | null>(null);
  const esRef = useRef<EventSource | null>(null);

  function startScan(repoId: string, jobId: string) {
    // Close any previous SSE connection
    esRef.current?.close();

    setScan({ repoId, jobId, status: 'running', done: 0, total: 0 });

    const es = new EventSource(`/api/repos/${repoId}/scan/${jobId}`);
    esRef.current = es;

    es.addEventListener('progress', (e) => {
      const { done, total } = JSON.parse((e as MessageEvent).data);
      setScan((s) => (s ? { ...s, done, total } : s));
    });

    es.addEventListener('done', (e) => {
      const { programCount } = JSON.parse((e as MessageEvent).data);
      setScan((s) => (s ? { ...s, status: 'completed', done: programCount ?? s.total, total: programCount ?? s.total } : s));
      es.close();
    });

    es.addEventListener('error', (e) => {
      let errMsg = 'Scan failed';
      try { errMsg = JSON.parse((e as MessageEvent).data).error ?? errMsg; } catch { /* ignore */ }
      setScan((s) => (s ? { ...s, status: 'failed', error: errMsg } : s));
      es.close();
    });

    // Handle native SSE connection errors (network drop etc.)
    es.onerror = () => {
      setScan((s) =>
        s?.status === 'running' ? { ...s, status: 'failed', error: 'Connection lost' } : s
      );
      es.close();
    };
  }

  function dismissScan() {
    esRef.current?.close();
    setScan(null);
  }

  return (
    <ScanContext.Provider value={{ scan, startScan, dismissScan }}>
      {children}
    </ScanContext.Provider>
  );
}
