'use client'
import { useState, useEffect, useCallback } from 'react'
import { Search, FileText, Clock, Star, BookmarkPlus, Bookmark, TrendingUp, BarChart3, AlertCircle } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = ['All','Market Analysis','Stock Research','ETF Analysis','Crypto','Real Estate','Fixed Income','Economic Outlook','Tax Strategy']

export default function ResearchPage() {
  const [reports, setReports] = useState<any[]>([])
  const [watchlist, setWatchlist] = useState<any[]>([])
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [tab, setTab] = useState<'reports'|'watchlist'>('reports')
  const [watchForm, setWatchForm] = useState('')
  const [watchLoading, setWatchLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: r }, { data: w }, { data: b }] = await Promise.all([
        supabase.from('research_reports').select('*').order('published_at', { ascending: false }),
        supabase.from('watchlists').select('*').eq('user_id', user.id),
        supabase.from('saved_research').select('report_id').eq('user_id', user.id),
      ])
      setReports(r ?? [])
      setWatchlist(w ?? [])
      setBookmarks(new Set((b ?? []).map((x: any) => x.report_id)))
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const toggleBookmark = async (reportId: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (bookmarks.has(reportId)) {
      await supabase.from('saved_research').delete().eq('user_id', user.id).eq('report_id', reportId)
      setBookmarks(b => { const n = new Set(b); n.delete(reportId); return n })
    } else {
      await supabase.from('saved_research').insert({ user_id: user.id, report_id: reportId })
      setBookmarks(b => new Set([...b, reportId]))
    }
  }

  const addToWatchlist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!watchForm.trim()) return
    setWatchLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const symbols = watchForm.toUpperCase().split(',').map(s => s.trim()).filter(Boolean)
      const { error } = await supabase.from('watchlists').insert({ user_id: user.id, name: symbols.join(', '), symbols })
      if (!error) { setWatchForm(''); await load() }
    } catch(e) { console.error(e) }
    finally { setWatchLoading(false) }
  }

  const deleteWatchlist = async (id: string) => {
    const supabase = createClient()
    await supabase.from('watchlists').delete().eq('id', id)
    setWatchlist(w => w.filter(x => x.id !== id))
  }

  const filtered = reports.filter(r => {
    const matchS = search==='' || r.title?.toLowerCase().includes(search.toLowerCase())
    const matchC = category==='All' || r.category===category
    return matchS && matchC
  })

  return (
    <div className="page-container fade-in">
      <PageHeader title="Research" description="Professional financial research & market insights" />

      <div style={{ display:'flex', gap:2, marginBottom:20, background:'var(--bg-secondary)', borderRadius:12, padding:4, width:'fit-content', border:'1px solid var(--border)' }}>
        {(['reports','watchlist'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding:'6px 16px', borderRadius:9, fontSize:13, fontWeight:500, background:tab===t?'var(--bg-tertiary)':'transparent', color:tab===t?'var(--text-primary)':'var(--text-secondary)', border:'none', cursor:'pointer', textTransform:'capitalize' }}>{t}</button>
        ))}
      </div>

      {tab === 'reports' && (
        <>
          <div style={{ display:'flex', gap:12, marginBottom:16, alignItems:'center' }}>
            <div style={{ position:'relative', flex:1 }}>
              <Search size={14} color="var(--text-tertiary)" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)' }}/>
              <input className="input-field" style={{ paddingLeft:36 }} placeholder="Search research reports..." value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, marginBottom:20, overflowX:'auto', paddingBottom:4 }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)} style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:500, background:category===c?'var(--green-400)':'var(--bg-secondary)', color:category===c?'#000':'var(--text-secondary)', border:category===c?'none':'1px solid var(--border)', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>{c}</button>
            ))}
          </div>

          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[1,2,3,4,5].map(i => <div key={i} style={{ height:100, background:'var(--bg-tertiary)', borderRadius:14, animation:'pulse 1.5s ease-in-out infinite' }}/>)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 0' }}>
              <FileText size={40} color="var(--text-quaternary)"/>
              <p style={{ color:'var(--text-tertiary)', marginTop:10 }}>No research reports found.</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {filtered.map(r => (
                <div key={r.id} className="card" style={{ padding:20, cursor:'pointer' }}>
                  <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
                    <div style={{ width:48, height:48, borderRadius:14, background:'rgba(10,132,255,0.1)', border:'1px solid rgba(10,132,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {r.category?.includes('Market') ? <BarChart3 size={22} color="var(--text-blue)"/> : r.category?.includes('Stock') ? <TrendingUp size={22} color="var(--text-green)"/> : <FileText size={22} color="#BF5AF2"/>}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:6 }}>
                        <div style={{ fontSize:14, fontWeight:600, lineHeight:1.3 }}>{r.title}</div>
                        <button onClick={e => { e.stopPropagation(); toggleBookmark(r.id) }} style={{ background:'none', border:'none', cursor:'pointer', color:bookmarks.has(r.id)?'var(--text-blue)':'var(--text-tertiary)', flexShrink:0, padding:2 }}>
                          {bookmarks.has(r.id) ? <Bookmark size={16} fill="var(--text-blue)"/> : <BookmarkPlus size={16}/>}
                        </button>
                      </div>
                      {r.summary && <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.5, marginBottom:8, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{r.summary}</div>}
                      <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                        <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6, background:'var(--bg-tertiary)', color:'var(--text-secondary)' }}>{r.category}</span>
                        {r.read_time_min && <span style={{ fontSize:11, color:'var(--text-tertiary)', display:'flex', alignItems:'center', gap:3 }}><Clock size={10}/>{r.read_time_min} min read</span>}
                        {r.rating && <span style={{ fontSize:11, color:'var(--text-tertiary)', display:'flex', alignItems:'center', gap:3 }}><Star size={10} color="var(--text-yellow)"/>{r.rating?.toFixed(1)}</span>}
                        {r.published_at && <span style={{ fontSize:11, color:'var(--text-tertiary)' }}>{new Date(r.published_at).toLocaleDateString('en',{month:'short',day:'numeric'})}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'watchlist' && (
        <div>
          <form onSubmit={addToWatchlist} style={{ display:'flex', gap:10, marginBottom:20 }}>
            <input className="input-field" style={{ flex:1 }} placeholder="Enter symbols (e.g. AAPL, MSFT, TSLA)" value={watchForm} onChange={e => setWatchForm(e.target.value)}/>
            <button type="submit" className="btn btn-green btn-md" disabled={watchLoading}>{watchLoading?'Adding...':'Add to Watchlist'}</button>
          </form>
          {watchlist.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 0' }}>
              <TrendingUp size={40} color="var(--text-quaternary)"/>
              <p style={{ color:'var(--text-tertiary)', marginTop:10 }}>No watchlists yet. Add some symbols above.</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {watchlist.map(w => (
                <div key={w.id} className="card" style={{ padding:16, display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:600, marginBottom:4 }}>{w.name}</div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {(w.symbols ?? []).map((s: string) => (
                        <span key={s} style={{ fontSize:11, padding:'2px 8px', borderRadius:6, background:'rgba(48,209,88,0.1)', color:'var(--text-green)', fontWeight:600 }}>{s}</span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => deleteWatchlist(w.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-quaternary)', padding:4, fontSize:11 }}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  )
}
