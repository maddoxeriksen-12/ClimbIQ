import { useState, useEffect } from 'react'
import { useCustomVariablesStore } from '../stores/customVariablesStore'
import { CustomVariablesSection } from './CustomVariableInput'
import { useAuth } from '../hooks/useAuth'

interface InjuryData {
  location: string
  severity: number
  description: string
}

interface GradePyramidEntry {
  grade: string
  attempts: number
  sends: number
  flashes: number
}

interface ExerciseLog {
  name: string
  sets: number
  reps: string
  weight: string
  rest: string
  rpe: number
}

interface PostSessionData {
  // Core Outcomes
  session_rpe: number
  actual_duration: number

  // Behavioral Proxies
  skipped_planned: boolean
  attempted_harder: boolean
  one_more_try_count: number

  // Fatigue/Recovery
  end_energy: number
  skin_condition: string
  felt_pumped: boolean
  could_do_more: string

  // Pain/Injury
  has_new_pain: boolean
  injuries: InjuryData[]
  pre_existing_pain_status: string

  // Quality/Satisfaction
  goal_progress: string

  // Project Session specific
  project_total_attempts: number
  project_highest_point: string
  project_matched_high_point: boolean
  project_linked_more: boolean
  project_sent: boolean
  project_send_attempts_this_session: number
  project_send_total_attempts: number
  project_fall_location: string
  project_same_crux: boolean
  project_crux_type: string
  project_limiting_factor: string
  project_beta_changes: boolean
  project_beta_notes: string

  // Training Session specific
  training_exercises: ExerciseLog[]
  training_focus_concentration: number
  training_progressed: boolean
  training_regressed: boolean
  training_prs_count: number
  training_pr_details: string

  // Bouldering Session specific
  boulder_pyramid: GradePyramidEntry[]
  boulder_highest_sent: string
  boulder_highest_attempted: string
  boulder_total_attempted: number
  boulder_total_sent: number
  boulder_sent_at_limit: boolean
  boulder_attempted_above_limit: boolean
  boulder_style_breakdown: string

  // Lead Session specific
  lead_routes_attempted: number
  lead_total_pitches: number
  lead_highest_sent: string
  lead_highest_attempted: string
  lead_onsight_count: number
  lead_fall_count: number
  lead_fall_types: string[]
  lead_longest_route: string
  lead_pumped_off: boolean
  lead_rest_time: string
  lead_head_game_falls: boolean
  lead_backed_off: boolean

  // Outdoor Session specific
  outdoor_conditions_vs_expected: string
  outdoor_skin_lasted: boolean
  outdoor_conditions_affected: boolean
  outdoor_conditions_note: string
  outdoor_rock_quality: string

  // Recreational Session specific
  recreational_fun_rating: number
  recreational_standout_moments: string

  // Legacy fields for compatibility
  perceived_exertion: number
  satisfaction: number
  energy_after: number
  total_climbs: number
  hardest_grade: string
  sends: number
  falls: number
  highlights: string
  notes: string
}

interface PostSessionFormProps {
  sessionType: string
  location: string
  sessionId?: string
  plannedDuration?: number
  isOutdoor?: boolean
  startTime?: Date
  isHistorical?: boolean  // For testing/model building - pre-expand time correction
  onSubmit: (data: PostSessionData & { customVariables?: Record<string, number | string | boolean>; timeCorrection?: TimeCorrection }) => Promise<void>
  onCancel: () => void
}

interface TimeCorrection {
  actualStartTime: string
  actualEndTime: string
  correctionReason: string
}

