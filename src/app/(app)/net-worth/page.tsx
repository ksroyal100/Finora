'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, X, AlertCircle } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const ASSET_TYPES = ['cash','investment','real_estate','business','vehicle','personal','retirement','crypto','other']
const LIABILITY_TYPES = ['mortgage','auto_loan','student_loan','credit_card','personal_loan','medical','tax','other']
const TYPE_ICONS: Record<string,string> = { cash:'💵', investment:'📈', retirement:'🌴', real_estate:'🏠', vehicle:'🚗', crypto:'₿', business:'💼', personal:'📦', other:'💰', mortgage:'🏠', auto_loan:'🚗', student_loan:'🎓', credit_card:'💳', personal_loan:'💰', medical:'🏥', tax:'📋' }

type ModalType = 'asset' | 'liability' | null

export default function NetWorthPage() {
  const [assets, setAssets] = useState<any[]>([])
  const [liabilities, setLiabilities] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalType>(null)
  const [form, setForm] = useState({ name: '', type: 'cash', value: '', interest_rate: '', monthly_payment: '', institution: '' })
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string|null>(null)

  const load = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [a, l, h] = await Promise.all([
        supabase.from('assets').select('*').eq('user_id', user.id).order('value', { ascending: false }),
        supabase.from('liabilities').select('*').eq('user_id', user.id).order('balance', { ascending: false }),
        supabase.from('net_worth_snapshots').select('net_worth,snapshot_date').eq('user_id', user.id).order('snapshot_date', { ascending: true }).limit(12),
      ])
      setAssets(a.data ?? [])
      setLiabilities(l.data ?? [])
      setHistory(h.data ?? [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const val = parseFloat(form.value)
      if (modal === 'asset') {
        const { error } = await supabase.from('assets').insert({ user_id: user.id, name: form.name, type: form.type, value: val, institution: form.institution || null })
        if (error) throw error
        // Recompute net worth snapshot via the DB function (net_worth is a generated column, so it can't be set directly)
        await supabase.rpc('auto_net_worth_snapshot', { p_user_id: user.id })
      } else {
        const { error } = await supabase.from('liabilities').insert({ user_id: user.id, name: form.name, type: form.type, balance: val, interest_rate: form.interest_rate ? parseFloat(form.interest_rate) : null, minimum_payment: form.monthly_payment ? parseFloat(form.monthly_payment) : null, institution: form.institution || null })
        if (error) throw error
        await supabase.rpc('auto_net_worth_snapshot', { p_user_id: user.id })
      }
      setModal(null)
      setForm({ name: '', type: 'cash', value: '', interest_rate: '', monthly_payment: '', institution: '' })
      await load()
    } catch(e: any) { setFormError(e.message ?? 'Failed to save') }
    finally { setFormLoading(false) }
  }

  const deleteAsset = async (id: string) => { const supabase = createClient(); await supabase.from('assets').delete().eq('id', id); setAssets(a => a.filter(x => x.id !== id)) }
  const deleteLiability = async (id: string) => { const supabase = createClient(); await supabase.from('liabilities').delete().eq('id', id); setLiabilities(l => l.filter(x => x.id !== id)) }

  const totalAssets = assets.reduce((s, a) => s + (a.value ?? 0), 0)
  const totalLiabilities = liabilities.reduce((s, l) => s + (l.balance ?? 0), 0)
  const netWorth = totalAssets - totalLiabilities
  const prevNW = history.length > 1 ? history[history.length - 2]?.net_worth ?? netWorth : netWorth
  const change = netWorth - prevNW
  const changePct = prevNW !== 0 ? (change / Math.abs(prevNW)) * 100 : 0
  const maxBar = Math.max(...history.map(h => h.net_worth ?? 0), 1)

  const openModal = (type: ModalType) => { setModal(type); setForm({ name: '', type: type === 'asset' ? 'cash' : 'mortgage', value: '', interest_rate: '', monthly_payment: '', institution: '' }); setFormError(null) }

  return (
    <div className="page-container fade-in">
      <PageHeader title="Net Worth" description="Your complete financial picture" actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-md" onClick={() => openModal('liability')}><Plus size={14} /> Add Liability</button>
          <button className="btn btn-green btn-md" onClick={() => openModal('asset')}><Plus size={14} /> Add Asset</button>
        </div>
      } />

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Net Worth', value: netWorth, color: netWorth >= 0 ? 'var(--text-primary)' : 'var(--text-red)', sub: `${change >= 0 ? '+' : ''}${changePct.toFixed(1)}% vs last snapshot` },
          { label: 'Total Assets', value: totalAssets, color: 'var(--text-green)', sub: `${assets.length} asset${assets.length !== 1 ? 's' : ''}` },
          { label: 'Total Liabilities', value: totalLiabilities, color: 'var(--text-red)', sub: `${liabilities.length} liabilit${liabilities.length !== 1 ? 'ies' : 'y'}` },
        ].map(m => (
          <div key={m.label} className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>{m.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: m.color, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(m.value, 'USD', true)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* History Chart */}
      {history.length > 1 && (
        <div className="card" style={{ padding: 24, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Net Worth History</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
            {history.map((h, i) => {
              const pct = maxBar > 0 ? Math.max(4, (h.net_worth / maxBar) * 100) : 4
              const isLast = i === history.length - 1
              return (
                <div key={h.snapshot_date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ width: '100%', height: `${pct}%`, background: isLast ? 'var(--green-400)' : 'var(--bg-quaternary)', borderRadius: '3px 3px 0 0', border: isLast ? '1px solid rgba(48,209,88,0.3)' : 'none' }} title={formatCurrency(h.net_worth)} />
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{new Date(h.snapshot_date).toLocaleDateString('en',{month:'short'})}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Assets */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--separator)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Assets ({assets.length})</div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-green)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(totalAssets, 'USD', true)}</span>
          </div>
          {assets.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No assets added yet.</p>
              <button className="btn btn-sm btn-green" style={{ marginTop: 8 }} onClick={() => openModal('asset')}>Add Asset</button>
            </div>
          ) : (
            assets.map((a, i) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: i < assets.length - 1 ? '1px solid var(--separator)' : 'none' }}>
                <span style={{ fontSize: 20 }}>{TYPE_ICONS[a.type] ?? '💰'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{a.type?.replace(/_/g,' ')}{a.institution ? ` · ${a.institution}` : ''}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-green)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(a.value)}</div>
                <button onClick={() => deleteAsset(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-quaternary)', padding: 4 }}><X size={13} /></button>
              </div>
            ))
          )}
        </div>

        {/* Liabilities */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--separator)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Liabilities ({liabilities.length})</div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-red)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(totalLiabilities, 'USD', true)}</span>
          </div>
          {liabilities.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No liabilities recorded.</p>
              <button className="btn btn-sm btn-secondary" style={{ marginTop: 8 }} onClick={() => openModal('liability')}>Add Liability</button>
            </div>
          ) : (
            liabilities.map((l, i) => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: i < liabilities.length - 1 ? '1px solid var(--separator)' : 'none' }}>
                <span style={{ fontSize: 20 }}>{TYPE_ICONS[l.type] ?? '💳'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{l.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{l.type?.replace(/_/g,' ')}{l.interest_rate ? ` · ${l.interest_rate}% APR` : ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-red)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(l.balance)}</div>
                  {l.minimum_payment && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatCurrency(l.minimum_payment)}/mo</div>}
                </div>
                <button onClick={() => deleteLiability(l.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-quaternary)', padding: 4 }}><X size={13} /></button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setModal(null)}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Add {modal === 'asset' ? 'Asset' : 'Liability'}</h3>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={18} /></button>
            </div>
            {formError && <div style={{ padding: '10px 14px', background: 'rgba(255,69,58,0.1)', borderRadius: 10, color: 'var(--text-red)', fontSize: 13, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}><AlertCircle size={14}/>{formError}</div>}
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Name *</label>
                <input className="input-field" required placeholder={modal === 'asset' ? 'Chase Checking' : 'Mortgage'} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Type</label>
                  <select className="input-field" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    {(modal === 'asset' ? ASSET_TYPES : LIABILITY_TYPES).map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>{modal === 'asset' ? 'Value' : 'Balance'} *</label>
                  <input className="input-field" type="number" step="any" required placeholder="10000" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
                </div>
              </div>
              {modal === 'liability' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Interest Rate (%)</label>
                    <input className="input-field" type="number" step="any" placeholder="5.5" value={form.interest_rate} onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Monthly Payment</label>
                    <input className="input-field" type="number" step="any" placeholder="500" value={form.monthly_payment} onChange={e => setForm(f => ({ ...f, monthly_payment: e.target.value }))} />
                  </div>
                </div>
              )}
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Institution</label>
                <input className="input-field" placeholder="Chase Bank" value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn btn-secondary btn-md" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-green btn-md" style={{ flex: 1, justifyContent: 'center' }} disabled={formLoading}>{formLoading ? 'Saving...' : `Add ${modal === 'asset' ? 'Asset' : 'Liability'}`}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
