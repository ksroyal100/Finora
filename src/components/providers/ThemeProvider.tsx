'use client'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark'
const STORAGE_KEY = 'finora-theme'
const LEGACY_STORAGE_KEY = 'wealthos-theme' // pre-rename key: still honoured so existing users keep their theme

const ThemeContext = createContext<{
  theme: Theme
  setTheme: (t: Theme) => void
  toggleTheme: () => void
}>({ theme: 'dark', setTheme: () => {}, toggleTheme: () => {} })

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Actual value is set synchronously before paint by the inline script in
  // layout.tsx (see ThemeScript below) — this just keeps React's state in
  // sync with whatever data-theme ended up on <html> so toggling works.
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme') as Theme | null
    if (current === 'light' || current === 'dark') setThemeState(current)
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    document.documentElement.setAttribute('data-theme', t)
    try { localStorage.setItem(STORAGE_KEY, t) } catch { /* private browsing, ignore */ }
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// Inline, render-blocking script — sets data-theme on <html> before React
// hydrates or the page paints, so a returning user who chose light mode
// never sees a flash of the dark theme first. This is the same technique
// libraries like next-themes use under the hood.
export function ThemeScript() {
  const script = `
    (function() {
      try {
        var stored = localStorage.getItem('${STORAGE_KEY}') || localStorage.getItem('${LEGACY_STORAGE_KEY}');
        var theme = stored === 'light' || stored === 'dark' ? stored : 'dark';
        document.documentElement.setAttribute('data-theme', theme);
      } catch (e) {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    })();
  `
  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
