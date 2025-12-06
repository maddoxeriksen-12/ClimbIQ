import { useEffect, useState } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { useRecommendationStore } from '../stores/recommendationStore'
import { useCustomVariablesStore } from '../stores/customVariablesStore'
import { CustomVariablesSection } from './CustomVariableInput'
import { useAuth } from '../hooks/useAuth'

interface PreSessionData {
  // A. Context & Environment
  session_environment: string
  planned_duration: number
  partner_status: string
  crowdedness: number
  
  // B. Systemic Recovery & Lifestyle
  sleep_quality: number
  sleep_hours: number
  stress_level: number
  fueling_status: string
  hydration_feel: string
  skin_condition: string
  finger_tendon_health: number
  doms_locations: string[]
  doms_severity: number
  menstrual_phase: string
  
  // C. Intent & Psych
  motivation: number
  primary_goal: string
  
  // D. Physical Readiness (Biofeedback)
  warmup_rpe: string
  warmup_compliance: string
  upper_body_power: number
  shoulder_integrity: number
  leg_springiness: number
  finger_strength_feel: number
  
  // Legacy/Additional
  location: string
  notes: string
  has_pain: boolean
}

interface PreSessionFormProps {
  onComplete?: (info: { 
    sessionType: string
    location: string
    isOutdoor?: boolean
    plannedDuration?: number
    preSessionData?: Record<string, unknown>
    customDateTime?: Date
  }) => void
}

// Slider with 1-10 scale
function RatingSlider10({
  label,
  value,
  onChange,
  icon,
  lowLabel,
  highLabel,
  color = 'fuchsia',
}: {
  label: string
  value: number
  onChange: (v: number) => void
  icon: string
  lowLabel: string
  highLabel: string
  color?: string
}) {
  const colorClasses = {
    fuchsia: 'text-fuchsia-400 from-fuchsia-500 to-cyan-500',
    emerald: 'text-emerald-400 from-emerald-500 to-cyan-500',
    amber: 'text-amber-400 from-amber-500 to-orange-500',
    red: 'text-red-400 from-red-500 to-orange-500',
    violet: 'text-violet-400 from-violet-500 to-fuchsia-500',
  }
  const colors = colorClasses[color as keyof typeof colorClasses] || colorClasses.fuchsia

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <span>{icon}</span>
          {label}
        </label>
        <span className={`text-sm font-semibold ${colors.split(' ')[0]}`}>{value}/10</span>
      </div>
      <input
        type="range"
        min="1"
        max="10"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className={`w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:${colors.split(' ').slice(1).join(' ')} [&::-webkit-slider-thumb]:shadow-lg`}
      />
      <div className="flex justify-between text-xs text-slate-500">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  )
}

// Slider with 1-5 scale
function RatingSlider5({
  label,
  value,
  onChange,
  icon,
  lowLabel,
  highLabel,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  icon: string
  lowLabel: string
  highLabel: string
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <span>{icon}</span>
          {label}
        </label>
        <span className="text-sm font-semibold text-fuchsia-400">{value}/5</span>
      </div>
      <input
        type="range"
        min="1"
        max="5"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-fuchsia-500 [&::-webkit-slider-thumb]:to-cyan-500 [&::-webkit-slider-thumb]:shadow-lg"
      />
      <div className="flex justify-between text-xs text-slate-500">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  )
}

