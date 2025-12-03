import { useState } from 'react'
import { useAuth, type UserRole } from '../hooks/useAuth'
import { SubscriptionManager } from '../components/SubscriptionManager'
import { CustomVariableManager } from '../components/CustomVariableManager'

type SettingsTab = 'subscription' | 'preferences' | 'tracking' | 'account'

export function Settings() {
  const { user, getUserRole, updateUserRole, isCoach } = useAuth()
  const [activeTab, setActiveTab] = useState<SettingsTab>('subscription')
  const [isUpdatingRole, setIsUpdatingRole] = useState(false)
  const [roleUpdateSuccess, setRoleUpdateSuccess] = useState(false)

  const currentRole = getUserRole()

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'subscription', label: 'Subscription', icon: '💳' },
    { id: 'tracking', label: 'Custom Tracking', icon: '📊' },
    { id: 'preferences', label: 'Preferences', icon: '🎛️' },
    { id: 'account', label: 'Account', icon: '🔧' },
  ]

  const handleRoleChange = async (newRole: UserRole) => {
    if (newRole === currentRole) return
    
    setIsUpdatingRole(true)
    setRoleUpdateSuccess(false)
    try {
      await updateUserRole(newRole)
      setRoleUpdateSuccess(true)
      // Reload the page to apply the new role throughout the app
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (error) {
      console.error('Failed to update role:', error)
    } finally {
      setIsUpdatingRole(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-slate-400">Manage your account and preferences.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? isCoach()
                  ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-white'
                  : 'bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/20 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'subscription' && (
        <SubscriptionManager currentTier="free" />
      )}

      {activeTab === 'tracking' && (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
          <CustomVariableManager 
            userId={user?.id || ''} 
            userRole={isCoach() ? 'coach' : 'athlete'}
            coachId={isCoach() ? user?.id : user?.user_metadata?.coach_id}
          />
        </div>
      )}

      {activeTab === 'preferences' && (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
          <h2 className="text-xl font-semibold mb-6">Preferences</h2>
          
          <div className="space-y-6">
            {/* Notification settings */}
            <div>
              <h3 className="font-medium mb-4">Notifications</h3>
              <div className="space-y-3">
                {[
                  { id: 'email_reminders', label: 'Session reminders', desc: 'Get reminded to log your sessions' },
                  { id: 'weekly_summary', label: 'Weekly summary', desc: 'Receive a weekly progress report' },
                  { id: 'ai_insights', label: 'AI insights', desc: 'Get notified about new recommendations' },
                ].map((pref) => (
                  <label key={pref.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/[0.07] transition-colors">
                    <div>
                      <p className="font-medium text-sm">{pref.label}</p>
                      <p className="text-xs text-slate-400">{pref.desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      defaultChecked
                      className={`w-5 h-5 rounded bg-white/10 border-white/20 ${isCoach() ? 'text-amber-500 focus:ring-amber-500/50' : 'text-fuchsia-500 focus:ring-fuchsia-500/50'}`}
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Units */}
            <div>
              <h3 className="font-medium mb-4">Units & Display</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Grade System</label>
                  <select className={`w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 ${isCoach() ? 'focus:ring-amber-500/50' : 'focus:ring-fuchsia-500/50'} transition-all`}>
                    <option value="v-scale">V-Scale (V0-V17)</option>
                    <option value="font">Font (4-9a)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Sport Grade System</label>
                  <select className={`w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 ${isCoach() ? 'focus:ring-amber-500/50' : 'focus:ring-fuchsia-500/50'} transition-all`}>
                    <option value="yds">YDS (5.0-5.15d)</option>
                    <option value="french">French (1-9c)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'account' && (
        <div className="space-y-6">
          {/* Account Type / Role Switcher */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
            <h2 className="text-xl font-semibold mb-2">Account Type</h2>
            <p className="text-sm text-slate-400 mb-6">
              Switch between athlete and coach modes. This changes your dashboard and available features.
            </p>

            {roleUpdateSuccess && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
                ✓ Account type updated! Refreshing...
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              {/* Athlete Option */}
              <button
                onClick={() => handleRoleChange('athlete')}
                disabled={isUpdatingRole}
                className={`relative p-6 rounded-xl border text-left transition-all ${
                  currentRole === 'athlete'
                    ? 'border-fuchsia-500/50 bg-fuchsia-500/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07]'
                } ${isUpdatingRole ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {currentRole === 'athlete' && (
                  <div className="absolute top-4 right-4">
                    <span className="px-2 py-1 rounded-full bg-fuchsia-500/20 text-fuchsia-300 text-xs font-medium">
                      Current
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500 to-cyan-500 flex items-center justify-center text-2xl">
                    🧗
                  </div>
                  <div>
                    <h3 className="font-semibold">Athlete</h3>
                    <p className="text-xs text-slate-400">Personal training mode</p>
                  </div>
                </div>
                <p className="text-sm text-slate-300">
                  Track your own sessions, get AI recommendations, and monitor your progress.
                </p>
                <ul className="mt-4 space-y-1 text-xs text-slate-400">
                  <li>• Log climbing sessions</li>
                  <li>• Personal AI insights</li>
                  <li>• Progress tracking</li>
                </ul>
              </button>

              {/* Coach Option */}
              <button
                onClick={() => handleRoleChange('coach')}
                disabled={isUpdatingRole}
                className={`relative p-6 rounded-xl border text-left transition-all ${
                  currentRole === 'coach'
                    ? 'border-amber-500/50 bg-amber-500/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07]'
                } ${isUpdatingRole ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {currentRole === 'coach' && (
                  <div className="absolute top-4 right-4">
                    <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-medium">
                      Current
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-2xl">
                    📋
                  </div>
                  <div>
                    <h3 className="font-semibold">Coach</h3>
                    <p className="text-xs text-slate-400">Team management mode</p>
                  </div>
                </div>
                <p className="text-sm text-slate-300">
                  Manage your team, monitor athlete progress, and provide data-driven coaching.
                </p>
                <ul className="mt-4 space-y-1 text-xs text-slate-400">
                  <li>• Team dashboard</li>
                  <li>• Monitor all athletes</li>
                  <li>• Performance analytics</li>
                </ul>
              </button>
            </div>

            {isUpdatingRole && (
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
                <div className="w-4 h-4 rounded-full border-2 border-fuchsia-500 border-t-transparent animate-spin" />
                Updating account type...
              </div>
            )}
          </div>

          {/* Danger zone */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
            <h2 className="text-xl font-semibold text-red-400 mb-4">Danger Zone</h2>
            <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
              <p className="text-sm text-slate-300 mb-3">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <button className="px-4 py-2 rounded-lg border border-red-500/50 text-red-400 text-sm hover:bg-red-500/10 transition-colors">
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
