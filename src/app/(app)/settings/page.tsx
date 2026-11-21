'use client'
import { useState, useEffect, useCallback } from 'react'
import { User, Bell, Shield, CreditCard, LogOut, Check, AlertCircle, Camera, Sun, Moon } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { DeleteAccountModal } from '@/components/settings/DeleteAccountModal'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/components/providers/ThemeProvider'

const TIMEZONES = ['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','Europe/London','Europe/Paris','Europe/Berlin','Asia/Tokyo','Asia/Shanghai','Asia/Singapore','Australia/Sydney']
const CURRENCIES = ['USD','EUR','GBP','JPY','CAD','AUD','CHF','INR','SGD','CNY']
type Section = 'profile'|'appearance'|'notifications'|'security'|'billing'

// DB column names from 001_core_schema.sql notification_preferences table:
// email_enabled, push_enabled, in_app_enabled
// goal_notifications, portfolio_notifications, ai_coach_notifications
// weekly_digest, marketing_emails, billing_notifications
// community_notifications, learning_notifications, security_notifications
type NotifPrefs = {
  email_enabled: boolean
  push_enabled: boolean
  in_app_enabled: boolean
  goal_notifications: boolean
  portfolio_notifications: boolean
  ai_coach_notifications: boolean
  weekly_digest: boolean
  marketing_emails: boolean
  billing_notifications: boolean
  community_notifications: boolean
  learning_notifications: boolean
  security_notifications: boolean
}

const DEFAULT_NOTIF: NotifPrefs = {
  email_enabled: true, push_enabled: true, in_app_enabled: true,
  goal_notifications: true, portfolio_notifications: true,
  ai_coach_notifications: false, weekly_digest: true,
  marketing_emails: false, billing_notifications: true,
  community_notifications: true, learning_notifications: true,
  security_notifications: true,
}

