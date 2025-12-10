import { useState } from 'react'
import { X, ChevronRight, ChevronLeft, Zap, Target, Dumbbell, Smile, AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { createSession as createDbSession } from '../lib/sessionService'
import { generateSessionRecommendation, type RecommendationResponse } from '../lib/recommendationService'
import { saveActiveSession } from '../lib/sessionStorage'

interface QuickstartModalProps {
    isOpen: boolean
    onClose: () => void
    onSessionStart: () => void
}

type SessionEnvironment = 'indoor_bouldering' | 'indoor_rope' | 'training'
type PrimaryGoal = 'limit_bouldering' | 'volume_mileage' | 'technique_drills' | 'social_fun'

interface QuickstartData {
    environment: SessionEnvironment | null
    goal: PrimaryGoal | null
    sleepQuality: number
    energyLevel: number
    motivation: number
    daysSinceLastSession: number
    fingerHealth: number | null // null = not asked yet, 1-10 = answered
}

const ENVIRONMENT_OPTIONS: { value: SessionEnvironment; label: string; icon: string }[] = [
    { value: 'indoor_bouldering', label: 'Boulder', icon: '🪨' },
    { value: 'indoor_rope', label: 'Ropes', icon: '🧗' },
    { value: 'training', label: 'Training', icon: '🏋️' },
]

const GOAL_OPTIONS: { value: PrimaryGoal; label: string; icon: React.ReactNode; description: string }[] = [
    { value: 'limit_bouldering', label: 'Climb Hard', icon: <Zap className="w-5 h-5" />, description: 'Push your limits' },
    { value: 'volume_mileage', label: 'Volume', icon: <Target className="w-5 h-5" />, description: 'Lots of climbing' },
    { value: 'technique_drills', label: 'Technique', icon: <Dumbbell className="w-5 h-5" />, description: 'Skill work' },
    { value: 'social_fun', label: 'Fun', icon: <Smile className="w-5 h-5" />, description: 'Enjoy yourself' },
]

// Smart defaults for variables not asked in Quickstart
function getSmartDefaults(data: QuickstartData, userBaseline?: Record<string, unknown>) {
    return {
        // Inferred from motivation
        stress_level: Math.max(1, 10 - data.motivation),

        // Neutral defaults
        sleep_hours: null,
        muscle_soreness: 'none',
        doms_severity: 1,
        doms_locations: [],
        planned_duration: 90,
        partner_status: 'solo',
        crowdedness: 3,
        hydration_feel: 'neutral',
        fueling_status: 'full_meal_3hr',
        skin_condition: 'fresh',

        // From user profile baseline (if available)
        fear_of_falling: userBaseline?.fear_of_falling ?? 5,
        performance_anxiety: userBaseline?.performance_anxiety ?? 5,

        // Physical readiness (neutral)
        upper_body_power: 5,
        shoulder_integrity: 5,
        leg_springiness: 5,
        finger_strength: data.fingerHealth ?? 7,
    }
}

export function QuickstartModal({ isOpen, onClose, onSessionStart }: QuickstartModalProps) {
    const navigate = useNavigate()
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null)
    const [error, setError] = useState<string | null>(null)

    const [data, setData] = useState<QuickstartData>({
        environment: null,
        goal: null,
        sleepQuality: 7,
        energyLevel: 6,
        motivation: 7,
        daysSinceLastSession: 2,
        fingerHealth: null,
    })

    const resetAndClose = () => {
        setStep(1)
        setData({
            environment: null,
            goal: null,
            sleepQuality: 7,
            energyLevel: 6,
            motivation: 7,
            daysSinceLastSession: 2,
            fingerHealth: null,
        })
        setRecommendation(null)
        setError(null)
        onClose()
    }

    const canProceedStep1 = data.environment !== null && data.goal !== null
    const canProceedStep3 = data.fingerHealth !== null

    const handleGetRecommendation = async () => {
        if (!data.environment || !data.goal) return

        setLoading(true)
        setError(null)

        try {
            const defaults = getSmartDefaults(data)

            const preSessionData = {
                session_environment: data.environment,
                primary_goal: data.goal,
                sleep_quality: data.sleepQuality,
                energy_level: data.energyLevel,
                motivation: data.motivation,
                days_since_last_session: data.daysSinceLastSession,
                finger_tendon_health: data.fingerHealth,
                ...defaults,
            }

            const rec = await generateSessionRecommendation(preSessionData)
            setRecommendation(rec)
            setStep(4) // Show recommendation
        } catch (err) {
            console.error('Failed to get recommendation:', err)
            setError('Could not generate recommendation. Starting session anyway.')
            // Fallback: just start session without recommendation
            await handleStartSession()
        } finally {
            setLoading(false)
        }
    }

    const handleStartSession = async () => {
        if (!data.environment || !data.goal) return

        setLoading(true)

        try {
            const defaults = getSmartDefaults(data)
            const sessionType = data.environment.includes('bouldering') ? 'bouldering'
                : data.environment.includes('rope') ? 'lead'
                    : 'training'

            const preSessionData = {
                session_environment: data.environment,
                primary_goal: data.goal,
                sleep_quality: data.sleepQuality,
                energy_level: data.energyLevel,
                motivation: data.motivation,
                days_since_last_session: data.daysSinceLastSession,
                finger_tendon_health: data.fingerHealth ?? 7,
                ...defaults,
            }

            // Create session in DB
            const { data: session, error: dbError } = await createDbSession({
                session_type: sessionType,
                location: 'Local Gym',
                is_outdoor: false,
                planned_duration_minutes: 90,
                pre_session_data: preSessionData,
                energy_level: data.energyLevel,
                motivation: data.motivation,
                sleep_quality: data.sleepQuality,
                primary_goal: data.goal,
            })

            if (dbError || !session) {
                throw dbError || new Error('Failed to create session')
            }

            // Save to local storage
            saveActiveSession({
                sessionId: session.id,
                sessionType: session.session_type,
                location: session.location || '',
                startTime: new Date(session.started_at),
                isOutdoor: session.is_outdoor,
                plannedDuration: session.planned_duration_minutes || 90,
                preSessionData,
            })

            onSessionStart()
            resetAndClose()
        } catch (err) {
            console.error('Failed to start session:', err)
            setError('Failed to start session. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 rounded-3xl border border-white/10 shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold">Quick Session Setup</h2>
                        <p className="text-sm text-slate-400">Answer a few questions for personalized recommendations</p>
                    </div>
                    <button onClick={resetAndClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Progress */}
                <div className="px-6 pt-4">
                    <div className="flex gap-2">
                        {[1, 2, 3, 4].map((s) => (
                            <div
                                key={s}
                                className={`h-1 flex-1 rounded-full transition-all ${s <= step ? 'bg-gradient-to-r from-fuchsia-500 to-cyan-500' : 'bg-white/10'
                                    }`}
                            />
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 min-h-[320px]">

                    {/* Step 1: Environment & Goal */}
                    {step === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div>
                                <h3 className="text-sm font-medium text-slate-300 mb-3">What are you doing today?</h3>
                                <div className="grid grid-cols-3 gap-3">
                                    {ENVIRONMENT_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setData({ ...data, environment: opt.value })}
                                            className={`p-4 rounded-2xl border transition-all ${data.environment === opt.value
                                                ? 'bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 border-fuchsia-500/50'
                                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                                                }`}
                                        >
                                            <span className="text-3xl block mb-2">{opt.icon}</span>
                                            <span className="text-sm font-medium">{opt.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-medium text-slate-300 mb-3">What's your focus?</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {GOAL_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setData({ ...data, goal: opt.value })}
                                            className={`p-4 rounded-2xl border text-left transition-all ${data.goal === opt.value
                                                ? 'bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 border-fuchsia-500/50'
                                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={data.goal === opt.value ? 'text-fuchsia-400' : 'text-slate-400'}>
                                                    {opt.icon}
                                                </span>
                                                <span className="font-medium">{opt.label}</span>
                                            </div>
                                            <p className="text-xs text-slate-500">{opt.description}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Readiness Sliders */}
                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <h3 className="text-sm font-medium text-slate-300 mb-4">Quick Readiness Check</h3>

                            <ReadinessSlider
                                label="Sleep Quality"
                                value={data.sleepQuality}
                                onChange={(v) => setData({ ...data, sleepQuality: v })}
                                lowLabel="Terrible"
                                highLabel="Amazing"
                                color="violet"
                            />

                            <ReadinessSlider
                                label="Energy Level"
                                value={data.energyLevel}
                                onChange={(v) => setData({ ...data, energyLevel: v })}
                                lowLabel="Exhausted"
                                highLabel="Fired up"
                                color="amber"
                            />

                            <ReadinessSlider
                                label="Motivation"
                                value={data.motivation}
                                onChange={(v) => setData({ ...data, motivation: v })}
                                lowLabel="Not feeling it"
                                highLabel="Psyched!"
                                color="cyan"
                            />

                            <div>
                                <label className="text-sm text-slate-400 mb-2 block">Days since last climb</label>
                                <div className="flex gap-2">
                                    {[0, 1, 2, 3, 4, 5].map((d) => (
                                        <button
                                            key={d}
                                            onClick={() => setData({ ...data, daysSinceLastSession: d })}
                                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${data.daysSinceLastSession === d
                                                ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30'
                                                : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                                                }`}
                                        >
                                            {d === 5 ? '5+' : d}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Finger Health Gate */}
                    {step === 3 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="text-center mb-6">
                                <span className="text-4xl mb-3 block">🤚</span>
                                <h3 className="text-lg font-medium text-slate-200">How are your fingers feeling?</h3>
                                <p className="text-sm text-slate-400 mt-1">This helps us calibrate intensity recommendations</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setData({ ...data, fingerHealth: 8 })}
                                    className={`p-5 rounded-2xl border transition-all ${data.fingerHealth && data.fingerHealth >= 7
                                        ? 'bg-emerald-500/20 border-emerald-500/50'
                                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                                        }`}
                                >
                                    <span className="text-2xl mb-2 block">✅</span>
                                    <span className="font-medium">Feeling good</span>
                                    <p className="text-xs text-slate-400 mt-1">Ready for anything</p>
                                </button>

                                <button
                                    onClick={() => setData({ ...data, fingerHealth: 5 })}
                                    className={`p-5 rounded-2xl border transition-all ${data.fingerHealth && data.fingerHealth < 7 && data.fingerHealth >= 5
                                        ? 'bg-amber-500/20 border-amber-500/50'
                                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                                        }`}
                                >
                                    <span className="text-2xl mb-2 block">⚠️</span>
                                    <span className="font-medium">A bit tweaky</span>
                                    <p className="text-xs text-slate-400 mt-1">Some caution needed</p>
                                </button>
                            </div>

                            {data.fingerHealth && data.fingerHealth < 7 && (
                                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 animate-in fade-in">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium text-amber-300">We'll adjust recommendations</p>
                                            <p className="text-xs text-amber-200/70 mt-1">
                                                Lower intensity and focus on technique to protect your fingers.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 4: Recommendation Result */}
                    {step === 4 && recommendation && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="text-center mb-4">
                                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-fuchsia-500 to-cyan-500 flex items-center justify-center text-3xl mb-3">
                                    🎯
                                </div>
                                <h3 className="text-xl font-bold">
                                    Recommended: {recommendation.session_type.replace('_', ' ')}
                                </h3>
                                <p className="text-sm text-slate-400 mt-1">
                                    Confidence: <span className={
                                        recommendation.confidence === 'high' ? 'text-emerald-400' :
                                            recommendation.confidence === 'medium' ? 'text-amber-400' : 'text-slate-400'
                                    }>{recommendation.confidence}</span>
                                </p>
                            </div>

                            {/* Key Factors */}
                            {recommendation.key_factors && recommendation.key_factors.length > 0 && (
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                    <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Key Factors</h4>
                                    <div className="space-y-2">
                                        {recommendation.key_factors.slice(0, 3).map((factor, i) => (
                                            <div key={i} className="flex items-center justify-between text-sm">
                                                <span className="text-slate-300">{factor.variable.replace(/_/g, ' ')}</span>
                                                <span className={factor.direction === 'positive' ? 'text-emerald-400' : 'text-amber-400'}>
                                                    {factor.direction === 'positive' ? '↑' : '↓'} {factor.description}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Warnings */}
                            {recommendation.warnings && recommendation.warnings.length > 0 && (
                                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                                    {recommendation.warnings.map((w, i) => (
                                        <p key={i} className="text-sm text-amber-300">{w.message}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 mt-4">
                            <p className="text-sm text-red-300">{error}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
                    {step > 1 && step < 4 ? (
                        <button
                            onClick={() => setStep(step - 1)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Back
                        </button>
                    ) : (
                        <div />
                    )}

                    {step === 1 && (
                        <button
                            onClick={() => setStep(2)}
                            disabled={!canProceedStep1}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-fuchsia-500/25 transition-all"
                        >
                            Continue
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    )}

                    {step === 2 && (
                        <button
                            onClick={() => setStep(3)}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white font-medium hover:shadow-lg hover:shadow-fuchsia-500/25 transition-all"
                        >
                            Continue
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    )}

                    {step === 3 && (
                        <button
                            onClick={handleGetRecommendation}
                            disabled={!canProceedStep3 || loading}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-fuchsia-500/25 transition-all"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    Get Recommendation
                                    <Zap className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    )}

                    {step === 4 && (
                        <div className="flex gap-3 w-full justify-end">
                            <button
                                onClick={() => navigate('/session/new')}
                                className="px-4 py-2 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 transition-all"
                            >
                                Customize
                            </button>
                            <button
                                onClick={handleStartSession}
                                disabled={loading}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-medium hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Starting...
                                    </>
                                ) : (
                                    <>
                                        Start Session
                                        <ChevronRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// Reusable slider component
interface ReadinessSliderProps {
    label: string
    value: number
    onChange: (value: number) => void
    lowLabel: string
    highLabel: string
    color: 'violet' | 'amber' | 'cyan' | 'emerald'
}

function ReadinessSlider({ label, value, onChange, lowLabel, highLabel, color }: ReadinessSliderProps) {
    const colorClasses = {
        violet: 'from-violet-500 to-fuchsia-500',
        amber: 'from-amber-500 to-orange-500',
        cyan: 'from-cyan-500 to-blue-500',
        emerald: 'from-emerald-500 to-teal-500',
    }

    const textColors = {
        violet: 'text-violet-400',
        amber: 'text-amber-400',
        cyan: 'text-cyan-400',
        emerald: 'text-emerald-400',
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-slate-300">{label}</label>
                <span className={`text-lg font-bold ${textColors[color]}`}>{value}/10</span>
            </div>
            <input
                type="range"
                min="1"
                max="10"
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value))}
                className={`w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:${colorClasses[color]} [&::-webkit-slider-thumb]:shadow-lg`}
            />
            <div className="flex justify-between mt-1">
                <span className="text-xs text-slate-500">{lowLabel}</span>
                <span className="text-xs text-slate-500">{highLabel}</span>
            </div>
        </div>
    )
}
