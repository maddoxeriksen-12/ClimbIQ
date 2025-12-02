import { type CustomVariable } from '../stores/customVariablesStore'

interface CustomVariableInputProps {
  variable: CustomVariable
  value: number | string | boolean | undefined
  onChange: (value: number | string | boolean) => void
}

export function CustomVariableInput({ variable, value, onChange }: CustomVariableInputProps) {
  switch (variable.type) {
    case 'scale':
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <span className="text-cyan-400">📊</span>
              {variable.name}
              {variable.createdBy === 'coach' && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]">Team</span>
              )}
            </label>
            <span className="text-sm font-semibold text-cyan-400">
              {(value as number) || variable.minValue || 1}/{variable.maxValue || 10}
            </span>
          </div>
          {variable.description && (
            <p className="text-xs text-slate-500">{variable.description}</p>
          )}
          <input
            type="range"
            min={variable.minValue || 1}
            max={variable.maxValue || 10}
            value={(value as number) || variable.minValue || 1}
            onChange={(e) => onChange(parseInt(e.target.value))}
            className="w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-cyan-500 [&::-webkit-slider-thumb]:to-teal-500 [&::-webkit-slider-thumb]:shadow-lg"
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>{variable.minLabel || 'Low'}</span>
            <span>{variable.maxLabel || 'High'}</span>
          </div>
        </div>
      )

    case 'number':
      return (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-200">
            <span className="text-cyan-400">🔢</span>
            {variable.name}
            {variable.unit && <span className="text-slate-500">({variable.unit})</span>}
            {variable.createdBy === 'coach' && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]">Team</span>
            )}
          </label>
          {variable.description && (
            <p className="text-xs text-slate-500">{variable.description}</p>
          )}
          <input
            type="number"
            value={(value as number) || ''}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            placeholder={`Enter ${variable.name.toLowerCase()}`}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
          />
        </div>
      )

    case 'boolean':
      return (
        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
          <div className="flex items-center gap-3">
            <span className="text-xl text-cyan-400">✓</span>
            <div>
              <p className="font-medium text-sm flex items-center gap-2">
                {variable.name}
                {variable.createdBy === 'coach' && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]">Team</span>
                )}
              </p>
              {variable.description && (
                <p className="text-xs text-slate-400">{variable.description}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange(!(value as boolean))}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              value ? 'bg-gradient-to-r from-cyan-500 to-teal-500' : 'bg-white/20'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${
                value ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      )

    case 'text':
      return (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-200">
            <span className="text-cyan-400">📝</span>
            {variable.name}
            {variable.createdBy === 'coach' && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]">Team</span>
            )}
          </label>
          {variable.description && (
            <p className="text-xs text-slate-500">{variable.description}</p>
          )}
          <input
            type="text"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Enter ${variable.name.toLowerCase()}`}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
          />
        </div>
      )

    default:
      return null
  }
}

interface CustomVariablesSectionProps {
  variables: CustomVariable[]
  values: Record<string, number | string | boolean>
  onChange: (variableId: string, value: number | string | boolean) => void
  formType: 'pre_session' | 'post_session'
}

export function CustomVariablesSection({ variables, values, onChange, formType }: CustomVariablesSectionProps) {
  const filteredVars = variables.filter((v) => v.formType === formType && v.isActive)

  if (filteredVars.length === 0) {
    return null
  }

  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 backdrop-blur-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">📊</span>
        <h2 className="font-semibold">Custom Tracking</h2>
        <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs">
          {filteredVars.length} variable{filteredVars.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="space-y-5">
        {filteredVars.map((variable) => (
          <CustomVariableInput
            key={variable.id}
            variable={variable}
            value={values[variable.id]}
            onChange={(value) => onChange(variable.id, value)}
          />
        ))}
      </div>
    </div>
  )
}

