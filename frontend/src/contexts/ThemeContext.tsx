import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type ThemeMode = 'dark' | 'light'
export type BackgroundType = 'solid' | 'mountains'

interface ThemeContextType {
  themeMode: ThemeMode
  backgroundType: BackgroundType
  setThemeMode: (mode: ThemeMode) => void
  setBackgroundType: (type: BackgroundType) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('themeMode')
    return (saved as ThemeMode) || 'dark'
  })

  const [backgroundType, setBackgroundTypeState] = useState<BackgroundType>(() => {
    const saved = localStorage.getItem('backgroundType')
    return (saved as BackgroundType) || 'solid'
  })

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode)
    localStorage.setItem('themeMode', mode)
  }

  const setBackgroundType = (type: BackgroundType) => {
    setBackgroundTypeState(type)
    localStorage.setItem('backgroundType', type)
  }

  // Apply theme class to document
  useEffect(() => {
    document.documentElement.classList.remove('theme-dark', 'theme-light')
    document.documentElement.classList.add(`theme-${themeMode}`)
  }, [themeMode])

  return (
    <ThemeContext.Provider value={{ themeMode, backgroundType, setThemeMode, setBackgroundType }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