export function PreSessionForm({ onComplete }: PreSessionFormProps) {
  const { createSession } = useSessionStore()
  const { recommendations, fetchPreSessionRecommendations } = useRecommendationStore()
  const { user } = useAuth()
  const { getActiveVariables, recordEntry } = useCustomVariablesStore()

  const customVariables = user ? getActiveVariables('pre_session', user.id, user.user_metadata?.coach_id) : []
  const [customValues, setCustomValues] = useState<Record<string, number | string | boolean>>({})
  
  // Form step management
  const [currentStep, setCurrentStep] = useState<'context' | 'recovery' | 'intent' | 'warmup' | 'readiness'>('context')
  
  // Check if user is female (for menstrual cycle question)
  const isFemale = user?.user_metadata?.sex === 'female'

  const [formData, setFormData] = useState<PreSessionData>({
    // A. Context & Environment
    session_environment: '',
    planned_duration: 90,
    partner_status: 'solo',
    crowdedness: 3,
    
    // B. Systemic Recovery & Lifestyle
    sleep_quality: 5,
    sleep_hours: 7,
    stress_level: 5,
    fueling_status: 'full_meal_1_2hr',
    hydration_feel: 'neutral',
    skin_condition: 'fresh',
    finger_tendon_health: 7,
    doms_locations: [],
    doms_severity: 1,
    menstrual_phase: '',
    
    // C. Intent & Psych
    motivation: 5,
    primary_goal: '',
    
    // D. Physical Readiness
    warmup_rpe: '',
    warmup_compliance: '',
    upper_body_power: 5,
    shoulder_integrity: 5,
    leg_springiness: 5,
    finger_strength_feel: 5,
    
    // Legacy
    location: '',
    notes: '',
    has_pain: false,
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    void fetchPreSessionRecommendations()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Derive finger warning from state (no effect needed)
  const showFingerWarning = formData.finger_tendon_health < 5

  const sessionEnvironments = [
    { value: 'indoor_bouldering', label: 'Indoor Bouldering', icon: '🪨' },
    { value: 'indoor_rope', label: 'Indoor Rope', icon: '🧗' },
    { value: 'indoor_both', label: 'Indoor Boulder & Rope', icon: '🏢' },
    { value: 'outdoor_bouldering', label: 'Outdoor Bouldering', icon: '🏔️' },
    { value: 'outdoor_rope', label: 'Outdoor Rope', icon: '⛰️' },
    { value: 'outdoor_both', label: 'Outdoor Boulder & Rope', icon: '🌄' },
    { value: 'training', label: 'Training (Board/Hangboard)', icon: '🏋️' },
    { value: 'gym_training', label: 'Gym Training Area', icon: '💪' },
  ]

  const partnerOptions = [
    { value: 'solo', label: 'Solo', icon: '🧍' },
    { value: 'partner_casual', label: 'Partner (Casual)', icon: '👥' },
    { value: 'partner_serious', label: 'Partner (Projecting)', icon: '🎯' },
    { value: 'group', label: 'Group/Social', icon: '👨‍👩‍👧‍👦' },
  ]

  const fuelingOptions = [
    { value: 'fasted', label: 'Fasted', desc: 'Empty stomach' },
    { value: 'light_snack', label: 'Light Snack', desc: '<200kcal' },
    { value: 'full_meal_1_2hr', label: 'Full Meal (1-2hrs)', desc: 'Recent meal' },
    { value: 'full_meal_3hr', label: 'Full Meal (3+hrs)', desc: 'Well digested' },
  ]

  const hydrationOptions = [
    { value: 'dehydrated', label: '😓 Thirsty/Dehydrated', color: 'from-red-500/20 to-orange-500/20 border-red-500/30' },
    { value: 'neutral', label: '👍 Neutral', color: 'from-amber-500/20 to-yellow-500/20 border-amber-500/30' },
    { value: 'well_hydrated', label: '💧 Well-Hydrated', color: 'from-emerald-500/20 to-cyan-500/20 border-emerald-500/30' },
  ]

  const skinOptions = [
    { value: 'fresh', label: 'Fresh/Thick', icon: '✨' },
    { value: 'pink', label: 'Pink/Thin', icon: '🩷' },
    { value: 'split', label: 'Split/Cut', icon: '🩹' },
    { value: 'sweaty', label: 'Sweaty/Greasy', icon: '💦' },
    { value: 'dry', label: 'Dry/Glassy', icon: '🏜️' },
    { value: 'worn', label: 'Worn/Painful', icon: '😣' },
  ]

  const domsLocations = [
    { value: 'forearms', label: '💪 Forearms' },
    { value: 'upper_arms_shoulders', label: '🙆 Upper Arms/Shoulders' },
    { value: 'back_lats', label: '🔙 Back/Lats' },
    { value: 'core', label: '🎯 Core' },
    { value: 'legs', label: '🦵 Legs' },
  ]

  const menstrualOptions = [
    { value: 'follicular', label: 'Follicular', desc: 'Low Hormone' },
    { value: 'ovulation', label: 'Ovulation', desc: 'High Risk Laxity' },
    { value: 'luteal', label: 'Luteal', desc: 'High Fatigue' },
    { value: 'menstruation', label: 'Menstruation', desc: '' },
  ]

  const primaryGoals = [
    { value: 'limit_bouldering', label: 'Limit Bouldering', icon: '🔥', desc: 'Push your max grade' },
    { value: 'volume_mileage', label: 'Volume/Mileage', icon: '📈', desc: 'Lots of moderate climbs' },
    { value: 'aerobic_capacity', label: 'Aerobic Capacity (ARC)', icon: '🔄', desc: 'Long easy climbing' },
    { value: 'anaerobic_capacity', label: 'Anaerobic (4x4s)', icon: '⚡', desc: 'High intensity intervals' },
    { value: 'strength_power', label: 'Strength/Power', icon: '💪', desc: 'Hangboard/Campus' },
    { value: 'technique_drills', label: 'Technique Drills', icon: '🎯', desc: 'Movement quality' },
    { value: 'active_recovery', label: 'Active Recovery', icon: '🧘', desc: 'Easy day, stay loose' },
    { value: 'social_fun', label: 'Social/Fun', icon: '🎉', desc: 'Climb with friends' },
    { value: 'tell_me', label: 'Tell me what to do', icon: '🤖', desc: 'AI decides based on readiness' },
  ]

  const warmupRpeOptions = [
    { value: 'easy', label: 'Easy/Too Light', desc: 'RPE 1-3', color: 'emerald' },
    { value: 'just_right', label: 'Just Right/Snappy', desc: 'RPE 4-6', color: 'cyan' },
    { value: 'heavy', label: 'Heavy/Grindy', desc: 'RPE 7-8', color: 'amber' },
    { value: 'failed', label: 'Failed/Painful', desc: 'RPE 9-10', color: 'red' },
  ]

  const warmupComplianceOptions = [
    { value: 'exact', label: 'No, did it exactly', icon: '✅' },
    { value: 'skipped', label: 'Yes, skipped some (time)', icon: '⏭️' },
    { value: 'modified_pain', label: 'Yes, modified (pain/tweak)', icon: '🩹' },
    { value: 'own_routine', label: 'No, did my own routine', icon: '🔄' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    let sessionId = `session_${Date.now()}`
    
    // Derive session type from environment
    const sessionType = formData.session_environment.includes('bouldering') ? 'bouldering' 
      : formData.session_environment.includes('rope') ? 'lead' 
      : formData.session_environment.includes('training') ? 'training'
      : 'bouldering'

    try {
      const session = await createSession({
        session_date: new Date().toISOString().split('T')[0],
        session_type: sessionType,
        location: formData.location,
        pre_session: { ...formData, customVariables: customValues },
      })
      if (session?.id) {
        sessionId = session.id
      }
    } catch (error) {
      console.warn('Failed to save session to server:', error)
    }
    
    Object.entries(customValues).forEach(([variableId, value]) => {
      recordEntry({ variableId, value, sessionId })
    })
    
    if (onComplete) {
      const isOutdoor = formData.session_environment.includes('outdoor')
      onComplete({ 
        sessionType, 
        location: formData.location, 
        isOutdoor,
        plannedDuration: formData.planned_duration,
        preSessionData: { ...formData, customVariables: customValues },
      })
    }
    
    setIsSubmitting(false)
  }

  const nextStep = () => {
    const steps: typeof currentStep[] = ['context', 'recovery', 'intent', 'warmup', 'readiness']
    const currentIndex = steps.indexOf(currentStep)
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1])
    }
  }

  const prevStep = () => {
    const steps: typeof currentStep[] = ['context', 'recovery', 'intent', 'warmup', 'readiness']
    const currentIndex = steps.indexOf(currentStep)
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1])
    }
  }

  const stepTitles = {
    context: 'A. Context & Environment',
    recovery: 'B. Systemic Recovery & Lifestyle',
    intent: 'C. Intent & Psych',
    warmup: 'Warm-Up',
    readiness: 'D. Physical Readiness',
  }

  const stepProgress = {
    context: 20,
    recovery: 40,
    intent: 60,
    warmup: 80,
    readiness: 100,
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Pre-Session Check-In</h1>
        <p className="text-slate-400">Establish your expected performance & capacity</p>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-slate-400 mb-2">
          <span>{stepTitles[currentStep]}</span>
          <span>{stepProgress[currentStep]}%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 transition-all duration-300"
            style={{ width: `${stepProgress[currentStep]}%` }}
          />
        </div>
      </div>

      {/* Recommendations (show on first step) */}
      {currentStep === 'context' && recommendations.length > 0 && (
        <div className="mb-6 rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">💡</span>
            <h3 className="font-semibold">Pre-Session Tips</h3>
          </div>
          <div className="space-y-3">
            {recommendations.slice(0, 2).map((rec) => (
              <div key={rec.id} className="p-3 rounded-xl bg-white/5 border border-white/5">
                <p className="font-medium text-sm">{rec.title}</p>
                <p className="text-sm text-slate-400 mt-1">{rec.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* STEP A: Context & Environment */}
        {currentStep === 'context' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Session Environment */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <span>🏔️</span> Session Environment
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {sessionEnvironments.map((env) => (
                  <button
                    key={env.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, session_environment: env.value })}
                    className={`p-4 rounded-xl text-left transition-all ${
                      formData.session_environment === env.value
                        ? 'bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/20 border border-fuchsia-500/30 ring-1 ring-fuchsia-500/20'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-2xl mb-1">{env.icon}</div>
                    <p className="font-medium text-sm">{env.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Planned Duration */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <span>⏱️</span> Planned Duration
              </h2>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  min="15"
                  max="300"
                  step="15"
                  value={formData.planned_duration}
                  onChange={(e) => setFormData({ ...formData, planned_duration: parseInt(e.target.value) || 60 })}
                  className="w-24 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
                />
                <span className="text-slate-400">minutes</span>
              </div>
            </div>

            {/* Partner Status */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <span>👥</span> Climbing Partner Status
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {partnerOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, partner_status: opt.value })}
                    className={`py-3 px-4 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                      formData.partner_status === opt.value
                        ? 'bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/20 text-white border border-fuchsia-500/30'
                        : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <span>{opt.icon}</span> {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Crowdedness */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <RatingSlider5
                label="Crowdedness/Business"
                icon="👥"
                value={formData.crowdedness}
                onChange={(v) => setFormData({ ...formData, crowdedness: v })}
                lowLabel="Empty"
                highLabel="Can't move/Rest ruined"
              />
            </div>

            {/* Location (optional) */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <span>📍</span> Location <span className="text-slate-500 text-sm font-normal">(optional)</span>
              </h2>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Movement RiNo, Boulder Canyon..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
              />
            </div>
          </div>
        )}

        {/* STEP B: Systemic Recovery & Lifestyle */}
        {currentStep === 'recovery' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Sleep */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <span>😴</span> Sleep Quality & Quantity
              </h2>
              <div className="space-y-5">
                <RatingSlider10
                  label="Sleep Quality"
                  icon="⭐"
                  value={formData.sleep_quality}
                  onChange={(v) => setFormData({ ...formData, sleep_quality: v })}
                  lowLabel="Insomniac/Wrecked"
                  highLabel="Best sleep of my life"
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Hours Slept (optional)</label>
                  <input
                    type="number"
                    min="0"
                    max="16"
                    step="0.5"
                    value={formData.sleep_hours}
                    onChange={(e) => setFormData({ ...formData, sleep_hours: parseFloat(e.target.value) || 0 })}
                    className="w-24 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white text-center focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
                  />
                </div>
              </div>
            </div>

            {/* Stress */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <RatingSlider10
                label="Stress Level (Mental Load)"
                icon="😰"
                value={formData.stress_level}
                onChange={(v) => setFormData({ ...formData, stress_level: v })}
                lowLabel="Zen/Relaxed"
                highLabel="High Anxiety/Overwhelmed"
              />
            </div>

            {/* Fueling */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <span>🍽️</span> Fueling Status
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {fuelingOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, fueling_status: opt.value })}
                    className={`p-3 rounded-xl text-left transition-all ${
                      formData.fueling_status === opt.value
                        ? 'bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/20 border border-fuchsia-500/30'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <p className="font-medium text-sm">{opt.label}</p>
                    <p className="text-xs text-slate-400">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Hydration */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <span>💧</span> Hydration Feel
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {hydrationOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, hydration_feel: opt.value })}
                    className={`py-3 px-3 rounded-lg text-sm font-medium transition-all ${
                      formData.hydration_feel === opt.value
                        ? `bg-gradient-to-r ${opt.color} text-white border`
                        : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Skin Condition */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <span>✋</span> Skin Condition
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {skinOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, skin_condition: opt.value })}
                    className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      formData.skin_condition === opt.value
                        ? 'bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/20 text-white border border-fuchsia-500/30'
                        : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Finger Tendon Health */}
            <div className={`rounded-2xl border backdrop-blur-sm p-6 ${
              showFingerWarning 
                ? 'border-red-500/30 bg-red-500/10' 
                : 'border-white/10 bg-white/5'
            }`}>
              <RatingSlider10
                label="Finger Tendon Health (The 'Tweak' Factor)"
                icon="🤌"
                value={formData.finger_tendon_health}
                onChange={(v) => setFormData({ ...formData, finger_tendon_health: v })}
                lowLabel="Painful/Injured"
                highLabel="Bulletproof/No pain"
                color={showFingerWarning ? 'red' : 'fuchsia'}
              />
              {showFingerWarning && (
                <div className="mt-4 p-4 rounded-xl bg-red-500/20 border border-red-500/30">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <p className="font-semibold text-red-300">Finger Health Warning</p>
                      <p className="text-sm text-red-200/80 mt-1">
                        Your finger tendon health is low. Consider an <strong>Active Recovery</strong> session 
                        or rest day to prevent injury progression.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* DOMS */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <span>💪</span> Deep Muscle Soreness (DOMS)
              </h2>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {domsLocations.map((loc) => (
                    <button
                      key={loc.value}
                      type="button"
                      onClick={() => {
                        const current = formData.doms_locations
                        const updated = current.includes(loc.value)
                          ? current.filter((l) => l !== loc.value)
                          : [...current, loc.value]
                        setFormData({ ...formData, doms_locations: updated })
                      }}
                      className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                        formData.doms_locations.includes(loc.value)
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {loc.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, doms_locations: [] })}
                    className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      formData.doms_locations.length === 0
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    ✨ None
                  </button>
                </div>
                {formData.doms_locations.length > 0 && (
                  <RatingSlider10
                    label="Severity"
                    icon="📊"
                    value={formData.doms_severity}
                    onChange={(v) => setFormData({ ...formData, doms_severity: v })}
                    lowLabel="Mild awareness"
                    highLabel="Debilitating"
                    color="amber"
                  />
                )}
              </div>
            </div>

            {/* Menstrual Cycle (if female) */}
            {isFemale && (
              <div className="rounded-2xl border border-pink-500/20 bg-pink-500/5 backdrop-blur-sm p-6">
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                  <span>🌸</span> Menstrual Cycle Phase
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {menstrualOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, menstrual_phase: opt.value })}
                      className={`p-3 rounded-xl text-left transition-all ${
                        formData.menstrual_phase === opt.value
                          ? 'bg-pink-500/20 border border-pink-500/30'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <p className="font-medium text-sm">{opt.label}</p>
                      {opt.desc && <p className="text-xs text-slate-400">{opt.desc}</p>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP C: Intent & Psych */}
        {currentStep === 'intent' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Motivation */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <RatingSlider10
                label="Motivation (Psych Level)"
                icon="🔥"
                value={formData.motivation}
                onChange={(v) => setFormData({ ...formData, motivation: v })}
                lowLabel="Dreading it"
                highLabel="Can't wait to crush"
                color="fuchsia"
              />
            </div>

            {/* Primary Goal */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <h2 className="font-semibold mb-2">Primary Session Goal</h2>
              <p className="text-sm text-slate-400 mb-4">What's your focus today?</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {primaryGoals.map((goal) => (
                  <button
                    key={goal.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, primary_goal: goal.value })}
                    className={`p-4 rounded-xl text-left transition-all ${
                      formData.primary_goal === goal.value
                        ? 'bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/20 border border-fuchsia-500/30 ring-1 ring-fuchsia-500/20'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-2xl mb-2">{goal.icon}</div>
                    <p className="font-medium text-sm">{goal.label}</p>
                    <p className="text-xs text-slate-400 mt-1">{goal.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* WARM-UP SCREEN */}
        {currentStep === 'warmup' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 backdrop-blur-sm p-8 text-center">
              <div className="text-6xl mb-4">🏃‍♂️</div>
              <h2 className="text-2xl font-bold mb-4">Time to Warm Up!</h2>
              <p className="text-slate-300 mb-6 max-w-md mx-auto">
                Begin your warm-up following the recommended routine. 
                Once you're warm, come back to rate your physical readiness.
              </p>
              
              <div className="bg-white/5 rounded-xl p-6 mb-6 text-left">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span>📋</span> Recommended Warm-up
                </h3>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li>• 5-10 min light cardio (bike, jumping jacks)</li>
                  <li>• Dynamic stretching (arm circles, leg swings)</li>
                  <li>• Easy climbing: 3-5 problems well below your max</li>
                  <li>• Progressively harder: 2-3 problems closer to warm-up grade</li>
                  <li>• Finger activation: light hangs or easy crimps</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={nextStep}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 text-white font-semibold text-lg shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.01] transition-all"
              >
                ✅ I'm Warm - Rate Readiness
              </button>
            </div>
          </div>
        )}

        {/* STEP D: Physical Readiness (Biofeedback) */}
        {currentStep === 'readiness' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 mb-4">
              <p className="text-sm text-emerald-300 flex items-center gap-2">
                <span>✅</span>
                Rate how you feel <strong>after</strong> completing your warm-up
              </p>
            </div>

            {/* Warm-up RPE */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <h2 className="font-semibold mb-2 flex items-center gap-2">
                <span>📊</span> Warm-up Benchmark RPE
              </h2>
              <p className="text-sm text-slate-400 mb-4">How did the hardest part of the warm-up feel?</p>
              <div className="grid grid-cols-2 gap-3">
                {warmupRpeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, warmup_rpe: opt.value })}
                    className={`p-4 rounded-xl text-left transition-all ${
                      formData.warmup_rpe === opt.value
                        ? opt.color === 'emerald' ? 'bg-emerald-500/20 border border-emerald-500/30'
                        : opt.color === 'cyan' ? 'bg-cyan-500/20 border border-cyan-500/30'
                        : opt.color === 'amber' ? 'bg-amber-500/20 border border-amber-500/30'
                        : 'bg-red-500/20 border border-red-500/30'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <p className="font-medium text-sm">{opt.label}</p>
                    <p className="text-xs text-slate-400">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Warm-up Compliance */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <h2 className="font-semibold mb-2 flex items-center gap-2">
                <span>✔️</span> Warm-up Compliance
              </h2>
              <p className="text-sm text-slate-400 mb-4">Did you modify the recommended warm-up?</p>
              <div className="grid grid-cols-2 gap-3">
                {warmupComplianceOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, warmup_compliance: opt.value })}
                    className={`py-3 px-4 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                      formData.warmup_compliance === opt.value
                        ? 'bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/20 text-white border border-fuchsia-500/30'
                        : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <span>{opt.icon}</span> {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Biofeedback Sliders */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 space-y-6">
              <RatingSlider10
                label="Upper Body Power ('Pull' feel)"
                icon="💪"
                value={formData.upper_body_power}
                onChange={(v) => setFormData({ ...formData, upper_body_power: v })}
                lowLabel="Heavy/Slow"
                highLabel="Light/Explosive"
                color="emerald"
              />

              <RatingSlider10
                label="Shoulder Integrity"
                icon="🙆"
                value={formData.shoulder_integrity}
                onChange={(v) => setFormData({ ...formData, shoulder_integrity: v })}
                lowLabel="Stiff/Painful overhead"
                highLabel="Mobile/Stable"
                color="emerald"
              />

              <RatingSlider10
                label="Leg 'Springiness' (CNS Readiness)"
                icon="🦵"
                value={formData.leg_springiness}
                onChange={(v) => setFormData({ ...formData, leg_springiness: v })}
                lowLabel="Heavy/Sluggish"
                highLabel="Bouncy/Explosive"
                color="emerald"
              />

              <RatingSlider10
                label="Finger Strength"
                icon="🤌"
                value={formData.finger_strength_feel}
                onChange={(v) => setFormData({ ...formData, finger_strength_feel: v })}
                lowLabel="Only jugs/bar hangs"
                highLabel="Crimp felt explosive"
                color="emerald"
              />
            </div>

            {/* Custom Variables */}
            {customVariables.length > 0 && (
              <CustomVariablesSection
                variables={customVariables}
                values={customValues}
                onChange={(variableId, value) => 
                  setCustomValues((prev) => ({ ...prev, [variableId]: value }))
                }
                formType="pre_session"
              />
            )}

            {/* Notes */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <h2 className="font-semibold mb-4">Notes (optional)</h2>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Anything else relevant..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 h-24 resize-none"
              />
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-3 mt-6">
          {currentStep !== 'context' && (
            <button
              type="button"
              onClick={prevStep}
              className="flex-1 py-4 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/5 transition-all"
            >
              ← Back
            </button>
          )}
          
          {currentStep !== 'readiness' ? (
            <button
              type="button"
              onClick={nextStep}
              disabled={
                (currentStep === 'context' && !formData.session_environment) ||
                (currentStep === 'intent' && !formData.primary_goal)
              }
              className="flex-1 py-4 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white font-semibold shadow-lg shadow-fuchsia-500/25 hover:shadow-fuchsia-500/40 hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100 transition-all"
            >
              {currentStep === 'intent' ? 'Start Warm-up →' : 'Next →'}
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting || !formData.warmup_rpe || !formData.warmup_compliance}
              className="flex-1 py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-semibold text-lg shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100 transition-all"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Starting...
                </span>
              ) : (
                '🧗 Start Climbing Session'
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
