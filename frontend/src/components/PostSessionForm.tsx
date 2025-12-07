import { useState, useEffect } from 'react'
import { useCustomVariablesStore } from '../stores/customVariablesStore'
import { CustomVariablesSection } from './CustomVariableInput'
import { useAuth } from '../hooks/useAuth'

interface PostSessionData {
  // A. Objective Performance (The "Truth")
  hardest_grade_sent: string
  hardest_grade_attempted: string
  volume_estimation: string
  objective_strength_metric: string
  dominant_style: string
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
    hardest_grade_sent: '',
    hardest_grade_attempted: '',
    volume_estimation: '',
    objective_strength_metric: '',
    dominant_style: '',
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
          <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">A. Objective Performance (The "Truth")</h3>
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
