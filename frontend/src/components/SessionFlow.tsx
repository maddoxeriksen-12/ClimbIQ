import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { PreSessionForm } from './PreSessionForm'
import { PostSessionForm } from './PostSessionForm'
import { AnalysisScreen } from './AnalysisScreen'
import { RecommendationsScreen } from './RecommendationsScreen'
import { getStoredClimbs, clearStoredClimbs } from './LiveClimbTracker'
import { saveActiveSession, getActiveSession, clearActiveSession } from '../lib/sessionStorage'
import { createSession, completeSession, canStartNewSession, cancelSession } from '../lib/sessionService'
import { getActiveGoal } from '../lib/goalService'
import type { ActiveSessionData } from '../lib/sessionStorage'

type SessionPhase = 'pre' | 'analyzing' | 'recommendations' | 'active' | 'post' | 'complete' | 'cooldown' | 'has_active'

interface CooldownInfo {
  minutesRemaining: number
  lastSessionTime: Date
}

interface ActiveSessionInfo {
  sessionId: string
  startedAt: Date
}

export function SessionFlow() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<SessionPhase>('pre')
  const [cooldownInfo, setCooldownInfo] = useState<CooldownInfo | null>(null)
  const [activeSessionInfo, setActiveSessionInfo] = useState<ActiveSessionInfo | null>(null)
  const [checkingCooldown, setCheckingCooldown] = useState(true)
  const [isCancelling, setIsCancelling] = useState(false)

  // Check if user can start a new session
  useEffect(() => {
    async function checkCooldown() {
      setCheckingCooldown(true)
      const result = await canStartNewSession()
      
      if (result.error && result.error.message.includes('active session')) {
        // User has an active session - check if there's local storage data
        const localSession = getActiveSession()
        if (localSession && localSession.sessionId) {
          // They have local data, redirect to complete
          navigate('/session/complete')
        } else if (result.activeSessionId && result.activeSessionStartedAt) {
          // They have a DB session but no local data - show option to cancel or continue
          setActiveSessionInfo({
            sessionId: result.activeSessionId,
            startedAt: new Date(result.activeSessionStartedAt),
          })
          setPhase('has_active')
        } else {
          // Fallback - just show the form (shouldn't happen)
          setPhase('pre')
        }
        setCheckingCooldown(false)
        return
      }
      
      if (!result.canStart && result.minutesUntilAllowed && result.lastSessionTime) {
        setCooldownInfo({
          minutesRemaining: result.minutesUntilAllowed,
          lastSessionTime: result.lastSessionTime,
        })
        setPhase('cooldown')
      }
      setCheckingCooldown(false)
    }
    checkCooldown()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle cancelling an orphaned active session
  const handleCancelOrphanedSession = async () => {
    if (!activeSessionInfo) return
    
    setIsCancelling(true)
    try {
      await cancelSession(activeSessionInfo.sessionId)
      clearActiveSession()
      clearStoredClimbs()
      setActiveSessionInfo(null)
      setPhase('pre')
    } catch (err) {
      console.error('Failed to cancel session:', err)
      alert('Failed to cancel session. Please try again.')
    } finally {
      setIsCancelling(false)
    }
  }

  // Handle continuing an orphaned active session
  const handleContinueOrphanedSession = () => {
    if (!activeSessionInfo) return
    
    // Create local storage data from the active session
    const localSession: ActiveSessionData = {
      sessionId: activeSessionInfo.sessionId,
      sessionType: 'unknown', // We don't have this info
      location: '',
      startTime: activeSessionInfo.startedAt,
      isOutdoor: false,
      plannedDuration: 90,
      preSessionData: {},
    }
    saveActiveSession(localSession)
    navigate('/session/complete')
  }
  const [sessionInfo, setSessionInfo] = useState<ActiveSessionData | null>(null)
  const [dbSessionId, setDbSessionId] = useState<string | null>(null)
  const [isHistoricalSession, setIsHistoricalSession] = useState(false)

  const handlePreSessionComplete = async (info: { 
    sessionType: string
    location: string
    isOutdoor?: boolean
    plannedDuration?: number
    preSessionData?: Record<string, unknown>
    customDateTime?: Date
  }) => {
    // Get active goal to associate session with it
    const { data: activeGoal } = await getActiveGoal()
    const pre = info.preSessionData || {}
    const isHistorical = !!info.customDateTime

    // Create session in database with ALL pre-session fields
    const { data: dbSession, error } = await createSession({
      session_type: info.sessionType,
      location: info.location,
      is_outdoor: info.isOutdoor,
      planned_duration_minutes: info.plannedDuration,
      goal_id: activeGoal?.id,
      
      // Custom start time for historical entries (model testing)
      custom_started_at: info.customDateTime?.toISOString(),
      
      // Store complete pre_session_data as JSONB for backup
      pre_session_data: pre,
      
      // Mental/Energy State
      energy_level: pre.energy_level as number,
      motivation: pre.motivation as number,
      sleep_quality: pre.sleep_quality as number,
      stress_level: pre.stress_level as number,
      
      // Physical Readiness
      sleep_hours: pre.sleep_hours as number,
      hours_since_meal: pre.hours_since_meal as string,
      hydration: pre.hydration as string,
      days_since_last_session: pre.days_since_last_session as number,
      days_since_rest_day: pre.days_since_rest_day as number,
      muscle_soreness: pre.muscle_soreness as string,
      soreness_locations: pre.soreness_locations as string[],
      
      // Substances
      had_caffeine: pre.had_caffeine as boolean,
      caffeine_amount: pre.caffeine_amount as string,
      had_alcohol: pre.had_alcohol as boolean,
      alcohol_amount: pre.alcohol_amount as string,
      
      // Session Intent
      primary_goal: pre.primary_goal as string,
      session_focus: pre.session_focus as string,
      
      // Indoor-specific
      gym_name: pre.gym_name as string,
      
      // Outdoor-specific
      crag_name: pre.crag_name as string,
      rock_type: pre.rock_type as string,
      conditions_rating: pre.conditions_rating as number,
      temperature: pre.temperature as string,
      humidity: pre.humidity as string,
      recent_precipitation: pre.recent_precipitation as boolean,
      
      // Project-specific
      is_project_session: pre.is_project_session as boolean,
      project_name: pre.project_name as string,
      project_session_number: pre.project_session_number as number,
      current_high_point: pre.current_high_point as string,
      project_goal: pre.project_goal as string,
      section_focus: pre.section_focus as string,
      
      // Training-specific
      training_focus: pre.training_focus as string[],
      planned_exercises: pre.planned_exercises as string,
      target_training_time: pre.target_training_time as number,
      
      // Bouldering/Lead specific
      belay_type: pre.belay_type as string,
      
      // Pain/Injury
      had_pain_before: pre.has_pain as boolean,
      pain_location: pre.pain_location as string,
      pain_severity: pre.pain_severity as number,
      
      // Notes
      notes: pre.notes as string,
    })

    if (error) {
      console.error('Failed to create session in database:', error)
      // Continue anyway with local storage as fallback
    }

    if (dbSession) {
      setDbSessionId(dbSession.id)
    }

    const newSession: ActiveSessionData = {
      sessionId: dbSession?.id,
      sessionType: info.sessionType,
      location: info.location,
      startTime: info.customDateTime || new Date(),
      isOutdoor: info.isOutdoor ?? false,
      plannedDuration: info.plannedDuration ?? 90,
      preSessionData: info.preSessionData || {},
    }
    setSessionInfo(newSession)
    
    // For historical entries, skip analysis and go directly to post-session form
    if (isHistorical) {
      setIsHistoricalSession(true)
      setPhase('post')
    } else {
      setIsHistoricalSession(false)
      setPhase('analyzing')
    }
  }

  const handleAnalysisComplete = () => {
    setPhase('recommendations')
  }

  const handleRecommendationsContinue = () => {
    if (sessionInfo) {
      // Save the active session so it persists (includes dbSessionId)
      saveActiveSession(sessionInfo)
    }
    // Navigate to dashboard where user can see their session and access post-form
    navigate('/')
  }

  const handlePostSessionComplete = async (postData: unknown) => {
    const post = postData as Record<string, unknown>
    
    // Extract time correction data if provided (for historical entries or manual corrections)
    const timeCorrection = post.timeCorrection as { actualStartTime?: string; actualEndTime?: string } | undefined
    
    // Get live climb data from tracker
    const liveClimbs = getStoredClimbs()
    const totalClimbs = liveClimbs.length || (post.total_climbs as number)
    const totalSends = liveClimbs.filter(c => c.sent).length || (post.total_sends as number)
    const flashCount = liveClimbs.filter(c => c.flashed).length || (post.flash_count as number)
    
    // Calculate highest grade from live climbs
    const sentClimbs = liveClimbs.filter(c => c.sent)
    const highestGradeSent = sentClimbs.length > 0 
      ? sentClimbs.sort((a, b) => getGradeValue(b.grade) - getGradeValue(a.grade))[0].grade
      : (post.highest_grade_sent as string)
    const highestGradeAttempted = liveClimbs.length > 0
      ? liveClimbs.sort((a, b) => getGradeValue(b.grade) - getGradeValue(a.grade))[0].grade
      : (post.highest_grade_attempted as string)
    
    // Complete session in database with ALL post-session fields
    if (dbSessionId || sessionInfo?.sessionId) {
      const sessionId = dbSessionId || sessionInfo?.sessionId
      const { error } = await completeSession({
        session_id: sessionId!,
        
        // Time correction - critical for historical entries
        actual_start_time: timeCorrection?.actualStartTime,
        actual_end_time: timeCorrection?.actualEndTime,
        
        // Store complete post_session_data as JSONB for backup
        post_session_data: { ...post, live_climbs: liveClimbs },
        
        // Core Outcomes
        session_rpe: post.session_rpe as number,
        satisfaction: post.satisfaction as number,
        actual_vs_planned: post.actual_vs_planned as string,
        end_energy: post.end_energy as number,
        skin_condition: post.skin_condition as string,
        felt_pumped_out: post.felt_pumped_out as boolean,
        could_have_done_more: post.could_have_done_more as string,
        
        // Behavioral Proxies
        skipped_planned_climbs: post.skipped_planned_climbs as boolean,
        attempted_harder: post.attempted_harder as boolean,
        one_more_try_count: post.one_more_try_count as number,
        
        // Goal Progress
        moved_toward_goal: post.moved_toward_goal as string,
        
        // Climbing Metrics
        highest_grade_sent: highestGradeSent,
        highest_grade_attempted: highestGradeAttempted,
        total_climbs: totalClimbs,
        total_sends: totalSends,
        flash_count: flashCount,
        
        // Project Session Outcomes
        total_attempts: post.total_attempts as number,
        highest_point_reached: post.highest_point_reached as string,
        matched_high_point: post.matched_high_point as boolean,
        linked_more_moves: post.linked_more_moves as boolean,
        sent_project: post.sent_project as boolean,
        send_attempts: post.send_attempts as number,
        fall_location: post.fall_location as string,
        same_crux: post.same_crux as boolean,
        crux_type: post.crux_type as string,
        limiting_factors: post.limiting_factors as string[],
        beta_changes: post.beta_changes as string,
        
        // Lead Session Outcomes
        routes_attempted: post.routes_attempted as number,
        total_pitches: post.total_pitches as number,
        onsight_rate: post.onsight_rate as number,
        falls_count: post.falls_count as number,
        fall_types: post.fall_types as string[],
        longest_route: post.longest_route as string,
        rest_time_between_routes: post.rest_time_between_routes as number,
        head_game_falls: post.head_game_falls as number,
        backed_off_due_to_fear: post.backed_off_due_to_fear as boolean,
        
        // Outdoor Session Outcomes
        conditions_vs_expected: post.conditions_vs_expected as string,
        skin_lasted: post.skin_lasted as boolean,
        conditions_affected_performance: post.conditions_affected_performance as string,
        rock_quality: post.rock_quality as string,
        
        // Recreational
        had_fun: post.had_fun as boolean,
        standout_moments: post.standout_moments as string,
        
        // Training Session Outcomes
        exercises_completed: post.exercises_completed as Record<string, unknown>[],
        training_quality: post.training_quality as number,
        progressed_or_regressed: post.progressed_or_regressed as string,
        prs_achieved: post.prs_achieved as string[],
        
        // Pain/Injury
        had_pain_after: post.has_new_pain as boolean,
        pain_location: post.pain_location as string,
        pain_severity: post.pain_severity as number,
        
        // Live Climb Tracking
        climbs_log: liveClimbs,
        
        // Notes
        notes: post.notes as string,
      })

      if (error) {
        console.error('Failed to complete session in database:', error)
      }
    }
    
    // Clear the active session and climb data from local storage
    clearActiveSession()
    clearStoredClimbs()
    setPhase('complete')
    // Show success briefly then navigate
    setTimeout(() => {
      navigate('/')
    }, 2000)
  }

  const handleCancel = () => {
    if (window.confirm('Are you sure you want to cancel this session? Your data will be lost.')) {
      clearActiveSession()
      navigate('/')
    }
  }

  // Loading state while checking cooldown
  if (checkingCooldown) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="w-12 h-12 mx-auto rounded-full border-2 border-fuchsia-500 border-t-transparent animate-spin mb-4" />
        <p className="text-slate-400">Checking session availability...</p>
      </div>
    )
  }

  // Cooldown screen - user must wait before starting another session
  if (phase === 'cooldown' && cooldownInfo) {
    const formatTime = (date: Date) => {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })
    }

    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-4xl">
            ⏳
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-4">Cooldown Period Active</h1>
        <p className="text-slate-400 mb-6">
          To ensure accurate data analysis and training recommendations, please wait before starting a new session.
        </p>
        
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 mb-8 max-w-md mx-auto">
          <div className="text-4xl font-bold text-amber-400 mb-2">
            {cooldownInfo.minutesRemaining} min
          </div>
          <p className="text-sm text-slate-400">
            until you can start a new session
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Last session ended at {formatTime(cooldownInfo.lastSessionTime)}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 max-w-md mx-auto mb-8">
          <h3 className="font-semibold mb-2 flex items-center justify-center gap-2">
            <span>💡</span> Why the wait?
          </h3>
          <p className="text-sm text-slate-400">
            Our training algorithm needs time to process your session data and generate accurate recommendations. 
            This cooldown period ensures the quality of your personalized insights.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/sessions"
            className="px-6 py-3 rounded-xl border border-white/10 text-white font-medium hover:bg-white/5 transition-all"
          >
            📅 View Session History
          </Link>
          <Link
            to="/"
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white font-medium hover:from-fuchsia-500 hover:to-cyan-500 transition-all"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  // Has active session screen - user has an incomplete session in the database
  if (phase === 'has_active' && activeSessionInfo) {
    const formatDateTime = (date: Date) => {
      return date.toLocaleString('en-US', { 
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })
    }

    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 flex items-center justify-center text-4xl">
            🧗
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-4">You Have an Active Session</h1>
        <p className="text-slate-400 mb-6">
          It looks like you started a session but didn't complete it. What would you like to do?
        </p>
        
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6 mb-8 max-w-md mx-auto">
          <p className="text-sm text-slate-400 mb-2">Session started:</p>
          <p className="text-lg font-medium text-violet-300">
            {formatDateTime(activeSessionInfo.startedAt)}
          </p>
        </div>

        <div className="flex flex-col gap-3 max-w-md mx-auto">
          <button
            onClick={handleContinueOrphanedSession}
            className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white font-medium hover:from-fuchsia-500 hover:to-cyan-500 transition-all"
          >
            <span className="flex items-center justify-center gap-2">
              <span>✅</span> Complete This Session
            </span>
            <span className="text-sm opacity-80 block mt-1">Fill out the post-session form</span>
          </button>
          
          <button
            onClick={handleCancelOrphanedSession}
            disabled={isCancelling}
            className="w-full px-6 py-4 rounded-xl border border-red-500/30 text-red-400 font-medium hover:bg-red-500/10 transition-all disabled:opacity-50"
          >
            {isCancelling ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Cancelling...
              </span>
            ) : (
              <>
                <span className="flex items-center justify-center gap-2">
                  <span>🗑️</span> Cancel & Start Fresh
                </span>
                <span className="text-sm opacity-80 block mt-1">Delete this session and start a new one</span>
              </>
            )}
          </button>
          
          <Link
            to="/"
            className="w-full px-6 py-3 rounded-xl border border-white/10 text-slate-400 font-medium hover:bg-white/5 transition-all"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (phase === 'complete') {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-4xl">
            🎉
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-4">Session Complete!</h1>
        <p className="text-slate-400 mb-2">Great work out there. Your session has been logged.</p>
        <p className="text-sm text-slate-500">Redirecting to your dashboard...</p>
      </div>
    )
  }

  if (phase === 'analyzing') {
    return <AnalysisScreen onComplete={handleAnalysisComplete} />
  }

  if (phase === 'recommendations' && sessionInfo) {
    return (
      <RecommendationsScreen
        preSessionData={sessionInfo.preSessionData}
        sessionType={sessionInfo.sessionType}
        onContinue={handleRecommendationsContinue}
      />
    )
  }

  if (phase === 'post' && sessionInfo) {
    return (
      <PostSessionForm
        sessionType={sessionInfo.sessionType}
        location={sessionInfo.location}
        isOutdoor={sessionInfo.isOutdoor}
        plannedDuration={sessionInfo.plannedDuration}
        startTime={sessionInfo.startTime}
        isHistorical={isHistoricalSession}
        onSubmit={handlePostSessionComplete}
        onCancel={handleCancel}
      />
    )
  }

  return <PreSessionForm onComplete={handlePreSessionComplete} />
}

