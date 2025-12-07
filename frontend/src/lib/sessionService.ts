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
  
  // JSONB storage for complete data
  pre_session_data: Record<string, unknown>
  post_session_data: Record<string, unknown>
  
  // Mental/Energy State
  energy_level?: number
  motivation?: number
  sleep_quality?: number
  stress_level?: number
  
  // Physical Readiness
  sleep_hours?: number
  hours_since_meal?: string
  hydration?: string
  days_since_last_session?: number
  days_since_rest_day?: number
  muscle_soreness?: string
  soreness_locations?: string[]
  
  // Substances
  had_caffeine?: boolean
  caffeine_amount?: string
  had_alcohol?: boolean
  alcohol_amount?: string
  
  // Session Intent
  primary_goal?: string
  session_focus?: string
  
  // Indoor-specific
  gym_name?: string
  
  // Outdoor-specific
  crag_name?: string
  rock_type?: string
  conditions_rating?: number
  temperature?: string
  humidity?: string
  recent_precipitation?: boolean
  
  // Project-specific
  is_project_session?: boolean
  project_name?: string
  project_session_number?: number
  current_high_point?: string
  project_goal?: string
  section_focus?: string
  
  // Training-specific
  training_focus?: string[]
  planned_exercises?: string
  target_training_time?: number
  
  // Bouldering/Lead specific
  belay_type?: string
  
  // Post-session: Core Outcomes
  session_rpe?: number
  satisfaction?: number
  actual_vs_planned?: string
  end_energy?: number
  skin_condition?: string
  felt_pumped_out?: boolean
  could_have_done_more?: string
  
  // Behavioral Proxies
  skipped_planned_climbs?: boolean
  attempted_harder?: boolean
  one_more_try_count?: number
  
  // Goal Progress
  moved_toward_goal?: string
  
  // Climbing Metrics
  highest_grade_sent?: string
  highest_grade_attempted?: string
  total_climbs?: number
  total_sends?: number
  flash_count?: number
  
  // Project Session Outcomes
  total_attempts?: number
  highest_point_reached?: string
  matched_high_point?: boolean
  linked_more_moves?: boolean
  sent_project?: boolean
  send_attempts?: number
  fall_location?: string
  same_crux?: boolean
  crux_type?: string
  limiting_factors?: string[]
  beta_changes?: string
  
  // Lead Session Outcomes
  routes_attempted?: number
  total_pitches?: number
  onsight_rate?: number
  falls_count?: number
  fall_types?: string[]
  longest_route?: string
  rest_time_between_routes?: number
  head_game_falls?: number
  backed_off_due_to_fear?: boolean
  
  // Outdoor Session Outcomes
  conditions_vs_expected?: string
  skin_lasted?: boolean
  conditions_affected_performance?: string
  rock_quality?: string
  
  // Recreational
  had_fun?: boolean
  standout_moments?: string
  
  // Training Session Outcomes
  exercises_completed?: Record<string, unknown>[]
  training_quality?: number
  progressed_or_regressed?: string
  prs_achieved?: string[]
  
  // Pain/Injury
  had_pain_before?: boolean
  had_pain_after?: boolean
  pain_location?: string
  pain_severity?: number
  
  // Live Climb Tracking (type can be 'boulder', 'sport', 'trad', 'lead', etc.)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  climbs_log?: any[]
  
  // Notes
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
  
  // Custom start time for historical entries (model testing)
  custom_started_at?: string
  
  // Mental/Energy State
  energy_level?: number
  motivation?: number
  sleep_quality?: number
  stress_level?: number
  
  // Physical Readiness
  sleep_hours?: number
  hours_since_meal?: string
  hydration?: string
  days_since_last_session?: number
  days_since_rest_day?: number
  muscle_soreness?: string
  soreness_locations?: string[]
  
  // Substances
  had_caffeine?: boolean
  caffeine_amount?: string
  had_alcohol?: boolean
  alcohol_amount?: string
  
  // Session Intent
  primary_goal?: string
  session_focus?: string
  
  // Indoor-specific
  gym_name?: string
  
  // Outdoor-specific
  crag_name?: string
  rock_type?: string
  conditions_rating?: number
  temperature?: string
  humidity?: string
  recent_precipitation?: boolean
  
  // Project-specific
  is_project_session?: boolean
  project_name?: string
  project_session_number?: number
  current_high_point?: string
  project_goal?: string
  section_focus?: string
  
  // Training-specific
  training_focus?: string[]
  planned_exercises?: string
  target_training_time?: number
  
  // Bouldering/Lead specific
  belay_type?: string
  
  // Pain/Injury
  had_pain_before?: boolean
  pain_location?: string
  pain_severity?: number
  
  // Notes
  notes?: string
}

