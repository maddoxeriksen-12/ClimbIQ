import { supabase } from './supabase'

// Types
export interface RuleReviewSession {
  id: string
  session_date: string
  session_name: string | null
  participants: string[]
  scenarios_reviewed: number
  rules_created: number
  rules_modified: number
  notes: string | null
  status: 'active' | 'completed' | 'archived'
  created_at: string
  completed_at: string | null
}

export interface SyntheticScenario {
  id: string
  baseline_snapshot: Record<string, unknown>
  pre_session_snapshot: Record<string, unknown>
  scenario_description: string | null
  edge_case_tags: string[] | null
  difficulty_level: 'common' | 'edge_case' | 'extreme' | null
  ai_recommendation: Record<string, unknown> | null
  ai_reasoning: string | null
  status: 'pending' | 'in_review' | 'consensus_reached' | 'disputed' | 'needs_discussion' | 'archived'
  assigned_reviewers: string[] | null
  consensus_recommendation: Record<string, unknown> | null
  converted_to_rule_id: string | null
  generated_at: string
  generation_batch: string | null
  reviewed_at: string | null
  review_session_id: string | null
}

export interface ExpertScenarioResponse {
  id: string
  scenario_id: string
  expert_id: string
  predicted_quality_optimal: number | null
  predicted_quality_baseline: number | null
  prediction_confidence: 'high' | 'medium' | 'low' | null
  recommended_session_type: SessionType | null
  session_type_confidence: 'high' | 'medium' | 'low' | null
  treatment_recommendations: Record<string, unknown>
  counterfactuals: CounterfactualJudgment[]
  key_drivers: KeyDriver[]
  interaction_effects: InteractionEffect[]
  session_structure: SessionStructure | null
  reasoning: string | null
  agrees_with_ai: 'yes' | 'partially' | 'no' | null
  response_duration_sec: number | null
  is_complete: boolean
  created_at: string
  updated_at: string
}

export interface ScenarioConsensus {
  id: string
  scenario_id: string
  consensus_quality_optimal: number | null
  consensus_quality_baseline: number | null
  consensus_session_type: string | null
  consensus_treatments: Record<string, unknown> | null
  coefficient_signals: Record<string, unknown> | null
  expert_agreement_score: number | null
  n_experts: number | null
  disputed_factors: string[] | null
  processed_into_priors: boolean
  processed_at: string | null
  created_at: string
}

export interface ExpertRule {
  id: string
  name: string
  description: string | null
  conditions: Record<string, unknown>
  actions: Record<string, unknown>
  condition_fields: string[] | null
  rule_category: 'safety' | 'interaction' | 'edge_case' | 'conservative' | 'performance'
  priority: number
  confidence: 'high' | 'medium' | 'low' | 'experimental' | null
  is_active: boolean
  source: 'literature' | 'coach_consensus' | 'ai_suggested' | 'safety_protocol' | 'manual'
  evidence: string | null
  contributors: string[] | null
  source_scenario_id: string | null
  review_session_id: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  expires_at: string | null
  superseded_by: string | null
}

export interface RuleAuditLog {
  id: string
  rule_id: string | null
  action: 'created' | 'modified' | 'activated' | 'deactivated' | 'superseded'
  changed_by: string
  previous_state: Record<string, unknown> | null
  new_state: Record<string, unknown> | null
  reason: string | null
  created_at: string
}

// Sub-types for responses
export type SessionType = 'project' | 'limit_bouldering' | 'volume' | 'technique' | 'training' | 'light_session' | 'rest_day' | 'active_recovery'

export interface CounterfactualJudgment {
  variable: string
  current_value: unknown
  hypothetical_value: unknown
  expected_outcome_change: string
  confidence: 'high' | 'medium' | 'low'
}

export interface KeyDriver {
  factor: string
  direction: 'positive' | 'negative' | 'neutral'
  magnitude: 'high' | 'medium' | 'low'
  reasoning: string
}

export interface InteractionEffect {
  factors: string[]
  effect_description: string
  combined_impact: string
}

export interface SessionStructure {
  warm_up_duration: number
  main_session_duration: number
  cool_down_duration: number
  intensity_distribution: Record<string, number>
  specific_recommendations: string[]
}

// Input types for creating/updating
export interface CreateReviewSessionInput {
  session_date: string
  session_name?: string
  participants: string[]
  notes?: string
}

export interface CreateScenarioInput {
  baseline_snapshot: Record<string, unknown>
  pre_session_snapshot: Record<string, unknown>
  scenario_description?: string
  edge_case_tags?: string[]
  difficulty_level?: 'common' | 'edge_case' | 'extreme'
  ai_recommendation?: Record<string, unknown>
  ai_reasoning?: string
  assigned_reviewers?: string[]
  generation_batch?: string
}

