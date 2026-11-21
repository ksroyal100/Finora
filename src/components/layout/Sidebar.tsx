'use client'

import { FinoraGlyph } from '@/components/brand/FinoraGlyph'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, TrendingUp, Target, DollarSign,
  Calculator, Bot, GraduationCap, Users, Search,
  ShoppingBag, BookOpen, Bell, Settings, CreditCard,
  LogOut, ChevronRight, Menu, X, Wrench, FileDown, Mail, Activity, SlidersHorizontal
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const NAV_SECTIONS = [
  {
    label: 'Wealth',
    items: [
      { href: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/portfolio',   icon: TrendingUp,      label: 'Portfolio' },
      { href: '/goals',       icon: Target,          label: 'Goals' },
      { href: '/net-worth',   icon: DollarSign,      label: 'Net Worth' },
      { href: '/reports',     icon: FileDown,        label: 'Reports' },
      { href: '/budgeting',   icon: Calculator,      label: 'Budgeting' },
      { href: '/financial-toolkit', icon: Wrench,    label: 'Financial Toolkit', badge: 'New' },
      { href: '/simulator', icon: SlidersHorizontal, label: 'What-If Simulator', badge: 'New' },
      { href: '/performance', icon: Activity,       label: 'Performance Terminal', badge: 'Live' },
    ],
  },
  {
    label: 'AI & Learning',
    items: [
      { href: '/ai-coach',    icon: Bot,             label: 'AI Coach',       badge: 'Free' },
      { href: '/learning',    icon: GraduationCap,   label: 'Learning Hub' },
      { href: '/research',    icon: Search,          label: 'Research',       badge: 'Pro' },
    ],
  },
  {
    label: 'Community',
    items: [
      { href: '/community',   icon: Users,           label: 'Community' },
      { href: '/newsletter',  icon: Mail,            label: 'Newsletter' },
      { href: '/marketplace', icon: ShoppingBag,     label: 'Marketplace' },
      { href: '/library',     icon: BookOpen,        label: 'My Library' },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/notifications', icon: Bell,         label: 'Notifications' },
      { href: '/billing',       icon: CreditCard,   label: 'Billing' },
      { href: '/settings',      icon: Settings,     label: 'Settings' },
    ],
  },
]

interface SidebarProps {
  user?: { display_name?: string; email?: string; avatar_url?: string; plan?: string }
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const planColor = {
    free: 'badge-gray',
    pro: 'badge-green',
    plus: 'badge-green',
    elite: 'badge-yellow',
  }[user?.plan ?? 'free'] ?? 'badge-gray'

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(v => !v)}
        className="fixed top-4 left-4 z-50 lg:hidden btn btn-md btn-secondary"
        style={{ width: 40, height: 40, padding: 0 }}
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'sidebar transition-transform duration-300',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div style={{ padding: '20px 20px 12px' }}>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--green-400)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <FinoraGlyph size={16} />
            </div>
            <span style={{
              fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
            }}>
              Finora
            </span>
          </Link>
        </div>

        {/* Nav sections */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px', paddingBottom: 8 }}>
          {NAV_SECTIONS.map(section => (
            <div key={section.label}>
              <div className="nav-section-label">{section.label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {section.items.map(item => {
                  const isActive = pathname === item.href ||
                    (item.href !== '/dashboard' && pathname.startsWith(item.href))
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn('nav-item', isActive && 'active')}
                      onClick={() => setMobileOpen(false)}
                    >
                      <item.icon
                        size={16}
                        className="nav-icon"
                        strokeWidth={isActive ? 2 : 1.75}
                        style={{ flexShrink: 0 }}
                      />
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {item.badge && (
                        <span className={cn(
                          'badge',
                          item.badge === 'Pro' || item.badge === 'New' ? 'badge-green' : 'badge-gray'
                        )} style={{ fontSize: 10, padding: '1px 6px' }}>
                          {item.badge}
                        </span>
                      )}
                      {isActive && <ChevronRight size={12} style={{ opacity: 0.4 }} />}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* User card at bottom */}
        <div style={{ padding: '12px', borderTop: '1px solid var(--separator)' }}>
          {/* Upgrade nudge for free plan */}
          {(!user?.plan || user.plan === 'free') && (
            <Link
              href="/billing"
              style={{
                display: 'block',
                padding: '10px 12px',
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--text-green) 12%, transparent), color-mix(in srgb, var(--text-green) 8%, transparent))',
                border: '1px solid color-mix(in srgb, var(--text-green) 18%, transparent)',
                borderRadius: 10,
                marginBottom: 10,
                textDecoration: 'none',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-green)', marginBottom: 2 }}>
                ✦ Upgrade to Pro
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                Unlock unlimited access
              </div>
            </Link>
          )}

          {/* User info */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px',
            borderRadius: 10,
            cursor: 'pointer',
            transition: 'background var(--transition-fast)',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--overlay-subtle)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: user?.avatar_url ? undefined : 'var(--green-600)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 600, color: '#fff',
              overflow: 'hidden', flexShrink: 0,
            }}>
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                (user?.display_name ?? user?.email ?? 'U').charAt(0).toUpperCase()
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.display_name ?? 'Wealth Builder'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span className={cn('badge', planColor)} style={{ fontSize: 10, padding: '1px 6px' }}>
                  {(user?.plan ?? 'free').toUpperCase()}
                </span>
              </div>
            </div>
            <LogOut size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          </div>
        </div>
      </aside>
    </>
  )
}
