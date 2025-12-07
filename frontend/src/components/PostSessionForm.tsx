import { useState, useEffect } from 'react'
import { useCustomVariablesStore } from '../stores/customVariablesStore'
import { CustomVariablesSection } from './CustomVariableInput'
import { useAuth } from '../hooks/useAuth'

interface PostSessionData {
  // A. Objective Performance
  hardest_grade_sent: string
  hardest_grade_attempted: string
  volume_estimation: string
  objective_strength_metric: string
  dominant_style: string
  // B. Subjective Experience
  rpe: number
  session_density: string
  intra_session_fueling: string
  // C. Failure Analysis
  limiting_factors: string[]
  flash_pump: boolean
  // D. Health & Injury Update
  new_pain_location: string
  new_pain_severity: number
  fingers_stiffer_than_usual: boolean
  skin_status_post: string
  doms_severity_post: number
  finger_power_post: number
  shoulder_mobility_post: number
  // E. The Learning Loop
  prediction_error: number
}

interface PostSessionFormProps {
  sessionType: string
  location: string
  sessionId?: string
  plannedDuration?: number
  isOutdoor?: boolean
  startTime?: Date
  isHistorical?: boolean
  onSubmit: (data: PostSessionData & { customVariables?: Record<string, number | string | boolean> }) => Promise<void>
  onCancel: () => void
}

