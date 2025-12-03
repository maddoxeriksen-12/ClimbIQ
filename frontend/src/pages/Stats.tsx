import { useEffect, useState, useCallback, useMemo } from 'react'
import GridLayout from 'react-grid-layout'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter,
  ComposedChart
} from 'recharts'
import { supabase } from '../lib/supabase'
import type { ClimbingSession } from '../lib/sessionService'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

// Grade constants
const BOULDER_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12+']
const SPORT_GRADES = ['5.6', '5.7', '5.8', '5.9', '5.10a', '5.10b', '5.10c', '5.10d', '5.11a', '5.11b', '5.11c', '5.11d', '5.12a', '5.12b', '5.12c', '5.12d', '5.13a+']

// Chart type options
const CHART_TYPES = [
  { value: 'bar', label: 'Bar/Column', icon: '📊' },
  { value: 'line', label: 'Line', icon: '📈' },
  { value: 'numeric', label: 'Numeric Point', icon: '🔢' },
  { value: 'combo', label: 'Combination Column & Line', icon: '📉' },
  { value: 'stacked-bar', label: 'Stacked Bar/Column', icon: '📊' },
  { value: 'stacked-area', label: 'Stacked Area', icon: '📈' },
  { value: 'pie', label: 'Pie', icon: '🥧' },
  { value: 'heatmap', label: 'Heat Map', icon: '🌡️' },
  { value: 'bubble', label: 'Bubble', icon: '🫧' },
  { value: 'cluster-bubble', label: 'Cluster Bubble', icon: '⭕' },
  { value: 'scatter', label: 'Scatterplot', icon: '✨' },
]

// Available measures from pre/post session forms
const AVAILABLE_MEASURES = [
  { category: 'Pre-Session', items: [
    { value: 'energy_level', label: 'Energy Level', type: 'number' },
    { value: 'motivation', label: 'Motivation', type: 'number' },
    { value: 'sleep_quality', label: 'Sleep Quality', type: 'number' },
    { value: 'stress_level', label: 'Stress Level', type: 'number' },
    { value: 'hydration', label: 'Hydration', type: 'number' },
    { value: 'hours_since_meal', label: 'Hours Since Meal', type: 'number' },
    { value: 'planned_duration', label: 'Planned Duration', type: 'number' },
  ]},
  { category: 'Post-Session', items: [
    { value: 'session_rpe', label: 'Session RPE', type: 'number' },
    { value: 'satisfaction', label: 'Satisfaction', type: 'number' },
    { value: 'actual_duration', label: 'Actual Duration', type: 'number' },
    { value: 'total_climbs', label: 'Total Climbs', type: 'number' },
    { value: 'total_sends', label: 'Total Sends', type: 'number' },
    { value: 'flash_count', label: 'Flash Count', type: 'number' },
    { value: 'end_energy', label: 'End Energy', type: 'number' },
  ]},
  { category: 'Climbing', items: [
    { value: 'grade', label: 'Grade', type: 'string' },
    { value: 'attempts', label: 'Attempts', type: 'number' },
    { value: 'sends', label: 'Sends', type: 'number' },
    { value: 'flashes', label: 'Flashes', type: 'number' },
  ]},
]

// Available dimensions
const AVAILABLE_DIMENSIONS = [
  { value: 'date', label: 'Date' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'session_type', label: 'Session Type' },
  { value: 'location', label: 'Location' },
  { value: 'is_outdoor', label: 'Indoor/Outdoor' },
  { value: 'grade', label: 'Grade' },
  { value: 'climb_type', label: 'Climb Type (Boulder/Sport)' },
  { value: 'primary_goal', label: 'Primary Goal' },
]

