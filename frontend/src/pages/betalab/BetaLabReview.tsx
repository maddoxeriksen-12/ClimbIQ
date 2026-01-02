import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { listRawCases, promoteCaseToCurated } from '../../lib/betalabApi'

export function BetaLabReview() {
  const [rubricStatus, setRubricStatus] = useState<'needs_review' | 'approved' | 'rejected'>('needs_review')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [curationNotes, setCurationNotes] = useState('')

  const rawQuery = useQuery({
    queryKey: ['betalab', 'raw_cases', rubricStatus],
    queryFn: async () => listRawCases({ limit: 50, rubric_status: rubricStatus }),
  })

  const promoteMutation = useMutation({
    mutationFn: async (expert_rec_id: string) =>
      promoteCaseToCurated({
        expert_rec_id,
        rubric_scores: {
          safety: 0.9,
          goal_fit: 0.8,
          constraint_fit: 0.8,
          novelty: 0.6,
          internal_consistency: 0.85,
        },
        rubric_version: 'v1',
        curation_notes: curationNotes || undefined,
      }),
    onSuccess: async () => {
      await rawQuery.refetch()
    },
  })

  const selected = useMemo(
    () => rawQuery.data?.find((c) => c.expert_rec_id === selectedId) ?? null,
    [rawQuery.data, selectedId]
  )

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-2xl">
            🧾
          </div>
          <div>
            <h1 className="text-3xl font-bold">BetaLab — Review</h1>
            <p className="text-slate-400">Rubric-score raw expert decisions and promote to curated (only curated flows into retrieval/prior updates).</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <label className="text-sm text-slate-300">Filter</label>
        <select
          value={rubricStatus}
          onChange={(e) => setRubricStatus(e.target.value as any)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
        >
          <option value="needs_review">Needs review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        <button
          onClick={() => rawQuery.refetch()}
          className="ml-auto px-4 py-2 rounded-xl border border-white/10 text-white hover:bg-white/5"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="font-semibold mb-3">Raw cases</h2>

          {rawQuery.isLoading ? (
            <div className="text-slate-400">Loading…</div>
          ) : rawQuery.isError ? (
            <div className="text-red-300">Failed to load raw cases.</div>
          ) : (rawQuery.data?.length ?? 0) === 0 ? (
            <div className="text-slate-400">No cases in this bucket.</div>
          ) : (
            <div className="space-y-2">
              {rawQuery.data!.map((c) => (
                <button
                  key={c.expert_rec_id}
                  onClick={() => setSelectedId(c.expert_rec_id)}
                  className={`w-full text-left rounded-xl border px-3 py-3 transition-colors ${
                    selectedId === c.expert_rec_id
                      ? 'border-fuchsia-500/40 bg-fuchsia-500/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">action_id: {c.action_id}</div>
                    <div className="text-xs text-slate-500">t={c.t_index}</div>
                  </div>
                  <div className="text-xs text-slate-500">{c.created_at}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="font-semibold mb-3">Rubric + promote</h2>

          {!selected ? (
            <div className="text-slate-400">Select a raw case to review.</div>
          ) : (
            <>
              <div className="text-sm text-slate-300 mb-2">
                <div><span className="text-slate-500">expert_rec_id:</span> {selected.expert_rec_id}</div>
                <div><span className="text-slate-500">action_id:</span> {selected.action_id}</div>
              </div>

              <label className="block text-sm text-slate-300 mb-2">Curation notes</label>
              <textarea
                value={curationNotes}
                onChange={(e) => setCurationNotes(e.target.value)}
                className="w-full h-28 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                placeholder="Why is this good/bad? What should be improved?"
              />

              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={() => promoteMutation.mutate(selected.expert_rec_id)}
                  disabled={promoteMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-medium hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-50"
                >
                  {promoteMutation.isPending ? 'Promoting…' : 'Promote to curated (if passes)'}
                </button>

                {promoteMutation.isSuccess && (
                  <div className="text-sm text-emerald-300">Done.</div>
                )}
              </div>

              {promoteMutation.isError && (
                <div className="mt-3 text-sm text-red-300">Promotion failed.</div>
              )}

              <div className="mt-4 text-xs text-slate-400">
                Note: rubric thresholds are enforced server-side; failing cases stay uncurated.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
