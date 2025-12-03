import { supabase } from './supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseData = any

// Types for session data
export interface ClimbingSession {
  id: string
  user_id: string
  goal_id?: string
  session_type: string
  location?: string
  is_outdoor: boolean
  started_at: string
  ended_at?: string
  planned_duration_minutes?: number
  actual_duration_minutes?: number
  status: 'active' | 'completed' | 'cancelled'
  pre_session_data: Record<string, unknown>
  post_session_data: Record<string, unknown>
  energy_level?: number
  motivation?: number
  sleep_quality?: number
  stress_level?: number
  session_rpe?: number
  satisfaction?: number
  highest_grade_sent?: string
  highest_grade_attempted?: string
  total_climbs?: number
  total_sends?: number
  flash_count?: number
  had_pain_before?: boolean
  had_pain_after?: boolean
  pain_location?: string
  pain_severity?: number
  notes?: string
  created_at: string
  updated_at: string
}

export interface CreateSessionInput {
  session_type: string
  location?: string
  is_outdoor?: boolean
  planned_duration_minutes?: number
  goal_id?: string
  pre_session_data?: Record<string, unknown>
  energy_level?: number
  motivation?: number
  sleep_quality?: number
  stress_level?: number
  had_pain_before?: boolean
  pain_location?: string
  pain_severity?: number
  notes?: string
}

export interface CompleteSessionInput {
  session_id: string
  post_session_data?: Record<string, unknown>
  session_rpe?: number
  satisfaction?: number
  highest_grade_sent?: string
  highest_grade_attempted?: string
  total_climbs?: number
  total_sends?: number
  flash_count?: number
  had_pain_after?: boolean
  pain_location?: string
  pain_severity?: number
  notes?: string
  actual_start_time?: string
  actual_end_time?: string
}

export interface SessionStats {
  totalSessions: number
  sessionsThisWeek: number
  sessionsLastWeek: number
  totalClimbs: number
  avgSessionRpe: number
  avgSatisfaction: number
  highestGradeSent: string
  mostCommonType: string
  totalDurationMinutes: number
  avgDurationMinutes: number
}

// Create a new session (pre-session form submission)
export async function createSession(input: CreateSessionInput): Promise<{ data: ClimbingSession | null; error: Error | null }> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      return { data: null, error: new Error('User not authenticated') }
    }

    const { data, error } = await supabase
      .from('climbing_sessions')
      .insert({
        user_id: userData.user.id,
        session_type: input.session_type,
        location: input.location,
        is_outdoor: input.is_outdoor ?? false,
        started_at: new Date().toISOString(),
        planned_duration_minutes: input.planned_duration_minutes,
        goal_id: input.goal_id,
        status: 'active',
        pre_session_data: input.pre_session_data ?? {},
        energy_level: input.energy_level,
        motivation: input.motivation,
        sleep_quality: input.sleep_quality,
        stress_level: input.stress_level,
        had_pain_before: input.had_pain_before,
        pain_location: input.pain_location,
        pain_severity: input.pain_severity,
        notes: input.notes,
      } as SupabaseData)
      .select()
      .single()

    if (error) throw error
    return { data: data as ClimbingSession, error: null }
  } catch (err) {
    console.error('Error creating session:', err)
    return { data: null, error: err as Error }
  }
}

// Complete a session (post-session form submission)
export async function completeSession(input: CompleteSessionInput): Promise<{ data: ClimbingSession | null; error: Error | null }> {
  try {
    const endTime = input.actual_end_time ?? new Date().toISOString()
    
    // Get the session to calculate duration
    const { data: session } = await supabase
      .from('climbing_sessions')
      .select('started_at')
      .eq('id', input.session_id)
      .single()

    const sessionData = session as { started_at?: string } | null
    const startTime = input.actual_start_time ?? sessionData?.started_at
    let actualDuration: number | undefined
    
    if (startTime) {
      const start = new Date(startTime)
      const end = new Date(endTime)
      actualDuration = Math.round((end.getTime() - start.getTime()) / 60000)
    }

    const { data, error } = await (supabase as any)
      .from('climbing_sessions')
      .update({
        status: 'completed',
        ended_at: endTime,
        started_at: input.actual_start_time ?? undefined,
        actual_duration_minutes: actualDuration,
        post_session_data: input.post_session_data ?? {},
        session_rpe: input.session_rpe,
        satisfaction: input.satisfaction,
        highest_grade_sent: input.highest_grade_sent,
        highest_grade_attempted: input.highest_grade_attempted,
        total_climbs: input.total_climbs,
        total_sends: input.total_sends,
        flash_count: input.flash_count,
        had_pain_after: input.had_pain_after,
        pain_location: input.pain_location,
        pain_severity: input.pain_severity,
        notes: input.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.session_id)
      .select()
      .single()

    if (error) throw error
    return { data: data as ClimbingSession, error: null }
  } catch (err) {
    console.error('Error completing session:', err)
    return { data: null, error: err as Error }
  }
}

// Cancel a session
export async function cancelSession(sessionId: string): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await (supabase as any)
      .from('climbing_sessions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', sessionId)

    if (error) throw error
    return { success: true, error: null }
  } catch (err) {
    console.error('Error cancelling session:', err)
    return { success: false, error: err as Error }
  }
}

// Get active session for user
export async function getActiveSession(): Promise<{ data: ClimbingSession | null; error: Error | null }> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      return { data: null, error: new Error('User not authenticated') }
    }

    const { data, error } = await supabase
      .from('climbing_sessions')
      .select('*')
      .eq('user_id', userData.user.id)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows returned
    return { data: data as ClimbingSession | null, error: null }
  } catch (err) {
    console.error('Error getting active session:', err)
    return { data: null, error: err as Error }
  }
}

