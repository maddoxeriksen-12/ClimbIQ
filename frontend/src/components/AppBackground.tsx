import { useTheme } from '../contexts/ThemeContext'

export function AppBackground() {
  const { themeMode, backgroundType } = useTheme()

  // Base colors for dark/light modes
  const isDark = themeMode === 'dark'

  if (backgroundType === 'solid') {
    return (
      <div
        className="fixed inset-0 -z-10 transition-colors duration-500"
        style={{
          backgroundColor: isDark ? '#0f1312' : '#f5f7fa',
        }}
      />
    )
  }

  // Mountain landscape background
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Sky gradient */}
      <div
        className="absolute inset-0 transition-all duration-500"
        style={{
          background: isDark
            ? 'linear-gradient(180deg, #0d1b2a 0%, #1b263b 30%, #2d3a4a 60%, #3d4f5f 100%)'
            : 'linear-gradient(180deg, #87ceeb 0%, #b0d4e8 30%, #d4e5f0 60%, #e8f1f5 100%)',
        }}
      />

      {/* Stars (only in dark mode) */}
      {isDark && (
        <div className="absolute inset-0 opacity-40">
          <div className="absolute w-1 h-1 bg-white rounded-full top-[5%] left-[10%] animate-pulse" style={{ animationDelay: '0s' }} />
          <div className="absolute w-0.5 h-0.5 bg-white rounded-full top-[8%] left-[25%] animate-pulse" style={{ animationDelay: '0.5s' }} />
          <div className="absolute w-1 h-1 bg-white rounded-full top-[3%] left-[40%] animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute w-0.5 h-0.5 bg-white rounded-full top-[12%] left-[55%] animate-pulse" style={{ animationDelay: '1.5s' }} />
          <div className="absolute w-1 h-1 bg-white rounded-full top-[6%] left-[70%] animate-pulse" style={{ animationDelay: '0.3s' }} />
          <div className="absolute w-0.5 h-0.5 bg-white rounded-full top-[4%] left-[85%] animate-pulse" style={{ animationDelay: '0.8s' }} />
          <div className="absolute w-0.5 h-0.5 bg-white rounded-full top-[15%] left-[15%] animate-pulse" style={{ animationDelay: '1.2s' }} />
          <div className="absolute w-1 h-1 bg-white rounded-full top-[10%] left-[92%] animate-pulse" style={{ animationDelay: '0.6s' }} />
        </div>
      )}

      {/* Distant mountain range (back) */}
      <svg
        className="absolute bottom-0 left-0 w-full transition-all duration-500"
        style={{ height: '70%' }}
        viewBox="0 0 1440 600"
        preserveAspectRatio="xMidYMax slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="mountain-back-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isDark ? '#4a5568' : '#94a3b8'} />
            <stop offset="100%" stopColor={isDark ? '#2d3748' : '#cbd5e1'} />
          </linearGradient>
          <linearGradient id="mountain-mid-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isDark ? '#3d5a6c' : '#7c9aaa'} />
            <stop offset="100%" stopColor={isDark ? '#2c4a5a' : '#a8c5d5'} />
          </linearGradient>
          <linearGradient id="mountain-front-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isDark ? '#2d4a3e' : '#6b9080'} />
            <stop offset="100%" stopColor={isDark ? '#1a332a' : '#8fb09a'} />
          </linearGradient>
          <linearGradient id="mountain-closest-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isDark ? '#1e352d' : '#5a7a6a'} />
            <stop offset="50%" stopColor={isDark ? '#162620' : '#7a9a8a'} />
            <stop offset="100%" stopColor={isDark ? '#0f1a15' : '#9ab8a8'} />
          </linearGradient>
          {/* Soft blur filter */}
          <filter id="soft-blur" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
          </filter>
        </defs>

        {/* Back mountains (furthest, most faded) */}
        <path
          d="M0 600 L0 380 
             Q100 350 200 320 
             Q280 290 360 340 
             Q440 280 520 250 
             Q600 220 680 280 
             Q760 200 840 230 
             Q920 180 1000 220 
             Q1080 170 1160 240 
             Q1240 210 1320 270 
             Q1400 230 1440 280 
             L1440 600 Z"
          fill="url(#mountain-back-gradient)"
          opacity={isDark ? '0.6' : '0.5'}
          filter="url(#soft-blur)"
        />

        {/* Mid mountains */}
        <path
          d="M0 600 L0 420 
             Q80 380 160 400 
             Q260 340 360 380 
             Q440 320 520 360 
             Q620 290 720 340 
             Q820 270 920 320 
             Q1000 280 1080 330 
             Q1180 270 1280 340 
             Q1360 300 1440 360 
             L1440 600 Z"
          fill="url(#mountain-mid-gradient)"
          opacity={isDark ? '0.7' : '0.6'}
        />

        {/* Front mountains */}
        <path
          d="M0 600 L0 460 
             Q100 420 200 450 
             Q320 380 440 430 
             Q540 370 640 420 
             Q760 350 880 410 
             Q980 360 1080 410 
             Q1200 350 1320 420 
             Q1400 380 1440 440 
             L1440 600 Z"
          fill="url(#mountain-front-gradient)"
          opacity={isDark ? '0.85' : '0.7'}
        />

        {/* Closest hills/mountains */}
        <path
          d="M0 600 L0 520 
             Q120 480 240 510 
             Q380 460 520 500 
             Q680 450 840 490 
             Q960 460 1080 500 
             Q1220 450 1360 510 
             Q1420 480 1440 520 
             L1440 600 Z"
          fill="url(#mountain-closest-gradient)"
          opacity="1"
        />
      </svg>

      {/* Subtle fog/mist overlay at the bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 transition-all duration-500"
        style={{
          background: isDark
            ? 'linear-gradient(to top, rgba(15, 19, 18, 0.9) 0%, rgba(15, 19, 18, 0) 100%)'
            : 'linear-gradient(to top, rgba(245, 247, 250, 0.9) 0%, rgba(245, 247, 250, 0) 100%)',
        }}
      />

      {/* Very subtle noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  )
}

