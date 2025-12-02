import { useState } from 'react'
import { useCustomVariablesStore, type CustomVariable, type VariableType, type FormType } from '../stores/customVariablesStore'

interface CustomVariableManagerProps {
  userId: string
  userRole: 'athlete' | 'coach'
  coachId?: string
  onClose?: () => void
}

export function CustomVariableManager({ userId, userRole, coachId, onClose }: CustomVariableManagerProps) {
  const { variables, addVariable, deleteVariable, toggleVariable, canAddVariable } = useCustomVariablesStore()
  
  const [showAddForm, setShowAddForm] = useState(false)
  const [newVar, setNewVar] = useState<{
    name: string
    description: string
    type: VariableType
    formType: FormType
    minValue: number
    maxValue: number
    minLabel: string
    maxLabel: string
    unit: string
    scope: 'personal' | 'team'
  }>({
    name: '',
    description: '',
    type: 'scale',
    formType: 'pre_session',
    minValue: 1,
    maxValue: 10,
    minLabel: 'Low',
    maxLabel: 'High',
    unit: '',
    scope: 'personal',
  })

  // Filter variables for this user
  const userVariables = variables.filter(
    (v) => v.athleteId === userId || (v.coachId === coachId && v.createdBy === 'coach')
  )

  const preSessionVars = userVariables.filter((v) => v.formType === 'pre_session')
  const postSessionVars = userVariables.filter((v) => v.formType === 'post_session')

  const canAddPre = canAddVariable('pre_session', userId)
  const canAddPost = canAddVariable('post_session', userId)

  const handleAdd = () => {
    const success = addVariable({
      name: newVar.name,
      description: newVar.description || undefined,
      type: newVar.type,
      formType: newVar.formType,
      minValue: newVar.type === 'scale' ? newVar.minValue : undefined,
      maxValue: newVar.type === 'scale' ? newVar.maxValue : undefined,
      minLabel: newVar.type === 'scale' ? newVar.minLabel : undefined,
      maxLabel: newVar.type === 'scale' ? newVar.maxLabel : undefined,
      unit: newVar.type === 'number' ? newVar.unit : undefined,
      createdBy: userRole,
      coachId: userRole === 'coach' && newVar.scope === 'team' ? userId : undefined,
      athleteId: userRole === 'athlete' || newVar.scope === 'personal' ? userId : undefined,
    })

    if (success) {
      setNewVar({
        name: '',
        description: '',
        type: 'scale',
        formType: 'pre_session',
        minValue: 1,
        maxValue: 10,
        minLabel: 'Low',
        maxLabel: 'High',
        unit: '',
        scope: 'personal',
      })
      setShowAddForm(false)
    }
  }

  const VariableCard = ({ variable }: { variable: CustomVariable }) => (
    <div className={`p-4 rounded-xl border ${variable.isActive ? 'border-white/10 bg-white/5' : 'border-white/5 bg-white/[0.02] opacity-60'}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">
            {variable.type === 'scale' ? '📊' : variable.type === 'number' ? '🔢' : variable.type === 'boolean' ? '✓' : '📝'}
          </span>
          <div>
            <p className="font-medium">{variable.name}</p>
            {variable.description && (
              <p className="text-xs text-slate-400">{variable.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {variable.createdBy === 'coach' && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs">
              Team
            </span>
          )}
          <button
            onClick={() => toggleVariable(variable.id)}
            className={`px-2 py-1 rounded-lg text-xs ${
              variable.isActive
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-white/10 text-slate-400'
            }`}
          >
            {variable.isActive ? 'Active' : 'Inactive'}
          </button>
          <button
            onClick={() => deleteVariable(variable.id)}
            className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            🗑️
          </button>
        </div>
      </div>
      <div className="flex gap-4 text-xs text-slate-500">
        <span>Type: {variable.type}</span>
        {variable.type === 'scale' && (
          <span>Range: {variable.minValue}-{variable.maxValue}</span>
        )}
        {variable.unit && <span>Unit: {variable.unit}</span>}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Custom Tracking Variables</h2>
          <p className="text-sm text-slate-400">
            Add up to 3 custom variables per form to track what matters to you.
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        )}
      </div>

      {/* Pre-Session Variables */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium flex items-center gap-2">
            <span className="text-fuchsia-400">●</span>
            Pre-Session Variables
            <span className="text-xs text-slate-500">({preSessionVars.length}/3)</span>
          </h3>
        </div>
        <div className="space-y-2">
          {preSessionVars.length === 0 ? (
            <p className="text-sm text-slate-500 p-4 rounded-xl bg-white/5 border border-dashed border-white/10">
              No custom pre-session variables yet
            </p>
          ) : (
            preSessionVars.map((v) => <VariableCard key={v.id} variable={v} />)
          )}
        </div>
      </div>

      {/* Post-Session Variables */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium flex items-center gap-2">
            <span className="text-emerald-400">●</span>
            Post-Session Variables
            <span className="text-xs text-slate-500">({postSessionVars.length}/3)</span>
          </h3>
        </div>
        <div className="space-y-2">
          {postSessionVars.length === 0 ? (
            <p className="text-sm text-slate-500 p-4 rounded-xl bg-white/5 border border-dashed border-white/10">
              No custom post-session variables yet
            </p>
          ) : (
            postSessionVars.map((v) => <VariableCard key={v.id} variable={v} />)
          )}
        </div>
      </div>

      {/* Add Variable Button/Form */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          disabled={!canAddPre && !canAddPost}
          className="w-full py-3 rounded-xl border border-dashed border-white/20 text-slate-400 hover:text-white hover:border-white/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          + Add Custom Variable
        </button>
      ) : (
        <div className="p-5 rounded-xl border border-white/10 bg-white/5 space-y-4">
          <h3 className="font-medium">Add New Variable</h3>

          {/* Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Variable Name *</label>
            <input
              type="text"
              value={newVar.name}
              onChange={(e) => setNewVar({ ...newVar, name: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
              placeholder="e.g., Caffeine intake, Warm-up duration"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Description (optional)</label>
            <input
              type="text"
              value={newVar.description}
              onChange={(e) => setNewVar({ ...newVar, description: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
              placeholder="Brief description of what you're tracking"
            />
          </div>

          {/* Form Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">When to Track *</label>
              <select
                value={newVar.formType}
                onChange={(e) => setNewVar({ ...newVar, formType: e.target.value as FormType })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
              >
                <option value="pre_session" disabled={!canAddPre}>Pre-Session {!canAddPre && '(Full)'}</option>
                <option value="post_session" disabled={!canAddPost}>Post-Session {!canAddPost && '(Full)'}</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Variable Type *</label>
              <select
                value={newVar.type}
                onChange={(e) => setNewVar({ ...newVar, type: e.target.value as VariableType })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
              >
                <option value="scale">Scale (1-10)</option>
                <option value="number">Number</option>
                <option value="boolean">Yes/No</option>
                <option value="text">Text</option>
              </select>
            </div>
          </div>

          {/* Scale-specific options */}
          {newVar.type === 'scale' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Min Label</label>
                <input
                  type="text"
                  value={newVar.minLabel}
                  onChange={(e) => setNewVar({ ...newVar, minLabel: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
                  placeholder="e.g., None"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Max Label</label>
                <input
                  type="text"
                  value={newVar.maxLabel}
                  onChange={(e) => setNewVar({ ...newVar, maxLabel: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
                  placeholder="e.g., Maximum"
                />
              </div>
            </div>
          )}

          {/* Number-specific options */}
          {newVar.type === 'number' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Unit (optional)</label>
              <input
                type="text"
                value={newVar.unit}
                onChange={(e) => setNewVar({ ...newVar, unit: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
                placeholder="e.g., mg, minutes, cups"
              />
            </div>
          )}

          {/* Coach-only: Scope selection */}
          {userRole === 'coach' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Apply To</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setNewVar({ ...newVar, scope: 'team' })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    newVar.scope === 'team'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-white/5 text-slate-400 border border-white/10'
                  }`}
                >
                  👥 All Athletes
                </button>
                <button
                  type="button"
                  onClick={() => setNewVar({ ...newVar, scope: 'personal' })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    newVar.scope === 'personal'
                      ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30'
                      : 'bg-white/5 text-slate-400 border border-white/10'
                  }`}
                >
                  👤 Just Me
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowAddForm(false)}
              className="flex-1 py-2 rounded-xl border border-white/10 text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!newVar.name}
              className="flex-1 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white text-sm font-medium hover:from-fuchsia-500 hover:to-cyan-500 disabled:opacity-50 transition-all"
            >
              Add Variable
            </button>
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="p-4 rounded-xl bg-fuchsia-500/5 border border-fuchsia-500/20">
        <p className="text-xs text-fuchsia-200/80">
          💡 <strong>Tip:</strong> Custom variables help you discover what impacts your climbing. 
          After logging a few sessions, you'll see correlation insights on your dashboard showing 
          how each variable affects your performance.
        </p>
      </div>
    </div>
  )
}

