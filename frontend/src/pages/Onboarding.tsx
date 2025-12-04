import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, type UserRole } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { GOAL_TYPES, createGoal, saveGoal, setActiveGoal, type GoalType } from '../lib/goalStorage'

type OnboardingStep = 'welcome' | 'role' | 'profile' | 'injury' | 'training' | 'psychological' | 'goal' | 'complete'

// Track which sections were skipped
interface SkippedSections {
  injury: boolean
  training: boolean
  psychological: boolean
}

// Psychological assessment types
interface PsychologicalData {
  // Fear of Falling Scale
  leadClimbingFear: number // 1-10
  boulderingHighballFear: number // 1-10
  outdoorVsIndoorDifference: 'much_worse_outdoor' | 'worse_outdoor' | 'same' | 'better_outdoor' | 'much_better_outdoor'
  fearTrajectory: 'improving' | 'stable' | 'worsening'
  
  // Performance Anxiety Profile
  cognitiveAnxiety: number // 1-10 (worry, negative thoughts)
  somaticAnxiety: number // 1-10 (physical symptoms)
  selfConfidenceBaseline: number // 1-10
  
  // Risk Tolerance Profile
  dynoCommitmentTolerance: 'low' | 'medium' | 'high'
  runoutComfort: 'low' | 'medium' | 'high'
  tryingHardPublicly: 'low' | 'medium' | 'high'
  
  // Flow State Tendency
  flowFrequency: 'never' | 'rarely' | 'sometimes' | 'often' | 'always'
}

// Body regions for injury tracking
const BODY_REGIONS = ['fingers', 'shoulders', 'elbows', 'wrists', 'skin'] as const
type BodyRegion = typeof BODY_REGIONS[number]
type InjuryStatus = 'none' | 'niggle' | 'injury' | 'recovering'

interface RegionInjury {
  status: InjuryStatus
  severity?: number // 1-10
  affectedSide?: 'left' | 'right' | 'both'
  duration?: string // weeks/months
  limitingActivities?: boolean
}

interface PastInjury {
  type: string
  details: string
  howLongAgo: string
  fullyRecovered: boolean
}

interface TrainingData {
  totalYearsClimbing: number
  yearsClimbingConsistently: number
  highestBoulderRedpoint: string
  highestSportRedpoint: string
  highestOnsight: string
  currentBoulderGrade: string
  currentSportGrade: string
  sessionsPerWeek: number
  hoursPerSession: number
  trainingSessionsPerWeek: number
  indoorOutdoorSplit: number // 0-100 (% indoor)
}

