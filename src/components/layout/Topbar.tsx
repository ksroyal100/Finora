'use client'

import { Bell, Search, Command, Sun, Moon } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/components/providers/ThemeProvider'

interface TopbarProps {
  user?: { display_name?: string; email?: string; avatar_url?: string; plan?: string }
}

export function Topbar({ user }: TopbarProps) {
  const [searchFocused, setSearchFocused] = useState(false)
  const { theme, toggleTheme } = useTheme()

  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: 'var(--sidebar-width)',
      right: 0,
      height: 'var(--topbar-height)',
      background: 'var(--glass-bg)',
      backdropFilter: 'var(--blur-md)',
      WebkitBackdropFilter: 'var(--blur-md)',
      borderBottom: '1px solid var(--separator)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: 16,
      zIndex: 90,
    }}>
      {/* Search bar */}
      <div style={{
        flex: 1,
        maxWidth: 480,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
      }}>
        <Search
          size={14}
          style={{
            position: 'absolute', left: 12,
            color: searchFocused ? 'var(--green-400)' : 'var(--text-tertiary)',
            transition: 'color var(--transition-fast)',
          }}
        />
        <input
          type="search"
          placeholder="Search anything..."
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={{
            width: '100%',
            height: 34,
            padding: '0 36px 0 34px',
            background: 'var(--bg-secondary)',
            border: `1px solid ${searchFocused ? 'var(--border-active)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontSize: 13,
            letterSpacing: '-0.005em',
            outline: 'none',
            transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
            boxShadow: searchFocused ? '0 0 0 3px var(--green-glow)' : 'none',
          }}
        />
        <div style={{
          position: 'absolute', right: 10,
          display: 'flex', alignItems: 'center', gap: 2,
          opacity: 0.35, pointerEvents: 'none',
        }}>
          <Command size={11} />
          <span style={{ fontSize: 11, fontFamily: 'var(--font-system)' }}>K</span>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        style={{
          width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--bg-tertiary)'
          e.currentTarget.style.color = 'var(--text-primary)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'var(--bg-secondary)'
          e.currentTarget.style.color = 'var(--text-secondary)'
        }}
      >
        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      {/* Notifications */}
      <Link
        href="/notifications"
        style={{
          position: 'relative',
          width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-secondary)',
          textDecoration: 'none',
          transition: 'all var(--transition-fast)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--bg-tertiary)'
          e.currentTarget.style.color = 'var(--text-primary)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'var(--bg-secondary)'
          e.currentTarget.style.color = 'var(--text-secondary)'
        }}
        aria-label="Notifications"
      >
        <Bell size={16} />
        {/* Unread badge */}
        <span style={{
          position: 'absolute', top: 6, right: 6,
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--green-400)',
          border: '1.5px solid var(--bg-base)',
        }} />
      </Link>

      {/* Avatar */}
      <Link href="/settings" style={{ textDecoration: 'none' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: user?.avatar_url ? undefined : 'var(--green-600)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 600, color: '#fff',
          overflow: 'hidden', cursor: 'pointer',
          border: '1.5px solid var(--border)',
          transition: 'border-color var(--transition-fast)',
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--green-400)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          {user?.avatar_url
            ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (user?.display_name ?? 'U').charAt(0).toUpperCase()
          }
        </div>
      </Link>
    </header>
  )
}
