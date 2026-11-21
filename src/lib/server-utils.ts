// ============================================================
// FINORA — Utility Functions
// ============================================================

// ── STRING UTILITIES ─────────────────────────────────────────

export function generateSlug(text: string, maxLength = 60): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .slice(0, maxLength)
  const suffix = Math.random().toString(36).slice(2, 7)
  return `${base}-${suffix}`
}

export function truncate(str: string, length: number, suffix = '...'): string {
  if (str.length <= length) return str
  return str.slice(0, length - suffix.length) + suffix
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function titleCase(str: string): string {
  return str.split(' ').map(capitalize).join(' ')
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`)
}

export function generateReferralCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split('@')
  const masked = user.slice(0, 2) + '*'.repeat(Math.max(0, user.length - 2))
  return `${masked}@${domain}`
}

export function maskCardNumber(last4: string): string {
  return `•••• •••• •••• ${last4}`
}

// ── NUMBER / CURRENCY UTILITIES ───────────────────────────────

export function formatCurrency(
  amount: number,
  currency = 'USD',
  locale = 'en-US',
  compact = false
): string {
  if (compact && Math.abs(amount) >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`
  }
  if (compact && Math.abs(amount) >= 1_000) {
    return `$${(amount / 1_000).toFixed(1)}K`
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(num: number, compact = false): string {
  if (compact && Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (compact && Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return new Intl.NumberFormat('en-US').format(num)
}

export function formatPercent(value: number, decimals = 2): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

export function roundTo(value: number, decimals: number): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function calcPercentChange(from: number, to: number): number {
  if (from === 0) return 0
  return roundTo(((to - from) / Math.abs(from)) * 100, 2)
}

// ── DATE UTILITIES ────────────────────────────────────────────

export function formatDate(date: string | Date, format: 'short' | 'long' | 'relative' = 'short'): string {
  const d = new Date(date)

  if (format === 'relative') {
    const diff = Date.now() - d.getTime()
    const mins = Math.floor(diff / 60_000)
    const hours = Math.floor(diff / 3_600_000)
    const days = Math.floor(diff / 86_400_000)

    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    if (days < 30) return `${Math.floor(days / 7)}w ago`
    if (days < 365) return `${Math.floor(days / 30)}mo ago`
    return `${Math.floor(days / 365)}y ago`
  }

  if (format === 'long') {
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function getStartOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function getEndOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

export function getStartOfWeek(date = new Date()): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

export function daysBetween(a: Date | string, b: Date | string): number {
  return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

export function monthsBetween(a: Date | string, b: Date | string): number {
  const da = new Date(a)
  const db = new Date(b)
  return (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth())
}

// ── VALIDATION UTILITIES ─────────────────────────────────────

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isValidURL(url: string): boolean {
  try { new URL(url); return true } catch { return false }
}

export function isValidUUID(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)
}

export function isValidStockSymbol(symbol: string): boolean {
  return /^[A-Z]{1,5}$/.test(symbol)
}

// ── FINANCIAL CALCULATIONS ─────────────────────────────────────

export function calcCompoundInterest(principal: number, rate: number, years: number, frequency = 12): number {
  return principal * Math.pow(1 + rate / frequency, frequency * years)
}

export function calcFutureValue(payment: number, rate: number, periods: number): number {
  if (rate === 0) return payment * periods
  return payment * ((Math.pow(1 + rate, periods) - 1) / rate)
}

export function calcMonthlyPayment(principal: number, annualRate: number, months: number): number {
  if (annualRate === 0) return principal / months
  const r = annualRate / 12
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}

export function calcLoanPayoff(balance: number, rate: number, payment: number): { months: number; totalInterest: number } {
  if (rate === 0) return { months: Math.ceil(balance / payment), totalInterest: 0 }
  const monthlyRate = rate / 12
  const months = Math.ceil(Math.log(payment / (payment - balance * monthlyRate)) / Math.log(1 + monthlyRate))
  return { months, totalInterest: payment * months - balance }
}

export function calcNetWorthGrowthProjection(
  currentNetWorth: number,
  monthlyContribution: number,
  annualReturn: number,
  years: number
): number[] {
  const monthlyRate = annualReturn / 12
  const projections: number[] = []

  let balance = currentNetWorth
  for (let month = 1; month <= years * 12; month++) {
    balance = balance * (1 + monthlyRate) + monthlyContribution
    if (month % 12 === 0) projections.push(Math.round(balance))
  }
  return projections
}

export function calcSavingsRate(income: number, expenses: number): number {
  if (income <= 0) return 0
  return Math.max(0, ((income - expenses) / income) * 100)
}

export function calcDebtToIncomeRatio(monthlyDebtPayments: number, monthlyGrossIncome: number): number {
  if (monthlyGrossIncome <= 0) return 0
  return (monthlyDebtPayments / monthlyGrossIncome) * 100
}

// ── OBJECT UTILITIES ─────────────────────────────────────────

export function omit<T extends Record<string, unknown>>(obj: T, keys: (keyof T)[]): Partial<T> {
  const result = { ...obj }
  keys.forEach(key => delete result[key])
  return result
}

export function pick<T extends Record<string, unknown>>(obj: T, keys: (keyof T)[]): Partial<T> {
  return keys.reduce((acc, key) => {
    if (key in obj) acc[key] = obj[key]
    return acc
  }, {} as Partial<T>)
}

export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target }
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] as T, source[key] as Partial<T>) as T[typeof key]
    } else if (source[key] !== undefined) {
      result[key] = source[key] as T[typeof key]
    }
  }
  return result
}

export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const group = String(item[key])
    if (!acc[group]) acc[group] = []
    acc[group].push(item)
    return acc
  }, {} as Record<string, T[]>)
}

export function sortBy<T>(array: T[], key: keyof T, order: 'asc' | 'desc' = 'asc'): T[] {
  return [...array].sort((a, b) => {
    const va = a[key], vb = b[key]
    const result = va < vb ? -1 : va > vb ? 1 : 0
    return order === 'asc' ? result : -result
  })
}

export function unique<T>(array: T[], key?: keyof T): T[] {
  if (!key) return [...new Set(array)]
  const seen = new Set()
  return array.filter(item => {
    const val = item[key]
    if (seen.has(val)) return false
    seen.add(val)
    return true
  })
}

// ── ASYNC UTILITIES ───────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function retry<T>(
  fn: () => Promise<T>,
  { attempts = 3, delay = 1000, backoff = 2 } = {}
): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (i < attempts - 1) await sleep(delay * Math.pow(backoff, i))
    }
  }
  throw lastError
}

export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
  )
  return Promise.race([promise, timeout])
}

// ── CRYPTO UTILITIES ─────────────────────────────────────────

export function generateSecureToken(length = 32): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}

export async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')
}

// ── PAGINATION HELPER ─────────────────────────────────────────

export function paginate<T>(array: T[], page: number, perPage: number) {
  const total = array.length
  const totalPages = Math.ceil(total / perPage)
  const from = (page - 1) * perPage
  const data = array.slice(from, from + perPage)
  return {
    data,
    total,
    page,
    per_page: perPage,
    total_pages: totalPages,
    has_next: page < totalPages,
    has_prev: page > 1,
  }
}
