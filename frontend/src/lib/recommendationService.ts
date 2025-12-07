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
}

export async function generateSessionRecommendation(preSessionData: Record<string, unknown>): Promise<RecommendationResponse> {
  // Clean data to remove null/undefined values which Pydantic might reject
  const cleanData = Object.fromEntries(
    Object.entries(preSessionData).filter(([_, v]) => v != null)
  )

  const response = await api.post('/api/v1/recommendations/generate', cleanData)
  return response.data
}

