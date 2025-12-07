import { useState } from 'react'
import { useSessionStore } from '../stores/sessionStore'
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
  finger_strength: number
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
  const { user } = useAuth()

  const [formData, setFormData] = useState<PreSessionData>({
    // A. Context & Environment
    session_environment: '',
    planned_duration: 90,
    partner_status: '',
    crowdedness: 3,
    // B. Systemic Recovery & Lifestyle
    sleep_quality: 5,
    sleep_hours: 0,
    stress_level: 5,
    fueling_status: '',
    hydration_feel: '',
    skin_condition: '',
    finger_tendon_health: 7,
    doms_locations: [],
    doms_severity: 1,
    menstrual_phase: '',
    // C. Intent & Psych
    motivation: 5,
    primary_goal: '',
    // D. Physical Readiness (Biofeedback)
    warmup_rpe: '',
    warmup_compliance: '',
    upper_body_power: 5,
    shoulder_integrity: 5,
    leg_springiness: 5,
    finger_strength: 5,
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isIndoor, setIsIndoor] = useState(true)
  const [warmupGenerated, setWarmupGenerated] = useState(false)
  const [warmupComplete, setWarmupComplete] = useState(false)
  const [generatedWarmup, setGeneratedWarmup] = useState<{
    duration: string
    intensity: string
    activation: string[]
    climbing: string[]
    benchmark: string[]
    warnings: string[]
  } | null>(null)

  // Check if user is female (for menstrual cycle question)
  const isFemale = user?.user_metadata?.sex === 'female'

  // Finger warning when < 5
  const showFingerWarning = formData.finger_tendon_health < 5

  // Check if Sections A-C are complete enough to generate warm-up
  const canGenerateWarmup = formData.session_environment && formData.partner_status

  // Generate personalized warm-up based on Sections A-C
  const generateWarmup = () => {
    const warmup = {
      duration: '10-15 min',
      intensity: 'moderate',
      activation: [] as string[],
      climbing: [] as string[],
      benchmark: [] as string[],
      warnings: [] as string[],
    }

    // Adjust based on session environment
    const isBouldering = formData.session_environment.includes('bouldering')
    const isRope = formData.session_environment.includes('rope')
    const isTraining = formData.session_environment.includes('training')
    const isOutdoor = formData.session_environment.includes('outdoor')

    // Base activation exercises
    warmup.activation = [
      'Light cardio: 2-3 min jumping jacks or jogging',
      'Arm circles: 20 each direction',
      'Wrist circles & finger extensions: 30 sec each',
    ]

    // Adjust for sleep quality / recovery
    if (formData.sleep_quality <= 4) {
      warmup.duration = '15-20 min'
      warmup.intensity = 'gentle'
      warmup.activation.push('Extra mobility work: cat-cow stretches, hip circles')
      warmup.warnings.push('⚠️ Low sleep - extend warm-up & lower intensity expectations')
    }

    // Adjust for stress
    if (formData.stress_level >= 7) {
      warmup.activation.push('Box breathing: 4-4-4-4 for 2 minutes')
      warmup.warnings.push('⚠️ High stress - focus on breathing & stay present')
    }

    // Adjust for finger health
    if (formData.finger_tendon_health <= 5) {
      warmup.activation.push('Extra finger warm-up: rice bucket or finger curls')
      warmup.climbing.push('Start on large holds only - NO crimping until fully warm')
      warmup.warnings.push('⚠️ Finger concerns - prioritize tendon warm-up')
    }

    // Adjust for DOMS
    if (formData.doms_locations.length > 0) {
      const soreAreas = formData.doms_locations.join(', ')
      warmup.activation.push(`Dynamic stretches targeting: ${soreAreas}`)
      if (formData.doms_severity >= 6) {
        warmup.warnings.push('⚠️ Significant DOMS - consider lower volume today')
      }
    }

    // Climbing-specific based on session type
    if (isBouldering) {
      warmup.climbing = [
        'Easy traversing on jugs: 3-5 min',
        'Progressive boulder pyramid: VB → V0 → V1 → V2',
        'Practice mantles & top-outs at low height',
      ]
      warmup.benchmark = [
        `Attempt 1-2 problems at ${formData.motivation >= 7 ? 'flash grade' : 'comfortable grade'}`,
        'Note: How explosive do moves feel?',
      ]
    } else if (isRope) {
      warmup.climbing = [
        'Easy route: 1 full pitch at flash-2 grade',
        'Focus on smooth movement & breathing',
        isOutdoor ? 'Check gear: harness, belay device, rope ends' : 'Practice clipping at various heights',
      ]
      warmup.benchmark = [
        'Climb one route at onsight-1 grade',
        'Note: How does sustained effort feel?',
      ]
    } else if (isTraining) {
      warmup.climbing = [
        'Light hangboard: 3x5s on large edge at 50% effort',
        'Pull-up progression: 5 scap pulls → 5 easy pulls → 3 hard pulls',
        'Campus touches on large rungs (no pulling)',
      ]
      warmup.benchmark = [
        'One set at target hang weight/duration at ~80%',
        'Note: Does it feel lighter or heavier than usual?',
      ]
    } else {
      warmup.climbing = [
        'Easy climbing: 5-10 min on comfortable terrain',
        'Mix of movement styles',
      ]
      warmup.benchmark = [
        'One moderate effort climb',
        'Check in with body awareness',
      ]
    }

    // Adjust for hydration/fueling
    if (formData.hydration_feel === 'dehydrated') {
      warmup.warnings.push('💧 Drink water now - aim for 500ml before hard efforts')
    }
    if (formData.fueling_status === 'fasted') {
      warmup.warnings.push('🍌 Consider a quick snack if session > 1hr')
    }

    // Adjust for skin condition
    if (formData.skin_condition === 'split' || formData.skin_condition === 'worn') {
      warmup.warnings.push('🩹 Tape splits before climbing - avoid sharp holds')
    }
    if (formData.skin_condition === 'sweaty') {
      warmup.warnings.push('🧴 Use chalk liberally - consider liquid chalk base')
    }

    // Adjust for partner status
    if (formData.partner_status === 'solo' && isRope) {
      warmup.warnings.push('👥 Find a belay partner before rope climbing')
    }

    // Adjust for motivation
    if (formData.motivation <= 3) {
      warmup.intensity = 'easy'
      warmup.warnings.push('😌 Low psych is okay - focus on movement quality over sends')
    } else if (formData.motivation >= 8) {
      warmup.warnings.push('🔥 High psych! Don\'t skip warm-up - channel energy after')
    }

    // Menstrual cycle adjustments
    if (formData.menstrual_phase === 'ovulation') {
      warmup.activation.push('Extra shoulder/joint stability work')
      warmup.warnings.push('⚠️ Ovulation phase - joints more lax, be careful with big moves')
    } else if (formData.menstrual_phase === 'luteal') {
      warmup.warnings.push('😴 Luteal phase - energy may be lower, adjust expectations')
    }

    setGeneratedWarmup(warmup)
    setWarmupGenerated(true)
  }

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

  const fuelingOptions = [
    { value: 'fasted', label: 'Fasted' },
    { value: 'light_snack', label: 'Light Snack (<200kcal)' },
    { value: 'full_meal_1_2hr', label: 'Full Meal (1-2hrs ago)' },
    { value: 'full_meal_3hr', label: 'Full Meal (3+hrs ago)' },
  ]

  const hydrationOptions = [
    { value: 'dehydrated', label: 'Thirsty/Dehydrated' },
    { value: 'neutral', label: 'Neutral' },
    { value: 'well_hydrated', label: 'Well-Hydrated' },
  ]

  const skinOptions = [
    { value: 'fresh', label: 'Fresh/Thick' },
    { value: 'pink', label: 'Pink/Thin' },
    { value: 'split', label: 'Split/Cut' },
    { value: 'sweaty', label: 'Sweaty/Greasy' },
    { value: 'dry', label: 'Dry/Glassy' },
    { value: 'worn', label: 'Worn/Painful' },
  ]

  const domsLocations = [
    { value: 'none', label: 'None' },
    { value: 'forearms', label: 'Forearms' },
    { value: 'upper_arms_shoulders', label: 'Upper Arms/Shoulders' },
    { value: 'back_lats', label: 'Back/Lats' },
    { value: 'core', label: 'Core' },
    { value: 'legs', label: 'Legs' },
  ]

  const menstrualOptions = [
    { value: 'follicular', label: 'Follicular (Low Hormone)' },
    { value: 'ovulation', label: 'Ovulation (High Risk Laxity)' },
    { value: 'luteal', label: 'Luteal (High Fatigue)' },
    { value: 'menstruation', label: 'Menstruation' },
  ]

  const primaryGoalOptions = [
    { value: 'limit_bouldering', label: 'Limit Bouldering' },
    { value: 'volume_mileage', label: 'Volume/Mileage' },
    { value: 'aerobic_capacity', label: 'Aerobic Capacity (ARC)' },
    { value: 'anaerobic_capacity', label: 'Anaerobic Capacity (4x4s)' },
    { value: 'strength_power', label: 'Strength/Power (Hangboard/Campus)' },
    { value: 'technique_drills', label: 'Technique Drills' },
    { value: 'active_recovery', label: 'Active Recovery' },
    { value: 'social_fun', label: 'Social/Fun' },
    { value: 'tell_me', label: 'Tell me what to do' },
  ]

  const warmupRpeOptions = [
    { value: 'easy', label: 'Easy/Too Light (RPE 1-3)' },
    { value: 'just_right', label: 'Just Right/Snappy (RPE 4-6)' },
    { value: 'heavy', label: 'Heavy/Grindy (RPE 7-8)' },
    { value: 'failed', label: 'Failed/Painful (RPE 9-10)' },
  ]

  const warmupComplianceOptions = [
    { value: 'exact', label: 'No, did it exactly' },
    { value: 'skipped', label: 'Yes, skipped some parts (Short on time)' },
    { value: 'modified_pain', label: 'Yes, modified due to pain/tweak' },
    { value: 'own_routine', label: 'No, did my own routine' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

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
        <p className="text-slate-400 text-sm">Establish your expected performance & capacity</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ============================================ */}
        {/* SECTION A: Context & Environment */}
        {/* ============================================ */}
        <div className="mb-2">
          <h3 className="text-xs font-bold text-fuchsia-400 uppercase tracking-wider">A. Context & Environment</h3>
          </div>

        {/* 1. Session Environment */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-3">1. Session Environment</h2>
          
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
          <div className="space-y-2">
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
            {formData.crowdedness === 5 && (
              <p className="text-xs text-amber-400">⚠️ Rest times ruined</p>
            )}
          </div>
        </div>

        {/* ============================================ */}
        {/* SECTION B: Systemic Recovery & Lifestyle */}
        {/* ============================================ */}
        <div className="mt-6 mb-2">
          <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">B. Systemic Recovery & Lifestyle</h3>
            </div>

        {/* 1. Sleep Quality & Quantity */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-3">1. Sleep Quality & Quantity</h2>
            <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">1 = Insomniac/Wrecked</span>
              <span className="text-lg font-bold text-cyan-400">{formData.sleep_quality}</span>
              <span className="text-xs text-slate-400">10 = Best sleep ever</span>
              </div>
                <input
              type="range"
              min="1"
              max="10"
              value={formData.sleep_quality}
              onChange={(e) => setFormData({ ...formData, sleep_quality: parseInt(e.target.value) })}
              className="w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-cyan-500 [&::-webkit-slider-thumb]:to-emerald-500 [&::-webkit-slider-thumb]:shadow-lg"
            />
            <div className="flex items-center gap-2 pt-2">
              <span className="text-xs text-slate-400">Hours slept (optional):</span>
                  <input
                    type="number"
                min="0"
                max="16"
                step="0.5"
                value={formData.sleep_hours || ''}
                onChange={(e) => setFormData({ ...formData, sleep_hours: parseFloat(e.target.value) || 0 })}
                placeholder="—"
                className="w-16 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white text-center focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
                </div>
              </div>
            </div>

        {/* 2. Stress Level */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-3">2. Stress Level (Mental Load)</h2>
                <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">1 = Zen/Relaxed</span>
              <span className="text-lg font-bold text-cyan-400">{formData.stress_level}</span>
              <span className="text-xs text-slate-400">10 = High Anxiety</span>
                  </div>
            <input
              type="range"
              min="1"
              max="10"
              value={formData.stress_level}
              onChange={(e) => setFormData({ ...formData, stress_level: parseInt(e.target.value) })}
              className="w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-cyan-500 [&::-webkit-slider-thumb]:to-emerald-500 [&::-webkit-slider-thumb]:shadow-lg"
            />
          </div>
        </div>

        {/* 3. Fueling Status */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-3">3. Fueling Status</h2>
          <div className="grid grid-cols-2 gap-1.5">
            {fuelingOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFormData({ ...formData, fueling_status: opt.value })}
                      className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                  formData.fueling_status === opt.value
                    ? 'bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 text-white border border-cyan-500/30'
                    : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                }`}
              >
                {opt.label}
                    </button>
                  ))}
                </div>
              </div>

        {/* 4. Hydration Feel */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-3">4. Hydration Feel</h2>
          <div className="grid grid-cols-3 gap-1.5">
            {hydrationOptions.map((opt) => (
                    <button
                key={opt.value}
                      type="button"
                onClick={() => setFormData({ ...formData, hydration_feel: opt.value })}
                className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                  formData.hydration_feel === opt.value
                    ? 'bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 text-white border border-cyan-500/30'
                    : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                }`}
              >
                {opt.label}
                    </button>
                  ))}
                </div>
              </div>

        {/* 5. Skin Condition */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-3">5. Skin Condition</h2>
          <div className="grid grid-cols-3 gap-1.5">
            {skinOptions.map((opt) => (
                    <button
                key={opt.value}
                      type="button"
                onClick={() => setFormData({ ...formData, skin_condition: opt.value })}
                className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                  formData.skin_condition === opt.value
                    ? 'bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 text-white border border-cyan-500/30'
                    : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                }`}
              >
                {opt.label}
                    </button>
                  ))}
                </div>
              </div>

        {/* 6. Finger Tendon Health */}
        <div className={`rounded-xl border backdrop-blur-sm p-4 ${
          showFingerWarning 
            ? 'border-red-500/30 bg-red-500/10' 
            : 'border-white/10 bg-white/5'
        }`}>
          <h2 className="text-sm font-semibold mb-3">6. Finger Tendon Health (The "Tweak" Factor)</h2>
              <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">1 = Painful/Injured</span>
              <span className={`text-lg font-bold ${showFingerWarning ? 'text-red-400' : 'text-cyan-400'}`}>
                {formData.finger_tendon_health}
              </span>
              <span className="text-xs text-slate-400">10 = Bulletproof</span>
                </div>
                <input
              type="range"
                    min="1"
              max="10"
              value={formData.finger_tendon_health}
              onChange={(e) => setFormData({ ...formData, finger_tendon_health: parseInt(e.target.value) })}
              className={`w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg ${
                showFingerWarning 
                  ? '[&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-red-500 [&::-webkit-slider-thumb]:to-orange-500'
                  : '[&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-cyan-500 [&::-webkit-slider-thumb]:to-emerald-500'
              }`}
                  />
                </div>
          {showFingerWarning && (
            <div className="mt-3 p-3 rounded-lg bg-red-500/20 border border-red-500/30">
              <p className="text-xs font-semibold text-red-300">⚠️ STOP - Finger Health Warning</p>
              <p className="text-xs text-red-200/80 mt-1">
                Consider <strong>Active Recovery</strong> or rest. Climbing with tweaky fingers risks serious injury.
              </p>
                </div>
        )}
              </div>

        {/* 7. Deep Muscle Soreness (DOMS) */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-3">7. Deep Muscle Soreness (DOMS)</h2>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {domsLocations.map((loc) => (
                    <button
                  key={loc.value}
                      type="button"
              onClick={() => {
                    if (loc.value === 'none') {
                      setFormData({ ...formData, doms_locations: [], doms_severity: 1 })
                    } else {
                      const current = formData.doms_locations.filter(l => l !== 'none')
                      const updated = current.includes(loc.value)
                        ? current.filter((l) => l !== loc.value)
                        : [...current, loc.value]
                      setFormData({ ...formData, doms_locations: updated })
                    }
                  }}
                  className={`py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all ${
                    (loc.value === 'none' && formData.doms_locations.length === 0) ||
                    formData.doms_locations.includes(loc.value)
                      ? 'bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 text-white border border-cyan-500/30'
                      : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                  }`}
                >
                          {loc.label}
                    </button>
                  ))}
                </div>
            {formData.doms_locations.length > 0 && (
              <div className="pt-2 space-y-2">
                    <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Severity: 1 = Mild</span>
                  <span className="text-lg font-bold text-amber-400">{formData.doms_severity}</span>
                  <span className="text-xs text-slate-400">10 = Debilitating</span>
              </div>
                <input
                      type="range"
                      min="1"
                  max="10"
                  value={formData.doms_severity}
                  onChange={(e) => setFormData({ ...formData, doms_severity: parseInt(e.target.value) })}
                  className="w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-amber-500 [&::-webkit-slider-thumb]:to-orange-500 [&::-webkit-slider-thumb]:shadow-lg"
                />
          </div>
        )}
            </div>
              </div>

        {/* 8. Menstrual Cycle Phase (if female) */}
        {isFemale && (
          <div className="rounded-xl border border-pink-500/20 bg-pink-500/5 backdrop-blur-sm p-4">
            <h2 className="text-sm font-semibold mb-3">8. Menstrual Cycle Phase</h2>
            <div className="grid grid-cols-2 gap-1.5">
              {menstrualOptions.map((opt) => (
            <button
                  key={opt.value}
              type="button"
                  onClick={() => setFormData({ ...formData, menstrual_phase: opt.value })}
                  className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                    formData.menstrual_phase === opt.value
                      ? 'bg-pink-500/20 text-white border border-pink-500/30'
                      : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {opt.label}
            </button>
              ))}
          </div>
                  </div>
          )}

        {/* ============================================ */}
        {/* SECTION C: Intent & Psych */}
        {/* ============================================ */}
        <div className="mt-6 mb-2">
          <h3 className="text-xs font-bold text-violet-400 uppercase tracking-wider">C. Intent & Psych</h3>
                  </div>

        {/* 1. Motivation (Psych Level) */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-3">1. Motivation (Psych Level)</h2>
          <div className="space-y-2">
                    <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">1 = Dreading it</span>
              <span className="text-lg font-bold text-violet-400">{formData.motivation}</span>
              <span className="text-xs text-slate-400">10 = Can't wait to crush</span>
                    </div>
                    <input
                      type="range"
                      min="1"
              max="10"
              value={formData.motivation}
              onChange={(e) => setFormData({ ...formData, motivation: parseInt(e.target.value) })}
              className="w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-violet-500 [&::-webkit-slider-thumb]:to-fuchsia-500 [&::-webkit-slider-thumb]:shadow-lg"
            />
                    </div>
                  </div>

        {/* 2. Primary Session Goal */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-3">2. Primary Session Goal</h2>
          <div className="grid grid-cols-1 gap-1.5">
            {primaryGoalOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFormData({ ...formData, primary_goal: opt.value })}
                className={`py-2 px-3 rounded-lg text-left text-xs font-medium transition-all ${
                  formData.primary_goal === opt.value
                    ? 'bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 text-white border border-violet-500/30'
                    : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {formData.primary_goal === 'tell_me' && (
            <div className="mt-3 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <p className="text-xs text-violet-300">
                🤖 <strong>AI Mode:</strong> We'll recommend a goal based on your Long-term Goal (from your profile) balanced against your Daily Readiness.
              </p>
            </div>
          )}
        </div>

        {/* ============================================ */}
        {/* SECTION D: Physical Readiness (Biofeedback) */}
        {/* ============================================ */}
        <div className="mt-6 mb-2">
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">D. Physical Readiness (Biofeedback)</h3>
        </div>

        {/* Warm-up Section */}
        {!warmupComplete ? (
          <div className="rounded-xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-orange-500/5 backdrop-blur-sm p-5">
            {!warmupGenerated ? (
              <>
                {/* Generate Warm-up Button */}
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">🔥</div>
                  <h2 className="text-lg font-bold text-amber-300">Generate Your Warm-up</h2>
                  <p className="text-xs text-slate-400 mt-1">Based on your entries in Sections A-C</p>
                </div>

                {!canGenerateWarmup && (
                  <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xs text-slate-400 text-center">
                      Complete Sections A-C above to generate a personalized warm-up
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={generateWarmup}
                  disabled={!canGenerateWarmup}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-base shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 transition-all"
                >
                  ✨ Generate My Warm-up
                </button>
              </>
            ) : (
              <>
                {/* Generated Warm-up Display */}
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">🔥</div>
                  <h2 className="text-lg font-bold text-amber-300">Your Personalized Warm-up</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {generatedWarmup?.duration} • {generatedWarmup?.intensity} intensity
                  </p>
                </div>

                {/* Warnings */}
                {generatedWarmup?.warnings && generatedWarmup.warnings.length > 0 && (
                  <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <h3 className="text-xs font-semibold text-amber-300 mb-2">Today's Notes</h3>
                    <ul className="text-xs text-amber-200/80 space-y-1">
                      {generatedWarmup.warnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <div className="space-y-3 mb-5">
                  {/* Activation */}
                  <div className="rounded-lg bg-white/5 p-3 border border-white/10">
                    <h3 className="text-xs font-semibold text-amber-300 mb-2">1. General Activation</h3>
                    <ul className="text-xs text-slate-300 space-y-1">
                      {generatedWarmup?.activation.map((item, i) => (
                        <li key={i}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                  
                  {/* Climbing-Specific */}
                  <div className="rounded-lg bg-white/5 p-3 border border-white/10">
                    <h3 className="text-xs font-semibold text-amber-300 mb-2">2. Climbing-Specific</h3>
                    <ul className="text-xs text-slate-300 space-y-1">
                      {generatedWarmup?.climbing.map((item, i) => (
                        <li key={i}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                  
                  {/* Benchmark */}
                  <div className="rounded-lg bg-white/5 p-3 border border-white/10">
                    <h3 className="text-xs font-semibold text-amber-300 mb-2">3. Final Benchmark</h3>
                    <ul className="text-xs text-slate-300 space-y-1">
                      {generatedWarmup?.benchmark.map((item, i) => (
                        <li key={i}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setWarmupComplete(true)}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-base shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-[1.02] transition-all"
                >
                  🔥 I'm Warm - Rate Readiness
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            {/* 1. Warm-up Benchmark RPE */}
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
              <h2 className="text-sm font-semibold mb-2">1. Warm-up Benchmark RPE</h2>
              <p className="text-xs text-slate-400 mb-3">"How did the hardest part of the warm-up feel?" (e.g., last hang or pull-up)</p>
              <div className="grid grid-cols-1 gap-1.5">
                {warmupRpeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, warmup_rpe: opt.value })}
                    className={`py-2 px-3 rounded-lg text-left text-xs font-medium transition-all ${
                      formData.warmup_rpe === opt.value
                        ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-white border border-amber-500/30'
                        : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {formData.warmup_rpe === 'failed' && (
                <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-xs text-red-300">⚠️ Consider scaling back today's session or focusing on technique/recovery.</p>
                </div>
              )}
            </div>

            {/* 2. Warm-up Compliance */}
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
              <h2 className="text-sm font-semibold mb-2">2. Warm-up Compliance</h2>
              <p className="text-xs text-slate-400 mb-3">"Did you modify the recommended warm-up?"</p>
              <div className="grid grid-cols-1 gap-1.5">
                {warmupComplianceOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, warmup_compliance: opt.value })}
                    className={`py-2 px-3 rounded-lg text-left text-xs font-medium transition-all ${
                      formData.warmup_compliance === opt.value
                        ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-white border border-amber-500/30'
                        : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Upper Body Power */}
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
              <h2 className="text-sm font-semibold mb-3">3. Upper Body Power ("Pull" feel)</h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">1 = Heavy/Slow</span>
                  <span className="text-lg font-bold text-amber-400">{formData.upper_body_power}</span>
                  <span className="text-xs text-slate-400">10 = Light/Explosive</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={formData.upper_body_power}
                  onChange={(e) => setFormData({ ...formData, upper_body_power: parseInt(e.target.value) })}
                  className="w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-amber-500 [&::-webkit-slider-thumb]:to-orange-500 [&::-webkit-slider-thumb]:shadow-lg"
                />
              </div>
            </div>

            {/* 4. Shoulder Integrity */}
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
              <h2 className="text-sm font-semibold mb-3">4. Shoulder Integrity</h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">1 = Stiff/Painful</span>
                  <span className="text-lg font-bold text-amber-400">{formData.shoulder_integrity}</span>
                  <span className="text-xs text-slate-400">10 = Mobile/Stable</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={formData.shoulder_integrity}
                  onChange={(e) => setFormData({ ...formData, shoulder_integrity: parseInt(e.target.value) })}
                  className="w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-amber-500 [&::-webkit-slider-thumb]:to-orange-500 [&::-webkit-slider-thumb]:shadow-lg"
                />
              </div>
            </div>

            {/* 5. Leg Springiness */}
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
              <h2 className="text-sm font-semibold mb-3">5. Leg "Springiness" (CNS Readiness)</h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">1 = Heavy/Sluggish</span>
                  <span className="text-lg font-bold text-amber-400">{formData.leg_springiness}</span>
                  <span className="text-xs text-slate-400">10 = Bouncy/Explosive</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={formData.leg_springiness}
                  onChange={(e) => setFormData({ ...formData, leg_springiness: parseInt(e.target.value) })}
                  className="w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-amber-500 [&::-webkit-slider-thumb]:to-orange-500 [&::-webkit-slider-thumb]:shadow-lg"
                />
              </div>
            </div>

            {/* 6. Finger Strength */}
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
              <h2 className="text-sm font-semibold mb-3">6. Finger Strength</h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">1 = Jugs only</span>
                  <span className="text-lg font-bold text-amber-400">{formData.finger_strength}</span>
                  <span className="text-xs text-slate-400">10 = Explosive crimp</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={formData.finger_strength}
                  onChange={(e) => setFormData({ ...formData, finger_strength: parseInt(e.target.value) })}
                  className="w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-amber-500 [&::-webkit-slider-thumb]:to-orange-500 [&::-webkit-slider-thumb]:shadow-lg"
                />
                <div className="flex justify-between text-[10px] text-slate-500 pt-1">
                  <span>Deep jugs/bar hangs</span>
                  <span>Max crimp secure</span>
                </div>
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
          </>
        )}
      </form>
    </div>
  )
}
