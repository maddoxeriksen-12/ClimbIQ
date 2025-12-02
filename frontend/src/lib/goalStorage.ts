// Goal tracking utilities

export type GoalType = 
  | 'outdoor_season'
  | 'competition'
  | 'send_project'
  | 'grade_breakthrough'
  | 'injury_recovery'
  | 'general_fitness'
  | 'technique_mastery'
  | 'endurance_building'
  | 'power_development'
  | 'custom'

export interface ClimbingGoal {
  id: string
  type: GoalType
  title: string
  description: string
  targetDate: string // ISO date string
  startDate: string // ISO date string
  targetGrade?: string
  projectName?: string
  competitionName?: string
  customDetails?: string
  isActive: boolean
  createdAt: string
}

export interface GoalProgress {
  goalId: string
  sessionsCompleted: number
  lastSessionDate?: string
  milestones: GoalMilestone[]
  notes: string[]
}

export interface GoalMilestone {
  id: string
  title: string
  completedAt?: string
  isCompleted: boolean
}

// Goal type display info
export const GOAL_TYPES: Record<GoalType, { label: string; icon: string; description: string }> = {
  outdoor_season: {
    label: 'Outdoor Season Prep',
    icon: '🏔️',
    description: 'Get ready for outdoor climbing trips and sending outside',
  },
  competition: {
    label: 'Competition Training',
    icon: '🏆',
    description: 'Prepare for an upcoming climbing competition',
  },
  send_project: {
    label: 'Send a Project',
    icon: '🎯',
    description: 'Focus on sending a specific route or boulder problem',
  },
  grade_breakthrough: {
    label: 'Grade Breakthrough',
    icon: '📈',
    description: 'Break into a new grade range',
  },
  injury_recovery: {
    label: 'Injury Recovery',
    icon: '🩹',
    description: 'Safely return to climbing after an injury',
  },
  general_fitness: {
    label: 'General Fitness',
    icon: '💪',
    description: 'Improve overall climbing fitness and consistency',
  },
  technique_mastery: {
    label: 'Technique Mastery',
    icon: '🎨',
    description: 'Focus on movement quality and climbing technique',
  },
  endurance_building: {
    label: 'Endurance Building',
    icon: '🔄',
    description: 'Build stamina for longer routes and sessions',
  },
  power_development: {
    label: 'Power Development',
    icon: '⚡',
    description: 'Develop explosive strength for hard moves',
  },
  custom: {
    label: 'Custom Goal',
    icon: '✨',
    description: 'Define your own climbing goal',
  },
}

// Storage functions
export function saveGoal(goal: ClimbingGoal): void {
  const goals = getGoals()
  const existingIndex = goals.findIndex(g => g.id === goal.id)
  if (existingIndex >= 0) {
    goals[existingIndex] = goal
  } else {
    goals.push(goal)
  }
  localStorage.setItem('climbingGoals', JSON.stringify(goals))
}

export function getGoals(): ClimbingGoal[] {
  const stored = localStorage.getItem('climbingGoals')
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return []
    }
  }
  return []
}

export function getActiveGoal(): ClimbingGoal | null {
  const goals = getGoals()
  return goals.find(g => g.isActive) || null
}

export function setActiveGoal(goalId: string): void {
  const goals = getGoals()
  goals.forEach(g => {
    g.isActive = g.id === goalId
  })
  localStorage.setItem('climbingGoals', JSON.stringify(goals))
}

export function deleteGoal(goalId: string): void {
  const goals = getGoals().filter(g => g.id !== goalId)
  localStorage.setItem('climbingGoals', JSON.stringify(goals))
}

export function getGoalProgress(goalId: string): GoalProgress {
  const stored = localStorage.getItem(`goalProgress_${goalId}`)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      // Return default
    }
  }
  return {
    goalId,
    sessionsCompleted: 0,
    milestones: [],
    notes: [],
  }
}

export function updateGoalProgress(progress: GoalProgress): void {
  localStorage.setItem(`goalProgress_${progress.goalId}`, JSON.stringify(progress))
}

export function incrementGoalSessions(goalId: string): void {
  const progress = getGoalProgress(goalId)
  progress.sessionsCompleted += 1
  progress.lastSessionDate = new Date().toISOString()
  updateGoalProgress(progress)
}

// Helper functions
export function calculateDaysRemaining(targetDate: string): number {
  const target = new Date(targetDate)
  const now = new Date()
  const diffMs = target.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
}

export function calculateDaysElapsed(startDate: string): number {
  const start = new Date(startDate)
  const now = new Date()
  const diffMs = now.getTime() - start.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

export function calculateProgress(startDate: string, targetDate: string): number {
  const start = new Date(startDate).getTime()
  const target = new Date(targetDate).getTime()
  const now = new Date().getTime()
  
  if (now >= target) return 100
  if (now <= start) return 0
  
  const total = target - start
  const elapsed = now - start
  return Math.round((elapsed / total) * 100)
}

export function createGoal(
  type: GoalType,
  title: string,
  targetDate: string,
  options?: {
    description?: string
    targetGrade?: string
    projectName?: string
    competitionName?: string
    customDetails?: string
  }
): ClimbingGoal {
  return {
    id: `goal_${Date.now()}`,
    type,
    title,
    description: options?.description || GOAL_TYPES[type].description,
    targetDate,
    startDate: new Date().toISOString().split('T')[0],
    targetGrade: options?.targetGrade,
    projectName: options?.projectName,
    competitionName: options?.competitionName,
    customDetails: options?.customDetails,
    isActive: true,
    createdAt: new Date().toISOString(),
  }
}