export interface CompleteSessionInput {
  session_id: string
  post_session_data?: Record<string, unknown>
  
  // Core Outcomes
  session_rpe?: number
  satisfaction?: number
  actual_vs_planned?: string
  end_energy?: number
  skin_condition?: string
  felt_pumped_out?: boolean
  could_have_done_more?: string
  
  // Behavioral Proxies
  skipped_planned_climbs?: boolean
  attempted_harder?: boolean
  one_more_try_count?: number
  
  // Goal Progress
  moved_toward_goal?: string
  
  // Climbing Metrics
  highest_grade_sent?: string
  highest_grade_attempted?: string
  total_climbs?: number
  total_sends?: number
  flash_count?: number
  
  // Project Session Outcomes
  total_attempts?: number
  highest_point_reached?: string
  matched_high_point?: boolean
  linked_more_moves?: boolean
  sent_project?: boolean
  send_attempts?: number
  fall_location?: string
  same_crux?: boolean
  crux_type?: string
  limiting_factors?: string[]
  beta_changes?: string
  
  // Lead Session Outcomes
  routes_attempted?: number
  total_pitches?: number
  onsight_rate?: number
  falls_count?: number
  fall_types?: string[]
  longest_route?: string
  rest_time_between_routes?: number
  head_game_falls?: number
  backed_off_due_to_fear?: boolean
  
  // Outdoor Session Outcomes
  conditions_vs_expected?: string
  skin_lasted?: boolean
  conditions_affected_performance?: string
  rock_quality?: string
  
  // Recreational
  had_fun?: boolean
  standout_moments?: string
  
  // Training Session Outcomes
  exercises_completed?: Record<string, unknown>[]
  training_quality?: number
  progressed_or_regressed?: string
  prs_achieved?: string[]
  
  // Pain/Injury
  had_pain_after?: boolean
  pain_location?: string
  pain_severity?: number
  
  // Live Climb Tracking (type can be 'boulder', 'sport', 'trad', 'lead', etc.)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  climbs_log?: any[]
  
  // Timing
  actual_start_time?: string
  actual_end_time?: string
  
  // Notes
  notes?: string
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

    const userId = userData.user.id

    // Use custom start time for historical entries, otherwise use current time
    const startedAt = input.custom_started_at || new Date().toISOString()
    
