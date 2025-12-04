import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, type UserRole } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { GOAL_TYPES, createGoal, saveGoal, setActiveGoal, type GoalType } from '../lib/goalStorage'

type OnboardingStep = 'welcome' | 'role' | 'profile' | 'goal' | 'complete'

export function Onboarding() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<OnboardingStep>('welcome')
  const [role, setRole] = useState<UserRole>('athlete')
  const [fullName, setFullName] = useState('')
  const [selectedGoalType, setSelectedGoalType] = useState<GoalType | null>(null)
  const [goalTargetDate, setGoalTargetDate] = useState('')
  const [saving, setSaving] = useState(false)

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
        setStep('goal')
      } else {
        // Coaches skip goal, complete onboarding
        await completeOnboarding()
      }
    } catch (error) {
      console.error('Error updating profile:', error)
    } finally {
      setSaving(false)
    }
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
    await supabase.auth.updateUser({
      data: {
        onboarding_completed: true,
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
          {['welcome', 'role', 'profile', 'goal'].map((s, i) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-all ${
                ['welcome', 'role', 'profile', 'goal'].indexOf(step) >= i
                  ? 'bg-cyan-400 w-8'
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

