'use client'
import Link from 'next/link'
import { Receipt, Target, SlidersHorizontal, Activity, Bot } from 'lucide-react'

// One-click shortcuts to the things people do most. Pure navigation, no data.
const ACTIONS = [
  { href: '/budgeting', label: 'Log spending', icon: Receipt, color: 'var(--text-green)' },
  { href: '/goals', label: 'Add a goal', icon: Target, color: 'var(--text-blue)' },
  { href: '/simulator', label: 'Run a what-if', icon: SlidersHorizontal, color: 'var(--text-gold)' },
  { href: '/performance', label: 'Live terminal', icon: Activity, color: 'var(--text-orange)' },
  { href: '/ai-coach', label: 'Ask AI coach', icon: Bot, color: 'var(--text-yellow)' },
] as const

export function QuickActions() {
  return (
    <nav aria-label="Quick actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
      {ACTIONS.map(({ href, label, icon: Icon, color }) => (
        <Link key={href} href={href} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 999, textDecoration: 'none',
          fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        }}>
          <Icon size={15} style={{ color }} />{label}
        </Link>
      ))}
    </nav>
  )
}
