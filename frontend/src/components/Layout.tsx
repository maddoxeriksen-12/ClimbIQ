import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { user, signOut, isCoach } = useAuth()
  const location = useLocation()

  // Different nav items based on role
  const athleteNavItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/session/new', label: 'New Session', icon: '🧗' },
    { path: '/sessions', label: 'History', icon: '📅' },
    { path: '/recommendations', label: 'Insights', icon: '💡' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ]

  const coachNavItems = [
    { path: '/', label: 'Team Dashboard', icon: '👥' },
    { path: '/recommendations', label: 'Team Insights', icon: '💡' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ]

  const navItems = isCoach() ? coachNavItems : athleteNavItems
  const userRole = isCoach() ? 'Coach' : 'Athlete'

  const isActive = (path: string) => location.pathname === path

  // Color scheme based on role
  const gradientFrom = isCoach() ? 'from-amber-500' : 'from-fuchsia-500'
  const gradientTo = isCoach() ? 'to-orange-500' : 'to-cyan-500'
  const gradientFromText = isCoach() ? 'from-amber-400' : 'from-fuchsia-400'
  const gradientToText = isCoach() ? 'to-orange-400' : 'to-cyan-400'
  const activeGradientFrom = isCoach() ? 'from-amber-500/20' : 'from-fuchsia-500/20'
  const activeGradientTo = isCoach() ? 'to-orange-500/20' : 'to-cyan-500/20'
  const roleTextColor = isCoach() ? 'text-amber-400' : 'text-fuchsia-400'

  return (
    <div className="min-h-screen bg-[#0a0f0d] text-white flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/10 bg-white/[0.02] backdrop-blur-xl flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <Link to="/" className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center font-bold text-lg`}>
              C
            </div>
            <div>
              <span className={`text-xl font-bold bg-gradient-to-r ${gradientFromText} ${gradientToText} bg-clip-text text-transparent`}>
                ClimbIQ
              </span>
              {isCoach() && <p className="text-xs text-slate-500">Coach Portal</p>}
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive(item.path)
                  ? `bg-gradient-to-r ${activeGradientFrom} ${activeGradientTo} text-white border border-white/10`
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5">
            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center text-sm font-bold`}>
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
              </p>
              <p className={`text-xs ${roleTextColor}`}>{userRole}</p>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="mt-3 w-full px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="min-h-full">
          {children}
        </div>
      </main>
    </div>
  )
}