    const { data, error } = await supabase
      .from('climbing_sessions')
      .insert({
        user_id: userId,
        session_type: input.session_type,
        location: input.location,
        is_outdoor: input.is_outdoor ?? false,
        started_at: startedAt,
        planned_duration_minutes: input.planned_duration_minutes,
        goal_id: input.goal_id,
        status: input.custom_started_at ? 'completed' : 'active',  // Historical entries are pre-completed
        
        // Store complete pre_session_data as JSONB
        pre_session_data: input.pre_session_data ?? {},
        
        // Mental/Energy State
        energy_level: input.energy_level,
        motivation: input.motivation,
        sleep_quality: input.sleep_quality,
        stress_level: input.stress_level,
        
        // Physical Readiness
        sleep_hours: input.sleep_hours,
        hours_since_meal: input.hours_since_meal,
        hydration: input.hydration,
        days_since_last_session: input.days_since_last_session,
        days_since_rest_day: input.days_since_rest_day,
        muscle_soreness: input.muscle_soreness,
        soreness_locations: input.soreness_locations,
        
        // Substances
        had_caffeine: input.had_caffeine,
        caffeine_amount: input.caffeine_amount,
        had_alcohol: input.had_alcohol,
        alcohol_amount: input.alcohol_amount,
        
        // Session Intent
        primary_goal: input.primary_goal,
        session_focus: input.session_focus,
        
        // Indoor-specific
        gym_name: input.gym_name,
        
        // Outdoor-specific
        crag_name: input.crag_name,
        rock_type: input.rock_type,
        conditions_rating: input.conditions_rating,
        temperature: input.temperature,
        humidity: input.humidity,
        recent_precipitation: input.recent_precipitation,
        
        // Project-specific
        is_project_session: input.is_project_session,
        project_name: input.project_name,
        project_session_number: input.project_session_number,
        current_high_point: input.current_high_point,
        project_goal: input.project_goal,
        section_focus: input.section_focus,
        
        // Training-specific
        training_focus: input.training_focus,
        planned_exercises: input.planned_exercises,
        target_training_time: input.target_training_time,
        
        // Bouldering/Lead specific
        belay_type: input.belay_type,
        
        // Pain/Injury
        had_pain_before: input.had_pain_before,
        pain_location: input.pain_location,
        pain_severity: input.pain_severity,
        
        // Notes
        notes: input.notes,
      } as SupabaseData)
      .select()
      .single()

    if (error) throw error
    
    const session = data as ClimbingSession

    // Also insert into the pre_session_data table for normalized storage
    if (input.pre_session_data && session) {
      const pre = input.pre_session_data
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('pre_session_data') as any).insert({
          session_id: session.id,
          user_id: userId,
          // A. Context & Environment
          session_environment: pre.session_environment ?? null,
          planned_duration: pre.planned_duration ?? null,
          partner_status: pre.partner_status ?? null,
          crowdedness: pre.crowdedness ?? null,
          // B. Systemic Recovery & Lifestyle
          sleep_quality: pre.sleep_quality ?? null,
          sleep_hours: pre.sleep_hours ?? null,
          stress_level: pre.stress_level ?? null,
          fueling_status: pre.fueling_status ?? null,
          hydration_feel: pre.hydration_feel ?? null,
          skin_condition: pre.skin_condition ?? null,
          finger_tendon_health: pre.finger_tendon_health ?? null,
          doms_locations: pre.doms_locations ?? null,
          doms_severity: pre.doms_severity ?? null,
          menstrual_phase: pre.menstrual_phase ?? null,
          // C. Intent & Psych
          motivation: pre.motivation ?? null,
          primary_goal: pre.primary_goal ?? null,
          // D. Physical Readiness
          warmup_rpe: pre.warmup_rpe ?? null,
          warmup_compliance: pre.warmup_compliance ?? null,
          upper_body_power: pre.upper_body_power ?? null,
          shoulder_integrity: pre.shoulder_integrity ?? null,
          leg_springiness: pre.leg_springiness ?? null,
          finger_strength: pre.finger_strength ?? null,
        })
      } catch (preErr) {
        console.warn('Warning: Failed to insert pre_session_data:', preErr)
        // Don't fail the main operation
      }
    }

    return { data: session, error: null }
  } catch (err) {
    console.error('Error creating session:', err)
    return { data: null, error: err as Error }
  }
}

