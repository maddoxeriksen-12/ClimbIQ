import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { ClimbingSession } from '../lib/sessionService'

export function SessionDetail() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<ClimbingSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    async function fetchSession() {
      if (!sessionId) return
      
      setLoading(true)
      const { data, error } = await supabase
        .from('climbing_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (error) {
        console.error('Error fetching session:', error)
      }
      if (data) {
        setSession(data as ClimbingSession)
      }
      setLoading(false)
    }
    fetchSession()
  }, [sessionId])

  const handleDelete = async () => {
    if (!sessionId) return
    
    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('climbing_sessions')
        .delete()
        .eq('id', sessionId)

      if (error) {
        console.error('Error deleting session:', error)
        alert('Failed to delete session. Please try again.')
        return
      }

      // Navigate back to history
      navigate('/sessions')
    } catch (err) {
      console.error('Error deleting session:', err)
      alert('Failed to delete session. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  // Get session type icon
  const getSessionIcon = (type: string) => {
    switch (type?.toLowerCase()) {
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
      weekday: 'long',
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
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

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-center py-20">
          <div className="w-12 h-12 rounded-full border-2 border-fuchsia-500 border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="text-center py-20">
          <span className="text-6xl mb-4 block">🔍</span>
          <h1 className="text-2xl font-bold mb-2">Session Not Found</h1>
          <p className="text-slate-400 mb-6">This session may have been deleted or doesn't exist.</p>
          <Link
            to="/sessions"
            className="inline-flex px-6 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white font-medium"
          >
            Back to History
          </Link>
        </div>
      </div>
    )
  }

  // Parse pre/post session data
  const preData = session.pre_session_data as Record<string, unknown> || {}
  const postData = session.post_session_data as Record<string, unknown> || {}
  const liveClimbs = (postData.live_climbs as Array<{
    grade: string
    type: string
    attempts: number
    sent: boolean
    flashed: boolean
  }>) || []

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link to="/sessions" className="text-sm text-slate-400 hover:text-white mb-4 inline-flex items-center gap-1">
          ← Back to History
        </Link>
        
        <div className="flex items-start justify-between mt-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center text-3xl">
              {getSessionIcon(session.session_type)}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold capitalize">{session.session_type} Session</h1>
                {session.is_outdoor && (
                  <span className="px-2 py-0.5 rounded-full bg-lime-500/20 text-lime-300 text-xs">
                    🏔️ Outdoor
                  </span>
                )}
              </div>
              <p className="text-slate-400">{session.location || 'Unknown location'}</p>
              <p className="text-sm text-slate-500 mt-1">
                {formatDate(session.started_at)} at {formatTime(session.started_at)}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Link
              to={`/sessions/${sessionId}/edit`}
              className="px-4 py-2 rounded-xl border border-fuchsia-500/30 text-fuchsia-400 text-sm hover:bg-fuchsia-500/10 transition-colors"
            >
              ✏️ Edit
            </Link>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 rounded-xl border border-red-500/30 text-red-400 text-sm hover:bg-red-500/10 transition-colors"
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>

      {/* Session Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-2xl border border-white/10 bg-white/5">
          <p className="text-2xl font-bold">{session.actual_duration_minutes || session.planned_duration_minutes || '—'}</p>
          <p className="text-xs text-slate-500">Duration (min)</p>
        </div>
        <div className="p-4 rounded-2xl border border-white/10 bg-white/5">
          <p className="text-2xl font-bold">{session.total_climbs || 0}</p>
          <p className="text-xs text-slate-500">Total Climbs</p>
        </div>
        <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
          <p className="text-2xl font-bold text-emerald-400">{session.total_sends || 0}</p>
          <p className="text-xs text-slate-500">Sends</p>
        </div>
        <div className="p-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/5">
          <p className="text-2xl font-bold text-cyan-400">{session.flash_count || 0}</p>
          <p className="text-xs text-slate-500">Flashes</p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Grades */}
          {(session.highest_grade_sent || session.highest_grade_attempted) && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <span>🎯</span> Grades
              </h3>
              <div className="space-y-2">
                {session.highest_grade_sent && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Highest Sent</span>
                    <span className="font-bold text-fuchsia-400">{session.highest_grade_sent}</span>
                  </div>
                )}
                {session.highest_grade_attempted && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Highest Attempted</span>
                    <span className="font-medium">{session.highest_grade_attempted}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RPE & Satisfaction */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <span>📊</span> Session Metrics
            </h3>
            <div className="space-y-3">
              {session.session_rpe && (
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Session RPE</span>
                    <span className="font-medium">{session.session_rpe}/8</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full"
                      style={{ width: `${(session.session_rpe / 8) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              {session.satisfaction && (
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Satisfaction</span>
                    <span className="font-medium">{session.satisfaction}/5</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-500 rounded-full"
                      style={{ width: `${(session.satisfaction / 5) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Pre-Session State */}
          {Object.keys(preData).length > 0 && (
            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <span>🌅</span> Pre-Session State
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {preData.energy_level != null && (
                  <div className="p-2 rounded-lg bg-white/5">
                    <p className="text-xs text-slate-500">Energy</p>
                    <p className="font-medium">{Number(preData.energy_level)}/8</p>
                  </div>
                )}
                {preData.motivation != null && (
                  <div className="p-2 rounded-lg bg-white/5">
                    <p className="text-xs text-slate-500">Motivation</p>
                    <p className="font-medium">{Number(preData.motivation)}/8</p>
                  </div>
                )}
                {preData.sleep_quality != null && (
                  <div className="p-2 rounded-lg bg-white/5">
                    <p className="text-xs text-slate-500">Sleep Quality</p>
                    <p className="font-medium">{Number(preData.sleep_quality)}/8</p>
                  </div>
                )}
                {preData.stress_level != null && (
                  <div className="p-2 rounded-lg bg-white/5">
                    <p className="text-xs text-slate-500">Stress</p>
                    <p className="font-medium">{Number(preData.stress_level)}/8</p>
                  </div>
                )}
                {preData.primary_goal != null && (
                  <div className="p-2 rounded-lg bg-white/5 col-span-2">
                    <p className="text-xs text-slate-500">Primary Goal</p>
                    <p className="font-medium capitalize">{String(preData.primary_goal).replace(/_/g, ' ')}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pain/Injury */}
          {(session.had_pain_before || session.had_pain_after) && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <span>🩹</span> Pain & Injury
              </h3>
              <div className="space-y-2 text-sm">
                {session.had_pain_before && (
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400">⚠️</span>
                    <span>Had pain before session</span>
                    {session.pain_location && <span className="text-slate-400">({session.pain_location})</span>}
                  </div>
                )}
                {session.had_pain_after && (
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400">⚠️</span>
                    <span>New pain after session</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live Climbs Log */}
      {liveClimbs.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <span>📋</span> Climb Log ({liveClimbs.length} climbs)
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {liveClimbs.map((climb, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-xl bg-white/5"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{climb.type === 'boulder' ? '🪨' : '🧗'}</span>
                  <span className="font-mono font-medium">{climb.grade}</span>
                  <div className="flex gap-1">
                    {climb.flashed && (
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-xs">⚡ Flash</span>
                    )}
                    {climb.sent && !climb.flashed && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-xs">✓ Send</span>
                    )}
                    {!climb.sent && (
                      <span className="px-2 py-0.5 rounded bg-slate-500/20 text-slate-400 text-xs">× Attempt</span>
                    )}
                  </div>
                </div>
                <span className="text-sm text-slate-500">{climb.attempts} attempt{climb.attempts !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {session.notes && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <span>📝</span> Notes
          </h3>
          <p className="text-slate-300 whitespace-pre-wrap">{session.notes}</p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !isDeleting && setShowDeleteModal(false)}
          />
          
          <div className="relative bg-[#0f1412] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            
            <h3 className="text-xl font-bold text-center mb-2">Delete Session?</h3>
            <p className="text-slate-400 text-center mb-2">
              Are you sure you want to delete this {session.session_type} session from {formatDate(session.started_at)}?
            </p>
            <p className="text-sm text-red-400/80 text-center mb-6">
              This action cannot be undone.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-xl border border-white/10 text-white font-medium hover:bg-white/5 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Deleting...
                  </>
                ) : (
                  'Delete Session'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

