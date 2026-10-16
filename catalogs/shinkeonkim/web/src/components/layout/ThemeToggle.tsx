import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { setTheme, useTheme } from '@/lib/theme'

export function ThemeToggle() {
  const theme = useTheme()
  const dark = theme === 'dark'
  const label = dark ? '라이트 모드로 전환' : '다크 모드로 전환'
  return (
    <Button type="button" variant="outline" className="mb-5 w-full justify-start gap-2" aria-label={label}
      aria-pressed={dark} onClick={() => setTheme(dark ? 'light' : 'dark')}>
      {dark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
      {label}
    </Button>
  )
}