// Complete a session (post-session form submission)
export async function completeSession(input: CompleteSessionInput): Promise<{ data: ClimbingSession | null; error: Error | null }> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      return { data: null, error: new Error('User not authenticated') }
    }

    const userId = userData.user.id
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
        
        // Store complete post_session_data as JSONB
        post_session_data: input.post_session_data ?? {},
        
        // Core Outcomes
        session_rpe: input.session_rpe,
        satisfaction: input.satisfaction,
        actual_vs_planned: input.actual_vs_planned,
        end_energy: input.end_energy,
        skin_condition: input.skin_condition,
        felt_pumped_out: input.felt_pumped_out,
        could_have_done_more: input.could_have_done_more,
        
        // Behavioral Proxies
        skipped_planned_climbs: input.skipped_planned_climbs,
        attempted_harder: input.attempted_harder,
        one_more_try_count: input.one_more_try_count,
        
        // Goal Progress
        moved_toward_goal: input.moved_toward_goal,
        
        // Climbing Metrics
        highest_grade_sent: input.highest_grade_sent,
        highest_grade_attempted: input.highest_grade_attempted,
        total_climbs: input.total_climbs,
        total_sends: input.total_sends,
        flash_count: input.flash_count,
        
        // Project Session Outcomes
        total_attempts: input.total_attempts,
        highest_point_reached: input.highest_point_reached,
        matched_high_point: input.matched_high_point,
        linked_more_moves: input.linked_more_moves,
        sent_project: input.sent_project,
        send_attempts: input.send_attempts,
        fall_location: input.fall_location,
        same_crux: input.same_crux,
        crux_type: input.crux_type,
        limiting_factors: input.limiting_factors,
        beta_changes: input.beta_changes,
        
        // Lead Session Outcomes
        routes_attempted: input.routes_attempted,
        total_pitches: input.total_pitches,
        onsight_rate: input.onsight_rate,
        falls_count: input.falls_count,
        fall_types: input.fall_types,
        longest_route: input.longest_route,
        rest_time_between_routes: input.rest_time_between_routes,
        head_game_falls: input.head_game_falls,
        backed_off_due_to_fear: input.backed_off_due_to_fear,
        
        // Outdoor Session Outcomes
        conditions_vs_expected: input.conditions_vs_expected,
        skin_lasted: input.skin_lasted,
        conditions_affected_performance: input.conditions_affected_performance,
        rock_quality: input.rock_quality,
        
        // Recreational
        had_fun: input.had_fun,
        standout_moments: input.standout_moments,
        
        // Training Session Outcomes
        exercises_completed: input.exercises_completed,
        training_quality: input.training_quality,
        progressed_or_regressed: input.progressed_or_regressed,
        prs_achieved: input.prs_achieved,
        
        // Pain/Injury
        had_pain_after: input.had_pain_after,
        pain_location: input.pain_location,
        pain_severity: input.pain_severity,
        
        // Live Climb Tracking
        climbs_log: input.climbs_log,
        
        // Notes
        notes: input.notes,
        
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.session_id)
      .select()
      .single()

    if (error) throw error
    
    const completedSession = data as ClimbingSession

    // Also insert into the post_session_data table for normalized storage
    if (input.post_session_data) {
      const post = input.post_session_data
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('post_session_data') as any).insert({
          session_id: input.session_id,
          user_id: userId,
          // A. Objective Performance
          hardest_grade_sent: post.hardest_grade_sent ?? null,
          hardest_grade_attempted: post.hardest_grade_attempted ?? null,
          volume_estimation: post.volume_estimation ?? null,
          strength_metrics: post.strength_metrics ?? [],
          dominant_style: post.dominant_style ?? null,
          // B. Subjective Experience
          rpe: post.rpe ?? null,
          session_density: post.session_density ?? null,
          intra_session_fueling: post.intra_session_fueling ?? null,
          // C. Failure Analysis
          limiting_factors: post.limiting_factors ?? null,
          flash_pump: post.flash_pump ?? null,
          // D. Health & Injury Update
          new_pain_location: post.new_pain_location ?? null,
          new_pain_severity: post.new_pain_severity ?? null,
          fingers_stiffer_than_usual: post.fingers_stiffer_than_usual ?? null,
          skin_status_post: post.skin_status_post ?? null,
          doms_severity_post: post.doms_severity_post ?? null,
          finger_power_post: post.finger_power_post ?? null,
          shoulder_mobility_post: post.shoulder_mobility_post ?? null,
          // E. Learning Loop
          prediction_error: post.prediction_error ?? null,
        })
      } catch (postErr) {
        console.warn('Warning: Failed to insert post_session_data:', postErr)
        // Don't fail the main operation
      }
    }

    return { data: completedSession, error: null }
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

