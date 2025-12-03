import { useEffect, useState, useCallback } from 'react'
import GridLayout from 'react-grid-layout'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Cell
} from 'recharts'
import { supabase } from '../lib/supabase'
import type { ClimbingSession } from '../lib/sessionService'
import 'react-grid-layout/css/styles.css'

// Grade constants
const BOULDER_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12+']
const SPORT_GRADES = ['5.6', '5.7', '5.8', '5.9', '5.10a', '5.10b', '5.10c', '5.10d', '5.11a', '5.11b', '5.11c', '5.11d', '5.12a', '5.12b', '5.12c', '5.12d', '5.13a+']

// Time frame options
const TIME_FRAMES = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Past Week' },
  { value: 'month', label: 'Past Month' },
  { value: '3months', label: 'Past 3 Months' },
  { value: '6months', label: 'Past 6 Months' },
  { value: 'year', label: 'Past Year' },
  { value: 'all', label: 'All Time' },
]

// Widget types
type WidgetType = 'grade-histogram' | 'grade-timeline' | 'personal-records' | 'session-stats' | 'climb-log'

interface Widget {
  id: string
  type: WidgetType
  title: string
}

interface Climb {
  grade: string
  type: 'boulder' | 'lead'
  attempts: number
  sent: boolean
  flashed: boolean
  date: string
}

// Default layout
const DEFAULT_LAYOUT = [
  { i: 'grade-histogram', x: 0, y: 0, w: 6, h: 4 },
  { i: 'grade-timeline', x: 6, y: 0, w: 6, h: 4 },
  { i: 'personal-records', x: 0, y: 4, w: 4, h: 3 },
  { i: 'session-stats', x: 4, y: 4, w: 4, h: 3 },
  { i: 'climb-log', x: 8, y: 4, w: 4, h: 3 },
]

const DEFAULT_WIDGETS: Widget[] = [
  { id: 'grade-histogram', type: 'grade-histogram', title: 'Grade Distribution' },
  { id: 'grade-timeline', type: 'grade-timeline', title: 'Climbing Timeline' },
  { id: 'personal-records', type: 'personal-records', title: 'Personal Records' },
  { id: 'session-stats', type: 'session-stats', title: 'Session Stats' },
  { id: 'climb-log', type: 'climb-log', title: 'Recent Climbs' },
]

