import { useState, useEffect } from 'react'
import {
  generateSessionRecommendation,
  getRecommendationExplanation,
  submitExplanationFeedback,
  type Explanation,
  type RecommendationResponse
} from '../lib/recommendationService'

interface Recommendation {
  id: string
  category: 'warmup' | 'intensity' | 'focus' | 'recovery' | 'mental' | 'technique'
  title: string
  description: string
  reasoning: string
  priority: 'high' | 'medium' | 'low'
  icon: string
  type: string // warmup, session_structure, etc.
}

interface SessionInsights {
  overallReadiness: number
  readinessLabel: string
  keyFactors: { label: string; value: string; impact: 'positive' | 'neutral' | 'negative' }[]
  recommendations: Recommendation[]
  sessionPlan: {
    suggestedDuration: number
    suggestedIntensity: string
    focusAreas: string[]
    avoidAreas: string[]
  }
}

interface ExplanationState {
  loading: boolean
  explanation: Explanation | null
  error: string | null
}

interface RecommendationsScreenProps {
  preSessionData: Record<string, unknown>
  sessionType: string
  onContinue: () => void
}

export function RecommendationsScreen({ preSessionData, sessionType, onContinue }: RecommendationsScreenProps) {
  const [expandedRec, setExpandedRec] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [insights, setInsights] = useState<SessionInsights | null>(null)
  const [rawResponse, setRawResponse] = useState<RecommendationResponse | null>(null)
  const [explanations, setExplanations] = useState<Record<string, ExplanationState>>({})
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function fetchInsights() {
      setLoading(true)
      setError(null)
      try {
        // Call the real backend API
        const data = await generateSessionRecommendation({
          ...preSessionData,
          session_type_preference: sessionType // Pass the user's intent
        })

        if (data && typeof data.predicted_quality === 'number') {
          // Store raw response for explanations
          setRawResponse(data)

          // Transform API response to UI format
          const transformedInsights: SessionInsights = {
            overallReadiness: Math.round(data.predicted_quality * 10), // Scale 1-10 to 1-100
            readinessLabel: data.predicted_quality >= 8 ? 'Optimal' : data.predicted_quality >= 6 ? 'Good' : 'Low',

            keyFactors: data.key_factors.map(f => ({
              label: f.variable.replace(/_/g, ' '), // e.g. "sleep_quality" -> "sleep quality"
              value: f.direction === 'positive' ? 'Supporting' : 'Limiting',
              impact: f.direction as 'positive' | 'negative'
            })),

            recommendations: [
              // Map warnings to high-priority recommendations
              ...data.warnings.map((w, i) => ({
                id: `warn-${i}`,
                category: 'recovery' as const,
                title: '⚠️ Advisory',
                description: w.message,
                reasoning: `Triggered by rule: ${w.rule}`,
                priority: 'high' as const,
                icon: '🛡️',
                type: 'safety'
              })),
              // Map suggestions to standard recommendations
              ...data.suggestions.map((s, i) => ({
                id: `sug-${i}`,
                category: 'focus' as const,
                title: s.type.charAt(0).toUpperCase() + s.type.slice(1),
                description: s.message,
                reasoning: 'Based on your current physiological state and goals.',
                priority: 'medium' as const,
                icon: '💡',
                type: s.type
              }))
            ],

            sessionPlan: {
              // Logic to derive duration/intensity from prediction if not explicit
              suggestedDuration: data.predicted_quality > 7 ? 120 : 90, 
              suggestedIntensity: data.session_type.replace(/_/g, ' ').toUpperCase(),
              focusAreas: data.include.length > 0 ? data.include : ['General Consistency'],
              avoidAreas: data.avoid.length > 0 ? data.avoid : ['High Risk Moves']
            }
          }
          setInsights(transformedInsights)
        } else {
          setError('No recommendation data returned from the engine.')
        }
      } catch (err) {
        console.error('Error fetching recommendations', err)
        setError('Unable to reach the recommendation engine. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchInsights()
  }, [preSessionData, sessionType])

  const priorityColors = {
    high: 'border-rose-500/30 bg-rose-500/5',
    medium: 'border-amber-500/30 bg-amber-500/5',
    low: 'border-slate-500/30 bg-slate-500/5',
  }

  const impactColors = {
    positive: 'text-emerald-400',
    neutral: 'text-slate-400',
    negative: 'text-rose-400',
  }

  // Fetch detailed explanation for a recommendation
  async function fetchExplanation(rec: Recommendation) {
    if (!rawResponse) return

    setExplanations(prev => ({
      ...prev,
      [rec.id]: { loading: true, explanation: null, error: null }
    }))

    try {
      // Only pass target_element if it's different from the type
      // This allows template condition matching to select the appropriate specific template
      const derivedTarget = rec.title.toLowerCase().replace(/[^a-z]/g, '_')
      const targetElement = derivedTarget !== rec.type ? derivedTarget : undefined

      const result = await getRecommendationExplanation(
        rec.type,
        rec.description,
        preSessionData,
        rawResponse.key_factors,
        targetElement
      )

      if (result.success) {
        setExplanations(prev => ({
          ...prev,
          [rec.id]: { loading: false, explanation: result.explanation, error: null }
        }))
      } else {
        throw new Error('Failed to get explanation')
      }
    } catch {
      setExplanations(prev => ({
        ...prev,
        [rec.id]: { loading: false, explanation: null, error: 'Could not load explanation' }
      }))
    }
  }

  // Submit feedback on an explanation
  async function handleExplanationFeedback(rec: Recommendation, wasHelpful: boolean) {
    const state = explanations[rec.id]
    if (!state?.explanation) return

    try {
      await submitExplanationFeedback(
        rec.type,
        state.explanation,
        wasHelpful,
        undefined,
        undefined,
        undefined,
        state.explanation.explanation_id,
        state.explanation.cache_id
      )
      setFeedbackSubmitted(prev => ({ ...prev, [rec.id]: true }))
    } catch (err) {
      console.error('Failed to submit feedback:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fuchsia-500 mb-4"></div>
        <p className="text-slate-400">Consulting the oracle...</p>
      </div>
    )
  }

  if (!insights) {
    return (
      <div className="text-center py-20 text-slate-400">
        {error ?? 'Failed to load recommendations.'}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto pb-8">

      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/20 border border-white/10 mb-4">
          <span className="text-lg">✨</span>
          <span className="text-sm font-medium bg-gradient-to-r from-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
            AI Analysis Complete
          </span>
        </div>
        <h1 className="text-3xl font-bold mb-2">Your Session Recommendations</h1>
        <p className="text-slate-400">Personalized insights based on your current state</p>
      </div>

      {/* Readiness Score */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-fuchsia-500/10 to-cyan-500/10 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-slate-400 mb-1">Overall Readiness</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">{insights.overallReadiness}</span>
              <span className="text-slate-400">/100</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                insights.overallReadiness >= 80 ? 'bg-emerald-500/20 text-emerald-300' :
                insights.overallReadiness >= 60 ? 'bg-amber-500/20 text-amber-300' :
                'bg-rose-500/20 text-rose-300'
              }`}>
                {insights.readinessLabel}
              </span>
            </div>
          </div>
          <div className="w-20 h-20 relative">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="3"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="url(#gradient)"
                strokeWidth="3"
                strokeDasharray={`${insights.overallReadiness}, 100`}
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#d946ef" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* Key Factors */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {insights.keyFactors.map((factor, i) => (
            <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/5">
              <p className="text-xs text-slate-500 mb-1">{factor.label}</p>
              <p className={`font-semibold ${impactColors[factor.impact]}`}>{factor.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Session Plan Summary */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <span>📋</span> Session Plan
        </h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/5">
            <p className="text-xs text-slate-500 mb-1">Suggested Duration</p>
            <p className="text-xl font-bold">{insights.sessionPlan.suggestedDuration} min</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/5">
            <p className="text-xs text-slate-500 mb-1">Recommended Intensity</p>
            <p className="text-xl font-bold">{insights.sessionPlan.suggestedIntensity}</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500 mb-2">Focus Areas</p>
            <div className="flex flex-wrap gap-2">
              {insights.sessionPlan.focusAreas.map((area, i) => (
                <span key={i} className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs">
                  {area}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-2">Consider Avoiding</p>
            <div className="flex flex-wrap gap-2">
              {insights.sessionPlan.avoidAreas.map((area, i) => (
                <span key={i} className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs">
                  {area}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="space-y-4 mb-8">
        <h2 className="font-semibold flex items-center gap-2">
          <span>💡</span> Detailed Recommendations
        </h2>
        
        {insights.recommendations.map((rec) => {
          const expState = explanations[rec.id]
          const hasFeedback = feedbackSubmitted[rec.id]

          return (
            <div
              key={rec.id}
              className={`rounded-2xl border ${priorityColors[rec.priority]} p-4 transition-all`}
            >
              <div
                className="flex items-start justify-between cursor-pointer hover:opacity-80"
                onClick={() => setExpandedRec(expandedRec === rec.id ? null : rec.id)}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{rec.icon}</span>
                  <div>
                    <h3 className="font-medium">{rec.title}</h3>
                    <p className="text-sm text-slate-400 mt-1">{rec.description}</p>
                  </div>
                </div>
                <span className={`text-slate-400 transition-transform ${expandedRec === rec.id ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </div>

              {expandedRec === rec.id && (
                <div className="mt-4 pt-4 border-t border-white/10 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Why? Button */}
                  {!expState?.explanation && !expState?.loading && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        fetchExplanation(rec)
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/20 border border-white/10 hover:border-white/20 transition-all text-sm font-medium"
                    >
                      <span>🤔</span>
                      <span className="bg-gradient-to-r from-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
                        Why this recommendation?
                      </span>
                    </button>
                  )}

                  {/* Loading State */}
                  {expState?.loading && (
                    <div className="flex items-center gap-3 text-sm text-slate-400">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-fuchsia-500"></div>
                      <span>Generating explanation...</span>
                    </div>
                  )}

                  {/* Error State */}
                  {expState?.error && (
                    <p className="text-sm text-rose-400">{expState.error}</p>
                  )}

                  {/* Explanation Display */}
                  {expState?.explanation && (
                    <div className="space-y-4">
                      {/* Summary */}
                      <div className="p-4 rounded-xl bg-gradient-to-br from-fuchsia-500/10 to-cyan-500/10 border border-white/5">
                        <p className="text-sm text-slate-200 leading-relaxed">
                          {expState.explanation.summary}
                        </p>
                      </div>

                      {/* Mechanism */}
                      {expState.explanation.mechanism && (
                        <div className="flex items-start gap-2 text-sm">
                          <span className="text-cyan-400 mt-0.5">🧬</span>
                          <div>
                            <span className="text-slate-500">Mechanism: </span>
                            <span className="text-slate-300">{expState.explanation.mechanism}</span>
                          </div>
                        </div>
                      )}

                      {/* Science Note */}
                      {expState.explanation.science_note && (
                        <div className="flex items-start gap-2 text-sm">
                          <span className="text-amber-400 mt-0.5">📚</span>
                          <div>
                            <span className="text-slate-500">Research: </span>
                            <span className="text-slate-300 italic">{expState.explanation.science_note}</span>
                          </div>
                        </div>
                      )}

                      {/* Actionable Tip */}
                      {expState.explanation.actionable_tip && (
                        <div className="flex items-start gap-2 text-sm p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <span className="text-emerald-400 mt-0.5">💡</span>
                          <span className="text-emerald-200">{expState.explanation.actionable_tip}</span>
                        </div>
                      )}

                      {/* Factors */}
                      {expState.explanation.factors.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-500 uppercase tracking-wider">Contributing Factors</p>
                          <div className="flex flex-wrap gap-2">
                            {expState.explanation.factors.map((factor, i) => (
                              <span
                                key={i}
                                className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300"
                                title={factor.impact}
                              >
                                {factor.variable.replace(/_/g, ' ')}: {factor.value}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Feedback */}
                      {!hasFeedback ? (
                        <div className="flex items-center gap-4 pt-2 border-t border-white/5">
                          <span className="text-xs text-slate-500">Was this helpful?</span>
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleExplanationFeedback(rec, true)
                              }}
                              className="px-3 py-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs transition-colors"
                            >
                              👍 Yes
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleExplanationFeedback(rec, false)
                              }}
                              className="px-3 py-1 rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs transition-colors"
                            >
                              👎 No
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 pt-2 border-t border-white/5">
                          Thanks for your feedback!
                        </p>
                      )}

                      {/* Source indicator */}
                      <p className="text-xs text-slate-600">
                        {expState.explanation.source === 'template' && '📖 Based on climbing science literature'}
                        {expState.explanation.source === 'cached' && '⚡ Cached explanation'}
                        {expState.explanation.source === 'generated' && '🤖 AI-generated explanation'}
                        {expState.explanation.source === 'fallback' && '📋 Basic explanation'}
                      </p>
                    </div>
                  )}

                  {/* Fallback reasoning if no explanation requested yet */}
                  {!expState && (
                    <p className="text-sm text-slate-400 mt-3">
                      {rec.reasoning}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Continue Button */}
      <div className="sticky bottom-4">
        <button
          onClick={onContinue}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white font-semibold text-lg shadow-lg shadow-fuchsia-500/25 hover:shadow-fuchsia-500/40 hover:scale-[1.01] transition-all duration-200"
        >
          Got it! Start Climbing 🧗
        </button>
        <p className="text-center text-xs text-slate-500 mt-3">
          Your recommendations will be saved. Return here after your session to log results.
        </p>
      </div>
    </div>
  )
}

