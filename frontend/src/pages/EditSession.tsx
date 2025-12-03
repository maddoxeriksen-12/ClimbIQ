import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getSessionById, updateSession, type ClimbingSession } from '../lib/sessionService'

interface Climb {
  id: string
  grade: string
  type: 'boulder' | 'lead'
  attempts: number
  sent: boolean
  flashed: boolean
}

const BOULDER_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12+']
const LEAD_GRADES = ['5.6', '5.7', '5.8', '5.9', '5.10a', '5.10b', '5.10c', '5.10d', '5.11a', '5.11b', '5.11c', '5.11d', '5.12a', '5.12b', '5.12c', '5.12d', '5.13a+']

export function EditSession() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<ClimbingSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'climbs' | 'metrics'>('details')
  
  // Form state
  const [formData, setFormData] = useState({
    session_type: '',
    location: '',
    is_outdoor: false,
    started_at: '',
    ended_at: '',
    session_rpe: 4,
    satisfaction: 3,
    notes: '',
    highest_grade_sent: '',
    highest_grade_attempted: '',
  })
  
  // Climbs state
  const [climbs, setClimbs] = useState<Climb[]>([])
  const [newClimb, setNewClimb] = useState({
    type: 'boulder' as 'boulder' | 'lead',
    grade: '',
    attempts: 1,
    sent: false,
    flashed: false,
  })

  useEffect(() => {
    async function fetchSession() {
      if (!sessionId) return
      
      setLoading(true)
      const { data, error } = await getSessionById(sessionId)
      
      if (error || !data) {
        console.error('Error fetching session:', error)
        setLoading(false)
        return
      }
      
      setSession(data)
      
      // Format datetime for input
      const formatDateTimeLocal = (dateStr: string) => {
        const date = new Date(dateStr)
        const offset = date.getTimezoneOffset()
        const localDate = new Date(date.getTime() - offset * 60000)
        return localDate.toISOString().slice(0, 16)
      }
      
      setFormData({
        session_type: data.session_type || '',
        location: data.location || '',
        is_outdoor: data.is_outdoor || false,
        started_at: data.started_at ? formatDateTimeLocal(data.started_at) : '',
        ended_at: data.ended_at ? formatDateTimeLocal(data.ended_at) : '',
        session_rpe: data.session_rpe || 4,
        satisfaction: data.satisfaction || 3,
        notes: data.notes || '',
        highest_grade_sent: data.highest_grade_sent || '',
        highest_grade_attempted: data.highest_grade_attempted || '',
      })
      
      // Load existing climbs
      const postData = data.post_session_data as Record<string, unknown> || {}
      const existingClimbs = (postData.live_climbs as Climb[]) || []
      setClimbs(existingClimbs.map((c, i) => ({ ...c, id: c.id || `climb-${i}` })))
      
      setLoading(false)
    }
    
    fetchSession()
  }, [sessionId])

  const handleAddClimb = () => {
    if (!newClimb.grade) return
    
    const climb: Climb = {
      id: `climb-${Date.now()}`,
      ...newClimb,
    }
    
    setClimbs([...climbs, climb])
    setNewClimb({
      type: newClimb.type,
      grade: '',
      attempts: 1,
      sent: false,
      flashed: false,
    })
  }

  const handleRemoveClimb = (id: string) => {
    setClimbs(climbs.filter(c => c.id !== id))
  }

  const handleSave = async () => {
    if (!sessionId) return
    
    setSaving(true)
    
    // Calculate stats from climbs
    const totalClimbs = climbs.length
    const totalSends = climbs.filter(c => c.sent).length
    const flashCount = climbs.filter(c => c.flashed).length
    
    // Find highest grades
    const sentClimbs = climbs.filter(c => c.sent)
    let highestSent = formData.highest_grade_sent
    let highestAttempted = formData.highest_grade_attempted
    
    if (sentClimbs.length > 0) {
      highestSent = sentClimbs.reduce((highest, climb) => {
        const currentValue = getGradeValue(climb.grade)
        const highestValue = getGradeValue(highest)
        return currentValue > highestValue ? climb.grade : highest
      }, sentClimbs[0].grade)
    }
    
    if (climbs.length > 0) {
      highestAttempted = climbs.reduce((highest, climb) => {
        const currentValue = getGradeValue(climb.grade)
        const highestValue = getGradeValue(highest)
        return currentValue > highestValue ? climb.grade : highest
      }, climbs[0].grade)
    }
    
    // Build post_session_data with climbs
    const postData = (session?.post_session_data as Record<string, unknown>) || {}
    const updatedPostData = {
      ...postData,
      live_climbs: climbs,
    }
    
    const { error } = await updateSession({
      session_id: sessionId,
      session_type: formData.session_type,
      location: formData.location,
      is_outdoor: formData.is_outdoor,
      started_at: formData.started_at ? new Date(formData.started_at).toISOString() : undefined,
      ended_at: formData.ended_at ? new Date(formData.ended_at).toISOString() : undefined,
      session_rpe: formData.session_rpe,
      satisfaction: formData.satisfaction,
      notes: formData.notes,
      highest_grade_sent: highestSent || undefined,
      highest_grade_attempted: highestAttempted || undefined,
      total_climbs: totalClimbs,
      total_sends: totalSends,
      flash_count: flashCount,
      post_session_data: updatedPostData,
    })
    
    setSaving(false)
    
    if (error) {
      alert('Failed to save changes. Please try again.')
      return
    }
    
    navigate(`/sessions/${sessionId}`)
  }

  const getGradeValue = (grade: string): number => {
    const vMatch = grade.match(/V(\d+)/)
    if (vMatch) return parseInt(vMatch[1]) * 10
    
    const ydsMatch = grade.match(/5\.(\d+)([a-d])?/)
    if (ydsMatch) {
      const base = parseInt(ydsMatch[1]) * 10
      const letter = ydsMatch[2]
      const letterValue = letter ? { a: 0, b: 2, c: 4, d: 6 }[letter] ?? 0 : 0
      return base + letterValue
    }
    
    return 0
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

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link to={`/sessions/${sessionId}`} className="text-sm text-slate-400 hover:text-white mb-4 inline-flex items-center gap-1">
          ← Back to Session
        </Link>
        
        <div className="flex items-center justify-between mt-4">
          <div>
            <h1 className="text-2xl font-bold">Edit Session</h1>
            <p className="text-slate-400 mt-1">Update session details or add climbs you forgot to log</p>
          </div>
          
          <div className="flex gap-3">
            <Link
              to={`/sessions/${sessionId}`}
              className="px-4 py-2 rounded-xl border border-white/10 text-sm hover:bg-white/5 transition-colors"
            >
              Cancel
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white font-medium text-sm shadow-lg shadow-fuchsia-500/25 hover:shadow-fuchsia-500/40 transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-white/10 pb-2">
        {(['details', 'climbs', 'metrics'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
              activeTab === tab
                ? 'bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab === 'climbs' ? '🧗 Climbs' : tab === 'metrics' ? '📊 Metrics' : '📝 Details'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'details' && (
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="font-semibold mb-4">Session Details</h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Session Type</label>
                <select
                  value={formData.session_type}
                  onChange={(e) => setFormData({ ...formData, session_type: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
                >
                  <option value="bouldering">🪨 Bouldering</option>
                  <option value="lead">🧗 Lead/Sport</option>
                  <option value="trad">⛰️ Trad</option>
                  <option value="training">🏋️ Training</option>
                  <option value="project">🎯 Project</option>
                  <option value="recreational">🎉 Recreational</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
                  placeholder="Gym or crag name"
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">Environment</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is_outdoor: false })}
                    className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${
                      !formData.is_outdoor
                        ? 'border-fuchsia-500/50 bg-fuchsia-500/10 text-fuchsia-300'
                        : 'border-white/10 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    🏢 Indoor
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is_outdoor: true })}
                    className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${
                      formData.is_outdoor
                        ? 'border-lime-500/50 bg-lime-500/10 text-lime-300'
                        : 'border-white/10 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    🏔️ Outdoor
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Time */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="font-semibold mb-4">Time</h3>
            <p className="text-sm text-slate-400 mb-4">Adjust start/end times if they were recorded incorrectly</p>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Start Time</label>
                <input
                  type="datetime-local"
                  value={formData.started_at}
                  onChange={(e) => setFormData({ ...formData, started_at: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">End Time</label>
                <input
                  type="datetime-local"
                  value={formData.ended_at}
                  onChange={(e) => setFormData({ ...formData, ended_at: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="font-semibold mb-4">Notes</h3>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 resize-none"
              placeholder="Add any notes about this session..."
            />
          </div>
        </div>
      )}

      {activeTab === 'climbs' && (
        <div className="space-y-6">
          {/* Add Climb */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="font-semibold mb-4">Add a Climb</h3>
            <p className="text-sm text-slate-400 mb-4">Forgot to log a climb? Add it here.</p>
            
            <div className="space-y-4">
              {/* Climb Type */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewClimb({ ...newClimb, type: 'boulder', grade: '' })}
                  className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${
                    newClimb.type === 'boulder'
                      ? 'border-fuchsia-500/50 bg-fuchsia-500/10 text-fuchsia-300'
                      : 'border-white/10 text-slate-400 hover:bg-white/5'
                  }`}
                >
                  🪨 Boulder
                </button>
                <button
                  type="button"
                  onClick={() => setNewClimb({ ...newClimb, type: 'lead', grade: '' })}
                  className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${
                    newClimb.type === 'lead'
                      ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300'
                      : 'border-white/10 text-slate-400 hover:bg-white/5'
                  }`}
                >
                  🧗 Lead/Sport
                </button>
              </div>
              
              {/* Grade and Attempts */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Grade</label>
                  <select
                    value={newClimb.grade}
                    onChange={(e) => setNewClimb({ ...newClimb, grade: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
                  >
                    <option value="">Select grade</option>
                    {(newClimb.type === 'boulder' ? BOULDER_GRADES : LEAD_GRADES).map(grade => (
                      <option key={grade} value={grade}>{grade}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Attempts</label>
                  <div className="flex items-center rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setNewClimb({ ...newClimb, attempts: Math.max(1, newClimb.attempts - 1) })}
                      className="px-4 py-3 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={newClimb.attempts}
                      onChange={(e) => setNewClimb({ ...newClimb, attempts: parseInt(e.target.value) || 1 })}
                      className="flex-1 bg-transparent text-white text-center focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setNewClimb({ ...newClimb, attempts: newClimb.attempts + 1 })}
                      className="px-4 py-3 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Outcome */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewClimb({ 
                    ...newClimb, 
                    sent: !newClimb.sent, 
                    flashed: newClimb.sent ? newClimb.flashed : false 
                  })}
                  className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${
                    newClimb.sent
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                      : 'border-white/10 text-slate-400 hover:bg-white/5'
                  }`}
                >
                  ✓ Sent
                </button>
                <button
                  type="button"
                  onClick={() => setNewClimb({ ...newClimb, flashed: !newClimb.flashed, sent: newClimb.flashed ? newClimb.sent : true })}
                  disabled={!newClimb.sent}
                  className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${
                    newClimb.flashed
                      ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300'
                      : 'border-white/10 text-slate-400 hover:bg-white/5 disabled:opacity-50'
                  }`}
                >
                  ⚡ Flashed
                </button>
              </div>
              
              <button
                onClick={handleAddClimb}
                disabled={!newClimb.grade}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white font-medium shadow-lg shadow-fuchsia-500/25 hover:shadow-fuchsia-500/40 transition-all disabled:opacity-50"
              >
                + Add Climb
              </button>
            </div>
          </div>

          {/* Climb List */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="font-semibold mb-4">Logged Climbs ({climbs.length})</h3>
            
            {climbs.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <span className="text-4xl mb-2 block">🧗</span>
                <p>No climbs logged yet</p>
                <p className="text-sm">Add climbs using the form above</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {climbs.map((climb) => (
                  <div
                    key={climb.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{climb.type === 'boulder' ? '🪨' : '🧗'}</span>
                      <div>
                        <span className="font-mono font-bold">{climb.grade}</span>
                        <div className="flex gap-2 mt-1">
                          {climb.flashed && (
                            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-xs">⚡ Flash</span>
                          )}
                          {climb.sent && !climb.flashed && (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-xs">✓ Send</span>
                          )}
                          {!climb.sent && (
                            <span className="px-2 py-0.5 rounded bg-slate-500/20 text-slate-400 text-xs">× Attempt</span>
                          )}
                          <span className="text-xs text-slate-500">{climb.attempts} attempt{climb.attempts !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveClimb(climb.id)}
                      className="px-3 py-1 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'metrics' && (
        <div className="space-y-6">
          {/* Session RPE */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="font-semibold mb-4">Session Metrics</h3>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-slate-400">Session RPE (Perceived Exertion)</label>
                  <span className="text-sm font-medium">{formData.session_rpe}/8</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={formData.session_rpe}
                  onChange={(e) => setFormData({ ...formData, session_rpe: parseInt(e.target.value) })}
                  className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-fuchsia-500"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>Easy</span>
                  <span>Max Effort</span>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-slate-400">Satisfaction</label>
                  <span className="text-sm font-medium">{formData.satisfaction}/5</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={formData.satisfaction}
                  onChange={(e) => setFormData({ ...formData, satisfaction: parseInt(e.target.value) })}
                  className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>Disappointing</span>
                  <span>Amazing</span>
                </div>
              </div>
            </div>
          </div>

          {/* Grade Overrides */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="font-semibold mb-4">Grade Records</h3>
            <p className="text-sm text-slate-400 mb-4">These are auto-calculated from your climbs, but you can override them if needed.</p>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Highest Grade Sent</label>
                <input
                  type="text"
                  value={formData.highest_grade_sent}
                  onChange={(e) => setFormData({ ...formData, highest_grade_sent: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
                  placeholder="e.g., V5 or 5.11a"
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">Highest Grade Attempted</label>
                <input
                  type="text"
                  value={formData.highest_grade_attempted}
                  onChange={(e) => setFormData({ ...formData, highest_grade_attempted: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
                  placeholder="e.g., V6 or 5.11c"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

