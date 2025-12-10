import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createSession } from '../lib/sessionService'
import { saveActiveSession } from '../lib/sessionStorage'
import { Plus, Zap, Activity } from 'lucide-react'

interface CoachActionCenterProps {
    userName: string
    lastSessionDate?: string
    onSessionStart: () => void
}

export function CoachActionCenter({ userName, lastSessionDate, onSessionStart }: CoachActionCenterProps) {
    const navigate = useNavigate()
    const [loading, setLoading] = useState<'boulder' | 'rope' | null>(null)

    const handleQuickStart = async (type: 'bouldering' | 'lead') => {
        setLoading(type === 'bouldering' ? 'boulder' : 'rope')

        try {
            // 1. reasonable defaults for a quick session
            const defaults = {
                session_type: type,
                location: 'Local Gym', // Could be smarter but good enough
                is_outdoor: false,
                planned_duration_minutes: 90,

                // Middle-of-the-road pre-session stats so we don't block
                energy_level: 6,
                motivation: 7,
                sleep_quality: 6,
                stress_level: 4,

                pre_session_data: {
                    session_environment: type === 'bouldering' ? 'indoor_bouldering' : 'indoor_rope',
                    partner_status: 'partner_casual', // Assumption
                }
            }

            // 2. Create in DB
            const { data: session, error } = await createSession(defaults)

            if (error || !session) {
                throw error || new Error('Failed to create session')
            }

            // 3. Save to local storage for the "Active Session" banner
            saveActiveSession({
                sessionId: session.id,
                sessionType: session.session_type,
                location: session.location || '',
                startTime: new Date(session.started_at),
                isOutdoor: session.is_outdoor,
                plannedDuration: session.planned_duration_minutes || 90,
                preSessionData: session.pre_session_data,
            })

            // 4. Notify parent to refresh
            onSessionStart()

        } catch (err) {
            console.error('Quick start failed:', err)
            alert('Could not start quick session. Please try the full form.')
            navigate('/session/new')
        } finally {
            setLoading(null)
        }
    }

    const daysSince = lastSessionDate
        ? Math.floor((new Date().getTime() - new Date(lastSessionDate).getTime()) / (1000 * 60 * 60 * 24))
        : null

    return (
        <div className="rounded-3xl relative overflow-hidden bg-gradient-to-br from-indigo-900 to-fuchsia-900 border border-white/10 shadow-2xl">
            {/* Background decorations */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            <div className="relative p-8 md:p-10">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">

                    <div className="space-y-2 max-w-lg">
                        <h2 className="text-3xl md:text-4xl font-bold text-white">
                            Ready to crush, {userName}?
                        </h2>
                        <p className="text-indigo-200 text-lg">
                            {daysSince === null
                                ? "Let's log your first session!"
                                : daysSince === 0
                                    ? "Back for more today? Beast mode! 🦖"
                                    : daysSince > 3
                                        ? `It's been ${daysSince} days. The wall misses you.`
                                        : "Consistency is key. Keep it up!"
                            }
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        <button
                            onClick={() => handleQuickStart('bouldering')}
                            disabled={!!loading}
                            className="group relative px-6 py-4 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/10 transition-all flex items-center justify-center gap-3 active:scale-95"
                        >
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                {loading === 'boulder' ? <Activity className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 text-white" fill="currentColor" />}
                            </div>
                            <div className="text-left">
                                <span className="block text-sm font-medium text-fuchsia-200">Quick Start</span>
                                <span className="block font-bold text-white">Boulder</span>
                            </div>
                        </button>

                        <button
                            onClick={() => handleQuickStart('lead')}
                            disabled={!!loading}
                            className="group relative px-6 py-4 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/10 transition-all flex items-center justify-center gap-3 active:scale-95"
                        >
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                {loading === 'rope' ? <Activity className="w-5 h-5 animate-spin" /> : <div className="text-xl">🧗</div>}
                            </div>
                            <div className="text-left">
                                <span className="block text-sm font-medium text-cyan-200">Quick Start</span>
                                <span className="block font-bold text-white">Ropes</span>
                            </div>
                        </button>

                        <Link
                            to="/session/new"
                            className="px-6 py-4 rounded-2xl border border-white/10 hover:bg-white/5 transition-all flex items-center justify-center"
                        >
                            <Plus className="w-6 h-6 text-indigo-300" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
