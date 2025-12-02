import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  getActiveGoal,
  getGoals,
  getGoalProgress,
  calculateDaysRemaining,
  calculateDaysElapsed,
  calculateProgress,
  GOAL_TYPES,
  setActiveGoal,
  deleteGoal,
  type ClimbingGoal,
  type GoalProgress as GoalProgressType,
} from '../lib/goalStorage'

export function Goals() {
  const navigate = useNavigate()
  const [activeGoal, setActiveGoalState] = useState<ClimbingGoal | null>(getActiveGoal())
  const [allGoals] = useState<ClimbingGoal[]>(getGoals())
  const [progress, setProgress] = useState<GoalProgressType | null>(
    activeGoal ? getGoalProgress(activeGoal.id) : null
  )
  const [showAllGoals, setShowAllGoals] = useState(false)

  if (!activeGoal) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="text-center py-16">
          <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center text-5xl mb-6">
            🎯
          </div>
          <h1 className="text-3xl font-bold mb-3">Set Your Climbing Goal</h1>
          <p className="text-slate-400 mb-8 max-w-md mx-auto">
            Define what you're working toward to get personalized recommendations and track your progress.
          </p>
          <Link
            to="/goals/new"
            className="inline-flex px-8 py-4 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white font-semibold text-lg shadow-lg shadow-fuchsia-500/25 hover:shadow-fuchsia-500/40 hover:scale-[1.02] transition-all"
          >
            Create Your First Goal
          </Link>
        </div>
      </div>
    )
  }

  const daysRemaining = calculateDaysRemaining(activeGoal.targetDate)
  const daysElapsed = calculateDaysElapsed(activeGoal.startDate)
  const progressPercent = calculateProgress(activeGoal.startDate, activeGoal.targetDate)
  const goalInfo = GOAL_TYPES[activeGoal.type]
  const targetDate = new Date(activeGoal.targetDate)

  // Calculate weekly average
  const weeksElapsed = Math.max(1, Math.ceil(daysElapsed / 7))
  const sessionsPerWeek = progress ? (progress.sessionsCompleted / weeksElapsed).toFixed(1) : '0'

  const handleSwitchGoal = (goalId: string) => {
    setActiveGoal(goalId)
    const newActive = allGoals.find(g => g.id === goalId)
    if (newActive) {
      setActiveGoalState(newActive)
      setProgress(getGoalProgress(goalId))
    }
    setShowAllGoals(false)
  }

  const handleDeleteGoal = (goalId: string) => {
    if (window.confirm('Are you sure you want to delete this goal? This cannot be undone.')) {
      deleteGoal(goalId)
      if (activeGoal.id === goalId) {
        navigate('/goals/new')
      }
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <Link to="/" className="text-sm text-slate-400 hover:text-white mb-4 inline-flex items-center gap-1">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold mt-4">Goal Progress</h1>
          <p className="text-slate-400">Track your journey toward {activeGoal.title}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAllGoals(!showAllGoals)}
            className="px-4 py-2 rounded-xl border border-white/10 text-sm hover:bg-white/5 transition-colors"
          >
            {showAllGoals ? 'Hide Goals' : 'Switch Goal'}
          </button>
          <Link
            to="/goals/new"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white text-sm font-medium hover:from-fuchsia-500 hover:to-cyan-500 transition-all"
          >
            + New Goal
          </Link>
        </div>
      </div>

      {/* Goal Switcher */}
      {showAllGoals && allGoals.length > 1 && (
        <div className="mb-6 p-4 rounded-2xl border border-white/10 bg-white/5 animate-in fade-in slide-in-from-top-2">
          <p className="text-sm text-slate-400 mb-3">Your Goals</p>
          <div className="space-y-2">
            {allGoals.map((goal) => (
              <div
                key={goal.id}
                className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                  goal.id === activeGoal.id
                    ? 'bg-fuchsia-500/10 border border-fuchsia-500/30'
                    : 'bg-white/5 border border-white/5 hover:bg-white/10 cursor-pointer'
                }`}
                onClick={() => goal.id !== activeGoal.id && handleSwitchGoal(goal.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{GOAL_TYPES[goal.type].icon}</span>
                  <div>
                    <p className="font-medium">{goal.title}</p>
                    <p className="text-xs text-slate-400">{GOAL_TYPES[goal.type].label}</p>
                  </div>
                </div>
                {goal.id === activeGoal.id ? (
                  <span className="px-2 py-1 rounded-full bg-fuchsia-500/20 text-fuchsia-300 text-xs">Active</span>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteGoal(goal.id)
                    }}
                    className="text-slate-400 hover:text-red-400 text-xs"
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Goal Card */}
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-fuchsia-500/10 via-transparent to-cyan-500/10 p-8 mb-6">
        <div className="flex items-start gap-6 mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-fuchsia-500/30 to-cyan-500/30 border border-white/10 flex items-center justify-center text-4xl">
            {goalInfo.icon}
          </div>
          <div className="flex-1">
            <p className="text-sm text-fuchsia-400 mb-1">{goalInfo.label}</p>
            <h2 className="text-2xl font-bold mb-2">{activeGoal.title}</h2>
            <p className="text-slate-400">{activeGoal.description}</p>
          </div>
        </div>

        {/* Progress Circle and Stats */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Progress Circle */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-48 h-48">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="url(#goalGradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${progressPercent * 2.83} 283`}
                  className="transition-all duration-1000"
                />
                <defs>
                  <linearGradient id="goalGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#d946ef" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold">{progressPercent}%</span>
                <span className="text-sm text-slate-400">Complete</span>
              </div>
            </div>
            <p className="text-center text-sm text-slate-400 mt-4">
              Target: {targetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-white/5 border border-white/5">
              <p className="text-3xl font-bold mb-1">{daysRemaining}</p>
              <p className="text-sm text-slate-400">Days Remaining</p>
            </div>
            <div className="p-5 rounded-2xl bg-white/5 border border-white/5">
              <p className="text-3xl font-bold mb-1">{daysElapsed}</p>
              <p className="text-sm text-slate-400">Days Training</p>
            </div>
            <div className="p-5 rounded-2xl bg-white/5 border border-white/5">
              <p className="text-3xl font-bold mb-1">{progress?.sessionsCompleted || 0}</p>
              <p className="text-sm text-slate-400">Sessions Logged</p>
            </div>
            <div className="p-5 rounded-2xl bg-white/5 border border-white/5">
              <p className="text-3xl font-bold mb-1">{sessionsPerWeek}</p>
              <p className="text-sm text-slate-400">Sessions/Week</p>
            </div>
          </div>
        </div>

        {/* Target Details */}
        {(activeGoal.targetGrade || activeGoal.projectName || activeGoal.competitionName) && (
          <div className="mt-8 pt-6 border-t border-white/10">
            <div className="flex items-center gap-4 flex-wrap">
              {activeGoal.targetGrade && (
                <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-emerald-400 text-sm">🎯 Target Grade: </span>
                  <span className="font-semibold">{activeGoal.targetGrade}</span>
                </div>
              )}
              {activeGoal.projectName && (
                <div className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-amber-400 text-sm">🧗 Project: </span>
                  <span className="font-semibold">{activeGoal.projectName}</span>
                </div>
              )}
              {activeGoal.competitionName && (
                <div className="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <span className="text-rose-400 text-sm">🏆 Event: </span>
                  <span className="font-semibold">{activeGoal.competitionName}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Timeline / Milestones */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <span>📅</span> Timeline
        </h3>
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-fuchsia-500 via-cyan-500 to-white/10" />
          <div className="space-y-4 pl-10">
            <div className="relative">
              <div className="absolute -left-[26px] w-3 h-3 rounded-full bg-fuchsia-500 border-2 border-[#0a0f0d]" />
              <div className="p-3 rounded-xl bg-white/5">
                <p className="text-xs text-slate-500">
                  {new Date(activeGoal.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
                <p className="font-medium">Goal Started</p>
              </div>
            </div>
            
            {progress?.lastSessionDate && (
              <div className="relative">
                <div className="absolute -left-[26px] w-3 h-3 rounded-full bg-cyan-500 border-2 border-[#0a0f0d]" />
                <div className="p-3 rounded-xl bg-white/5">
                  <p className="text-xs text-slate-500">
                    {new Date(progress.lastSessionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                  <p className="font-medium">Last Session</p>
                  <p className="text-sm text-slate-400">{progress.sessionsCompleted} sessions completed</p>
                </div>
              </div>
            )}

            <div className="relative">
              <div className={`absolute -left-[26px] w-3 h-3 rounded-full border-2 border-[#0a0f0d] ${
                daysRemaining === 0 ? 'bg-emerald-500' : 'bg-white/20'
              }`} />
              <div className={`p-3 rounded-xl ${daysRemaining === 0 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/5'}`}>
                <p className="text-xs text-slate-500">
                  {targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
                <p className="font-medium">Target Date</p>
                <p className="text-sm text-slate-400">{daysRemaining} days remaining</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-4">
        <Link
          to="/session/new"
          className="p-5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/[0.07] transition-all flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 flex items-center justify-center text-2xl">
            🧗
          </div>
          <div>
            <p className="font-semibold">Log a Session</p>
            <p className="text-sm text-slate-400">Add to your goal progress</p>
          </div>
        </Link>
        <Link
          to="/goals/edit"
          className="p-5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/[0.07] transition-all flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center text-2xl">
            ✏️
          </div>
          <div>
            <p className="font-semibold">Edit Goal</p>
            <p className="text-sm text-slate-400">Update target or details</p>
          </div>
        </Link>
      </div>
    </div>
  )
}

