import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, type UserRole } from '../hooks/useAuth'
import { GOAL_TYPES, createGoal, saveGoal, setActiveGoal, type GoalType } from '../lib/goalStorage'

export function SignUp() {
  const { signUp, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<'role' | 'details' | 'goal'>('role')
  const [role, setRole] = useState<UserRole>('athlete')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  
  // Goal selection state
  const [selectedGoalType, setSelectedGoalType] = useState<GoalType | null>(null)
  const [goalTargetDate, setGoalTargetDate] = useState('')

  const handleRoleSelect = (selectedRole: UserRole) => {
    setRole(selectedRole)
    setStep('details')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      await signUp(email, password, fullName, role)
      // For athletes, show goal selection; for coaches, go to login
      if (role === 'athlete') {
        setStep('goal')
        setInfo('Account created! Set your first goal to get personalized recommendations.')
      } else {
        setInfo('Check your email to confirm your account, then sign in.')
        navigate('/login')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to sign up')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    setError(null)
    setInfo(null)
    setGoogleLoading(true)
    try {
      await signInWithGoogle(role)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to continue with Google')
      setGoogleLoading(false)
    }
  }

  const handleGoalSubmit = () => {
    if (selectedGoalType) {
      const targetDate = goalTargetDate || getDefaultDate()
      const goalInfo = GOAL_TYPES[selectedGoalType]
      const goal = createGoal(selectedGoalType, goalInfo.label, targetDate)
      saveGoal(goal)
      setActiveGoal(goal.id)
    }
    navigate('/login')
  }

  const handleSkipGoal = () => {
    navigate('/login')
  }

  const getDefaultDate = () => {
    const date = new Date()
    date.setMonth(date.getMonth() + 3)
    return date.toISOString().split('T')[0]
  }

  // Popular goal types for quick selection
  const popularGoalTypes: GoalType[] = ['outdoor_season', 'competition', 'grade_breakthrough', 'send_project', 'general_fitness']

  const roleOptions = [
    {
      id: 'athlete' as UserRole,
      title: 'Athlete',
      icon: '🧗',
      description: 'Track your climbing sessions, get AI recommendations, and improve your performance.',
      features: ['Log sessions & climbs', 'AI-powered insights', 'Track progress over time', 'Connect with coaches'],
    },
    {
      id: 'coach' as UserRole,
      title: 'Coach',
      icon: '📋',
      description: 'Manage your team, monitor athlete progress, and provide data-driven coaching.',
      features: ['Team dashboard', 'Monitor all athletes', 'Performance analytics', 'Training recommendations'],
    },
  ]

  return (
    <div className="relative min-h-screen bg-[#0a0f0d] text-white flex items-center justify-center overflow-hidden px-4 py-10">
      {/* Animated gradient mesh */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/60 via-[#0a0f0d] to-violet-950/50" />
        <div className="absolute top-0 right-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-cyan-600/30 to-emerald-700/20 blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-fuchsia-500/25 to-violet-500/15 blur-[100px] animate-pulse [animation-delay:1s]" />
        <div className="absolute top-1/2 left-10 w-72 h-72 rounded-full bg-emerald-500/20 blur-[80px] animate-pulse [animation-delay:2s]" />
      </div>

      {/* Subtle grid overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] bg-[size:60px_60px]" />

      {/* Floating particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white/40 rounded-full animate-float"
            style={{
              left: `${10 + i * 15}%`,
              top: `${25 + (i % 3) * 20}%`,
              animationDelay: `${i * 0.4}s`,
              animationDuration: `${5 + i}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-6xl">
        {/* Role Selection Step */}
        {step === 'role' && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Join{' '}
                <span className="bg-gradient-to-r from-cyan-400 via-emerald-400 to-fuchsia-400 bg-clip-text text-transparent">
                  ClimbIQ
                </span>
              </h1>
              <p className="text-lg text-slate-300 max-w-xl mx-auto">
                How will you be using ClimbIQ? Choose your role to get started.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {roleOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleRoleSelect(option.id)}
                  className="group relative text-left p-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                >
                  {/* Glow on hover */}
                  <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-cyan-500/0 via-emerald-500/0 to-fuchsia-500/0 group-hover:from-cyan-500/20 group-hover:via-emerald-500/20 group-hover:to-fuchsia-500/20 blur-xl transition-all duration-300" />
                  
                  <div className="relative">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center text-4xl">
                        {option.icon}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">{option.title}</h2>
                        <p className="text-sm text-slate-400">I am a {option.id}</p>
                      </div>
                    </div>

                    <p className="text-slate-300 mb-6">{option.description}</p>

                    <ul className="space-y-2">
                      {option.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-sm text-slate-400">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">✓</span>
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-6 flex items-center justify-between">
                      <span className="text-sm text-slate-500">Click to continue</span>
                      <span className="text-cyan-400 group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <p className="text-center text-sm text-slate-400 mt-8">
              Already have an account?{' '}
              <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        )}

        {/* Details Step */}
        {step === 'details' && (
          <div className="grid lg:grid-cols-2 gap-12 items-center animate-fade-in-up">
            {/* Hero section */}
            <div className="space-y-8 order-2 lg:order-1">
              <button
                onClick={() => setStep('role')}
                className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                ← Back to role selection
              </button>

              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-medium text-cyan-200 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-300" />
                </span>
                Creating {role === 'coach' ? 'Coach' : 'Athlete'} account
              </div>

              <div className="space-y-4">
                <h1 className="text-5xl md:text-6xl font-bold leading-[1.1] tracking-tight">
                  {role === 'coach' ? (
                    <>
                      Build your{' '}
                      <span className="bg-gradient-to-r from-cyan-400 via-emerald-400 to-fuchsia-400 bg-clip-text text-transparent">
                        team
                      </span>
                    </>
                  ) : (
                    <>
                      Start{' '}
                      <span className="bg-gradient-to-r from-cyan-400 via-emerald-400 to-fuchsia-400 bg-clip-text text-transparent">
                        climbing
                      </span>
                    </>
                  )}
                </h1>
                <p className="text-lg text-slate-300 max-w-lg leading-relaxed">
                  {role === 'coach'
                    ? 'Create your coach account to start managing your team and tracking athlete performance.'
                    : 'Create your free account and unlock personalized training insights powered by machine learning.'}
                </p>
              </div>

              {/* Role-specific benefits */}
              <div className="space-y-4">
                {(role === 'coach'
                  ? [
                      { icon: '👥', title: 'Team Management', desc: 'Invite and manage your athletes' },
                      { icon: '📊', title: 'Performance Overview', desc: 'See team-wide analytics at a glance' },
                      { icon: '🎯', title: 'Individual Coaching', desc: 'Dive into each athlete\'s data' },
                    ]
                  : [
                      { icon: '📊', title: 'Track Everything', desc: 'Log sessions, grades, and energy levels' },
                      { icon: '🧠', title: 'AI Recommendations', desc: 'Get personalized training suggestions' },
                      { icon: '📈', title: 'See Progress', desc: 'Visualize your climbing journey over time' },
                    ]
                ).map((item) => (
                  <div key={item.title} className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <p className="font-semibold text-white">{item.title}</p>
                      <p className="text-sm text-slate-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Auth card */}
            <div className="relative order-1 lg:order-2">
              {/* Glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 via-emerald-500/20 to-fuchsia-500/20 rounded-3xl blur-xl" />
              
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl shadow-2xl">
                {/* Top accent line */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
                
                {/* Inner glow spots */}
                <div className="pointer-events-none absolute -top-20 -left-20 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl" />
                <div className="pointer-events-none absolute -bottom-20 -right-20 w-40 h-40 bg-fuchsia-500/20 rounded-full blur-3xl" />

                <div className="relative space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold">Create {role} account</h2>
                    <p className="text-sm text-slate-400 mt-1">
                      Free forever. No credit card required.
                    </p>
                  </div>

                  {error && (
                    <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 text-sm">
                      {error}
                    </div>
                  )}

                  {info && (
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-3 text-sm">
                      {info}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleGoogleSignUp}
                    disabled={googleLoading || loading}
                    className="w-full flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10 hover:border-white/20 disabled:opacity-50 transition-all duration-200"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    {googleLoading ? 'Connecting...' : 'Continue with Google'}
                  </button>

                  <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    <span className="text-xs text-slate-500 uppercase tracking-wider">or</span>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Full name</label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                        placeholder={role === 'coach' ? 'Coach Smith' : 'Alex Climber'}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                        placeholder="you@example.com"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Password</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                        placeholder="At least 6 characters"
                        required
                        minLength={6}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || googleLoading}
                      className="w-full rounded-xl bg-gradient-to-r from-cyan-600 via-emerald-600 to-fuchsia-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 transition-all duration-200"
                    >
                      {loading ? 'Creating account...' : `Create ${role} account`}
                    </button>
                  </form>

                  <p className="text-center text-sm text-slate-400">
                    Already have an account?{' '}
                    <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
                      Sign in
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Goal Selection Step (for athletes after signup) */}
        {step === 'goal' && (
          <div className="max-w-3xl mx-auto animate-fade-in-up">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-200 backdrop-blur-sm mb-6">
                <span className="text-lg">✓</span>
                Account created successfully!
              </div>
              <h1 className="text-4xl font-bold mb-4">
                What's your{' '}
                <span className="bg-gradient-to-r from-cyan-400 via-emerald-400 to-fuchsia-400 bg-clip-text text-transparent">
                  climbing goal
                </span>
                ?
              </h1>
              <p className="text-lg text-slate-300 max-w-xl mx-auto">
                Setting a goal helps us personalize your recommendations and track your progress.
              </p>
            </div>

            {info && (
              <div className="mb-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-3 text-sm text-center">
                {info}
              </div>
            )}

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
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
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center text-2xl">
                        {goalInfo.icon}
                      </div>
                      {selectedGoalType === type && (
                        <span className="ml-auto w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center text-xs">✓</span>
                      )}
                    </div>
                    <h3 className="font-semibold mb-1">{goalInfo.label}</h3>
                    <p className="text-sm text-slate-400">{goalInfo.description}</p>
                  </button>
                )
              })}
            </div>

            {selectedGoalType && (
              <div className="mb-8 p-4 rounded-2xl border border-white/10 bg-white/5 animate-fade-in-up">
                <label className="text-sm font-medium text-slate-300 block mb-2">
                  When do you want to achieve this goal?
                </label>
                <input
                  type="date"
                  value={goalTargetDate || getDefaultDate()}
                  onChange={(e) => setGoalTargetDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={handleSkipGoal}
                className="flex-1 py-4 rounded-xl border border-white/10 text-slate-400 font-medium hover:bg-white/5 transition-all"
              >
                Skip for now
              </button>
              <button
                onClick={handleGoalSubmit}
                disabled={!selectedGoalType}
                className="flex-[2] py-4 rounded-xl bg-gradient-to-r from-cyan-600 via-emerald-600 to-fuchsia-600 text-white font-semibold shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {selectedGoalType ? 'Set Goal & Continue' : 'Select a goal'}
              </button>
            </div>

            <p className="text-center text-sm text-slate-500 mt-6">
              You can always change or add more goals later in settings.
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.4; }
          50% { transform: translateY(-20px) rotate(180deg); opacity: 0.8; }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-fade-in-up { animation: fade-in-up 0.6s ease-out forwards; opacity: 0; }
      `}</style>
    </div>
  )
}
