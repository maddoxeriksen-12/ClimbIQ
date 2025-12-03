import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { user, signOut, isCoach } = useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (mobileMenuOpen && !target.closest('.mobile-menu-container')) {
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [mobileMenuOpen])

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
  const borderColor = isCoach() ? 'border-amber-500/30' : 'border-fuchsia-500/30'

  // Scroll to top function
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-[#0a0f0d] text-white flex flex-col md:flex-row">
      {/* Mobile Header - Only visible on mobile */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#0a0f0d]/95 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Logo - scrolls to top */}
          <button 
            onClick={scrollToTop}
            className="flex items-center gap-2"
          >
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center font-bold text-sm`}>
              C
            </div>
            <span className={`text-lg font-bold bg-gradient-to-r ${gradientFromText} ${gradientToText} bg-clip-text text-transparent`}>
              ClimbIQ
            </span>
          </button>

          {/* Mobile Menu Button */}
          <div className="mobile-menu-container relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setMobileMenuOpen(!mobileMenuOpen)
              }}
              className={`p-2 rounded-lg border transition-all ${
                mobileMenuOpen 
                  ? `bg-gradient-to-r ${activeGradientFrom} ${activeGradientTo} ${borderColor}` 
                  : 'border-white/10 hover:bg-white/5'
              }`}
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>

            {/* Mobile Dropdown Menu - Transparent with floating items */}
            {mobileMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-56 rounded-2xl border border-white/20 bg-white/20 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                {/* User Info - minimal */}
                <div className="px-5 py-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center font-bold text-sm`}>
                      {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-white/90">
                        {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                      </p>
                      <p className={`text-xs ${roleTextColor}`}>{userRole}</p>
                    </div>
                  </div>
                </div>

                {/* Navigation Items - Free floating */}
                <nav className="py-3 px-2">
                  {navItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => {
                        setMobileMenuOpen(false)
                        if (item.path === location.pathname) {
                          scrollToTop()
                        }
                      }}
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                        isActive(item.path)
                          ? 'text-white'
                          : 'text-white/60 hover:text-white'
                      }`}
                    >
                      <span className="text-lg">{item.icon}</span>
                      {item.label}
                      {isActive(item.path) && (
                        <span className={`ml-auto w-1.5 h-1.5 rounded-full bg-gradient-to-r ${gradientFrom} ${gradientTo}`} />
                      )}
                    </Link>
                  ))}
                </nav>

                {/* Sign Out - Free floating */}
                <div className="py-3 px-2 border-t border-white/10">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false)
                      signOut()
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-400/80 hover:text-red-400 transition-colors"
                  >
                    <span className="text-lg">🚪</span>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Desktop Sidebar - Hidden on mobile */}
      <aside className="hidden md:flex w-64 border-r border-white/10 bg-white/[0.02] backdrop-blur-xl flex-col fixed h-full">
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
      <main className="flex-1 md:ml-64 pt-14 md:pt-0 overflow-auto">
        <div className="min-h-full">
          {children}
        </div>
      </main>
    </div>
  )
}
