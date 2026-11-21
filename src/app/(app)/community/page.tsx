'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Heart, MessageCircle, Users, Send, X, TrendingUp } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { createClient } from '@/lib/supabase/client'

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const min = Math.floor(diff/60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m`
  const hr = Math.floor(min/60)
  if (hr < 24) return `${hr}h`
  return `${Math.floor(hr/24)}d`
}

export default function CommunityPage() {
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'feed'|'trending'|'following'>('feed')
  const [showCreate, setShowCreate] = useState(false)
  const [newPost, setNewPost] = useState('')
  const [posting, setPosting] = useState(false)
  const [liked, setLiked] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string|null>(null)
  const [expandedComments, setExpandedComments] = useState<string|null>(null)
  const [comments, setComments] = useState<Record<string,any[]>>({})
  const [newComment, setNewComment] = useState<Record<string,string>>({})

  const load = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      let query = supabase.from('posts')
        .select('*, profiles!user_id(display_name,avatar_url,username)')
        .order(tab === 'trending' ? 'like_count' : 'created_at', { ascending: false })
        .limit(20)

      if (tab === 'following') {
        const { data: follows } = await supabase.from('user_follows').select('following_id').eq('follower_id', user.id)
        const ids = (follows ?? []).map((f: any) => f.following_id)
        if (ids.length === 0) { setPosts([]); setLoading(false); return }
        query = query.in('user_id', ids)
      }

      const { data: p } = await query

      // Get user's liked posts
      const { data: l } = await supabase.from('post_likes').select('post_id').eq('user_id', user.id)
      setLiked(new Set((l ?? []).map((x: any) => x.post_id)))
      setPosts(p ?? [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [tab])

  useEffect(() => { setLoading(true); load() }, [load])

  const handlePost = async () => {
    if (!newPost.trim() || posting) return
    setPosting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase.from('posts').insert({ user_id: user.id, content: newPost, like_count: 0, comment_count: 0 })
      if (!error) { setNewPost(''); setShowCreate(false); await load() }
    } catch(e) { console.error(e) }
    finally { setPosting(false) }
  }

  const toggleLike = async (postId: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const isLiked = liked.has(postId)
    const post = posts.find(p => p.id === postId)
    if (isLiked) {
      await supabase.from('post_likes').delete().eq('user_id', user.id).eq('post_id', postId)
      await supabase.from('posts').update({ like_count: Math.max(0, (post?.like_count ?? 1) - 1) }).eq('id', postId)
      setLiked(l => { const n = new Set(l); n.delete(postId); return n })
    } else {
      await supabase.from('post_likes').insert({ user_id: user.id, post_id: postId })
      await supabase.from('posts').update({ like_count: (post?.like_count ?? 0) + 1 }).eq('id', postId)
      setLiked(l => new Set([...l, postId]))
    }
    setPosts(ps => ps.map(p => p.id === postId ? { ...p, like_count: isLiked ? Math.max(0,(p.like_count??1)-1) : (p.like_count??0)+1 } : p))
  }

  const loadComments = async (postId: string) => {
    if (expandedComments === postId) { setExpandedComments(null); return }
    const supabase = createClient()
    const { data } = await supabase.from('post_comments').select('*, profiles!user_id(display_name,avatar_url)').eq('post_id', postId).order('created_at')
    setComments(c => ({ ...c, [postId]: data ?? [] }))
    setExpandedComments(postId)
  }

  const submitComment = async (postId: string) => {
    const text = newComment[postId]?.trim()
    if (!text) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: c } = await supabase.from('post_comments').insert({ user_id: user.id, post_id: postId, content: text }).select('*, profiles!user_id(display_name,avatar_url)').single()
    if (c) {
      setComments(cm => ({ ...cm, [postId]: [...(cm[postId] ?? []), c] }))
      setNewComment(nc => ({ ...nc, [postId]: '' }))
      setPosts(ps => ps.map(p => p.id === postId ? { ...p, comment_count: (p.comment_count ?? 0) + 1 } : p))
      await supabase.from('posts').update({ comment_count: (posts.find(p => p.id === postId)?.comment_count ?? 0) + 1 }).eq('id', postId)
    }
  }

  return (
    <div className="page-container fade-in">
      <PageHeader title="Community" description="Connect with fellow wealth builders"
        actions={<button className="btn btn-green btn-md" onClick={() => setShowCreate(true)}><Plus size={14}/> Share Post</button>}
      />

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, marginBottom:20, background:'var(--bg-secondary)', borderRadius:12, padding:4, width:'fit-content', border:'1px solid var(--border)' }}>
        {(['feed','trending','following'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding:'6px 16px', borderRadius:9, fontSize:13, fontWeight:500, background:tab===t?'var(--bg-tertiary)':'transparent', color:tab===t?'var(--text-primary)':'var(--text-secondary)', border:'none', cursor:'pointer', textTransform:'capitalize', display:'flex', alignItems:'center', gap:6 }}>
            {t === 'trending' && <TrendingUp size={13}/>}{t === 'following' && <Users size={13}/>}{t}
          </button>
        ))}
      </div>

      {/* Create Post Inline */}
      {showCreate && (
        <div className="card" style={{ padding:20, marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:600 }}>Share with the community</div>
            <button onClick={() => setShowCreate(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-tertiary)' }}><X size={16}/></button>
          </div>
          <textarea value={newPost} onChange={e => setNewPost(e.target.value)} placeholder="Share a financial tip, insight, or question..." rows={4} style={{ width:'100%', background:'var(--bg-tertiary)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 14px', color:'var(--text-primary)', fontSize:14, resize:'vertical', fontFamily:'var(--font-system)', outline:'none', marginBottom:12 }}/>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
            <button className="btn btn-secondary btn-md" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-green btn-md" onClick={handlePost} disabled={!newPost.trim() || posting}>{posting?'Posting...':'Post'}</button>
          </div>
        </div>
      )}

      {/* Posts */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {[1,2,3].map(i => <div key={i} style={{ height:140, background:'var(--bg-tertiary)', borderRadius:14, animation:'pulse 1.5s ease-in-out infinite' }}/>)}
        </div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0' }}>
          <Users size={40} color="var(--text-quaternary)"/>
          <p style={{ color:'var(--text-tertiary)', marginTop:10 }}>
            {tab==='following' ? 'Follow people to see their posts here.' : 'No posts yet. Be the first to share!'}
          </p>
          <button className="btn btn-sm btn-green" style={{ marginTop:12 }} onClick={() => setShowCreate(true)}>Share a Post</button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {posts.map(post => {
            const profile = post.profiles
            const isLiked = liked.has(post.id)
            const showComments = expandedComments === post.id
            const postComments = comments[post.id] ?? []
            const initials = profile?.display_name?.slice(0,2).toUpperCase() ?? '??'
            return (
              <div key={post.id} className="card" style={{ padding:20 }}>
                {/* Author */}
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                  <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,#2FD968,#0058CC)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff', overflow:'hidden', flexShrink:0 }}>
                    {profile?.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : initials}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:600 }}>{profile?.display_name ?? 'User'}</div>
                    <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>@{profile?.username ?? 'user'} · {timeAgo(post.created_at)}</div>
                  </div>
                  {post.user_id === userId && (
                    <button onClick={async () => { const supabase = createClient(); await supabase.from('posts').delete().eq('id', post.id); setPosts(ps => ps.filter(p => p.id !== post.id)) }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-quaternary)', padding:4 }}><X size={14}/></button>
                  )}
                </div>
                <div style={{ fontSize:14, lineHeight:1.6, color:'var(--text-primary)', marginBottom:14, whiteSpace:'pre-wrap' }}>{post.content}</div>
                {/* Actions */}
                <div style={{ display:'flex', gap:16, alignItems:'center', borderTop:'1px solid var(--separator)', paddingTop:12 }}>
                  <button onClick={() => toggleLike(post.id)} style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:'none', cursor:'pointer', color:isLiked?'var(--text-red)':'var(--text-tertiary)', fontSize:13 }}>
                    <Heart size={16} fill={isLiked?'var(--text-red)':'none'}/> {post.like_count ?? 0}
                  </button>
                  <button onClick={() => loadComments(post.id)} style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:'none', cursor:'pointer', color:showComments?'var(--green-400)':'var(--text-tertiary)', fontSize:13 }}>
                    <MessageCircle size={16}/> {post.comment_count ?? 0}
                  </button>
                </div>
                {/* Comments */}
                {showComments && (
                  <div style={{ marginTop:14, borderTop:'1px solid var(--separator)', paddingTop:14 }}>
                    <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:12 }}>
                      {postComments.map((c: any) => (
                        <div key={c.id} style={{ display:'flex', gap:10 }}>
                          <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#BF5AF2,#0A84FF)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff', flexShrink:0 }}>
                            {c.profiles?.display_name?.slice(0,2).toUpperCase() ?? '?'}
                          </div>
                          <div style={{ flex:1, background:'var(--bg-tertiary)', borderRadius:10, padding:'8px 12px' }}>
                            <div style={{ fontSize:12, fontWeight:600, marginBottom:2 }}>{c.profiles?.display_name}</div>
                            <div style={{ fontSize:13, lineHeight:1.5 }}>{c.content}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <input className="input-field" style={{ flex:1, fontSize:13, padding:'8px 12px' }} placeholder="Add a comment..." value={newComment[post.id] ?? ''} onChange={e => setNewComment(nc => ({...nc, [post.id]: e.target.value}))} onKeyDown={e => e.key==='Enter' && submitComment(post.id)}/>
                      <button className="btn btn-sm btn-green" onClick={() => submitComment(post.id)} disabled={!newComment[post.id]?.trim()}><Send size={13}/></button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  )
}
