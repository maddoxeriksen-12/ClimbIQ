import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Sparkles } from 'lucide-react'
import { QuickstartModal } from './QuickstartModal'

interface CoachActionCenterProps {
    userName: string
    lastSessionDate?: string
    onSessionStart: () => void
}

export function CoachActionCenter({ userName, lastSessionDate, onSessionStart }: CoachActionCenterProps) {
    const [showQuickstart, setShowQuickstart] = useState(false)

    const daysSince = lastSessionDate
        ? Math.floor((new Date().getTime() - new Date(lastSessionDate).getTime()) / (1000 * 60 * 60 * 24))
        : null

    return (
        <>
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
                            {/* Primary CTA: Smart Start with Quickstart Modal */}
                            <button
                                onClick={() => setShowQuickstart(true)}
                                className="group relative px-8 py-5 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 hover:from-fuchsia-500 hover:to-cyan-500 border border-white/20 transition-all flex items-center justify-center gap-4 active:scale-95 shadow-lg shadow-fuchsia-500/25 hover:shadow-fuchsia-500/40"
                            >
                                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                    <Sparkles className="w-6 h-6 text-white" />
                                </div>
                                <div className="text-left">
                                    <span className="block text-sm font-medium text-white/80">Personalized</span>
                                    <span className="block text-xl font-bold text-white">Smart Start</span>
                                </div>
                            </button>

                            {/* Secondary: Full Form */}
                            <Link
                                to="/session/new"
                                className="px-6 py-4 rounded-2xl border border-white/10 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                            >
                                <Plus className="w-5 h-5 text-indigo-300" />
                                <span className="text-sm text-indigo-200">Full Form</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quickstart Modal */}
            <QuickstartModal
                isOpen={showQuickstart}
                onClose={() => setShowQuickstart(false)}
                onSessionStart={() => {
                    setShowQuickstart(false)
                    onSessionStart()
                }}
            />
        </>
    )
}

