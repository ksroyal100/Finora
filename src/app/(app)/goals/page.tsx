'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Target, Calendar, TrendingUp, CheckCircle, Clock, X, AlertCircle } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const CATEGORY_LABELS: Record<string, string> = {
  emergency_fund: 'Emergency Fund', home: 'Home', retirement: 'Retirement',
  vehicle: 'Vehicle', vacation: 'Vacation', investment: 'Investment',
  education: 'Education', business: 'Business', debt_payoff: 'Debt Payoff', other: 'Other',
}
const CATEGORY_ICONS: Record<string, string> = {
  emergency_fund: '🛡️', home: '🏠', retirement: '🌴', vehicle: '🚗',
  vacation: '✈️', investment: '📈', education: '🎓', business: '💼',
  debt_payoff: '💳', other: '🎯',
}
const GOAL_COLORS = ['#30D158','#0A84FF','#FF9F0A','#BF5AF2','#FF453A','#64D2FF','#FFD60A']

function Skeleton({ h = 200 }: { h?: number }) {
  return <div style={{ width:'100%', height:h, borderRadius:14, background:'var(--bg-tertiary)', animation:'pulse 1.5s ease-in-out infinite' }} />
}

export default function GoalsPage() {
  const [goals, setGoals]             = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [tab, setTab]                 = useState<'active'|'completed'>('active')
  const [showModal, setShowModal]     = useState(false)
  const [editGoal, setEditGoal]       = useState<any>(null)
  const [addProgress, setAddProgress] = useState<{ goal: any; amount: string }|null>(null)
  const [form, setForm] = useState({ title:'', category:'other', target_amount:'', current_amount:'', target_date:'', monthly_contribution:'', color:GOAL_COLORS[0] })
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError]     = useState<string|null>(null)

  const load = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data:{ user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('goals').select('*').eq('user_id', user.id).order('created_at', { ascending:false })
      setGoals(data ?? [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true); setFormError(null)
    try {
      const supabase = createClient()
      const { data:{ user } } = await supabase.auth.getUser()
      if (!user) return
      const target  = parseFloat(form.target_amount)
      const current = parseFloat(form.current_amount || '0')

      // NOTE: progress_pct is GENERATED ALWAYS AS in DB — do NOT set it
      const payload: Record<string,unknown> = {
        user_id: user.id,
        title: form.title,
        category: form.category,
        target_amount: target,
        current_amount: current,
        target_date: form.target_date || null,
        monthly_contribution: form.monthly_contribution ? parseFloat(form.monthly_contribution) : null,
        color: form.color,
        icon: CATEGORY_ICONS[form.category] ?? '🎯',
        status: 'active',
        priority: 3,
      }

      let error: any = null
      if (editGoal) {
        ({ error } = await supabase.from('goals').update(payload).eq('id', editGoal.id))
      } else {
        ({ error } = await supabase.from('goals').insert(payload))
      }
      if (error) throw error

      setShowModal(false); setEditGoal(null)
      setForm({ title:'', category:'other', target_amount:'', current_amount:'', target_date:'', monthly_contribution:'', color:GOAL_COLORS[0] })
      await load()
    } catch(e:any) { setFormError(e.message ?? 'Failed to save goal') }
    finally { setFormLoading(false) }
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    await supabase.from('goals').delete().eq('id', id)
    setGoals(g => g.filter(x => x.id !== id))
  }

  const handleMarkComplete = async (goal: any) => {
    const supabase = createClient()
    // progress_pct auto-updates since it's GENERATED from current_amount/target_amount
    await supabase.from('goals').update({ status:'completed', current_amount: goal.target_amount }).eq('id', goal.id)
    await load()
  }

  const handleAddProgress = async () => {
    if (!addProgress) return
    const amount = parseFloat(addProgress.amount)
    if (isNaN(amount) || amount <= 0) return
    const supabase = createClient()
    const newCurrent = Math.min(addProgress.goal.target_amount, (addProgress.goal.current_amount ?? 0) + amount)
    // Only update current_amount — progress_pct recalculates automatically
    await supabase.from('goals').update({ current_amount: newCurrent }).eq('id', addProgress.goal.id)
    setAddProgress(null)
    await load()
  }

  const filtered   = goals.filter(g => g.status === (tab === 'active' ? 'active' : 'completed'))

  const openEdit = (g: any) => {
    setEditGoal(g)
    setForm({ title:g.title, category:g.category, target_amount:String(g.target_amount), current_amount:String(g.current_amount??0), target_date:g.target_date??'', monthly_contribution:String(g.monthly_contribution??''), color:g.color??GOAL_COLORS[0] })
    setShowModal(true)
  }

  return (
    <div className="page-container fade-in">
      <PageHeader
        title="Goals"
        description="Track your path to financial freedom"
        actions={<button className="btn btn-green btn-md" onClick={() => { setEditGoal(null); setForm({ title:'', category:'other', target_amount:'', current_amount:'', target_date:'', monthly_contribution:'', color:GOAL_COLORS[0] }); setShowModal(true) }}><Plus size={14}/> New Goal</button>}
      />

      <div style={{ display:'flex', gap:2, marginBottom:24, background:'var(--bg-secondary)', borderRadius:12, padding:4, width:'fit-content', border:'1px solid var(--border)' }}>
        {(['active','completed'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding:'6px 16px', borderRadius:9, fontSize:13, fontWeight:500, background:tab===t?'var(--bg-tertiary)':'transparent', color:tab===t?'var(--text-primary)':'var(--text-secondary)', border:'none', cursor:'pointer', textTransform:'capitalize' }}>
            {t} ({goals.filter(g => g.status === t).length})
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:16 }}>{[1,2,3,4].map(i => <Skeleton key={i}/>)}</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0' }}>
          <Target size={40} color="var(--text-quaternary)"/>
          <p style={{ color:'var(--text-tertiary)', marginTop:10 }}>{tab==='active' ? 'No active goals.' : 'No completed goals.'}</p>
          {tab==='active' && <button className="btn btn-sm btn-green" style={{ marginTop:12 }} onClick={() => setShowModal(true)}>Create your first goal</button>}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:16 }}>
          {filtered.map(g => {
            const pct = parseFloat(g.progress_pct ?? '0')
            const monthsLeft = g.target_date ? Math.max(0, Math.ceil((new Date(g.target_date).getTime()-Date.now())/(1000*60*60*24*30))) : null
            const onTrack = g.monthly_contribution && monthsLeft ? g.monthly_contribution*monthsLeft >= (g.target_amount-(g.current_amount??0)) : false
            return (
              <div key={g.id} className="card" style={{ padding:20 }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:44, height:44, borderRadius:14, background:`${g.color??'var(--green-400)'}18`, border:`1px solid ${g.color??'var(--green-400)'}28`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>{g.icon??CATEGORY_ICONS[g.category]??'🎯'}</div>
                    <div>
                      <div style={{ fontSize:15, fontWeight:600 }}>{g.title}</div>
                      <div style={{ fontSize:12, color:'var(--text-tertiary)' }}>{CATEGORY_LABELS[g.category]??g.category}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    {g.status==='completed' ? <span className="badge badge-green"><CheckCircle size={10}/> Done</span> : onTrack ? <span className="badge badge-green"><TrendingUp size={10}/> On Track</span> : <span className="badge badge-yellow"><Clock size={10}/> Behind</span>}
                    <button onClick={() => openEdit(g)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-tertiary)', fontSize:11, padding:4 }}>Edit</button>
                    <button onClick={() => handleDelete(g.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-quaternary)', padding:4 }}><X size={13}/></button>
                  </div>
                </div>
                <div style={{ marginBottom:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                    <span style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.03em', fontVariantNumeric:'tabular-nums' }}>{formatCurrency(g.current_amount??0)}</span>
                    <span style={{ fontSize:22, fontWeight:400, letterSpacing:'-0.03em', color:'var(--text-tertiary)', fontVariantNumeric:'tabular-nums' }}>{formatCurrency(g.target_amount)}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width:`${pct}%`, background:`linear-gradient(90deg, ${g.color??'var(--green-400)'}88, ${g.color??'var(--green-400)'})` }}/>
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:4 }}>{pct.toFixed(1)}% · {formatCurrency(g.target_amount-(g.current_amount??0))} remaining</div>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', gap:10, marginTop:4 }}>
                  <div style={{ display:'flex', gap:10 }}>
                    {g.target_date && <span style={{ fontSize:12, color:'var(--text-tertiary)', display:'flex', alignItems:'center', gap:4 }}><Calendar size={11}/>{formatDate(g.target_date,'short')}{monthsLeft!==null?` · ${monthsLeft}mo`:''}</span>}
                    {g.monthly_contribution && <span style={{ fontSize:12, color:'var(--text-tertiary)' }}>{formatCurrency(g.monthly_contribution)}/mo</span>}
                  </div>
                  {g.status==='active' && (
                    <div style={{ display:'flex', gap:6 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => setAddProgress({ goal:g, amount:'' })}>+ Progress</button>
                      <button className="btn btn-sm btn-green" onClick={() => handleMarkComplete(g)}>Complete</button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Progress Modal */}
      {addProgress && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(8px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={() => setAddProgress(null)}>
          <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:20, padding:28, width:320 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize:16, fontWeight:700, margin:'0 0 16px' }}>Add Progress</h3>
            <p style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:16 }}>How much did you save toward <strong>{addProgress.goal.title}</strong>?</p>
            <input className="input-field" type="number" step="any" min="0" placeholder="Amount ($)" value={addProgress.amount} onChange={e => setAddProgress(p => p ? {...p, amount:e.target.value} : null)} style={{ marginBottom:14 }}/>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-secondary btn-md" style={{ flex:1, justifyContent:'center' }} onClick={() => setAddProgress(null)}>Cancel</button>
              <button className="btn btn-green btn-md" style={{ flex:1, justifyContent:'center' }} onClick={handleAddProgress}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* New/Edit Goal Modal */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(8px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={() => { setShowModal(false); setEditGoal(null) }}>
          <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:20, padding:28, width:'100%', maxWidth:460 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ fontSize:16, fontWeight:700, margin:0 }}>{editGoal ? 'Edit Goal' : 'New Goal'}</h3>
              <button onClick={() => { setShowModal(false); setEditGoal(null) }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-tertiary)' }}><X size={18}/></button>
            </div>
            {formError && <div style={{ padding:'10px 14px', background:'rgba(255,69,58,0.1)', borderRadius:10, color:'var(--text-red)', fontSize:13, marginBottom:16, display:'flex', gap:8, alignItems:'center' }}><AlertCircle size={14}/>{formError}</div>}
            <form onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Goal Title *</label>
                <input className="input-field" placeholder="Emergency Fund" required value={form.title} onChange={e => setForm(f => ({...f, title:e.target.value}))}/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Category</label>
                  <select className="input-field" value={form.category} onChange={e => setForm(f => ({...f, category:e.target.value}))}>
                    {Object.keys(CATEGORY_LABELS).map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Color</label>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', paddingTop:6 }}>
                    {GOAL_COLORS.map(c => <button key={c} type="button" onClick={() => setForm(f => ({...f, color:c}))} style={{ width:24, height:24, borderRadius:'50%', background:c, border:form.color===c?'2px solid #fff':'2px solid transparent', cursor:'pointer', padding:0 }}/>)}
                  </div>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Target Amount *</label>
                  <input className="input-field" type="number" step="any" placeholder="30000" required value={form.target_amount} onChange={e => setForm(f => ({...f, target_amount:e.target.value}))}/>
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Current Amount</label>
                  <input className="input-field" type="number" step="any" placeholder="0" value={form.current_amount} onChange={e => setForm(f => ({...f, current_amount:e.target.value}))}/>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Target Date</label>
                  <input className="input-field" type="date" value={form.target_date} onChange={e => setForm(f => ({...f, target_date:e.target.value}))}/>
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Monthly Contribution</label>
                  <input className="input-field" type="number" step="any" placeholder="500" value={form.monthly_contribution} onChange={e => setForm(f => ({...f, monthly_contribution:e.target.value}))}/>
                </div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:4 }}>
                <button type="button" className="btn btn-secondary btn-md" style={{ flex:1, justifyContent:'center' }} onClick={() => { setShowModal(false); setEditGoal(null) }}>Cancel</button>
                <button type="submit" className="btn btn-green btn-md" style={{ flex:1, justifyContent:'center' }} disabled={formLoading}>{formLoading ? 'Saving...' : editGoal ? 'Update Goal' : 'Create Goal'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  )
}
