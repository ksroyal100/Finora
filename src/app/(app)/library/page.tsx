'use client'
import { useState, useEffect, useCallback } from 'react'
import { BookOpen, Play, Download, ExternalLink, ShoppingBag } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const TYPE_ICONS: Record<string,string> = { course:'🎓', template:'📋', ebook:'📖', tool:'🛠️', spreadsheet:'📊', coaching:'🎯' }
const TYPE_COLORS: Record<string,string> = { course:'#0A84FF', template:'#30D158', ebook:'#BF5AF2', tool:'#FF9F0A', spreadsheet:'#64D2FF', coaching:'#FF453A' }

export default function LibraryPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')

  const load = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('user_purchases')
        .select('*, marketplace_products!product_id(id,title,type,description,price,is_free,download_url,access_url)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setItems(data ?? [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const types = ['All', ...Array.from(new Set(items.map(i => i.marketplace_products?.type).filter(Boolean)))]
  const filtered = filter === 'All' ? items : items.filter(i => i.marketplace_products?.type === filter)

  return (
    <div className="page-container fade-in">
      <PageHeader title="Library" description="Your purchased products and resources" />

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
        {[
          { label:'Total Items', value:items.length },
          { label:'Courses', value:items.filter(i => i.marketplace_products?.type==='course').length },
          { label:'Templates', value:items.filter(i => i.marketplace_products?.type==='template').length },
          { label:'Tools', value:items.filter(i => ['tool','spreadsheet'].includes(i.marketplace_products?.type)).length },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding:'14px 18px' }}>
            <div style={{ fontSize:24, fontWeight:700, letterSpacing:'-0.02em', marginBottom:2 }}>{s.value}</div>
            <div style={{ fontSize:12, color:'var(--text-tertiary)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Type Filter */}
      <div style={{ display:'flex', gap:8, marginBottom:20, overflowX:'auto', paddingBottom:4 }}>
        {types.map(t => (
          <button key={t} onClick={() => setFilter(t)} style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:500, background:filter===t?'var(--green-400)':'var(--bg-secondary)', color:filter===t?'#000':'var(--text-secondary)', border:filter===t?'none':'1px solid var(--border)', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0, textTransform:'capitalize' }}>{t}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:16 }}>
          {[1,2,3,4].map(i => <div key={i} className="card" style={{ height:140, animation:'pulse 1.5s ease-in-out infinite' }}/>)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0' }}>
          <ShoppingBag size={40} color="var(--text-quaternary)"/>
          <p style={{ color:'var(--text-tertiary)', marginTop:10, fontSize:14 }}>
            {filter === 'All' ? 'Your library is empty.' : `No ${filter}s in your library.`}
          </p>
          <Link href="/marketplace" className="btn btn-green btn-md" style={{ display:'inline-flex', marginTop:14 }}>
            Browse Marketplace
          </Link>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:16 }}>
          {filtered.map(item => {
            const product = item.marketplace_products
            if (!product) return null
            const color = TYPE_COLORS[product.type] ?? '#8E8E93'
            return (
              <div key={item.id} className="card" style={{ padding:20, display:'flex', gap:16, alignItems:'flex-start' }}>
                <div style={{ width:52, height:52, borderRadius:14, background:`${color}18`, border:`1px solid ${color}28`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>
                  {TYPE_ICONS[product.type] ?? '📦'}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:5 }}>
                    <span style={{ fontSize:10, padding:'2px 7px', borderRadius:6, background:`${color}18`, color, fontWeight:600, textTransform:'capitalize' }}>{product.type}</span>
                  </div>
                  <div style={{ fontSize:14, fontWeight:600, marginBottom:4, lineHeight:1.3 }}>{product.title}</div>
                  <div style={{ fontSize:12, color:'var(--text-tertiary)', marginBottom:10 }}>
                    Purchased {formatDate(item.created_at, 'short')} · {item.amount_paid === 0 ? 'Free' : formatCurrency(item.amount_paid)}
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    {product.access_url && (
                      <a href={product.access_url} target="_blank" rel="noopener" className="btn btn-green btn-sm" style={{ display:'inline-flex' }}>
                        <Play size={12}/> {product.type === 'course' ? 'Continue' : 'Open'}
                      </a>
                    )}
                    {product.download_url && (
                      <a href={product.download_url} target="_blank" rel="noopener" className="btn btn-secondary btn-sm" style={{ display:'inline-flex' }}>
                        <Download size={12}/> Download
                      </a>
                    )}
                    {!product.access_url && !product.download_url && product.type === 'course' && (
                      <Link href="/learning" className="btn btn-secondary btn-sm" style={{ display:'inline-flex' }}>
                        <BookOpen size={12}/> View in Learning
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  )
}
