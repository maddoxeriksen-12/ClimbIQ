import { useState, useEffect } from 'react'
import { getWarmupCards, type WarmupCard, type WarmupCardsResponse } from '../lib/recommendationService'

// SVG icons for warmup components - clean line art style matching the mockup
const WarmupIcons: Record<string, React.FC<{ className?: string }>> = {
  running: ({ className }) => (
    <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Running figure */}
      <circle cx="38" cy="12" r="6" />
      <path d="M26 26l8-6 6 8-4 14" />
      <path d="M34 20l10 4 8-6" />
      <path d="M30 42l-8 16" />
      <path d="M36 42l6 16" />
      <path d="M26 26l-12 6" />
    </svg>
  ),
  rotate: ({ className }) => (
    <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Person doing arm circles */}
      <circle cx="32" cy="14" r="6" />
      <path d="M32 20v16" />
      <path d="M32 48v8" />
      <path d="M26 56h12" />
      {/* Rotating arms */}
      <path d="M32 28c-12 0-16 8-16 8" />
      <path d="M32 28c12 0 16-8 16-8" />
      {/* Motion arcs */}
      <path d="M14 32c0-8 4-16 18-16" strokeDasharray="4 2" />
      <path d="M50 32c0 8-4 16-18 16" strokeDasharray="4 2" />
    </svg>
  ),
  hand: ({ className }) => (
    <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Open hand with fingers spread */}
      <path d="M32 56v-20" />
      <path d="M32 36c0-8 0-20 0-20" />
      <path d="M26 38v-18c0-2 0-6 0-6" />
      <path d="M38 38v-18c0-2 0-6 0-6" />
      <path d="M20 40v-12c0-2 0-4 0-4" />
      <path d="M44 40v-12c0-2 0-4 0-4" />
      {/* Palm */}
      <path d="M20 40c0 8 5 14 12 14s12-6 12-14" />
      {/* Motion lines */}
      <path d="M14 28l-4-4" strokeDasharray="2 2" />
      <path d="M50 28l4-4" strokeDasharray="2 2" />
    </svg>
  ),
  climber: ({ className }) => (
    <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Climbing wall line */}
      <path d="M48 8v48" strokeWidth="3" />
      {/* Holds */}
      <circle cx="48" cy="16" r="3" fill="currentColor" />
      <circle cx="48" cy="32" r="3" fill="currentColor" />
      <circle cx="48" cy="48" r="3" fill="currentColor" />
      {/* Climber */}
      <circle cx="30" cy="20" r="5" />
      <path d="M30 25v12" />
      <path d="M30 28l18 4" />
      <path d="M30 32l-8 8" />
      <path d="M30 37l8 12" />
      <path d="M30 37l-4 14" />
    </svg>
  ),
  stretch: ({ className }) => (
    <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Person in lunge stretch */}
      <circle cx="32" cy="14" r="6" />
      <path d="M32 20v14" />
      <path d="M32 26l14-6" />
      <path d="M32 26l-10 8" />
      {/* Legs in lunge */}
      <path d="M32 34l-16 20" />
      <path d="M32 34l12 10 8 10" />
      {/* Ground line */}
      <path d="M8 56h48" strokeDasharray="4 4" />
    </svg>
  ),
  shoulder: ({ className }) => (
    <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Person with shoulder highlight */}
      <circle cx="32" cy="14" r="6" />
      <path d="M32 20v20" />
      <path d="M32 48v8" />
      <path d="M26 56h12" />
      {/* Arms raised */}
      <path d="M32 24l-14-8" />
      <path d="M32 24l14-8" />
      {/* Shoulder circles */}
      <circle cx="24" cy="24" r="4" strokeWidth="2.5" />
      <circle cx="40" cy="24" r="4" strokeWidth="2.5" />
      {/* Motion arcs */}
      <path d="M18 16c0-4 2-8 6-8" strokeDasharray="2 2" />
      <path d="M46 16c0-4-2-8-6-8" strokeDasharray="2 2" />
    </svg>
  ),
}

interface WarmupRecommendationCardsProps {
  userState: Record<string, unknown>
  primaryGoal?: string
  sessionEnvironment?: string
  plannedDuration?: number
  onComplete: () => void
  onCardClick?: (card: WarmupCard) => void
}

