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

  // Mountain landscape background using the reference image
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 transition-all duration-500"
        style={{
          backgroundImage: 'url("/images/mountains-bg.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center bottom',
          backgroundRepeat: 'no-repeat',
          // Apply dark overlay for dark mode
          filter: isDark ? 'brightness(0.4) saturate(0.8)' : 'none',
        }}
      />

      {/* Dark mode overlay for better contrast */}
      {isDark && (
        <div
          className="absolute inset-0 transition-all duration-500"
          style={{
            background: 'linear-gradient(180deg, rgba(10, 15, 20, 0.3) 0%, rgba(10, 15, 20, 0.5) 100%)',
          }}
        />
      )}

      {/* Bottom fade for content readability */}
      <div
        className="absolute bottom-0 left-0 right-0 h-48 transition-all duration-500 pointer-events-none"
        style={{
          background: isDark
            ? 'linear-gradient(to top, rgba(15, 19, 18, 0.95) 0%, rgba(15, 19, 18, 0) 100%)'
            : 'linear-gradient(to top, rgba(245, 248, 246, 0.9) 0%, rgba(245, 248, 246, 0) 100%)',
        }}
      />
    </div>
  )
}
