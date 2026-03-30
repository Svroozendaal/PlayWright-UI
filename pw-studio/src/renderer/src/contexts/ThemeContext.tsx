import { createContext, useContext, useEffect, useState } from 'react'

/** The three possible theme settings a user can choose. */
export type ThemeSetting = 'light' | 'dark' | 'system'

/** The resolved (actual) theme applied to the DOM. */
export type ResolvedTheme = 'light' | 'dark'

type ThemeContextValue = {
  /** The user's explicit theme preference (may be 'system'). */
  theme: ThemeSetting
  /** The theme actually applied to the DOM after resolving 'system'. */
  resolvedTheme: ResolvedTheme
  /** Change the theme preference. Persisted to localStorage. */
  setTheme: (theme: ThemeSetting) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => undefined,
})

const STORAGE_KEY = 'pw-studio-theme'

function resolveTheme(setting: ThemeSetting): ResolvedTheme {
  if (setting === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return setting
}

function applyTheme(resolved: ResolvedTheme): void {
  document.documentElement.setAttribute('data-theme', resolved)
}

function readStoredTheme(): ThemeSetting {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }
  return 'system'
}

export function ThemeProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [theme, setThemeState] = useState<ThemeSetting>(readStoredTheme)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(readStoredTheme()))

  // Apply theme to DOM on mount and whenever setting changes
  useEffect(() => {
    const resolved = resolveTheme(theme)
    setResolvedTheme(resolved)
    applyTheme(resolved)
  }, [theme])

  // Listen for OS-level theme changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (): void => {
      const resolved = resolveTheme('system')
      setResolvedTheme(resolved)
      applyTheme(resolved)
    }

    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const setTheme = (next: ThemeSetting): void => {
    localStorage.setItem(STORAGE_KEY, next)
    setThemeState(next)
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

/** Access the current theme setting and setter from any component. */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
