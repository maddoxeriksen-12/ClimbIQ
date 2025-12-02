import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function AcceptInvitation() {
  const { invitationId } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [invitation, setInvitation] = useState<{
    coachName: string
    coachEmail: string
    status: 'pending' | 'accepted' | 'declined' | 'expired'
    expiresAt: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // Fetch invitation details
    const fetchInvitation = async () => {
      try {
        // In production, this would call:
        // const data = await getInvitationDetails(invitationId)
        
        // Mock data for now
        await new Promise(resolve => setTimeout(resolve, 500))
        setInvitation({
          coachName: 'Coach Smith',
          coachEmail: 'coach@example.com',
          status: 'pending',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
      } catch {
        setError('Failed to load invitation details')
      } finally {
        setLoading(false)
      }
    }

    fetchInvitation()
  }, [invitationId])

  const handleAccept = async () => {
    if (!user) {
      // Redirect to login with return URL
      navigate(`/login?redirect=/accept-invitation/${invitationId}`)
      return
    }

    setAccepting(true)
    setError(null)

    try {
      // In production, this would call:
      // const result = await acceptInvitation(invitationId, user.id)
      
      await new Promise(resolve => setTimeout(resolve, 1500))
      setSuccess(true)

      // Redirect to dashboard after success
      setTimeout(() => {
        navigate('/')
      }, 3000)
    } catch {
      setError('Failed to accept invitation. Please try again.')
    } finally {
      setAccepting(false)
    }
  }

  const handleDecline = async () => {
    if (!window.confirm('Are you sure you want to decline this invitation?')) return

    try {
      // In production: await declineInvitation(invitationId)
      navigate('/')
    } catch {
      setError('Failed to decline invitation')
    }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0f0d] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          <p className="text-slate-400">Loading invitation...</p>
        </div>
      </div>
    )
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-[#0a0f0d] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-red-500/20 flex items-center justify-center text-4xl mb-6">
            ❌
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Invitation Not Found</h1>
          <p className="text-slate-400 mb-6">This invitation may have expired or been cancelled.</p>
          <Link
            to="/"
            className="inline-flex px-6 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-medium hover:from-amber-500 hover:to-orange-500 transition-all"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (invitation?.status === 'expired') {
    return (
      <div className="min-h-screen bg-[#0a0f0d] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center text-4xl mb-6">
            ⏰
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Invitation Expired</h1>
          <p className="text-slate-400 mb-6">
            This invitation has expired. Please ask {invitation.coachName} to send a new one.
          </p>
          <Link
            to="/"
            className="inline-flex px-6 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-medium hover:from-amber-500 hover:to-orange-500 transition-all"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (invitation?.status === 'accepted') {
    return (
      <div className="min-h-screen bg-[#0a0f0d] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center text-4xl mb-6">
            ✓
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Already Accepted</h1>
          <p className="text-slate-400 mb-6">
            You've already joined {invitation.coachName}'s team.
          </p>
          <Link
            to="/"
            className="inline-flex px-6 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-medium hover:from-amber-500 hover:to-orange-500 transition-all"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0f0d] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center text-4xl mb-6">
            🎉
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Welcome to the Team!</h1>
          <p className="text-slate-400 mb-2">
            You've successfully joined {invitation?.coachName}'s team.
          </p>
          <p className="text-sm text-slate-500">Redirecting to your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0f0d] flex items-center justify-center px-4 py-10">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-950/40 via-[#0a0f0d] to-orange-950/30" />
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full bg-amber-600/20 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-orange-500/15 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-4xl mb-4">
              📋
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Team Invitation</h1>
            <p className="text-slate-400">
              You've been invited to join a coaching team on ClimbIQ
            </p>
          </div>

          {/* Invitation details */}
          <div className="p-5 rounded-xl bg-white/5 border border-white/10 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-2xl font-bold">
                {invitation?.coachName.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-white">{invitation?.coachName}</p>
                <p className="text-sm text-slate-400">{invitation?.coachEmail}</p>
              </div>
            </div>
            <p className="text-sm text-slate-300">
              {invitation?.coachName} wants you to join their team. As part of their team, they'll be able to:
            </p>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              <li className="flex items-center gap-2">
                <span className="text-amber-400">•</span>
                View your climbing sessions and progress
              </li>
              <li className="flex items-center gap-2">
                <span className="text-amber-400">•</span>
                See your performance analytics
              </li>
              <li className="flex items-center gap-2">
                <span className="text-amber-400">•</span>
                Provide personalized coaching feedback
              </li>
            </ul>
          </div>

          {error && (
            <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Not logged in notice */}
          {!user && (
            <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <p className="text-sm text-amber-200">
                <strong>Note:</strong> You'll need to sign in or create an account to accept this invitation.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-semibold hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {accepting ? (
                <>
                  <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Accepting...
                </>
              ) : user ? (
                <>
                  <span>✓</span>
                  Accept Invitation
                </>
              ) : (
                <>
                  <span>→</span>
                  Sign In to Accept
                </>
              )}
            </button>

            <button
              onClick={handleDecline}
              disabled={accepting}
              className="w-full py-3 rounded-xl border border-white/10 text-slate-400 font-medium hover:text-white hover:bg-white/5 disabled:opacity-50 transition-all"
            >
              Decline
            </button>
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-slate-500">
            By accepting, you agree to share your climbing data with this coach.
            You can leave the team at any time from your settings.
          </p>
        </div>
      </div>
    </div>
  )
}

