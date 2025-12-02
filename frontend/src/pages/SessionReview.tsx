import { Link, useNavigate } from 'react-router-dom'
import { getActiveSession, clearActiveSession } from '../lib/sessionStorage'
import { useEffect } from 'react'

export function SessionReview() {
  const navigate = useNavigate()
  const activeSession = getActiveSession()

  useEffect(() => {
    if (!activeSession) {
      navigate('/')
    }
  }, [activeSession, navigate])

  if (!activeSession) {
    return null
  }

  const preData = (activeSession.preSessionData || {}) as Record<string, unknown>

  // Calculate session duration
  const now = new Date()
  const start = new Date(activeSession.startTime)
  const diffMs = now.getTime() - start.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const hours = Math.floor(diffMins / 60)
  const mins = diffMins % 60
  const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins} minutes`

  const handleCancelSession = () => {
    if (window.confirm('Are you sure you want to cancel this session? All pre-session data will be lost.')) {
      clearActiveSession()
      navigate('/')
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link to="/" className="text-sm text-slate-400 hover:text-white mb-4 inline-flex items-center gap-1">
          ← Back to Dashboard
        </Link>
        <div className="flex items-center gap-4 mt-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-3xl">
              🧗
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium">
                Active Session
              </span>
            </div>
            <h1 className="text-3xl font-bold">
              {activeSession.sessionType.charAt(0).toUpperCase() + activeSession.sessionType.slice(1)} Session
            </h1>
            <p className="text-slate-400">
              at {activeSession.location || 'Unknown Location'}
            </p>
          </div>
        </div>
      </div>

      {/* Session Timer */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400 mb-1">Session Duration</p>
            <p className="text-4xl font-bold">{durationStr}</p>
            <p className="text-sm text-slate-500 mt-1">
              Started at {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400 mb-1">Planned Duration</p>
            <p className="text-2xl font-semibold">{activeSession.plannedDuration} min</p>
            <p className="text-sm text-slate-500 mt-1">
              {activeSession.isOutdoor ? '🏔️ Outdoor' : '🏢 Indoor'}
            </p>
          </div>
        </div>
      </div>

      {/* Pre-Session Data */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <span>📝</span> Pre-Session Check-in
        </h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* State Metrics */}
          <div>
            <p className="text-xs text-slate-500 mb-3">Your State</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                <span className="text-sm">⚡ Energy Level</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 rounded-full"
                      style={{ width: `${((preData.energy_level as number) || 5) * 10}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8">{(preData.energy_level as number) || '?'}/10</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                <span className="text-sm">🔥 Motivation</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 rounded-full"
                      style={{ width: `${((preData.motivation as number) || 5) * 10}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8">{(preData.motivation as number) || '?'}/10</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                <span className="text-sm">😴 Sleep Quality</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 rounded-full"
                      style={{ width: `${((preData.sleep_quality as number) || 5) * 10}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8">{(preData.sleep_quality as number) || '?'}/10</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                <span className="text-sm">😰 Stress Level</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-500 to-red-500 rounded-full"
                      style={{ width: `${((preData.stress_level as number) || 5) * 10}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8">{(preData.stress_level as number) || '?'}/10</span>
                </div>
              </div>
            </div>
          </div>

          {/* Session Details */}
          <div>
            <p className="text-xs text-slate-500 mb-3">Session Details</p>
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-white/5">
                <p className="text-xs text-slate-500">Primary Goal</p>
                <p className="font-medium capitalize">
                  {(preData.primary_goal as string)?.replace(/_/g, ' ') || 'Not specified'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white/5">
                <p className="text-xs text-slate-500">Hydration</p>
                <p className="font-medium capitalize">
                  {(preData.hydration as string)?.replace(/_/g, ' ') || 'Not specified'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white/5">
                <p className="text-xs text-slate-500">Muscle Soreness</p>
                <p className="font-medium capitalize">
                  {(preData.muscle_soreness as string) || 'None'}
                </p>
              </div>
              {Boolean(preData.has_pain) && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <p className="text-xs text-amber-400">⚠️ Pre-existing Pain</p>
                  <p className="font-medium text-amber-300">Logged injury/pain</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notes */}
        {Boolean(preData.notes) && (
          <div className="mt-4 p-4 rounded-xl bg-white/5">
            <p className="text-xs text-slate-500 mb-1">Notes</p>
            <p className="text-sm">{String(preData.notes)}</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={handleCancelSession}
          className="px-6 py-3 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all"
        >
          Cancel Session
        </button>
        <Link
          to="/session/complete"
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-semibold text-center shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all"
        >
          ✅ Complete Session
        </Link>
      </div>
    </div>
  )
}