export function Onboarding() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<OnboardingStep>('welcome')
  const [role, setRole] = useState<UserRole>('athlete')
  const [fullName, setFullName] = useState('')
  const [selectedGoalType, setSelectedGoalType] = useState<GoalType | null>(null)
  const [goalTargetDate, setGoalTargetDate] = useState('')
  const [saving, setSaving] = useState(false)

  // Injury History State
  const [regionInjuries, setRegionInjuries] = useState<Record<BodyRegion, RegionInjury>>({
    fingers: { status: 'none' },
    shoulders: { status: 'none' },
    elbows: { status: 'none' },
    wrists: { status: 'none' },
    skin: { status: 'none' },
  })
  const [pastInjuries, setPastInjuries] = useState<PastInjury[]>([])
  const [chronicConditions, setChronicConditions] = useState<string[]>([])
  const [surgeryHistory, setSurgeryHistory] = useState('')

  // Training History State
  const [trainingData, setTrainingData] = useState<TrainingData>({
    totalYearsClimbing: 0,
    yearsClimbingConsistently: 0,
    highestBoulderRedpoint: '',
    highestSportRedpoint: '',
    highestOnsight: '',
    currentBoulderGrade: '',
    currentSportGrade: '',
    sessionsPerWeek: 2,
    hoursPerSession: 2,
    trainingSessionsPerWeek: 0,
    indoorOutdoorSplit: 80,
  })

  // Psychological Assessment State
  const [psychologicalData, setPsychologicalData] = useState<PsychologicalData>({
    leadClimbingFear: 5,
    boulderingHighballFear: 5,
    outdoorVsIndoorDifference: 'same',
    fearTrajectory: 'stable',
    cognitiveAnxiety: 5,
    somaticAnxiety: 5,
    selfConfidenceBaseline: 5,
    dynoCommitmentTolerance: 'medium',
    runoutComfort: 'medium',
    tryingHardPublicly: 'medium',
    flowFrequency: 'sometimes',
  })

  // Track skipped sections
  const [skippedSections, setSkippedSections] = useState<SkippedSections>({
    injury: false,
    training: false,
    psychological: false,
  })

  // Check if user has already completed onboarding
  useEffect(() => {
    if (!authLoading && user) {
      const onboardingCompleted = user.user_metadata?.onboarding_completed
      if (onboardingCompleted) {
        navigate('/')
      } else {
        // Pre-fill name if available from Google
        if (user.user_metadata?.full_name) {
          setFullName(user.user_metadata.full_name)
        } else if (user.user_metadata?.name) {
          setFullName(user.user_metadata.name)
        }
        // Check if role is already set
        if (user.user_metadata?.role) {
          setRole(user.user_metadata.role)
        }
      }
    }
  }, [user, authLoading, navigate])

  // If not authenticated, redirect to login
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  const handleRoleSelect = async (selectedRole: UserRole) => {
    setRole(selectedRole)
    setStep('profile')
  }

  const handleProfileSubmit = async () => {
    setSaving(true)
    try {
      await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          role: role,
        }
      })
      
      if (role === 'athlete') {
        setStep('injury') // Go to injury history step
      } else {
        // Coaches skip injury/training/goal, complete onboarding
        await completeOnboarding()
      }
    } catch (error) {
      console.error('Error updating profile:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleInjurySubmit = async () => {
    setSaving(true)
    try {
      // Save injury data to user metadata
      await supabase.auth.updateUser({
        data: {
          injury_history: {
            current_injuries: regionInjuries,
            past_injuries: pastInjuries,
            chronic_conditions: chronicConditions,
            surgery_history: surgeryHistory,
          }
        }
      })
      setStep('training')
    } catch (error) {
      console.error('Error saving injury history:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleTrainingSubmit = async () => {
    setSaving(true)
    try {
      // Save training data to user metadata
      await supabase.auth.updateUser({
        data: {
          training_history: trainingData
        }
      })
      setStep('psychological')
    } catch (error) {
      console.error('Error saving training history:', error)
    } finally {
      setSaving(false)
    }
  }

  const handlePsychologicalSubmit = async () => {
    setSaving(true)
    try {
      // Save psychological data to user metadata
      await supabase.auth.updateUser({
        data: {
          psychological_profile: psychologicalData
        }
      })
      setStep('goal')
    } catch (error) {
      console.error('Error saving psychological profile:', error)
    } finally {
      setSaving(false)
    }
  }

  const skipSection = async (section: keyof SkippedSections, nextStep: OnboardingStep) => {
    setSkippedSections(prev => ({ ...prev, [section]: true }))
    setStep(nextStep)
  }

  const updateRegionInjury = (region: BodyRegion, updates: Partial<RegionInjury>) => {
    setRegionInjuries(prev => ({
      ...prev,
      [region]: { ...prev[region], ...updates }
    }))
  }

  const toggleChronicCondition = (condition: string) => {
    setChronicConditions(prev => 
      prev.includes(condition) 
        ? prev.filter(c => c !== condition)
        : [...prev, condition]
    )
  }

  const handleGoalSubmit = async () => {
    setSaving(true)
    try {
      if (selectedGoalType) {
        const targetDate = goalTargetDate || getDefaultDate()
        const goalInfo = GOAL_TYPES[selectedGoalType]
        const goal = createGoal(selectedGoalType, goalInfo.label, targetDate)
        saveGoal(goal)
        setActiveGoal(goal.id)
      }
      await completeOnboarding()
    } catch (error) {
      console.error('Error saving goal:', error)
    } finally {
      setSaving(false)
    }
  }

  const completeOnboarding = async () => {
    // Determine which sections are incomplete (skipped)
    const pendingSections = Object.entries(skippedSections)
      .filter(([_, skipped]) => skipped)
      .map(([section]) => section)
    
    await supabase.auth.updateUser({
      data: {
        onboarding_completed: true,
        onboarding_pending_sections: pendingSections.length > 0 ? pendingSections : null,
      }
    })
    setStep('complete')
    // Short delay to show completion message
    setTimeout(() => {
      navigate('/')
    }, 2000)
  }

  const skipGoal = async () => {
    await completeOnboarding()
  }

  const getDefaultDate = () => {
    const date = new Date()
    date.setMonth(date.getMonth() + 3)
    return date.toISOString().split('T')[0]
  }

  const popularGoalTypes: GoalType[] = ['outdoor_season', 'competition', 'grade_breakthrough', 'send_project', 'general_fitness']

  const roleOptions = [
    {
      id: 'athlete' as UserRole,
      title: 'Athlete',
      icon: '🧗',
      description: 'Track your climbing sessions, get AI recommendations, and improve your performance.',
      features: ['Log sessions & climbs', 'AI-powered insights', 'Track progress over time'],
    },
    {
      id: 'coach' as UserRole,
      title: 'Coach',
      icon: '📋',
      description: 'Manage your team, monitor athlete progress, and provide data-driven coaching.',
      features: ['Team dashboard', 'Monitor athletes', 'Performance analytics'],
    },
  ]

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0f0d] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-fuchsia-500 border-t-transparent animate-spin" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-[#0a0f0d] text-white flex items-center justify-center overflow-hidden px-4 py-10">
      {/* Animated gradient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/60 via-[#0a0f0d] to-violet-950/50" />
        <div className="absolute top-0 right-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-cyan-600/30 to-emerald-700/20 blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-fuchsia-500/25 to-violet-500/15 blur-[100px] animate-pulse [animation-delay:1s]" />
      </div>

      {/* Progress indicator */}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center gap-2">
          {['welcome', 'role', 'profile', 'injury', 'training', 'psychological', 'goal'].map((s, i) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-all ${
                ['welcome', 'role', 'profile', 'injury', 'training', 'psychological', 'goal'].indexOf(step) >= i
                  ? 'bg-cyan-400 w-5'
                  : 'bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 w-full max-w-4xl">
        {/* Welcome Step */}
        {step === 'welcome' && (
          <div className="text-center animate-fade-in-up">
            <div className="mb-8">
              <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-cyan-500 to-fuchsia-500 flex items-center justify-center text-5xl mb-6">
                🧗
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Welcome to{' '}
                <span className="bg-gradient-to-r from-cyan-400 via-emerald-400 to-fuchsia-400 bg-clip-text text-transparent">
                  ClimbIQ
                </span>
              </h1>
              <p className="text-lg text-slate-300 max-w-xl mx-auto">
                {user?.user_metadata?.full_name || user?.email?.split('@')[0]}, let's get you set up! 
                This will only take a minute.
              </p>
            </div>

            <div className="space-y-4 max-w-md mx-auto mb-8">
              {[
                { icon: '📊', text: 'Track your climbing sessions' },
                { icon: '🧠', text: 'Get AI-powered recommendations' },
                { icon: '📈', text: 'Visualize your progress' },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-slate-300">{item.text}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep('role')}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-600 via-emerald-600 to-fuchsia-600 text-white font-semibold text-lg shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] transition-all"
            >
              Let's Get Started →
            </button>
          </div>
        )}

        {/* Role Selection Step */}
        {step === 'role' && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-10">
              <h1 className="text-3xl md:text-4xl font-bold mb-4">
                How will you use ClimbIQ?
              </h1>
              <p className="text-lg text-slate-300">
                Choose your role to personalize your experience.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {roleOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleRoleSelect(option.id)}
                  className="group relative text-left p-6 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center text-3xl">
                      {option.icon}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{option.title}</h2>
                      <p className="text-sm text-slate-400">I am a {option.id}</p>
                    </div>
                  </div>

                  <p className="text-slate-300 mb-4 text-sm">{option.description}</p>

                  <ul className="space-y-2">
                    {option.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-slate-400">
                        <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Profile Step */}
        {step === 'profile' && (
          <div className="max-w-md mx-auto animate-fade-in-up">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 border border-white/10 flex items-center justify-center text-3xl mb-4">
                {role === 'coach' ? '📋' : '🧗'}
              </div>
              <h1 className="text-3xl font-bold mb-2">
                {role === 'coach' ? 'Set up your coach profile' : 'Set up your profile'}
              </h1>
              <p className="text-slate-400">
                Tell us a bit about yourself.
              </p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Your name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
                  placeholder="Enter your name"
                />
              </div>

              <button
                onClick={handleProfileSubmit}
                disabled={!fullName.trim() || saving}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-600 via-emerald-600 to-fuchsia-600 text-white font-semibold shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 disabled:opacity-50 transition-all"
              >
                {saving ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {/* Injury History Step (Athletes only) */}
        {step === 'injury' && (
          <div className="animate-fade-in-up max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-amber-500/20 to-red-500/20 border border-white/10 flex items-center justify-center text-3xl mb-4">
                🩹
              </div>
              <h1 className="text-3xl font-bold mb-2">
                Injury History & Status
              </h1>
              <p className="text-slate-400 max-w-xl mx-auto">
                Previous injury is a significant risk factor for reinjury. This helps us provide safe recommendations.
              </p>
            </div>

            <div className="space-y-8">
              {/* Current Injury Status */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span>🔍</span> Current Injury/Niggle Status
                </h2>
                <p className="text-sm text-slate-400 mb-4">For each body region, select your current status:</p>
                
                <div className="space-y-4">
                  {BODY_REGIONS.map((region) => (
                    <div key={region} className="p-4 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium capitalize">{region}</span>
                        <div className="flex gap-2">
                          {(['none', 'niggle', 'injury', 'recovering'] as InjuryStatus[]).map((status) => (
                            <button
                              key={status}
                              onClick={() => updateRegionInjury(region, { status })}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                regionInjuries[region].status === status
                                  ? status === 'none' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : status === 'niggle' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : status === 'injury' ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                              }`}
                            >
                              {status === 'none' ? 'None' : status.charAt(0).toUpperCase() + status.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Show details if not "none" */}
                      {regionInjuries[region].status !== 'none' && (
                        <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-white/10 animate-fade-in-up">
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">Severity (1-10)</label>
                            <input
                              type="number"
                              min="1"
                              max="10"
                              value={regionInjuries[region].severity || ''}
                              onChange={(e) => updateRegionInjury(region, { severity: parseInt(e.target.value) || undefined })}
                              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                              placeholder="1-10"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">Side</label>
                            <select
                              value={regionInjuries[region].affectedSide || ''}
                              onChange={(e) => updateRegionInjury(region, { affectedSide: e.target.value as 'left' | 'right' | 'both' })}
                              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                            >
                              <option value="">Select</option>
                              <option value="left">Left</option>
                              <option value="right">Right</option>
                              <option value="both">Both</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">Duration</label>
                            <input
                              type="text"
                              value={regionInjuries[region].duration || ''}
                              onChange={(e) => updateRegionInjury(region, { duration: e.target.value })}
                              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                              placeholder="e.g., 2 weeks"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Chronic Conditions */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span>🔄</span> Chronic Conditions
                </h2>
                <p className="text-sm text-slate-400 mb-4">Select any chronic conditions you experience:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Finger joint capsulitis',
                    'Chronic tendonitis',
                    'Nerve compression issues',
                    'Recurring skin issues (splits/flappers)',
                    'None'
                  ].map((condition) => (
                    <button
                      key={condition}
                      onClick={() => toggleChronicCondition(condition)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        chronicConditions.includes(condition)
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {condition}
                    </button>
                  ))}
                </div>
              </div>

              {/* Surgery History */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span>🏥</span> Surgery History
                </h2>
                <textarea
                  value={surgeryHistory}
                  onChange={(e) => setSurgeryHistory(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  placeholder="List any climbing-related surgeries (e.g., 'Pulley repair, 2021')..."
                  rows={2}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setStep('profile')}
                className="py-4 px-5 rounded-xl border border-white/10 text-slate-400 font-medium hover:bg-white/5 transition-all"
              >
                ← Back
              </button>
              <button
                onClick={() => skipSection('injury', 'training')}
                className="py-4 px-5 rounded-xl border border-amber-500/30 text-amber-400 font-medium hover:bg-amber-500/10 transition-all"
              >
                Skip for Now
              </button>
              <button
                onClick={handleInjurySubmit}
                disabled={saving}
                className="flex-1 py-4 rounded-xl bg-gradient-to-r from-cyan-600 via-emerald-600 to-fuchsia-600 text-white font-semibold shadow-lg shadow-cyan-500/25 disabled:opacity-50 transition-all"
              >
                {saving ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {/* Training History Step (Athletes only) */}
        {step === 'training' && (
          <div className="animate-fade-in-up max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center text-3xl mb-4">
                📊
              </div>
              <h1 className="text-3xl font-bold mb-2">
                Training History & Context
              </h1>
              <p className="text-slate-400 max-w-xl mx-auto">
                This helps us understand your experience level and provide tailored recommendations.
              </p>
            </div>

            <div className="space-y-8">
              {/* Climbing Experience */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span>🧗</span> Climbing Experience
                </h2>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm text-slate-300 block mb-2">Total years climbing</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={trainingData.totalYearsClimbing || ''}
                      onChange={(e) => setTrainingData(prev => ({ ...prev, totalYearsClimbing: parseFloat(e.target.value) || 0 }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                      placeholder="e.g., 3"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-300 block mb-2">Years climbing consistently (2+ sessions/week)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={trainingData.yearsClimbingConsistently || ''}
                      onChange={(e) => setTrainingData(prev => ({ ...prev, yearsClimbingConsistently: parseFloat(e.target.value) || 0 }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                      placeholder="e.g., 2"
                    />
                  </div>
                </div>
              </div>

              {/* Highest Grades */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span>🏆</span> Highest Grades Achieved
                </h2>
                
                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <label className="text-sm text-slate-300 block mb-2">Boulder Redpoint</label>
                    <select
                      value={trainingData.highestBoulderRedpoint}
                      onChange={(e) => setTrainingData(prev => ({ ...prev, highestBoulderRedpoint: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                    >
                      <option value="">Select grade</option>
                      {['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12', 'V13+'].map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-300 block mb-2">Sport Redpoint</label>
                    <select
                      value={trainingData.highestSportRedpoint}
                      onChange={(e) => setTrainingData(prev => ({ ...prev, highestSportRedpoint: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                    >
                      <option value="">Select grade</option>
                      {['5.6', '5.7', '5.8', '5.9', '5.10a', '5.10b', '5.10c', '5.10d', '5.11a', '5.11b', '5.11c', '5.11d', '5.12a', '5.12b', '5.12c', '5.12d', '5.13a', '5.13b', '5.13c', '5.13d', '5.14a+'].map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-300 block mb-2">Onsight Grade</label>
                    <select
                      value={trainingData.highestOnsight}
                      onChange={(e) => setTrainingData(prev => ({ ...prev, highestOnsight: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                    >
                      <option value="">Select grade</option>
                      {['5.6', '5.7', '5.8', '5.9', '5.10a', '5.10b', '5.10c', '5.10d', '5.11a', '5.11b', '5.11c', '5.11d', '5.12a', '5.12b', '5.12c', '5.12d', '5.13a+'].map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Current Working Grades */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span>📈</span> Current Working Grades
                </h2>
                <p className="text-sm text-slate-400 mb-4">What grades constitute a "session day" for you?</p>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm text-slate-300 block mb-2">Boulder Working Grade</label>
                    <select
                      value={trainingData.currentBoulderGrade}
                      onChange={(e) => setTrainingData(prev => ({ ...prev, currentBoulderGrade: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                    >
                      <option value="">Select grade</option>
                      {['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10+'].map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-300 block mb-2">Sport Working Grade</label>
                    <select
                      value={trainingData.currentSportGrade}
                      onChange={(e) => setTrainingData(prev => ({ ...prev, currentSportGrade: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                    >
                      <option value="">Select grade</option>
                      {['5.6', '5.7', '5.8', '5.9', '5.10a', '5.10b', '5.10c', '5.10d', '5.11a', '5.11b', '5.11c', '5.11d', '5.12a', '5.12b', '5.12c', '5.12d', '5.13a+'].map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Current Training Volume */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span>📅</span> Current Training Volume
                </h2>
                
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="text-sm text-slate-300 block mb-2">Climbing sessions per week</label>
                    <input
                      type="number"
                      min="0"
                      max="14"
                      value={trainingData.sessionsPerWeek}
                      onChange={(e) => setTrainingData(prev => ({ ...prev, sessionsPerWeek: parseInt(e.target.value) || 0 }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-300 block mb-2">Hours per session</label>
                    <input
                      type="number"
                      min="0"
                      max="8"
                      step="0.5"
                      value={trainingData.hoursPerSession}
                      onChange={(e) => setTrainingData(prev => ({ ...prev, hoursPerSession: parseFloat(e.target.value) || 0 }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                    />
                  </div>
                </div>
                
                <div className="mb-6">
                  <label className="text-sm text-slate-300 block mb-2">Non-climbing training sessions per week (hangboard, S&C, etc.)</label>
                  <input
                    type="number"
                    min="0"
                    max="14"
                    value={trainingData.trainingSessionsPerWeek}
                    onChange={(e) => setTrainingData(prev => ({ ...prev, trainingSessionsPerWeek: parseInt(e.target.value) || 0 }))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                  />
                </div>

                <div>
                  <label className="text-sm text-slate-300 block mb-2">Indoor / Outdoor split</label>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-400">🏢 Indoor</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={trainingData.indoorOutdoorSplit}
                      onChange={(e) => setTrainingData(prev => ({ ...prev, indoorOutdoorSplit: parseInt(e.target.value) }))}
                      className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                    <span className="text-sm text-slate-400">🏔️ Outdoor</span>
                  </div>
                  <p className="text-xs text-slate-500 text-center mt-2">
                    {trainingData.indoorOutdoorSplit}% Indoor / {100 - trainingData.indoorOutdoorSplit}% Outdoor
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setStep('injury')}
                className="py-4 px-5 rounded-xl border border-white/10 text-slate-400 font-medium hover:bg-white/5 transition-all"
              >
                ← Back
              </button>
              <button
                onClick={() => skipSection('training', 'psychological')}
                className="py-4 px-5 rounded-xl border border-amber-500/30 text-amber-400 font-medium hover:bg-amber-500/10 transition-all"
              >
                Skip for Now
              </button>
              <button
                onClick={handleTrainingSubmit}
                disabled={saving}
                className="flex-1 py-4 rounded-xl bg-gradient-to-r from-cyan-600 via-emerald-600 to-fuchsia-600 text-white font-semibold shadow-lg shadow-cyan-500/25 disabled:opacity-50 transition-all"
              >
                {saving ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {/* Psychological Assessment Step (Athletes only) */}
        {step === 'psychological' && (
          <div className="animate-fade-in-up max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-white/10 flex items-center justify-center text-3xl mb-4">
                🧠
              </div>
              <h1 className="text-3xl font-bold mb-2">
                Psychological Assessment
              </h1>
              <p className="text-slate-400 max-w-xl mx-auto">
                Research shows psychological factors significantly impact climbing performance. This helps us personalize your training.
              </p>
            </div>

            <div className="space-y-8">
              {/* Fear of Falling Scale */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span>😰</span> Fear of Falling Scale
                </h2>
                <p className="text-sm text-slate-400 mb-4">Rate your fear intensity in different contexts (1 = no fear, 10 = extreme fear)</p>
                
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <label className="text-slate-300">Lead climbing fear</label>
                      <span className="text-cyan-400 font-medium">{psychologicalData.leadClimbingFear}/10</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={psychologicalData.leadClimbingFear}
                      onChange={(e) => setPsychologicalData(prev => ({ ...prev, leadClimbingFear: parseInt(e.target.value) }))}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <label className="text-slate-300">Bouldering/highball fear</label>
                      <span className="text-cyan-400 font-medium">{psychologicalData.boulderingHighballFear}/10</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={psychologicalData.boulderingHighballFear}
                      onChange={(e) => setPsychologicalData(prev => ({ ...prev, boulderingHighballFear: parseInt(e.target.value) }))}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-300 block mb-2">Outdoor vs indoor difference</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'much_worse_outdoor', label: 'Much worse outdoors' },
                        { value: 'worse_outdoor', label: 'Worse outdoors' },
                        { value: 'same', label: 'Same' },
                        { value: 'better_outdoor', label: 'Better outdoors' },
                        { value: 'much_better_outdoor', label: 'Much better outdoors' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setPsychologicalData(prev => ({ ...prev, outdoorVsIndoorDifference: option.value as PsychologicalData['outdoorVsIndoorDifference'] }))}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            psychologicalData.outdoorVsIndoorDifference === option.value
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-slate-300 block mb-2">Fear trajectory</label>
                    <div className="flex gap-2">
                      {[
                        { value: 'improving', label: '📈 Improving', color: 'emerald' },
                        { value: 'stable', label: '➡️ Stable', color: 'cyan' },
                        { value: 'worsening', label: '📉 Worsening', color: 'red' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setPsychologicalData(prev => ({ ...prev, fearTrajectory: option.value as PsychologicalData['fearTrajectory'] }))}
                          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            psychologicalData.fearTrajectory === option.value
                              ? option.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : option.color === 'red' ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Anxiety Profile */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span>💭</span> Performance Anxiety Profile
                </h2>
                <p className="text-sm text-slate-400 mb-4">Based on competitive state anxiety research (1 = low, 10 = high)</p>
                
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <label className="text-slate-300">Cognitive anxiety (worry, negative thoughts)</label>
                      <span className="text-fuchsia-400 font-medium">{psychologicalData.cognitiveAnxiety}/10</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={psychologicalData.cognitiveAnxiety}
                      onChange={(e) => setPsychologicalData(prev => ({ ...prev, cognitiveAnxiety: parseInt(e.target.value) }))}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-fuchsia-500"
                    />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <label className="text-slate-300">Somatic anxiety (physical symptoms under pressure)</label>
                      <span className="text-fuchsia-400 font-medium">{psychologicalData.somaticAnxiety}/10</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={psychologicalData.somaticAnxiety}
                      onChange={(e) => setPsychologicalData(prev => ({ ...prev, somaticAnxiety: parseInt(e.target.value) }))}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-fuchsia-500"
                    />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <label className="text-slate-300">Self-confidence baseline</label>
                      <span className="text-emerald-400 font-medium">{psychologicalData.selfConfidenceBaseline}/10</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={psychologicalData.selfConfidenceBaseline}
                      onChange={(e) => setPsychologicalData(prev => ({ ...prev, selfConfidenceBaseline: parseInt(e.target.value) }))}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Risk Tolerance Profile */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span>⚡</span> Risk Tolerance Profile
                </h2>
                <p className="text-sm text-slate-400 mb-4">Your willingness to commit in ambiguous situations</p>
                
                <div className="space-y-5">
                  {[
                    { key: 'dynoCommitmentTolerance', label: 'Dynos and commitment moves' },
                    { key: 'runoutComfort', label: 'Runout climbing comfort' },
                    { key: 'tryingHardPublicly', label: 'Trying hard at limit (publicly)' },
                  ].map((item) => (
                    <div key={item.key}>
                      <label className="text-sm text-slate-300 block mb-2">{item.label}</label>
                      <div className="flex gap-2">
                        {(['low', 'medium', 'high'] as const).map((level) => (
                          <button
                            key={level}
                            onClick={() => setPsychologicalData(prev => ({ ...prev, [item.key]: level }))}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                              psychologicalData[item.key as keyof PsychologicalData] === level
                                ? level === 'low' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : level === 'high' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                            }`}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Flow State Tendency */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span>🌊</span> Flow State Tendency
                </h2>
                <p className="text-sm text-slate-400 mb-4">How often do you lose track of time while climbing?</p>
                
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'never', label: 'Never' },
                    { value: 'rarely', label: 'Rarely' },
                    { value: 'sometimes', label: 'Sometimes' },
                    { value: 'often', label: 'Often' },
                    { value: 'always', label: 'Always' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setPsychologicalData(prev => ({ ...prev, flowFrequency: option.value as PsychologicalData['flowFrequency'] }))}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        psychologicalData.flowFrequency === option.value
                          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                          : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setStep('training')}
                className="py-4 px-5 rounded-xl border border-white/10 text-slate-400 font-medium hover:bg-white/5 transition-all"
              >
                ← Back
              </button>
              <button
                onClick={() => skipSection('psychological', 'goal')}
                className="py-4 px-5 rounded-xl border border-amber-500/30 text-amber-400 font-medium hover:bg-amber-500/10 transition-all"
              >
                Skip for Now
              </button>
              <button
                onClick={handlePsychologicalSubmit}
                disabled={saving}
                className="flex-1 py-4 rounded-xl bg-gradient-to-r from-cyan-600 via-emerald-600 to-fuchsia-600 text-white font-semibold shadow-lg shadow-cyan-500/25 disabled:opacity-50 transition-all"
              >
                {saving ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {/* Goal Selection Step (Athletes only) */}
        {step === 'goal' && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold mb-4">
                What's your{' '}
                <span className="bg-gradient-to-r from-cyan-400 via-emerald-400 to-fuchsia-400 bg-clip-text text-transparent">
                  climbing goal
                </span>
                ?
              </h1>
              <p className="text-lg text-slate-300 max-w-xl mx-auto">
                Setting a goal helps us personalize your recommendations.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 max-w-4xl mx-auto">
              {popularGoalTypes.map((type) => {
                const goalInfo = GOAL_TYPES[type]
                return (
                  <button
                    key={type}
                    onClick={() => setSelectedGoalType(type)}
                    className={`p-5 rounded-2xl border text-left transition-all hover:scale-[1.02] ${
                      selectedGoalType === type
                        ? 'border-cyan-500/50 bg-cyan-500/10'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center text-xl">
                        {goalInfo.icon}
                      </div>
                      {selectedGoalType === type && (
                        <span className="ml-auto w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center text-xs">✓</span>
                      )}
                    </div>
                    <h3 className="font-semibold mb-1 text-sm">{goalInfo.label}</h3>
                    <p className="text-xs text-slate-400">{goalInfo.description}</p>
                  </button>
                )
              })}
            </div>

            {selectedGoalType && (
              <div className="mb-8 p-4 rounded-2xl border border-white/10 bg-white/5 max-w-md mx-auto animate-fade-in-up">
                <label className="text-sm font-medium text-slate-300 block mb-2">
                  Target date (optional)
                </label>
                <input
                  type="date"
                  value={goalTargetDate || getDefaultDate()}
                  onChange={(e) => setGoalTargetDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>
            )}

            <div className="flex gap-4 max-w-md mx-auto">
              <button
                onClick={() => setStep('training')}
                className="py-4 px-6 rounded-xl border border-white/10 text-slate-400 font-medium hover:bg-white/5 transition-all"
              >
                ← Back
              </button>
              <button
                onClick={skipGoal}
                disabled={saving}
                className="flex-1 py-4 rounded-xl border border-white/10 text-slate-400 font-medium hover:bg-white/5 transition-all"
              >
                Skip
              </button>
              <button
                onClick={handleGoalSubmit}
                disabled={!selectedGoalType || saving}
                className="flex-[2] py-4 rounded-xl bg-gradient-to-r from-cyan-600 via-emerald-600 to-fuchsia-600 text-white font-semibold shadow-lg shadow-cyan-500/25 disabled:opacity-50 transition-all"
              >
                {saving ? 'Saving...' : 'Set Goal'}
              </button>
            </div>
          </div>
        )}

        {/* Complete Step */}
        {step === 'complete' && (
          <div className="text-center animate-fade-in-up">
            <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-5xl mb-6">
              ✓
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              You're all set!
            </h1>
            <p className="text-lg text-slate-300 mb-8">
              Taking you to your dashboard...
            </p>
            <div className="w-8 h-8 mx-auto rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
          </div>
        )}
      </div>

      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.5s ease-out forwards; }
      `}</style>
    </div>
  )
}