// Get recent sessions for user
export async function getRecentSessions(limit: number = 10): Promise<{ data: ClimbingSession[]; error: Error | null }> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      return { data: [], error: new Error('User not authenticated') }
    }

    const { data, error } = await supabase
      .from('climbing_sessions')
      .select('*')
      .eq('user_id', userData.user.id)
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return { data: (data as ClimbingSession[]) ?? [], error: null }
  } catch (err) {
    console.error('Error getting recent sessions:', err)
    return { data: [], error: err as Error }
  }
}

// Get session stats for dashboard
export async function getSessionStats(): Promise<{ data: SessionStats | null; error: Error | null }> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      return { data: null, error: new Error('User not authenticated') }
    }

    // Get all completed sessions
    const { data: sessions, error } = await supabase
      .from('climbing_sessions')
      .select('*')
      .eq('user_id', userData.user.id)
      .eq('status', 'completed')
      .order('started_at', { ascending: false })

    if (error) throw error

    const allSessions = (sessions as ClimbingSession[]) ?? []
    
    // Calculate date ranges
    const now = new Date()
    const startOfThisWeek = new Date(now)
    startOfThisWeek.setDate(now.getDate() - now.getDay())
    startOfThisWeek.setHours(0, 0, 0, 0)
    
    const startOfLastWeek = new Date(startOfThisWeek)
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7)

    // Filter sessions by week
    const sessionsThisWeek = allSessions.filter(s => new Date(s.started_at) >= startOfThisWeek)
    const sessionsLastWeek = allSessions.filter(s => {
      const date = new Date(s.started_at)
      return date >= startOfLastWeek && date < startOfThisWeek
    })

    // Calculate totals
    const totalClimbs = allSessions.reduce((sum, s) => sum + (s.total_climbs ?? 0), 0)
    const totalDuration = allSessions.reduce((sum, s) => sum + (s.actual_duration_minutes ?? 0), 0)
    
    // Calculate averages
    const sessionsWithRpe = allSessions.filter(s => s.session_rpe != null)
    const avgRpe = sessionsWithRpe.length > 0
      ? sessionsWithRpe.reduce((sum, s) => sum + (s.session_rpe ?? 0), 0) / sessionsWithRpe.length
      : 0
    
    const sessionsWithSatisfaction = allSessions.filter(s => s.satisfaction != null)
    const avgSatisfaction = sessionsWithSatisfaction.length > 0
      ? sessionsWithSatisfaction.reduce((sum, s) => sum + (s.satisfaction ?? 0), 0) / sessionsWithSatisfaction.length
      : 0

    // Find highest grade
    const gradesWithSends = allSessions
      .filter(s => s.highest_grade_sent)
      .map(s => s.highest_grade_sent!)
    const highestGrade = gradesWithSends.length > 0 ? findHighestGrade(gradesWithSends) : 'N/A'

    // Find most common session type
    const typeCounts: Record<string, number> = {}
    allSessions.forEach(s => {
      typeCounts[s.session_type] = (typeCounts[s.session_type] ?? 0) + 1
    })
    const mostCommonType = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A'

    return {
      data: {
        totalSessions: allSessions.length,
        sessionsThisWeek: sessionsThisWeek.length,
        sessionsLastWeek: sessionsLastWeek.length,
        totalClimbs,
        avgSessionRpe: Math.round(avgRpe * 10) / 10,
        avgSatisfaction: Math.round(avgSatisfaction * 10) / 10,
        highestGradeSent: highestGrade,
        mostCommonType,
        totalDurationMinutes: totalDuration,
        avgDurationMinutes: allSessions.length > 0 ? Math.round(totalDuration / allSessions.length) : 0,
      },
      error: null,
    }
  } catch (err) {
    console.error('Error getting session stats:', err)
    return { data: null, error: err as Error }
  }
}

// Helper function to compare climbing grades
function findHighestGrade(grades: string[]): string {
  // Simple grade comparison - handles V-grades and YDS
  const gradeValue = (grade: string): number => {
    // V-grade (bouldering)
    const vMatch = grade.match(/V(\d+)/)
    if (vMatch) return parseInt(vMatch[1]) * 10

    // YDS (rope climbing)
    const ydsMatch = grade.match(/5\.(\d+)([a-d])?/)
    if (ydsMatch) {
      const base = parseInt(ydsMatch[1]) * 10
      const letter = ydsMatch[2]
      const letterValue = letter ? { a: 0, b: 2, c: 4, d: 6 }[letter] ?? 0 : 0
      return base + letterValue
    }

    return 0
  }

  return grades.reduce((highest, current) => {
    return gradeValue(current) > gradeValue(highest) ? current : highest
  }, grades[0])
}

// Get sessions for a specific date range
export async function getSessionsByDateRange(
  startDate: Date,
  endDate: Date
): Promise<{ data: ClimbingSession[]; error: Error | null }> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      return { data: [], error: new Error('User not authenticated') }
    }

    const { data, error } = await supabase
      .from('climbing_sessions')
      .select('*')
      .eq('user_id', userData.user.id)
      .eq('status', 'completed')
      .gte('started_at', startDate.toISOString())
      .lte('started_at', endDate.toISOString())
      .order('started_at', { ascending: false })

    if (error) throw error
    return { data: (data as ClimbingSession[]) ?? [], error: null }
  } catch (err) {
    console.error('Error getting sessions by date range:', err)
    return { data: [], error: err as Error }
  }
}

