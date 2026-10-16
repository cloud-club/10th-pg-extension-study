import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'
export const THEME_KEY = 'pg-study-theme-v1'
const getTheme = (): Theme => document.documentElement.classList.contains('dark') ? 'dark' : 'light'
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}
export function useTheme() {
  return useSyncExternalStore(subscribe, getTheme, () => 'dark' as Theme)
}
export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try { localStorage.setItem(THEME_KEY, theme) } catch { /* 저장이 차단되어도 전환은 가능하다. */ }
}
