import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PreSessionForm } from './PreSessionForm'
import { PostSessionForm } from './PostSessionForm'
import { AnalysisScreen } from './AnalysisScreen'
import { RecommendationsScreen } from './RecommendationsScreen'
import { saveActiveSession, getActiveSession, clearActiveSession } from '../lib/sessionStorage'
import { getActiveGoal, incrementGoalSessions } from '../lib/goalStorage'
import type { ActiveSessionData } from '../lib/sessionStorage'

type SessionPhase = 'pre' | 'analyzing' | 'recommendations' | 'active' | 'post' | 'complete'

export function SessionFlow() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<SessionPhase>('pre')
  const [sessionInfo, setSessionInfo] = useState<ActiveSessionData | null>(null)

  const handlePreSessionComplete = (info: { 
    sessionType: string
    location: string
    isOutdoor?: boolean
    plannedDuration?: number
    preSessionData?: Record<string, unknown>
  }) => {
    const newSession: ActiveSessionData = {
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
      // Save the active session so it persists
      saveActiveSession(sessionInfo)
    }
    // Navigate to dashboard where user can see their session and access post-form
    navigate('/')
  }

  const handlePostSessionComplete = async () => {
    // Track session toward active goal
    const activeGoal = getActiveGoal()
    if (activeGoal) {
      incrementGoalSessions(activeGoal.id)
    }
    
    // Clear the active session
    clearActiveSession()
    setPhase('complete')
    // Show success briefly then navigate
    setTimeout(() => {
      navigate('/sessions')
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
        <p className="text-sm text-slate-500">Redirecting to your session history...</p>
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

  const handlePostSessionComplete = async () => {
    // Track session toward active goal
    const activeGoal = getActiveGoal()
    if (activeGoal) {
      incrementGoalSessions(activeGoal.id)
    }
    
    clearActiveSession()
    setPhase('complete')
    setTimeout(() => {
      navigate('/sessions')
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
        <p className="text-sm text-slate-500">Redirecting to your session history...</p>
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
