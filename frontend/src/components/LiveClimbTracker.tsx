import { useState, useEffect } from 'react'

// Types for climb entries
export interface ClimbEntry {
  id: string
  grade: string
  type: 'boulder' | 'lead'
  attempts: number
  sent: boolean
  flashed: boolean
  timestamp: Date
}

interface ClimbTrackerProps {
  sessionType: string
  onClimbsUpdate?: (climbs: ClimbEntry[]) => void
}

// Grade options
const BOULDER_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12+']
const LEAD_GRADES = ['5.6', '5.7', '5.8', '5.9', '5.10a', '5.10b', '5.10c', '5.10d', '5.11a', '5.11b', '5.11c', '5.11d', '5.12a', '5.12b', '5.12c', '5.12d', '5.13a+']

// Storage key for persisting climbs during session
const STORAGE_KEY = 'activeSessionClimbs'

export function LiveClimbTracker({ sessionType, onClimbsUpdate }: ClimbTrackerProps) {
  const [climbs, setClimbs] = useState<ClimbEntry[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [climbType, setClimbType] = useState<'boulder' | 'lead'>(
    sessionType === 'lead' ? 'lead' : 'boulder'
  )
  const [selectedGrade, setSelectedGrade] = useState('')
  const [attempts, setAttempts] = useState(1)
  const [sent, setSent] = useState(true)
  const [flashed, setFlashed] = useState(false)

  // Load climbs from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setClimbs(parsed.map((c: ClimbEntry) => ({
          ...c,
          timestamp: new Date(c.timestamp),
        })))
      } catch {
        // Ignore parse errors
      }
    }
  }, [])

  // Save climbs to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(climbs))
    onClimbsUpdate?.(climbs)
  }, [climbs, onClimbsUpdate])

  const grades = climbType === 'boulder' ? BOULDER_GRADES : LEAD_GRADES

  const addClimb = () => {
    if (!selectedGrade) return

    const newClimb: ClimbEntry = {
      id: `climb_${Date.now()}`,
      grade: selectedGrade,
      type: climbType,
      attempts,
      sent,
      flashed: sent && flashed,
      timestamp: new Date(),
    }

    setClimbs([...climbs, newClimb])
    
    // Reset form
    setSelectedGrade('')
    setAttempts(1)
    setSent(true)
    setFlashed(false)
    setShowAddForm(false)
  }

  const removeClimb = (id: string) => {
    setClimbs(climbs.filter(c => c.id !== id))
  }

  // Calculate stats for histogram
  const getGradeStats = () => {
    const stats: Record<string, { attempts: number; sends: number; flashes: number }> = {}
    
    climbs.forEach(climb => {
      if (!stats[climb.grade]) {
        stats[climb.grade] = { attempts: 0, sends: 0, flashes: 0 }
      }
      stats[climb.grade].attempts += climb.attempts
      if (climb.sent) stats[climb.grade].sends += 1
      if (climb.flashed) stats[climb.grade].flashes += 1
    })

    return stats
  }

  const gradeStats = getGradeStats()
  const totalClimbs = climbs.length
  const totalSends = climbs.filter(c => c.sent).length
  const totalFlashes = climbs.filter(c => c.flashed).length
  const totalAttempts = climbs.reduce((sum, c) => sum + c.attempts, 0)

  // Get max value for histogram scaling
  const maxValue = Math.max(
    ...Object.values(gradeStats).map(s => Math.max(s.attempts, s.sends)),
    1
  )

  // Sort grades for display
  const sortedGrades = Object.keys(gradeStats).sort((a, b) => {
    const aIndex = BOULDER_GRADES.includes(a) ? BOULDER_GRADES.indexOf(a) : LEAD_GRADES.indexOf(a)
    const bIndex = BOULDER_GRADES.includes(b) ? BOULDER_GRADES.indexOf(b) : LEAD_GRADES.indexOf(b)
    return aIndex - bIndex
  })

  return (
    <div className="mt-4 pt-4 border-t border-white/10">
      {/* Header with stats */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <h3 className="font-semibold text-sm">Live Climb Tracker</h3>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            showAddForm
              ? 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
          }`}
        >
          {showAddForm ? 'Cancel' : '+ Log Climb'}
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="p-2 rounded-lg bg-white/5 text-center">
          <p className="text-lg font-bold">{totalClimbs}</p>
          <p className="text-[10px] text-slate-500 uppercase">Climbs</p>
        </div>
        <div className="p-2 rounded-lg bg-emerald-500/10 text-center">
          <p className="text-lg font-bold text-emerald-400">{totalSends}</p>
          <p className="text-[10px] text-slate-500 uppercase">Sends</p>
        </div>
        <div className="p-2 rounded-lg bg-cyan-500/10 text-center">
          <p className="text-lg font-bold text-cyan-400">{totalFlashes}</p>
          <p className="text-[10px] text-slate-500 uppercase">Flashes</p>
        </div>
        <div className="p-2 rounded-lg bg-white/5 text-center">
          <p className="text-lg font-bold">{totalAttempts}</p>
          <p className="text-[10px] text-slate-500 uppercase">Attempts</p>
        </div>
      </div>

      {/* Add Climb Form */}
      {showAddForm && (
        <div className="mb-4 p-4 rounded-xl bg-white/5 border border-white/10 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Climb Type Toggle */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => {
                setClimbType('boulder')
                setSelectedGrade('')
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                climbType === 'boulder'
                  ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              🪨 Boulder
            </button>
            <button
              type="button"
              onClick={() => {
                setClimbType('lead')
                setSelectedGrade('')
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                climbType === 'lead'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              🧗 Lead/Sport
            </button>
          </div>

          {/* Grade Selection */}
          <div className="mb-4">
            <label className="text-xs text-slate-400 mb-2 block">Grade</label>
            <div className="flex flex-wrap gap-1.5">
              {grades.map(grade => (
                <button
                  key={grade}
                  type="button"
                  onClick={() => setSelectedGrade(grade)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedGrade === grade
                      ? climbType === 'boulder'
                        ? 'bg-pink-500/30 text-pink-200 border border-pink-500/50'
                        : 'bg-sky-500/30 text-sky-200 border border-sky-500/50'
                      : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {grade}
                </button>
              ))}
            </div>
          </div>

          {/* Attempts */}
          <div className="mb-4">
            <label className="text-xs text-slate-400 mb-2 block">Attempts</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAttempts(Math.max(1, attempts - 1))}
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-lg hover:bg-white/10 transition-colors"
              >
                −
              </button>
              <span className="text-xl font-bold w-8 text-center">{attempts}</span>
              <button
                type="button"
                onClick={() => setAttempts(attempts + 1)}
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-lg hover:bg-white/10 transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Sent / Flashed Toggles */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
              <span className="text-xs text-slate-300">Sent?</span>
              <button
                type="button"
                onClick={() => {
                  setSent(!sent)
                  if (sent) setFlashed(false)
                }}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  sent ? 'bg-emerald-500' : 'bg-white/20'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-200 ${
                  sent ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
              <span className="text-xs text-slate-300">Flashed?</span>
              <button
                type="button"
                onClick={() => setFlashed(!flashed)}
                disabled={!sent}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  flashed ? 'bg-cyan-500' : 'bg-white/20'
                } ${!sent ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-200 ${
                  flashed ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>

          {/* Add Button */}
          <button
            onClick={addClimb}
            disabled={!selectedGrade}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-medium text-sm shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            ✅ Log Climb
          </button>
        </div>
      )}

      {/* Live Histogram */}
      {sortedGrades.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-slate-500 mb-2">Grade Distribution</p>
          <div className="space-y-2">
            {sortedGrades.map(grade => {
              const stats = gradeStats[grade]
              const attemptWidth = (stats.attempts / maxValue) * 100
              const sendWidth = (stats.sends / maxValue) * 100
              const flashWidth = (stats.flashes / maxValue) * 100
              
              return (
                <div key={grade} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400 w-12">{grade}</span>
                  <div className="flex-1 h-6 bg-white/5 rounded-lg overflow-hidden relative">
                    {/* Attempts bar (background) */}
                    <div
                      className="absolute inset-y-0 left-0 bg-slate-500/30 transition-all duration-300"
                      style={{ width: `${attemptWidth}%` }}
                    />
                    {/* Sends bar */}
                    <div
                      className="absolute inset-y-0 left-0 bg-emerald-500/50 transition-all duration-300"
                      style={{ width: `${sendWidth}%` }}
                    />
                    {/* Flashes bar */}
                    <div
                      className="absolute inset-y-0 left-0 bg-cyan-400/70 transition-all duration-300"
                      style={{ width: `${flashWidth}%` }}
                    />
                    {/* Labels */}
                    <div className="absolute inset-0 flex items-center justify-end pr-2">
                      <span className="text-[10px] text-white/70">
                        {stats.sends}/{stats.attempts}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {/* Legend */}
          <div className="flex justify-center gap-4 mt-2">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-slate-500/30" />
              <span className="text-[10px] text-slate-500">Attempts</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-emerald-500/50" />
              <span className="text-[10px] text-slate-500">Sends</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-cyan-400/70" />
              <span className="text-[10px] text-slate-500">Flashes</span>
            </div>
          </div>
        </div>
      )}

      {/* Recent Climbs List */}
      {climbs.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-2">Recent Climbs</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {[...climbs].reverse().slice(0, 10).map(climb => (
              <div
                key={climb.id}
                className="flex items-center justify-between p-2 rounded-lg bg-white/5 group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{climb.type === 'boulder' ? '🪨' : '🧗'}</span>
                  <span className="font-mono text-sm font-medium">{climb.grade}</span>
                  <div className="flex gap-1">
                    {climb.flashed && (
                      <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px]">⚡ Flash</span>
                    )}
                    {climb.sent && !climb.flashed && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">✓ Send</span>
                    )}
                    {!climb.sent && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400 text-[10px]">× Attempt</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{climb.attempts} att</span>
                  <button
                    onClick={() => removeClimb(climb.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {climbs.length === 0 && !showAddForm && (
        <div className="text-center py-4">
          <p className="text-sm text-slate-500">No climbs logged yet</p>
          <p className="text-xs text-slate-600">Click "+ Log Climb" to start tracking!</p>
        </div>
      )}
    </div>
  )
}

// Export function to get stored climbs (for use when completing session)
export function getStoredClimbs(): ClimbEntry[] {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      return JSON.parse(stored).map((c: ClimbEntry) => ({
        ...c,
        timestamp: new Date(c.timestamp),
      }))
    } catch {
      return []
    }
  }
  return []
}

// Export function to clear stored climbs
export function clearStoredClimbs() {
  localStorage.removeItem(STORAGE_KEY)
}