// Color palettes
const COLOR_PALETTES = [
  { name: 'Default', colors: ['#a855f7', '#22d3ee', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'] },
  { name: 'Vibrant', colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9', '#fd79a8', '#a29bfe'] },
  { name: 'Earth', colors: ['#8d6e63', '#a1887f', '#bcaaa4', '#d7ccc8', '#795548', '#6d4c41', '#5d4037', '#4e342e'] },
  { name: 'Ocean', colors: ['#0077b6', '#00b4d8', '#90e0ef', '#caf0f8', '#03045e', '#023e8a', '#0096c7', '#48cae4'] },
]

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

// Widget configuration interface
interface WidgetConfig {
  id: string
  title: string
  chartType: string
  measures: string[]
  dimensions: string[]
  colorPalette: number
  colorByMeasure: string | null
  filters: { field: string; operator: string; value: string }[]
  gradeType: 'boulder' | 'sport'
  locked: boolean
  sortBy: string | null
  sortOrder: 'asc' | 'desc'
}

interface Climb {
  grade: string
  type: 'boulder' | 'lead'
  attempts: number
  sent: boolean
  flashed: boolean
  date: string
}

// Default widget configurations
const DEFAULT_WIDGETS: WidgetConfig[] = [
  { 
    id: 'grade-histogram', 
    title: 'Grade Distribution', 
    chartType: 'stacked-bar',
    measures: ['sends', 'flashes'],
    dimensions: ['grade'],
    colorPalette: 0,
    colorByMeasure: null,
    filters: [],
    gradeType: 'boulder',
    locked: false,
    sortBy: null,
    sortOrder: 'asc'
  },
  { 
    id: 'grade-timeline', 
    title: 'Climbing Timeline', 
    chartType: 'stacked-area',
    measures: ['total_climbs'],
    dimensions: ['week'],
    colorPalette: 0,
    colorByMeasure: null,
    filters: [],
    gradeType: 'boulder',
    locked: false,
    sortBy: null,
    sortOrder: 'asc'
  },
  { 
    id: 'personal-records', 
    title: 'Personal Records', 
    chartType: 'numeric',
    measures: ['sends'],
    dimensions: [],
    colorPalette: 0,
    colorByMeasure: null,
    filters: [],
    gradeType: 'boulder',
    locked: false,
    sortBy: null,
    sortOrder: 'asc'
  },
  { 
    id: 'session-stats', 
    title: 'Session Stats', 
    chartType: 'numeric',
    measures: ['session_rpe', 'satisfaction'],
    dimensions: [],
    colorPalette: 0,
    colorByMeasure: null,
    filters: [],
    gradeType: 'boulder',
    locked: false,
    sortBy: null,
    sortOrder: 'asc'
  },
  { 
    id: 'climb-log', 
    title: 'Recent Climbs', 
    chartType: 'bar',
    measures: ['sends'],
    dimensions: ['date'],
    colorPalette: 0,
    colorByMeasure: null,
    filters: [],
    gradeType: 'boulder',
    locked: false,
    sortBy: null,
    sortOrder: 'asc'
  },
]

// Layout item type
interface LayoutItem {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW: number
  minH: number
}

// Default layout
const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: 'grade-histogram', x: 0, y: 0, w: 6, h: 4, minW: 3, minH: 3 },
  { i: 'grade-timeline', x: 6, y: 0, w: 6, h: 4, minW: 3, minH: 3 },
  { i: 'personal-records', x: 0, y: 4, w: 4, h: 3, minW: 2, minH: 2 },
  { i: 'session-stats', x: 4, y: 4, w: 4, h: 3, minW: 2, minH: 2 },
  { i: 'climb-log', x: 8, y: 4, w: 4, h: 3, minW: 2, minH: 2 },
]

export function Stats() {
  const [sessions, setSessions] = useState<ClimbingSession[]>([])
  const [climbs, setClimbs] = useState<Climb[]>([])
  const [loading, setLoading] = useState(true)
  const [timeFrame, setTimeFrame] = useState('all')
  const [environment, setEnvironment] = useState<'all' | 'indoor' | 'outdoor'>('all')
  const [layout, setLayout] = useState(() => {
    const saved = localStorage.getItem('statsLayout')
    if (saved) {
      try { return JSON.parse(saved) } catch { /* use default */ }
    }
    return DEFAULT_LAYOUT
  })
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    const saved = localStorage.getItem('statsWidgets')
    if (saved) {
      try { return JSON.parse(saved) } catch { /* use default */ }
    }
    return DEFAULT_WIDGETS
  })
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [editingWidget, setEditingWidget] = useState<WidgetConfig | null>(null)

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


  // Filter data by time frame - memoized to prevent re-renders
  const filteredData = useMemo(() => {
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
    }
    
    return { sessions: filteredSessions, climbs: filteredClimbs }
  }, [sessions, climbs, timeFrame, environment])

  // Get histogram data for a specific widget
  const getHistogramData = useCallback((widget: WidgetConfig) => {
    const grades = widget.gradeType === 'boulder' ? BOULDER_GRADES : SPORT_GRADES
    const climbsOfType = filteredData.climbs.filter(c => 
      widget.gradeType === 'boulder' 
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
  }, [filteredData.climbs])

  // Get timeline data
  const getTimelineData = useCallback((widget: WidgetConfig) => {
    const climbsOfType = filteredData.climbs.filter(c => 
      widget.gradeType === 'boulder' 
        ? c.type === 'boulder' || c.grade.startsWith('V')
        : c.type === 'lead' || c.grade.startsWith('5.')
    )
    
    const weekMap = new Map<string, number>()
    climbsOfType.forEach(climb => {
      const date = new Date(climb.date)
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      const key = weekStart.toISOString().split('T')[0]
      weekMap.set(key, (weekMap.get(key) || 0) + 1)
    })
    
    return Array.from(weekMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredData.climbs])

  // Get personal records
  const getPersonalRecords = useCallback(() => {
    const boulderClimbs = filteredData.climbs.filter(c => c.sent && (c.type === 'boulder' || c.grade.startsWith('V')))
    const sportClimbs = filteredData.climbs.filter(c => c.sent && (c.type === 'lead' || c.grade.startsWith('5.')))
    
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
    
    return {
      hardestBoulder: hardestBoulder?.grade || 'N/A',
      hardestSport: hardestSport?.grade || 'N/A',
      totalClimbs: filteredData.climbs.length,
      totalSends: filteredData.climbs.filter(c => c.sent).length,
      totalFlashes: filteredData.climbs.filter(c => c.flashed).length,
      sendRate: filteredData.climbs.length > 0 
        ? Math.round((filteredData.climbs.filter(c => c.sent).length / filteredData.climbs.length) * 100) 
        : 0,
    }
  }, [filteredData.climbs])

  // Get session stats
  const getSessionStats = useCallback(() => {
    const totalSessions = filteredData.sessions.length
    const totalDuration = filteredData.sessions.reduce((sum, s) => sum + (s.actual_duration_minutes || 0), 0)
    const avgDuration = totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0
    const sessionsWithRpe = filteredData.sessions.filter(s => s.session_rpe)
    const avgRpe = sessionsWithRpe.length > 0
      ? Math.round(sessionsWithRpe.reduce((sum, s) => sum + (s.session_rpe || 0), 0) / sessionsWithRpe.length * 10) / 10
      : 0
    
    return { 
      totalSessions, 
      totalDuration, 
      avgDuration, 
      avgRpe,
      indoorCount: filteredData.sessions.filter(s => !s.is_outdoor).length,
      outdoorCount: filteredData.sessions.filter(s => s.is_outdoor).length,
    }
  }, [filteredData.sessions])

  // Handle layout change
  const handleLayoutChange = useCallback((newLayout: GridLayout.Layout[]) => {
    // Only update if widgets are not locked
    const unlockedLayout = newLayout.map(item => {
      const widget = widgets.find(w => w.id === item.i)
      if (widget?.locked) {
        const oldItem = layout.find((l: LayoutItem) => l.i === item.i)
        return oldItem || { 
          i: item.i, 
          x: item.x, 
          y: item.y, 
          w: item.w, 
          h: item.h, 
          minW: item.minW ?? 2, 
          minH: item.minH ?? 2 
        }
      }
      return { 
        i: item.i, 
        x: item.x, 
        y: item.y, 
        w: item.w, 
        h: item.h, 
        minW: item.minW ?? 2, 
        minH: item.minH ?? 2 
      }
    })
    setLayout(unlockedLayout)
    localStorage.setItem('statsLayout', JSON.stringify(unlockedLayout))
  }, [widgets, layout])

  // Handle widget update
  const handleWidgetUpdate = useCallback((updatedWidget: WidgetConfig) => {
    const newWidgets = widgets.map(w => w.id === updatedWidget.id ? updatedWidget : w)
    setWidgets(newWidgets)
    localStorage.setItem('statsWidgets', JSON.stringify(newWidgets))
    setEditingWidget(null)
  }, [widgets])

  // Handle widget delete
  const handleWidgetDelete = useCallback((widgetId: string) => {
    const newWidgets = widgets.filter(w => w.id !== widgetId)
    const newLayout = layout.filter((l: LayoutItem) => l.i !== widgetId)
    setWidgets(newWidgets)
    setLayout(newLayout)
    localStorage.setItem('statsWidgets', JSON.stringify(newWidgets))
    localStorage.setItem('statsLayout', JSON.stringify(newLayout))
    setActiveMenu(null)
  }, [widgets, layout])

  // Handle sort
  const handleSort = useCallback((widgetId: string, sortBy: string) => {
    const widget = widgets.find(w => w.id === widgetId)
    if (!widget) return
    
    const newSortOrder = widget.sortBy === sortBy && widget.sortOrder === 'asc' ? 'desc' : 'asc'
    handleWidgetUpdate({ ...widget, sortBy, sortOrder: newSortOrder })
    setActiveMenu(null)
  }, [widgets, handleWidgetUpdate])

  // Handle lock toggle
  const handleLockToggle = useCallback((widgetId: string) => {
    const widget = widgets.find(w => w.id === widgetId)
    if (!widget) return
    handleWidgetUpdate({ ...widget, locked: !widget.locked })
    setActiveMenu(null)
  }, [widgets, handleWidgetUpdate])

  // Add new widget
  const handleAddWidget = useCallback(() => {
    const newId = `widget-${Date.now()}`
    const newWidget: WidgetConfig = {
      id: newId,
      title: 'New Chart',
      chartType: 'bar',
      measures: ['sends'],
      dimensions: ['grade'],
      colorPalette: 0,
      colorByMeasure: null,
      filters: [],
      gradeType: 'boulder',
      locked: false,
      sortBy: null,
      sortOrder: 'asc',
    }
    
    const newLayoutItem = {
      i: newId,
      x: 0,
      y: Infinity, // Will be placed at bottom
      w: 4,
      h: 3,
      minW: 2,
      minH: 2,
    }
    
    setWidgets([...widgets, newWidget])
    setLayout([...layout, newLayoutItem])
    setEditingWidget(newWidget)
  }, [widgets, layout])

  // Render chart based on type
  const renderChart = useCallback((widget: WidgetConfig, data: Array<Record<string, unknown>>, colors: string[]) => {
    if (!data || data.length === 0) {
      return (
        <div className="h-full flex items-center justify-center text-slate-500 text-sm">
          No data available
        </div>
      )
    }

    const xKey = widget.dimensions[0] || 'name'
    const yKeys = widget.measures.length > 0 ? widget.measures : ['value']

    switch (widget.chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, bottom: 30, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey={xKey} tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-45} textAnchor="end" />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
              {yKeys.map((key, i) => (
                <Bar key={key} dataKey={key} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )

      case 'stacked-bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, bottom: 30, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey={xKey} tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-45} textAnchor="end" />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
              {yKeys.map((key, i) => (
                <Bar key={key} dataKey={key} stackId="a" fill={colors[i % colors.length]} radius={i === yKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )

      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 5, bottom: 30, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey={xKey} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
              {yKeys.map((key, i) => (
                <Line key={key} type="monotone" dataKey={key} stroke={colors[i % colors.length]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )

      case 'stacked-area':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 30, left: 0 }}>
              <defs>
                {yKeys.map((key, i) => (
                  <linearGradient key={key} id={`color-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors[i % colors.length]} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={colors[i % colors.length]} stopOpacity={0.1}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey={xKey} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
              {yKeys.map((key, i) => (
                <Area key={key} type="monotone" dataKey={key} stackId="1" stroke={colors[i % colors.length]} fill={`url(#color-${key})`} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey={yKeys[0]} nameKey={xKey} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={2}>
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1a1f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
            </PieChart>
          </ResponsiveContainer>
        )

      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 5, right: 5, bottom: 30, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey={xKey} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis dataKey={yKeys[0]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
              <Scatter data={data} fill={colors[0]} />
            </ScatterChart>
          </ResponsiveContainer>
        )

      case 'combo':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 30, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey={xKey} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
              {yKeys.slice(0, 1).map((key, i) => (
                <Bar key={key} dataKey={key} fill={colors[i]} radius={[4, 4, 0, 0]} />
              ))}
              {yKeys.slice(1).map((key, i) => (
                <Line key={key} type="monotone" dataKey={key} stroke={colors[i + 1]} strokeWidth={2} />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        )

      default:
        return (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            Chart type not supported
          </div>
        )
    }
  }, [])

  // Render widget content
  const renderWidgetContent = useCallback((widget: WidgetConfig) => {
    const colors = COLOR_PALETTES[widget.colorPalette]?.colors || COLOR_PALETTES[0].colors

    // Special handling for specific widget types
    if (widget.id === 'grade-histogram' || (widget.dimensions.includes('grade') && widget.chartType !== 'numeric')) {
      const data = getHistogramData(widget)
      return (
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Grade Type:</span>
            <div className="flex gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleWidgetUpdate({ ...widget, gradeType: 'boulder' })
                }}
                className={`px-2 py-1 text-xs rounded transition-colors ${widget.gradeType === 'boulder' ? 'bg-fuchsia-500/20 text-fuchsia-300' : 'text-slate-400 hover:bg-white/5'}`}
              >
                Boulder
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleWidgetUpdate({ ...widget, gradeType: 'sport' })
                }}
                className={`px-2 py-1 text-xs rounded transition-colors ${widget.gradeType === 'sport' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:bg-white/5'}`}
              >
                Sport
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            {renderChart(widget, data as Array<Record<string, unknown>>, colors)}
          </div>
        </div>
      )
    }

    if (widget.id === 'grade-timeline' || widget.dimensions.includes('week')) {
      const data = getTimelineData(widget)
      return (
        <div className="h-full flex flex-col">
          <div className="flex-1 min-h-0">
            {renderChart(widget, data.map(d => ({ ...d, name: d.date })) as Array<Record<string, unknown>>, colors)}
          </div>
        </div>
      )
    }

    if (widget.id === 'personal-records' || widget.chartType === 'numeric') {
      const records = getPersonalRecords()
      return (
        <div className="h-full overflow-y-auto">
          <div className="space-y-2">
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
    }

    if (widget.id === 'session-stats') {
      const stats = getSessionStats()
      return (
        <div className="h-full overflow-y-auto">
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
              <span className="text-slate-400 text-sm">Total Sessions</span>
              <span className="font-bold">{stats.totalSessions}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
              <span className="text-slate-400 text-sm">Total Time</span>
              <span className="font-bold">{Math.round(stats.totalDuration / 60)}h {stats.totalDuration % 60}m</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
              <span className="text-slate-400 text-sm">Avg Duration</span>
              <span className="font-bold">{stats.avgDuration}m</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
              <span className="text-slate-400 text-sm">Indoor / Outdoor</span>
              <span className="font-bold">{stats.indoorCount} / {stats.outdoorCount}</span>
            </div>
          </div>
        </div>
      )
    }

    if (widget.id === 'climb-log') {
      return (
        <div className="h-full overflow-y-auto">
          <div className="space-y-1">
            {filteredData.climbs.slice(0, 10).map((climb, i) => (
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
            {filteredData.climbs.length === 0 && (
              <div className="text-center text-slate-500 py-4">No climbs recorded</div>
            )}
          </div>
        </div>
      )
    }

    // Default chart rendering
    return renderChart(widget, [], colors)
  }, [getHistogramData, getTimelineData, getPersonalRecords, getSessionStats, filteredData.climbs, renderChart, handleWidgetUpdate])

  // Render widget menu
  const renderWidgetMenu = (widget: WidgetConfig) => (
    <div className="absolute top-2 right-2 z-20">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setActiveMenu(activeMenu === widget.id ? null : widget.id)
        }}
        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
        </svg>
      </button>
      
      {activeMenu === widget.id && (
        <div 
          className="absolute top-full right-0 mt-1 w-40 rounded-xl border border-white/10 bg-[#1a1f1e] shadow-xl overflow-hidden z-30"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleSort(widget.id, widget.dimensions[0] || 'value')}
            className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 transition-colors flex items-center gap-2"
          >
            <span>↕️</span> Sort
          </button>
          <button
            onClick={() => handleLockToggle(widget.id)}
            className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 transition-colors flex items-center gap-2"
          >
            <span>{widget.locked ? '🔓' : '🔒'}</span> {widget.locked ? 'Unlock' : 'Lock in Place'}
          </button>
          <button
            onClick={() => {
              setEditingWidget(widget)
              setActiveMenu(null)
            }}
            className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 transition-colors flex items-center gap-2"
          >
            <span>✏️</span> Edit
          </button>
          <button
            onClick={() => handleWidgetDelete(widget.id)}
            className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 transition-colors flex items-center gap-2 text-red-400"
          >
            <span>🗑️</span> Delete
          </button>
        </div>
      )}
    </div>
  )

  // Edit Modal
  const renderEditModal = () => {
    if (!editingWidget) return null

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditingWidget(null)} />
        
        <div className="relative bg-[#0f1412] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
          <div className="sticky top-0 bg-[#0f1412] border-b border-white/10 p-6 flex items-center justify-between">
            <h2 className="text-xl font-bold">Edit Chart</h2>
            <button onClick={() => setEditingWidget(null)} className="p-2 hover:bg-white/5 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Chart Title</label>
              <input
                type="text"
                value={editingWidget.title}
                onChange={(e) => setEditingWidget({ ...editingWidget, title: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
              />
            </div>

            {/* Chart Type */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Chart Type</label>
              <div className="grid grid-cols-3 gap-2">
                {CHART_TYPES.map(type => (
                  <button
                    key={type.value}
                    onClick={() => setEditingWidget({ ...editingWidget, chartType: type.value })}
                    className={`p-3 rounded-xl border text-sm transition-all ${
                      editingWidget.chartType === type.value
                        ? 'border-fuchsia-500/50 bg-fuchsia-500/10 text-fuchsia-300'
                        : 'border-white/10 hover:bg-white/5'
                    }`}
                  >
                    <span className="text-lg block mb-1">{type.icon}</span>
                    <span className="text-xs">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Measures */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Measures</label>
              <div className="space-y-3">
                {AVAILABLE_MEASURES.map(category => (
                  <div key={category.category}>
                    <p className="text-xs text-slate-500 mb-2">{category.category}</p>
                    <div className="flex flex-wrap gap-2">
                      {category.items.map(measure => (
                        <button
                          key={measure.value}
                          onClick={() => {
                            const measures = editingWidget.measures.includes(measure.value)
                              ? editingWidget.measures.filter(m => m !== measure.value)
                              : [...editingWidget.measures, measure.value]
                            setEditingWidget({ ...editingWidget, measures })
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                            editingWidget.measures.includes(measure.value)
                              ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30'
                              : 'bg-white/5 border border-white/10 hover:bg-white/10'
                          }`}
                        >
                          {measure.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dimensions */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Dimensions</label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_DIMENSIONS.map(dim => (
                  <button
                    key={dim.value}
                    onClick={() => {
                      const dimensions = editingWidget.dimensions.includes(dim.value)
                        ? editingWidget.dimensions.filter(d => d !== dim.value)
                        : [...editingWidget.dimensions, dim.value]
                      setEditingWidget({ ...editingWidget, dimensions })
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                      editingWidget.dimensions.includes(dim.value)
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {dim.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Palette */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Color Palette</label>
              <div className="space-y-2">
                {COLOR_PALETTES.map((palette, index) => (
                  <button
                    key={palette.name}
                    onClick={() => setEditingWidget({ ...editingWidget, colorPalette: index })}
                    className={`w-full p-3 rounded-xl border flex items-center gap-3 transition-all ${
                      editingWidget.colorPalette === index
                        ? 'border-fuchsia-500/50 bg-fuchsia-500/10'
                        : 'border-white/10 hover:bg-white/5'
                    }`}
                  >
                    <span className="text-sm font-medium">{palette.name}</span>
                    <div className="flex gap-1 ml-auto">
                      {palette.colors.slice(0, 8).map((color, i) => (
                        <div key={i} className="w-5 h-5 rounded" style={{ backgroundColor: color }} />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Color by Measure */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Color by Measure (Optional)</label>
              <select
                value={editingWidget.colorByMeasure || ''}
                onChange={(e) => setEditingWidget({ ...editingWidget, colorByMeasure: e.target.value || null })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
              >
                <option value="">None</option>
                {editingWidget.measures.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Filters */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Filters</label>
              <p className="text-xs text-slate-500 mb-3">Add filters to narrow down the data</p>
              
              {editingWidget.filters.map((filter, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <select
                    value={filter.field}
                    onChange={(e) => {
                      const newFilters = [...editingWidget.filters]
                      newFilters[index].field = e.target.value
                      setEditingWidget({ ...editingWidget, filters: newFilters })
                    }}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  >
                    {AVAILABLE_DIMENSIONS.map(dim => (
                      <option key={dim.value} value={dim.value}>{dim.label}</option>
                    ))}
                  </select>
                  <select
                    value={filter.operator}
                    onChange={(e) => {
                      const newFilters = [...editingWidget.filters]
                      newFilters[index].operator = e.target.value
                      setEditingWidget({ ...editingWidget, filters: newFilters })
                    }}
                    className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  >
                    <option value="equals">=</option>
                    <option value="not_equals">≠</option>
                    <option value="greater">{'>'}</option>
                    <option value="less">{'<'}</option>
                    <option value="contains">Contains</option>
                  </select>
                  <input
                    type="text"
                    value={filter.value}
                    onChange={(e) => {
                      const newFilters = [...editingWidget.filters]
                      newFilters[index].value = e.target.value
                      setEditingWidget({ ...editingWidget, filters: newFilters })
                    }}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                    placeholder="Value"
                  />
                  <button
                    onClick={() => {
                      const newFilters = editingWidget.filters.filter((_, i) => i !== index)
                      setEditingWidget({ ...editingWidget, filters: newFilters })
                    }}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-red-400"
                  >
                    ✕
                  </button>
                </div>
              ))}
              
              <button
                onClick={() => {
                  const newFilters = [...editingWidget.filters, { field: 'session_type', operator: 'equals', value: '' }]
                  setEditingWidget({ ...editingWidget, filters: newFilters })
                }}
                className="w-full py-2 rounded-lg border border-dashed border-white/20 text-sm text-slate-400 hover:border-white/40 hover:text-white transition-colors"
              >
                + Add Filter
              </button>
            </div>
          </div>
          
          <div className="sticky bottom-0 bg-[#0f1412] border-t border-white/10 p-6 flex justify-end gap-3">
            <button
              onClick={() => setEditingWidget(null)}
              className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleWidgetUpdate(editingWidget)}
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white font-medium"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    )
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

        {/* Add Widget */}
        <button
          onClick={handleAddWidget}
          className="ml-auto px-4 py-2 rounded-lg bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + Add Chart
        </button>

        {/* Reset Layout */}
        <button
          onClick={() => {
            setLayout(DEFAULT_LAYOUT)
            setWidgets(DEFAULT_WIDGETS)
            localStorage.removeItem('statsLayout')
            localStorage.removeItem('statsWidgets')
          }}
          className="px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
        >
          Reset Layout
        </button>
      </div>

      {/* Drag hint */}
      <p className="text-xs text-slate-500 mb-4">💡 Drag widgets to rearrange • Drag edges to resize</p>

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
        resizeHandles={['se', 'sw', 'ne', 'nw', 'e', 'w', 'n', 's']}
      >
        {widgets.map(widget => (
          <div
            key={widget.id}
            className={`rounded-2xl border bg-white/5 backdrop-blur-sm overflow-hidden ${
              widget.locked ? 'border-amber-500/30' : 'border-white/10'
            }`}
          >
            <div className="h-full flex flex-col">
              {/* Widget Header */}
              <div className="drag-handle cursor-move px-4 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  {widget.locked && <span className="text-amber-400">🔒</span>}
                  {widget.title}
                </h3>
                {renderWidgetMenu(widget)}
              </div>
              
              {/* Widget Content */}
              <div className="flex-1 p-4 min-h-0">
                {renderWidgetContent(widget)}
              </div>
            </div>
          </div>
        ))}
      </GridLayout>

      {/* Summary Stats */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-white/10 bg-white/5 text-center">
          <p className="text-3xl font-bold text-fuchsia-400">{filteredData.climbs.length}</p>
          <p className="text-sm text-slate-400">Total Climbs</p>
        </div>
        <div className="p-4 rounded-2xl border border-white/10 bg-white/5 text-center">
          <p className="text-3xl font-bold text-emerald-400">{filteredData.climbs.filter(c => c.sent).length}</p>
          <p className="text-sm text-slate-400">Total Sends</p>
        </div>
        <div className="p-4 rounded-2xl border border-white/10 bg-white/5 text-center">
          <p className="text-3xl font-bold text-cyan-400">{filteredData.climbs.filter(c => c.flashed).length}</p>
          <p className="text-sm text-slate-400">Total Flashes</p>
        </div>
        <div className="p-4 rounded-2xl border border-white/10 bg-white/5 text-center">
          <p className="text-3xl font-bold">{filteredData.sessions.length}</p>
          <p className="text-sm text-slate-400">Sessions</p>
        </div>
      </div>

      {/* Edit Modal */}
      {renderEditModal()}
    </div>
  )
}