// Separate component for completing an active session from the dashboard
export function CompleteSessionFlow() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<'post' | 'complete'>('post')
  const activeSession = getActiveSession()

  if (!activeSession) {
    navigate('/')
    return null
  }

  const handlePostSessionCompleteActive = async (postData: unknown) => {
    const post = postData as Record<string, unknown>
    
    // Extract time correction data if provided (for manual corrections)
    const timeCorrection = post.timeCorrection as { actualStartTime?: string; actualEndTime?: string } | undefined
    
    // Get live climb data from tracker
    const liveClimbs = getStoredClimbs()
    const totalClimbs = liveClimbs.length || (post.total_climbs as number)
    const totalSends = liveClimbs.filter(c => c.sent).length || (post.total_sends as number)
    const flashCount = liveClimbs.filter(c => c.flashed).length || (post.flash_count as number)
    
    // Calculate highest grade from live climbs
    const sentClimbs = liveClimbs.filter(c => c.sent)
    const highestGradeSent = sentClimbs.length > 0 
      ? sentClimbs.sort((a, b) => getGradeValue(b.grade) - getGradeValue(a.grade))[0].grade
      : (post.highest_grade_sent as string)
    const highestGradeAttempted = liveClimbs.length > 0
      ? liveClimbs.sort((a, b) => getGradeValue(b.grade) - getGradeValue(a.grade))[0].grade
      : (post.highest_grade_attempted as string)
    
    // Complete session in database with ALL post-session fields
    if (activeSession.sessionId) {
      const { error } = await completeSession({
        session_id: activeSession.sessionId,
        
        // Time correction - for manual time adjustments
        actual_start_time: timeCorrection?.actualStartTime,
        actual_end_time: timeCorrection?.actualEndTime,
        
        // Store complete post_session_data as JSONB for backup
        post_session_data: { ...post, live_climbs: liveClimbs },
        
        // Core Outcomes
        session_rpe: post.session_rpe as number,
        satisfaction: post.satisfaction as number,
        actual_vs_planned: post.actual_vs_planned as string,
        end_energy: post.end_energy as number,
        skin_condition: post.skin_condition as string,
        felt_pumped_out: post.felt_pumped_out as boolean,
        could_have_done_more: post.could_have_done_more as string,
        
        // Behavioral Proxies
        skipped_planned_climbs: post.skipped_planned_climbs as boolean,
        attempted_harder: post.attempted_harder as boolean,
        one_more_try_count: post.one_more_try_count as number,
        
        // Goal Progress
        moved_toward_goal: post.moved_toward_goal as string,
        
        // Climbing Metrics
        highest_grade_sent: highestGradeSent,
        highest_grade_attempted: highestGradeAttempted,
        total_climbs: totalClimbs,
        total_sends: totalSends,
        flash_count: flashCount,
        
        // Project Session Outcomes
        total_attempts: post.total_attempts as number,
        highest_point_reached: post.highest_point_reached as string,
        matched_high_point: post.matched_high_point as boolean,
        linked_more_moves: post.linked_more_moves as boolean,
        sent_project: post.sent_project as boolean,
        send_attempts: post.send_attempts as number,
        fall_location: post.fall_location as string,
        same_crux: post.same_crux as boolean,
        crux_type: post.crux_type as string,
        limiting_factors: post.limiting_factors as string[],
        beta_changes: post.beta_changes as string,
        
        // Lead Session Outcomes
        routes_attempted: post.routes_attempted as number,
        total_pitches: post.total_pitches as number,
        onsight_rate: post.onsight_rate as number,
        falls_count: post.falls_count as number,
        fall_types: post.fall_types as string[],
        longest_route: post.longest_route as string,
        rest_time_between_routes: post.rest_time_between_routes as number,
        head_game_falls: post.head_game_falls as number,
        backed_off_due_to_fear: post.backed_off_due_to_fear as boolean,
        
        // Outdoor Session Outcomes
        conditions_vs_expected: post.conditions_vs_expected as string,
        skin_lasted: post.skin_lasted as boolean,
        conditions_affected_performance: post.conditions_affected_performance as string,
        rock_quality: post.rock_quality as string,
        
        // Recreational
        had_fun: post.had_fun as boolean,
        standout_moments: post.standout_moments as string,
        
        // Training Session Outcomes
        exercises_completed: post.exercises_completed as Record<string, unknown>[],
        training_quality: post.training_quality as number,
        progressed_or_regressed: post.progressed_or_regressed as string,
        prs_achieved: post.prs_achieved as string[],
        
        // Pain/Injury
        had_pain_after: post.has_new_pain as boolean,
        pain_location: post.pain_location as string,
        pain_severity: post.pain_severity as number,
        
        // Live Climb Tracking
        climbs_log: liveClimbs,
        
        // Notes
        notes: post.notes as string,
      })

      if (error) {
        console.error('Failed to complete session in database:', error)
      }
    }
    
    clearActiveSession()
    clearStoredClimbs()
    setPhase('complete')
    setTimeout(() => {
      navigate('/')
    }, 2000)
  }

  const handleCancel = () => {
    navigate('/')
  }

  if (phase === 'complete') {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-4xl">
            🎉
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-4">Session Complete!</h1>
        <p className="text-slate-400 mb-2">Great work out there. Your session has been logged.</p>
        <p className="text-sm text-slate-500">Redirecting to your dashboard...</p>
      </div>
    )
  }

  return (
    <PostSessionForm
      sessionType={activeSession.sessionType}
      location={activeSession.location}
      isOutdoor={activeSession.isOutdoor}
      plannedDuration={activeSession.plannedDuration}
      startTime={activeSession.startTime}
      onSubmit={handlePostSessionCompleteActive}
      onCancel={handleCancel}
    />
  )
}

// Helper to get numeric value from grade for sorting
function getGradeValue(grade: string): number {
  // Boulder grades
  const boulderMatch = grade.match(/V(\d+)/)
  if (boulderMatch) return parseInt(boulderMatch[1])
  if (grade === 'VB') return -1
  
  // YDS grades
  const ydsMatch = grade.match(/5\.(\d+)([a-d])?/)
  if (ydsMatch) {
    const base = parseInt(ydsMatch[1])
    const letter = ydsMatch[2]
    const letterValue = letter ? { a: 0, b: 1, c: 2, d: 3 }[letter] ?? 0 : 0
    return base * 4 + letterValue
  }
  
  return 0
}
