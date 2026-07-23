import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'
export type ReadingSizePreference = 'default' | 'comfortable' | 'large'

export const themeStorageKey = 'qface:theme:v1'
export const readingSizeStorageKey = 'qface:reading-size:v1'

interface ThemeContextValue {
  preference: ThemePreference
  resolvedTheme: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
  readingSize: ReadingSizePreference
  setReadingSize: (size: ReadingSizePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

function isReadingSizePreference(value: string | null): value is ReadingSizePreference {
  return value === 'default' || value === 'comfortable' || value === 'large'
}

function readThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system'

  try {
    const value = window.localStorage.getItem(themeStorageKey)
    return isThemePreference(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

function readReadingSizePreference(): ReadingSizePreference {
  if (typeof window === 'undefined') return 'default'

  try {
    const value = window.localStorage.getItem(readingSizeStorageKey)
    return isReadingSizePreference(value) ? value : 'default'
  } catch {
    return 'default'
  }
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? getSystemTheme() : preference
}

function applyTheme(preference: ThemePreference) {
  const resolvedTheme = resolveTheme(preference)

  if (typeof document !== 'undefined') {
    const root = document.documentElement
    root.dataset.theme = resolvedTheme
    root.dataset.themePreference = preference
    root.style.colorScheme = resolvedTheme

    const themeColor = resolvedTheme === 'dark' ? '#101218' : '#ffffff'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor)
  }

  return resolvedTheme
}

function applyReadingSize(size: ReadingSizePreference) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.readingSize = size
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readThemePreference())
  const [readingSize, setReadingSizeState] = useState<ReadingSizePreference>(() => {
    const nextSize = readReadingSizePreference()
    applyReadingSize(nextSize)
    return nextSize
  })
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => applyTheme(preference))

  useEffect(() => {
    const updateTheme = () => setResolvedTheme(applyTheme(preference))
    updateTheme()

    try {
      window.localStorage.setItem(themeStorageKey, preference)
    } catch {
      // Ignore unavailable storage.
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    if (preference !== 'system') return undefined

    media.addEventListener('change', updateTheme)
    return () => media.removeEventListener('change', updateTheme)
  }, [preference])

  useEffect(() => {
    applyReadingSize(readingSize)

    try {
      window.localStorage.setItem(readingSizeStorageKey, readingSize)
    } catch {
      // Ignore unavailable storage.
    }
  }, [readingSize])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === themeStorageKey && isThemePreference(event.newValue)) {
        setPreferenceState(event.newValue)
      }
      if (event.key === readingSizeStorageKey && isReadingSizePreference(event.newValue)) {
        setReadingSizeState(event.newValue)
      }
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference)
  }, [])

  const setReadingSize = useCallback((nextSize: ReadingSizePreference) => {
    setReadingSizeState(nextSize)
  }, [])

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference, readingSize, setReadingSize }),
    [preference, resolvedTheme, setPreference, readingSize, setReadingSize],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')

  return value
}
