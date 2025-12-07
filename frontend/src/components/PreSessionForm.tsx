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
  const [isIndoor, setIsIndoor] = useState(true)

  const indoorEnvironments = [
    { value: 'indoor_bouldering', label: 'Bouldering' },
    { value: 'indoor_rope', label: 'Rope' },
    { value: 'indoor_both', label: 'Bouldering and Rope' },
    { value: 'training', label: 'Training (Board/Hangboard)' },
    { value: 'gym_training', label: 'Gym Training Area' },
  ]

  const outdoorEnvironments = [
    { value: 'outdoor_bouldering', label: 'Bouldering' },
    { value: 'outdoor_rope', label: 'Rope' },
    { value: 'outdoor_both', label: 'Rope and Bouldering' },
  ]

  const sessionEnvironments = isIndoor ? indoorEnvironments : outdoorEnvironments

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
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold mb-1">Pre-Session Check-In</h1>
        <p className="text-slate-400 text-sm">Section A: Context & Environment</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 1. Session Environment */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-3">1. Session Environment</h2>
          
          {/* Indoor/Outdoor Toggle */}
          <div className="flex rounded-lg bg-white/5 p-0.5 mb-3">
            <button
              type="button"
              onClick={() => {
                setIsIndoor(true)
                setFormData({ ...formData, session_environment: '' })
              }}
              className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-all ${
                isIndoor
                  ? 'bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🏢 Indoor
            </button>
            <button
              type="button"
              onClick={() => {
                setIsIndoor(false)
                setFormData({ ...formData, session_environment: '' })
              }}
              className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-all ${
                !isIndoor
                  ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🏔️ Outdoor
            </button>
          </div>

          {/* Environment Options */}
          <div className="grid grid-cols-1 gap-1.5">
            {sessionEnvironments.map((env) => (
              <button
                key={env.value}
                type="button"
                onClick={() => setFormData({ ...formData, session_environment: env.value })}
                className={`py-2 px-3 rounded-lg text-left text-xs font-medium transition-all ${
                  formData.session_environment === env.value
                    ? isIndoor 
                      ? 'bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/20 text-white border border-fuchsia-500/30'
                      : 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-white border border-emerald-500/30'
                    : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                }`}
              >
                {env.label}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Planned Duration */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-3">2. Planned Duration</h2>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="15"
              max="300"
              step="15"
              value={formData.planned_duration}
              onChange={(e) => setFormData({ ...formData, planned_duration: parseInt(e.target.value) || 60 })}
              className="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white text-center focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
            />
            <span className="text-slate-400 text-xs">minutes</span>
          </div>
        </div>

        {/* 3. Climbing Partner Status */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-3">3. Climbing Partner Status</h2>
          <div className="grid grid-cols-2 gap-1.5">
            {partnerOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFormData({ ...formData, partner_status: opt.value })}
                className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
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
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-3">4. Crowdedness/Business</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">1 = Empty</span>
              <span className="text-lg font-bold text-fuchsia-400">{formData.crowdedness}</span>
              <span className="text-xs text-slate-400">5 = Can't move</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              value={formData.crowdedness}
              onChange={(e) => setFormData({ ...formData, crowdedness: parseInt(e.target.value) })}
              className="w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-fuchsia-500 [&::-webkit-slider-thumb]:to-cyan-500 [&::-webkit-slider-thumb]:shadow-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>5</span>
            </div>
            {formData.crowdedness === 5 && (
              <p className="text-xs text-amber-400">⚠️ Rest times ruined</p>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !isFormValid}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white font-semibold text-sm shadow-lg shadow-fuchsia-500/25 hover:shadow-fuchsia-500/40 hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100 transition-all"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
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