export default function SettingsPage() {
  const [section, setSection]   = useState<Section>('profile')
  const { theme, setTheme }     = useTheme()
  const [profile, setProfile]   = useState<any>(null)
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF)
  const [loading, setLoading]   = useState(true)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState<string|null>(null)
  const [form, setForm] = useState({ display_name:'', username:'', bio:'', location:'', timezone:'America/New_York', currency:'USD' })
  const router = useRouter()

  const load = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data:{ user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: p }, { data: n }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('notification_preferences').select('*').eq('user_id', user.id).single(),
      ])
      setProfile(p)
      if (p) setForm(f => ({ ...f, display_name: p.display_name??'', username: p.username??'', bio: p.bio??'', location: p.location??'', timezone: p.timezone??'America/New_York', currency: p.currency??'USD' }))
      if (n) {
        setNotifPrefs({
          email_enabled:         n.email_enabled         ?? true,
          push_enabled:          n.push_enabled          ?? true,
          in_app_enabled:        n.in_app_enabled        ?? true,
          goal_notifications:    n.goal_notifications    ?? true,
          portfolio_notifications: n.portfolio_notifications ?? true,
          ai_coach_notifications: n.ai_coach_notifications ?? false,
          weekly_digest:         n.weekly_digest         ?? true,
          marketing_emails:      n.marketing_emails      ?? false,
          billing_notifications: n.billing_notifications ?? true,
          community_notifications: n.community_notifications ?? true,
          learning_notifications: n.learning_notifications ?? true,
          security_notifications: n.security_notifications ?? true,
        })
      }
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 2500) }

  const saveProfile = async () => {
    setSaving(true); setError(null)
    try {
      const supabase = createClient()
      const { data:{ user } } = await supabase.auth.getUser()
      if (!user) return
      const { error: e } = await supabase
        .from('profiles')
        .update({ display_name: form.display_name, username: form.username||null, bio: form.bio||null, location: form.location||null, timezone: form.timezone, currency: form.currency })
        .eq('id', user.id)
      if (e) throw e
      flash()
    } catch(e:any) { setError(e.message ?? 'Failed to save') }
    finally { setSaving(false) }
  }

  const saveNotifications = async () => {
    setSaving(true); setError(null)
    try {
      const supabase = createClient()
      const { data:{ user } } = await supabase.auth.getUser()
      if (!user) return
      const { error: e } = await supabase.from('notification_preferences').upsert({ user_id: user.id, ...notifPrefs }, { onConflict:'user_id' })
      if (e) throw e
      flash()
    } catch(e:any) { setError(e.message ?? 'Failed to save') }
    finally { setSaving(false) }
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/signin')
    router.refresh()
  }

  const changePassword = async () => {
    const supabase = createClient()
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user?.email) return
    await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/api/auth/callback?next=/update-password&purpose=password_reset` })
    alert('Password reset email sent to ' + user.email)
  }

  const Toggle = ({ val, onChange }: { val: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!val)} style={{ width:44, height:26, borderRadius:13, background:val?'var(--green-400)':'var(--bg-quaternary)', border:'none', cursor:'pointer', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
      <div style={{ position:'absolute', top:3, left:val?21:3, width:20, height:20, borderRadius:'50%', background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
    </button>
  )

  const NAV = [
    { id:'profile'       as Section, label:'Profile',       icon:'👤' },
    { id:'appearance'    as Section, label:'Appearance',    icon:'🎨' },
    { id:'notifications' as Section, label:'Notifications', icon:'🔔' },
    { id:'security'      as Section, label:'Security',      icon:'🔒' },
    { id:'billing'       as Section, label:'Billing',       icon:'💳' },
  ]

  const NOTIF_ITEMS: { key: keyof NotifPrefs; label: string; desc: string }[] = [
    { key:'email_enabled',           label:'Email Notifications',    desc:'Receive notifications via email' },
    { key:'push_enabled',            label:'Push Notifications',     desc:'Browser push alerts' },
    { key:'in_app_enabled',          label:'In-App Notifications',   desc:'Notifications inside Finora' },
    { key:'goal_notifications',      label:'Goal Milestones',        desc:'When you hit a goal milestone' },
    { key:'portfolio_notifications', label:'Portfolio Alerts',       desc:'Significant portfolio changes' },
    { key:'billing_notifications',   label:'Billing Alerts',         desc:'Payment and subscription updates' },
    { key:'ai_coach_notifications',  label:'AI Coach Updates',       desc:'New insights from your AI coach' },
    { key:'community_notifications', label:'Community Activity',     desc:'Replies, likes, and mentions' },
    { key:'learning_notifications',  label:'Learning Updates',       desc:'Course updates and new content' },
    { key:'weekly_digest',           label:'Weekly Digest',          desc:'Weekly financial summary email' },
    { key:'marketing_emails',        label:'Product Updates',        desc:'New features and announcements' },
    { key:'security_notifications',  label:'Security Alerts',        desc:'Login attempts and account changes' },
  ]

  return (
    <div className="page-container fade-in">
      <PageHeader title="Settings" description="Manage your account and preferences"/>

      <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:16 }}>
        {/* Nav */}
        <div className="card" style={{ padding:8, height:'fit-content' }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => { setSection(n.id); setError(null); setSaved(false) }} style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10, background:section===n.id?'rgba(48,209,88,0.1)':'transparent', border:section===n.id?'1px solid rgba(48,209,88,0.15)':'1px solid transparent', cursor:'pointer', color:section===n.id?'var(--green-400)':'var(--text-secondary)', fontWeight:500, fontSize:13, textAlign:'left', marginBottom:2 }}>
              <span>{n.icon}</span>{n.label}
            </button>
          ))}
          <div style={{ borderTop:'1px solid var(--separator)', marginTop:8, paddingTop:8 }}>
            <button onClick={handleSignOut} style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10, background:'transparent', border:'1px solid transparent', cursor:'pointer', color:'var(--text-red)', fontWeight:500, fontSize:13 }}>
              <LogOut size={15}/> Sign Out
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="card" style={{ padding:28 }}>
          {error   && <div style={{ display:'flex', gap:8, alignItems:'center', padding:'10px 14px', background:'rgba(255,69,58,0.1)', borderRadius:10, marginBottom:16, color:'var(--text-red)', fontSize:13 }}><AlertCircle size={14}/>{error}</div>}
          {saved   && <div style={{ display:'flex', gap:8, alignItems:'center', padding:'10px 14px', background:'rgba(48,209,88,0.1)', borderRadius:10, marginBottom:16, color:'var(--text-green)', fontSize:13 }}><Check size={14}/>Saved successfully</div>}

          {section==='profile' && (
            <div>
              <h3 style={{ fontSize:16, fontWeight:700, margin:'0 0 20px' }}>Profile Settings</h3>
              {loading ? <div style={{ height:300, background:'var(--bg-tertiary)', borderRadius:10, animation:'pulse 1.5s ease-in-out infinite' }}/> : (
                <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:8 }}>
                    <div style={{ position:'relative' }}>
                      <div style={{ width:72, height:72, borderRadius:20, background:'linear-gradient(135deg,#2FD968,#0058CC)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:700, color:'#fff', overflow:'hidden' }}>
                        {profile?.avatar_url ? <img src={profile.avatar_url} alt="avatar" style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : (form.display_name?.[0]?.toUpperCase() ?? '?')}
                      </div>
                      <div style={{ position:'absolute', bottom:-4, right:-4, width:24, height:24, borderRadius:'50%', background:'var(--bg-tertiary)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <Camera size={12} color="var(--text-secondary)"/>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize:16, fontWeight:600 }}>{form.display_name || 'Your Name'}</div>
                      <div style={{ fontSize:13, color:'var(--text-tertiary)' }}>{profile?.email ?? ''}</div>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                    <div><label style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Display Name</label><input className="input-field" value={form.display_name} onChange={e => setForm(f => ({...f, display_name:e.target.value}))}/></div>
                    <div><label style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Username</label><input className="input-field" value={form.username} onChange={e => setForm(f => ({...f, username:e.target.value}))} placeholder="@username"/></div>
                  </div>
                  <div><label style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Bio</label><textarea className="input-field" rows={3} value={form.bio} onChange={e => setForm(f => ({...f, bio:e.target.value}))} placeholder="A short bio..." style={{ resize:'vertical' }}/></div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
                    <div><label style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Location</label><input className="input-field" value={form.location} onChange={e => setForm(f => ({...f, location:e.target.value}))} placeholder="New York, NY"/></div>
                    <div><label style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Timezone</label><select className="input-field" value={form.timezone} onChange={e => setForm(f => ({...f, timezone:e.target.value}))}>{TIMEZONES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
                    <div><label style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Currency</label><select className="input-field" value={form.currency} onChange={e => setForm(f => ({...f, currency:e.target.value}))}>{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                  </div>
                  <div style={{ display:'flex', justifyContent:'flex-end', marginTop:8 }}>
                    <button className="btn btn-green btn-md" onClick={saveProfile} disabled={saving}>{saving?'Saving...':'Save Profile'}</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {section==='notifications' && (
            <div>
              <h3 style={{ fontSize:16, fontWeight:700, margin:'0 0 20px' }}>Notification Preferences</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {NOTIF_ITEMS.map((item, i) => (
                  <div key={item.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0', borderBottom:i<NOTIF_ITEMS.length-1?'1px solid var(--separator)':'none' }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:500 }}>{item.label}</div>
                      <div style={{ fontSize:12, color:'var(--text-tertiary)', marginTop:2 }}>{item.desc}</div>
                    </div>
                    <Toggle val={notifPrefs[item.key]} onChange={v => setNotifPrefs(p => ({...p, [item.key]:v}))}/>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', justifyContent:'flex-end', marginTop:20 }}>
                <button className="btn btn-green btn-md" onClick={saveNotifications} disabled={saving}>{saving?'Saving...':'Save Preferences'}</button>
              </div>
            </div>
          )}

          {section==='appearance' && (
            <div>
              <h3 style={{ fontSize:16, fontWeight:700, margin:'0 0 6px' }}>Appearance</h3>
              <p style={{ fontSize:13, color:'var(--text-secondary)', margin:'0 0 20px' }}>Choose how Finora looks. Your choice is saved to this device.</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, maxWidth:480 }}>
                {([
                  { id:'dark' as const,  label:'Dark',  desc:'Rich black with a vivid green accent — the premium default', icon:Moon, bg:'#050607', card:'#1A1C1F', text:'rgba(255,255,255,0.9)' },
                  { id:'light' as const, label:'Light', desc:'Warm, soft tones — comfortable in bright rooms',        icon:Sun,  bg:'#EAE8E3', card:'#FBFAF7', text:'rgba(20,22,28,0.85)' },
                ]).map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setTheme(opt.id)}
                    style={{
                      textAlign:'left', cursor:'pointer', padding:0, overflow:'hidden',
                      borderRadius:14,
                      border: theme===opt.id ? '2px solid var(--green-400)' : '1px solid var(--border)',
                      background:'var(--bg-tertiary)',
                    }}
                  >
                    {/* Mini preview */}
                    <div style={{ height:84, background:opt.bg, padding:12, display:'flex', flexDirection:'column', gap:6 }}>
                      <div style={{ width:'60%', height:8, borderRadius:4, background:opt.card }}/>
                      <div style={{ width:'85%', height:8, borderRadius:4, background:opt.card }}/>
                      <div style={{ flex:1 }}/>
                      <div style={{ width:28, height:8, borderRadius:4, background:'var(--green-400)' }}/>
                    </div>
                    <div style={{ padding:'12px 14px', display:'flex', alignItems:'flex-start', gap:10 }}>
                      <opt.icon size={16} color={theme===opt.id ? 'var(--text-green)' : 'var(--text-secondary)'} style={{ marginTop:2, flexShrink:0 }}/>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:14, fontWeight:600 }}>{opt.label}</span>
                          {theme===opt.id && <Check size={13} color="var(--text-green)"/>}
                        </div>
                        <div style={{ fontSize:12, color:'var(--text-tertiary)', marginTop:2, lineHeight:1.4 }}>{opt.desc}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {section==='security' && (
            <div>
              <h3 style={{ fontSize:16, fontWeight:700, margin:'0 0 20px' }}>Security</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div style={{ padding:20, background:'var(--bg-tertiary)', borderRadius:14 }}>
                  <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>Password</div>
                  <div style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:14 }}>Change your account password. We'll send a reset link to your email.</div>
                  <button className="btn btn-secondary btn-md" onClick={changePassword}><Shield size={14}/> Send Reset Link</button>
                </div>
                <div style={{ padding:20, background:'rgba(255,69,58,0.05)', borderRadius:14, border:'1px solid rgba(255,69,58,0.15)' }}>
                  <div style={{ fontSize:14, fontWeight:600, marginBottom:6, color:'var(--text-red)' }}>Danger Zone</div>
                  <div style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:14 }}>Once you delete your account, all data is permanently removed.</div>
                  <button className="btn btn-md" style={{ background:'rgba(255,69,58,0.1)', color:'var(--text-red)', border:'1px solid rgba(255,69,58,0.2)' }} onClick={() => setDeleteModalOpen(true)}>Delete Account</button>
                </div>
                <div style={{ padding:20, background:'var(--bg-tertiary)', borderRadius:14 }}>
                  <div style={{ fontSize:14, fontWeight:600, marginBottom:10 }}>Legal & Support</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <a href="/legal/privacy" style={{ fontSize:13, color:'var(--text-secondary)', textDecoration:'none' }}>Privacy Policy</a>
                    <a href="/legal/terms" style={{ fontSize:13, color:'var(--text-secondary)', textDecoration:'none' }}>Terms of Service</a>
                    <a href="/legal/disclaimer" style={{ fontSize:13, color:'var(--text-secondary)', textDecoration:'none' }}>Financial Disclaimer</a>
                    <a href="/legal/refund-policy" style={{ fontSize:13, color:'var(--text-secondary)', textDecoration:'none' }}>Refund &amp; Cancellation Policy</a>
                    <a href="/legal/cookies" style={{ fontSize:13, color:'var(--text-secondary)', textDecoration:'none' }}>Cookie Policy</a>
                    <a href="/legal/acceptable-use" style={{ fontSize:13, color:'var(--text-secondary)', textDecoration:'none' }}>Acceptable Use Policy</a>
                    <a href="/legal/copyright" style={{ fontSize:13, color:'var(--text-secondary)', textDecoration:'none' }}>Copyright Notice</a>
                    <a href="/contact" style={{ fontSize:13, color:'var(--text-secondary)', textDecoration:'none' }}>Contact Support</a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {section==='billing' && (
            <div>
              <h3 style={{ fontSize:16, fontWeight:700, margin:'0 0 20px' }}>Billing</h3>
              <div style={{ padding:20, background:'var(--bg-tertiary)', borderRadius:14, textAlign:'center' }}>
                <CreditCard size={32} color="var(--text-quaternary)" style={{ marginBottom:12 }}/>
                <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>Manage Billing</div>
                <div style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:14 }}>View invoices, manage your subscription, and update payment methods.</div>
                <a href="/billing" className="btn btn-green btn-md" style={{ display:'inline-flex' }}>Go to Billing</a>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
      <DeleteAccountModal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} />
    </div>
  )
}
