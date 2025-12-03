import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { CorrelationWidget, CorrelationWidgetCompact } from '../components/CorrelationWidget'
import { GoalWidget } from '../components/GoalWidget'
import { LiveClimbTracker } from '../components/LiveClimbTracker'
import { getActiveSession } from '../lib/sessionStorage'
import { getSessionStats, getRecentSessions, type ClimbingSession, type SessionStats } from '../lib/sessionService'

export function Dashboard() {
  const { user } = useAuth()
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Climber'
  
  // State for real data
  const [stats, setStats] = useState<SessionStats | null>(null)
  const [recentSessions, setRecentSessions] = useState<ClimbingSession[]>([])
  const [loading, setLoading] = useState(true)
  
  // Scroll to top when dashboard loads
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  
  // Fetch real data from database
  useEffect(() => {
    async function fetchData() {
      if (!user) return
      
      setLoading(true)
      
      try {
        const [statsResult, sessionsResult] = await Promise.all([
          getSessionStats(),
          getRecentSessions(5),
        ])
        
        console.log('Stats result:', statsResult)
        console.log('Sessions result:', sessionsResult)
        
        if (statsResult.data) {
          setStats(statsResult.data)
        }
        
        if (sessionsResult.data) {
          setRecentSessions(sessionsResult.data)
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err)
      }
      
      setLoading(false)
    }
    
    fetchData()
  }, [user])
  
  // Check for active session
  const activeSession = getActiveSession()

  // Format stats for display
  const displayStats = [
    { 
      label: 'Sessions This Week', 
      value: stats?.sessionsThisWeek?.toString() ?? '0', 
      change: stats ? `${stats.sessionsThisWeek - stats.sessionsLastWeek >= 0 ? '+' : ''}${stats.sessionsThisWeek - stats.sessionsLastWeek} from last week` : '', 
      trend: stats ? (stats.sessionsThisWeek > stats.sessionsLastWeek ? 'up' : stats.sessionsThisWeek < stats.sessionsLastWeek ? 'down' : 'neutral') : 'neutral' 
    },
    { 
      label: 'Total Climbs', 
      value: stats?.totalClimbs?.toString() ?? '0', 
      change: stats?.totalSessions ? `${stats.totalSessions} sessions` : '', 
      trend: 'neutral' as const
    },
    { 
      label: 'Highest Grade', 
      value: stats?.highestGradeSent ?? 'N/A', 
      change: stats?.mostCommonType ? `Most: ${stats.mostCommonType}` : '', 
      trend: 'neutral' as const
    },
    { 
      label: 'Avg Duration', 
      value: stats?.avgDurationMinutes ? `${stats.avgDurationMinutes}m` : 'N/A', 
      change: stats?.avgSessionRpe ? `Avg RPE: ${stats.avgSessionRpe}` : '', 
      trend: 'neutral' as const
    },
  ]

  const quickTips = [
    { icon: '💪', title: 'Recovery day recommended', desc: 'Your finger load is elevated. Consider active rest.' },
    { icon: '🎯', title: 'Focus on overhangs', desc: 'Your data shows room for improvement on steep terrain.' },
  ]

  // Performance data for correlation widget
  const performanceData = recentSessions.map((s) => ({
    sessionId: s.id,
    satisfaction: s.satisfaction ?? 3,
    sends: s.total_sends ?? 0,
    hardestGrade: s.highest_grade_sent ? parseGradeValue(s.highest_grade_sent) : 0,
  }))

  // Calculate session duration
  const getSessionDuration = () => {
    if (!activeSession) return ''
    const now = new Date()
    const start = new Date(activeSession.startTime)
    const diffMs = now.getTime() - start.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const hours = Math.floor(diffMins / 60)
    const mins = diffMins % 60
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  // Format relative date
  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  // Get session type icon
  const getSessionIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'bouldering': return '🪨'
      case 'lead': case 'sport': return '🧗'
      case 'trad': return '⛰️'
      case 'training': return '🏋️'
      case 'project': return '🎯'
      default: return '🧗'
    }
  }

  return (
    <div className="p-8">
      {/* Active Session Banner */}
      {activeSession && (
        <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 p-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-2xl">
                  🧗
                </div>
                {/* Pulsing indicator */}
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium">
                    Active Session
                  </span>
                  <span className="text-xs text-slate-400">
                    Started {getSessionDuration()} ago
                  </span>
                </div>
                <h2 className="text-xl font-bold">
                  {activeSession.sessionType.charAt(0).toUpperCase() + activeSession.sessionType.slice(1)} at {activeSession.location || 'Unknown Location'}
                </h2>
                <p className="text-sm text-slate-400">
                  {activeSession.isOutdoor ? '🏔️ Outdoor' : '🏢 Indoor'} • Planned: {activeSession.plannedDuration} min
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link
                to="/session/review"
                className="px-4 py-2 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-all"
              >
                View Details
              </Link>
              <Link
                to="/session/complete"
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-medium text-sm shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all"
              >
                ✅ Complete Session
              </Link>
            </div>
          </div>

          {/* Pre-session summary */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-xs text-slate-500 mb-2">Pre-Session State</p>
            <div className="flex flex-wrap gap-3">
              {activeSession.preSessionData && (
                <>
                  <span className="px-3 py-1 rounded-full bg-white/5 text-xs">
                    Energy: {(activeSession.preSessionData.energy_level as number) || '?'}/8
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white/5 text-xs">
                    Motivation: {(activeSession.preSessionData.motivation as number) || '?'}/8
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white/5 text-xs">
                    Goal: {(activeSession.preSessionData.primary_goal as string)?.replace('_', ' ') || 'Not set'}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Live Climb Tracker */}
          <LiveClimbTracker sessionType={activeSession.sessionType} />
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, <span className="bg-gradient-to-r from-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">{firstName}</span>
        </h1>
        <p className="text-slate-400">
          {activeSession 
            ? "You have an active session. Complete it when you're done climbing!"
            : "Here's your climbing overview for this week."
          }
        </p>
      </div>

      {/* Goal Widget */}
      <div className="mb-6">
        <GoalWidget />
      </div>

      {/* Correlation Insight Banner (compact) */}
      <div className="mb-6">
        <CorrelationWidgetCompact performanceData={performanceData} />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {displayStats.map((stat) => (
          <div
            key={stat.label}
            className="p-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/[0.07] transition-colors"
          >
            <p className="text-sm text-slate-400 mb-1">{stat.label}</p>
            <p className="text-3xl font-bold">{loading ? '...' : stat.value}</p>
            <p className={`text-xs mt-2 ${
              stat.trend === 'up' ? 'text-emerald-400' : 
              stat.trend === 'down' ? 'text-red-400' : 'text-slate-500'
            }`}>
              {stat.change}
            </p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Sessions */}
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-semibold">Recent Sessions</h2>
            <Link to="/sessions" className="text-sm text-fuchsia-400 hover:text-fuchsia-300 transition-colors">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {loading ? (
              <div className="p-8 text-center text-slate-400">Loading sessions...</div>
            ) : recentSessions.length === 0 ? (
              <div className="p-8 text-center">
                <span className="text-4xl mb-4 block">🧗</span>
                <p className="text-slate-400 mb-2">No sessions yet</p>
                <p className="text-sm text-slate-500">Start your first session to see your history here.</p>
                <Link
                  to="/session/new"
                  className="inline-flex mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white text-sm font-medium"
                >
                  Start First Session
                </Link>
              </div>
            ) : (
              recentSessions.map((session) => (
                <div key={session.id} className="p-5 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center">
                        {getSessionIcon(session.session_type)}
                      </div>
                      <div>
                        <p className="font-medium capitalize">{session.session_type}</p>
                        <p className="text-sm text-slate-400">{session.location || 'Unknown location'}</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500">{formatRelativeDate(session.started_at)}</span>
                  </div>
                  <div className="flex gap-4 text-sm text-slate-400 ml-13">
                    {session.total_climbs != null && <span>{session.total_climbs} climbs</span>}
                    {session.highest_grade_sent && (
                      <span>Hardest: <span className="text-white">{session.highest_grade_sent}</span></span>
                    )}
                    {session.actual_duration_minutes && (
                      <span>{session.actual_duration_minutes}min</span>
                    )}
                    {session.session_rpe && (
                      <span>RPE: {session.session_rpe}/10</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Tips & Actions */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
            <h2 className="font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              {activeSession ? (
                <>
                  <Link
                    to="/session/complete"
                    className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-medium hover:from-emerald-500 hover:to-cyan-500 transition-all"
                  >
                    <span>✅</span>
                    Complete Session
                  </Link>
                  <Link
                    to="/session/review"
                    className="flex items-center gap-3 p-3 rounded-xl border border-white/10 hover:bg-white/5 transition-colors"
                  >
                    <span>📋</span>
                    View Session Details
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/session/new"
                    className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white font-medium hover:from-fuchsia-500 hover:to-cyan-500 transition-all"
                  >
                    <span>🧗</span>
                    Start New Session
                  </Link>
                  <Link
                    to="/goals"
                    className="flex items-center gap-3 p-3 rounded-xl border border-white/10 hover:bg-white/5 transition-colors"
                  >
                    <span>🎯</span>
                    View Goals
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* AI Tips */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="font-semibold">AI Insights</h2>
              <span className="px-2 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 text-xs">Beta</span>
            </div>
            <div className="space-y-3">
              {stats && stats.totalSessions > 0 ? (
                <>
                  {stats.sessionsThisWeek >= 4 && (
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex items-start gap-3">
                        <span className="text-xl">💪</span>
                        <div>
                          <p className="font-medium text-sm">Great consistency!</p>
                          <p className="text-xs text-slate-400 mt-1">You've logged {stats.sessionsThisWeek} sessions this week. Keep it up!</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {stats.avgSessionRpe > 7 && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <div className="flex items-start gap-3">
                        <span className="text-xl">⚠️</span>
                        <div>
                          <p className="font-medium text-sm text-amber-300">High intensity detected</p>
                          <p className="text-xs text-slate-400 mt-1">Your average RPE is {stats.avgSessionRpe}. Consider a recovery day.</p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-start gap-3">
                      <span className="text-xl">📊</span>
                      <div>
                        <p className="font-medium text-sm">Session Summary</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {stats.totalSessions} total sessions • {stats.totalClimbs} climbs • Avg {stats.avgDurationMinutes}min
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                quickTips.map((tip, i) => (
                  <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-start gap-3">
                      <span className="text-xl">{tip.icon}</span>
                      <div>
                        <p className="font-medium text-sm">{tip.title}</p>
                        <p className="text-xs text-slate-400 mt-1">{tip.desc}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full Correlation Widget */}
      <div className="mt-6">
        <CorrelationWidget performanceData={performanceData} />
      </div>
    </div>
  )
}

// Helper to parse grade value for correlation
function parseGradeValue(grade: string): number {
  const vMatch = grade.match(/V(\d+)/)
  if (vMatch) return parseInt(vMatch[1])
  
  const ydsMatch = grade.match(/5\.(\d+)([a-d])?/)
  if (ydsMatch) {
    const base = parseInt(ydsMatch[1])
    const letter = ydsMatch[2]
    const letterValue = letter ? { a: 0, b: 1, c: 2, d: 3 }[letter] ?? 0 : 0
    return base + letterValue * 0.25
  }
  
  return 0
}
