import { supabase } from './supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseData = any

// Types for goal data
export interface ClimbingGoal {
  id: string
  user_id: string
  type: string
  title: string
  description?: string
  target_date?: string
  start_date: string
  target_grade?: string
  project_name?: string
  competition_name?: string
  custom_details?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface GoalProgress {
  id: string
  goal_id: string
  sessions_completed: number
  last_session_date?: string
  milestones: Array<{ id: string; title: string; completed_at?: string; is_completed: boolean }>
  notes: string[]
  created_at: string
  updated_at: string
}

export interface CreateGoalInput {
  type: string
  title: string
  description?: string
  target_date?: string
  target_grade?: string
  project_name?: string
  competition_name?: string
  custom_details?: string
}

// Goal type display info
export const GOAL_TYPES: Record<string, { label: string; icon: string; description: string }> = {
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

// Create a new goal
export async function createGoal(input: CreateGoalInput): Promise<{ data: ClimbingGoal | null; error: Error | null }> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      return { data: null, error: new Error('User not authenticated') }
    }

    // Deactivate any existing active goals
    await (supabase as any)
      .from('climbing_goals')
      .update({ is_active: false })
      .eq('user_id', userData.user.id)
      .eq('is_active', true)

    const { data, error } = await supabase
      .from('climbing_goals')
      .insert({
        user_id: userData.user.id,
        type: input.type,
        title: input.title,
        description: input.description,
        target_date: input.target_date,
        start_date: new Date().toISOString().split('T')[0],
        target_grade: input.target_grade,
        project_name: input.project_name,
        competition_name: input.competition_name,
        custom_details: input.custom_details,
        is_active: true,
      } as SupabaseData)
      .select()
      .single()

    if (error) throw error

    const goalData = data as ClimbingGoal

    // Initialize goal progress
    await supabase
      .from('goal_progress')
      .insert({
        goal_id: goalData.id,
        sessions_completed: 0,
        milestones: [],
        notes: [],
      } as SupabaseData)

    return { data: goalData, error: null }
  } catch (err) {
    console.error('Error creating goal:', err)
    return { data: null, error: err as Error }
  }
}

// Get active goal for user
export async function getActiveGoal(): Promise<{ data: ClimbingGoal | null; error: Error | null }> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      return { data: null, error: new Error('User not authenticated') }
    }

    const { data, error } = await supabase
      .from('climbing_goals')
      .select('*')
      .eq('user_id', userData.user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return { data: data as ClimbingGoal | null, error: null }
  } catch (err) {
    console.error('Error getting active goal:', err)
    return { data: null, error: err as Error }
  }
}

// Get all goals for user
export async function getAllGoals(): Promise<{ data: ClimbingGoal[]; error: Error | null }> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      return { data: [], error: new Error('User not authenticated') }
    }

    const { data, error } = await supabase
      .from('climbing_goals')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return { data: (data as ClimbingGoal[]) ?? [], error: null }
  } catch (err) {
    console.error('Error getting all goals:', err)
    return { data: [], error: err as Error }
  }
}

// Get goal progress
export async function getGoalProgress(goalId: string): Promise<{ data: GoalProgress | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('goal_progress')
      .select('*')
      .eq('goal_id', goalId)
      .maybeSingle()

    if (error) throw error
    
    // If no progress exists, return default
    if (!data) {
      return {
        data: {
          id: '',
          goal_id: goalId,
          sessions_completed: 0,
          milestones: [],
          notes: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      }
    }

    return { data: data as GoalProgress, error: null }
  } catch (err) {
    console.error('Error getting goal progress:', err)
    return { data: null, error: err as Error }
  }
}

// Set active goal
export async function setActiveGoal(goalId: string): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      return { success: false, error: new Error('User not authenticated') }
    }

    // Deactivate all goals
    await (supabase as any)
      .from('climbing_goals')
      .update({ is_active: false })
      .eq('user_id', userData.user.id)

    // Activate the selected goal
    const { error } = await (supabase as any)
      .from('climbing_goals')
      .update({ is_active: true })
      .eq('id', goalId)

    if (error) throw error
    return { success: true, error: null }
  } catch (err) {
    console.error('Error setting active goal:', err)
    return { success: false, error: err as Error }
  }
}

// Update goal
export async function updateGoal(
  goalId: string,
  updates: Partial<CreateGoalInput>
): Promise<{ data: ClimbingGoal | null; error: Error | null }> {
  try {
    const { data, error } = await (supabase as any)
      .from('climbing_goals')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', goalId)
      .select()
      .single()

    if (error) throw error
    return { data: data as ClimbingGoal, error: null }
  } catch (err) {
    console.error('Error updating goal:', err)
    return { data: null, error: err as Error }
  }
}

// Delete goal
export async function deleteGoal(goalId: string): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase
      .from('climbing_goals')
      .delete()
      .eq('id', goalId)

    if (error) throw error
    return { success: true, error: null }
  } catch (err) {
    console.error('Error deleting goal:', err)
    return { success: false, error: err as Error }
  }
}

// Helper functions
export function calculateDaysRemaining(targetDate?: string): number | null {
  if (!targetDate) return null
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

export function calculateProgress(startDate: string, targetDate?: string): number {
  if (!targetDate) return 0
  const start = new Date(startDate).getTime()
  const target = new Date(targetDate).getTime()
  const now = new Date().getTime()
  
  if (now >= target) return 100
  if (now <= start) return 0
  
  const total = target - start
  const elapsed = now - start
  return Math.round((elapsed / total) * 100)
}

