'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    description: '',
    githubUrl: '',
    branch: 'main',
    pat: '',
    startScan: true,
  });
  const [advanced, setAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to create project');
        return;
      }
      const { project } = await res.json();
      router.push(`/projects/${project.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-lg mx-auto">
        <div className="mb-8">
          <a href="/projects" className="text-gray-500 hover:text-gray-300 text-sm">← Projects</a>
          <h1 className="text-2xl font-semibold mt-2">New project</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Project name *</label>
            <input
              type="text" required
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="My mainframe application"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">GitHub URL</label>
            <input
              type="url"
              value={form.githubUrl} onChange={e => setForm(f => ({ ...f, githubUrl: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="https://github.com/org/repo"
            />
          </div>

          <button
            type="button"
            onClick={() => setAdvanced(a => !a)}
            className="text-sm text-gray-400 hover:text-gray-300"
          >
            {advanced ? '− Hide' : '+ Show'} advanced options
          </button>

          {advanced && (
            <div className="space-y-4 border border-gray-800 rounded-lg p-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Branch</label>
                <input
                  type="text"
                  value={form.branch} onChange={e => setForm(f => ({ ...f, branch: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">GitHub PAT (private repos)</label>
                <input
                  type="password"
                  value={form.pat} onChange={e => setForm(f => ({ ...f, pat: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="ghp_..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.startScan}
              onChange={e => setForm(f => ({ ...f, startScan: e.target.checked }))}
              className="rounded"
            />
            Start scan immediately after creation
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="submit" disabled={submitting}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-medium"
            >
              {submitting ? 'Creating…' : 'Create project'}
            </button>
            <a href="/projects" className="px-6 py-2 text-gray-400 hover:text-gray-300">
              Cancel
            </a>
          </div>
        </form>
      </div>
    </main>
  );
}