export function PostSessionForm({ sessionType, location, sessionId, isHistorical = false, onSubmit, onCancel }: PostSessionFormProps) {
  const { user } = useAuth()
  const { getActiveVariables, recordEntry } = useCustomVariablesStore()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const customVariables = user ? getActiveVariables('post_session', user.id, user.user_metadata?.coach_id) : []
  const [customValues, setCustomValues] = useState<Record<string, number | string | boolean>>({})

  const [formData, setFormData] = useState<PostSessionData>({
    // A. Objective Performance
    hardest_grade_sent: '',
    hardest_grade_attempted: '',
    volume_estimation: '',
    objective_strength_metric: '',
    dominant_style: '',
    // B. Subjective Experience
    rpe: 5,
    session_density: '',
    intra_session_fueling: '',
    // C. Failure Analysis
    limiting_factors: [],
    flash_pump: false,
    // D. Health & Injury Update
    new_pain_location: '',
    new_pain_severity: 0,
    fingers_stiffer_than_usual: false,
    skin_status_post: '',
    doms_severity_post: 5,
    finger_power_post: 5,
    shoulder_mobility_post: 5,
    // E. The Learning Loop
    prediction_error: 0,
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Determine if this is a bouldering or rope session for grade display
  const isBouldering = sessionType === 'bouldering' || sessionType.includes('boulder')

  const boulderGrades = [
    'VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12', 'V13', 'V14', 'V15+'
  ]

  const ropeGrades = [
    '5.5', '5.6', '5.7', '5.8', '5.9', 
    '5.10a', '5.10b', '5.10c', '5.10d',
    '5.11a', '5.11b', '5.11c', '5.11d',
    '5.12a', '5.12b', '5.12c', '5.12d',
    '5.13a', '5.13b', '5.13c', '5.13d',
    '5.14a', '5.14b', '5.14c', '5.14d',
    '5.15a+'
  ]

  const grades = isBouldering ? boulderGrades : ropeGrades

  const volumeOptions = [
    { value: 'low', label: 'Low', description: '1-3 hard climbs' },
    { value: 'moderate', label: 'Moderate', description: '4-8 hard climbs' },
    { value: 'high', label: 'High', description: 'Volume day' },
    { value: 'very_high', label: 'Very High', description: 'Exhaustion' },
  ]

  const styleOptions = [
    { value: 'overhang', label: 'Overhang/Steep' },
    { value: 'vertical', label: 'Vertical/Slightly Overhung' },
    { value: 'slab', label: 'Slab/Technical' },
    { value: 'crack', label: 'Crack/Off-Width' },
    { value: 'mixed', label: 'Mixed' },
  ]

  const densityOptions = [
    { value: 'rushed', label: 'Rushed', description: 'Not enough rest' },
    { value: 'optimal', label: 'Optimal', description: 'Good pacing' },
    { value: 'slow', label: 'Slow', description: 'Too much chatting/sitting' },
  ]

  const fuelingOptions = [
    { value: 'none', label: 'No fuel' },
    { value: 'water_only', label: 'Water/Electrolytes only' },
    { value: 'simple_carbs', label: 'Simple Carbs (e.g., gummy bears)' },
    { value: 'complex_carbs', label: 'Complex Carbs/Protein' },
  ]

  const limitingFactorOptions = [
    { value: 'forearm_pump', label: 'Forearm Pump', description: 'Aerobic/Anaerobic failure - "boxed"' },
    { value: 'power', label: 'Power', description: "Muscular failure - couldn't generate enough force" },
    { value: 'finger_strength', label: 'Finger Strength', description: "Couldn't hold the holds" },
    { value: 'skin_pain', label: 'Skin Pain', description: 'Too raw/painful to continue' },
    { value: 'technique', label: 'Technique/Beta', description: "Confused, clumsy, or couldn't figure it out" },
    { value: 'fear', label: 'Fear/Headgame', description: 'Commitment issues, fear of falling' },
    { value: 'cns_fatigue', label: 'CNS/Neural Fatigue', description: 'Uncoordinated, slow, "high gravity day"' },
    { value: 'metabolic', label: 'Metabolic Exhaustion', description: 'Total energy crash, "bonking"' },
    { value: 'time', label: 'Time Constraints', description: 'Had to leave' },
  ]

  const toggleLimitingFactor = (factor: string) => {
    const current = formData.limiting_factors
    if (current.includes(factor)) {
      setFormData({ ...formData, limiting_factors: current.filter(f => f !== factor) })
    } else if (current.length < 2) {
      setFormData({ ...formData, limiting_factors: [...current, factor] })
    }
  }

  const painLocationOptions = [
    { value: 'none', label: 'No new pain' },
    { value: 'fingers', label: 'Fingers' },
    { value: 'hands_wrists', label: 'Hands/Wrists' },
    { value: 'forearms', label: 'Forearms' },
    { value: 'elbows', label: 'Elbows' },
    { value: 'shoulders', label: 'Shoulders' },
    { value: 'back', label: 'Back' },
    { value: 'other', label: 'Other' },
  ]

  const skinStatusOptions = [
    { value: 'intact', label: 'Intact' },
    { value: 'worn_thin', label: 'Worn Thin' },
    { value: 'split_bleeding', label: 'Split/Bleeding' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const sid = sessionId || `session_${Date.now()}`
      Object.entries(customValues).forEach(([variableId, value]) => {
        recordEntry({
          variableId,
          value,
          sessionId: sid,
        })
      })

      await onSubmit({ ...formData, customVariables: customValues })
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormValid = formData.hardest_grade_sent && formData.volume_estimation && formData.dominant_style

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium">
            Session Complete
          </span>
          {isHistorical && (
            <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-medium">
              Historical Entry
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold mb-1">Post-Session Log</h1>
        <p className="text-slate-400 text-sm">
          Great session at <span className="text-white">{location || 'the gym'}</span>! Record your results.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ============================================ */}
        {/* SECTION A: Objective Performance */}
        {/* ============================================ */}
        <div className="mb-2">
          <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">A. Objective Performance</h3>
        </div>

        {/* 1. Hardest Grade Sent */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-2">1. Hardest Grade Sent (Success)</h2>
          <p className="text-xs text-slate-400 mb-3">The hardest climb you completed today</p>
          <select
            value={formData.hardest_grade_sent}
            onChange={(e) => setFormData({ ...formData, hardest_grade_sent: e.target.value })}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value="">Select grade...</option>
            {grades.map((grade) => (
              <option key={grade} value={grade}>{grade}</option>
            ))}
          </select>
        </div>

        {/* 2. Hardest Grade Attempted */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-2">2. Hardest Grade Attempted (Projecting)</h2>
          <p className="text-xs text-slate-400 mb-3">The hardest climb you tried, sent or not</p>
          <select
            value={formData.hardest_grade_attempted}
            onChange={(e) => setFormData({ ...formData, hardest_grade_attempted: e.target.value })}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value="">Select grade...</option>
            {grades.map((grade) => (
              <option key={grade} value={grade}>{grade}</option>
            ))}
          </select>
        </div>

        {/* 3. Volume Estimation */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-3">3. Volume Estimation</h2>
          <div className="grid grid-cols-2 gap-1.5">
            {volumeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFormData({ ...formData, volume_estimation: opt.value })}
                className={`py-2 px-3 rounded-lg text-left transition-all ${
                  formData.volume_estimation === opt.value
                    ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-white border border-emerald-500/30'
                    : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="text-xs font-semibold">{opt.label}</div>
                <div className="text-[10px] text-slate-400">{opt.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 4. Objective Strength Metric */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-2">4. Objective Strength Metric (If Training)</h2>
          <p className="text-xs text-slate-400 mb-3">e.g., Max Hang weight, Weighted Pull-up max, or N/A</p>
          <input
            type="text"
            value={formData.objective_strength_metric}
            onChange={(e) => setFormData({ ...formData, objective_strength_metric: e.target.value })}
            placeholder="e.g., +45lbs hang, BW+70 pull-up, or N/A"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>

        {/* 5. Dominant Climbing Style/Angle */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-3">5. Dominant Climbing Style/Angle</h2>
          <div className="grid grid-cols-1 gap-1.5">
            {styleOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFormData({ ...formData, dominant_style: opt.value })}
                className={`py-2 px-3 rounded-lg text-left text-xs font-medium transition-all ${
                  formData.dominant_style === opt.value
                    ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-white border border-emerald-500/30'
                    : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ============================================ */}
        {/* SECTION B: Subjective Experience (RPE) */}
        {/* ============================================ */}
        <div className="mt-6 mb-2">
          <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">B. Subjective Experience</h3>
        </div>

        {/* 1. RPE */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-3">1. RPE (Rate of Perceived Exertion)</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">1 = Could do this all day</span>
              <span className="text-lg font-bold text-cyan-400">{formData.rpe}</span>
              <span className="text-xs text-slate-400">10 = Total failure</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={formData.rpe}
              onChange={(e) => setFormData({ ...formData, rpe: parseInt(e.target.value) })}
              className="w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-cyan-500 [&::-webkit-slider-thumb]:to-emerald-500 [&::-webkit-slider-thumb]:shadow-lg"
            />
          </div>
        </div>

        {/* 2. Session Density */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-3">2. Session Density (Pacing)</h2>
          <div className="grid grid-cols-3 gap-1.5">
            {densityOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFormData({ ...formData, session_density: opt.value })}
                className={`py-2 px-2 rounded-lg text-center transition-all ${
                  formData.session_density === opt.value
                    ? 'bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 text-white border border-cyan-500/30'
                    : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="text-xs font-semibold">{opt.label}</div>
                <div className="text-[10px] text-slate-400">{opt.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Intra-Session Fueling */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-3">3. Intra-Session Fueling</h2>
          <div className="grid grid-cols-2 gap-1.5">
            {fuelingOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFormData({ ...formData, intra_session_fueling: opt.value })}
                className={`py-2 px-3 rounded-lg text-left text-xs font-medium transition-all ${
                  formData.intra_session_fueling === opt.value
                    ? 'bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 text-white border border-cyan-500/30'
                    : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ============================================ */}
        {/* SECTION C: Failure Analysis */}
        {/* ============================================ */}
        <div className="mt-6 mb-2">
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">C. Failure Analysis</h3>
        </div>

        {/* 1. Primary Limiting Factor */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-2">1. Primary Limiting Factor</h2>
          <p className="text-xs text-slate-400 mb-3">Why did you stop/fail? Select top 1-2</p>
          <div className="grid grid-cols-1 gap-1.5">
            {limitingFactorOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleLimitingFactor(opt.value)}
                className={`py-2 px-3 rounded-lg text-left transition-all ${
                  formData.limiting_factors.includes(opt.value)
                    ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-white border border-amber-500/30'
                    : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="text-xs font-semibold">{opt.label}</div>
                <div className="text-[10px] text-slate-400">{opt.description}</div>
              </button>
            ))}
          </div>
          {formData.limiting_factors.length === 2 && (
            <p className="text-xs text-amber-400 mt-2">✓ Maximum 2 factors selected</p>
          )}
        </div>

        {/* 2. Flash Pump */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">2. Did you experience "Flash Pump"?</h2>
              <p className="text-xs text-slate-400 mt-1">Indicates warm-up failure</p>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, flash_pump: !formData.flash_pump })}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                formData.flash_pump ? 'bg-amber-500' : 'bg-white/20'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-200 ${
                formData.flash_pump ? 'translate-x-7' : 'translate-x-0'
              }`} />
            </button>
          </div>
          {formData.flash_pump && (
            <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-amber-300">⚠️ Consider extending your warm-up next session</p>
            </div>
          )}
        </div>

        {/* ============================================ */}
        {/* SECTION D: Health & Injury Update */}
        {/* ============================================ */}
        <div className="mt-6 mb-2">
          <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider">D. Health & Injury Update</h3>
        </div>

        {/* 1. Post-Climb Joint Status */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-3">1. Post-Climb Joint Status</h2>
          <p className="text-xs text-slate-400 mb-3">Any new pain?</p>
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {painLocationOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFormData({ ...formData, new_pain_location: opt.value, new_pain_severity: opt.value === 'none' ? 0 : formData.new_pain_severity || 3 })}
                className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                  formData.new_pain_location === opt.value
                    ? 'bg-gradient-to-r from-rose-500/20 to-pink-500/20 text-white border border-rose-500/30'
                    : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {formData.new_pain_location && formData.new_pain_location !== 'none' && (
            <div className="space-y-3 pt-3 border-t border-white/10">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Severity: 1 = Mild</span>
                  <span className="text-lg font-bold text-rose-400">{formData.new_pain_severity}</span>
                  <span className="text-xs text-slate-400">10 = Severe</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={formData.new_pain_severity}
                  onChange={(e) => setFormData({ ...formData, new_pain_severity: parseInt(e.target.value) })}
                  className="w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-rose-500 [&::-webkit-slider-thumb]:to-pink-500 [&::-webkit-slider-thumb]:shadow-lg"
                />
              </div>
            </div>
          )}
          <div className="flex items-center justify-between mt-4 p-3 rounded-lg bg-white/5 border border-white/5">
            <span className="text-xs text-slate-300">Are fingers stiffer or sorer than usual post-session?</span>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, fingers_stiffer_than_usual: !formData.fingers_stiffer_than_usual })}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                formData.fingers_stiffer_than_usual ? 'bg-rose-500' : 'bg-white/20'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${
                formData.fingers_stiffer_than_usual ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>

        {/* 2. Skin Status Post-Session */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-3">2. Skin Status Post-Session</h2>
          <div className="grid grid-cols-3 gap-1.5">
            {skinStatusOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFormData({ ...formData, skin_status_post: opt.value })}
                className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                  formData.skin_status_post === opt.value
                    ? 'bg-gradient-to-r from-rose-500/20 to-pink-500/20 text-white border border-rose-500/30'
                    : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Deep Muscle Soreness (DOMS) */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-2">3. Deep Muscle Soreness (DOMS)</h2>
          <p className="text-xs text-slate-400 mb-3">Current muscle soreness severity</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">1 = None</span>
              <span className="text-lg font-bold text-rose-400">{formData.doms_severity_post}</span>
              <span className="text-xs text-slate-400">10 = Severe</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={formData.doms_severity_post}
              onChange={(e) => setFormData({ ...formData, doms_severity_post: parseInt(e.target.value) })}
              className="w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-rose-500 [&::-webkit-slider-thumb]:to-pink-500 [&::-webkit-slider-thumb]:shadow-lg"
            />
          </div>
        </div>

        {/* 4. Post-Session Finger Power Feel */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-3">4. Post-Session Finger Power Feel</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">1 = Dead/Powerless</span>
              <span className="text-lg font-bold text-rose-400">{formData.finger_power_post}</span>
              <span className="text-xs text-slate-400">10 = Still snappy</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={formData.finger_power_post}
              onChange={(e) => setFormData({ ...formData, finger_power_post: parseInt(e.target.value) })}
              className="w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-rose-500 [&::-webkit-slider-thumb]:to-pink-500 [&::-webkit-slider-thumb]:shadow-lg"
            />
          </div>
        </div>

        {/* 5. Post-Session Shoulder/Mobility Feel */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-3">5. Post-Session Shoulder/Mobility Feel</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">1 = Very Stiff/Tired</span>
              <span className="text-lg font-bold text-rose-400">{formData.shoulder_mobility_post}</span>
              <span className="text-xs text-slate-400">10 = Still mobile/fresh</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={formData.shoulder_mobility_post}
              onChange={(e) => setFormData({ ...formData, shoulder_mobility_post: parseInt(e.target.value) })}
              className="w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-rose-500 [&::-webkit-slider-thumb]:to-pink-500 [&::-webkit-slider-thumb]:shadow-lg"
            />
          </div>
        </div>

        {/* ============================================ */}
        {/* SECTION E: The Learning Loop */}
        {/* ============================================ */}
        <div className="mt-6 mb-2">
          <h3 className="text-xs font-bold text-violet-400 uppercase tracking-wider">E. The Learning Loop</h3>
        </div>

        {/* 1. Prediction Error Check */}
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-2">1. Prediction Error Check</h2>
          <p className="text-xs text-slate-400 mb-3">Did you perform better or worse than you expected based on how you felt before starting?</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">-5 = Much Worse</span>
              <span className={`text-lg font-bold ${
                formData.prediction_error < 0 ? 'text-red-400' : formData.prediction_error > 0 ? 'text-emerald-400' : 'text-slate-400'
              }`}>
                {formData.prediction_error > 0 ? '+' : ''}{formData.prediction_error}
              </span>
              <span className="text-xs text-slate-400">+5 = Much Better</span>
            </div>
            <input
              type="range"
              min="-5"
              max="5"
              value={formData.prediction_error}
              onChange={(e) => setFormData({ ...formData, prediction_error: parseInt(e.target.value) })}
              className="w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-violet-500 [&::-webkit-slider-thumb]:to-fuchsia-500 [&::-webkit-slider-thumb]:shadow-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>Much Worse</span>
              <span>As Expected</span>
              <span>Much Better</span>
            </div>
          </div>
          {formData.prediction_error !== 0 && (
            <div className={`mt-3 p-3 rounded-lg ${
              formData.prediction_error < 0 ? 'bg-red-500/10 border border-red-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'
            }`}>
              <p className={`text-xs ${formData.prediction_error < 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                {formData.prediction_error < 0 
                  ? '📉 This helps calibrate recovery predictions for future sessions'
                  : '📈 Great! This helps identify what worked well today'
                }
              </p>
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
            formType="post_session"
          />
        )}

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-white/10 text-white font-medium text-sm hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !isFormValid}
            className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-semibold text-sm shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100 transition-all"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
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
