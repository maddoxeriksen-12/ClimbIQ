import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getRecentSessions, type ClimbingSession } from '../lib/sessionService'

export function SessionHistory() {
  const [sessions, setSessions] = useState<ClimbingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'bouldering' | 'lead' | 'training' | 'project'>('all')

  useEffect(() => {
    async function fetchSessions() {
      setLoading(true)
      const { data, error } = await getRecentSessions(50) // Get up to 50 sessions
      if (error) {
        console.error('Error fetching sessions:', error)
      }
      if (data) {
        setSessions(data)
      }
      setLoading(false)
    }
    fetchSessions()
  }, [])

  // Filter sessions
  const filteredSessions = filter === 'all' 
    ? sessions 
    : sessions.filter(s => s.session_type.toLowerCase() === filter)

  // Group sessions by month
  const groupedSessions = filteredSessions.reduce((groups, session) => {
    const date = new Date(session.started_at)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    
    if (!groups[monthKey]) {
      groups[monthKey] = { label: monthLabel, sessions: [] }
    }
    groups[monthKey].sessions.push(session)
    return groups
  }, {} as Record<string, { label: string; sessions: ClimbingSession[] }>)

  // Sort months (most recent first)
  const sortedMonths = Object.entries(groupedSessions).sort((a, b) => b[0].localeCompare(a[0]))

  // Get session type icon
  const getSessionIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'bouldering': return '🪨'
      case 'lead': case 'sport': return '🧗'
      case 'trad': return '⛰️'
      case 'training': return '🏋️'
      case 'project': return '🎯'
      case 'recreational': return '🎉'
      default: return '🧗'
    }
  }

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  // Format time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
  }

  // Calculate stats
  const totalSessions = sessions.length
  const totalClimbs = sessions.reduce((sum, s) => sum + (s.total_climbs || 0), 0)
  const totalSends = sessions.reduce((sum, s) => sum + (s.total_sends || 0), 0)
  const avgRpe = sessions.length > 0 
    ? (sessions.reduce((sum, s) => sum + (s.session_rpe || 0), 0) / sessions.filter(s => s.session_rpe).length).toFixed(1)
    : 'N/A'

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link to="/" className="text-sm text-slate-400 hover:text-white mb-4 inline-flex items-center gap-1">
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold mt-4">Session History</h1>
        <p className="text-slate-400">View and analyze your past climbing sessions.</p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-2xl border border-white/10 bg-white/5">
          <p className="text-2xl font-bold">{totalSessions}</p>
          <p className="text-xs text-slate-500">Total Sessions</p>
        </div>
        <div className="p-4 rounded-2xl border border-white/10 bg-white/5">
          <p className="text-2xl font-bold">{totalClimbs}</p>
          <p className="text-xs text-slate-500">Total Climbs</p>
        </div>
        <div className="p-4 rounded-2xl border border-white/10 bg-white/5">
          <p className="text-2xl font-bold text-emerald-400">{totalSends}</p>
          <p className="text-xs text-slate-500">Total Sends</p>
        </div>
        <div className="p-4 rounded-2xl border border-white/10 bg-white/5">
          <p className="text-2xl font-bold">{avgRpe}</p>
          <p className="text-xs text-slate-500">Avg RPE</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { value: 'all', label: 'All Sessions' },
          { value: 'bouldering', label: '🪨 Bouldering' },
          { value: 'lead', label: '🧗 Lead/Sport' },
          { value: 'training', label: '🏋️ Training' },
          { value: 'project', label: '🎯 Project' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value as typeof filter)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              filter === tab.value
                ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30'
                : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sessions List */}
      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
          <div className="w-12 h-12 mx-auto rounded-full border-2 border-fuchsia-500 border-t-transparent animate-spin mb-4" />
          <p className="text-slate-400">Loading sessions...</p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-12 text-center">
          <span className="text-6xl mb-4 block">📅</span>
          <h2 className="text-xl font-semibold mb-2">
            {filter === 'all' ? 'No sessions yet' : `No ${filter} sessions`}
          </h2>
          <p className="text-slate-400 mb-6">
            {filter === 'all' 
              ? 'Start logging your climbing sessions to see them here.'
              : `You haven't logged any ${filter} sessions yet.`
            }
          </p>
          <Link
            to="/session/new"
            className="inline-flex px-6 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white font-medium hover:from-fuchsia-500 hover:to-cyan-500 transition-all"
          >
            Log a Session
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedMonths.map(([monthKey, { label, sessions: monthSessions }]) => (
            <div key={monthKey}>
              {/* Month Header */}
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-sm font-semibold text-slate-400">{label}</h3>
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-slate-500">{monthSessions.length} sessions</span>
              </div>

              {/* Sessions for this month */}
              <div className="space-y-3">
                {monthSessions.map((session) => (
                  <Link
                    key={session.id}
                    to={`/sessions/${session.id}`}
                    className="block rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/[0.07] hover:border-fuchsia-500/30 transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center text-2xl">
                          {getSessionIcon(session.session_type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold capitalize">{session.session_type}</h4>
                            {session.is_outdoor && (
                              <span className="px-2 py-0.5 rounded-full bg-lime-500/20 text-lime-300 text-xs">
                                🏔️ Outdoor
                              </span>
                            )}
                            {session.status === 'completed' && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs">
                                ✓ Completed
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-400">{session.location || 'Unknown location'}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {formatDate(session.started_at)} at {formatTime(session.started_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {session.actual_duration_minutes && (
                          <p className="text-sm font-medium">{session.actual_duration_minutes} min</p>
                        )}
                        {session.session_rpe && (
                          <p className="text-xs text-slate-500">RPE: {session.session_rpe}/8</p>
                        )}
                      </div>
                    </div>

                    {/* Session Stats */}
                    <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-4">
                      {session.total_climbs != null && session.total_climbs > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-sm">Climbs:</span>
                          <span className="font-medium">{session.total_climbs}</span>
                        </div>
                      )}
                      {session.total_sends != null && session.total_sends > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-sm">Sends:</span>
                          <span className="font-medium text-emerald-400">{session.total_sends}</span>
                        </div>
                      )}
                      {session.flash_count != null && session.flash_count > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-sm">Flashes:</span>
                          <span className="font-medium text-cyan-400">{session.flash_count}</span>
                        </div>
                      )}
                      {session.highest_grade_sent && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-sm">Highest:</span>
                          <span className="font-medium text-fuchsia-400">{session.highest_grade_sent}</span>
                        </div>
                      )}
                      {session.satisfaction && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-sm">Satisfaction:</span>
                          <span className="font-medium">{session.satisfaction}/5</span>
                        </div>
                      )}
                    </div>

                    {/* Notes preview */}
                    {session.notes && (
                      <div className="mt-3 p-3 rounded-xl bg-white/5">
                        <p className="text-xs text-slate-400 line-clamp-2">{session.notes}</p>
                      </div>
                    )}
                    
                    {/* Click indicator */}
                    <div className="mt-3 flex items-center justify-end text-xs text-slate-500">
                      <span>Click to view details →</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load More (placeholder for pagination) */}
      {filteredSessions.length >= 50 && (
        <div className="mt-6 text-center">
          <button className="px-6 py-3 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors">
            Load More Sessions
          </button>
        </div>
      )}
    </div>
  )
}

