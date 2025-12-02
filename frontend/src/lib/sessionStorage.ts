// Session storage utilities for persisting active session state

export interface ActiveSessionData {
  sessionId?: string // Database session ID
  sessionType: string
  location: string
  startTime: Date
  isOutdoor: boolean
  plannedDuration: number
  preSessionData: Record<string, unknown>
}

// Store active session in localStorage so it persists across page navigation
export function saveActiveSession(session: ActiveSessionData | null) {
  if (session) {
    localStorage.setItem('activeSession', JSON.stringify({
      ...session,
      startTime: session.startTime.toISOString(),
    }))
  } else {
    localStorage.removeItem('activeSession')
  }
}

export function getActiveSession(): ActiveSessionData | null {
  const stored = localStorage.getItem('activeSession')
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      return {
        ...parsed,
        startTime: new Date(parsed.startTime),
      }
    } catch {
      return null
    }
  }
  return null
}

export function clearActiveSession() {
  localStorage.removeItem('activeSession')
}

