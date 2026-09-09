import {
  BarController, BarElement, CategoryScale, Chart, Filler, Legend, LineController,
  LineElement, LinearScale, LogarithmicScale, PointElement, ScatterController,
  Title, Tooltip,
} from 'chart.js'

Chart.register(
  BarController, BarElement, LineController, LineElement, PointElement, ScatterController,
  CategoryScale, LinearScale, LogarithmicScale, Filler, Legend, Title, Tooltip,
)

/** 확장별 색은 앱 전체에서 같은 값을 쓴다 — 차트에서도 CSS 토큰과 어긋나면 안 된다. */
export const C = {
  bigm: '#60a5fa',
  trgm: '#fb7185',
  tsv: '#a78bfa',
  ok: '#34d399',
  warn: '#fbbf24',
  none: '#94a3b8',
  grid: 'rgba(148,163,184,0.14)',
  text: '#94a3b8',
  fg: '#cbd5e1',
} as const

export function alpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

Chart.defaults.color = C.text
Chart.defaults.borderColor = C.grid
Chart.defaults.font.family =
  '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", Pretendard, "Noto Sans KR", system-ui, sans-serif'
Chart.defaults.font.size = 12
Chart.defaults.plugins.legend.labels.boxWidth = 12
Chart.defaults.plugins.legend.labels.boxHeight = 12
Chart.defaults.plugins.legend.labels.usePointStyle = true
Chart.defaults.maintainAspectRatio = false

type AxisOpts = { log?: boolean; xTitle?: string; yTitle?: string; stacked?: boolean }

/** 축·격자 설정을 매 차트마다 베끼지 않으려고 한 곳에 모았다. */
export function axes({ log, xTitle, yTitle, stacked }: AxisOpts = {}) {
  return {
    x: {
      stacked,
      grid: { color: C.grid, drawTicks: false },
      title: xTitle ? { display: true, text: xTitle, color: C.text } : undefined,
      ticks: { color: C.text },
    },
    y: {
      stacked,
      type: (log ? 'logarithmic' : 'linear') as 'logarithmic' | 'linear',
      grid: { color: C.grid, drawTicks: false },
      title: yTitle ? { display: true, text: yTitle, color: C.text } : undefined,
      ticks: { color: C.text },
    },
  }
}
