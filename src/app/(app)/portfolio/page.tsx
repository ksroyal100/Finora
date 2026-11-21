'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, TrendingUp, TrendingDown, BarChart3, RefreshCw, X, AlertCircle } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { MetricCard } from '@/components/shared/MetricCard'
import { formatCurrency, formatPercent, getChangeColor } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

function Skeleton({ h = 16 }: { h?: number }) {
  return <div style={{ width: '100%', height: h, borderRadius: 6, background: 'var(--bg-tertiary)', animation: 'pulse 1.5s ease-in-out infinite' }} />
}

const ASSET_CLASS_COLORS: Record<string, string> = {
  stock: '#30D158', etf: '#0A84FF', crypto: '#FF9F0A', bond: '#64D2FF',
  real_estate: '#BF5AF2', commodity: '#FF453A', cash: '#FFD60A', other: '#8E8E93',
}

export default function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<any>(null)
  const [holdings, setHoldings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [form, setForm] = useState({ symbol: '', name: '', asset_class: 'stock', quantity: '', avg_cost: '', current_price: '' })
  const [formError, setFormError] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let [portRes, holdRes] = await Promise.all([
        supabase.from('portfolios').select('*').eq('user_id', user.id).eq('is_default', true).single(),
        supabase.from('portfolio_holdings').select('*').eq('user_id', user.id).order('market_value', { ascending: false }),
      ])

      // New accounts don't get a default portfolio created automatically — create one
      // on first visit so "Add Holding" has somewhere to write to.
      if (!portRes.data) {
        const created = await supabase.from('portfolios').insert({ user_id: user.id, name: 'My Portfolio', is_default: true }).select().single()
        portRes = created
      }

      setPortfolio(portRes.data)
      setHoldings(holdRes.data ?? [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setFormError('You must be signed in.'); return }
      if (!portfolio) { setFormError('No portfolio found for your account yet. Please refresh the page and try again.'); return }

      const qty = parseFloat(form.quantity)
      const cost = parseFloat(form.avg_cost)
      const price = form.current_price ? parseFloat(form.current_price) : cost
      const marketValue = qty * price
      const unrealizedGain = (price - cost) * qty
      const unrealizedGainPct = cost > 0 ? ((price - cost) / cost) * 100 : 0

      const { error } = await supabase.from('portfolio_holdings').upsert({
        portfolio_id: portfolio.id, user_id: user.id,
        symbol: form.symbol.toUpperCase(), name: form.name || form.symbol.toUpperCase(),
        asset_class: form.asset_class, quantity: qty, avg_cost: cost, current_price: price,
        market_value: marketValue, unrealized_gain: unrealizedGain, unrealized_gain_pct: unrealizedGainPct,
      }, { onConflict: 'portfolio_id,symbol' })

      if (error) throw error
      setShowAddModal(false)
      setForm({ symbol: '', name: '', asset_class: 'stock', quantity: '', avg_cost: '', current_price: '' })
      await load()
    } catch (e: any) {
      setFormError(e.message ?? 'Failed to add holding')
    } finally { setFormLoading(false) }
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    await supabase.from('portfolio_holdings').delete().eq('id', id)
    setHoldings(h => h.filter(x => x.id !== id))
  }

  const totalValue = holdings.reduce((s, h) => s + (h.market_value ?? 0), 0)
  const totalCost = holdings.reduce((s, h) => s + ((h.avg_cost ?? 0) * (h.quantity ?? 0)), 0)
  const totalGain = totalValue - totalCost
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0

  // Asset class breakdown
  const byClass = holdings.reduce((acc: Record<string, number>, h) => {
    acc[h.asset_class] = (acc[h.asset_class] ?? 0) + (h.market_value ?? 0)
    return acc
  }, {})

  return (
    <div className="page-container fade-in">
      <PageHeader
        title="Portfolio"
        description="Track your investments across all asset classes"
        actions={
          <>
            <button className="btn btn-secondary btn-md" onClick={() => { setSyncing(true); setTimeout(() => setSyncing(false), 2000) }} disabled={syncing}>
              <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} /> Sync
            </button>
            <button className="btn btn-green btn-md" onClick={() => setShowAddModal(true)}><Plus size={14} /> Add Holding</button>
          </>
        }
      />

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>{[1,2,3,4].map(i => <div key={i} className="card" style={{ padding: 20 }}><Skeleton h={60} /></div>)}</div>
          <div className="card" style={{ padding: 24 }}><Skeleton h={200} /></div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
            <MetricCard label="Portfolio Value" value={formatCurrency(totalValue)} change={portfolio?.day_change_pct ?? 0} changePeriod="today" size="md" icon={<TrendingUp size={14} color="var(--text-green)" />} />
            <MetricCard label="Total Return" value={formatCurrency(totalGain)} change={totalGainPct} changePeriod="all time" size="md" icon={<BarChart3 size={14} color="var(--text-blue)" />} iconBg="rgba(10,132,255,0.12)" />
            <MetricCard label="Day Change" value={formatCurrency(portfolio?.day_change ?? 0)} change={portfolio?.day_change_pct ?? 0} changePeriod="today" size="md" icon={<TrendingDown size={14} color="var(--text-red)" />} iconBg="rgba(255,69,58,0.12)" />
            <MetricCard label="Holdings" value={holdings.length} subvalue={`${Object.keys(byClass).length} asset classes`} size="md" />
          </div>

          {/* Allocation */}
          {Object.keys(byClass).length > 0 && (
            <div className="card" style={{ padding: 24, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Allocation</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(byClass).sort(([,a], [,b]) => b - a).map(([cls, val]) => {
                  const pct = totalValue > 0 ? (val / totalValue) * 100 : 0
                  const color = ASSET_CLASS_COLORS[cls] ?? '#8E8E93'
                  return (
                    <div key={cls}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{cls}</span>
                        <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(1)}% · {formatCurrency(val, 'USD', true)}</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--bg-tertiary)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.8s ease' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Holdings Table */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--separator)', fontSize: 13, fontWeight: 600 }}>Holdings ({holdings.length})</div>
            {holdings.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <BarChart3 size={32} color="var(--text-quaternary)" />
                <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 8 }}>No holdings yet. Add your first investment.</p>
                <button className="btn btn-sm btn-green" style={{ marginTop: 12 }} onClick={() => setShowAddModal(true)}>Add Holding</button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--separator)' }}>
                      {['Symbol', 'Qty', 'Avg Cost', 'Price', 'Market Value', 'Gain/Loss', 'Weight', ''].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Symbol' ? 'left' : 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((h, i) => {
                      const gain = h.unrealized_gain ?? 0
                      const gainPct = h.unrealized_gain_pct ?? 0
                      const color = ASSET_CLASS_COLORS[h.asset_class] ?? '#8E8E93'
                      return (
                        <tr key={h.id} style={{ borderBottom: i < holdings.length - 1 ? '1px solid var(--separator)' : 'none' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color }}>{h.symbol.slice(0,3)}</span>
                              </div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{h.symbol}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{h.name ?? h.asset_class}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{parseFloat(h.quantity).toLocaleString()}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(h.avg_cost)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(h.current_price)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(h.market_value)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: getChangeColor(gain), fontVariantNumeric: 'tabular-nums' }}>{gain >= 0 ? '+' : ''}{formatCurrency(gain)}</div>
                            <div style={{ fontSize: 11, color: getChangeColor(gainPct) }}>{formatPercent(gainPct)}</div>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)' }}>{(h.weight_pct ?? 0).toFixed(1)}%</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <button onClick={() => handleDelete(h.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-quaternary)', padding: 4 }} title="Remove">
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Add Holding Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowAddModal(false)}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Add Holding</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={18} /></button>
            </div>
            {formError && <div style={{ padding: '10px 14px', background: 'rgba(255,69,58,0.1)', borderRadius: 10, color: 'var(--text-red)', fontSize: 13, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}><AlertCircle size={14} />{formError}</div>}
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Symbol *</label>
                  <input className="input-field" placeholder="AAPL" required value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Asset Class</label>
                  <select className="input-field" value={form.asset_class} onChange={e => setForm(f => ({ ...f, asset_class: e.target.value }))}>
                    {['stock','etf','crypto','bond','real_estate','commodity','cash','other'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Name</label>
                <input className="input-field" placeholder="Apple Inc." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Quantity *</label>
                  <input className="input-field" type="number" step="any" placeholder="10" required value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Avg Cost *</label>
                  <input className="input-field" type="number" step="any" placeholder="150.00" required value={form.avg_cost} onChange={e => setForm(f => ({ ...f, avg_cost: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Current Price</label>
                  <input className="input-field" type="number" step="any" placeholder="Same" value={form.current_price} onChange={e => setForm(f => ({ ...f, current_price: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" className="btn btn-secondary btn-md" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-green btn-md" style={{ flex: 1, justifyContent: 'center' }} disabled={formLoading}>
                  {formLoading ? 'Saving...' : 'Add Holding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
