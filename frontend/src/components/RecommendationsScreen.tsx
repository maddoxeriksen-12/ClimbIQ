import { useState } from 'react'

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

// Generate mock recommendations based on pre-session data
function generateInsights(preSessionData: Record<string, unknown>, sessionType: string): SessionInsights {
  const energyLevel = (preSessionData.energy_level as number) || 5
  const motivation = (preSessionData.motivation as number) || 5
  const sleepQuality = (preSessionData.sleep_quality as number) || 5
  const hasPain = preSessionData.has_pain as boolean
  const muscleSoreness = preSessionData.muscle_soreness as string || 'none'
  const primaryGoal = preSessionData.primary_goal as string || 'volume'

  // Calculate overall readiness
  const readinessScore = Math.round((energyLevel + motivation + sleepQuality) / 3 * 10)
  
  let readinessLabel = 'Optimal'
  if (readinessScore < 50) readinessLabel = 'Low'
  else if (readinessScore < 70) readinessLabel = 'Moderate'
  else if (readinessScore < 85) readinessLabel = 'Good'

  const keyFactors: SessionInsights['keyFactors'] = [
    { 
      label: 'Energy Level', 
      value: `${energyLevel}/10`, 
      impact: energyLevel >= 7 ? 'positive' : energyLevel >= 5 ? 'neutral' : 'negative' 
    },
    { 
      label: 'Motivation', 
      value: `${motivation}/10`, 
      impact: motivation >= 7 ? 'positive' : motivation >= 5 ? 'neutral' : 'negative' 
    },
    { 
      label: 'Sleep Quality', 
      value: `${sleepQuality}/10`, 
      impact: sleepQuality >= 7 ? 'positive' : sleepQuality >= 5 ? 'neutral' : 'negative' 
    },
    { 
      label: 'Pain/Injury', 
      value: hasPain ? 'Present' : 'None', 
      impact: hasPain ? 'negative' : 'positive' 
    },
  ]

  const recommendations: Recommendation[] = []

  // Warmup recommendation based on energy and soreness
  if (energyLevel < 6 || muscleSoreness !== 'none') {
    recommendations.push({
      id: '1',
      category: 'warmup',
      title: 'Extended Warm-up Recommended',
      description: 'Take 15-20 minutes for a thorough warm-up focusing on mobility and activation.',
      reasoning: `Your ${energyLevel < 6 ? 'lower energy levels' : 'muscle soreness'} suggests your body needs more time to prepare. An extended warm-up will help prevent injury and improve performance.`,
      priority: 'high',
      icon: '🔥',
    })
  } else {
    recommendations.push({
      id: '1',
      category: 'warmup',
      title: 'Standard Warm-up',
      description: 'A 10-minute warm-up should be sufficient to get you ready.',
      reasoning: 'Your body appears well-rested and ready. A standard warm-up will prepare you without wasting energy.',
      priority: 'medium',
      icon: '🔥',
    })
  }

  // Intensity recommendation
  if (readinessScore >= 80 && primaryGoal === 'push_limits') {
    recommendations.push({
      id: '2',
      category: 'intensity',
      title: 'Go for It! High Intensity Day',
      description: 'Your body is primed for a challenging session. Try your hardest projects or attempt new grades.',
      reasoning: 'High energy, motivation, and good recovery indicate this is an optimal day for pushing your limits. Your nervous system is ready for maximum effort.',
      priority: 'high',
      icon: '🚀',
    })
  } else if (readinessScore < 60) {
    recommendations.push({
      id: '2',
      category: 'intensity',
      title: 'Keep It Light Today',
      description: 'Focus on volume at moderate grades. Save the hard sends for another day.',
      reasoning: 'Your current state suggests your body needs an easier session. Pushing too hard today could lead to injury or poor performance that affects motivation.',
      priority: 'high',
      icon: '🌊',
    })
  } else {
    recommendations.push({
      id: '2',
      category: 'intensity',
      title: 'Moderate Intensity',
      description: 'A balanced session with some challenging attempts mixed with volume work.',
      reasoning: 'Your readiness is solid but not peak. A mixed approach will give you good training stimulus without overreaching.',
      priority: 'medium',
      icon: '⚖️',
    })
  }

  // Focus recommendation based on goal
  const focusRec: Recommendation = {
    id: '3',
    category: 'focus',
    title: '',
    description: '',
    reasoning: '',
    priority: 'medium',
    icon: '🎯',
  }

  switch (primaryGoal) {
    case 'push_limits':
      focusRec.title = 'Limit Bouldering Focus'
      focusRec.description = 'Prioritize quality attempts on hard problems with full rest between burns.'
      focusRec.reasoning = 'For limit climbing, you want maximum power output. Take 3-5 minutes between hard attempts to fully recover your phosphocreatine system.'
      break
    case 'volume':
      focusRec.title = 'Volume & Mileage Focus'
      focusRec.description = 'Aim for 20-30 problems at moderate grades with shorter rest periods.'
      focusRec.reasoning = 'Volume sessions build work capacity and movement skills. Keep moving with 1-2 minute rests to maintain an elevated heart rate.'
      break
    case 'technique':
      focusRec.title = 'Technique Refinement Focus'
      focusRec.description = 'Choose problems below your limit and focus on movement quality and efficiency.'
      focusRec.reasoning = 'Skill acquisition happens best when you\'re not fighting for survival. Easy terrain lets you focus on body positioning and footwork.'
      break
    case 'active_recovery':
      focusRec.title = 'Active Recovery Focus'
      focusRec.description = 'Very easy climbing, lots of stretching, and mobility work.'
      focusRec.reasoning = 'Recovery sessions should promote blood flow without creating additional fatigue. Keep intensity very low.'
      break
    default:
      focusRec.title = 'Balanced Session Focus'
      focusRec.description = 'Mix of warm-up climbs, moderate challenges, and some harder attempts.'
      focusRec.reasoning = 'A balanced approach ensures you get training stimulus across multiple energy systems.'
  }
  recommendations.push(focusRec)

  // Pain/injury recommendation
  if (hasPain) {
    recommendations.push({
      id: '4',
      category: 'recovery',
      title: '⚠️ Injury Awareness',
      description: 'Avoid movements that aggravate your current pain. Consider modifying or skipping certain climb types.',
      reasoning: 'Climbing through pain often leads to compensation patterns and more serious injury. Listen to your body and prioritize long-term health.',
      priority: 'high',
      icon: '🩹',
    })
  }

  // Mental recommendation
  if (motivation < 5) {
    recommendations.push({
      id: '5',
      category: 'mental',
      title: 'Low Motivation Strategy',
      description: 'Start with fun, easy climbs. Set small, achievable goals. Consider climbing with friends.',
      reasoning: 'When motivation is low, forcing hard climbing often backfires. Building momentum with small wins can shift your mental state.',
      priority: 'medium',
      icon: '🧠',
    })
  }

  // Session plan
  let suggestedDuration = 90
  let suggestedIntensity = 'Moderate'
  
  if (readinessScore >= 80) {
    suggestedDuration = 120
    suggestedIntensity = 'High'
  } else if (readinessScore < 60) {
    suggestedDuration = 60
    suggestedIntensity = 'Low'
  }

  const focusAreas: string[] = []
  const avoidAreas: string[] = []

  if (primaryGoal === 'technique') focusAreas.push('Footwork', 'Body positioning')
  if (primaryGoal === 'push_limits') focusAreas.push('Power moves', 'Limit attempts')
  if (sessionType === 'bouldering') focusAreas.push('Problem solving', 'Explosive movements')
  if (sessionType === 'lead') focusAreas.push('Endurance', 'Route reading')

  if (hasPain) avoidAreas.push('Movements aggravating injury')
  if (muscleSoreness === 'significant') avoidAreas.push('High-volume sessions')
  if (energyLevel < 5) avoidAreas.push('Maximum effort attempts')

  return {
    overallReadiness: readinessScore,
    readinessLabel,
    keyFactors,
    recommendations,
    sessionPlan: {
      suggestedDuration,
      suggestedIntensity,
      focusAreas: focusAreas.length ? focusAreas : ['General climbing'],
      avoidAreas: avoidAreas.length ? avoidAreas : ['None identified'],
    },
  }
}

export function RecommendationsScreen({ preSessionData, sessionType, onContinue }: RecommendationsScreenProps) {
  const [expandedRec, setExpandedRec] = useState<string | null>(null)
  const insights = generateInsights(preSessionData, sessionType)

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

