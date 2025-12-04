import { useEffect, useState } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { useRecommendationStore } from '../stores/recommendationStore'
import { useCustomVariablesStore } from '../stores/customVariablesStore'
import { CustomVariablesSection } from './CustomVariableInput'
import { useAuth } from '../hooks/useAuth'

interface InjuryData {
  location: string
  severity: number
  description: string
}

interface PreSessionData {
  // Mental/Energy State
  energy_level: number
  motivation: number
  stress_level: number
  sleep_quality: number
  sleep_hours: number
  
  // Physical Readiness
  hours_since_meal: string
  hydration: string
  days_since_last_session: number
  days_since_rest_day: number
  muscle_soreness: string
  soreness_locations: string[]
  
  // Contextual
  session_start_time: string
  planned_duration: number
  had_caffeine: boolean
  caffeine_amount: string
  had_alcohol: boolean
  alcohol_amount: string
  
  // Mental/Intent
  primary_goal: string
  
  // Pain & Injury
  soreness: Record<string, number>
  has_pain: boolean
  injuries: InjuryData[]
  notes: string

  // Indoor-specific
  is_indoor: boolean
  gym_name: string
  wall_reset_recently: string // 'yes' | 'no' | 'unknown'

  // Outdoor-specific
  crag_name: string
  rock_type: string
  conditions_rating: number
  temperature: string
  humidity: string
  recent_precipitation: boolean

  // Project-specific
  is_project_session: boolean
  project_name: string
  project_session_number: number
  current_high_point: string
  project_goal: string
  section_focus: string

  // Training-specific
  training_focuses: string[]
  planned_exercises: string
  target_training_time: number

  // Bouldering-specific
  boulder_grade_range_min: string
  boulder_grade_range_max: string
  boulder_session_focus: string

  // Lead-specific
  lead_grade_range_min: string
  lead_grade_range_max: string
  lead_session_focus: string
  belay_type: string

