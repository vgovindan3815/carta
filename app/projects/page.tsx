export const dynamic = 'force-dynamic';

import { FF_PROJECTS } from '@/lib/flags';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { listProjects } from '@/lib/db/queries';

export default async function ProjectsPage() {
  if (!FF_PROJECTS) redirect('/');

  const projects = await listProjects();

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold">Projects</h1>
            <p className="text-gray-400 text-sm mt-1">Modernization projects and their analysis status</p>
          </div>
          <Link
            href="/projects/new"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
          >
            New project
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="border border-gray-800 rounded-xl p-12 text-center">
            <p className="text-gray-500 mb-4">No projects yet</p>
            <Link href="/projects/new" className="text-blue-400 hover:text-blue-300 text-sm">
              Create your first project →
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {projects.map(project => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block border border-gray-800 hover:border-gray-700 rounded-xl p-5 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-medium text-white">{project.name}</h2>
                    {project.description && (
                      <p className="text-gray-400 text-sm mt-1">{project.description}</p>
                    )}
                  </div>
                  <span className="text-gray-500 text-xs mt-1">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
