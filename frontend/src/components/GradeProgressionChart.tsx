import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { ClimbingSession } from '../lib/sessionService'

interface GradeProgressionChartProps {
    sessions: ClimbingSession[]
}

export function GradeProgressionChart({ sessions }: GradeProgressionChartProps) {
    // Sort sessions by date (oldest to newest)
    const sortedSessions = [...sessions]
        .filter(s => s.highest_grade_sent)
        .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())

    // Process data for chart
    const data = sortedSessions.map(session => ({
        date: new Date(session.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        grade: session.highest_grade_sent,
        value: parseGradeValue(session.highest_grade_sent || ''),
        type: session.session_type,
    }))

    if (data.length < 2) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-white/5 rounded-2xl border border-white/10">
                <p>Not enough data to show progression</p>
                <p className="text-sm mt-2">Log a few more sessions!</p>
            </div>
        )
    }

    return (
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis
                        dataKey="date"
                        stroke="#94a3b8"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        stroke="#94a3b8"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => formatGradeValue(value)}
                        domain={['dataMin - 1', 'dataMax + 1']}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                        formatter={(value: number, name: string, props: any) => [props.payload.grade, 'Grade']}
                        labelStyle={{ color: '#94a3b8' }}
                    />
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#d946ef"
                        strokeWidth={3}
                        dot={{ fill: '#d946ef', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: '#fff' }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}

function parseGradeValue(grade: string): number {
    if (!grade) return 0

    // V Scale
    const vMatch = grade.match(/V(\d+)/)
    if (vMatch) return parseInt(vMatch[1])

    // YDS Scale (approximate mapping to V-scale integers for graph consistency)
    const ydsMatch = grade.match(/5\.(\d+)([a-d])?/)
    if (ydsMatch) {
        const base = parseInt(ydsMatch[1])
        // 5.9 approx V0, 5.10a approx V1... very rough but visual
        // Let's us a simple mapping: 5.10 = 10, 5.11 = 11.
        // Base 5.0 starts at 0.
        const letter = ydsMatch[2]
        const letterValue = letter ? { a: 0, b: 0.25, c: 0.5, d: 0.75 }[letter] ?? 0 : 0
        // Normalize to keep it somewhat close to V scale for mixed graphs? 
        // Actually, mixing V and YDS on one Y-axis is hard. 
        // Let's just return the "number" part + letter part.
        return base + letterValue
    }

    return 0
}

function formatGradeValue(value: number): string {
    // Heuristic: if value < 17, likely V or 5.x.
    // If we assume V scale for now or just generic number:
    return value.toString()
}
