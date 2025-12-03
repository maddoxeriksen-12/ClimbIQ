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

  const handlePreSessionComplete = async (info: { 
    sessionType: string
    location: string
    isOutdoor?: boolean
    plannedDuration?: number
    preSessionData?: Record<string, unknown>
  }) => {
    // Get active goal to associate session with it
    const { data: activeGoal } = await getActiveGoal()

    // Create session in database
    const { data: dbSession, error } = await createSession({
      session_type: info.sessionType,
      location: info.location,
      is_outdoor: info.isOutdoor,
      planned_duration_minutes: info.plannedDuration,
      goal_id: activeGoal?.id,
      pre_session_data: info.preSessionData,
      energy_level: info.preSessionData?.energy_level as number,
      motivation: info.preSessionData?.motivation as number,
      sleep_quality: info.preSessionData?.sleep_quality as number,
      stress_level: info.preSessionData?.stress_level as number,
      had_pain_before: info.preSessionData?.has_pain as boolean,
      pain_location: info.preSessionData?.pain_location as string,
      pain_severity: info.preSessionData?.pain_severity as number,
      notes: info.preSessionData?.notes as string,
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
      startTime: new Date(),
      isOutdoor: info.isOutdoor ?? false,
      plannedDuration: info.plannedDuration ?? 90,
      preSessionData: info.preSessionData || {},
    }
    setSessionInfo(newSession)
    setPhase('analyzing')
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
    const data = postData as Record<string, unknown>
    
    // Get live climb data from tracker
    const liveClimbs = getStoredClimbs()
    const totalClimbs = liveClimbs.length || (data.total_climbs as number)
    const totalSends = liveClimbs.filter(c => c.sent).length || (data.total_sends as number)
    const flashCount = liveClimbs.filter(c => c.flashed).length || (data.flash_count as number)
    
    // Calculate highest grade from live climbs
    const sentClimbs = liveClimbs.filter(c => c.sent)
    const highestGradeSent = sentClimbs.length > 0 
      ? sentClimbs.sort((a, b) => getGradeValue(b.grade) - getGradeValue(a.grade))[0].grade
      : (data.highest_grade_sent as string)
    const highestGradeAttempted = liveClimbs.length > 0
      ? liveClimbs.sort((a, b) => getGradeValue(b.grade) - getGradeValue(a.grade))[0].grade
      : (data.highest_grade_attempted as string)
    
    // Complete session in database
    if (dbSessionId || sessionInfo?.sessionId) {
      const sessionId = dbSessionId || sessionInfo?.sessionId
      const { error } = await completeSession({
        session_id: sessionId!,
        post_session_data: { ...data, live_climbs: liveClimbs },
        session_rpe: data.session_rpe as number,
        satisfaction: data.satisfaction as number,
        highest_grade_sent: highestGradeSent,
        highest_grade_attempted: highestGradeAttempted,
        total_climbs: totalClimbs,
        total_sends: totalSends,
        flash_count: flashCount,
        had_pain_after: data.has_new_pain as boolean,
        pain_location: data.pain_location as string,
        pain_severity: data.pain_severity as number,
        notes: data.notes as string,
        actual_start_time: data.actual_start_time as string,
        actual_end_time: data.actual_end_time as string,
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

  const handlePostSessionComplete = async (postData: unknown) => {
    const data = postData as Record<string, unknown>
    
    // Get live climb data from tracker
    const liveClimbs = getStoredClimbs()
    const totalClimbs = liveClimbs.length || (data.total_climbs as number)
    const totalSends = liveClimbs.filter(c => c.sent).length || (data.total_sends as number)
    const flashCount = liveClimbs.filter(c => c.flashed).length || (data.flash_count as number)
    
    // Calculate highest grade from live climbs
    const sentClimbs = liveClimbs.filter(c => c.sent)
    const highestGradeSent = sentClimbs.length > 0 
      ? sentClimbs.sort((a, b) => getGradeValue(b.grade) - getGradeValue(a.grade))[0].grade
      : (data.highest_grade_sent as string)
    const highestGradeAttempted = liveClimbs.length > 0
      ? liveClimbs.sort((a, b) => getGradeValue(b.grade) - getGradeValue(a.grade))[0].grade
      : (data.highest_grade_attempted as string)
    
    // Complete session in database
    if (activeSession.sessionId) {
      const { error } = await completeSession({
        session_id: activeSession.sessionId,
        post_session_data: { ...data, live_climbs: liveClimbs },
        session_rpe: data.session_rpe as number,
        satisfaction: data.satisfaction as number,
        highest_grade_sent: highestGradeSent,
        highest_grade_attempted: highestGradeAttempted,
        total_climbs: totalClimbs,
        total_sends: totalSends,
        flash_count: flashCount,
        had_pain_after: data.has_new_pain as boolean,
        pain_location: data.pain_location as string,
        pain_severity: data.pain_severity as number,
        notes: data.notes as string,
        actual_start_time: data.actual_start_time as string,
        actual_end_time: data.actual_end_time as string,
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
      onSubmit={handlePostSessionComplete}
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
