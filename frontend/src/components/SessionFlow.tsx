import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PreSessionForm } from './PreSessionForm'
import { PostSessionForm } from './PostSessionForm'
import { AnalysisScreen } from './AnalysisScreen'
import { RecommendationsScreen } from './RecommendationsScreen'
import { getStoredClimbs, clearStoredClimbs } from './LiveClimbTracker'
import { saveActiveSession, getActiveSession, clearActiveSession } from '../lib/sessionStorage'
import { createSession, completeSession } from '../lib/sessionService'
import { getActiveGoal } from '../lib/goalService'
import type { ActiveSessionData } from '../lib/sessionStorage'

type SessionPhase = 'pre' | 'analyzing' | 'recommendations' | 'active' | 'post' | 'complete'

export function SessionFlow() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<SessionPhase>('pre')
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
