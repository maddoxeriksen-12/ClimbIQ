import { useTheme } from '../contexts/ThemeContext'

export function AppBackground() {
  const { themeMode, backgroundType } = useTheme()

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

  // Smooth layered mountain landscape
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Sky gradient - soft pale blue to cream */}
      <div
        className="absolute inset-0 transition-all duration-500"
        style={{
          background: isDark
            ? 'linear-gradient(180deg, #1a2530 0%, #243442 25%, #2d4050 50%, #3a5060 75%, #4a6070 100%)'
            : 'linear-gradient(180deg, #c5d5dc 0%, #d0dde3 20%, #dbe6e9 40%, #e5eeef 60%, #eef4f3 80%, #f5f8f6 100%)',
        }}
      />

      {/* Mountains SVG - Smooth rolling layers */}
      <svg
        className="absolute bottom-0 left-0 w-full transition-all duration-500"
        style={{ height: '85%' }}
        viewBox="0 0 1920 1000"
        preserveAspectRatio="xMidYMax slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Layer 1: Furthest mountains - lightest blue-gray */}
        <path
          d="M0 1000 L0 500 
             C150 480, 250 420, 400 400 
             C550 380, 650 450, 800 380 
             C950 310, 1050 350, 1200 320 
             C1350 290, 1450 360, 1600 340 
             C1750 320, 1850 380, 1920 360 
             L1920 1000 Z"
          fill={isDark ? '#4a6272' : '#9eb8c4'}
          opacity={isDark ? '0.6' : '0.7'}
        />

        {/* Layer 2: Distant mountains - medium blue-gray */}
        <path
          d="M0 1000 L0 540 
             C100 520, 180 470, 300 450 
             C420 430, 520 500, 680 440 
             C840 380, 960 420, 1100 380 
             C1240 340, 1360 400, 1500 370 
             C1640 340, 1760 410, 1920 380 
             L1920 1000 Z"
          fill={isDark ? '#526a7a' : '#8faab8'}
          opacity={isDark ? '0.7' : '0.75'}
        />

        {/* Layer 3: Mid-distant mountains - blue with hint of teal */}
        <path
          d="M0 1000 L0 580 
             C120 560, 220 500, 380 480 
             C540 460, 660 540, 840 480 
             C1020 420, 1140 470, 1300 430 
             C1460 390, 1580 460, 1740 420 
             C1820 400, 1880 440, 1920 430 
             L1920 1000 Z"
          fill={isDark ? '#5a7282' : '#7d9ca8'}
          opacity={isDark ? '0.75' : '0.8'}
        />

        {/* Layer 4: Mid mountains - teal-blue */}
        <path
          d="M0 1000 L0 620 
             C80 600, 160 540, 300 520 
             C440 500, 560 580, 740 520 
             C920 460, 1060 510, 1220 470 
             C1380 430, 1500 500, 1680 460 
             C1780 440, 1860 480, 1920 470 
             L1920 1000 Z"
          fill={isDark ? '#5a7a82' : '#6d8e96'}
          opacity={isDark ? '0.8' : '0.85'}
        />

        {/* Layer 5: Mid-front mountains - blue-green */}
        <path
          d="M0 1000 L0 660 
             C100 640, 200 580, 360 560 
             C520 540, 660 620, 860 560 
             C1060 500, 1200 550, 1380 510 
             C1560 470, 1680 540, 1840 500 
             C1890 490, 1920 510, 1920 510 
             L1920 1000 Z"
          fill={isDark ? '#4a7068' : '#5d8278'}
          opacity={isDark ? '0.85' : '0.88'}
        />

        {/* Layer 6: Front mountains - green-teal */}
        <path
          d="M0 1000 L0 700 
             C120 680, 240 620, 420 600 
             C600 580, 740 660, 960 600 
             C1180 540, 1320 590, 1520 550 
             C1720 510, 1840 580, 1920 560 
             L1920 1000 Z"
          fill={isDark ? '#3d6458' : '#4d7468'}
          opacity={isDark ? '0.9' : '0.9'}
        />

        {/* Layer 7: Near-front hills - darker green */}
        <path
          d="M0 1000 L0 740 
             C80 720, 180 670, 340 650 
             C500 630, 640 700, 860 650 
             C1080 600, 1240 650, 1460 610 
             C1680 570, 1800 630, 1920 610 
             L1920 1000 Z"
          fill={isDark ? '#2f5448' : '#3d6452'}
          opacity={isDark ? '0.93' : '0.92'}
        />

        {/* Layer 8: Closest hills - darkest green */}
        <path
          d="M0 1000 L0 780 
             C100 760, 220 720, 400 700 
             C580 680, 720 740, 960 700 
             C1200 660, 1360 710, 1600 670 
             C1760 650, 1860 690, 1920 680 
             L1920 1000 Z"
          fill={isDark ? '#243e34' : '#2d5040'}
          opacity={isDark ? '0.96' : '0.94'}
        />

        {/* Layer 9: Foreground hills - very dark green */}
        <path
          d="M0 1000 L0 820 
             C60 800, 160 770, 320 750 
             C480 730, 620 780, 840 750 
             C1060 720, 1220 760, 1460 730 
             C1700 700, 1820 740, 1920 730 
             L1920 1000 Z"
          fill={isDark ? '#1a2e24' : '#1e3a2c'}
          opacity="1"
        />
      </svg>

      {/* Subtle bottom fade for content readability */}
      <div
        className="absolute bottom-0 left-0 right-0 h-40 transition-all duration-500 pointer-events-none"
        style={{
          background: isDark
            ? 'linear-gradient(to top, rgba(15, 19, 18, 0.8) 0%, rgba(15, 19, 18, 0) 100%)'
            : 'linear-gradient(to top, rgba(245, 248, 246, 0.8) 0%, rgba(245, 248, 246, 0) 100%)',
        }}
      />
    </div>
  )
}
