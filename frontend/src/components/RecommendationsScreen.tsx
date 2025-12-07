import { useState, useEffect } from 'react'
import { generateSessionRecommendation } from '../lib/recommendationService'

interface Recommendation {
  id: string
  category: 'warmup' | 'intensity' | 'focus' | 'recovery' | 'mental' | 'technique'
  title: string
  description: string
  reasoning: string
  priority: 'high' | 'medium' | 'low'
  icon: string
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
                icon: '🛡️'
              })),
              // Map suggestions to standard recommendations
              ...data.suggestions.map((s, i) => ({
                id: `sug-${i}`,
                category: 'focus' as const,
                title: s.type.charAt(0).toUpperCase() + s.type.slice(1),
                description: s.message,
                reasoning: 'Based on your current physiological state and goals.',
                priority: 'medium' as const,
                icon: '💡'
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
        
        {insights.recommendations.map((rec) => (
          <div
            key={rec.id}
            className={`rounded-2xl border ${priorityColors[rec.priority]} p-4 transition-all cursor-pointer hover:border-white/20`}
            onClick={() => setExpandedRec(expandedRec === rec.id ? null : rec.id)}
          >
            <div className="flex items-start justify-between">
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
                <p className="text-sm text-slate-300 flex items-start gap-2">
                  <span className="text-fuchsia-400 mt-0.5">💭</span>
                  <span><strong className="text-white">Why:</strong> {rec.reasoning}</span>
                </p>
              </div>
            )}
          </div>
        ))}
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

