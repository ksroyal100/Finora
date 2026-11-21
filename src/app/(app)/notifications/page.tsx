'use client'
import { useState, useEffect, useCallback } from 'react'
import { Bell, Check, Trash2, CheckCheck, AlertCircle, TrendingUp, Target, DollarSign, Zap, Info } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { createClient } from '@/lib/supabase/client'

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  alert:     { icon: <AlertCircle size={14}/>, color: 'var(--text-red)' },
  success:   { icon: <Check size={14}/>,       color: 'var(--text-green)' },
  info:      { icon: <Info size={14}/>,         color: 'var(--text-blue)' },
  portfolio: { icon: <TrendingUp size={14}/>,  color: 'var(--text-blue)' },
  goal:      { icon: <Target size={14}/>,       color: '#BF5AF2' },
  budget:    { icon: <DollarSign size={14}/>,  color: 'var(--text-orange)' },
  ai:        { icon: <Zap size={14}/>,          color: 'var(--text-green)' },
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const load = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      setNotifications(data ?? [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const markRead = async (id: string) => {
    const supabase = createClient()
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id)
    setNotifications(n => n.map(x => x.id === id ? { ...x, is_read: true } : x))
  }

  const markAllRead = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('user_id', user.id).eq('is_read', false)
    setNotifications(n => n.map(x => ({ ...x, is_read: true })))
  }

  const deleteNotif = async (id: string) => {
    const supabase = createClient()
    await supabase.from('notifications').delete().eq('id', id)
    setNotifications(n => n.filter(x => x.id !== id))
  }

  const clearAll = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('notifications').delete().eq('user_id', user.id)
    setNotifications([])
  }

  const filtered = filter === 'unread' ? notifications.filter(n => !n.is_read) : notifications
  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="page-container fade-in">
      <PageHeader
        title="Notifications"
        description={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {unreadCount > 0 && (
              <button className="btn btn-secondary btn-md" onClick={markAllRead}>
                <CheckCheck size={14}/> Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <button className="btn btn-secondary btn-md" onClick={clearAll} style={{ color: 'var(--text-red)' }}>
                <Trash2 size={14}/> Clear all
              </button>
            )}
          </div>
        }
      />

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: 'var(--bg-secondary)', borderRadius: 12, padding: 4, width: 'fit-content', border: '1px solid var(--border)' }}>
        {(['all', 'unread'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 16px', borderRadius: 9, fontSize: 13, fontWeight: 500, background: filter === f ? 'var(--bg-tertiary)' : 'transparent', color: filter === f ? 'var(--text-primary)' : 'var(--text-secondary)', border: 'none', cursor: 'pointer', textTransform: 'capitalize' }}>
            {f === 'unread' ? `Unread (${unreadCount})` : 'All'}
          </button>
        ))}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-tertiary)', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ height: 14, background: 'var(--bg-tertiary)', borderRadius: 4, marginBottom: 6, animation: 'pulse 1.5s ease-in-out infinite', width: '60%' }}/>
                  <div style={{ height: 12, background: 'var(--bg-tertiary)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite', width: '80%' }}/>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <Bell size={40} color="var(--text-quaternary)" />
            <p style={{ color: 'var(--text-tertiary)', marginTop: 10, fontSize: 14 }}>
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
          </div>
        ) : (
          filtered.map((n, i) => {
            const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info
            return (
              <div
                key={n.id}
                onClick={() => !n.is_read && markRead(n.id)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 20px', borderBottom: i < filtered.length - 1 ? '1px solid var(--separator)' : 'none', background: !n.is_read ? 'rgba(48,209,88,0.03)' : 'transparent', cursor: !n.is_read ? 'pointer' : 'default', transition: 'background var(--transition-fast)' }}
              >
                {!n.is_read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green-400)', flexShrink: 0, marginTop: 5 }}/>}
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${cfg.color}18`, border: `1px solid ${cfg.color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color, flexShrink: 0, marginLeft: n.is_read ? 20 : 0 }}>
                  {cfg.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: n.is_read ? 400 : 600, marginBottom: 3 }}>{n.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{n.body}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{timeAgo(n.created_at)}</div>
                </div>
                <button onClick={e => { e.stopPropagation(); deleteNotif(n.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-quaternary)', padding: 4, flexShrink: 0 }} title="Delete">
                  <Trash2 size={13}/>
                </button>
              </div>
            )
          })
        )}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  )
}
