import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  advanceEpisode,
  getScenarioState,
  startEpisode,
  submitRecommendation,
  type ScenarioState,
  type SubmitRecommendationInput,
} from '../../lib/betalabApi'

const DEFAULT_PLANNED_WORKOUT = {
  version: '1.0',
  session_type: 'limit_bouldering',
  time_cap_min: 90,
  focus_tags: ['power', 'limit'],
  constraints_applied: {
    injury_mods: [],
    equipment_required: [],
    intensity_ceiling: 1.0,
  },
  blocks: [
    {
      name: 'Warmup',
      block_type: 'warmup',
      prescription: {
        items: [
          {
            activity_type: 'mobility',
            name: 'General mobility flow',
            dose: { minutes: 10 },
            intensity: { rpe_target: 2, intensity_0_1: 0.2 },
          },
        ],
      },
    },
    {
      name: 'Main',
      block_type: 'main',
      goal: 'High-quality limit attempts',
      prescription: {
        items: [
          {
            activity_type: 'climbing',
            name: 'Limit attempts',
            dose: { attempts: 12, rest_seconds: 240 },
            intensity: { rpe_target: 9, intensity_0_1: 0.95, grade_band: 'Vmax-1', percent_max: 1.0 },
            technique_tags: ['tension', 'power'],
          },
        ],
      },
    },
    {
      name: 'Cooldown',
      block_type: 'cooldown',
      prescription: {
        items: [
          {
            activity_type: 'mobility',
            name: 'Cooldown stretch',
            dose: { minutes: 10 },
            intensity: { rpe_target: 1, intensity_0_1: 0.1 },
          },
        ],
      },
    },
  ],
  dose_targets: {
    expected_rpe_distribution: { bins: [0, 6, 8, 10], probabilities: [0.2, 0.3, 0.5] },
    hi_attempts_target: 10,
    tut_minutes_target: 25,
    volume_score_target: 1,
    fatigue_cost_target: 1,
  },
}

export function BetaLabGame() {
  const [episodeId, setEpisodeId] = useState<string | null>(null)
  const [tIndex, setTIndex] = useState<number>(1)
  const [state, setState] = useState<ScenarioState | null>(null)
  const [planJson, setPlanJson] = useState(() => JSON.stringify(DEFAULT_PLANNED_WORKOUT, null, 2))
  const [lastResult, setLastResult] = useState<unknown>(null)

  const startMutation = useMutation({
    mutationFn: async () => startEpisode(),
    onSuccess: (data) => {
      setEpisodeId(data.episode.episode_id)
      setTIndex(data.state.t_index)
      setState(data.state)
      setLastResult(data)
    },
  })

  const refreshStateMutation = useMutation({
    mutationFn: async () => {
      if (!episodeId) throw new Error('No episode started')
      return getScenarioState(episodeId, tIndex)
    },
    onSuccess: (data) => {
      setState(data)
      setLastResult(data)
    },
  })

  const submitMutation = useMutation({
    mutationFn: async (input: SubmitRecommendationInput) => submitRecommendation(input),
    onSuccess: (data) => {
      setLastResult(data)
    },
  })

  const advanceMutation = useMutation({
    mutationFn: async () => {
      if (!episodeId) throw new Error('No episode started')
      return advanceEpisode(episodeId)
    },
    onSuccess: (data) => {
      setTIndex(data.t_index)
      setState(data.state)
      setLastResult(data)
    },
  })

  const canSubmit = useMemo(() => !!episodeId && !!state, [episodeId, state])

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-fuchsia-500 flex items-center justify-center text-2xl">
            🧪
          </div>
          <div>
            <h1 className="text-3xl font-bold">BetaLab — Expert Game</h1>
            <p className="text-slate-400">Run deterministic sim episodes, submit canonical plans, and capture expert decisions with stable action IDs.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-fuchsia-600 text-white font-medium hover:from-cyan-500 hover:to-fuchsia-500 disabled:opacity-50"
        >
          {startMutation.isPending ? 'Starting…' : 'Start new episode'}
        </button>

        <button
          onClick={() => refreshStateMutation.mutate()}
          disabled={!episodeId || refreshStateMutation.isPending}
          className="px-4 py-2 rounded-xl border border-white/10 text-white hover:bg-white/5 disabled:opacity-50"
        >
          {refreshStateMutation.isPending ? 'Refreshing…' : 'Refresh state'}
        </button>

        <button
          onClick={() => advanceMutation.mutate()}
          disabled={!episodeId || advanceMutation.isPending}
          className="px-4 py-2 rounded-xl border border-white/10 text-white hover:bg-white/5 disabled:opacity-50"
        >
          {advanceMutation.isPending ? 'Advancing…' : 'Advance (t+1)'}
        </button>

        <div className="ml-auto text-sm text-slate-400">
          <div><span className="text-slate-500">episode:</span> {episodeId ?? '—'}</div>
          <div><span className="text-slate-500">t:</span> {tIndex}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Scenario state</h2>
            <span className="text-xs text-slate-500">authoritative world state</span>
          </div>
          <pre className="text-xs text-slate-200 whitespace-pre-wrap break-words max-h-[480px] overflow-auto">
            {state ? JSON.stringify(state, null, 2) : 'No episode started yet.'}
          </pre>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Submit planned_workout</h2>
            <span className="text-xs text-slate-500">validated + hashed to action_id</span>
          </div>

          <textarea
            value={planJson}
            onChange={(e) => setPlanJson(e.target.value)}
            className="w-full h-[340px] rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
          />

          <div className="flex flex-wrap items-center gap-3 mt-3">
            <button
              onClick={() => {
                if (!episodeId || !state) return
                const planned_workout = JSON.parse(planJson) as Record<string, unknown>
                submitMutation.mutate({
                  episode_id: episodeId,
                  t_index: state.t_index,
                  scenario_state_id: state.scenario_state_id,
                  planned_workout,
                  rationale_tags: { goal_alignment: ['demo'], constraints: [], bottleneck: [], tradeoffs: [] },
                  noticed_signals: {},
                  avoided_risks: {},
                  predicted_outcomes: { p_session_good: 0.6, p_fatigue_spike: 0.2 },
                  confidence: 0.7,
                })
              }}
              disabled={!canSubmit || submitMutation.isPending}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white font-medium hover:from-fuchsia-500 hover:to-cyan-500 disabled:opacity-50"
            >
              {submitMutation.isPending ? 'Submitting…' : 'Submit recommendation'}
            </button>

            <div className="text-xs text-slate-400">
              This will write a raw expert decision + materialized dose features.
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-semibold mb-2">Last response</h3>
            <pre className="text-xs text-slate-200 whitespace-pre-wrap break-words max-h-[220px] overflow-auto">
              {lastResult ? JSON.stringify(lastResult, null, 2) : '—'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
