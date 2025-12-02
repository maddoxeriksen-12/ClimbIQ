import { Link, useParams } from 'react-router-dom'

export function AthleteDetail() {
  const { athleteId } = useParams()

  // Mock data - replace with real data from your backend
  const athlete = {
    id: athleteId,
    name: 'Alex Johnson',
    email: 'alex@example.com',
    joinedDate: 'Oct 2024',
    climbingStyle: 'Bouldering',
    experience: 'Intermediate',
    homeGym: 'Movement RiNo',
  }

  const stats = [
    { label: 'Sessions This Week', value: '4', change: '+2', trend: 'up' },
    { label: 'Total Climbs', value: '127', change: '+12', trend: 'up' },
    { label: 'Avg Grade', value: 'V5', change: 'V4→V5', trend: 'up' },
    { label: 'Rest Days', value: '2', change: 'On track', trend: 'neutral' },
  ]

  const recentSessions = [
    { id: 1, date: 'Today', type: 'Bouldering', location: 'Movement RiNo', climbs: 18, hardest: 'V6', satisfaction: 8 },
    { id: 2, date: 'Yesterday', type: 'Sport', location: 'Earth Treks', climbs: 8, hardest: '5.11b', satisfaction: 7 },
    { id: 3, date: '3 days ago', type: 'Training', location: 'Home Wall', climbs: 0, hardest: '—', satisfaction: 6 },
    { id: 4, date: '5 days ago', type: 'Bouldering', location: 'Movement RiNo', climbs: 22, hardest: 'V6', satisfaction: 9 },
  ]

  const injuries = [
    { location: 'Fingers', severity: 3, description: 'Minor A2 pulley strain', date: '2 weeks ago', status: 'healing' },
  ]

  const aiInsights = [
    { icon: '💪', title: 'Strength improving', desc: 'Consistent finger strength gains over the past month.' },
    { icon: '⚠️', title: 'Watch recovery', desc: 'High volume last week - consider extra rest day.' },
    { icon: '🎯', title: 'Ready for V7', desc: 'Performance metrics suggest they could project V7 soon.' },
  ]

  return (
    <div className="p-8">
      {/* Back button and header */}
      <div className="mb-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-4"
        >
          ← Back to team
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-500 flex items-center justify-center text-2xl font-bold">
              {athlete.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <h1 className="text-3xl font-bold">{athlete.name}</h1>
              <p className="text-slate-400">{athlete.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="px-4 py-2 rounded-xl border border-white/10 text-sm hover:bg-white/5 transition-colors">
              Message
            </button>
            <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white text-sm font-medium hover:from-fuchsia-500 hover:to-cyan-500 transition-all">
              Add Note
            </button>
          </div>
        </div>
      </div>

      {/* Athlete Info */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="p-4 rounded-xl border border-white/10 bg-white/5">
          <p className="text-xs text-slate-500 mb-1">Member Since</p>
          <p className="font-medium">{athlete.joinedDate}</p>
        </div>
        <div className="p-4 rounded-xl border border-white/10 bg-white/5">
          <p className="text-xs text-slate-500 mb-1">Primary Style</p>
          <p className="font-medium">{athlete.climbingStyle}</p>
        </div>
        <div className="p-4 rounded-xl border border-white/10 bg-white/5">
          <p className="text-xs text-slate-500 mb-1">Experience</p>
          <p className="font-medium">{athlete.experience}</p>
        </div>
        <div className="p-4 rounded-xl border border-white/10 bg-white/5">
          <p className="text-xs text-slate-500 mb-1">Home Gym</p>
          <p className="font-medium">{athlete.homeGym}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="p-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm"
          >
            <p className="text-sm text-slate-400 mb-1">{stat.label}</p>
            <p className="text-3xl font-bold">{stat.value}</p>
            <p className={`text-xs mt-2 ${
              stat.trend === 'up' ? 'text-emerald-400' : 
              stat.trend === 'down' ? 'text-red-400' : 'text-slate-500'
            }`}>
              {stat.change}
            </p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Sessions */}
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
          <div className="p-5 border-b border-white/10">
            <h2 className="font-semibold">Recent Sessions</h2>
          </div>
          <div className="divide-y divide-white/5">
            {recentSessions.map((session) => (
              <div key={session.id} className="p-5 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center">
                      {session.type === 'Bouldering' ? '🪨' : session.type === 'Sport' ? '🧗' : '🏋️'}
                    </div>
                    <div>
                      <p className="font-medium">{session.type}</p>
                      <p className="text-sm text-slate-400">{session.location}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500">{session.date}</span>
                </div>
                <div className="flex gap-6 text-sm text-slate-400 ml-13">
                  <span>{session.climbs} climbs</span>
                  <span>Hardest: <span className="text-white">{session.hardest}</span></span>
                  <span>Satisfaction: <span className="text-white">{session.satisfaction}/10</span></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* AI Insights */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="font-semibold">AI Insights</h2>
              <span className="px-2 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 text-xs">Beta</span>
            </div>
            <div className="space-y-3">
              {aiInsights.map((insight, i) => (
                <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{insight.icon}</span>
                    <div>
                      <p className="font-medium text-sm">{insight.title}</p>
                      <p className="text-xs text-slate-400 mt-1">{insight.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Injuries */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
            <h2 className="font-semibold mb-4">Injury History</h2>
            {injuries.length === 0 ? (
              <p className="text-sm text-slate-400">No injuries reported</p>
            ) : (
              <div className="space-y-3">
                {injuries.map((injury, i) => (
                  <div key={i} className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm text-amber-200">{injury.location}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        injury.status === 'healing' ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'
                      }`}>
                        {injury.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{injury.description}</p>
                    <p className="text-xs text-slate-500 mt-1">Reported {injury.date}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Coach Notes */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
            <h2 className="font-semibold mb-4">Coach Notes</h2>
            <textarea
              placeholder="Add private notes about this athlete..."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 transition-all h-24 resize-none"
            />
            <button className="mt-3 w-full py-2 rounded-lg border border-white/10 text-sm hover:bg-white/5 transition-colors">
              Save Notes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

