import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const CURRENCY_LOCALE: Record<string, string> = {
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  UAH: 'uk-UA',
}

let _defaultCurrency = 'USD'

export function setDefaultCurrency(currency: string) {
  _defaultCurrency = currency
}

export function formatCurrency(amount: number, currency?: string): string {
  const c = currency ?? _defaultCurrency
  const locale = CURRENCY_LOCALE[c] ?? 'en-US'
  return new Intl.NumberFormat(locale, { style: 'currency', currency: c }).format(amount)
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(
    typeof date === 'string' ? new Date(date) : date,
  )
}

export function getWeekStart(date = new Date()): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function isoWeekStart(date = new Date()): string {
  return getWeekStart(date).toISOString().slice(0, 10)
}
