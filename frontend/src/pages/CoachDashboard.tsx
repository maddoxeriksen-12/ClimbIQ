import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { CustomVariableManager } from '../components/CustomVariableManager'

interface Athlete {
  id: string
  name: string
  email: string
  avatar?: string
  lastSession: string
  sessionsThisWeek: number
  currentGrade: string
  trend: 'up' | 'down' | 'stable'
  status: 'active' | 'resting' | 'injured'
}

interface PendingInvitation {
  id: string
  email: string
  sentAt: string
  status: 'pending' | 'expired'
}

export function CoachDashboard() {
  const { user } = useAuth()
  const coachName = user?.user_metadata?.full_name?.split(' ')[0] || 'Coach'

  const [searchQuery, setSearchQuery] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showTeamVariablesModal, setShowTeamVariablesModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteMessage, setInviteMessage] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'athletes' | 'invitations'>('athletes')

  // Mock data - replace with real data from your backend
  const teamStats = {
    totalAthletes: 6,
    activeSessions: 8,
    avgGrade: 'V5',
    weeklyImprovement: '+12%',
  }

  const athletes: Athlete[] = [
    { id: '1', name: 'Alex Johnson', email: 'alex@example.com', lastSession: 'Today', sessionsThisWeek: 4, currentGrade: 'V6', trend: 'up', status: 'active' },
    { id: '2', name: 'Sam Rivera', email: 'sam@example.com', lastSession: 'Yesterday', sessionsThisWeek: 3, currentGrade: 'V5', trend: 'stable', status: 'active' },
    { id: '3', name: 'Jordan Lee', email: 'jordan@example.com', lastSession: '2 days ago', sessionsThisWeek: 2, currentGrade: 'V7', trend: 'up', status: 'resting' },
    { id: '4', name: 'Taylor Chen', email: 'taylor@example.com', lastSession: '3 days ago', sessionsThisWeek: 1, currentGrade: 'V4', trend: 'down', status: 'injured' },
    { id: '5', name: 'Casey Morgan', email: 'casey@example.com', lastSession: 'Today', sessionsThisWeek: 5, currentGrade: 'V8', trend: 'up', status: 'active' },
    { id: '6', name: 'Riley Park', email: 'riley@example.com', lastSession: 'Yesterday', sessionsThisWeek: 3, currentGrade: 'V5', trend: 'stable', status: 'active' },
  ]

  // Mock pending invitations
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([
    { id: '1', email: 'newathlete@example.com', sentAt: '2 days ago', status: 'pending' },
    { id: '2', email: 'another@example.com', sentAt: '5 days ago', status: 'pending' },
  ])

  const filteredAthletes = athletes.filter(
    (athlete) =>
      athlete.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      athlete.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleInvite = async () => {
    if (!inviteEmail) return
    
    setIsInviting(true)
    setInviteError(null)
    setInviteSuccess(false)

    try {
      // Simulate API call - replace with actual invitation logic
      await new Promise(resolve => setTimeout(resolve, 1500))

      // In production, this would call:
      // const result = await sendTeamInvitation(inviteEmail, user.id, coachFullName)
      
      // Add to pending invitations (mock)
      setPendingInvitations(prev => [
        { id: Date.now().toString(), email: inviteEmail, sentAt: 'Just now', status: 'pending' },
        ...prev,
      ])

      setInviteSuccess(true)
      setInviteEmail('')
      setInviteMessage('')

      // Close modal after showing success
      setTimeout(() => {
        setShowInviteModal(false)
        setInviteSuccess(false)
      }, 2000)
    } catch {
      setInviteError('Failed to send invitation. Please try again.')
    } finally {
      setIsInviting(false)
    }
  }

  const handleResendInvitation = async (invitationId: string) => {
    // In production: await resendInvitation(invitationId, coachFullName)
    console.log('Resending invitation:', invitationId)
  }

  const handleCancelInvitation = async (invitationId: string) => {
    // In production: await cancelInvitation(invitationId)
    setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId))
  }

  const getStatusColor = (status: Athlete['status']) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
      case 'resting':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
      case 'injured':
        return 'bg-red-500/20 text-red-300 border-red-500/30'
    }
  }

  const getTrendIcon = (trend: Athlete['trend']) => {
    switch (trend) {
      case 'up':
        return <span className="text-emerald-400">↑</span>
      case 'down':
        return <span className="text-red-400">↓</span>
      case 'stable':
        return <span className="text-slate-400">→</span>
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            Welcome, <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">{coachName}</span>
          </h1>
          <p className="text-slate-400">Here's how your team is performing this week.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowTeamVariablesModal(true)}
            className="px-4 py-2 rounded-xl border border-amber-500/30 text-amber-300 font-medium hover:bg-amber-500/10 transition-all flex items-center gap-2"
          >
            <span>📊</span>
            Team Variables
          </button>
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-medium hover:from-amber-500 hover:to-orange-500 transition-all flex items-center gap-2"
          >
            <span>+</span>
            Invite Athlete
          </button>
        </div>
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="p-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-xl">
              👥
            </div>
            <p className="text-sm text-slate-400">Total Athletes</p>
          </div>
          <p className="text-3xl font-bold">{teamStats.totalAthletes}</p>
        </div>

        <div className="p-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-xl">
              🧗
            </div>
            <p className="text-sm text-slate-400">Active This Week</p>
          </div>
          <p className="text-3xl font-bold">{teamStats.activeSessions}</p>
        </div>

        <div className="p-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center text-xl">
              📊
            </div>
            <p className="text-sm text-slate-400">Team Avg Grade</p>
          </div>
          <p className="text-3xl font-bold">{teamStats.avgGrade}</p>
        </div>

        <div className="p-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-xl">
              📈
            </div>
            <p className="text-sm text-slate-400">Weekly Progress</p>
          </div>
          <p className="text-3xl font-bold text-emerald-400">{teamStats.weeklyImprovement}</p>
        </div>
      </div>

      {/* Athletes/Invitations Tabs */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('athletes')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'athletes'
                    ? 'bg-amber-500/20 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Athletes ({athletes.length})
              </button>
              <button
                onClick={() => setActiveTab('invitations')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  activeTab === 'invitations'
                    ? 'bg-amber-500/20 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Pending Invitations
                {pendingInvitations.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 text-xs">
                    {pendingInvitations.length}
                  </span>
                )}
              </button>
            </div>
            {activeTab === 'athletes' && (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search athletes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 rounded-xl border border-white/10 bg-white/5 px-4 py-2 pl-10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
              </div>
            )}
          </div>
        </div>

        {/* Athletes Tab Content */}
        {activeTab === 'athletes' && (
          <div className="divide-y divide-white/5">
            {filteredAthletes.length === 0 ? (
              <div className="p-12 text-center">
                <span className="text-4xl mb-4 block">🔍</span>
                <p className="text-slate-400">No athletes found matching "{searchQuery}"</p>
              </div>
            ) : (
              filteredAthletes.map((athlete) => (
                <Link
                  key={athlete.id}
                  to={`/athlete/${athlete.id}`}
                  className="flex items-center justify-between p-5 hover:bg-white/[0.03] transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-lg font-bold">
                      {athlete.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium group-hover:text-amber-400 transition-colors">{athlete.name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs border ${getStatusColor(athlete.status)}`}>
                          {athlete.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500">{athlete.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-sm text-slate-400">Last Session</p>
                      <p className="font-medium">{athlete.lastSession}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400">This Week</p>
                      <p className="font-medium">{athlete.sessionsThisWeek} sessions</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400">Grade</p>
                      <p className="font-medium flex items-center gap-1">
                        {athlete.currentGrade} {getTrendIcon(athlete.trend)}
                      </p>
                    </div>
                    <span className="text-slate-500 group-hover:text-amber-400 transition-colors">→</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {/* Invitations Tab Content */}
        {activeTab === 'invitations' && (
          <div>
            {pendingInvitations.length === 0 ? (
              <div className="p-12 text-center">
                <span className="text-4xl mb-4 block">✉️</span>
                <p className="text-slate-400 mb-4">No pending invitations</p>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-300 text-sm hover:bg-amber-500/30 transition-colors"
                >
                  Invite an athlete
                </button>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {pendingInvitations.map((invitation) => (
                  <div key={invitation.id} className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl">
                        ✉️
                      </div>
                      <div>
                        <p className="font-medium">{invitation.email}</p>
                        <p className="text-sm text-slate-500">Sent {invitation.sentAt}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs">
                        Pending
                      </span>
                      <button
                        onClick={() => handleResendInvitation(invitation.id)}
                        className="px-3 py-1 rounded-lg border border-white/10 text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        Resend
                      </button>
                      <button
                        onClick={() => handleCancelInvitation(invitation.id)}
                        className="px-3 py-1 rounded-lg border border-red-500/30 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isInviting && setShowInviteModal(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0a0f0d] p-6 shadow-2xl">
            {/* Success State */}
            {inviteSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center text-3xl mb-4">
                  ✓
                </div>
                <h2 className="text-xl font-bold mb-2">Invitation Sent!</h2>
                <p className="text-slate-400">
                  An email has been sent to the athlete with instructions to join your team.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-2xl">
                    ✉️
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Invite Athlete</h2>
                    <p className="text-sm text-slate-400">Send an invitation to join your team</p>
                  </div>
                </div>

                {inviteError && (
                  <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                    {inviteError}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Athlete's Email *</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                      placeholder="athlete@example.com"
                      disabled={isInviting}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">
                      Personal Message <span className="text-slate-500">(optional)</span>
                    </label>
                    <textarea
                      value={inviteMessage}
                      onChange={(e) => setInviteMessage(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all h-24 resize-none"
                      placeholder="Add a personal note to your invitation..."
                      disabled={isInviting}
                    />
                  </div>

                  {/* What happens next */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <p className="text-xs font-medium text-slate-300 mb-2">What happens next:</p>
                    <ol className="text-xs text-slate-400 space-y-1">
                      <li>1. The athlete receives an email invitation</li>
                      <li>2. They click the link to accept and create/login to their account</li>
                      <li>3. Once accepted, they appear in your team dashboard</li>
                    </ol>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowInviteModal(false)}
                      disabled={isInviting}
                      className="flex-1 py-3 rounded-xl border border-white/10 text-white font-medium hover:bg-white/5 disabled:opacity-50 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleInvite}
                      disabled={!inviteEmail || isInviting}
                      className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-medium hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                      {isInviting ? (
                        <>
                          <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <span>📧</span>
                          Send Invitation
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Team Variables Modal */}
      {showTeamVariablesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowTeamVariablesModal(false)} />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0f0d] p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-2xl">
                📊
              </div>
              <div>
                <h2 className="text-xl font-bold">Team Custom Variables</h2>
                <p className="text-sm text-slate-400">Create variables all your athletes will fill out</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-6">
              <p className="text-xs text-amber-200/80">
                <strong>💡 Team Variables:</strong> Variables you create here will appear in the pre-session 
                or post-session forms for all athletes on your team. This helps you collect consistent data 
                across your entire team for better analysis.
              </p>
            </div>

            <CustomVariableManager 
              userId={user?.id || ''} 
              userRole="coach"
              coachId={user?.id}
              onClose={() => setShowTeamVariablesModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
