import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 숫자를 한국식으로. null 은 '—' 로 — 표에서 빈칸과 0 을 구분해야 한다. */
export function nf(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : n.toLocaleString('ko-KR')
}
