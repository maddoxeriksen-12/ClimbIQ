import { Link } from 'react-router-dom'
import { 
  getActiveGoal, 
  getGoalProgress, 
  calculateDaysRemaining, 
  calculateDaysElapsed,
  calculateProgress,
  GOAL_TYPES 
} from '../lib/goalStorage'

export function GoalWidget() {
  const activeGoal = getActiveGoal()
  
  if (!activeGoal) {
    return (
      <Link
        to="/goals/new"
        className="block rounded-2xl border border-dashed border-white/20 bg-white/5 p-6 hover:border-fuchsia-500/50 hover:bg-white/[0.07] transition-all group"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
            🎯
          </div>
          <div>
            <h3 className="font-semibold mb-1">Set Your Climbing Goal</h3>
            <p className="text-sm text-slate-400">
              Define what you're working toward for personalized recommendations
            </p>
          </div>
          <span className="ml-auto text-slate-400 group-hover:text-fuchsia-400 transition-colors">
            →
          </span>
        </div>
      </Link>
    )
  }

  const progress = getGoalProgress(activeGoal.id)
  const daysRemaining = calculateDaysRemaining(activeGoal.targetDate)
  const daysElapsed = calculateDaysElapsed(activeGoal.startDate)
  const progressPercent = calculateProgress(activeGoal.startDate, activeGoal.targetDate)
  const goalInfo = GOAL_TYPES[activeGoal.type]

  // Determine status color
  let statusColor = 'from-fuchsia-500 to-cyan-500'
  let statusText = 'On Track'
  if (daysRemaining === 0) {
    statusColor = 'from-emerald-500 to-cyan-500'
    statusText = 'Goal Date!'
  } else if (daysRemaining < 7) {
    statusColor = 'from-amber-500 to-orange-500'
    statusText = 'Final Push'
  } else if (progressPercent > 75) {
    statusColor = 'from-emerald-500 to-teal-500'
    statusText = 'Almost There'
  }

  return (
    <Link
      to="/goals"
      className="block rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 hover:border-fuchsia-500/30 transition-all group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center text-2xl">
            {goalInfo.icon}
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Current Goal</p>
            <h3 className="font-semibold">{activeGoal.title}</h3>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${statusColor} bg-clip-text text-transparent border border-white/10`}>
          {statusText}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
          <span>Progress</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${statusColor} rounded-full transition-all duration-500`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-white/5 text-center">
          <p className="text-xl font-bold">{daysRemaining}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Days Left</p>
        </div>
        <div className="p-3 rounded-xl bg-white/5 text-center">
          <p className="text-xl font-bold">{daysElapsed}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Days In</p>
        </div>
        <div className="p-3 rounded-xl bg-white/5 text-center">
          <p className="text-xl font-bold">{progress.sessionsCompleted}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Sessions</p>
        </div>
      </div>

      {/* Target info */}
      {(activeGoal.targetGrade || activeGoal.projectName || activeGoal.competitionName) && (
        <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-sm text-slate-400">
          <span>🎯</span>
          <span>
            {activeGoal.targetGrade && `Target: ${activeGoal.targetGrade}`}
            {activeGoal.projectName && `Project: ${activeGoal.projectName}`}
            {activeGoal.competitionName && `Event: ${activeGoal.competitionName}`}
          </span>
        </div>
      )}

      {/* Hover indicator */}
      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500 group-hover:text-fuchsia-400 transition-colors">
        <span>View details</span>
        <span className="group-hover:translate-x-1 transition-transform">→</span>
      </div>
    </Link>
  )
}

// Compact version for sidebar or smaller spaces
export function GoalWidgetCompact() {
  const activeGoal = getActiveGoal()
  
  if (!activeGoal) {
    return (
      <Link
        to="/goals/new"
        className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-white/20 hover:border-fuchsia-500/50 transition-all"
      >
        <span className="text-xl">🎯</span>
        <span className="text-sm text-slate-400">Set a goal</span>
      </Link>
    )
  }

  const daysRemaining = calculateDaysRemaining(activeGoal.targetDate)
  const progressPercent = calculateProgress(activeGoal.startDate, activeGoal.targetDate)
  const goalInfo = GOAL_TYPES[activeGoal.type]

  return (
    <Link
      to="/goals"
      className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-fuchsia-500/30 transition-all"
    >
      <span className="text-xl">{goalInfo.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{activeGoal.title}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-500">{daysRemaining}d</span>
        </div>
      </div>
    </Link>
  )
}