export interface CreateExpertResponseInput {
  scenario_id: string
  expert_id: string
  predicted_quality_optimal?: number
  predicted_quality_baseline?: number
  prediction_confidence?: 'high' | 'medium' | 'low'
  recommended_session_type?: SessionType
  session_type_confidence?: 'high' | 'medium' | 'low'
  treatment_recommendations?: Record<string, unknown>
  counterfactuals?: CounterfactualJudgment[]
  key_drivers?: KeyDriver[]
  interaction_effects?: InteractionEffect[]
  session_structure?: SessionStructure
  reasoning?: string
  agrees_with_ai?: 'yes' | 'partially' | 'no'
  response_duration_sec?: number
  is_complete?: boolean
}

export interface CreateRuleInput {
  name: string
  description?: string
  conditions: Record<string, unknown>
  actions: Record<string, unknown>
  condition_fields?: string[]
  rule_category: 'safety' | 'interaction' | 'edge_case' | 'conservative' | 'performance'
  priority?: number
  confidence?: 'high' | 'medium' | 'low' | 'experimental'
  source: 'literature' | 'coach_consensus' | 'ai_suggested' | 'safety_protocol' | 'manual'
  evidence?: string
  contributors?: string[]
  source_scenario_id?: string
  review_session_id?: string
  created_by?: string
  expires_at?: string
}

// ==================== Review Sessions ====================

export async function getReviewSessions(status?: string): Promise<{ data: RuleReviewSession[] | null; error: Error | null }> {
  try {
    let query = supabase
      .from('rule_review_sessions')
      .select('*')
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) throw error
    return { data: data as RuleReviewSession[], error: null }
  } catch (err) {
    console.error('Error fetching review sessions:', err)
    return { data: null, error: err as Error }
  }
}

export async function createReviewSession(input: CreateReviewSessionInput): Promise<{ data: RuleReviewSession | null; error: Error | null }> {
  try {
    const { data, error } = await (supabase as any)
      .from('rule_review_sessions')
      .insert(input)
      .select()
      .single()

    if (error) throw error
    return { data: data as RuleReviewSession, error: null }
  } catch (err) {
    console.error('Error creating review session:', err)
    return { data: null, error: err as Error }
  }
}

export async function updateReviewSession(id: string, updates: Partial<RuleReviewSession>): Promise<{ data: RuleReviewSession | null; error: Error | null }> {
  try {
    const { data, error } = await (supabase as any)
      .from('rule_review_sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data: data as RuleReviewSession, error: null }
  } catch (err) {
    console.error('Error updating review session:', err)
    return { data: null, error: err as Error }
  }
}

// ==================== Synthetic Scenarios ====================

export async function getScenarios(filters?: {
  status?: string
  difficulty_level?: string
  review_session_id?: string
  limit?: number
}): Promise<{ data: SyntheticScenario[] | null; error: Error | null }> {
  try {
    let query = supabase
      .from('synthetic_scenarios')
      .select('*')
      .order('generated_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.difficulty_level) {
      query = query.eq('difficulty_level', filters.difficulty_level)
    }
    if (filters?.review_session_id) {
      query = query.eq('review_session_id', filters.review_session_id)
    }
    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    const { data, error } = await query
    if (error) throw error
    return { data: data as SyntheticScenario[], error: null }
  } catch (err) {
    console.error('Error fetching scenarios:', err)
    return { data: null, error: err as Error }
  }
}

export async function getScenarioById(id: string): Promise<{ data: SyntheticScenario | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('synthetic_scenarios')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return { data: data as SyntheticScenario, error: null }
  } catch (err) {
    console.error('Error fetching scenario:', err)
    return { data: null, error: err as Error }
  }
}

export async function createScenario(input: CreateScenarioInput): Promise<{ data: SyntheticScenario | null; error: Error | null }> {
  try {
    const { data, error } = await (supabase as any)
      .from('synthetic_scenarios')
      .insert(input)
      .select()
      .single()

    if (error) throw error
    return { data: data as SyntheticScenario, error: null }
  } catch (err) {
    console.error('Error creating scenario:', err)
    return { data: null, error: err as Error }
  }
}

export async function updateScenario(id: string, updates: Partial<SyntheticScenario>): Promise<{ data: SyntheticScenario | null; error: Error | null }> {
  try {
    const { data, error } = await (supabase as any)
      .from('synthetic_scenarios')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data: data as SyntheticScenario, error: null }
  } catch (err) {
    console.error('Error updating scenario:', err)
    return { data: null, error: err as Error }
  }
}

// ==================== Expert Responses ====================

