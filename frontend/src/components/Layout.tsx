import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { user, signOut, isCoach } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showStatsNav, setShowStatsNav] = useState(() => localStorage.getItem('showStatsNav') !== 'false')
  
  // Style values - finalized
  const bgOpacity = 30 // 30%
  const bgBrightness = 0 // 0% = black
  const bubbleOpacity = 80 // 80%
  const bubbleBrightness = 20 // 20% (dark gray)
  
  /* DEBUG SLIDERS - Uncomment to re-enable
  const [bgOpacity, setBgOpacity] = useState(30)
  const [bgBrightness, setBgBrightness] = useState(0)
  const [bubbleOpacity, setBubbleOpacity] = useState(80)
  const [bubbleBrightness, setBubbleBrightness] = useState(20)
  */

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

  // Listen for nav settings changes
  useEffect(() => {
    const handleNavSettingsChanged = () => {
      setShowStatsNav(localStorage.getItem('showStatsNav') !== 'false')
    }
    window.addEventListener('navSettingsChanged', handleNavSettingsChanged)
    return () => window.removeEventListener('navSettingsChanged', handleNavSettingsChanged)
  }, [])

  // Different nav items based on role
  const baseAthleteNavItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/session/new', label: 'New Session', icon: '🧗' },
    { path: '/sessions', label: 'History', icon: '📅' },
  ]
  
  const statsNavItem = { path: '/stats', label: 'Stats', icon: '📈' }
  
  const athleteNavItems = showStatsNav 
    ? [...baseAthleteNavItems, statsNavItem, { path: '/recommendations', label: 'Insights', icon: '💡' }, { path: '/settings', label: 'Settings', icon: '⚙️' }]
    : [...baseAthleteNavItems, { path: '/recommendations', label: 'Insights', icon: '💡' }, { path: '/settings', label: 'Settings', icon: '⚙️' }]

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

  // Navigate to dashboard and scroll to top
  const goToDashboard = () => {
    if (location.pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      navigate('/')
      // Scroll to top after navigation
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100)
    }
  }
  
  // Scroll to top function (for nav items on same page)
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-[#0a0f0d] text-white flex flex-col md:flex-row">
      {/* Mobile Header - Only visible on mobile */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#0a0f0d]/95 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center justify-center px-4 py-3 relative">
          {/* Logo - centered, navigates to dashboard */}
          <button 
            onClick={goToDashboard}
            className="flex items-center gap-2"
          >
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center font-bold text-sm`}>
              C
            </div>
            <span className={`text-lg font-bold bg-gradient-to-r ${gradientFromText} ${gradientToText} bg-clip-text text-transparent`}>
              ClimbIQ
            </span>
          </button>

          {/* Mobile Menu Button - positioned absolute right */}
          <div className="mobile-menu-container absolute right-4">
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
              <div 
                className="absolute top-full right-0 mt-2 w-64 rounded-2xl border border-white/30 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                style={{ 
                  backgroundColor: `rgba(${Math.round(255 * bgBrightness / 100)}, ${Math.round(255 * bgBrightness / 100)}, ${Math.round(255 * bgBrightness / 100)}, ${bgOpacity / 100})` 
                }}
              >
                {/* DEBUG SLIDERS - Uncomment to re-enable
                <div className="px-4 py-3 border-b border-black/10 bg-black/5">
                  <p className="text-xs font-bold text-black mb-2">🎨 Debug Controls</p>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs text-black/70 mb-1">
                        <span>Text: {textBrightness}%</span>
                        <span>{textBrightness === 0 ? 'Black' : textBrightness === 100 ? 'White' : 'Gray'}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={textBrightness}
                        onChange={(e) => setTextBrightness(Number(e.target.value))}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer"
                        style={{ background: `linear-gradient(to right, #000 0%, #fff 100%)` }}
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-black/70 mb-1">
                        <span>BG Color: {bgBrightness}%</span>
                        <span>{bgBrightness === 0 ? 'Black' : bgBrightness === 100 ? 'White' : 'Gray'}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={bgBrightness}
                        onChange={(e) => setBgBrightness(Number(e.target.value))}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer"
                        style={{ background: `linear-gradient(to right, #000 0%, #fff 100%)` }}
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-black/70 mb-1">
                        <span>BG Opacity: {bgOpacity}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={bgOpacity}
                        onChange={(e) => setBgOpacity(Number(e.target.value))}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gradient-to-r from-transparent to-white"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-black/70 mb-1">
                        <span>Bubble Opacity: {bubbleOpacity}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={bubbleOpacity}
                        onChange={(e) => setBubbleOpacity(Number(e.target.value))}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gradient-to-r from-transparent to-gray-500"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-black/70 mb-1">
                        <span>Bubble Color: {bubbleBrightness}%</span>
                        <span>{bubbleBrightness === 0 ? 'Black' : bubbleBrightness === 100 ? 'White' : 'Gray'}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={bubbleBrightness}
                        onChange={(e) => setBubbleBrightness(Number(e.target.value))}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer"
                        style={{ background: `linear-gradient(to right, #000 0%, #fff 100%)` }}
                      />
                    </div>
                  </div>
                </div>
                */}

                {/* User Info - clickable, links to profile tab in settings */}
                <Link 
                  to="/settings?tab=profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-4 mx-2 mt-2 rounded-xl transition-opacity hover:opacity-80"
                  style={{ 
                    backgroundColor: `rgba(${Math.round(255 * bubbleBrightness / 100)}, ${Math.round(255 * bubbleBrightness / 100)}, ${Math.round(255 * bubbleBrightness / 100)}, ${bubbleOpacity / 100})`
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center font-bold text-sm shadow-lg`}>
                      {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-white">
                        {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                      </p>
                      <p className={`text-xs font-medium ${roleTextColor}`}>{userRole}</p>
                    </div>
                    <span className="text-white/50 text-sm">→</span>
                  </div>
                </Link>

                {/* Navigation Items - With bubbles, 100% white text */}
                <nav className="py-3 px-2 space-y-1">
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
                      className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold transition-all rounded-xl text-white"
                      style={{ 
                        backgroundColor: `rgba(${Math.round(255 * bubbleBrightness / 100)}, ${Math.round(255 * bubbleBrightness / 100)}, ${Math.round(255 * bubbleBrightness / 100)}, ${bubbleOpacity / 100})`
                      }}
                    >
                      <span className="text-xl drop-shadow-sm">{item.icon}</span>
                      {item.label}
                      {isActive(item.path) && (
                        <span className={`ml-auto w-2 h-2 rounded-full bg-gradient-to-r ${gradientFrom} ${gradientTo} shadow-lg`} />
                      )}
                    </Link>
                  ))}
                </nav>

                {/* Sign Out - Same bubble style */}
                <div className="py-3 px-2">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false)
                      signOut()
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-red-400 hover:text-red-300 transition-all rounded-xl"
                    style={{ 
                      backgroundColor: `rgba(${Math.round(255 * bubbleBrightness / 100)}, ${Math.round(255 * bubbleBrightness / 100)}, ${Math.round(255 * bubbleBrightness / 100)}, ${bubbleOpacity / 100})`
                    }}
                  >
                    <span className="text-xl drop-shadow-sm">🚪</span>
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
