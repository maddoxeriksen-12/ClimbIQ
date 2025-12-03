import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  getActiveGoal as getActiveGoalFromDb,
  getAllGoals,
  getGoalProgress as getGoalProgressFromDb,
  setActiveGoal as setActiveGoalInDb,
  deleteGoal as deleteGoalFromDb,
  GOAL_TYPES,
  type ClimbingGoal,
  type GoalProgress as GoalProgressType,
} from '../lib/goalService'

// Helper functions for date calculations
function calculateDaysRemaining(targetDate: string): number {
  const target = new Date(targetDate)
  const now = new Date()
  const diffMs = target.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
}

function calculateDaysElapsed(startDate: string): number {
  const start = new Date(startDate)
  const now = new Date()
  const diffMs = now.getTime() - start.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

function calculateProgress(startDate: string, targetDate: string): number {
  const start = new Date(startDate).getTime()
  const target = new Date(targetDate).getTime()
  const now = new Date().getTime()
  
  if (now >= target) return 100
  if (now <= start) return 0
  
  const total = target - start
  const elapsed = now - start
  return Math.round((elapsed / total) * 100)
}

export function Goals() {
  const navigate = useNavigate()
  const [activeGoal, setActiveGoalState] = useState<ClimbingGoal | null>(null)
  const [allGoals, setAllGoals] = useState<ClimbingGoal[]>([])
  const [progress, setProgress] = useState<GoalProgressType | null>(null)
  const [showAllGoals, setShowAllGoals] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [goalToDelete, setGoalToDelete] = useState<ClimbingGoal | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch goals from database on mount
  useEffect(() => {
    async function fetchGoals() {
      setLoading(true)
      try {
        const [activeResult, allResult] = await Promise.all([
          getActiveGoalFromDb(),
          getAllGoals(),
        ])

        if (activeResult.data) {
          setActiveGoalState(activeResult.data)
          // Fetch progress for active goal
          const progressResult = await getGoalProgressFromDb(activeResult.data.id)
          if (progressResult.data) {
            setProgress(progressResult.data)
          }
        }

        if (allResult.data) {
          setAllGoals(allResult.data)
        }
      } catch (err) {
        console.error('Error fetching goals:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchGoals()
  }, [])

  // Show loading state
  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto rounded-full border-4 border-fuchsia-500/30 border-t-fuchsia-500 animate-spin mb-6" />
          <p className="text-slate-400">Loading your goals...</p>
        </div>
      </div>
    )
  }

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

  const daysRemaining = calculateDaysRemaining(activeGoal.target_date || '')
  const daysElapsed = calculateDaysElapsed(activeGoal.start_date)
  const progressPercent = calculateProgress(activeGoal.start_date, activeGoal.target_date || '')
  const goalInfo = GOAL_TYPES[activeGoal.type as keyof typeof GOAL_TYPES]
  const targetDate = new Date(activeGoal.target_date || '')

  // Calculate weekly average
  const weeksElapsed = Math.max(1, Math.ceil(daysElapsed / 7))
  const sessionsPerWeek = progress ? (progress.sessions_completed / weeksElapsed).toFixed(1) : '0'

  const handleSwitchGoal = async (goalId: string) => {
    try {
      await setActiveGoalInDb(goalId)
      const newActive = allGoals.find(g => g.id === goalId)
      if (newActive) {
        setActiveGoalState(newActive)
        const progressResult = await getGoalProgressFromDb(goalId)
        if (progressResult.data) {
          setProgress(progressResult.data)
        }
      }
      setShowAllGoals(false)
    } catch (err) {
      console.error('Error switching goal:', err)
    }
  }

  const openDeleteModal = (goal: ClimbingGoal) => {
    setGoalToDelete(goal)
    setShowDeleteModal(true)
  }

  const handleDeleteGoal = async () => {
    if (!goalToDelete) return
    
    setIsDeleting(true)
    try {
      const { success, error } = await deleteGoalFromDb(goalToDelete.id)
      
      if (error) {
        console.error('Error deleting goal:', error)
        alert('Failed to delete goal. Please try again.')
        return
      }

      if (success) {
        // Close modal
        setShowDeleteModal(false)
        setGoalToDelete(null)
        
        // If we deleted the active goal, navigate to create new goal
        if (activeGoal && goalToDelete.id === activeGoal.id) {
          // Check if there are other goals to switch to
          const remainingGoals = allGoals.filter(g => g.id !== goalToDelete.id)
          if (remainingGoals.length > 0) {
            // Switch to another goal
            await setActiveGoalInDb(remainingGoals[0].id)
            setActiveGoalState(remainingGoals[0])
            const progressResult = await getGoalProgressFromDb(remainingGoals[0].id)
            if (progressResult.data) {
              setProgress(progressResult.data)
            }
          } else {
            // No more goals, redirect to create new
            navigate('/goals/new')
            return
          }
        }
        
        // Refresh the goals list
        const allResult = await getAllGoals()
        if (allResult.data) {
          setAllGoals(allResult.data)
        }
      }
    } catch (err) {
      console.error('Error deleting goal:', err)
      alert('Failed to delete goal. Please try again.')
    } finally {
      setIsDeleting(false)
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
            onClick={() => openDeleteModal(activeGoal)}
            className="px-4 py-2 rounded-xl border border-red-500/30 text-red-400 text-sm hover:bg-red-500/10 transition-colors"
          >
            🗑️ Delete
          </button>
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
                  <span className="text-xl">{GOAL_TYPES[goal.type as keyof typeof GOAL_TYPES]?.icon || '🎯'}</span>
                  <div>
                    <p className="font-medium">{goal.title}</p>
                    <p className="text-xs text-slate-400">{GOAL_TYPES[goal.type as keyof typeof GOAL_TYPES]?.label || goal.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {goal.id === activeGoal.id && (
                    <span className="px-2 py-1 rounded-full bg-fuchsia-500/20 text-fuchsia-300 text-xs">Active</span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      openDeleteModal(goal)
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Delete goal"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
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
              <p className="text-3xl font-bold mb-1">{progress?.sessions_completed || 0}</p>
              <p className="text-sm text-slate-400">Sessions Logged</p>
            </div>
            <div className="p-5 rounded-2xl bg-white/5 border border-white/5">
              <p className="text-3xl font-bold mb-1">{sessionsPerWeek}</p>
              <p className="text-sm text-slate-400">Sessions/Week</p>
            </div>
          </div>
        </div>

        {/* Target Details */}
        {(activeGoal.target_grade || activeGoal.project_name || activeGoal.competition_name) && (
          <div className="mt-8 pt-6 border-t border-white/10">
            <div className="flex items-center gap-4 flex-wrap">
              {activeGoal.target_grade && (
                <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-emerald-400 text-sm">🎯 Target Grade: </span>
                  <span className="font-semibold">{activeGoal.target_grade}</span>
                </div>
              )}
              {activeGoal.project_name && (
                <div className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-amber-400 text-sm">🧗 Project: </span>
                  <span className="font-semibold">{activeGoal.project_name}</span>
                </div>
              )}
              {activeGoal.competition_name && (
                <div className="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <span className="text-rose-400 text-sm">🏆 Event: </span>
                  <span className="font-semibold">{activeGoal.competition_name}</span>
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
                  {new Date(activeGoal.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
                <p className="font-medium">Goal Started</p>
              </div>
            </div>
            
            {progress?.last_session_date && (
              <div className="relative">
                <div className="absolute -left-[26px] w-3 h-3 rounded-full bg-cyan-500 border-2 border-[#0a0f0d]" />
                <div className="p-3 rounded-xl bg-white/5">
                  <p className="text-xs text-slate-500">
                    {new Date(progress.last_session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                  <p className="font-medium">Last Session</p>
                  <p className="text-sm text-slate-400">{progress.sessions_completed} sessions completed</p>
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && goalToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !isDeleting && setShowDeleteModal(false)}
          />
          
          {/* Modal */}
          <div className="relative bg-[#0f1412] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Warning Icon */}
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            {/* Content */}
            <h3 className="text-xl font-bold text-center mb-2">Delete Goal?</h3>
            <p className="text-slate-400 text-center mb-2">
              Are you sure you want to delete <span className="text-white font-medium">"{goalToDelete.title}"</span>?
            </p>
            <p className="text-sm text-red-400/80 text-center mb-6">
              This action cannot be undone. All progress data for this goal will be permanently removed.
            </p>
            
            {/* Goal Preview */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-6">
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {GOAL_TYPES[goalToDelete.type as keyof typeof GOAL_TYPES]?.icon || '🎯'}
                </span>
                <div>
                  <p className="font-medium">{goalToDelete.title}</p>
                  <p className="text-xs text-slate-400">
                    {GOAL_TYPES[goalToDelete.type as keyof typeof GOAL_TYPES]?.label || goalToDelete.type}
                    {goalToDelete.target_date && ` • Target: ${new Date(goalToDelete.target_date).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-xl border border-white/10 text-white font-medium hover:bg-white/5 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteGoal}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Deleting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Goal
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

