import { FF_DOCS_V2 } from '@/lib/flags';
import { redirect } from 'next/navigation';

export default function DocsPage() {
  if (!FF_DOCS_V2) redirect('/');

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Documentation</h1>
        <p className="text-gray-400 text-sm mb-8">
          AI-generated documentation workspace — business rules, module specs, impact reports
        </p>
        <div className="border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-500">Documentation workspace coming soon</p>
          <p className="text-gray-600 text-sm mt-2">
            Enable FF_DOCS_V2 and run a documentation job to see content here
          </p>
        </div>
      </div>
    </main>
  );
}
