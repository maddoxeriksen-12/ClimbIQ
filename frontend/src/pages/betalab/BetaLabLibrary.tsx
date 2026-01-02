import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchCases } from '../../lib/betalabApi'

export function BetaLabLibrary() {
  const [q, setQ] = useState('')
  const [curatedOnly, setCuratedOnly] = useState(true)

  const query = useQuery({
    queryKey: ['betalab', 'search', q, curatedOnly],
    queryFn: async () => {
      if (!q.trim()) return []
      return searchCases({ q: q.trim(), curated_only: curatedOnly, limit: 25 })
    },
  })

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-2xl">
            📚
          </div>
          <div>
            <h1 className="text-3xl font-bold">BetaLab — Library</h1>
            <p className="text-slate-400">Search and inspect expert cases (raw/curated). Only curated should feed production retrieval/prior updates.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center mb-6">
        <div className="flex-1 w-full">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by action_id, tags, or free-text…"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={curatedOnly}
            onChange={(e) => setCuratedOnly(e.target.checked)}
          />
          Curated only
        </label>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="font-semibold mb-3">Results</h2>

        {!q.trim() ? (
          <div className="text-slate-400">Enter a query to search.</div>
        ) : query.isLoading ? (
          <div className="text-slate-400">Searching…</div>
        ) : query.isError ? (
          <div className="text-red-300">Search failed.</div>
        ) : (query.data?.length ?? 0) === 0 ? (
          <div className="text-slate-400">No matches.</div>
        ) : (
          <div className="space-y-3">
            {query.data!.map((c) => (
              <details key={c.case_id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <summary className="cursor-pointer">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">action_id: {c.action_id}</div>
                    <div className="text-xs text-slate-500">{c.is_curated ? 'curated' : 'raw'}</div>
                  </div>
                  <div className="text-xs text-slate-500">created: {c.created_at}</div>
                </summary>

                <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">planned_workout</div>
                    <pre className="text-xs text-slate-200 whitespace-pre-wrap break-words max-h-[260px] overflow-auto">
                      {JSON.stringify(c.planned_workout, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">planned_dose_features</div>
                    <pre className="text-xs text-slate-200 whitespace-pre-wrap break-words max-h-[260px] overflow-auto">
                      {JSON.stringify(c.planned_dose_features, null, 2)}
                    </pre>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