// Check if user can start a new session (must be at least 1 hour since last session)
export async function canStartNewSession(): Promise<{ 
  canStart: boolean; 
  minutesUntilAllowed?: number;
  lastSessionTime?: Date;
  activeSessionId?: string;
  activeSessionStartedAt?: string;
  error: Error | null 
}> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      return { canStart: false, error: new Error('User not authenticated') }
    }

    // Get the most recent completed session
    const { data, error } = await supabase
      .from('climbing_sessions')
      .select('id, started_at, ended_at, status')
      .eq('user_id', userData.user.id)
      .in('status', ['completed', 'active'])
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 means no rows returned, which is fine
      throw error
    }

    // If no sessions exist, user can start
    if (!data) {
      return { canStart: true, error: null }
    }

    const session = data as { id: string; started_at: string; ended_at?: string; status: string }
    
    // If there's an active session, they can't start another
    if (session.status === 'active') {
      return { 
        canStart: false, 
        minutesUntilAllowed: 0,
        activeSessionId: session.id,
        activeSessionStartedAt: session.started_at,
        error: new Error('You already have an active session. Please complete or cancel it first.')
      }
    }

    // Check if at least 1 hour has passed since the session ended (or started if no end time)
    const sessionTime = session.ended_at ? new Date(session.ended_at) : new Date(session.started_at)
    const now = new Date()
    const hourInMs = 60 * 60 * 1000 // 1 hour in milliseconds
    const timeSinceSession = now.getTime() - sessionTime.getTime()
    
    if (timeSinceSession < hourInMs) {
      const minutesRemaining = Math.ceil((hourInMs - timeSinceSession) / 60000)
      return { 
        canStart: false, 
        minutesUntilAllowed: minutesRemaining,
        lastSessionTime: sessionTime,
        error: null 
      }
    }

    return { canStart: true, error: null }
  } catch (err) {
    console.error('Error checking if can start session:', err)
    return { canStart: false, error: err as Error }
  }
}

// Delete a session
export async function deleteSession(sessionId: string): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      return { success: false, error: new Error('User not authenticated') }
    }

    const { error } = await supabase
      .from('climbing_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', userData.user.id) // Ensure user can only delete their own sessions

    if (error) throw error
    return { success: true, error: null }
  } catch (err) {
    console.error('Error deleting session:', err)
    return { success: false, error: err as Error }
  }
}

// Update session input type - includes all fields from ClimbingSession
export interface UpdateSessionInput {
  session_id: string
  session_type?: string
  location?: string
  is_outdoor?: boolean
  started_at?: string
  ended_at?: string
  planned_duration_minutes?: number
  actual_duration_minutes?: number
  pre_session_data?: Record<string, unknown>
  post_session_data?: Record<string, unknown>
  
  // Mental/Energy State
  energy_level?: number
  motivation?: number
  sleep_quality?: number
  stress_level?: number
  
  // Physical Readiness
  sleep_hours?: number
  hours_since_meal?: string
  hydration?: string
  days_since_last_session?: number
  days_since_rest_day?: number
  muscle_soreness?: string
  soreness_locations?: string[]
  
  // Substances
  had_caffeine?: boolean
  caffeine_amount?: string
  had_alcohol?: boolean
  alcohol_amount?: string
  
  // Session Intent
  primary_goal?: string
  session_focus?: string
  
  // Indoor-specific
  gym_name?: string
  
  // Outdoor-specific
  crag_name?: string
  rock_type?: string
  conditions_rating?: number
  temperature?: string
  humidity?: string
  recent_precipitation?: boolean
  
  // Project-specific
  is_project_session?: boolean
  project_name?: string
  project_session_number?: number
  current_high_point?: string
  project_goal?: string
  section_focus?: string
  
  // Training-specific
  training_focus?: string[]
  planned_exercises?: string
  target_training_time?: number
  
  // Bouldering/Lead specific
  belay_type?: string
  
  // Post-session: Core Outcomes
  session_rpe?: number
  satisfaction?: number
  actual_vs_planned?: string
  end_energy?: number
  skin_condition?: string
  felt_pumped_out?: boolean
  could_have_done_more?: string
  
  // Behavioral Proxies
  skipped_planned_climbs?: boolean
  attempted_harder?: boolean
  one_more_try_count?: number
  