export function PostSessionForm({ sessionType, location, sessionId, plannedDuration = 90, isOutdoor = false, startTime, isHistorical = false, onSubmit, onCancel }: PostSessionFormProps) {
  const { user } = useAuth()
  const { getActiveVariables, recordEntry } = useCustomVariablesStore()

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Get custom variables for this user
  const customVariables = user ? getActiveVariables('post_session', user.id, user.user_metadata?.coach_id) : []
  const [customValues, setCustomValues] = useState<Record<string, number | string | boolean>>({})
  
  // Time correction state - auto-expand for historical entries
  const [showTimeCorrection, setShowTimeCorrection] = useState(isHistorical)
  const defaultStartTime = startTime || new Date()
  const [actualStartTime, setActualStartTime] = useState(
    defaultStartTime.toISOString().slice(0, 16) // Format: YYYY-MM-DDTHH:MM
  )
  const [actualEndTime, setActualEndTime] = useState(
    new Date().toISOString().slice(0, 16)
  )
  const [correctionReason, setCorrectionReason] = useState('')

  const [formData, setFormData] = useState<PostSessionData>({
    // Core Outcomes
    session_rpe: 4,
    actual_duration: plannedDuration,

    // Behavioral Proxies
    skipped_planned: false,
    attempted_harder: false,
    one_more_try_count: 0,

    // Fatigue/Recovery
    end_energy: 4,
    skin_condition: 'slightly_worn',
    felt_pumped: false,
    could_do_more: 'probably_no',

    // Pain/Injury
    has_new_pain: false,
    injuries: [],
    pre_existing_pain_status: 'same',

    // Quality/Satisfaction
    goal_progress: '',

    // Project Session specific
    project_total_attempts: 0,
    project_highest_point: '',
    project_matched_high_point: false,
    project_linked_more: false,
    project_sent: false,
    project_send_attempts_this_session: 0,
    project_send_total_attempts: 0,
    project_fall_location: '',
    project_same_crux: false,
    project_crux_type: '',
    project_limiting_factor: '',
    project_beta_changes: false,
    project_beta_notes: '',

    // Training Session specific
    training_exercises: [],
    training_focus_concentration: 4,
    training_progressed: false,
    training_regressed: false,
    training_prs_count: 0,
    training_pr_details: '',

    // Bouldering Session specific
    boulder_pyramid: [],
    boulder_highest_sent: '',
    boulder_highest_attempted: '',
    boulder_total_attempted: 0,
    boulder_total_sent: 0,
    boulder_sent_at_limit: false,
    boulder_attempted_above_limit: false,
    boulder_style_breakdown: 'mixed',

    // Lead Session specific
    lead_routes_attempted: 0,
    lead_total_pitches: 0,
    lead_highest_sent: '',
    lead_highest_attempted: '',
    lead_onsight_count: 0,
    lead_fall_count: 0,
    lead_fall_types: [],
    lead_longest_route: '',
    lead_pumped_off: false,
    lead_rest_time: 'medium',
    lead_head_game_falls: false,
    lead_backed_off: false,

    // Outdoor Session specific
    outdoor_conditions_vs_expected: 'as_expected',
    outdoor_skin_lasted: true,
    outdoor_conditions_affected: false,
    outdoor_conditions_note: '',
    outdoor_rock_quality: 'average',

    // Recreational Session specific
    recreational_fun_rating: 4,
    recreational_standout_moments: '',

    // Legacy fields
    perceived_exertion: 5,
    satisfaction: 5,
    energy_after: 5,
    total_climbs: 0,
    hardest_grade: '',
    sends: 0,
    falls: 0,
    highlights: '',
    notes: '',
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  const painLocations = [
    { value: 'fingers', label: '🤌 Fingers' },
    { value: 'hands', label: '✋ Hands/Wrists' },
    { value: 'forearms', label: '💪 Forearms' },
    { value: 'elbows', label: '🦾 Elbows' },
    { value: 'shoulders', label: '🙆 Shoulders' },
    { value: 'back', label: '🔙 Back' },
    { value: 'neck', label: '🦒 Neck' },
    { value: 'hips', label: '🦵 Hips' },
    { value: 'knees', label: '🦿 Knees' },
    { value: 'ankles', label: '🦶 Ankles/Feet' },
    { value: 'other', label: '📍 Other' },
  ]

  const addInjury = () => {
    setFormData({
      ...formData,
      injuries: [...formData.injuries, { location: '', severity: 3, description: '' }],
    })
  }

  const updateInjury = (index: number, field: keyof InjuryData, value: string | number) => {
    const updatedInjuries = [...formData.injuries]
    updatedInjuries[index] = { ...updatedInjuries[index], [field]: value }
    setFormData({ ...formData, injuries: updatedInjuries })
  }

  const removeInjury = (index: number) => {
    setFormData({
      ...formData,
      injuries: formData.injuries.filter((_, i) => i !== index),
    })
  }

  // Exercise log helpers
  const addExercise = () => {
    setFormData({
      ...formData,
      training_exercises: [...formData.training_exercises, { name: '', sets: 0, reps: '', weight: '', rest: '', rpe: 5 }],
    })
  }

  const updateExercise = (index: number, field: keyof ExerciseLog, value: string | number) => {
    const updated = [...formData.training_exercises]
    updated[index] = { ...updated[index], [field]: value }
    setFormData({ ...formData, training_exercises: updated })
  }

  const removeExercise = (index: number) => {
    setFormData({
      ...formData,
      training_exercises: formData.training_exercises.filter((_, i) => i !== index),
    })
  }

  // Toggle fall type for lead climbing
  const toggleFallType = (type: string) => {
    const current = formData.lead_fall_types
    if (current.includes(type)) {
      setFormData({ ...formData, lead_fall_types: current.filter(t => t !== type) })
    } else {
      setFormData({ ...formData, lead_fall_types: [...current, type] })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      // Record custom variable entries for correlation analysis
      const sid = sessionId || `session_${Date.now()}`
      Object.entries(customValues).forEach(([variableId, value]) => {
        recordEntry({
          variableId,
          value,
          sessionId: sid,
        })
      })

      // Sync legacy fields
      const syncedData = {
        ...formData,
        perceived_exertion: formData.session_rpe,
        energy_after: formData.end_energy * 2, // Convert 1-5 to 1-10 scale
      }

      // Include time correction if user modified times
      const timeCorrection = showTimeCorrection ? {
        actualStartTime,
        actualEndTime,
        correctionReason,
      } : undefined

      await onSubmit({ ...syncedData, customVariables: customValues, timeCorrection })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Calculate duration vs planned percentage (auto-calculated, shown but not asked)
  const durationVsPlanned = plannedDuration > 0 
    ? Math.round((formData.actual_duration / plannedDuration) * 100) 
    : 100

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header with session info */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium">
            Session Complete
          </span>
        </div>
        <h1 className="text-3xl font-bold mb-2">Finish Session</h1>
        <p className="text-slate-400">
          Great climbing at{' '}
          <span className="text-white">{location || 'your location'}</span>! Let's log how it went.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Time Correction Banner */}
        <div className="rounded-2xl border border-slate-500/20 bg-slate-500/5 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">⏰</span>
              <div>
                <p className="text-sm font-medium">Need to adjust session times?</p>
                <p className="text-xs text-slate-400">
                  {showTimeCorrection 
                    ? 'Enter the correct start and end times below'
                    : 'Click here if you forgot to log or left the app running'
                  }
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowTimeCorrection(!showTimeCorrection)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                showTimeCorrection
                  ? 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {showTimeCorrection ? 'Cancel' : 'Adjust Times'}
            </button>
          </div>

          {showTimeCorrection && (
            <div className="mt-4 pt-4 border-t border-white/10 space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Actual Start Time</label>
                  <input
                    type="datetime-local"
                    value={actualStartTime}
                    onChange={(e) => setActualStartTime(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-slate-500/50 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Actual End Time</label>
                  <input
                    type="datetime-local"
                    value={actualEndTime}
                    onChange={(e) => setActualEndTime(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-slate-500/50 transition-all"
                  />
                </div>
              </div>
              
              {/* Auto-calculate duration from corrected times */}
              {actualStartTime && actualEndTime && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-emerald-400">📊</span>
                  <span className="text-sm text-emerald-300">
                    Calculated duration: {Math.round((new Date(actualEndTime).getTime() - new Date(actualStartTime).getTime()) / 60000)} minutes
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Reason for correction <span className="text-slate-500">(optional)</span>
                </label>
                <select
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-slate-500/50 transition-all"
                >
                  <option value="">Select a reason...</option>
                  <option value="forgot_to_start">Forgot to start session</option>
                  <option value="forgot_to_end">Forgot to end session / left app running</option>
                  <option value="logged_later">Logging session later in the day</option>
                  <option value="wrong_time">Started at wrong time</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Core Outcomes */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
          <h2 className="font-semibold mb-6">Core Outcomes</h2>
          <div className="space-y-6">
            {/* Session RPE */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-200">
                  <span>💦</span>
                  How hard did this session feel overall?
                </label>
                <span className="text-sm font-semibold text-emerald-400">{formData.session_rpe}/8</span>
              </div>
              <input
                type="range"
                min="1"
                max="8"
                value={formData.session_rpe}
                onChange={(e) => setFormData({ ...formData, session_rpe: parseInt(e.target.value) })}
                className="w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-emerald-500 [&::-webkit-slider-thumb]:to-cyan-500 [&::-webkit-slider-thumb]:shadow-lg"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>Very easy</span>
                <span>Maximum effort</span>
              </div>
            </div>

            {/* Actual Duration */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <span>⏱️</span>
                Actual Session Duration
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="5"
                  max="480"
                  value={formData.actual_duration}
                  onChange={(e) => setFormData({ ...formData, actual_duration: parseInt(e.target.value) || 0 })}
                  className="w-24 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                />
                <span className="text-sm text-slate-400">minutes</span>
                <span className={`ml-auto px-2 py-1 rounded-lg text-xs font-medium ${
                  durationVsPlanned >= 100 
                    ? 'bg-emerald-500/20 text-emerald-300' 
                    : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {durationVsPlanned}% of planned
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* Behavioral Proxies */}
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 backdrop-blur-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🧠</span>
            <h2 className="font-semibold">Motivation & Engagement</h2>
          </div>
          <div className="space-y-4">
            {/* Skipped planned */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
              <div>
                <p className="font-medium text-sm">Did you skip any planned climbs or exercises?</p>
                <p className="text-xs text-slate-400">Routes/problems you intended to do but didn't</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, skipped_planned: !formData.skipped_planned })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  formData.skipped_planned ? 'bg-amber-500' : 'bg-white/20'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${
                  formData.skipped_planned ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Attempted harder */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
              <div>
                <p className="font-medium text-sm">Did you attempt anything harder than planned?</p>
                <p className="text-xs text-slate-400">Pushed beyond your original intentions</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, attempted_harder: !formData.attempted_harder })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  formData.attempted_harder ? 'bg-emerald-500' : 'bg-white/20'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${
                  formData.attempted_harder ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* One more try count */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <span>🔄</span>
                "One more try" attempts after planning to stop
              </label>
              <div className="flex gap-2">
                {[0, 1, 2, 3, 4, '5+'].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setFormData({ ...formData, one_more_try_count: typeof count === 'number' ? count : 5 })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      formData.one_more_try_count === (typeof count === 'number' ? count : 5)
                        ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                        : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Fatigue/Recovery Indicators */}
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 backdrop-blur-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🔋</span>
            <h2 className="font-semibold">Fatigue & Recovery</h2>
          </div>
          <div className="space-y-5">
            {/* End energy */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <span>⚡</span>
                  End-of-session energy
                </label>
                <span className="text-sm font-semibold text-cyan-400">{formData.end_energy}/8</span>
              </div>
              <input
                type="range"
                min="1"
                max="8"
                value={formData.end_energy}
                onChange={(e) => setFormData({ ...formData, end_energy: parseInt(e.target.value) })}
                className="w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-cyan-500 [&::-webkit-slider-thumb]:to-teal-500 [&::-webkit-slider-thumb]:shadow-lg"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>Completely drained</span>
                <span>Still have gas</span>
              </div>
            </div>

            {/* Skin condition */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <span>🤌</span>
                Skin Condition
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { value: 'fresh', label: '✨ Fresh', color: 'emerald' },
                  { value: 'slightly_worn', label: '👍 Slightly Worn', color: 'cyan' },
                  { value: 'very_worn', label: '😬 Very Worn', color: 'amber' },
                  { value: 'split_tear', label: '🩹 Split/Tear', color: 'red' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, skin_condition: option.value })}
                    className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      formData.skin_condition === option.value
                        ? `bg-${option.color}-500/20 text-${option.color}-300 border border-${option.color}-500/30`
                        : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Felt pumped */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
              <div>
                <p className="font-medium text-sm">Did you feel "pumped out" at any point?</p>
                <p className="text-xs text-slate-400">Forearms so pumped you couldn't hold on</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, felt_pumped: !formData.felt_pumped })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  formData.felt_pumped ? 'bg-cyan-500' : 'bg-white/20'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${
                  formData.felt_pumped ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Could do more */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <span>💪</span>
                Could you have done more?
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 'definitely_no', label: 'Definitely No' },
                  { value: 'probably_no', label: 'Probably No' },
                  { value: 'probably_yes', label: 'Probably Yes' },
                  { value: 'definitely_yes', label: 'Definitely Yes' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, could_do_more: option.value })}
                    className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                      formData.could_do_more === option.value
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Pain & Injury Section */}
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🩹</span>
            <h2 className="font-semibold">Pain & Injury Check</h2>
          </div>
          
          {/* New pain toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 mb-4">
            <div>
              <p className="font-medium text-sm">Any new pain or injury during this session?</p>
              <p className="text-xs text-slate-400">Track tweaks, strains, or new discomfort</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const newHasPain = !formData.has_new_pain
                setFormData({
                  ...formData,
                  has_new_pain: newHasPain,
                  injuries: newHasPain && formData.injuries.length === 0 
                    ? [{ location: '', severity: 3, description: '' }] 
                    : formData.injuries,
                })
              }}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                formData.has_new_pain ? 'bg-amber-500' : 'bg-white/20'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${
                formData.has_new_pain ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Injury details */}
          {formData.has_new_pain && (
            <div className="space-y-4 mb-4 animate-in fade-in slide-in-from-top-2 duration-200">
              {formData.injuries.map((injury, index) => (
                <div key={index} className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-amber-200">
                      Injury {formData.injuries.length > 1 ? `#${index + 1}` : ''}
                    </span>
                    {formData.injuries.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeInjury(index)}
                        className="text-xs text-slate-400 hover:text-red-400 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Location</label>
                      <select
                        value={injury.location}
                        onChange={(e) => updateInjury(index, 'location', e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                      >
                        <option value="">Select...</option>
                        {painLocations.map((loc) => (
                          <option key={loc.value} value={loc.value}>{loc.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Severity: {injury.severity}/8</label>
                      <input
                        type="range"
                        min="1"
                        max="8"
                        value={injury.severity}
                        onChange={(e) => updateInjury(index, 'severity', parseInt(e.target.value))}
                        className="w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Description</label>
                    <input
                      type="text"
                      value={injury.description}
                      onChange={(e) => updateInjury(index, 'description', e.target.value)}
                      placeholder="What happened?"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addInjury}
                className="w-full py-2 rounded-xl border border-dashed border-white/20 text-sm text-slate-400 hover:text-white hover:border-white/40 transition-colors"
              >
                + Add another injury
              </button>
            </div>
          )}

          {/* Pre-existing pain status */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <span>📊</span>
              Pre-existing pain/injury status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'better', label: '📈 Better', color: 'emerald' },
                { value: 'same', label: '➡️ Same', color: 'slate' },
                { value: 'worse', label: '📉 Worse', color: 'red' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, pre_existing_pain_status: option.value })}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    formData.pre_existing_pain_status === option.value
                      ? option.color === 'emerald' 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : option.color === 'red'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                        : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                      : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* SESSION-TYPE SPECIFIC SECTIONS */}
        {/* ============================================ */}

        {/* PROJECT SESSION SPECIFIC */}
        {sessionType === 'project' && (
          <>
            <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 backdrop-blur-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🎯</span>
                <h2 className="font-semibold">Project Progress</h2>
              </div>
              <div className="space-y-4">
                {/* Quantitative */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Total attempts today</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.project_total_attempts}
                      onChange={(e) => setFormData({ ...formData, project_total_attempts: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Highest point reached (move # or %)</label>
                    <input
                      type="text"
                      value={formData.project_highest_point}
                      onChange={(e) => setFormData({ ...formData, project_highest_point: e.target.value })}
                      placeholder="e.g., Move 12 or 75%"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    />
                  </div>
                </div>

                {/* Progress toggles */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-sm text-slate-300">Matched/exceeded high point?</span>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, project_matched_high_point: !formData.project_matched_high_point })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${formData.project_matched_high_point ? 'bg-emerald-500' : 'bg-white/20'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${formData.project_matched_high_point ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-sm text-slate-300">Linked more moves?</span>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, project_linked_more: !formData.project_linked_more })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${formData.project_linked_more ? 'bg-emerald-500' : 'bg-white/20'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${formData.project_linked_more ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>

                {/* Send! */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🎉</span>
                      <span className="font-semibold">Did you send?!</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, project_sent: !formData.project_sent })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${formData.project_sent ? 'bg-gradient-to-r from-emerald-500 to-cyan-500' : 'bg-white/20'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${formData.project_sent ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  {formData.project_sent && (
                    <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">Attempts this session</label>
                        <input
                          type="number"
                          min="1"
                          value={formData.project_send_attempts_this_session}
                          onChange={(e) => setFormData({ ...formData, project_send_attempts_this_session: parseInt(e.target.value) || 0 })}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">Total attempts (all sessions)</label>
                        <input
                          type="number"
                          min="1"
                          value={formData.project_send_total_attempts}
                          onChange={(e) => setFormData({ ...formData, project_send_total_attempts: parseInt(e.target.value) || 0 })}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Crux Analysis */}
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 backdrop-blur-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🔍</span>
                <h2 className="font-semibold">Crux Analysis</h2>
              </div>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Where did most falls occur?</label>
                    <input
                      type="text"
                      value={formData.project_fall_location}
                      onChange={(e) => setFormData({ ...formData, project_fall_location: e.target.value })}
                      placeholder="Move # or section"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-sm text-slate-300">Same crux as last session?</span>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, project_same_crux: !formData.project_same_crux })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${formData.project_same_crux ? 'bg-rose-500' : 'bg-white/20'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${formData.project_same_crux ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Crux type</label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {['power', 'endurance', 'technical', 'mental', 'conditions'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({ ...formData, project_crux_type: type })}
                        className={`py-2 px-3 rounded-lg text-xs font-medium capitalize transition-all ${
                          formData.project_crux_type === type
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {type === 'mental' ? '🧠 Mental/Fear' : type === 'conditions' ? '🌡️ Conditions' : type === 'power' ? '💪 Power' : type === 'endurance' ? '🔄 Endurance' : '🎯 Technical'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">What limited you most today?</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'finger_strength', label: '🤌 Finger strength' },
                      { value: 'power', label: '💥 Power' },
                      { value: 'endurance', label: '🔄 Endurance' },
                      { value: 'technique', label: '🎯 Technique' },
                      { value: 'conditions', label: '🌡️ Conditions' },
                      { value: 'skin', label: '🤲 Skin' },
                      { value: 'mental', label: '🧠 Mental/Fear' },
                      { value: 'recovery', label: '😴 Recovery' },
                      { value: 'beta', label: '❓ Beta uncertainty' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, project_limiting_factor: opt.value })}
                        className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                          formData.project_limiting_factor === opt.value
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-300">Beta changes made?</label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, project_beta_changes: !formData.project_beta_changes })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${formData.project_beta_changes ? 'bg-rose-500' : 'bg-white/20'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${formData.project_beta_changes ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  {formData.project_beta_changes && (
                    <input
                      type="text"
                      value={formData.project_beta_notes}
                      onChange={(e) => setFormData({ ...formData, project_beta_notes: e.target.value })}
                      placeholder="What did you change?"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 animate-in fade-in"
                    />
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* TRAINING SESSION SPECIFIC */}
        {sessionType === 'training' && (
          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 backdrop-blur-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🏋️</span>
              <h2 className="font-semibold">Training Log</h2>
            </div>
            <div className="space-y-4">
              {/* Exercise Log */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-300">Exercises Completed</label>
                  <button
                    type="button"
                    onClick={addExercise}
                    className="text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    + Add exercise
                  </button>
                </div>
                
                {formData.training_exercises.length === 0 && (
                  <button
                    type="button"
                    onClick={addExercise}
                    className="w-full py-4 rounded-xl border border-dashed border-white/20 text-sm text-slate-400 hover:text-white hover:border-white/40 transition-colors"
                  >
                    + Add your first exercise
                  </button>
                )}

                {formData.training_exercises.map((exercise, index) => (
                  <div key={index} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-indigo-300">Exercise {index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeExercise(index)}
                        className="text-xs text-slate-400 hover:text-red-400"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        type="text"
                        value={exercise.name}
                        onChange={(e) => updateExercise(index, 'name', e.target.value)}
                        placeholder="Exercise name"
                        className="col-span-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={exercise.sets}
                          onChange={(e) => updateExercise(index, 'sets', parseInt(e.target.value) || 0)}
                          placeholder="Sets"
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                        />
                        <input
                          type="text"
                          value={exercise.reps}
                          onChange={(e) => updateExercise(index, 'reps', e.target.value)}
                          placeholder="Reps/Time"
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={exercise.weight}
                          onChange={(e) => updateExercise(index, 'weight', e.target.value)}
                          placeholder="Weight"
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                        />
                        <input
                          type="text"
                          value={exercise.rest}
                          onChange={(e) => updateExercise(index, 'rest', e.target.value)}
                          placeholder="Rest"
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Exercise RPE</span>
                        <span className="text-indigo-400">{exercise.rpe}/8</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="8"
                        value={exercise.rpe}
                        onChange={(e) => updateExercise(index, 'rpe', parseInt(e.target.value))}
                        className="w-full h-1.5 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Training Quality */}
              <div className="pt-4 border-t border-white/10 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium text-slate-300">Focus/concentration during training</label>
                    <span className="text-sm text-indigo-400">{formData.training_focus_concentration}/8</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    value={formData.training_focus_concentration}
                    onChange={(e) => setFormData({ ...formData, training_focus_concentration: parseInt(e.target.value) })}
                    className="w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-sm text-slate-300">Progressed any exercise?</span>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, training_progressed: !formData.training_progressed })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${formData.training_progressed ? 'bg-emerald-500' : 'bg-white/20'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${formData.training_progressed ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-sm text-slate-300">Regressed any exercise?</span>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, training_regressed: !formData.training_regressed })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${formData.training_regressed ? 'bg-amber-500' : 'bg-white/20'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${formData.training_regressed ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">PRs achieved today</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.training_prs_count}
                      onChange={(e) => setFormData({ ...formData, training_prs_count: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
                    />
                  </div>
                  {formData.training_prs_count > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">PR details</label>
                      <input
                        type="text"
                        value={formData.training_pr_details}
                        onChange={(e) => setFormData({ ...formData, training_pr_details: e.target.value })}
                        placeholder="What did you PR?"
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LEAD SESSION SPECIFIC */}
        {sessionType === 'lead' && (
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 backdrop-blur-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🧗</span>
              <h2 className="font-semibold">Lead Climbing Stats</h2>
            </div>
            <div className="space-y-4">
              {/* Volume Tracking */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Routes attempted</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.lead_routes_attempted}
                    onChange={(e) => setFormData({ ...formData, lead_routes_attempted: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Total pitches/laps</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.lead_total_pitches}
                    onChange={(e) => setFormData({ ...formData, lead_total_pitches: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
                  />
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Highest grade sent</label>
                  <select
                    value={formData.lead_highest_sent}
                    onChange={(e) => setFormData({ ...formData, lead_highest_sent: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
                  >
                    <option value="">Select...</option>
                    {['5.6', '5.7', '5.8', '5.9', '5.10a', '5.10b', '5.10c', '5.10d', '5.11a', '5.11b', '5.11c', '5.11d', '5.12a', '5.12b', '5.12c', '5.12d', '5.13a+'].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Highest grade attempted</label>
                  <select
                    value={formData.lead_highest_attempted}
                    onChange={(e) => setFormData({ ...formData, lead_highest_attempted: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
                  >
                    <option value="">Select...</option>
                    {['5.6', '5.7', '5.8', '5.9', '5.10a', '5.10b', '5.10c', '5.10d', '5.11a', '5.11b', '5.11c', '5.11d', '5.12a', '5.12b', '5.12c', '5.12d', '5.13a+'].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Onsights</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.lead_onsight_count}
                    onChange={(e) => setFormData({ ...formData, lead_onsight_count: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Total falls</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.lead_fall_count}
                    onChange={(e) => setFormData({ ...formData, lead_fall_count: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
                  />
                </div>
              </div>

              {/* Fall Types */}
              {formData.lead_fall_count > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Fall types (select all that apply)</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'pumped', label: '💪 Pumped' },
                      { value: 'technical', label: '🎯 Technical' },
                      { value: 'mental', label: '🧠 Mental' },
                    ].map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => toggleFallType(type.value)}
                        className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                          formData.lead_fall_types.includes(type.value)
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Endurance Indicators */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Longest route (pitches or meters)</label>
                  <input
                    type="text"
                    value={formData.lead_longest_route}
                    onChange={(e) => setFormData({ ...formData, lead_longest_route: e.target.value })}
                    placeholder="e.g., 3 pitches or 30m"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-sm text-slate-300">Got pumped off any route?</span>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, lead_pumped_off: !formData.lead_pumped_off })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${formData.lead_pumped_off ? 'bg-amber-500' : 'bg-white/20'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${formData.lead_pumped_off ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Rest time between attempts</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'short', label: '⚡ Short (<5min)' },
                      { value: 'medium', label: '⏱️ Medium (5-15min)' },
                      { value: 'long', label: '🕐 Long (15+min)' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, lead_rest_time: opt.value })}
                        className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                          formData.lead_rest_time === opt.value
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mental Game */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-sm text-slate-300">Head game falls?</span>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, lead_head_game_falls: !formData.lead_head_game_falls })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${formData.lead_head_game_falls ? 'bg-amber-500' : 'bg-white/20'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${formData.lead_head_game_falls ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-sm text-slate-300">Backed off due to fear?</span>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, lead_backed_off: !formData.lead_backed_off })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${formData.lead_backed_off ? 'bg-amber-500' : 'bg-white/20'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${formData.lead_backed_off ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* OUTDOOR SESSION SPECIFIC */}
        {isOutdoor && sessionType !== 'recreational' && (
          <div className="rounded-2xl border border-lime-500/20 bg-lime-500/5 backdrop-blur-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🏔️</span>
              <h2 className="font-semibold">Outdoor Conditions</h2>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Actual conditions vs expected</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'better', label: '📈 Better' },
                    { value: 'as_expected', label: '✅ As Expected' },
                    { value: 'worse', label: '📉 Worse' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, outdoor_conditions_vs_expected: opt.value })}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        formData.outdoor_conditions_vs_expected === opt.value
                          ? opt.value === 'better' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : opt.value === 'worse' ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-lime-500/20 text-lime-300 border border-lime-500/30'
                          : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-sm text-slate-300">Skin lasted?</span>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, outdoor_skin_lasted: !formData.outdoor_skin_lasted })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${formData.outdoor_skin_lasted ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${formData.outdoor_skin_lasted ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-sm text-slate-300">Conditions affected performance?</span>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, outdoor_conditions_affected: !formData.outdoor_conditions_affected })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${formData.outdoor_conditions_affected ? 'bg-amber-500' : 'bg-white/20'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${formData.outdoor_conditions_affected ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              {formData.outdoor_conditions_affected && (
                <div className="space-y-2 animate-in fade-in">
                  <label className="text-sm font-medium text-slate-300">How did conditions affect you?</label>
                  <input
                    type="text"
                    value={formData.outdoor_conditions_note}
                    onChange={(e) => setFormData({ ...formData, outdoor_conditions_note: e.target.value })}
                    placeholder="e.g., Too humid, holds were greasy"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Rock quality (if new area)</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'solid', label: '💎 Solid' },
                    { value: 'average', label: '🪨 Average' },
                    { value: 'chossy', label: '⚠️ Chossy' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, outdoor_rock_quality: opt.value })}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        formData.outdoor_rock_quality === opt.value
                          ? 'bg-lime-500/20 text-lime-300 border border-lime-500/30'
                          : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RECREATIONAL SESSION - MINIMAL */}
        {sessionType === 'recreational' && (
          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 backdrop-blur-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🎉</span>
              <h2 className="font-semibold">Fun Factor</h2>
            </div>
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-300">Did you have fun?</label>
                  <span className="text-sm font-semibold text-yellow-400">{formData.recreational_fun_rating}/5</span>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setFormData({ ...formData, recreational_fun_rating: rating })}
                      className={`flex-1 py-3 rounded-xl text-2xl transition-all ${
                        formData.recreational_fun_rating >= rating
                          ? 'bg-yellow-500/20 border border-yellow-500/30'
                          : 'bg-white/5 border border-white/10 opacity-40'
                      }`}
                    >
                      {rating === 1 ? '😐' : rating === 2 ? '🙂' : rating === 3 ? '😊' : rating === 4 ? '😄' : '🤩'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Any standout moments? <span className="text-slate-500">(optional)</span></label>
                <input
                  type="text"
                  value={formData.recreational_standout_moments}
                  onChange={(e) => setFormData({ ...formData, recreational_standout_moments: e.target.value })}
                  placeholder="What made today memorable?"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                />
              </div>
            </div>
          </div>
        )}

        {/* Custom Variables Section */}
        {customVariables.length > 0 && (
          <CustomVariablesSection
            variables={customVariables}
            values={customValues}
            onChange={(variableId, value) => 
              setCustomValues((prev) => ({ ...prev, [variableId]: value }))
            }
            formType="post_session"
          />
        )}

        {/* Additional Notes */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
          <h2 className="font-semibold mb-4">Additional Notes</h2>
          <div className="space-y-2">
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Anything else worth noting... (techniques tried, beta learned, highlights, etc.)"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all h-24 resize-none"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-4 rounded-xl border border-white/10 text-white font-medium hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-[2] py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-semibold text-lg shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100 transition-all duration-200"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Saving...
              </span>
            ) : (
              '✅ Complete Session'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
