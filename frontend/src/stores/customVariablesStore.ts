import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type VariableType = 'number' | 'scale' | 'boolean' | 'text'
export type FormType = 'pre_session' | 'post_session'

export interface CustomVariable {
  id: string
  name: string
  description?: string
  type: VariableType
  formType: FormType
  // For scale type
  minValue?: number
  maxValue?: number
  minLabel?: string
  maxLabel?: string
  // For number type
  unit?: string
  // Ownership
  createdBy: 'athlete' | 'coach'
  coachId?: string // If created by coach for team
  athleteId?: string // If created by athlete for themselves
  createdAt: string
  isActive: boolean
}

export interface VariableEntry {
  variableId: string
  value: number | string | boolean
  sessionId: string
  recordedAt: string
}

interface CustomVariablesState {
  // Variables defined by the user
  variables: CustomVariable[]
  // Historical entries for correlation analysis
  entries: VariableEntry[]
  
  // Actions
  addVariable: (variable: Omit<CustomVariable, 'id' | 'createdAt' | 'isActive'>) => boolean
  updateVariable: (id: string, updates: Partial<CustomVariable>) => void
  deleteVariable: (id: string) => void
  toggleVariable: (id: string) => void
  
  // Entry actions
  recordEntry: (entry: Omit<VariableEntry, 'recordedAt'>) => void
  getEntriesForVariable: (variableId: string) => VariableEntry[]
  
  // Getters
  getActiveVariables: (formType: FormType, userId: string, coachId?: string) => CustomVariable[]
  getVariableCount: (formType: FormType, userId: string) => number
  canAddVariable: (formType: FormType, userId: string) => boolean
}

const MAX_VARIABLES_PER_FORM = 3

export const useCustomVariablesStore = create<CustomVariablesState>()(
  persist(
    (set, get) => ({
      variables: [],
      entries: [],

      addVariable: (variable) => {
        const state = get()
        const userId = variable.athleteId || variable.coachId || ''
        
        // Check limit
        if (!state.canAddVariable(variable.formType, userId)) {
          return false
        }

        const newVariable: CustomVariable = {
          ...variable,
          id: `var_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
          isActive: true,
        }

        set((state) => ({
          variables: [...state.variables, newVariable],
        }))

        return true
      },

      updateVariable: (id, updates) => {
        set((state) => ({
          variables: state.variables.map((v) =>
            v.id === id ? { ...v, ...updates } : v
          ),
        }))
      },

      deleteVariable: (id) => {
        set((state) => ({
          variables: state.variables.filter((v) => v.id !== id),
          entries: state.entries.filter((e) => e.variableId !== id),
        }))
      },

      toggleVariable: (id) => {
        set((state) => ({
          variables: state.variables.map((v) =>
            v.id === id ? { ...v, isActive: !v.isActive } : v
          ),
        }))
      },

      recordEntry: (entry) => {
        set((state) => ({
          entries: [
            ...state.entries,
            { ...entry, recordedAt: new Date().toISOString() },
          ],
        }))
      },

      getEntriesForVariable: (variableId) => {
        return get().entries.filter((e) => e.variableId === variableId)
      },

      getActiveVariables: (formType, userId, coachId) => {
        return get().variables.filter(
          (v) =>
            v.isActive &&
            v.formType === formType &&
            (v.athleteId === userId || (v.coachId === coachId && v.createdBy === 'coach'))
        )
      },

      getVariableCount: (formType, userId) => {
        return get().variables.filter(
          (v) => v.formType === formType && (v.athleteId === userId || v.coachId === userId)
        ).length
      },

      canAddVariable: (formType, userId) => {
        return get().getVariableCount(formType, userId) < MAX_VARIABLES_PER_FORM
      },
    }),
    {
      name: 'climbiq-custom-variables',
    }
  )
)

// Helper function to calculate correlation between variable and performance
export function calculateCorrelation(
  variableEntries: { value: number; sessionId: string }[],
  performanceData: { sessionId: string; satisfaction: number; sends: number; hardestGrade: number }[]
): {
  correlation: number
  sampleSize: number
  insight: string
  trend: 'positive' | 'negative' | 'neutral'
} {
  // Match entries with performance data
  const paired: { varValue: number; perfValue: number }[] = []
  
  for (const entry of variableEntries) {
    const perf = performanceData.find((p) => p.sessionId === entry.sessionId)
    if (perf && typeof entry.value === 'number') {
      // Use satisfaction as primary performance metric
      paired.push({ varValue: entry.value, perfValue: perf.satisfaction })
    }
  }

  if (paired.length < 3) {
    return {
      correlation: 0,
      sampleSize: paired.length,
      insight: 'Not enough data yet. Keep logging to see correlations.',
      trend: 'neutral',
    }
  }

  // Calculate Pearson correlation coefficient
  const n = paired.length
  const sumX = paired.reduce((acc, p) => acc + p.varValue, 0)
  const sumY = paired.reduce((acc, p) => acc + p.perfValue, 0)
  const sumXY = paired.reduce((acc, p) => acc + p.varValue * p.perfValue, 0)
  const sumX2 = paired.reduce((acc, p) => acc + p.varValue * p.varValue, 0)
  const sumY2 = paired.reduce((acc, p) => acc + p.perfValue * p.perfValue, 0)

  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  )

  const correlation = denominator === 0 ? 0 : numerator / denominator

  // Generate insight
  let insight: string
  let trend: 'positive' | 'negative' | 'neutral'

  if (Math.abs(correlation) < 0.2) {
    insight = 'No significant correlation detected yet.'
    trend = 'neutral'
  } else if (correlation > 0.5) {
    insight = 'Strong positive correlation! Higher values tend to improve performance.'
    trend = 'positive'
  } else if (correlation > 0.2) {
    insight = 'Moderate positive correlation with your performance.'
    trend = 'positive'
  } else if (correlation < -0.5) {
    insight = 'Strong negative correlation. Lower values may improve performance.'
    trend = 'negative'
  } else {
    insight = 'Moderate negative correlation with your performance.'
    trend = 'negative'
  }

  return {
    correlation: Math.round(correlation * 100) / 100,
    sampleSize: n,
    insight,
    trend,
  }
}

