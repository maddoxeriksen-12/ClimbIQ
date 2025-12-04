import { useState, useEffect } from 'react'
import { useAuth, type UserRole } from '../hooks/useAuth'
import { SubscriptionManager } from '../components/SubscriptionManager'
import { CustomVariableManager } from '../components/CustomVariableManager'
import { useLocation } from 'react-router-dom'
import { useTheme, type ThemeMode, type BackgroundType } from '../contexts/ThemeContext'

type SettingsTab = 'profile' | 'subscription' | 'preferences' | 'tracking' | 'account'

export function Settings() {
  const { user, getUserRole, updateUserRole, isCoach } = useAuth()
  const location = useLocation()
  const { themeMode, backgroundType, setThemeMode, setBackgroundType } = useTheme()
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const [profileData, setProfileData] = useState({
    fullName: user?.user_metadata?.full_name || '',
    email: user?.email || '',
    climbingStyle: 'bouldering',
    experience: 'intermediate',
    homeGym: '',
  })
  const [isUpdatingRole, setIsUpdatingRole] = useState(false)
  const [roleUpdateSuccess, setRoleUpdateSuccess] = useState(false)

  // Check if we should open a specific tab from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const tab = params.get('tab')
    if (tab && ['profile', 'subscription', 'preferences', 'tracking', 'account'].includes(tab)) {
      setActiveTab(tab as SettingsTab)
    }
  }, [location.search])

  const currentRole = getUserRole()

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'subscription', label: 'Subscription', icon: '💳' },
    { id: 'tracking', label: 'Custom Tracking', icon: '📊' },
    { id: 'preferences', label: 'Preferences', icon: '🎛️' },
    { id: 'account', label: 'Account', icon: '🔧' },
  ]

  const handleProfileSave = async () => {
    // TODO: Implement profile save via Supabase
    console.log('Saving profile:', profileData)
  }

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
    <div className="p-8 max-w-4xl overflow-x-hidden">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-slate-400">Manage your account and preferences.</p>
      </div>

      {/* Tabs - Horizontally scrollable with visible scrollbar */}
      <div className="mb-8 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        <div className="flex gap-2 p-1 rounded-xl bg-white/5 border border-white/10 w-fit min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
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
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
          <h2 className="text-xl font-semibold mb-6">Profile Information</h2>
          
          <div className="space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${isCoach() ? 'from-amber-500 to-orange-500' : 'from-fuchsia-500 to-violet-500'} flex items-center justify-center text-3xl font-bold`}>
                {profileData.fullName?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <button className="px-4 py-2 rounded-lg border border-white/10 text-sm hover:bg-white/5 transition-colors">
                  Change avatar
                </button>
              </div>
            </div>

            {/* Form fields */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Full Name</label>
                <input
                  type="text"
                  value={profileData.fullName}
                  onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                  className={`w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 ${isCoach() ? 'focus:ring-amber-500/50' : 'focus:ring-fuchsia-500/50'} transition-all`}
                  placeholder="Your name"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Email</label>
                <input
                  type="email"
                  value={profileData.email}
                  disabled
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400 cursor-not-allowed"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Primary Climbing Style</label>
                <select
                  value={profileData.climbingStyle}
                  onChange={(e) => setProfileData({ ...profileData, climbingStyle: e.target.value })}
                  className={`w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 ${isCoach() ? 'focus:ring-amber-500/50' : 'focus:ring-fuchsia-500/50'} transition-all`}
                >
                  <option value="bouldering">Bouldering</option>
                  <option value="sport">Sport Climbing</option>
                  <option value="trad">Trad Climbing</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Experience Level</label>
                <select
                  value={profileData.experience}
                  onChange={(e) => setProfileData({ ...profileData, experience: e.target.value })}
                  className={`w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 ${isCoach() ? 'focus:ring-amber-500/50' : 'focus:ring-fuchsia-500/50'} transition-all`}
                >
                  <option value="beginner">Beginner (0-1 years)</option>
                  <option value="intermediate">Intermediate (1-3 years)</option>
                  <option value="advanced">Advanced (3-7 years)</option>
                  <option value="expert">Expert (7+ years)</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-300">Home Gym</label>
                <input
                  type="text"
                  value={profileData.homeGym}
                  onChange={(e) => setProfileData({ ...profileData, homeGym: e.target.value })}
                  className={`w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 ${isCoach() ? 'focus:ring-amber-500/50' : 'focus:ring-fuchsia-500/50'} transition-all`}
                  placeholder="Where do you climb most often?"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-white/10">
              <button
                onClick={handleProfileSave}
                className={`px-6 py-3 rounded-xl bg-gradient-to-r ${isCoach() ? 'from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500' : 'from-fuchsia-600 to-cyan-600 hover:from-fuchsia-500 hover:to-cyan-500'} text-white font-medium transition-all`}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

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
            {/* Appearance Settings */}
            <div>
              <h3 className="font-medium mb-4">Appearance</h3>
              <p className="text-sm text-slate-400 mb-4">Customize the look and feel of your app</p>
              
              {/* Theme Mode */}
              <div className="mb-6">
                <label className="text-sm font-medium text-slate-300 block mb-3">Theme</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setThemeMode('dark')}
                    className={`p-4 rounded-xl border transition-all ${
                      themeMode === 'dark'
                        ? isCoach()
                          ? 'border-amber-500/50 bg-amber-500/10'
                          : 'border-fuchsia-500/50 bg-fuchsia-500/10'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#0f1312] border border-white/20 flex items-center justify-center">
                        🌙
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-sm">Dark</p>
                        <p className="text-xs text-slate-400">Easy on the eyes</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setThemeMode('light')}
                    className={`p-4 rounded-xl border transition-all ${
                      themeMode === 'light'
                        ? isCoach()
                          ? 'border-amber-500/50 bg-amber-500/10'
                          : 'border-fuchsia-500/50 bg-fuchsia-500/10'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#f5f7fa] border border-slate-200 flex items-center justify-center">
                        ☀️
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-sm">Light</p>
                        <p className="text-xs text-slate-400">Bright and clean</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Background Type */}
              <div>
                <label className="text-sm font-medium text-slate-300 block mb-3">Background</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setBackgroundType('solid')}
                    className={`p-4 rounded-xl border transition-all ${
                      backgroundType === 'solid'
                        ? isCoach()
                          ? 'border-amber-500/50 bg-amber-500/10'
                          : 'border-fuchsia-500/50 bg-fuchsia-500/10'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${themeMode === 'dark' ? 'bg-[#0f1312]' : 'bg-[#f5f7fa]'} border border-white/20 flex items-center justify-center`}>
                        <div className="w-4 h-4 rounded bg-current opacity-30" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-sm">Solid</p>
                        <p className="text-xs text-slate-400">Simple background</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setBackgroundType('mountains')}
                    className={`p-4 rounded-xl border transition-all ${
                      backgroundType === 'mountains'
                        ? isCoach()
                          ? 'border-amber-500/50 bg-amber-500/10'
                          : 'border-fuchsia-500/50 bg-fuchsia-500/10'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/20 relative">
                        {/* Mini mountain preview */}
                        <div className="absolute inset-0 bg-gradient-to-b from-[#1b263b] to-[#2d3a4a]" />
                        <svg viewBox="0 0 40 40" className="absolute inset-0 w-full h-full">
                          <path d="M0 40 L0 28 Q10 22 20 26 Q30 20 40 25 L40 40 Z" fill="#3d5a6c" opacity="0.7" />
                          <path d="M0 40 L0 32 Q12 26 24 30 Q32 26 40 32 L40 40 Z" fill="#2d4a3e" opacity="0.9" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-sm">Mountains</p>
                        <p className="text-xs text-slate-400">Scenic landscape</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 pt-6" />

            {/* Navigation Items */}
            <div>
              <h3 className="font-medium mb-4">Navigation</h3>
              <p className="text-sm text-slate-400 mb-4">Choose which items appear in your navigation menu</p>
              <div className="space-y-3">
                <label className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/[0.07] transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📈</span>
                    <div>
                      <p className="font-medium text-sm">Stats & Analytics</p>
                      <p className="text-xs text-slate-400">View detailed climbing statistics and charts</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={localStorage.getItem('showStatsNav') !== 'false'}
                    onChange={(e) => {
                      localStorage.setItem('showStatsNav', e.target.checked.toString())
                      window.dispatchEvent(new Event('navSettingsChanged'))
                    }}
                    className={`w-5 h-5 rounded bg-white/10 border-white/20 ${isCoach() ? 'text-amber-500 focus:ring-amber-500/50' : 'text-fuchsia-500 focus:ring-fuchsia-500/50'}`}
                  />
                </label>
              </div>
            </div>

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
