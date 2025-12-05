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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['pre', 'post', 'climbs']))

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

      navigate('/sessions')
    } catch (err) {
      console.error('Error deleting session:', err)
      alert('Failed to delete session. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
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

  // Calculate actual duration from timestamps
  const calculateDuration = () => {
    if (!session) return null
    
    // If we have both started_at and ended_at, calculate the actual duration
    if (session.started_at && session.ended_at) {
      const start = new Date(session.started_at)
      const end = new Date(session.ended_at)
      const diffMs = end.getTime() - start.getTime()
      const diffMins = Math.round(diffMs / (1000 * 60))
      // Sanity check - sessions shouldn't be longer than 8 hours (480 min)
      if (diffMins > 0 && diffMins <= 480) {
        return diffMins
      }
    }
    
    // Fallback to planned duration if actual duration seems wrong
    if (session.planned_duration_minutes && session.planned_duration_minutes <= 480) {
      return session.planned_duration_minutes
    }
    
    return null
  }

  // Format value for display
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return '—'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (Array.isArray(value)) {
      if (value.length === 0) return '—'
      return value.join(', ')
    }
    if (typeof value === 'number') return String(value)
    if (typeof value === 'string') {
      // Format snake_case to Title Case
      return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
    return String(value)
  }

  // Data field display component
  const DataField = ({ label, value, color = 'slate' }: { label: string; value: unknown; color?: string }) => {
    const displayValue = formatValue(value)
    if (displayValue === '—') return null
    
    const colorClasses: Record<string, string> = {
      slate: 'bg-white/5',
      emerald: 'bg-emerald-500/10',
      amber: 'bg-amber-500/10',
      red: 'bg-red-500/10',
      violet: 'bg-violet-500/10',
      cyan: 'bg-cyan-500/10',
      fuchsia: 'bg-fuchsia-500/10',
    }
    
    return (
      <div className={`p-3 rounded-xl ${colorClasses[color] || colorClasses.slate}`}>
        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
        <p className="font-medium text-sm">{displayValue}</p>
      </div>
    )
  }

  // Slider display component
  const SliderField = ({ label, value, max = 8, color = 'cyan' }: { label: string; value: number | null | undefined; max?: number; color?: string }) => {
    if (value === null || value === undefined) return null
    
    const colorClasses: Record<string, string> = {
      emerald: 'from-emerald-500 to-emerald-400',
      amber: 'from-amber-500 to-amber-400',
      red: 'from-red-500 to-red-400',
      violet: 'from-violet-500 to-violet-400',
      cyan: 'from-cyan-500 to-cyan-400',
      fuchsia: 'from-fuchsia-500 to-fuchsia-400',
    }
    
    return (
      <div className="p-3 rounded-xl bg-white/5">
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-slate-400">{label}</span>
          <span className="font-medium">{value}/{max}</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div 
            className={`h-full bg-gradient-to-r ${colorClasses[color] || colorClasses.cyan} rounded-full`}
            style={{ width: `${(value / max) * 100}%` }}
          />
        </div>
      </div>
    )
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
          <p className="text-slate-400 mb-6">This session may have been deleted or doesn&apos;t exist.</p>
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
  
  // Get climbs from climbs_log (new dedicated column) or live_climbs in post_session_data
  const liveClimbs = (session.climbs_log as Array<{
    grade: string
    type: string
    attempts: number
    sent: boolean
    flashed: boolean
    notes?: string
  }>) || (postData.live_climbs as Array<{
    grade: string
    type: string
    attempts: number
    sent: boolean
    flashed: boolean
  }>) || []

  const duration = calculateDuration()

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
              <p className="text-slate-400">{session.location || session.gym_name || session.crag_name || 'Unknown location'}</p>
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
          <p className="text-2xl font-bold">{duration ?? '—'}</p>
          <p className="text-xs text-slate-500">Duration (min)</p>
        </div>
        <div className="p-4 rounded-2xl border border-white/10 bg-white/5">
          <p className="text-2xl font-bold">{session.total_climbs || liveClimbs.length || 0}</p>
          <p className="text-xs text-slate-500">Total Climbs</p>
        </div>
        <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
          <p className="text-2xl font-bold text-emerald-400">{session.total_sends || liveClimbs.filter(c => c.sent).length || 0}</p>
          <p className="text-xs text-slate-500">Sends</p>
        </div>
        <div className="p-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/5">
          <p className="text-2xl font-bold text-cyan-400">{session.flash_count || liveClimbs.filter(c => c.flashed).length || 0}</p>
          <p className="text-xs text-slate-500">Flashes</p>
        </div>
      </div>

      {/* Grades Summary */}
      {(session.highest_grade_sent || session.highest_grade_attempted) && (
        <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-5 mb-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <span>🎯</span> Grades
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {session.highest_grade_sent && (
              <div className="text-center p-3 rounded-xl bg-white/5">
                <p className="text-2xl font-bold text-fuchsia-400">{session.highest_grade_sent}</p>
                <p className="text-xs text-slate-500">Highest Sent</p>
              </div>
            )}
            {session.highest_grade_attempted && (
              <div className="text-center p-3 rounded-xl bg-white/5">
                <p className="text-2xl font-bold">{session.highest_grade_attempted}</p>
                <p className="text-xs text-slate-500">Highest Attempted</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PRE-SESSION FORM DATA */}
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 mb-6 overflow-hidden">
        <button 
          onClick={() => toggleSection('pre')}
          className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <h3 className="font-semibold flex items-center gap-2">
            <span>🌅</span> Pre-Session Form Data
          </h3>
          <span className={`transform transition-transform ${expandedSections.has('pre') ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>
        
        {expandedSections.has('pre') && (
          <div className="px-5 pb-5 space-y-4">
            {/* Mental & Physical State */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-3">Mental & Physical State</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <SliderField label="Energy Level" value={session.energy_level ?? preData.energy_level as number} color="emerald" />
                <SliderField label="Motivation" value={session.motivation ?? preData.motivation as number} color="cyan" />
                <SliderField label="Sleep Quality" value={session.sleep_quality ?? preData.sleep_quality as number} color="violet" />
                <SliderField label="Stress Level" value={session.stress_level ?? preData.stress_level as number} color="amber" />
                <DataField label="Sleep Hours" value={session.sleep_hours ?? preData.sleep_hours} />
                <DataField label="Muscle Soreness" value={session.muscle_soreness ?? preData.muscle_soreness} />
              </div>
            </div>

            {/* Physical Readiness */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-3">Physical Readiness</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <DataField label="Hours Since Last Meal" value={session.hours_since_meal ?? preData.hours_since_meal} />
                <DataField label="Hydration" value={session.hydration ?? preData.hydration} />
                <DataField label="Days Since Last Session" value={session.days_since_last_session ?? preData.days_since_last_session} />
                <DataField label="Days Since Rest Day" value={session.days_since_rest_day ?? preData.days_since_rest_day} />
                <DataField label="Soreness Locations" value={session.soreness_locations ?? preData.soreness_locations} />
              </div>
            </div>

            {/* Substances */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-3">Substances</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <DataField label="Had Caffeine" value={session.had_caffeine ?? preData.had_caffeine} />
                <DataField label="Caffeine Amount" value={session.caffeine_amount ?? preData.caffeine_amount} />
                <DataField label="Had Alcohol (24h)" value={session.had_alcohol ?? preData.had_alcohol ?? preData.alcohol_last_24h} />
                <DataField label="Alcohol Amount" value={session.alcohol_amount ?? preData.alcohol_amount} />
              </div>
            </div>

            {/* Session Intent */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-3">Session Intent</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <DataField label="Primary Goal" value={session.primary_goal ?? preData.primary_goal} color="fuchsia" />
                <DataField label="Session Focus" value={session.session_focus ?? preData.session_focus} />
                <DataField label="Planned Duration" value={session.planned_duration_minutes ? `${session.planned_duration_minutes} min` : preData.planned_duration ? `${preData.planned_duration} min` : null} />
              </div>
            </div>

            {/* Location Specific */}
            {!session.is_outdoor && (session.gym_name || Boolean(preData.gym_name)) && (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-3">Indoor Details</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <DataField label="Gym Name" value={session.gym_name ?? preData.gym_name} />
                </div>
              </div>
            )}

            {session.is_outdoor && (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-3">Outdoor Details</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <DataField label="Crag/Area Name" value={session.crag_name ?? preData.crag_name} />
                  <DataField label="Rock Type" value={session.rock_type ?? preData.rock_type} />
                  <SliderField label="Conditions Rating" value={session.conditions_rating ?? preData.conditions_rating as number} max={10} color="emerald" />
                  <DataField label="Temperature" value={session.temperature ?? preData.temperature} />
                  <DataField label="Humidity" value={session.humidity ?? preData.humidity} />
                  <DataField label="Recent Precipitation" value={session.recent_precipitation ?? preData.recent_precipitation} />
                </div>
              </div>
            )}

            {/* Project Session */}
            {(session.is_project_session || Boolean(preData.is_project_session)) && (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-3">Project Details</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <DataField label="Project Name" value={session.project_name ?? preData.project_name} color="fuchsia" />
                  <DataField label="Session # on Project" value={session.project_session_number ?? preData.project_session_number} />
                  <DataField label="Current High Point" value={session.current_high_point ?? preData.current_high_point} />
                  <DataField label="Project Goal" value={session.project_goal ?? preData.project_goal} />
                  <DataField label="Section Focus" value={session.section_focus ?? preData.section_focus} />
                </div>
              </div>
            )}

            {/* Training Focus */}
            {(session.training_focus || Boolean(preData.training_focuses)) && (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-3">Training Details</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <DataField label="Training Focus" value={session.training_focus ?? preData.training_focuses} />
                  <DataField label="Planned Exercises" value={session.planned_exercises ?? preData.planned_exercises} />
                  <DataField label="Target Training Time" value={session.target_training_time ? `${session.target_training_time} min` : preData.target_training_time ? `${preData.target_training_time} min` : null} />
                </div>
              </div>
            )}

            {/* Lead Details */}
            {session.belay_type && (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-3">Lead Session Details</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <DataField label="Belay Type" value={session.belay_type ?? preData.belay_type} />
                </div>
              </div>
            )}

            {/* Pre-Session Pain */}
            {(session.had_pain_before || Boolean(preData.has_pain)) && (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-3">Pain / Injury (Before)</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <DataField label="Had Pain" value={session.had_pain_before ?? preData.has_pain} color="amber" />
                  <DataField label="Pain Location" value={session.pain_location ?? preData.pain_location} color="amber" />
                  <DataField label="Pain Severity" value={session.pain_severity ?? preData.pain_severity} color="amber" />
                </div>
              </div>
            )}

            {/* Notes */}
            {(session.notes || Boolean(preData.notes)) && (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-3">Notes</h4>
                <div className="p-3 rounded-xl bg-white/5">
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{session.notes || String(preData.notes)}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* POST-SESSION FORM DATA */}
      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 mb-6 overflow-hidden">
        <button 
          onClick={() => toggleSection('post')}
          className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <h3 className="font-semibold flex items-center gap-2">
            <span>🌙</span> Post-Session Form Data
          </h3>
          <span className={`transform transition-transform ${expandedSections.has('post') ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>
        
        {expandedSections.has('post') && (
          <div className="px-5 pb-5 space-y-4">
            {/* Core Outcomes */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-3">Core Outcomes</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <SliderField label="Session RPE" value={session.session_rpe ?? postData.session_rpe as number} color="emerald" />
                <SliderField label="Satisfaction" value={session.satisfaction ?? postData.satisfaction as number} max={5} color="fuchsia" />
                <DataField label="Actual vs Planned" value={session.actual_vs_planned ?? postData.actual_vs_planned ?? postData.left_early_or_stayed_longer} />
              </div>
            </div>

            {/* Fatigue & Recovery */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-3">Fatigue & Recovery</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <SliderField label="End Energy" value={session.end_energy ?? postData.end_energy as number ?? postData.end_of_session_energy as number} color="amber" />
                <DataField label="Skin Condition" value={session.skin_condition ?? postData.skin_condition} />
                <DataField label="Felt Pumped Out" value={session.felt_pumped_out ?? postData.felt_pumped_out ?? postData.felt_pumped} />
                <DataField label="Could Have Done More" value={session.could_have_done_more ?? postData.could_have_done_more ?? postData.could_do_more} />
              </div>
            </div>

            {/* Behavioral Proxies */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-3">Behavioral Metrics</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <DataField label="Skipped Planned Climbs" value={session.skipped_planned_climbs ?? postData.skipped_planned_climbs ?? postData.skipped_planned} />
                <DataField label="Attempted Harder" value={session.attempted_harder ?? postData.attempted_harder ?? postData.attempted_harder_than_planned} />
                <DataField label="'One More Try' Count" value={session.one_more_try_count ?? postData.one_more_try_count ?? postData.one_more_try_attempts} />
                <DataField label="Moved Toward Goal" value={session.moved_toward_goal ?? postData.moved_toward_goal ?? postData.did_session_move_toward_goal} />
              </div>
            </div>

            {/* Post-Session Pain */}
            {(session.had_pain_after || Boolean(postData.has_new_pain)) && (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-3">Pain / Injury (After)</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <DataField label="New Pain" value={session.had_pain_after ?? postData.has_new_pain} color="red" />
                  <DataField label="Pain Location" value={postData.new_pain_location ?? postData.pain_location} color="red" />
                  <DataField label="Pain Severity" value={postData.new_pain_severity ?? postData.pain_severity} color="red" />
                  <DataField label="Pre-existing Pain Status" value={postData.pre_existing_pain_status} />
                </div>
              </div>
            )}

            {/* Project Session Results */}
            {(session.is_project_session || session.sent_project !== null || Boolean(postData.project_sent)) && (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-3">Project Results</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <DataField label="Total Attempts" value={session.total_attempts ?? postData.project_total_attempts} />
                  <DataField label="Highest Point Reached" value={session.highest_point_reached ?? postData.project_highest_point} />
                  <DataField label="Matched/Exceeded High Point" value={session.matched_high_point ?? postData.project_matched_high_point} />
                  <DataField label="Linked More Moves" value={session.linked_more_moves ?? postData.project_linked_more} />
                  <DataField label="Sent Project!" value={session.sent_project ?? postData.project_sent} color="emerald" />
                  <DataField label="Send Attempts" value={session.send_attempts ?? postData.project_send_attempts_this_session} />
                  <DataField label="Fall Location" value={session.fall_location ?? postData.project_fall_location} />
                  <DataField label="Same Crux" value={session.same_crux ?? postData.project_same_crux} />
                  <DataField label="Crux Type" value={session.crux_type ?? postData.project_crux_type} />
                  <DataField label="Limiting Factors" value={session.limiting_factors ?? postData.project_limiting_factor} />
                  <DataField label="Beta Changes" value={session.beta_changes ?? postData.project_beta_notes} />
                </div>
              </div>
            )}

            {/* Lead Session Results */}
            {(session.routes_attempted || Boolean(postData.lead_routes_attempted)) && (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-3">Lead Session Results</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <DataField label="Routes Attempted" value={session.routes_attempted ?? postData.lead_routes_attempted} />
                  <DataField label="Total Pitches" value={session.total_pitches ?? postData.lead_total_pitches} />
                  <DataField label="Onsight Rate" value={session.onsight_rate ? `${(session.onsight_rate * 100).toFixed(0)}%` : postData.lead_onsight_rate ? `${((postData.lead_onsight_rate as number) * 100).toFixed(0)}%` : null} />
                  <DataField label="Falls Count" value={session.falls_count ?? postData.lead_falls} />
                  <DataField label="Fall Types" value={session.fall_types ?? postData.lead_fall_types} />
                  <DataField label="Longest Route" value={session.longest_route ?? postData.lead_longest_route} />
                  <DataField label="Rest Time Between Routes" value={session.rest_time_between_routes ? `${session.rest_time_between_routes} min` : null} />
                  <DataField label="Head Game Falls" value={session.head_game_falls ?? postData.lead_head_game_falls} />
                  <DataField label="Backed Off (Fear)" value={session.backed_off_due_to_fear ?? postData.lead_backed_off_fear} />
                </div>
              </div>
            )}

            {/* Outdoor Conditions */}
            {session.is_outdoor && (session.conditions_vs_expected || Boolean(postData.actual_conditions_vs_expected)) && (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-3">Outdoor Conditions</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <DataField label="Conditions vs Expected" value={session.conditions_vs_expected ?? postData.actual_conditions_vs_expected} />
                  <DataField label="Skin Lasted" value={session.skin_lasted ?? postData.skin_lasted} />
                  <DataField label="Conditions Affected Performance" value={session.conditions_affected_performance ?? postData.conditions_affected_performance} />
                  <DataField label="Rock Quality" value={session.rock_quality ?? postData.rock_quality} />
                </div>
              </div>
            )}

            {/* Fun/Recreational */}
            {(session.had_fun !== null || Boolean(postData.did_you_have_fun)) && (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-3">Session Experience</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <DataField label="Had Fun" value={session.had_fun ?? postData.did_you_have_fun} color="cyan" />
                  <DataField label="Standout Moments" value={session.standout_moments ?? postData.standout_moments} />
                </div>
              </div>
            )}

            {/* Training Results */}
            {(session.training_quality || Boolean(postData.training_focus_concentration)) && (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-3">Training Results</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <DataField label="Training Quality" value={session.training_quality ?? postData.training_quality} />
                  <DataField label="Progressed/Regressed" value={session.progressed_or_regressed ?? postData.progressed_regressed} />
                  <DataField label="PRs Achieved" value={session.prs_achieved ?? postData.training_pr_details} />
                </div>
              </div>
            )}

            {/* Post Notes */}
            {Boolean(postData.notes) && (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-3">Post-Session Notes</h4>
                <div className="p-3 rounded-xl bg-white/5">
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{String(postData.notes)}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CLIMB LOG */}
      {liveClimbs.length > 0 && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 mb-6 overflow-hidden">
          <button 
            onClick={() => toggleSection('climbs')}
            className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors"
          >
            <h3 className="font-semibold flex items-center gap-2">
              <span>📋</span> Climb Log ({liveClimbs.length} climbs)
            </h3>
            <span className={`transform transition-transform ${expandedSections.has('climbs') ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>
          
          {expandedSections.has('climbs') && (
            <div className="px-5 pb-5">
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {liveClimbs.map((climb, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{climb.type === 'boulder' ? '🪨' : '🧗'}</span>
                      <div>
                        <span className="font-mono font-bold text-lg">{climb.grade}</span>
                        <span className="text-slate-500 text-sm ml-2 capitalize">{climb.type}</span>
                      </div>
                      <div className="flex gap-1.5 ml-2">
                        {climb.flashed && (
                          <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 text-xs font-medium">⚡ Flash</span>
                        )}
                        {climb.sent && !climb.flashed && (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-medium">✓ Send</span>
                        )}
                        {!climb.sent && (
                          <span className="px-2.5 py-1 rounded-lg bg-slate-500/20 text-slate-400 text-xs font-medium">× Attempt</span>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-slate-400">{climb.attempts} attempt{climb.attempts !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
              
              {/* Climb Summary */}
              <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-4 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold">{liveClimbs.length}</p>
                  <p className="text-xs text-slate-500">Total</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-400">{liveClimbs.filter(c => c.sent).length}</p>
                  <p className="text-xs text-slate-500">Sends</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-cyan-400">{liveClimbs.filter(c => c.flashed).length}</p>
                  <p className="text-xs text-slate-500">Flashes</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{liveClimbs.reduce((sum, c) => sum + c.attempts, 0)}</p>
                  <p className="text-xs text-slate-500">Attempts</p>
                </div>
              </div>
            </div>
          )}
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
