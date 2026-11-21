'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, AlertCircle, X, DollarSign } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const CAT_ICONS = ['🏠','🍔','🚗','🎬','🏥','📱','🛍️','💰','✈️','🎓','💡','🐕','💄','🍷','🎮','📚','🏋️','🎸']

export default function BudgetingPage() {
  const [budget, setBudget] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCatModal, setShowCatModal] = useState(false)
  const [showTxModal, setShowTxModal] = useState(false)
  const [catForm, setCatForm] = useState({ name: '', icon: '🏠', color: 'var(--text-green)', budgeted_amount: '' })
  const [txForm, setTxForm] = useState({ description: '', amount: '', is_income: false, category_id: '', date: new Date().toISOString().split('T')[0], notes: '' })
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string|null>(null)

  const load = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const now = new Date()
      const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`

      // Get or create budget for this month
      let { data: b } = await supabase.from('budgets').select('*').eq('user_id', user.id).eq('period', 'monthly').eq('is_active', true).single()
      if (!b) {
        const { data: nb } = await supabase.from('budgets').insert({ user_id: user.id, period: 'monthly', start_date: `${month}-01`, is_active: true, total_income: 0, total_spent: 0, total_budgeted: 0 }).select().single()
        b = nb
      }
      setBudget(b)

      const [cats, txs] = await Promise.all([
        supabase.from('budget_categories').select('*').eq('user_id', user.id).eq('budget_id', b?.id ?? '').order('name'),
        supabase.from('budget_transactions').select('*, budget_categories!category_id(name,icon,color)').eq('user_id', user.id).order('date', { ascending: false }).limit(30),
      ])
      setCategories(cats.data ?? [])
      setTransactions(txs.data ?? [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !budget) return
      const { error } = await supabase.from('budget_categories').insert({ user_id: user.id, budget_id: budget.id, name: catForm.name, icon: catForm.icon, color: catForm.color, budgeted_amount: parseFloat(catForm.budgeted_amount), spent_amount: 0 })
      if (error) throw error
      setShowCatModal(false)
      setCatForm({ name: '', icon: '🏠', color: 'var(--text-green)', budgeted_amount: '' })
      await load()
    } catch(e:any) { setFormError(e.message ?? 'Failed') }
    finally { setFormLoading(false) }
  }

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !budget) return
      const amt = parseFloat(txForm.amount)
      const { error } = await supabase.from('budget_transactions').insert({ user_id: user.id, budget_id: budget.id, category_id: txForm.category_id || null, description: txForm.description, amount: amt, is_income: txForm.is_income, date: txForm.date, notes: txForm.notes || null })
      if (error) throw error
      // Update category spent amount
      if (txForm.category_id && !txForm.is_income) {
        const cat = categories.find(c => c.id === txForm.category_id)
        if (cat) await supabase.from('budget_categories').update({ spent_amount: (cat.spent_amount ?? 0) + amt }).eq('id', cat.id)
      }
      // Update budget totals
      const incomeChange = txForm.is_income ? amt : 0
      const spentChange = txForm.is_income ? 0 : amt
      await supabase.from('budgets').update({ total_income: (budget.total_income ?? 0) + incomeChange, total_spent: (budget.total_spent ?? 0) + spentChange }).eq('id', budget.id)
      setShowTxModal(false)
      setTxForm({ description: '', amount: '', is_income: false, category_id: '', date: new Date().toISOString().split('T')[0], notes: '' })
      await load()
    } catch(e:any) { setFormError(e.message ?? 'Failed') }
    finally { setFormLoading(false) }
  }

  const deleteTransaction = async (id: string) => {
    const supabase = createClient()
    await supabase.from('budget_transactions').delete().eq('id', id)
    setTransactions(t => t.filter(x => x.id !== id))
  }

  const totalBudgeted = categories.reduce((s,c) => s + (c.budgeted_amount ?? 0), 0)
  const totalSpent = categories.reduce((s,c) => s + (c.spent_amount ?? 0), 0)
  const income = budget?.total_income ?? 0
  const savingsRate = income > 0 ? ((income - totalSpent) / income * 100).toFixed(1) : '0.0'

  const COLORS = ['#30D158','#0A84FF','#FF9F0A','#BF5AF2','#FF453A','#64D2FF','#FFD60A','#FF6B35']

  return (
    <div className="page-container fade-in">
      <PageHeader title="Budgeting" description="Track spending across all categories"
        actions={<div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary btn-md" onClick={() => { setShowCatModal(true); setFormError(null) }}><Plus size={14}/> Category</button>
          <button className="btn btn-green btn-md" onClick={() => { setShowTxModal(true); setFormError(null) }}><Plus size={14}/> Transaction</button>
        </div>}
      />

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
        {[
          { label:'Monthly Income', value:formatCurrency(income), color:'var(--text-green)' },
          { label:'Total Spent', value:formatCurrency(totalSpent), color:'var(--text-primary)' },
          { label:'Remaining', value:formatCurrency(Math.max(0, income - totalSpent)), color: income > totalSpent ? 'var(--text-green)' : 'var(--text-red)' },
          { label:'Savings Rate', value:`${savingsRate}%`, color:'var(--text-blue)' },
        ].map(m => (
          <div key={m.label} className="card" style={{ padding:20 }}>
            <div style={{ fontSize:12, color:'var(--text-tertiary)', marginBottom:6 }}>{m.label}</div>
            <div style={{ fontSize:24, fontWeight:700, letterSpacing:'-0.02em', color:m.color, fontVariantNumeric:'tabular-nums' }}>{m.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Categories */}
        <div className="card" style={{ overflow:'hidden' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--separator)', fontSize:13, fontWeight:600 }}>Categories ({categories.length})</div>
          {loading ? <div style={{ padding:20 }}><div style={{ height:200, background:'var(--bg-tertiary)', borderRadius:8, animation:'pulse 1.5s ease-in-out infinite' }}/></div>
          : categories.length === 0 ? (
            <div style={{ padding:40, textAlign:'center' }}>
              <DollarSign size={32} color="var(--text-quaternary)" />
              <p style={{ color:'var(--text-tertiary)', fontSize:13, marginTop:8 }}>No budget categories yet.</p>
              <button className="btn btn-sm btn-green" style={{ marginTop:8 }} onClick={() => setShowCatModal(true)}>Add Category</button>
            </div>
          ) : categories.map((cat, i) => {
            const pct = cat.budgeted_amount > 0 ? Math.min(100, (cat.spent_amount / cat.budgeted_amount) * 100) : 0
            const over = cat.spent_amount > cat.budgeted_amount
            return (
              <div key={cat.id} style={{ padding:'12px 20px', borderBottom:i<categories.length-1?'1px solid var(--separator)':'none' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                  <span style={{ fontSize:18 }}>{cat.icon ?? '💰'}</span>
                  <span style={{ fontSize:13, fontWeight:500, flex:1 }}>{cat.name}</span>
                  <span style={{ fontSize:13, fontWeight:600, color:over?'var(--text-red)':'var(--text-primary)', fontVariantNumeric:'tabular-nums' }}>{formatCurrency(cat.spent_amount ?? 0)}</span>
                  <span style={{ fontSize:11, color:'var(--text-tertiary)', fontVariantNumeric:'tabular-nums' }}>/ {formatCurrency(cat.budgeted_amount ?? 0)}</span>
                  {over && <AlertCircle size={13} color="var(--text-red)"/>}
                </div>
                <div style={{ height:4, background:'var(--bg-tertiary)', borderRadius:2, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${pct}%`, background:over?'var(--text-red)':(cat.color ?? 'var(--green-400)'), borderRadius:2, transition:'width 0.8s ease' }}/>
                </div>
              </div>
            )
          })}
        </div>

        {/* Transactions */}
        <div className="card" style={{ overflow:'hidden' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--separator)', fontSize:13, fontWeight:600 }}>Recent Transactions</div>
          {loading ? <div style={{ padding:20 }}><div style={{ height:200, background:'var(--bg-tertiary)', borderRadius:8, animation:'pulse 1.5s ease-in-out infinite' }}/></div>
          : transactions.length === 0 ? (
            <div style={{ padding:40, textAlign:'center' }}>
              <p style={{ color:'var(--text-tertiary)', fontSize:13 }}>No transactions yet.</p>
              <button className="btn btn-sm btn-green" style={{ marginTop:8 }} onClick={() => setShowTxModal(true)}>Add Transaction</button>
            </div>
          ) : transactions.map((tx, i) => (
            <div key={tx.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 20px', borderBottom:i<transactions.length-1?'1px solid var(--separator)':'none' }}>
              <div style={{ width:34, height:34, borderRadius:10, background:'var(--bg-tertiary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>
                {(tx.budget_categories as any)?.icon ?? (tx.is_income ? '💰' : '💸')}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tx.description}</div>
                <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{(tx.budget_categories as any)?.name ?? 'Uncategorized'} · {formatDate(tx.date, 'short')}</div>
              </div>
              <div style={{ fontSize:13, fontWeight:600, color:tx.is_income?'var(--text-green)':'var(--text-primary)', fontVariantNumeric:'tabular-nums', flexShrink:0 }}>
                {tx.is_income?'+':'-'}{formatCurrency(Math.abs(tx.amount))}
              </div>
              <button onClick={() => deleteTransaction(tx.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-quaternary)', padding:4 }}><X size={12}/></button>
            </div>
          ))}
        </div>
      </div>

      {/* Category Modal */}
      {showCatModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(8px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={() => setShowCatModal(false)}>
          <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:20, padding:28, width:'100%', maxWidth:380 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ fontSize:16, fontWeight:700, margin:0 }}>Add Category</h3>
              <button onClick={() => setShowCatModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-tertiary)' }}><X size={18}/></button>
            </div>
            {formError && <div style={{ padding:'10px 14px', background:'rgba(255,69,58,0.1)', borderRadius:10, color:'var(--text-red)', fontSize:13, marginBottom:16 }}>{formError}</div>}
            <form onSubmit={handleAddCategory} style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Name *</label>
                <input className="input-field" required placeholder="Housing" value={catForm.name} onChange={e => setCatForm(f => ({...f, name:e.target.value}))}/>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Icon</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {CAT_ICONS.map(ic => <button key={ic} type="button" onClick={() => setCatForm(f => ({...f, icon:ic}))} style={{ width:36, height:36, borderRadius:10, border:`1px solid ${catForm.icon===ic?'var(--green-400)':'var(--border)'}`, background:catForm.icon===ic?'rgba(48,209,88,0.1)':'var(--bg-tertiary)', cursor:'pointer', fontSize:18 }}>{ic}</button>)}
                </div>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Color</label>
                <div style={{ display:'flex', gap:8 }}>{COLORS.map(c => <button key={c} type="button" onClick={() => setCatForm(f => ({...f, color:c}))} style={{ width:28, height:28, borderRadius:'50%', background:c, border:catForm.color===c?'3px solid #fff':'none', cursor:'pointer', padding:0 }}/>)}</div>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Monthly Budget *</label>
                <input className="input-field" type="number" step="any" required placeholder="500" value={catForm.budgeted_amount} onChange={e => setCatForm(f => ({...f, budgeted_amount:e.target.value}))}/>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" className="btn btn-secondary btn-md" style={{ flex:1, justifyContent:'center' }} onClick={() => setShowCatModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-green btn-md" style={{ flex:1, justifyContent:'center' }} disabled={formLoading}>{formLoading?'Saving...':'Add Category'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {showTxModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(8px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={() => setShowTxModal(false)}>
          <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:20, padding:28, width:'100%', maxWidth:420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ fontSize:16, fontWeight:700, margin:0 }}>Add Transaction</h3>
              <button onClick={() => setShowTxModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-tertiary)' }}><X size={18}/></button>
            </div>
            {formError && <div style={{ padding:'10px 14px', background:'rgba(255,69,58,0.1)', borderRadius:10, color:'var(--text-red)', fontSize:13, marginBottom:16 }}>{formError}</div>}
            <form onSubmit={handleAddTransaction} style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ display:'flex', gap:2, background:'var(--bg-tertiary)', borderRadius:10, padding:3 }}>
                {[false, true].map(isIncome => (
                  <button key={String(isIncome)} type="button" onClick={() => setTxForm(f => ({...f, is_income:isIncome}))} style={{ flex:1, padding:'8px', borderRadius:8, background:txForm.is_income===isIncome?'var(--bg-secondary)':'transparent', color:txForm.is_income===isIncome?(isIncome?'var(--text-green)':'var(--text-red)'):'var(--text-secondary)', border:'none', cursor:'pointer', fontSize:13, fontWeight:500, transition:'all 0.15s' }}>
                    {isIncome ? '+ Income' : '− Expense'}
                  </button>
                ))}
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Description *</label>
                <input className="input-field" required placeholder="Spotify Premium" value={txForm.description} onChange={e => setTxForm(f => ({...f, description:e.target.value}))}/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Amount *</label>
                  <input className="input-field" type="number" step="any" required placeholder="9.99" value={txForm.amount} onChange={e => setTxForm(f => ({...f, amount:e.target.value}))}/>
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Date</label>
                  <input className="input-field" type="date" value={txForm.date} onChange={e => setTxForm(f => ({...f, date:e.target.value}))}/>
                </div>
              </div>
              {!txForm.is_income && categories.length > 0 && (
                <div>
                  <label style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Category</label>
                  <select className="input-field" value={txForm.category_id} onChange={e => setTxForm(f => ({...f, category_id:e.target.value}))}>
                    <option value="">Uncategorized</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" className="btn btn-secondary btn-md" style={{ flex:1, justifyContent:'center' }} onClick={() => setShowTxModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-green btn-md" style={{ flex:1, justifyContent:'center' }} disabled={formLoading}>{formLoading?'Saving...':'Add Transaction'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  )
}