  // Recreational
  just_for_fun: string
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

// RatingSlider component - defined outside to prevent recreation on each render
function RatingSlider({
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
        <span className="text-sm font-semibold text-fuchsia-400">{value}/8</span>
      </div>
      <input
        type="range"
        min="1"
        max="8"
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

  // Get custom variables for this user
  const customVariables = user ? getActiveVariables('pre_session', user.id, user.user_metadata?.coach_id) : []
  const [customValues, setCustomValues] = useState<Record<string, number | string | boolean>>({})

  const [formData, setFormData] = useState<PreSessionData>({
    // Mental/Energy State
    energy_level: 4,
    motivation: 4,
    stress_level: 4,
    sleep_quality: 4,
    sleep_hours: 7,
    
    // Physical Readiness
    hours_since_meal: '2-4hr',
    hydration: 'adequate',
    days_since_last_session: 1,
    days_since_rest_day: 2,
    muscle_soreness: 'none',
    soreness_locations: [],
    
    // Contextual
    session_start_time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    planned_duration: 90,
    had_caffeine: false,
    caffeine_amount: '',
    had_alcohol: false,
    alcohol_amount: '',
    
    // Mental/Intent
    primary_goal: '',
    
    // Pain & Injury
    soreness: {},
    has_pain: false,
    injuries: [],
    notes: '',

    // Indoor-specific
    is_indoor: true,
    gym_name: '',
    wall_reset_recently: 'unknown',

    // Outdoor-specific
    crag_name: '',
    rock_type: '',
    conditions_rating: 4,
    temperature: '',
    humidity: 'medium',
    recent_precipitation: false,

    // Project-specific
    is_project_session: false,
    project_name: '',
    project_session_number: 1,
    current_high_point: '',
    project_goal: '',
    section_focus: '',

    // Training-specific
    training_focuses: [],
    planned_exercises: '',
    target_training_time: 60,

    // Bouldering-specific
    boulder_grade_range_min: 'V2',
    boulder_grade_range_max: 'V5',
    boulder_session_focus: '',

    // Lead-specific
    lead_grade_range_min: '5.9',
    lead_grade_range_max: '5.11a',
    lead_session_focus: '',
    belay_type: 'partner',

    // Recreational
    just_for_fun: '',
  })

  const painLocations = [
    { value: 'fingers', label: '🤌 Fingers', icon: '🤌' },
    { value: 'hands', label: '✋ Hands/Wrists', icon: '✋' },
    { value: 'forearms', label: '💪 Forearms', icon: '💪' },
    { value: 'elbows', label: '🦾 Elbows', icon: '🦾' },
    { value: 'shoulders', label: '🙆 Shoulders', icon: '🙆' },
    { value: 'back', label: '🔙 Back', icon: '🔙' },
    { value: 'neck', label: '🦒 Neck', icon: '🦒' },
    { value: 'hips', label: '🦵 Hips', icon: '🦵' },
    { value: 'knees', label: '🦿 Knees', icon: '🦿' },
    { value: 'ankles', label: '🦶 Ankles/Feet', icon: '🦶' },
    { value: 'other', label: '📍 Other', icon: '📍' },
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

  const [sessionType, setSessionType] = useState('bouldering')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Derive location from gym_name or crag_name
  const location = formData.is_indoor ? formData.gym_name : formData.crag_name

  useEffect(() => {
    void fetchPreSessionRecommendations()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    let sessionId = `session_${Date.now()}`

    try {
      // Try to save to backend, but don't block on failure
      const session = await createSession({
      session_date: new Date().toISOString().split('T')[0],
      session_type: sessionType,
      location,
        pre_session: { ...formData, customVariables: customValues },
      })
      if (session?.id) {
        sessionId = session.id
      }
    } catch (error) {
      // Log error but continue - we'll save locally and sync later
      console.warn('Failed to save session to server, continuing locally:', error)
    }
    
    // Record custom variable entries for correlation analysis
    Object.entries(customValues).forEach(([variableId, value]) => {
      recordEntry({
        variableId,
        value,
        sessionId,
      })
    })
    
    // Always transition to analysis/recommendations
    if (onComplete) {
      onComplete({ 
        sessionType, 
        location, 
        isOutdoor: !formData.is_indoor,
        plannedDuration: formData.planned_duration,
        preSessionData: { ...formData, customVariables: customValues },
      })
    }
    
    setIsSubmitting(false)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Start New Session</h1>
        <p className="text-slate-400">Log your pre-climb state for personalized insights.</p>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="mb-8 rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">💡</span>
            <h3 className="font-semibold">Pre-Session Tips</h3>
          </div>
          <div className="space-y-3">
          {recommendations.map((rec) => (
              <div key={rec.id} className="p-4 rounded-xl bg-white/5 border border-white/5">
                <p className="font-medium text-sm">{rec.title}</p>
                <p className="text-sm text-slate-400 mt-1">{rec.description}</p>
              {rec.confidence_score && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500"
                        style={{ width: `${rec.confidence_score * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500">
                      {(rec.confidence_score * 100).toFixed(0)}%
                    </span>
                  </div>
              )}
            </div>
          ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Session Details */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
          <h2 className="font-semibold mb-4">Session Details</h2>
          <div className="space-y-4">
            {/* Indoor/Outdoor Toggle */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Environment</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_indoor: true })}
                  className={`py-3 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    formData.is_indoor
                      ? 'bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/20 text-white border border-fuchsia-500/30'
                      : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  🏢 Indoor
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_indoor: false })}
                  className={`py-3 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    !formData.is_indoor
                      ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-white border border-emerald-500/30'
                      : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  🏔️ Outdoor
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Session Type</label>
          <select
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 transition-all"
                >
                  <option value="bouldering">🪨 Bouldering</option>
                  <option value="lead">🧗 Lead / Sport Climbing</option>
                  {!formData.is_indoor && <option value="trad">⛰️ Trad Climbing</option>}
                  {formData.is_indoor && <option value="training">🏋️ Training</option>}
                  <option value="project">🎯 Project Session</option>
                  <option value="recreational">🎉 Just Climbing / Fun</option>
          </select>
        </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  {formData.is_indoor ? 'Gym Name' : 'Crag / Area'}
                </label>
          <input
            type="text"
                  value={formData.is_indoor ? formData.gym_name : formData.crag_name}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    [formData.is_indoor ? 'gym_name' : 'crag_name']: e.target.value,
                    // Also set location for backward compatibility
                  })}
                  placeholder={formData.is_indoor ? 'e.g., Movement RiNo' : 'e.g., Boulder Canyon'}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 transition-all"
                />
              </div>
            </div>
          </div>
        </div>


        {/* Outdoor-specific questions */}
        {!formData.is_indoor && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 backdrop-blur-sm p-6 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🏔️</span>
              <h2 className="font-semibold">Outdoor Conditions</h2>
            </div>
            <div className="space-y-5">
              {/* Rock Type */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <span>🪨</span>
                  Rock Type
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {['Granite', 'Limestone', 'Sandstone', 'Basalt', 'Gneiss', 'Quartzite', 'Volcanic', 'Other'].map((rock) => (
                    <button
                      key={rock}
                      type="button"
                      onClick={() => setFormData({ ...formData, rock_type: rock.toLowerCase() })}
                      className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                        formData.rock_type === rock.toLowerCase()
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {rock}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditions Rating */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <span>⭐</span>
                    Conditions Rating
                  </label>
                  <span className="text-sm font-semibold text-emerald-400">{formData.conditions_rating}/8</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={formData.conditions_rating}
                  onChange={(e) => setFormData({ ...formData, conditions_rating: parseInt(e.target.value) })}
                  className="w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-emerald-500 [&::-webkit-slider-thumb]:to-cyan-500"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Poor</span>
                  <span>Perfect</span>
                </div>
              </div>

              {/* Temperature & Humidity */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <span>🌡️</span>
                    Temperature (feels like)
                  </label>
                  <input
                    type="text"
                    value={formData.temperature}
                    onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                    placeholder="e.g., 65°F or 18°C"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <span>💨</span>
                    Humidity
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['low', 'medium', 'high'].map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setFormData({ ...formData, humidity: level })}
                        className={`py-2 px-3 rounded-lg text-xs font-medium capitalize transition-all ${
                          formData.humidity === level
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Precipitation */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🌧️</span>
                  <div>
                    <p className="font-medium text-sm">Recent precipitation?</p>
                    <p className="text-xs text-slate-400">Rain or snow in the last 24-48 hours</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, recent_precipitation: !formData.recent_precipitation })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    formData.recent_precipitation 
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500' 
                      : 'bg-white/20'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${
                      formData.recent_precipitation ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mental/Energy State */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
          <h2 className="font-semibold mb-6">How are you feeling?</h2>
          <div className="space-y-6">
        <RatingSlider
          label="Energy Level"
              icon="⚡"
          value={formData.energy_level}
          onChange={(v) => setFormData({ ...formData, energy_level: v })}
              lowLabel="Exhausted"
              highLabel="Fully charged"
        />

        <RatingSlider
          label="Motivation"
              icon="🔥"
          value={formData.motivation}
          onChange={(v) => setFormData({ ...formData, motivation: v })}
              lowLabel="Not feeling it"
              highLabel="Psyched!"
        />

        <RatingSlider
          label="Stress Level"
              icon="😰"
          value={formData.stress_level}
          onChange={(v) => setFormData({ ...formData, stress_level: v })}
              lowLabel="Relaxed"
              highLabel="Very stressed"
        />

        <RatingSlider
          label="Sleep Quality"
              icon="😴"
          value={formData.sleep_quality}
          onChange={(v) => setFormData({ ...formData, sleep_quality: v })}
              lowLabel="Terrible"
              highLabel="Amazing"
            />
          </div>
        </div>

        {/* Physical Readiness */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
          <h2 className="font-semibold mb-6">Physical Readiness</h2>
          <div className="space-y-5">
            {/* Hours since last meal */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <span>🍽️</span>
                Hours since last meal
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: '<1hr', label: '< 1 hr' },
                  { value: '1-2hr', label: '1-2 hrs' },
                  { value: '2-4hr', label: '2-4 hrs' },
                  { value: '4+hr', label: '4+ hrs' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, hours_since_meal: option.value })}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      formData.hours_since_meal === option.value
                        ? 'bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/20 text-white border border-fuchsia-500/30'
                        : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Hydration */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <span>💧</span>
                Hydration Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'dehydrated', label: '😓 Dehydrated', color: 'from-red-500/20 to-orange-500/20 border-red-500/30' },
                  { value: 'adequate', label: '👍 Adequate', color: 'from-amber-500/20 to-yellow-500/20 border-amber-500/30' },
                  { value: 'well-hydrated', label: '💪 Well Hydrated', color: 'from-emerald-500/20 to-cyan-500/20 border-emerald-500/30' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, hydration: option.value })}
                    className={`py-3 px-3 rounded-lg text-sm font-medium transition-all ${
                      formData.hydration === option.value
                        ? `bg-gradient-to-r ${option.color} text-white border`
                        : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Days since last session & rest day - Auto-calculated */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <span>📅</span>
                  <span className="text-sm font-medium text-slate-300">Days since last climb</span>
                </div>
                <p className="text-2xl font-bold text-fuchsia-400">{formData.days_since_last_session}</p>
                <p className="text-xs text-slate-500 mt-1">Auto-calculated from session history</p>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <span>🛋️</span>
                  <span className="text-sm font-medium text-slate-300">Days since rest day</span>
                </div>
                <p className="text-2xl font-bold text-cyan-400">{formData.days_since_rest_day}</p>
                <p className="text-xs text-slate-500 mt-1">Auto-calculated from session history</p>
              </div>
            </div>

            {/* Muscle Soreness */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <span>💪</span>
                Current Muscle Soreness
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 'none', label: 'None', emoji: '✨' },
                  { value: 'mild', label: 'Mild', emoji: '🟢' },
                  { value: 'moderate', label: 'Moderate', emoji: '🟡' },
                  { value: 'significant', label: 'Significant', emoji: '🔴' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, muscle_soreness: option.value })}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      formData.muscle_soreness === option.value
                        ? 'bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/20 text-white border border-fuchsia-500/30'
                        : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {option.emoji} {option.label}
                  </button>
                ))}
              </div>

              {/* Soreness locations (shown if not 'none') */}
              {formData.muscle_soreness !== 'none' && (
                <div className="pt-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-xs text-slate-400">Where are you sore? (select all that apply)</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'fingers', label: '🤌 Fingers' },
                      { value: 'forearms', label: '💪 Forearms' },
                      { value: 'shoulders', label: '🙆 Shoulders' },
                      { value: 'core', label: '🎯 Core' },
                      { value: 'legs', label: '🦵 Legs' },
                      { value: 'back', label: '🔙 Back' },
                    ].map((loc) => (
                      <button
                        key={loc.value}
                        type="button"
                        onClick={() => {
                          const current = formData.soreness_locations
                          const updated = current.includes(loc.value)
                            ? current.filter((l) => l !== loc.value)
                            : [...current, loc.value]
                          setFormData({ ...formData, soreness_locations: updated })
                        }}
                        className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${
                          formData.soreness_locations.includes(loc.value)
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {loc.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Session Context */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
          <h2 className="font-semibold mb-6">Session Context</h2>
          <div className="space-y-5">
            {/* Time & Duration */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <span>🕐</span>
                  Session Start Time
                </label>
                <input
                  type="time"
                  value={formData.session_start_time}
                  onChange={(e) => setFormData({ ...formData, session_start_time: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <span>⏱️</span>
                  Planned Duration
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="15"
                    max="300"
                    step="15"
                    value={formData.planned_duration}
                    onChange={(e) => setFormData({ ...formData, planned_duration: parseInt(e.target.value) || 60 })}
                    className="w-24 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white text-center focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 transition-all"
                  />
                  <span className="text-sm text-slate-400">minutes</span>
                </div>
              </div>
            </div>

            {/* Caffeine */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-3">
                <span className="text-2xl">☕</span>
                <div>
                  <p className="font-medium text-sm">Had caffeine today?</p>
                  <p className="text-xs text-slate-400">Coffee, tea, energy drinks, etc.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, had_caffeine: !formData.had_caffeine })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  formData.had_caffeine 
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500' 
                    : 'bg-white/20'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${
                    formData.had_caffeine ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            {formData.had_caffeine && (
              <div className="pl-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">How much? (optional)</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['1 cup', '2 cups', '3+ cups', 'Energy drink'].map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setFormData({ ...formData, caffeine_amount: amount })}
                        className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                          formData.caffeine_amount === amount
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {amount}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Alcohol */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🍺</span>
                <div>
                  <p className="font-medium text-sm">Alcohol in last 24 hours?</p>
                  <p className="text-xs text-slate-400">This can affect recovery and performance</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, had_alcohol: !formData.had_alcohol })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  formData.had_alcohol 
                    ? 'bg-gradient-to-r from-purple-500 to-violet-500' 
                    : 'bg-white/20'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${
                    formData.had_alcohol ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            {formData.had_alcohol && (
              <div className="pl-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">How many drinks? (optional)</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['1 drink', '2 drinks', '3-4 drinks', '5+ drinks'].map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setFormData({ ...formData, alcohol_amount: amount })}
                        className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                          formData.alcohol_amount === amount
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {amount}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Session Goal / Intent */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
          <h2 className="font-semibold mb-2">Today's Focus</h2>
          <p className="text-sm text-slate-400 mb-4">What's your primary goal for this session?</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { value: 'push_limits', label: 'Push Limits', emoji: '🔥', desc: 'Try hard, send projects' },
              { value: 'volume', label: 'Volume / Mileage', emoji: '📈', desc: 'Lots of climbs' },
              { value: 'technique', label: 'Technique Focus', emoji: '🎯', desc: 'Movement quality' },
              { value: 'recovery', label: 'Active Recovery', emoji: '🧘', desc: 'Easy day, stay loose' },
              { value: 'social', label: 'Social / Fun', emoji: '🎉', desc: 'Climb with friends' },
              { value: 'skill_work', label: 'Specific Skills', emoji: '🛠️', desc: 'Drills & exercises' },
              { value: 'unsure', label: 'Unsure', emoji: '🤷', desc: "I'll see how I feel" },
            ].map((goal) => (
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
                <div className="text-2xl mb-2">{goal.emoji}</div>
                <p className="font-medium text-sm">{goal.label}</p>
                <p className="text-xs text-slate-400 mt-1">{goal.desc}</p>
              </button>
            ))}
          </div>
        </div>


        {/* LEAD/SPORT-specific questions */}
        {sessionType === 'lead' && (
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 backdrop-blur-sm p-6 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🧗</span>
              <h2 className="font-semibold">Lead Climbing Session</h2>
            </div>
            <div className="space-y-5">
              {/* Session Focus */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <span>🎯</span>
                  Session Focus
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    { value: 'endurance', label: '🔄 Endurance Laps' },
                    { value: 'redpoint', label: '🔴 Redpoint Burns' },
                    { value: 'onsight', label: '👁️ Onsight Attempts' },
                    { value: 'projecting', label: '🎯 Projecting' },
                    { value: 'mental', label: '🧠 Lead Head / Mental' },
                    { value: 'technique', label: '🎭 Technique Work' },
                  ].map((focus) => (
                    <button
                      key={focus.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, lead_session_focus: focus.value })}
                      className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                        formData.lead_session_focus === focus.value
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {focus.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Belay Type */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <span>🪢</span>
                  Belay Setup
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'partner', label: '👥 Partner Belay' },
                    { value: 'autobelay', label: '🤖 Autobelay' },
                    { value: 'self', label: '🧗 Self-Belay' },
                  ].map((belay) => (
                    <button
                      key={belay.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, belay_type: belay.value })}
                      className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                        formData.belay_type === belay.value
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {belay.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TRAINING-specific questions */}
        {sessionType === 'training' && (
          <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 backdrop-blur-sm p-6 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🏋️</span>
              <h2 className="font-semibold">Training Session</h2>
            </div>
            <div className="space-y-5">
              {/* Training Focus (multi-select) */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <span>🎯</span>
                  Training Focus (select all that apply)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    { value: 'finger_strength', label: '🤌 Finger Strength' },
                    { value: 'power', label: '💥 Power / Explosive' },
                    { value: 'endurance', label: '🔄 Endurance / Capacity' },
                    { value: 'antagonist', label: '⚖️ Antagonist / Prehab' },
                    { value: 'core', label: '🎯 Core' },
                    { value: 'flexibility', label: '🧘 Flexibility / Mobility' },
                    { value: 'cardio', label: '❤️ Cardio' },
                  ].map((focus) => (
                    <button
                      key={focus.value}
                      type="button"
                      onClick={() => {
                        const current = formData.training_focuses
                        const updated = current.includes(focus.value)
                          ? current.filter((f) => f !== focus.value)
                          : [...current, focus.value]
                        setFormData({ ...formData, training_focuses: updated })
                      }}
                      className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                        formData.training_focuses.includes(focus.value)
                          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                          : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {focus.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Training Time */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <span>⏱️</span>
                  Target Training Time
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="15"
                    max="180"
                    step="15"
                    value={formData.target_training_time}
                    onChange={(e) => setFormData({ ...formData, target_training_time: parseInt(e.target.value) || 60 })}
                    className="w-24 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white text-center focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                  />
                  <span className="text-sm text-slate-400">minutes</span>
                </div>
              </div>

              {/* Planned Exercises */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <span>📋</span>
                  Planned Exercises <span className="text-slate-500">(optional)</span>
                </label>
                <textarea
                  value={formData.planned_exercises}
                  onChange={(e) => setFormData({ ...formData, planned_exercises: e.target.value })}
                  placeholder="e.g., Hangboard repeaters, campus board, pull-ups..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all h-20 resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* PROJECT-specific questions */}
        {sessionType === 'project' && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-sm p-6 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🎯</span>
              <h2 className="font-semibold">Project Session</h2>
            </div>
            <div className="space-y-5">
              {/* Project Name */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <span>📝</span>
                  Project Name / Route
                </label>
                <input
                  type="text"
                  value={formData.project_name}
                  onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                  placeholder="e.g., The King Line, Midnight Lightning"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                />
              </div>

              {/* Session Number & High Point */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <span>#️⃣</span>
                    Session # on this project
          </label>
          <input
            type="number"
                    min="1"
                    value={formData.project_session_number}
                    onChange={(e) => setFormData({ ...formData, project_session_number: parseInt(e.target.value) || 1 })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <span>📍</span>
                    Current High Point
                  </label>
                  <input
                    type="text"
                    value={formData.current_high_point}
                    onChange={(e) => setFormData({ ...formData, current_high_point: e.target.value })}
                    placeholder="e.g., Move 12, 75%, crux"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                  />
                </div>
              </div>

              {/* Project Goal */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <span>🎯</span>
                  Goal for Today
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'work_moves', label: '🔧 Work Moves', desc: 'Figure out beta' },
                    { value: 'link_sections', label: '🔗 Link Sections', desc: 'Connect sequences' },
                    { value: 'redpoint', label: '🔴 Redpoint Attempt', desc: 'Go for the send' },
                    { value: 'send', label: '🏆 Send Attempt', desc: 'All-out effort' },
                  ].map((goal) => (
                    <button
                      key={goal.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, project_goal: goal.value })}
                      className={`p-3 rounded-xl text-left transition-all ${
                        formData.project_goal === goal.value
                          ? 'bg-amber-500/20 border border-amber-500/30'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <p className="font-medium text-sm">{goal.label}</p>
                      <p className="text-xs text-slate-400">{goal.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Section Focus */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <span>🔍</span>
                  Specific Section Focus <span className="text-slate-500">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.section_focus}
                  onChange={(e) => setFormData({ ...formData, section_focus: e.target.value })}
                  placeholder="e.g., Opening boulder, crux sequence, top-out"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {/* RECREATIONAL / Just Climb questions */}
        {sessionType === 'recreational' && (
          <div className="rounded-2xl border border-pink-500/20 bg-pink-500/5 backdrop-blur-sm p-6 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🎉</span>
              <h2 className="font-semibold">Just Climbing</h2>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                No pressure today! Just log the basics and enjoy your session.
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <span>💭</span>
                  What sounds fun today? <span className="text-slate-500">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.just_for_fun}
                  onChange={(e) => setFormData({ ...formData, just_for_fun: e.target.value })}
                  placeholder="e.g., Try some slabs, climb with friends, explore new problems..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {/* Pain & Injury Section */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
          <h2 className="font-semibold mb-4">Pain & Injury Check</h2>
          
          {/* Pain toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 mb-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🩹</span>
              <div>
                <p className="font-medium text-sm">Are you experiencing any pain or injury?</p>
                <p className="text-xs text-slate-400">This helps us adjust your recommendations</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const newHasPain = !formData.has_pain
              setFormData({
                ...formData,
                  has_pain: newHasPain,
                  injuries: newHasPain && formData.injuries.length === 0 
                    ? [{ location: '', severity: 3, description: '' }] 
                    : formData.injuries,
                })
              }}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                formData.has_pain 
                  ? 'bg-gradient-to-r from-fuchsia-500 to-cyan-500' 
                  : 'bg-white/20'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${
                  formData.has_pain ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Injury details (shown when has_pain is true) */}
          {formData.has_pain && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              {formData.injuries.map((injury, index) => (
                <div
                  key={index}
                  className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-4"
                >
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

                  {/* Pain location dropdown */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Where does it hurt?</label>
                    <select
                      value={injury.location}
                      onChange={(e) => updateInjury(index, 'location', e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                    >
                      <option value="">Select location...</option>
                      {painLocations.map((loc) => (
                        <option key={loc.value} value={loc.value}>
                          {loc.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Pain severity */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-300">Pain severity</label>
                      <span className="text-sm font-semibold text-amber-400">{injury.severity}/8</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="8"
                      value={injury.severity}
                      onChange={(e) => updateInjury(index, 'severity', parseInt(e.target.value))}
                      className="w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-amber-500 [&::-webkit-slider-thumb]:to-orange-500 [&::-webkit-slider-thumb]:shadow-lg"
                    />
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Mild discomfort</span>
                      <span>Severe pain</span>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">
                      Brief description <span className="text-slate-500">(optional)</span>
          </label>
          <input
                      type="text"
                      value={injury.description}
                      onChange={(e) => updateInjury(index, 'description', e.target.value)}
                      placeholder="e.g., tweaked it last session, old injury flaring up..."
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                    />
                  </div>
                </div>
              ))}

              {/* Add another injury button */}
              <button
                type="button"
                onClick={addInjury}
                className="w-full py-3 rounded-xl border border-dashed border-white/20 text-sm text-slate-400 hover:text-white hover:border-white/40 transition-colors"
              >
                + Add another injury
              </button>

              {/* Warning message */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <span className="text-lg">⚠️</span>
                <p className="text-xs text-amber-200/80">
                  If you're experiencing significant pain, consider taking a rest day or consulting a medical professional. 
                  ClimbIQ will adjust recommendations to avoid aggravating your injury.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Custom Variables Section */}
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
          <h2 className="font-semibold mb-4">Notes</h2>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Anything else relevant... (goals for today, specific climbs to try, etc.)"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 transition-all h-24 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white font-semibold text-lg shadow-lg shadow-fuchsia-500/25 hover:shadow-fuchsia-500/40 hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100 transition-all duration-200"
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
      </form>
    </div>
  )
}
