import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'USD', compact = false): string {
  if (compact) {
    const symbol = getCurrencySymbol(currency)
    if (Math.abs(amount) >= 1_000_000) return `${symbol}${(amount / 1_000_000).toFixed(1)}M`
    if (Math.abs(amount) >= 1_000) return `${symbol}${(amount / 1_000).toFixed(1)}K`
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

// Used only for the abbreviated "1.2K/1.2M" compact format above — Intl
// already handles the full/non-compact case's symbol correctly on its own.
function getCurrencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency }).formatToParts(0)
    return parts.find(p => p.type === 'currency')?.value ?? '$'
  } catch {
    return '$'
  }
}

export function formatCurrencyDecimal(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

export function formatPercent(value: number, showSign = true): string {
  const sign = showSign && value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function formatNumber(n: number, compact = false): string {
  if (compact) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  }
  return new Intl.NumberFormat('en-US').format(n)
}

export function formatDate(date: string | Date, style: 'short' | 'long' | 'relative' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (style === 'relative') {
    const diff = Date.now() - d.getTime()
    const min = Math.floor(diff / 60_000), hr = Math.floor(diff / 3_600_000), day = Math.floor(diff / 86_400_000)
    if (min < 1) return 'just now'
    if (min < 60) return `${min}m ago`
    if (hr < 24) return `${hr}h ago`
    if (day < 7) return `${day}d ago`
    if (day < 30) return `${Math.floor(day / 7)}w ago`
    return `${Math.floor(day / 30)}mo ago`
  }
  if (style === 'long') return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function getChangeColor(value: number): string {
  if (value > 0) return 'var(--text-green)'
  if (value < 0) return 'var(--text-red)'
  return 'var(--text-secondary)'
}

export function getChangeClass(value: number): string {
  if (value > 0) return 'badge-green'
  if (value < 0) return 'badge-red'
  return 'badge-gray'
}

export function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '…' : str
}

export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}