  // Goal Progress
  moved_toward_goal?: string
  
  // Climbing Metrics
  highest_grade_sent?: string
  highest_grade_attempted?: string
  total_climbs?: number
  total_sends?: number
  flash_count?: number
  
  // Project Session Outcomes
  total_attempts?: number
  highest_point_reached?: string
  matched_high_point?: boolean
  linked_more_moves?: boolean
  sent_project?: boolean
  send_attempts?: number
  fall_location?: string
  same_crux?: boolean
  crux_type?: string
  limiting_factors?: string[]
  beta_changes?: string
  
  // Lead Session Outcomes
  routes_attempted?: number
  total_pitches?: number
  onsight_rate?: number
  falls_count?: number
  fall_types?: string[]
  longest_route?: string
  rest_time_between_routes?: number
  head_game_falls?: number
  backed_off_due_to_fear?: boolean
  
  // Outdoor Session Outcomes
  conditions_vs_expected?: string
  skin_lasted?: boolean
  conditions_affected_performance?: string
  rock_quality?: string
  
  // Recreational
  had_fun?: boolean
  standout_moments?: string
  
  // Training Session Outcomes
  exercises_completed?: Record<string, unknown>[]
  training_quality?: number
  progressed_or_regressed?: string
  prs_achieved?: string[]
  
  // Pain/Injury
  had_pain_before?: boolean
  had_pain_after?: boolean
  pain_location?: string
  pain_severity?: number
  
  // Live Climb Tracking (type can be 'boulder', 'sport', 'trad', 'lead', etc.)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  climbs_log?: any[]
  
  // Notes
  notes?: string
}

