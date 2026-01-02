import { api } from './api'

export type UUID = string

export interface BetaLabEpisode {
  episode_id: UUID
  current_t: number
  transition_param_set_id: UUID
  rng_seed: number
  engine_version: string
}

export interface ScenarioState {
  scenario_state_id: UUID
  episode_id: UUID
  t_index: number
  state_time: string

  persona_id: UUID
  baseline_profile: Record<string, unknown>
  potential_caps: Record<string, unknown>

  latent_state: Record<string, unknown>
  latent_uncertainty: Record<string, unknown>

  readiness_state: Record<string, unknown>
  constraints_state: Record<string, unknown>
  phase_state: Record<string, unknown>

  sim_priors_snapshot: Record<string, unknown>
  sim_priors_version: string

  active_event: Record<string, unknown> | null
  event_cooldowns: Record<string, unknown>
  event_budget_remaining: Record<string, unknown>

  rng_seed: number
  engine_version: string
  transition_param_set_id: UUID

  prev_scenario_state_id: UUID | null
  created_at: string
}

export interface SubmitRecommendationInput {
  episode_id: UUID
  t_index: number
  scenario_state_id: UUID
  planned_workout: Record<string, unknown>
  rationale_tags?: Record<string, unknown>
  noticed_signals?: Record<string, unknown>
  avoided_risks?: Record<string, unknown>
  predicted_outcomes?: Record<string, unknown>
  confidence?: number
}

export interface ExpertRecommendation {
  expert_rec_id: UUID
  episode_id: UUID
  t_index: number
  scenario_state_id: UUID
  action_id: string
  planned_workout: Record<string, unknown>
  planned_dose_features: Record<string, unknown>
  created_at: string
}

export interface RawCaseListItem {
  expert_rec_id: UUID
  episode_id: UUID
  t_index: number
  action_id: string
  created_at: string
  coach_id: UUID
  rubric_status: 'needs_review' | 'approved' | 'rejected'
}

export interface LibraryCase {
  case_id: UUID
  action_id: string
  planned_workout: Record<string, unknown>
  planned_dose_features: Record<string, unknown>
  rationale_tags: Record<string, unknown>
  predicted_outcomes: Record<string, unknown>
  is_curated: boolean
  curated_at: string | null
  created_at: string
}

export async function startEpisode(): Promise<{ episode: BetaLabEpisode; state: ScenarioState }>
{
  const resp = await api.post('/api/v1/betalab/game/start_episode', {})
  return resp.data
}

export async function getScenarioState(episode_id: string, t: number): Promise<ScenarioState> {
  const resp = await api.get('/api/v1/betalab/game/state', {
    params: { episode_id, t },
  })
  return resp.data
}

export async function submitRecommendation(input: SubmitRecommendationInput): Promise<ExpertRecommendation> {
  const resp = await api.post('/api/v1/betalab/game/submit_recommendation', input)
  return resp.data
}

export async function advanceEpisode(episode_id: string): Promise<{ state: ScenarioState; t_index: number }> {
  const resp = await api.post('/api/v1/betalab/game/advance_episode', { episode_id })
  return resp.data
}

export async function listRawCases(params?: {
  limit?: number
  rubric_status?: 'needs_review' | 'approved' | 'rejected'
}): Promise<RawCaseListItem[]> {
  const resp = await api.get('/api/v1/betalab/library/raw_cases', { params })
  return resp.data
}

export async function promoteCaseToCurated(input: {
  expert_rec_id: string
  rubric_scores: Record<string, number>
  rubric_version?: string
  curation_notes?: string
}): Promise<{ case_id: string; is_curated: boolean }>
{
  const resp = await api.post('/api/v1/betalab/library/promote_case_to_curated', input)
  return resp.data
}

export async function searchCases(params: {
  q: string
  curated_only?: boolean
  limit?: number
}): Promise<LibraryCase[]> {
  const resp = await api.get('/api/v1/betalab/library/search_cases', { params })
  return resp.data
}