export async function getExpertResponses(filters?: {
  scenario_id?: string
  expert_id?: string
  is_complete?: boolean
}): Promise<{ data: ExpertScenarioResponse[] | null; error: Error | null }> {
  try {
    let query = supabase
      .from('expert_scenario_responses')
      .select('*')
      .order('created_at', { ascending: false })

    if (filters?.scenario_id) {
      query = query.eq('scenario_id', filters.scenario_id)
    }
    if (filters?.expert_id) {
      query = query.eq('expert_id', filters.expert_id)
    }
    if (filters?.is_complete !== undefined) {
      query = query.eq('is_complete', filters.is_complete)
    }

    const { data, error } = await query
    if (error) throw error
    return { data: data as ExpertScenarioResponse[], error: null }
  } catch (err) {
    console.error('Error fetching expert responses:', err)
    return { data: null, error: err as Error }
  }
}

export async function getMyResponseForScenario(scenarioId: string, expertId: string): Promise<{ data: ExpertScenarioResponse | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('expert_scenario_responses')
      .select('*')
      .eq('scenario_id', scenarioId)
      .eq('expert_id', expertId)
      .single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows returned
    return { data: data as ExpertScenarioResponse | null, error: null }
  } catch (err) {
    console.error('Error fetching expert response:', err)
    return { data: null, error: err as Error }
  }
}

export async function createExpertResponse(input: CreateExpertResponseInput): Promise<{ data: ExpertScenarioResponse | null; error: Error | null }> {
  try {
    const { data, error } = await (supabase as any)
      .from('expert_scenario_responses')
      .insert(input)
      .select()
      .single()

    if (error) throw error
    return { data: data as ExpertScenarioResponse, error: null }
  } catch (err) {
    console.error('Error creating expert response:', err)
    return { data: null, error: err as Error }
  }
}

export async function updateExpertResponse(id: string, updates: Partial<ExpertScenarioResponse>): Promise<{ data: ExpertScenarioResponse | null; error: Error | null }> {
  try {
    const { data, error } = await (supabase as any)
      .from('expert_scenario_responses')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data: data as ExpertScenarioResponse, error: null }
  } catch (err) {
    console.error('Error updating expert response:', err)
    return { data: null, error: err as Error }
  }
}

export async function upsertExpertResponse(input: CreateExpertResponseInput): Promise<{ data: ExpertScenarioResponse | null; error: Error | null }> {
  try {
    const { data, error } = await (supabase as any)
      .from('expert_scenario_responses')
      .upsert(input, { onConflict: 'scenario_id,expert_id' })
      .select()
      .single()

    if (error) throw error
    return { data: data as ExpertScenarioResponse, error: null }
  } catch (err) {
    console.error('Error upserting expert response:', err)
    return { data: null, error: err as Error }
  }
}

// ==================== Consensus ====================

export async function getConsensus(scenarioId: string): Promise<{ data: ScenarioConsensus | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('scenario_consensus')
      .select('*')
      .eq('scenario_id', scenarioId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return { data: data as ScenarioConsensus | null, error: null }
  } catch (err) {
    console.error('Error fetching consensus:', err)
    return { data: null, error: err as Error }
  }
}

export async function createConsensus(input: Partial<ScenarioConsensus>): Promise<{ data: ScenarioConsensus | null; error: Error | null }> {
  try {
    const { data, error } = await (supabase as any)
      .from('scenario_consensus')
      .insert(input)
      .select()
      .single()

    if (error) throw error
    return { data: data as ScenarioConsensus, error: null }
  } catch (err) {
    console.error('Error creating consensus:', err)
    return { data: null, error: err as Error }
  }
}

// ==================== Expert Rules ====================

export async function getRules(filters?: {
  is_active?: boolean
  rule_category?: string
  source?: string
}): Promise<{ data: ExpertRule[] | null; error: Error | null }> {
  try {
    let query = supabase
      .from('expert_rules')
      .select('*')
      .order('priority', { ascending: false })

    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active)
    }
    if (filters?.rule_category) {
      query = query.eq('rule_category', filters.rule_category)
    }
    if (filters?.source) {
      query = query.eq('source', filters.source)
    }

    const { data, error } = await query
    if (error) throw error
    return { data: data as ExpertRule[], error: null }
  } catch (err) {
    console.error('Error fetching rules:', err)
    return { data: null, error: err as Error }
  }
}

export async function createRule(input: CreateRuleInput): Promise<{ data: ExpertRule | null; error: Error | null }> {
  try {
    const { data, error } = await (supabase as any)
      .from('expert_rules')
      .insert(input)
      .select()
      .single()

    if (error) throw error

    // Create audit log entry
    await (supabase as any).from('rule_audit_log').insert({
      rule_id: data.id,
      action: 'created',
      changed_by: input.created_by || 'unknown',
      new_state: data,
    })

    return { data: data as ExpertRule, error: null }
  } catch (err) {
    console.error('Error creating rule:', err)
    return { data: null, error: err as Error }
  }
}

