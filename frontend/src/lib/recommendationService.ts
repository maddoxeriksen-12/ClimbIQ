import { api } from './api'

export interface RecommendationResponse {
  predicted_quality: number
  base_quality: number
  session_type: string
  confidence: 'high' | 'medium' | 'low'
  key_factors: Array<{
    variable: string
    effect: number
    direction: 'positive' | 'negative'
    description: string
  }>
  warnings: Array<{
    severity: string
    message: string
    rule: string
  }>
  suggestions: Array<{
    type: string
    message: string
  }>
  messages: Array<{
    rule: string
    message: string
    reason?: string
  }>
  avoid: string[]
  include: string[]
  expert_coverage?: {
    variables_used: number
    variables_with_expert_data: number
    literature_only_variables: number
    approx_expert_scenarios: number
  }
  structured_plan?: {
    warmup: Array<{
      phase?: string
      title: string
      duration_min?: number
      intensity_score?: number
      focus?: string
      reasoning?: string // LLM-generated personalized explanation for this block
      exercises: Array<{
        name: string
        sets?: number
        reps?: string
        duration?: string
        rest?: string
        intensity?: string
        notes?: string
      }>
    }>
    main: Array<{
      phase?: string
      title: string
      duration_min?: number
      intensity_score?: number
      focus?: string
      reasoning?: string // LLM-generated personalized explanation for this block
      exercises: Array<{
        name: string
        sets?: number
        reps?: string
        duration?: string
        rest?: string
        intensity?: string
        notes?: string
      }>
    }>
    cooldown: Array<{
      phase?: string
      title: string
      duration_min?: number
      intensity_score?: number
      focus?: string
      reasoning?: string // LLM-generated personalized explanation for this block
      exercises: Array<{
        name: string
        sets?: number
        reps?: string
        duration?: string
        rest?: string
        intensity?: string
        notes?: string
      }>
    }>
    component_sources?: {
      warmup: 'expert' | 'scaffold'
      main: 'expert' | 'scaffold'
      cooldown: 'expert' | 'scaffold'
    }
  }
}

export interface ExplanationFactor {
  variable: string
  value?: number | string
  impact: string
}

export interface Explanation {
  source: 'template' | 'cached' | 'generated' | 'fallback'
  explanation_id?: string
  cache_id?: string
  summary: string
  short_summary?: string
  mechanism?: string
  factors: ExplanationFactor[]
  science_note?: string
  actionable_tip?: string
  confidence?: 'high' | 'medium' | 'low'
}

export interface ExplanationResponse {
  success: boolean
  explanation: Explanation
}

export async function generateSessionRecommendation(preSessionData: Record<string, unknown>): Promise<RecommendationResponse> {
  // Clean data to remove null/undefined values which Pydantic might reject
  const cleanData = Object.fromEntries(
    Object.entries(preSessionData).filter(([_, v]) => v != null)
  )

  const response = await api.post('/api/v1/recommendations/generate', cleanData)
  return response.data
}

export async function getRecommendationExplanation(
  recommendationType: string,
  recommendationMessage: string,
  userState: Record<string, unknown>,
  keyFactors?: Array<{ variable: string; effect?: number; description?: string }>,
  targetElement?: string
): Promise<ExplanationResponse> {
  const response = await api.post('/api/v1/recommendations/explain', {
    recommendation_type: recommendationType,
    target_element: targetElement,
    recommendation_message: recommendationMessage,
    user_state: userState,
    key_factors: keyFactors,
  })
  return response.data
}

export async function submitExplanationFeedback(
  recommendationType: string,
  explanationShown: Explanation,
  wasHelpful: boolean,
  clarityRating?: number,
  feedbackText?: string,
  sessionId?: string,
  explanationId?: string,
  cacheId?: string
): Promise<{ success: boolean; feedback_id?: string }> {
  const response = await api.post('/api/v1/recommendations/explain/feedback', {
    recommendation_type: recommendationType,
    explanation_shown: explanationShown,
    was_helpful: wasHelpful,
    clarity_rating: clarityRating,
    feedback_text: feedbackText,
    session_id: sessionId,
    explanation_id: explanationId,
    cache_id: cacheId,
  })
  return response.data
}

// =============================================================================
// Warmup Cards API
// =============================================================================

export interface WarmupCard {
  id: string
  title: string
  icon: 'running' | 'rotate' | 'hand' | 'climber' | 'stretch' | 'shoulder'
  category: 'activation' | 'climbing_specific'
  duration_min: number
  description: string
  reasoning?: string // Why this was recommended
  focus_area?: string[] // Tags like "Shoulders", "Fingers"
  priority: 'high' | 'normal' | 'optional'
}

export interface WarmupCardsResponse {
  cards: WarmupCard[]
  total_duration_min: number
  session_goal: string
  component_count: number
}

export async function getWarmupCards(
  userState: Record<string, unknown>,
  primaryGoal?: string,
  sessionEnvironment?: string,
  plannedDuration?: number
): Promise<WarmupCardsResponse> {
  const response = await api.post('/api/v1/recommendations/warmup-cards', {
    user_state: userState,
    primary_goal: primaryGoal,
    session_environment: sessionEnvironment,
    planned_duration: plannedDuration,
  })
  return response.data
}
