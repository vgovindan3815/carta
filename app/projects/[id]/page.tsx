import { FF_PROJECTS } from '@/lib/flags';
import { redirect, notFound } from 'next/navigation';
import { getProject, getSourceConnectionsForProject, listScansForProject } from '@/lib/db/queries';
import Link from 'next/link';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  if (!FF_PROJECTS) redirect('/');
  const { id } = await params;

  const [project, connections, scans] = await Promise.all([
    getProject(id),
    getSourceConnectionsForProject(id),
    listScansForProject(id),
  ]);

  if (!project) notFound();

  const latestScan = scans[0] ?? null;
  const conn = connections[0] ?? null;

  const statusColor = (s: string | null) =>
    s === 'completed' ? 'text-green-400' :
    s === 'running' ? 'text-blue-400' :
    s === 'failed' ? 'text-red-400' :
    'text-gray-500';

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-3 mb-2">
          <Link href="/projects" className="text-gray-500 hover:text-gray-300 text-sm">Projects</Link>
          <span className="text-gray-700">/</span>
          <span className="text-gray-200">{project.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            {project.description && <p className="text-gray-400 text-sm mt-1">{project.description}</p>}
            {conn && (
              <p className="text-gray-500 text-xs mt-1">
                {conn.kind === 'github'
                  ? `${conn.owner}/${conn.repo} · ${conn.branch ?? 'main'}`
                  : conn.uploadLabel}
              </p>
            )}
          </div>
          <form action={`/api/projects/${id}/scans`} method="POST">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
            >
              Run scan
            </button>
          </form>
        </div>

        {/* Status cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: 'Source',
              status: conn ? 'connected' : 'not configured',
              value: conn ? (conn.kind === 'github' ? `${conn.owner}/${conn.repo}` : conn.uploadLabel ?? '') : '',
            },
            {
              label: 'Scan',
              status: latestScan?.status ?? 'never run',
              value: latestScan?.headlineStatus ?? '',
            },
            { label: 'Documentation', status: 'not started', value: '' },
            { label: 'Validation', status: 'not started', value: '' },
          ].map(card => (
            <div key={card.label} className="border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{card.label}</p>
              <p className={`text-sm font-medium capitalize ${statusColor(card.status)}`}>{card.status}</p>
              {card.value && <p className="text-xs text-gray-600 mt-1 truncate">{card.value}</p>}
            </div>
          ))}
        </div>

        {/* Scan history */}
        {scans.length > 0 ? (
          <div>
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Scan history</h2>
            <div className="space-y-2">
              {scans.map(scan => (
                <div
                  key={scan.id}
                  className="flex items-center justify-between border border-gray-800 rounded-lg px-4 py-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      scan.status === 'completed' ? 'bg-green-500' :
                      scan.status === 'failed' ? 'bg-red-500' :
                      scan.status === 'running' ? 'bg-blue-400 animate-pulse' :
                      'bg-gray-600'
                    }`} />
                    <span className={statusColor(scan.status)}>{scan.status}</span>
                    {scan.headlineStatus && (
                      <span className="text-gray-500">{scan.headlineStatus}</span>
                    )}
                  </div>
                  <span className="text-gray-600 text-xs">
                    {new Date(scan.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="border border-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-500 text-sm">No scans yet — run a scan to analyze the source</p>
          </div>
        )}
      </div>
    </main>
  );
}