export function Stats() {
  const [sessions, setSessions] = useState<ClimbingSession[]>([])
  const [climbs, setClimbs] = useState<Climb[]>([])
  const [loading, setLoading] = useState(true)
  const [timeFrame, setTimeFrame] = useState('all')
  const [gradeType, setGradeType] = useState<'boulder' | 'sport'>('boulder')
  const [environment, setEnvironment] = useState<'all' | 'indoor' | 'outdoor'>('all')
  const [layout, setLayout] = useState(DEFAULT_LAYOUT)
  const [widgets] = useState<Widget[]>(DEFAULT_WIDGETS)

  // Fetch all sessions
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('climbing_sessions')
        .select('*')
        .eq('user_id', userData.user.id)
        .eq('status', 'completed')
        .order('started_at', { ascending: false })

      if (error) {
        console.error('Error fetching sessions:', error)
        setLoading(false)
        return
      }

      setSessions((data as ClimbingSession[]) || [])
      
      // Extract all climbs from sessions
      const allClimbs: Climb[] = []
      ;(data as ClimbingSession[])?.forEach(session => {
        const postData = session.post_session_data as Record<string, unknown> || {}
        const liveClimbs = (postData.live_climbs as Array<{
          grade: string
          type: string
          attempts: number
          sent: boolean
          flashed: boolean
        }>) || []
        
        liveClimbs.forEach(climb => {
          allClimbs.push({
            ...climb,
            type: climb.type as 'boulder' | 'lead',
            date: session.started_at,
          })
        })
      })
      
      setClimbs(allClimbs)
      setLoading(false)
    }
    
    fetchData()
  }, [])

  // Filter data by time frame
  const getFilteredData = useCallback(() => {
    const now = new Date()
    let startDate: Date | null = null
    
    switch (timeFrame) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '3months':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case '6months':
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
        break
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = null
    }
    
    let filteredSessions = sessions
    let filteredClimbs = climbs
    
    if (startDate) {
      filteredSessions = sessions.filter(s => new Date(s.started_at) >= startDate!)
      filteredClimbs = climbs.filter(c => new Date(c.date) >= startDate!)
    }
    
    if (environment !== 'all') {
      filteredSessions = filteredSessions.filter(s => 
        environment === 'outdoor' ? s.is_outdoor : !s.is_outdoor
      )
      // Filter climbs by session environment would require mapping - skip for now
    }
    
    return { sessions: filteredSessions, climbs: filteredClimbs }
  }, [sessions, climbs, timeFrame, environment])

  const { sessions: filteredSessions, climbs: filteredClimbs } = getFilteredData()

  // Prepare histogram data
  const getHistogramData = () => {
    const grades = gradeType === 'boulder' ? BOULDER_GRADES : SPORT_GRADES
    const climbsOfType = filteredClimbs.filter(c => 
      gradeType === 'boulder' 
        ? c.type === 'boulder' || c.grade.startsWith('V')
        : c.type === 'lead' || c.grade.startsWith('5.')
    )
    
    const gradeMap = new Map<string, { attempts: number; sends: number; flashes: number }>()
    grades.forEach(g => gradeMap.set(g, { attempts: 0, sends: 0, flashes: 0 }))
    
    climbsOfType.forEach(climb => {
      const data = gradeMap.get(climb.grade)
      if (data) {
        data.attempts += climb.attempts
        if (climb.sent) data.sends++
        if (climb.flashed) data.flashes++
      }
    })
    
    return grades.map(grade => ({
      grade,
      attempts: gradeMap.get(grade)?.attempts || 0,
      sends: gradeMap.get(grade)?.sends || 0,
      flashes: gradeMap.get(grade)?.flashes || 0,
    })).filter(d => d.attempts > 0 || d.sends > 0)
  }

  // Prepare timeline data (grouped by week/month)
  const getTimelineData = () => {
    const climbsOfType = filteredClimbs.filter(c => 
      gradeType === 'boulder' 
        ? c.type === 'boulder' || c.grade.startsWith('V')
        : c.type === 'lead' || c.grade.startsWith('5.')
    )
    
    // Group by week
    const weekMap = new Map<string, number>()
    climbsOfType.forEach(climb => {
      const date = new Date(climb.date)
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      const key = weekStart.toISOString().split('T')[0]
      weekMap.set(key, (weekMap.get(key) || 0) + 1)
    })
    
    const data = Array.from(weekMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
    
    return data
  }

  // Calculate personal records
  const getPersonalRecords = () => {
    const boulderClimbs = filteredClimbs.filter(c => c.sent && (c.type === 'boulder' || c.grade.startsWith('V')))
    const sportClimbs = filteredClimbs.filter(c => c.sent && (c.type === 'lead' || c.grade.startsWith('5.')))
    
    const getGradeValue = (grade: string): number => {
      const vMatch = grade.match(/V(\d+)/)
      if (vMatch) return parseInt(vMatch[1])
      
      const ydsMatch = grade.match(/5\.(\d+)([a-d])?/)
      if (ydsMatch) {
        const base = parseInt(ydsMatch[1])
        const letter = ydsMatch[2]
        const letterValue = letter ? { a: 0, b: 1, c: 2, d: 3 }[letter] ?? 0 : 0
        return base * 10 + letterValue
      }
      return 0
    }
    
    const hardestBoulder = boulderClimbs.reduce((max, c) => 
      getGradeValue(c.grade) > getGradeValue(max?.grade || '') ? c : max
    , boulderClimbs[0])
    
    const hardestSport = sportClimbs.reduce((max, c) => 
      getGradeValue(c.grade) > getGradeValue(max?.grade || '') ? c : max
    , sportClimbs[0])
    
    const totalFlashes = filteredClimbs.filter(c => c.flashed).length
    const totalSends = filteredClimbs.filter(c => c.sent).length
    
    return {
      hardestBoulder: hardestBoulder?.grade || 'N/A',
      hardestSport: hardestSport?.grade || 'N/A',
      totalClimbs: filteredClimbs.length,
      totalSends,
      totalFlashes,
      sendRate: filteredClimbs.length > 0 ? Math.round((totalSends / filteredClimbs.length) * 100) : 0,
    }
  }

  // Get session stats
  const getSessionStats = () => {
    const totalSessions = filteredSessions.length
    const totalDuration = filteredSessions.reduce((sum, s) => sum + (s.actual_duration_minutes || 0), 0)
    const avgDuration = totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0
    const avgRpe = filteredSessions.length > 0
      ? Math.round(filteredSessions.reduce((sum, s) => sum + (s.session_rpe || 0), 0) / filteredSessions.filter(s => s.session_rpe).length * 10) / 10
      : 0
    
    const indoorCount = filteredSessions.filter(s => !s.is_outdoor).length
    const outdoorCount = filteredSessions.filter(s => s.is_outdoor).length
    
    return { totalSessions, totalDuration, avgDuration, avgRpe, indoorCount, outdoorCount }
  }

  const histogramData = getHistogramData()
  const timelineData = getTimelineData()
  const records = getPersonalRecords()
  const sessionStats = getSessionStats()

  // Handle layout change
  const handleLayoutChange = (newLayout: GridLayout.Layout[]) => {
    setLayout(newLayout)
    // Save to localStorage
    localStorage.setItem('statsLayout', JSON.stringify(newLayout))
  }

  // Load saved layout on mount
  useEffect(() => {
    const savedLayout = localStorage.getItem('statsLayout')
    if (savedLayout) {
      try {
        setLayout(JSON.parse(savedLayout))
      } catch {
        // Use default
      }
    }
  }, [])

  // Render widget content
  const renderWidget = (widget: Widget) => {
    switch (widget.type) {
      case 'grade-histogram':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Grade Distribution</h3>
              <div className="flex gap-1">
                <button
                  onClick={() => setGradeType('boulder')}
                  className={`px-2 py-1 text-xs rounded ${gradeType === 'boulder' ? 'bg-fuchsia-500/20 text-fuchsia-300' : 'text-slate-400 hover:bg-white/5'}`}
                >
                  Boulder
                </button>
                <button
                  onClick={() => setGradeType('sport')}
                  className={`px-2 py-1 text-xs rounded ${gradeType === 'sport' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:bg-white/5'}`}
                >
                  Sport
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              {histogramData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histogramData} margin={{ top: 5, right: 5, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis 
                      dataKey="grade" 
                      tick={{ fill: '#94a3b8', fontSize: 10 }} 
                      angle={-45}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: '#1a1f1e', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="sends" stackId="a" fill="#10b981" name="Sends" radius={[2, 2, 0, 0]}>
                      {histogramData.map((_, index) => (
                        <Cell key={`cell-${index}`} />
                      ))}
                    </Bar>
                    <Bar dataKey="flashes" stackId="a" fill="#22d3ee" name="Flashes" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                  No climb data available
                </div>
              )}
            </div>
          </div>
        )
      
      case 'grade-timeline':
        return (
          <div className="h-full flex flex-col">
            <h3 className="font-semibold text-sm mb-2">Climbing Timeline</h3>
            <div className="flex-1 min-h-0">
              {timelineData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData} margin={{ top: 5, right: 5, bottom: 20, left: 0 }}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      tickFormatter={(value) => {
                        const date = new Date(value)
                        return `${date.getMonth() + 1}/${date.getDate()}`
                      }}
                    />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: '#1a1f1e', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px'
                      }}
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#a855f7" 
                      fillOpacity={1} 
                      fill="url(#colorCount)"
                      name="Climbs"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                  No timeline data available
                </div>
              )}
            </div>
          </div>
        )
      
      case 'personal-records':
        return (
          <div className="h-full">
            <h3 className="font-semibold text-sm mb-3">🏆 Personal Records</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <span className="text-slate-400 text-sm">Hardest Boulder</span>
                <span className="font-bold text-fuchsia-400">{records.hardestBoulder}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <span className="text-slate-400 text-sm">Hardest Sport</span>
                <span className="font-bold text-cyan-400">{records.hardestSport}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <span className="text-slate-400 text-sm">Total Sends</span>
                <span className="font-bold text-emerald-400">{records.totalSends}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <span className="text-slate-400 text-sm">Send Rate</span>
                <span className="font-bold">{records.sendRate}%</span>
              </div>
            </div>
          </div>
        )
      
      case 'session-stats':
        return (
          <div className="h-full">
            <h3 className="font-semibold text-sm mb-3">📊 Session Stats</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <span className="text-slate-400 text-sm">Total Sessions</span>
                <span className="font-bold">{sessionStats.totalSessions}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <span className="text-slate-400 text-sm">Total Time</span>
                <span className="font-bold">{Math.round(sessionStats.totalDuration / 60)}h {sessionStats.totalDuration % 60}m</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <span className="text-slate-400 text-sm">Avg Duration</span>
                <span className="font-bold">{sessionStats.avgDuration}m</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <span className="text-slate-400 text-sm">Indoor / Outdoor</span>
                <span className="font-bold">{sessionStats.indoorCount} / {sessionStats.outdoorCount}</span>
              </div>
            </div>
          </div>
        )
      
      case 'climb-log':
        return (
          <div className="h-full flex flex-col">
            <h3 className="font-semibold text-sm mb-3">📋 Recent Climbs</h3>
            <div className="flex-1 overflow-y-auto space-y-2">
              {filteredClimbs.slice(0, 10).map((climb, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/5 text-sm">
                  <div className="flex items-center gap-2">
                    <span>{climb.type === 'boulder' ? '🪨' : '🧗'}</span>
                    <span className="font-mono font-medium">{climb.grade}</span>
                    {climb.flashed && <span className="text-cyan-400">⚡</span>}
                    {climb.sent && !climb.flashed && <span className="text-emerald-400">✓</span>}
                  </div>
                  <span className="text-slate-500 text-xs">
                    {new Date(climb.date).toLocaleDateString()}
                  </span>
                </div>
              ))}
              {filteredClimbs.length === 0 && (
                <div className="text-center text-slate-500 py-4">No climbs recorded</div>
              )}
            </div>
          </div>
        )
      
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center py-20">
          <div className="w-12 h-12 rounded-full border-2 border-fuchsia-500 border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">📈 Stats & Analytics</h1>
        <p className="text-slate-400">Deep dive into your climbing performance</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Time Frame */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Time:</span>
          <select
            value={timeFrame}
            onChange={(e) => setTimeFrame(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
          >
            {TIME_FRAMES.map(tf => (
              <option key={tf.value} value={tf.value}>{tf.label}</option>
            ))}
          </select>
        </div>

        {/* Environment */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Environment:</span>
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            {(['all', 'indoor', 'outdoor'] as const).map(env => (
              <button
                key={env}
                onClick={() => setEnvironment(env)}
                className={`px-3 py-2 text-sm capitalize transition-colors ${
                  environment === env
                    ? 'bg-fuchsia-500/20 text-fuchsia-300'
                    : 'text-slate-400 hover:bg-white/5'
                }`}
              >
                {env === 'indoor' ? '🏢 Indoor' : env === 'outdoor' ? '🏔️ Outdoor' : 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Reset Layout */}
        <button
          onClick={() => {
            setLayout(DEFAULT_LAYOUT)
            localStorage.removeItem('statsLayout')
          }}
          className="ml-auto px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
        >
          Reset Layout
        </button>
      </div>

      {/* Drag hint */}
      <p className="text-xs text-slate-500 mb-4">💡 Drag widgets to rearrange your dashboard</p>

      {/* Grid Layout */}
      <GridLayout
        className="layout"
        layout={layout}
        cols={12}
        rowHeight={60}
        width={1200}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".drag-handle"
        isResizable={true}
        isDraggable={true}
      >
        {widgets.map(widget => (
          <div
            key={widget.id}
            className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden"
          >
            <div className="drag-handle cursor-move h-full p-4">
              {renderWidget(widget)}
            </div>
          </div>
        ))}
      </GridLayout>

      {/* Summary Stats */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-white/10 bg-white/5 text-center">
          <p className="text-3xl font-bold text-fuchsia-400">{records.totalClimbs}</p>
          <p className="text-sm text-slate-400">Total Climbs</p>
        </div>
        <div className="p-4 rounded-2xl border border-white/10 bg-white/5 text-center">
          <p className="text-3xl font-bold text-emerald-400">{records.totalSends}</p>
          <p className="text-sm text-slate-400">Total Sends</p>
        </div>
        <div className="p-4 rounded-2xl border border-white/10 bg-white/5 text-center">
          <p className="text-3xl font-bold text-cyan-400">{records.totalFlashes}</p>
          <p className="text-sm text-slate-400">Total Flashes</p>
        </div>
        <div className="p-4 rounded-2xl border border-white/10 bg-white/5 text-center">
          <p className="text-3xl font-bold">{sessionStats.totalSessions}</p>
          <p className="text-sm text-slate-400">Sessions</p>
        </div>
      </div>
    </div>
  )
}

