'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ScanButton({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function startScan() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectId}/scans`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to start scan');
        return;
      }
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={startScan}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
      >
        {loading ? 'Starting…' : 'Run scan'}
      </button>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}