// Update a session (edit session details later)
export async function updateSession(input: UpdateSessionInput): Promise<{ data: ClimbingSession | null; error: Error | null }> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      return { data: null, error: new Error('User not authenticated') }
    }

    // Build update object only with provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    // Basic session fields
    if (input.session_type !== undefined) updateData.session_type = input.session_type
    if (input.location !== undefined) updateData.location = input.location
    if (input.is_outdoor !== undefined) updateData.is_outdoor = input.is_outdoor
    if (input.started_at !== undefined) updateData.started_at = input.started_at
    if (input.ended_at !== undefined) updateData.ended_at = input.ended_at
    if (input.planned_duration_minutes !== undefined) updateData.planned_duration_minutes = input.planned_duration_minutes
    if (input.actual_duration_minutes !== undefined) updateData.actual_duration_minutes = input.actual_duration_minutes
    if (input.pre_session_data !== undefined) updateData.pre_session_data = input.pre_session_data
    if (input.post_session_data !== undefined) updateData.post_session_data = input.post_session_data
    
    // Mental/Energy State
    if (input.energy_level !== undefined) updateData.energy_level = input.energy_level
    if (input.motivation !== undefined) updateData.motivation = input.motivation
    if (input.sleep_quality !== undefined) updateData.sleep_quality = input.sleep_quality
    if (input.stress_level !== undefined) updateData.stress_level = input.stress_level
    
    // Physical Readiness
    if (input.sleep_hours !== undefined) updateData.sleep_hours = input.sleep_hours
    if (input.hours_since_meal !== undefined) updateData.hours_since_meal = input.hours_since_meal
    if (input.hydration !== undefined) updateData.hydration = input.hydration
    if (input.days_since_last_session !== undefined) updateData.days_since_last_session = input.days_since_last_session
    if (input.days_since_rest_day !== undefined) updateData.days_since_rest_day = input.days_since_rest_day
    if (input.muscle_soreness !== undefined) updateData.muscle_soreness = input.muscle_soreness
    if (input.soreness_locations !== undefined) updateData.soreness_locations = input.soreness_locations
    
    // Substances
    if (input.had_caffeine !== undefined) updateData.had_caffeine = input.had_caffeine
    if (input.caffeine_amount !== undefined) updateData.caffeine_amount = input.caffeine_amount
    if (input.had_alcohol !== undefined) updateData.had_alcohol = input.had_alcohol
    if (input.alcohol_amount !== undefined) updateData.alcohol_amount = input.alcohol_amount
    
    // Session Intent
    if (input.primary_goal !== undefined) updateData.primary_goal = input.primary_goal
    if (input.session_focus !== undefined) updateData.session_focus = input.session_focus
    
    // Indoor-specific
    if (input.gym_name !== undefined) updateData.gym_name = input.gym_name
    
    // Outdoor-specific
    if (input.crag_name !== undefined) updateData.crag_name = input.crag_name
    if (input.rock_type !== undefined) updateData.rock_type = input.rock_type
    if (input.conditions_rating !== undefined) updateData.conditions_rating = input.conditions_rating
    if (input.temperature !== undefined) updateData.temperature = input.temperature
    if (input.humidity !== undefined) updateData.humidity = input.humidity
    if (input.recent_precipitation !== undefined) updateData.recent_precipitation = input.recent_precipitation
    
    // Project-specific
    if (input.is_project_session !== undefined) updateData.is_project_session = input.is_project_session
    if (input.project_name !== undefined) updateData.project_name = input.project_name
    if (input.project_session_number !== undefined) updateData.project_session_number = input.project_session_number
    if (input.current_high_point !== undefined) updateData.current_high_point = input.current_high_point
    if (input.project_goal !== undefined) updateData.project_goal = input.project_goal
    if (input.section_focus !== undefined) updateData.section_focus = input.section_focus
    
    // Training-specific
    if (input.training_focus !== undefined) updateData.training_focus = input.training_focus
    if (input.planned_exercises !== undefined) updateData.planned_exercises = input.planned_exercises
    if (input.target_training_time !== undefined) updateData.target_training_time = input.target_training_time
    
    // Bouldering/Lead specific
    if (input.belay_type !== undefined) updateData.belay_type = input.belay_type
    
    // Post-session: Core Outcomes
    if (input.session_rpe !== undefined) updateData.session_rpe = input.session_rpe
    if (input.satisfaction !== undefined) updateData.satisfaction = input.satisfaction
    if (input.actual_vs_planned !== undefined) updateData.actual_vs_planned = input.actual_vs_planned
    if (input.end_energy !== undefined) updateData.end_energy = input.end_energy
    if (input.skin_condition !== undefined) updateData.skin_condition = input.skin_condition
    if (input.felt_pumped_out !== undefined) updateData.felt_pumped_out = input.felt_pumped_out
    if (input.could_have_done_more !== undefined) updateData.could_have_done_more = input.could_have_done_more
    
    // Behavioral Proxies
    if (input.skipped_planned_climbs !== undefined) updateData.skipped_planned_climbs = input.skipped_planned_climbs
    if (input.attempted_harder !== undefined) updateData.attempted_harder = input.attempted_harder
    if (input.one_more_try_count !== undefined) updateData.one_more_try_count = input.one_more_try_count
    
    // Goal Progress
    if (input.moved_toward_goal !== undefined) updateData.moved_toward_goal = input.moved_toward_goal
    
    // Climbing Metrics
    if (input.highest_grade_sent !== undefined) updateData.highest_grade_sent = input.highest_grade_sent
    if (input.highest_grade_attempted !== undefined) updateData.highest_grade_attempted = input.highest_grade_attempted
    if (input.total_climbs !== undefined) updateData.total_climbs = input.total_climbs
    if (input.total_sends !== undefined) updateData.total_sends = input.total_sends
    if (input.flash_count !== undefined) updateData.flash_count = input.flash_count
    
    // Project Session Outcomes
    if (input.total_attempts !== undefined) updateData.total_attempts = input.total_attempts
    if (input.highest_point_reached !== undefined) updateData.highest_point_reached = input.highest_point_reached
    if (input.matched_high_point !== undefined) updateData.matched_high_point = input.matched_high_point
    if (input.linked_more_moves !== undefined) updateData.linked_more_moves = input.linked_more_moves
    if (input.sent_project !== undefined) updateData.sent_project = input.sent_project
    if (input.send_attempts !== undefined) updateData.send_attempts = input.send_attempts
    if (input.fall_location !== undefined) updateData.fall_location = input.fall_location
    if (input.same_crux !== undefined) updateData.same_crux = input.same_crux
    if (input.crux_type !== undefined) updateData.crux_type = input.crux_type
    if (input.limiting_factors !== undefined) updateData.limiting_factors = input.limiting_factors
    if (input.beta_changes !== undefined) updateData.beta_changes = input.beta_changes
    
    // Lead Session Outcomes
    if (input.routes_attempted !== undefined) updateData.routes_attempted = input.routes_attempted
    if (input.total_pitches !== undefined) updateData.total_pitches = input.total_pitches
    if (input.onsight_rate !== undefined) updateData.onsight_rate = input.onsight_rate
    if (input.falls_count !== undefined) updateData.falls_count = input.falls_count
    if (input.fall_types !== undefined) updateData.fall_types = input.fall_types
    if (input.longest_route !== undefined) updateData.longest_route = input.longest_route
    if (input.rest_time_between_routes !== undefined) updateData.rest_time_between_routes = input.rest_time_between_routes
    if (input.head_game_falls !== undefined) updateData.head_game_falls = input.head_game_falls
    if (input.backed_off_due_to_fear !== undefined) updateData.backed_off_due_to_fear = input.backed_off_due_to_fear
    
    // Outdoor Session Outcomes
    if (input.conditions_vs_expected !== undefined) updateData.conditions_vs_expected = input.conditions_vs_expected
    if (input.skin_lasted !== undefined) updateData.skin_lasted = input.skin_lasted
    if (input.conditions_affected_performance !== undefined) updateData.conditions_affected_performance = input.conditions_affected_performance
    if (input.rock_quality !== undefined) updateData.rock_quality = input.rock_quality
    
    // Recreational
    if (input.had_fun !== undefined) updateData.had_fun = input.had_fun
    if (input.standout_moments !== undefined) updateData.standout_moments = input.standout_moments
    
    // Training Session Outcomes
    if (input.exercises_completed !== undefined) updateData.exercises_completed = input.exercises_completed
    if (input.training_quality !== undefined) updateData.training_quality = input.training_quality
    if (input.progressed_or_regressed !== undefined) updateData.progressed_or_regressed = input.progressed_or_regressed
    if (input.prs_achieved !== undefined) updateData.prs_achieved = input.prs_achieved
    
    // Pain/Injury
    if (input.had_pain_before !== undefined) updateData.had_pain_before = input.had_pain_before
    if (input.had_pain_after !== undefined) updateData.had_pain_after = input.had_pain_after
    if (input.pain_location !== undefined) updateData.pain_location = input.pain_location
    if (input.pain_severity !== undefined) updateData.pain_severity = input.pain_severity
    
    // Live Climb Tracking
    if (input.climbs_log !== undefined) updateData.climbs_log = input.climbs_log
    
    // Notes
    if (input.notes !== undefined) updateData.notes = input.notes

    // Recalculate duration if times changed
    if (input.started_at && input.ended_at) {
      const start = new Date(input.started_at)
      const end = new Date(input.ended_at)
      updateData.actual_duration_minutes = Math.round((end.getTime() - start.getTime()) / 60000)
    }

    const { data, error } = await (supabase as any)
      .from('climbing_sessions')
      .update(updateData)
      .eq('id', input.session_id)
      .eq('user_id', userData.user.id) // Ensure user can only update their own sessions
      .select()
      .single()

    if (error) throw error
    return { data: data as ClimbingSession, error: null }
  } catch (err) {
    console.error('Error updating session:', err)
    return { data: null, error: err as Error }
  }
}

// Get a single session by ID
export async function getSessionById(sessionId: string): Promise<{ data: ClimbingSession | null; error: Error | null }> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      return { data: null, error: new Error('User not authenticated') }
    }

    const { data, error } = await supabase
      .from('climbing_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userData.user.id)
      .single()

    if (error) throw error
    return { data: data as ClimbingSession, error: null }
  } catch (err) {
    console.error('Error getting session:', err)
    return { data: null, error: err as Error }
  }
}

