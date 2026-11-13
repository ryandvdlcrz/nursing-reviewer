import { useCallback, useEffect, useState } from 'react'

const KEY = 'thaling_theme'

function readInitial() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // storage unavailable, fall back to the system setting
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export default function useTheme() {
  const [theme, setThemeState] = useState(readInitial)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#130d22' : '#f5f1ff')
    }
  }, [theme])

  const setTheme = useCallback((value) => {
    setThemeState(value)
    try {
      localStorage.setItem(KEY, value)
    } catch {
      // ignore, the theme still applies for this session
    }
  }, [])

  const toggle = useCallback(
    () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    [theme, setTheme],
  )

  return { theme, setTheme, toggle }
}