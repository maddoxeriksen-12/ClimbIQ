import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  GOAL_TYPES,
  createGoal as createGoalInDb,
} from '../lib/goalService'

type GoalType = keyof typeof GOAL_TYPES

export function NewGoal() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'type' | 'details' | 'confirm'>('type')
  const [selectedType, setSelectedType] = useState<GoalType | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    targetDate: '',
    targetGrade: '',
    projectName: '',
    competitionName: '',
    customDetails: '',
  })

  const handleTypeSelect = (type: GoalType) => {
    setSelectedType(type)
    // Pre-fill title based on type
    const typeInfo = GOAL_TYPES[type]
    setFormData(prev => ({
      ...prev,
      title: typeInfo.label,
      description: typeInfo.description,
    }))
    setStep('details')
  }

  const handleSubmit = async () => {
    if (!selectedType || !formData.targetDate || isSubmitting) return

    setIsSubmitting(true)
    try {
      const { data, error } = await createGoalInDb({
        type: selectedType,
        title: formData.title,
        description: formData.description || undefined,
        target_date: formData.targetDate,
        target_grade: formData.targetGrade || undefined,
        project_name: formData.projectName || undefined,
        competition_name: formData.competitionName || undefined,
        custom_details: formData.customDetails || undefined,
      })

      if (error) {
        console.error('Error creating goal:', error)
        alert('Failed to create goal. Please try again.')
        return
      }

      console.log('Goal created successfully:', data)
      navigate('/goals')
    } catch (err) {
      console.error('Error creating goal:', err)
      alert('Failed to create goal. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Get default date (3 months from now)
  const getDefaultDate = () => {
    const date = new Date()
    date.setMonth(date.getMonth() + 3)
    return date.toISOString().split('T')[0]
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link to="/goals" className="text-sm text-slate-400 hover:text-white mb-4 inline-flex items-center gap-1">
          ← Back
        </Link>
        <h1 className="text-3xl font-bold mt-4">Create a New Goal</h1>
        <p className="text-slate-400">Define what you're working toward</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-8">
        {['type', 'details', 'confirm'].map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step === s
                  ? 'bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white'
                  : i < ['type', 'details', 'confirm'].indexOf(step)
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white/10 text-slate-400'
              }`}
            >
              {i < ['type', 'details', 'confirm'].indexOf(step) ? '✓' : i + 1}
            </div>
            {i < 2 && (
              <div className={`w-12 h-0.5 mx-2 ${
                i < ['type', 'details', 'confirm'].indexOf(step) ? 'bg-emerald-500' : 'bg-white/10'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Select Goal Type */}
      {step === 'type' && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold mb-6">What are you training for?</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {(Object.entries(GOAL_TYPES) as [GoalType, typeof GOAL_TYPES[GoalType]][]).map(([type, info]) => (
              <button
                key={type}
                onClick={() => handleTypeSelect(type)}
                className={`p-5 rounded-2xl border text-left transition-all hover:scale-[1.02] ${
                  selectedType === type
                    ? 'border-fuchsia-500/50 bg-fuchsia-500/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center text-2xl">
                    {info.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{info.label}</h3>
                    <p className="text-sm text-slate-400">{info.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Goal Details */}
      {step === 'details' && selectedType && (
        <div className="space-y-6">
          <button
            onClick={() => setStep('type')}
            className="text-sm text-slate-400 hover:text-white flex items-center gap-1"
          >
            ← Change goal type
          </button>

          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 flex items-center justify-center text-2xl">
              {GOAL_TYPES[selectedType].icon}
            </div>
            <div>
              <p className="text-sm text-slate-400">Goal Type</p>
              <p className="font-semibold">{GOAL_TYPES[selectedType].label}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Goal Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
                placeholder="e.g., Send my first V7"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 h-24 resize-none"
                placeholder="What does success look like?"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Target Date</label>
              <input
                type="date"
                value={formData.targetDate || getDefaultDate()}
                onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
              />
            </div>

            {/* Type-specific fields */}
            {(selectedType === 'grade_breakthrough' || selectedType === 'send_project') && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Target Grade</label>
                <select
                  value={formData.targetGrade}
                  onChange={(e) => setFormData({ ...formData, targetGrade: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
                >
                  <option value="">Select grade...</option>
                  {['V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12+'].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                  {['5.11a', '5.11b', '5.11c', '5.11d', '5.12a', '5.12b', '5.12c', '5.12d', '5.13a+'].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedType === 'send_project' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Project Name</label>
                <input
                  type="text"
                  value={formData.projectName}
                  onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
                  placeholder="e.g., Midnight Lightning"
                />
              </div>
            )}

            {selectedType === 'competition' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Competition Name</label>
                <input
                  type="text"
                  value={formData.competitionName}
                  onChange={(e) => setFormData({ ...formData, competitionName: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
                  placeholder="e.g., Local Bouldering League Finals"
                />
              </div>
            )}

            {selectedType === 'custom' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Additional Details</label>
                <textarea
                  value={formData.customDetails}
                  onChange={(e) => setFormData({ ...formData, customDetails: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 h-24 resize-none"
                  placeholder="Describe your custom goal..."
                />
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-4">
            <button
              onClick={() => setStep('type')}
              className="flex-1 py-3 rounded-xl border border-white/10 text-white font-medium hover:bg-white/5 transition-all"
            >
              Back
            </button>
            <button
              onClick={() => {
                if (!formData.targetDate) {
                  setFormData({ ...formData, targetDate: getDefaultDate() })
                }
                setStep('confirm')
              }}
              disabled={!formData.title}
              className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-fuchsia-500 hover:to-cyan-500 transition-all"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 'confirm' && selectedType && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Confirm Your Goal</h2>

          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-fuchsia-500/10 to-cyan-500/10 p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-fuchsia-500/30 to-cyan-500/30 border border-white/10 flex items-center justify-center text-3xl">
                {GOAL_TYPES[selectedType].icon}
              </div>
              <div>
                <p className="text-sm text-fuchsia-400 mb-1">{GOAL_TYPES[selectedType].label}</p>
                <h3 className="text-2xl font-bold mb-2">{formData.title}</h3>
                <p className="text-slate-400">{formData.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white/5">
                <p className="text-xs text-slate-500 mb-1">Start Date</p>
                <p className="font-semibold">Today</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5">
                <p className="text-xs text-slate-500 mb-1">Target Date</p>
                <p className="font-semibold">
                  {new Date(formData.targetDate || getDefaultDate()).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>

            {(formData.targetGrade || formData.projectName || formData.competitionName) && (
              <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-3">
                {formData.targetGrade && (
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-sm">
                    🎯 {formData.targetGrade}
                  </span>
                )}
                {formData.projectName && (
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-sm">
                    🧗 {formData.projectName}
                  </span>
                )}
                {formData.competitionName && (
                  <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 text-sm">
                    🏆 {formData.competitionName}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20">
            <div className="flex items-start gap-3">
              <span className="text-xl">💡</span>
              <div>
                <p className="font-medium text-sm">Your recommendations will be tailored</p>
                <p className="text-xs text-slate-400 mt-1">
                  ClimbIQ will use this goal to personalize your session recommendations and track your progress.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              onClick={() => setStep('details')}
              className="flex-1 py-4 rounded-xl border border-white/10 text-white font-medium hover:bg-white/5 transition-all"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-[2] py-4 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white font-semibold text-lg shadow-lg shadow-fuchsia-500/25 hover:shadow-fuchsia-500/40 hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '⏳ Creating...' : '🎯 Set This Goal'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