export function WarmupRecommendationCards({
  userState,
  primaryGoal,
  sessionEnvironment,
  plannedDuration,
  onComplete,
  onCardClick,
}: WarmupRecommendationCardsProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [warmupData, setWarmupData] = useState<WarmupCardsResponse | null>(null)
  const [selectedCard, setSelectedCard] = useState<WarmupCard | null>(null)
  const [completedCards, setCompletedCards] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function fetchWarmupCards() {
      setLoading(true)
      setError(null)
      try {
        const data = await getWarmupCards(
          userState,
          primaryGoal,
          sessionEnvironment,
          plannedDuration
        )
        setWarmupData(data)
      } catch (err) {
        console.error('Failed to fetch warmup cards:', err)
        setError('Failed to generate personalized warmup. Using default recommendations.')
        // Set fallback data
        setWarmupData({
          cards: [
            {
              id: 'cardio',
              title: 'Cardio',
              icon: 'running',
              category: 'activation',
              duration_min: 3,
              description: 'Light cardiovascular activity to raise heart rate and body temperature.',
              priority: 'normal',
            },
            {
              id: 'joint_circles',
              title: 'Joint Circles',
              icon: 'rotate',
              category: 'activation',
              duration_min: 3,
              description: 'Controlled rotational movements to lubricate joints and increase range of motion.',
              priority: 'normal',
            },
            {
              id: 'finger_exercises',
              title: 'Finger Exercises',
              icon: 'hand',
              category: 'climbing_specific',
              duration_min: 3,
              description: 'Progressive finger and forearm activation to prepare tendons for climbing loads.',
              priority: 'normal',
            },
            {
              id: 'easy_climbing',
              title: 'Easy Climbing',
              icon: 'climber',
              category: 'climbing_specific',
              duration_min: 10,
              description: 'Climbing easy routes to build proprioceptive awareness and muscle coordination.',
              priority: 'normal',
            },
          ],
          total_duration_min: 19,
          session_goal: primaryGoal || 'general climbing',
          component_count: 4,
        })
      } finally {
        setLoading(false)
      }
    }

    fetchWarmupCards()
  }, [userState, primaryGoal, sessionEnvironment, plannedDuration])

  const handleCardClick = (card: WarmupCard) => {
    setSelectedCard(card)
    onCardClick?.(card)
  }

  const handleCardComplete = (cardId: string) => {
    setCompletedCards(prev => {
      const next = new Set(prev)
      next.add(cardId)
      return next
    })
    setSelectedCard(null)
  }

  const allCompleted = warmupData && completedCards.size >= warmupData.cards.length

  const IconComponent = (iconName: string) => {
    const Icon = WarmupIcons[iconName] || WarmupIcons.running
    return Icon
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8">
        <div className="flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mb-4" />
          <p className="text-slate-400 text-sm">Generating personalized warm-up...</p>
        </div>
      </div>
    )
  }

  if (!warmupData) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
        <p className="text-red-400 text-center">{error || 'Failed to load warmup recommendations.'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Climbing Recommendation</p>
        <h2 className="text-2xl font-bold text-white">Warm-Up</h2>
        <p className="text-xs text-slate-400 mt-1">
          {warmupData.total_duration_min} min total
        </p>
      </div>

      {/* Cards Grid */}
      <div className="space-y-3">
        {warmupData.cards.map((card) => {
          const Icon = IconComponent(card.icon)
          const isCompleted = completedCards.has(card.id)
          const isSelected = selectedCard?.id === card.id
          const isPriority = card.priority === 'high'

          return (
            <div key={card.id}>
              {/* Card Button */}
              <button
                type="button"
                onClick={() => handleCardClick(card)}
                className={`w-full rounded-2xl border transition-all duration-200 ${
                  isCompleted
                    ? 'border-emerald-500/30 bg-emerald-500/10 opacity-60'
                    : isSelected
                    ? 'border-amber-500/50 bg-amber-500/10 scale-[1.02]'
                    : isPriority
                    ? 'border-amber-500/30 bg-white/5 hover:bg-white/10 hover:border-amber-500/50'
                    : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-4 p-4">
                  {/* Icon */}
                  <div className={`w-16 h-16 flex-shrink-0 flex items-center justify-center rounded-xl ${
                    isCompleted ? 'text-emerald-400' : 'text-slate-300'
                  }`}>
                    <Icon className="w-12 h-12" />
                  </div>

                  {/* Title */}
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <h3 className={`text-lg font-semibold ${isCompleted ? 'text-emerald-300' : 'text-white'}`}>
                        {card.title}
                      </h3>
                      {isPriority && !isCompleted && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-medium">
                          Priority
                        </span>
                      )}
                      {isCompleted && (
                        <span className="text-emerald-400">✓</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{card.duration_min} min</p>
                  </div>

                  {/* Chevron */}
                  <div className={`text-slate-500 transition-transform ${isSelected ? 'rotate-180' : ''}`}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </button>

              {/* Expanded Description */}
              {isSelected && !isCompleted && (
                <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-5 animate-in slide-in-from-top-2 duration-200">
                  <h4 className="text-base font-semibold text-white mb-2">{card.title}</h4>
                  <p className="text-sm text-slate-300 leading-relaxed mb-4">
                    {card.description}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCardComplete(card.id)}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm hover:shadow-lg hover:shadow-amber-500/25 transition-all"
                  >
                    Mark Complete
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center justify-center gap-2 py-2">
        {warmupData.cards.map((card) => (
          <div
            key={card.id}
            className={`w-2 h-2 rounded-full transition-all ${
              completedCards.has(card.id)
                ? 'bg-emerald-500'
                : 'bg-white/20'
            }`}
          />
        ))}
      </div>

      {/* Complete Button */}
      <button
        type="button"
        onClick={onComplete}
        disabled={!allCompleted && completedCards.size < 2}
        className={`w-full py-4 rounded-2xl font-bold text-base transition-all ${
          allCompleted
            ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.01]'
            : completedCards.size >= 2
            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.01]'
            : 'bg-white/10 text-slate-500 cursor-not-allowed'
        }`}
      >
        {allCompleted
          ? "I'm Warmed Up - Rate Readiness"
          : completedCards.size >= 2
          ? `Skip Remaining (${warmupData.cards.length - completedCards.size} left)`
          : `Complete at least 2 exercises (${completedCards.size}/${warmupData.cards.length})`}
      </button>

      {error && (
        <p className="text-xs text-amber-400 text-center">{error}</p>
      )}
    </div>
  )
}
