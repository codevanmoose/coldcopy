'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light' | 'system'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
  attribute?: string
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'dark' | 'light'
}

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
  resolvedTheme: 'light'
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'coldcopy-theme',
  attribute = 'class',
  enableSystem = true,
  disableTransitionOnChange = false,
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(defaultTheme)
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('light')
  const [mounted, setMounted] = useState(false)

  // Only run on client side
  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem(storageKey) as Theme
    if (savedTheme) {
      setTheme(savedTheme)
    }
  }, [storageKey])

  useEffect(() => {
    if (!mounted) return

    const root = window.document.documentElement

    root.classList.remove('light', 'dark')

    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
    
    const effectiveTheme = theme === 'system' ? systemTheme : theme
    setResolvedTheme(effectiveTheme)

    if (attribute === 'class') {
      root.classList.add(effectiveTheme)
    } else {
      root.setAttribute(attribute, effectiveTheme)
    }

    // Add CSS variables for theme colors
    if (effectiveTheme === 'dark') {
      root.style.setProperty('--background', '224 71.4% 4.1%')
      root.style.setProperty('--foreground', '210 20% 98%')
      root.style.setProperty('--card', '224 71.4% 4.1%')
      root.style.setProperty('--card-foreground', '210 20% 98%')
      root.style.setProperty('--popover', '224 71.4% 4.1%')
      root.style.setProperty('--popover-foreground', '210 20% 98%')
      root.style.setProperty('--primary', '263.4 70% 50.4%')
      root.style.setProperty('--primary-foreground', '210 20% 98%')
      root.style.setProperty('--secondary', '215 27.9% 16.9%')
      root.style.setProperty('--secondary-foreground', '210 20% 98%')
      root.style.setProperty('--muted', '215 27.9% 16.9%')
      root.style.setProperty('--muted-foreground', '217.9 10.6% 64.9%')
      root.style.setProperty('--accent', '215 27.9% 16.9%')
      root.style.setProperty('--accent-foreground', '210 20% 98%')
      root.style.setProperty('--destructive', '0 84.2% 60.2%')
      root.style.setProperty('--destructive-foreground', '210 20% 98%')
      root.style.setProperty('--border', '215 27.9% 16.9%')
      root.style.setProperty('--input', '215 27.9% 16.9%')
      root.style.setProperty('--ring', '263.4 70% 50.4%')
      root.style.setProperty('--radius', '0.5rem')
    } else {
      root.style.setProperty('--background', '0 0% 100%')
      root.style.setProperty('--foreground', '224 71.4% 4.1%')
      root.style.setProperty('--card', '0 0% 100%')
      root.style.setProperty('--card-foreground', '224 71.4% 4.1%')
      root.style.setProperty('--popover', '0 0% 100%')
      root.style.setProperty('--popover-foreground', '224 71.4% 4.1%')
      root.style.setProperty('--primary', '262.1 83.3% 57.8%')
      root.style.setProperty('--primary-foreground', '210 20% 98%')
      root.style.setProperty('--secondary', '220 14.3% 95.9%')
      root.style.setProperty('--secondary-foreground', '220.9 39.3% 11%')
      root.style.setProperty('--muted', '220 14.3% 95.9%')
      root.style.setProperty('--muted-foreground', '220 8.9% 46.1%')
      root.style.setProperty('--accent', '220 14.3% 95.9%')
      root.style.setProperty('--accent-foreground', '220.9 39.3% 11%')
      root.style.setProperty('--destructive', '0 84.2% 60.2%')
      root.style.setProperty('--destructive-foreground', '210 20% 98%')
      root.style.setProperty('--border', '220 13% 91%')
      root.style.setProperty('--input', '220 13% 91%')
      root.style.setProperty('--ring', '262.1 83.3% 57.8%')
      root.style.setProperty('--radius', '0.5rem')
    }
  }, [theme, attribute, mounted])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = () => {
      if (theme === 'system') {
        const systemTheme = mediaQuery.matches ? 'dark' : 'light'
        setResolvedTheme(systemTheme)
        
        const root = window.document.documentElement
        root.classList.remove('light', 'dark')
        root.classList.add(systemTheme)
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
    resolvedTheme
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')

  return context
}