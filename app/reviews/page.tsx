import { FF_KNOWLEDGE } from '@/lib/flags';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { graphDiscrepancies } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export default async function ReviewsPage() {
  if (!FF_KNOWLEDGE) redirect('/');

  const db = getDb();
  const discrepancies = await db.select().from(graphDiscrepancies)
    .orderBy(desc(graphDiscrepancies.createdAt))
    .limit(100);

  const statusBadge = (s: string) => {
    if (s === 'confirmed') return 'text-green-400';
    if (s === 'rejected') return 'text-red-400';
    return 'text-yellow-400';
  };

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Reviews</h1>
        <p className="text-gray-400 text-sm mb-8">
          Graph discrepancies and unresolved dynamic calls requiring human review
        </p>

        {discrepancies.length === 0 ? (
          <div className="border border-gray-800 rounded-xl p-12 text-center">
            <p className="text-gray-500">No discrepancies — all graph edges are confirmed</p>
          </div>
        ) : (
          <div className="space-y-3">
            {discrepancies.map((d) => (
              <div key={d.id} className="border border-gray-800 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{d.programId}</span>
                      <span className={`text-xs capitalize ${statusBadge(d.status)}`}>{d.status}</span>
                      <span className="text-xs text-gray-600">confidence: {d.confidence}</span>
                    </div>
                    <p className="text-gray-400 text-xs">{d.llmObservation}</p>
                    {d.staticEdge && (
                      <p className="text-gray-600 text-xs mt-1 font-mono truncate">
                        {JSON.stringify(d.staticEdge)}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-600 shrink-0">
                    {new Date(d.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
