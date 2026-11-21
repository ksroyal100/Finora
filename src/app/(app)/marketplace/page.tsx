'use client'
import { useState, useEffect, useCallback } from 'react'
import { Search, Star, ShoppingCart, Heart, Check, Filter } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const TYPES = ['All','course','template','ebook','tool','spreadsheet','coaching']
const SORT_OPTIONS = [{ value:'rating', label:'Top Rated' },{ value:'sale_count', label:'Best Selling' },{ value:'price', label:'Price: Low to High' },{ value:'created_at', label:'Newest' }]

export default function MarketplacePage() {
  const [products, setProducts] = useState<any[]>([])
  const [purchases, setPurchases] = useState<Set<string>>(new Set())
  const [wishlist, setWishlist] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('All')
  const [sort, setSort] = useState('rating')
  const [purchasing, setPurchasing] = useState<string|null>(null)

  const load = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: p }, { data: pur }, { data: w }] = await Promise.all([
        supabase.from('marketplace_products').select('*').eq('is_published', true),
        supabase.from('user_purchases').select('product_id').eq('user_id', user.id),
        supabase.from('marketplace_wishlists').select('product_id').eq('user_id', user.id),
      ])
      setProducts(p ?? [])
      setPurchases(new Set((pur ?? []).map((x: any) => x.product_id)))
      setWishlist(new Set((w ?? []).map((x: any) => x.product_id)))
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handlePurchase = async (product: any) => {
    if (purchases.has(product.id)) return
    setPurchasing(product.id)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      if (product.price === 0 || product.is_free) {
        // Free product: direct access
        const { error } = await supabase.from('user_purchases').insert({ user_id: user.id, product_id: product.id, amount_paid: 0 })
        if (!error) setPurchases(p => new Set([...p, product.id]))
      } else {
        // Paid: redirect to checkout
        alert(`Stripe checkout for "${product.title}" ($${product.price}) — configure STRIPE_SECRET_KEY in the backend to enable payments.`)
      }
    } catch(e) { console.error(e) }
    finally { setPurchasing(null) }
  }

  const toggleWishlist = async (productId: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (wishlist.has(productId)) {
      await supabase.from('marketplace_wishlists').delete().eq('user_id', user.id).eq('product_id', productId)
      setWishlist(w => { const n = new Set(w); n.delete(productId); return n })
    } else {
      await supabase.from('marketplace_wishlists').insert({ user_id: user.id, product_id: productId })
      setWishlist(w => new Set([...w, productId]))
    }
  }

  let filtered = products.filter(p => {
    const matchS = search==='' || p.title?.toLowerCase().includes(search.toLowerCase())
    const matchT = type==='All' || p.type===type
    return matchS && matchT
  })
  filtered = [...filtered].sort((a, b) => {
    if (sort==='price') return (a.price ?? 0) - (b.price ?? 0)
    if (sort==='rating') return (b.rating ?? 0) - (a.rating ?? 0)
    if (sort==='sale_count') return (b.sale_count ?? 0) - (a.sale_count ?? 0)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const TYPE_COLORS: Record<string,string> = { course:'#0A84FF', template:'#30D158', ebook:'#BF5AF2', tool:'#FF9F0A', spreadsheet:'#64D2FF', coaching:'#FF453A' }

  return (
    <div className="page-container fade-in">
      <PageHeader title="Marketplace" description="Premium tools and resources from financial experts" />

      <div style={{ display:'flex', gap:12, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:200 }}>
          <Search size={14} color="var(--text-tertiary)" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)' }}/>
          <input className="input-field" style={{ paddingLeft:36 }} placeholder="Search marketplace..." value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <select className="input-field" style={{ width:'auto' }} value={sort} onChange={e => setSort(e.target.value)}>
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:20, overflowX:'auto', paddingBottom:4 }}>
        {TYPES.map(t => (
          <button key={t} onClick={() => setType(t)} style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:500, background:type===t?'var(--green-400)':'var(--bg-secondary)', color:type===t?'#000':'var(--text-secondary)', border:type===t?'none':'1px solid var(--border)', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0, textTransform:'capitalize' }}>{t}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
          {[1,2,3,4,5,6].map(i => <div key={i} className="card" style={{ height:260, animation:'pulse 1.5s ease-in-out infinite' }}/>)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0' }}>
          <ShoppingCart size={40} color="var(--text-quaternary)"/>
          <p style={{ color:'var(--text-tertiary)', marginTop:10 }}>No products found.</p>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
          {filtered.map(product => {
            const owned = purchases.has(product.id)
            const wished = wishlist.has(product.id)
            const color = TYPE_COLORS[product.type] ?? '#8E8E93'
            return (
              <div key={product.id} className="card" style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>
                {/* Header */}
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:6 }}>
                      <span style={{ fontSize:10, padding:'2px 8px', borderRadius:6, background:`${color}18`, color, fontWeight:600, textTransform:'capitalize' }}>{product.type}</span>
                      {product.is_free && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:6, background:'rgba(48,209,88,0.1)', color:'var(--text-green)', fontWeight:600 }}>FREE</span>}
                      {owned && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:6, background:'rgba(48,209,88,0.1)', color:'var(--text-green)', fontWeight:600, display:'flex', alignItems:'center', gap:3 }}><Check size={9}/>Owned</span>}
                    </div>
                    <div style={{ fontSize:14, fontWeight:600, lineHeight:1.3 }}>{product.title}</div>
                  </div>
                  <button onClick={() => toggleWishlist(product.id)} style={{ background:'none', border:'none', cursor:'pointer', color:wished?'var(--text-red)':'var(--text-quaternary)', padding:4, flexShrink:0 }}>
                    <Heart size={16} fill={wished?'var(--text-red)':'none'}/>
                  </button>
                </div>

                {product.description && <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.5, flex:1 }}>{product.description}</div>}

                {/* Creator */}
                {product.creator_id && <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>by Expert Advisor</div>}

                {/* Stats */}
                <div style={{ display:'flex', gap:12 }}>
                  {product.rating && <span style={{ fontSize:11, color:'var(--text-tertiary)', display:'flex', alignItems:'center', gap:3 }}><Star size={11} color="var(--text-yellow)" fill="var(--text-yellow)"/>{product.rating?.toFixed(1)}</span>}
                  {product.sale_count > 0 && <span style={{ fontSize:11, color:'var(--text-tertiary)' }}>{product.sale_count.toLocaleString()} sold</span>}
                </div>

                {/* Price + CTA */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, paddingTop:8, borderTop:'1px solid var(--separator)' }}>
                  <div style={{ fontSize:20, fontWeight:700, letterSpacing:'-0.02em' }}>
                    {product.price === 0 || product.is_free ? <span style={{ color:'var(--text-green)' }}>Free</span> : formatCurrency(product.price)}
                  </div>
                  <button
                    onClick={() => handlePurchase(product)}
                    className={owned ? 'btn btn-secondary btn-sm' : 'btn btn-green btn-sm'}
                    disabled={owned || purchasing===product.id}
                    style={{ flexShrink:0 }}
                  >
                    {purchasing===product.id ? 'Loading...' : owned ? <><Check size={13}/> Owned</> : <><ShoppingCart size={13}/> {product.price===0||product.is_free?'Get Free':'Buy Now'}</>}
                  </button>
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
