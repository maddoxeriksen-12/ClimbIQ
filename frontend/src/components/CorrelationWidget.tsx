import { useMemo } from 'react'
import { useCustomVariablesStore, calculateCorrelation, type CustomVariable } from '../stores/customVariablesStore'
import { useAuth } from '../hooks/useAuth'

interface CorrelationWidgetProps {
  // Mock performance data - in production this would come from the session store
  performanceData?: { sessionId: string; satisfaction: number; sends: number; hardestGrade: number }[]
}

export function CorrelationWidget({ performanceData = [] }: CorrelationWidgetProps) {
  const { user } = useAuth()
  const { variables, entries } = useCustomVariablesStore()

  // Get user's active variables
  const userVariables = useMemo(() => {
    if (!user) return []
    return variables.filter(
      (v) => v.isActive && (v.athleteId === user.id || v.coachId === user.user_metadata?.coach_id)
    )
  }, [variables, user])

  // Calculate correlations for each variable
  const correlations = useMemo(() => {
    return userVariables.map((variable) => {
      const varEntries = entries
        .filter((e) => e.variableId === variable.id)
        .map((e) => ({
          value: typeof e.value === 'number' ? e.value : 0,
          sessionId: e.sessionId,
        }))

      const correlation = calculateCorrelation(varEntries, performanceData)

      return {
        variable,
        ...correlation,
      }
    })
  }, [userVariables, entries, performanceData])

  // Only show variables with enough data
  const significantCorrelations = correlations.filter((c) => c.sampleSize >= 3)
  const pendingCorrelations = correlations.filter((c) => c.sampleSize < 3)

  if (userVariables.length === 0) {
    return null
  }

  const CorrelationBar = ({ value, trend }: { value: number; trend: 'positive' | 'negative' | 'neutral' }) => {
    const width = Math.abs(value) * 100
    const isPositive = value >= 0

    return (
      <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-px h-full bg-white/20" />
        </div>
        <div
          className={`absolute h-full rounded-full transition-all duration-500 ${
            trend === 'positive'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
              : trend === 'negative'
              ? 'bg-gradient-to-r from-rose-500 to-orange-500'
              : 'bg-white/30'
          }`}
          style={{
            width: `${width}%`,
            left: isPositive ? '50%' : `${50 - width}%`,
          }}
        />
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
            <span className="text-2xl">📈</span>
          </div>
          <div>
            <h2 className="font-semibold">Variable Insights</h2>
            <p className="text-xs text-slate-400">How your custom tracking affects performance</p>
          </div>
        </div>
      </div>

      {/* Significant correlations */}
      {significantCorrelations.length > 0 && (
        <div className="space-y-4">
          {significantCorrelations.map(({ variable, correlation, sampleSize, insight, trend }) => (
            <CorrelationCard
              key={variable.id}
              variable={variable}
              correlation={correlation}
              sampleSize={sampleSize}
              insight={insight}
              trend={trend}
            />
          ))}
        </div>
      )}

      {/* Pending correlations (not enough data) */}
      {pendingCorrelations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <p className="text-xs text-slate-500 mb-3">Gathering data for:</p>
          <div className="flex flex-wrap gap-2">
            {pendingCorrelations.map(({ variable, sampleSize }) => (
              <div
                key={variable.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5"
              >
                <span className="text-xs text-slate-400">{variable.name}</span>
                <span className="text-[10px] text-slate-500">{sampleSize}/3 sessions</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {correlations.length === 0 && (
        <div className="text-center py-8">
          <p className="text-slate-400 text-sm">No custom variables tracked yet.</p>
          <p className="text-slate-500 text-xs mt-1">
            Add custom variables in Settings to see insights here.
          </p>
        </div>
      )}
    </div>
  )
}

interface CorrelationCardProps {
  variable: CustomVariable
  correlation: number
  sampleSize: number
  insight: string
  trend: 'positive' | 'negative' | 'neutral'
}

function CorrelationCard({ variable, correlation, sampleSize, insight, trend }: CorrelationCardProps) {
  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">
            {variable.type === 'scale' ? '📊' : variable.type === 'number' ? '🔢' : variable.type === 'boolean' ? '✓' : '📝'}
          </span>
          <div>
            <p className="font-medium text-sm">{variable.name}</p>
            <p className="text-[10px] text-slate-500">
              {variable.formType === 'pre_session' ? 'Pre-session' : 'Post-session'} • {sampleSize} sessions
            </p>
          </div>
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
          trend === 'positive'
            ? 'bg-emerald-500/20 text-emerald-300'
            : trend === 'negative'
            ? 'bg-rose-500/20 text-rose-300'
            : 'bg-white/10 text-slate-400'
        }`}>
          <span className="text-sm">
            {trend === 'positive' ? '↑' : trend === 'negative' ? '↓' : '—'}
          </span>
          <span className="text-xs font-semibold">
            {correlation > 0 ? '+' : ''}{(correlation * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Correlation bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>Negative</span>
          <span>Positive</span>
        </div>
        <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-px h-full bg-white/20" />
          </div>
          <div
            className={`absolute h-full rounded-full transition-all duration-500 ${
              trend === 'positive'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                : trend === 'negative'
                ? 'bg-gradient-to-r from-rose-500 to-orange-500'
                : 'bg-white/30'
            }`}
            style={{
              width: `${Math.abs(correlation) * 50}%`,
              left: correlation >= 0 ? '50%' : `${50 - Math.abs(correlation) * 50}%`,
            }}
          />
        </div>
      </div>

      {/* Insight */}
      <p className="text-xs text-slate-400">{insight}</p>
    </div>
  )
}

// Compact version for dashboard header
export function CorrelationWidgetCompact({ performanceData = [] }: CorrelationWidgetProps) {
  const { user } = useAuth()
  const { variables, entries } = useCustomVariablesStore()

  const userVariables = useMemo(() => {
    if (!user) return []
    return variables.filter(
      (v) => v.isActive && (v.athleteId === user.id || v.coachId === user.user_metadata?.coach_id)
    )
  }, [variables, user])

  const topCorrelation = useMemo(() => {
    let best: { variable: CustomVariable; correlation: number; trend: 'positive' | 'negative' | 'neutral' } | null = null

    for (const variable of userVariables) {
      const varEntries = entries
        .filter((e) => e.variableId === variable.id)
        .map((e) => ({
          value: typeof e.value === 'number' ? e.value : 0,
          sessionId: e.sessionId,
        }))

      const { correlation, sampleSize, trend } = calculateCorrelation(varEntries, performanceData)

      if (sampleSize >= 3 && (!best || Math.abs(correlation) > Math.abs(best.correlation))) {
        best = { variable, correlation, trend }
      }
    }

    return best
  }, [userVariables, entries, performanceData])

  if (!topCorrelation) {
    return null
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-xl ${
      topCorrelation.trend === 'positive'
        ? 'bg-emerald-500/10 border border-emerald-500/20'
        : topCorrelation.trend === 'negative'
        ? 'bg-rose-500/10 border border-rose-500/20'
        : 'bg-white/5 border border-white/10'
    }`}>
      <span className="text-lg">💡</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-300 truncate">
          <span className="font-medium">{topCorrelation.variable.name}</span>
          {' '}shows{' '}
          <span className={
            topCorrelation.trend === 'positive' 
              ? 'text-emerald-300' 
              : topCorrelation.trend === 'negative' 
              ? 'text-rose-300' 
              : 'text-slate-400'
          }>
            {topCorrelation.trend === 'positive' 
              ? 'positive' 
              : topCorrelation.trend === 'negative' 
              ? 'negative' 
              : 'no'} correlation
          </span>
          {' '}with performance
        </p>
      </div>
      <span className={`text-sm font-semibold ${
        topCorrelation.trend === 'positive'
          ? 'text-emerald-300'
          : topCorrelation.trend === 'negative'
          ? 'text-rose-300'
          : 'text-slate-400'
      }`}>
        {topCorrelation.correlation > 0 ? '+' : ''}{(topCorrelation.correlation * 100).toFixed(0)}%
      </span>
    </div>
  )
}

