import { useState } from 'react'
import { useSessionStore } from '../stores/sessionStore'

interface PreSessionData {
  // A. Context & Environment
  session_environment: string
  planned_duration: number
  partner_status: string
  crowdedness: number
}

interface PreSessionFormProps {
  onComplete?: (info: { 
    sessionType: string
    location: string
    isOutdoor?: boolean
    plannedDuration?: number
    preSessionData?: Record<string, unknown>
  }) => void
}

export function PreSessionForm({ onComplete }: PreSessionFormProps) {
  const { createSession } = useSessionStore()

  const [formData, setFormData] = useState<PreSessionData>({
    session_environment: '',
    planned_duration: 90,
    partner_status: '',
    crowdedness: 3,
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  const sessionEnvironments = [
    { value: 'indoor_bouldering', label: 'Indoor Bouldering' },
    { value: 'indoor_rope', label: 'Indoor Rope' },
    { value: 'indoor_both', label: 'Indoor Bouldering and Indoor Rope' },
    { value: 'outdoor_bouldering', label: 'Outdoor Bouldering' },
    { value: 'outdoor_rope', label: 'Outdoor Rope' },
    { value: 'outdoor_both', label: 'Outdoor Rope and Outdoor Bouldering' },
    { value: 'training', label: 'Training (Board/Hangboard)' },
    { value: 'gym_training', label: 'Gym Training Area' },
  ]

  const partnerOptions = [
    { value: 'solo', label: 'Solo' },
    { value: 'partner_casual', label: 'Partner (Casual)' },
    { value: 'partner_serious', label: 'Partner (Projecting/Serious)' },
    { value: 'group', label: 'Group/Social' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Derive session type from environment
    const sessionType = formData.session_environment.includes('bouldering') ? 'bouldering' 
      : formData.session_environment.includes('rope') ? 'lead' 
      : formData.session_environment.includes('training') ? 'training'
      : 'bouldering'

    try {
      await createSession({
        session_date: new Date().toISOString().split('T')[0],
        session_type: sessionType,
        location: '',
        pre_session: { ...formData },
      })
    } catch (error) {
      console.warn('Failed to save session to server:', error)
    }
    
    if (onComplete) {
      const isOutdoor = formData.session_environment.includes('outdoor')
      onComplete({ 
        sessionType, 
        location: '', 
        isOutdoor,
        plannedDuration: formData.planned_duration,
        preSessionData: { ...formData } as Record<string, unknown>,
      })
    }
    
    setIsSubmitting(false)
  }

  const isFormValid = formData.session_environment && formData.partner_status

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Pre-Session Check-In</h1>
        <p className="text-slate-400">Section A: Context & Environment</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Session Environment */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
          <h2 className="font-semibold mb-4">1. Session Environment</h2>
          <div className="grid grid-cols-1 gap-2">
            {sessionEnvironments.map((env) => (
              <button
                key={env.value}
                type="button"
                onClick={() => setFormData({ ...formData, session_environment: env.value })}
                className={`py-3 px-4 rounded-xl text-left text-sm font-medium transition-all ${
                  formData.session_environment === env.value
                    ? 'bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/20 text-white border border-fuchsia-500/30'
                    : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                }`}
              >
                {env.label}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Planned Duration */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
          <h2 className="font-semibold mb-4">2. Planned Duration</h2>
          <div className="flex items-center gap-4">
            <input
              type="number"
              min="15"
              max="300"
              step="15"
              value={formData.planned_duration}
              onChange={(e) => setFormData({ ...formData, planned_duration: parseInt(e.target.value) || 60 })}
              className="w-28 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
            />
            <span className="text-slate-400">minutes</span>
          </div>
        </div>

        {/* 3. Climbing Partner Status */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
          <h2 className="font-semibold mb-4">3. Climbing Partner Status</h2>
          <div className="grid grid-cols-1 gap-2">
            {partnerOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFormData({ ...formData, partner_status: opt.value })}
                className={`py-3 px-4 rounded-xl text-left text-sm font-medium transition-all ${
                  formData.partner_status === opt.value
                    ? 'bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/20 text-white border border-fuchsia-500/30'
                    : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Crowdedness/Business */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
          <h2 className="font-semibold mb-4">4. Crowdedness/Business</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">1 = Empty</span>
              <span className="text-2xl font-bold text-fuchsia-400">{formData.crowdedness}</span>
              <span className="text-sm text-slate-400">5 = Impossible to move</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              value={formData.crowdedness}
              onChange={(e) => setFormData({ ...formData, crowdedness: parseInt(e.target.value) })}
              className="w-full h-3 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-fuchsia-500 [&::-webkit-slider-thumb]:to-cyan-500 [&::-webkit-slider-thumb]:shadow-lg"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>5</span>
            </div>
            {formData.crowdedness === 5 && (
              <p className="text-sm text-amber-400 mt-2">⚠️ Rest times ruined</p>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !isFormValid}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white font-semibold text-lg shadow-lg shadow-fuchsia-500/25 hover:shadow-fuchsia-500/40 hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100 transition-all"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Starting...
            </span>
          ) : (
            'Start Session →'
          )}
        </button>
      </form>
    </div>
  )
}