export async function updateRule(id: string, updates: Partial<ExpertRule>, changedBy: string, reason?: string): Promise<{ data: ExpertRule | null; error: Error | null }> {
  try {
    // Get current state for audit
    const { data: currentRule } = await (supabase as any)
      .from('expert_rules')
      .select('*')
      .eq('id', id)
      .single()

    const { data, error } = await (supabase as any)
      .from('expert_rules')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Create audit log entry
    await (supabase as any).from('rule_audit_log').insert({
      rule_id: id,
      action: 'modified',
      changed_by: changedBy,
      previous_state: currentRule,
      new_state: data,
      reason,
    })

    return { data: data as ExpertRule, error: null }
  } catch (err) {
    console.error('Error updating rule:', err)
    return { data: null, error: err as Error }
  }
}

export async function toggleRuleActive(id: string, isActive: boolean, changedBy: string, reason?: string): Promise<{ data: ExpertRule | null; error: Error | null }> {
  try {
    const { data, error } = await (supabase as any)
      .from('expert_rules')
      .update({ is_active: isActive })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Create audit log entry
    await (supabase as any).from('rule_audit_log').insert({
      rule_id: id,
      action: isActive ? 'activated' : 'deactivated',
      changed_by: changedBy,
      reason,
    })

    return { data: data as ExpertRule, error: null }
  } catch (err) {
    console.error('Error toggling rule:', err)
    return { data: null, error: err as Error }
  }
}

// ==================== Audit Log ====================

export async function getAuditLog(ruleId?: string): Promise<{ data: RuleAuditLog[] | null; error: Error | null }> {
  try {
    let query = supabase
      .from('rule_audit_log')
      .select('*')
      .order('created_at', { ascending: false })

    if (ruleId) {
      query = query.eq('rule_id', ruleId)
    }

    const { data, error } = await query
    if (error) throw error
    return { data: data as RuleAuditLog[], error: null }
  } catch (err) {
    console.error('Error fetching audit log:', err)
    return { data: null, error: err as Error }
  }
}

// ==================== Statistics ====================

export async function getExpertDataStats(): Promise<{ 
  data: {
    totalScenarios: number
    pendingScenarios: number
    reviewedScenarios: number
    totalResponses: number
    completeResponses: number
    totalRules: number
    activeRules: number
  } | null
  error: Error | null 
}> {
  try {
    const [
      { count: totalScenarios },
      { count: pendingScenarios },
      { count: reviewedScenarios },
      { count: totalResponses },
      { count: completeResponses },
      { count: totalRules },
      { count: activeRules },
    ] = await Promise.all([
      supabase.from('synthetic_scenarios').select('*', { count: 'exact', head: true }),
      supabase.from('synthetic_scenarios').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('synthetic_scenarios').select('*', { count: 'exact', head: true }).eq('status', 'consensus_reached'),
      supabase.from('expert_scenario_responses').select('*', { count: 'exact', head: true }),
      supabase.from('expert_scenario_responses').select('*', { count: 'exact', head: true }).eq('is_complete', true),
      supabase.from('expert_rules').select('*', { count: 'exact', head: true }),
      supabase.from('expert_rules').select('*', { count: 'exact', head: true }).eq('is_active', true),
    ])

    return {
      data: {
        totalScenarios: totalScenarios || 0,
        pendingScenarios: pendingScenarios || 0,
        reviewedScenarios: reviewedScenarios || 0,
        totalResponses: totalResponses || 0,
        completeResponses: completeResponses || 0,
        totalRules: totalRules || 0,
        activeRules: activeRules || 0,
      },
      error: null,
    }
  } catch (err) {
    console.error('Error fetching stats:', err)
    return { data: null, error: err as Error }
  }
}

// ==================== AI Scenario Generation ====================

export interface AIGenerationResult {
  success: boolean
  scenarios_generated: number
  generation_batch: string
  model: string
  scenario_ids: string[]
}

export async function generateScenariosWithAI(options: {
  count?: number
  edge_case_focus?: string[]
  difficulty_bias?: 'common' | 'edge_case' | 'extreme'
}): Promise<{ data: AIGenerationResult | null; error: Error | null }> {
  try {
    const API_URL = import.meta.env.VITE_API_URL as string
    
    const params = new URLSearchParams()
    if (options.count) params.append('count', options.count.toString())
    if (options.difficulty_bias) params.append('difficulty_bias', options.difficulty_bias)
    if (options.edge_case_focus) {
      options.edge_case_focus.forEach(tag => params.append('edge_case_focus', tag))
    }
    
    const response = await fetch(`${API_URL}/api/v1/expert-capture/scenarios/generate/ai?${params}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `API error: ${response.status}`)
    }
    
    const data = await response.json()
    return { data, error: null }
  } catch (err) {
    console.error('Error generating scenarios with AI:', err)
    return { data: null, error: err as Error }
  }
}

