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
            ? 'linear-gradient(180deg, #0a0e14 0%, #141e2a 20%, #1b2838 40%, #243447 60%, #2d4156 80%, #3a5268 100%)'
            : 'linear-gradient(180deg, #5b9bd5 0%, #7eb8e4 20%, #9dcef0 40%, #bde0f5 60%, #dceef9 80%, #eef6fb 100%)',
        }}
      />

      {/* Stars (only in dark mode) */}
      {isDark && (
        <div className="absolute inset-0 opacity-60">
          <div className="absolute w-1 h-1 bg-white rounded-full top-[5%] left-[10%] animate-pulse" style={{ animationDelay: '0s' }} />
          <div className="absolute w-0.5 h-0.5 bg-white rounded-full top-[8%] left-[25%] animate-pulse" style={{ animationDelay: '0.5s' }} />
          <div className="absolute w-1.5 h-1.5 bg-white rounded-full top-[3%] left-[40%] animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute w-0.5 h-0.5 bg-white rounded-full top-[12%] left-[55%] animate-pulse" style={{ animationDelay: '1.5s' }} />
          <div className="absolute w-1 h-1 bg-white rounded-full top-[6%] left-[70%] animate-pulse" style={{ animationDelay: '0.3s' }} />
          <div className="absolute w-0.5 h-0.5 bg-white rounded-full top-[4%] left-[85%] animate-pulse" style={{ animationDelay: '0.8s' }} />
          <div className="absolute w-0.5 h-0.5 bg-white rounded-full top-[15%] left-[15%] animate-pulse" style={{ animationDelay: '1.2s' }} />
          <div className="absolute w-1 h-1 bg-white rounded-full top-[10%] left-[92%] animate-pulse" style={{ animationDelay: '0.6s' }} />
          <div className="absolute w-0.5 h-0.5 bg-white rounded-full top-[18%] left-[33%] animate-pulse" style={{ animationDelay: '0.9s' }} />
          <div className="absolute w-1 h-1 bg-white rounded-full top-[7%] left-[60%] animate-pulse" style={{ animationDelay: '1.8s' }} />
          <div className="absolute w-0.5 h-0.5 bg-white rounded-full top-[2%] left-[78%] animate-pulse" style={{ animationDelay: '2.1s' }} />
          <div className="absolute w-1 h-1 bg-white rounded-full top-[14%] left-[88%] animate-pulse" style={{ animationDelay: '0.4s' }} />
        </div>
      )}

      {/* Mountains SVG */}
      <svg
        className="absolute bottom-0 left-0 w-full transition-all duration-500"
        style={{ height: '75%' }}
        viewBox="0 0 1920 800"
        preserveAspectRatio="xMidYMax slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Distant mountains gradient (furthest - bluish gray) */}
          <linearGradient id="mountain-distant" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isDark ? '#4a5a6a' : '#8fa5b8'} />
            <stop offset="100%" stopColor={isDark ? '#3a4a5a' : '#b0c4d4'} />
          </linearGradient>
          
          {/* Back mountains gradient */}
          <linearGradient id="mountain-back" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isDark ? '#3d4d5d' : '#7090a5'} />
            <stop offset="50%" stopColor={isDark ? '#354555' : '#85a5b8'} />
            <stop offset="100%" stopColor={isDark ? '#2d3d4d' : '#9ab8c8'} />
          </linearGradient>
          
          {/* Mid mountains gradient (blue-green) */}
          <linearGradient id="mountain-mid" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isDark ? '#2f4a4a' : '#5a8080'} />
            <stop offset="40%" stopColor={isDark ? '#2a4242' : '#6a9090'} />
            <stop offset="100%" stopColor={isDark ? '#203535' : '#7aa0a0'} />
          </linearGradient>
          
          {/* Front mountains gradient (forest green) */}
          <linearGradient id="mountain-front" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isDark ? '#1e3830' : '#4a7060'} />
            <stop offset="50%" stopColor={isDark ? '#1a3028' : '#5a8070'} />
            <stop offset="100%" stopColor={isDark ? '#152520' : '#6a9080'} />
          </linearGradient>
          
          {/* Closest hills gradient (darkest green) */}
          <linearGradient id="mountain-closest" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isDark ? '#152820' : '#3a5848'} />
            <stop offset="50%" stopColor={isDark ? '#102018' : '#486858'} />
            <stop offset="100%" stopColor={isDark ? '#0c1810' : '#587868'} />
          </linearGradient>

          {/* Snow cap gradient */}
          <linearGradient id="snow-cap" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isDark ? '#e8f0f8' : '#ffffff'} />
            <stop offset="100%" stopColor={isDark ? '#c8d8e8' : '#e8f0f8'} />
          </linearGradient>

          {/* Ridge shadow gradient */}
          <linearGradient id="ridge-shadow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.3)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </linearGradient>

          {/* Atmospheric haze filter */}
          <filter id="haze" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
          </filter>
          
          <filter id="light-haze" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" />
          </filter>
        </defs>

        {/* ============ LAYER 1: Distant Mountains (furthest, haziest) ============ */}
        <g filter="url(#haze)" opacity={isDark ? '0.5' : '0.4'}>
          <path
            d="M0 800 L0 420 
               L80 400 L160 320 L200 340 L280 280 L340 300 L400 220 L460 260 L520 180 L580 220 L640 160 L700 200 
               L760 140 L820 180 L880 120 L940 160 L1000 100 L1060 140 L1120 80 L1180 120 L1240 150 L1300 110 
               L1360 160 L1420 130 L1480 180 L1540 140 L1600 200 L1660 160 L1720 220 L1780 180 L1840 240 L1920 200 
               L1920 800 Z"
            fill="url(#mountain-distant)"
          />
        </g>

        {/* ============ LAYER 2: Back Mountains with snow caps ============ */}
        <g filter="url(#light-haze)" opacity={isDark ? '0.65' : '0.55'}>
          {/* Main mountain silhouette */}
          <path
            d="M0 800 L0 480 
               L60 450 L120 380 L160 400 L220 320 L280 360 L340 280 L380 300 L440 220 L500 260 
               L560 200 L620 240 L680 180 L740 220 L800 150 L860 190 L920 140 L980 180 
               L1040 220 L1100 160 L1160 200 L1220 140 L1280 180 L1340 120 L1400 160 
               L1460 200 L1520 150 L1580 190 L1640 230 L1700 180 L1760 220 L1820 260 L1880 220 L1920 280 
               L1920 800 Z"
            fill="url(#mountain-back)"
          />
          {/* Snow caps on tallest peaks */}
          <path
            d="M920 140 L880 180 L900 175 L920 155 L940 175 L960 180 L920 140"
            fill="url(#snow-cap)"
            opacity="0.9"
          />
          <path
            d="M1340 120 L1300 165 L1320 160 L1340 135 L1360 160 L1380 165 L1340 120"
            fill="url(#snow-cap)"
            opacity="0.9"
          />
          <path
            d="M800 150 L760 195 L780 190 L800 165 L820 190 L840 195 L800 150"
            fill="url(#snow-cap)"
            opacity="0.85"
          />
        </g>

        {/* ============ LAYER 3: Mid Mountains with detail ============ */}
        <g opacity={isDark ? '0.8' : '0.7'}>
          {/* Main silhouette */}
          <path
            d="M0 800 L0 520 
               L40 500 L100 440 L140 460 L200 380 L260 420 L320 350 L380 380 L440 300 L500 340 
               L560 280 L620 320 L680 250 L740 290 L800 220 L860 260 L920 200 L980 240 
               L1040 280 L1100 220 L1160 260 L1220 200 L1280 240 L1340 180 L1400 220 
               L1460 260 L1520 210 L1580 250 L1640 290 L1700 240 L1760 280 L1820 320 L1880 280 L1920 340 
               L1920 800 Z"
            fill="url(#mountain-mid)"
          />
          {/* Ridge detail lines (left face shadows) */}
          <path
            d="M680 250 L680 320 L660 340 L680 250"
            fill="rgba(0,0,0,0.15)"
          />
          <path
            d="M920 200 L920 280 L895 300 L920 200"
            fill="rgba(0,0,0,0.15)"
          />
          <path
            d="M1340 180 L1340 260 L1315 280 L1340 180"
            fill="rgba(0,0,0,0.15)"
          />
          <path
            d="M1100 220 L1100 290 L1080 310 L1100 220"
            fill="rgba(0,0,0,0.12)"
          />
          {/* Snow patches */}
          <path
            d="M920 200 L890 245 L905 240 L920 215 L935 240 L950 245 L920 200"
            fill="url(#snow-cap)"
            opacity="0.8"
          />
          <path
            d="M1340 180 L1310 225 L1325 220 L1340 195 L1355 220 L1370 225 L1340 180"
            fill="url(#snow-cap)"
            opacity="0.75"
          />
        </g>

        {/* ============ LAYER 4: Front Mountains with texture ============ */}
        <g opacity={isDark ? '0.9' : '0.8'}>
          {/* Main silhouette */}
          <path
            d="M0 800 L0 560 
               L60 530 L120 470 L160 490 L220 420 L280 450 L340 380 L400 410 L460 340 L520 380 
               L580 320 L640 360 L700 290 L760 330 L820 270 L880 310 L940 250 L1000 290 
               L1060 330 L1120 280 L1180 320 L1240 260 L1300 300 L1360 240 L1420 280 
               L1480 320 L1540 270 L1600 310 L1660 350 L1720 300 L1780 340 L1840 380 L1900 340 L1920 380 
               L1920 800 Z"
            fill="url(#mountain-front)"
          />
          {/* Ridge shadows for depth */}
          <path
            d="M460 340 L460 420 L435 450 L460 340"
            fill="rgba(0,0,0,0.2)"
          />
          <path
            d="M700 290 L700 380 L670 410 L700 290"
            fill="rgba(0,0,0,0.2)"
          />
          <path
            d="M940 250 L940 340 L910 370 L940 250"
            fill="rgba(0,0,0,0.2)"
          />
          <path
            d="M1240 260 L1240 350 L1210 380 L1240 260"
            fill="rgba(0,0,0,0.18)"
          />
          <path
            d="M1360 240 L1360 330 L1330 360 L1360 240"
            fill="rgba(0,0,0,0.2)"
          />
          {/* Tree line texture (subtle darker patches near bottom) */}
          <path
            d="M200 600 Q250 580 300 600 Q350 590 400 610 Q450 595 500 615 L500 800 L200 800 Z"
            fill="rgba(0,0,0,0.08)"
          />
          <path
            d="M800 580 Q880 560 960 585 Q1040 570 1120 590 L1120 800 L800 800 Z"
            fill="rgba(0,0,0,0.08)"
          />
          <path
            d="M1400 590 Q1500 570 1600 595 Q1700 575 1800 600 L1800 800 L1400 800 Z"
            fill="rgba(0,0,0,0.07)"
          />
        </g>

        {/* ============ LAYER 5: Closest Hills/Foothills ============ */}
        <g opacity="1">
          {/* Main silhouette with more organic, rolling shapes */}
          <path
            d="M0 800 L0 620 
               L40 610 L100 570 L160 590 L220 550 L280 580 L340 540 L400 560 L460 520 L520 550 
               L580 510 L640 540 L700 500 L760 530 L820 490 L880 520 L940 480 L1000 510 
               L1060 540 L1120 500 L1180 530 L1240 490 L1300 520 L1360 480 L1420 510 
               L1480 540 L1540 500 L1600 530 L1660 560 L1720 520 L1780 550 L1840 580 L1900 540 L1920 570 
               L1920 800 Z"
            fill="url(#mountain-closest)"
          />
          {/* Subtle terrain variation */}
          <path
            d="M0 700 Q100 680 200 710 Q300 690 400 720 Q500 695 600 725 
               Q700 700 800 730 Q900 705 1000 735 Q1100 710 1200 740 
               Q1300 715 1400 745 Q1500 720 1600 750 Q1700 725 1800 755 Q1850 740 1920 760 
               L1920 800 L0 800 Z"
            fill="rgba(0,0,0,0.1)"
          />
          {/* Individual tree silhouettes scattered along ridge */}
          <g fill={isDark ? '#0c1810' : '#2a4838'} opacity="0.6">
            <path d="M150 620 L145 600 L150 595 L155 600 L150 620" />
            <path d="M280 580 L273 555 L280 548 L287 555 L280 580" />
            <path d="M450 540 L442 510 L450 502 L458 510 L450 540" />
            <path d="M620 530 L612 500 L620 492 L628 500 L620 530" />
            <path d="M780 510 L770 475 L780 465 L790 475 L780 510" />
            <path d="M950 490 L940 455 L950 445 L960 455 L950 490" />
            <path d="M1100 510 L1090 475 L1100 465 L1110 475 L1100 510" />
            <path d="M1250 500 L1240 465 L1250 455 L1260 465 L1250 500" />
            <path d="M1400 500 L1390 465 L1400 455 L1410 465 L1400 500" />
            <path d="M1550 520 L1540 485 L1550 475 L1560 485 L1550 520" />
            <path d="M1700 540 L1690 505 L1700 495 L1710 505 L1700 540" />
          </g>
        </g>
      </svg>

      {/* Atmospheric fog/mist layers */}
      <div
        className="absolute bottom-0 left-0 right-0 h-48 transition-all duration-500 pointer-events-none"
        style={{
          background: isDark
            ? 'linear-gradient(to top, rgba(15, 19, 18, 0.95) 0%, rgba(15, 19, 18, 0.6) 40%, rgba(15, 19, 18, 0) 100%)'
            : 'linear-gradient(to top, rgba(245, 247, 250, 0.95) 0%, rgba(245, 247, 250, 0.6) 40%, rgba(245, 247, 250, 0) 100%)',
        }}
      />

      {/* Very subtle noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  )
}
