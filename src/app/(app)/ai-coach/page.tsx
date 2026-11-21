'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Bot, Send, Plus, Sparkles, ChevronRight, Zap, AlertCircle, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import MarkdownMessage from '@/components/shared/MarkdownMessage'
import { createClient } from '@/lib/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

const QUICK_PROMPTS = [
  { icon:'📈', text:'Review my portfolio allocation' },
  { icon:'🎯', text:'How can I reach my goals faster?' },
  { icon:'💰', text:'Optimize my monthly budget' },
  { icon:'🏠', text:'What should I know before investing in real estate?' },
  { icon:'📊', text:'Explain index fund investing' },
  { icon:'💳', text:'Best strategy to pay off debt' },
]

type Message = { id: string; role: 'user'|'assistant'; content: string; created_at?: string }
type Conversation = { id: string; title: string; created_at: string }

export default function AICoachPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string|null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingConvos, setLoadingConvos] = useState(true)
  const [error, setError] = useState<string|null>(null)
  const [usage, setUsage] = useState<{ queries_used: number; queries_limit: number }|null>(null)
  const [hoveredId, setHoveredId] = useState<string|null>(null)
  const [deletingId, setDeletingId] = useState<string|null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const getAuthHeaders = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    }
  }, [])

  const loadConversations = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('ai_conversations').select('id,title,created_at').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(20)
      setConversations(data ?? [])
    } catch(e) { console.error(e) }
    finally { setLoadingConvos(false) }
  }, [])

  const loadMessages = useCallback(async (convId: string) => {
    const supabase = createClient()
    const { data } = await supabase.from('ai_messages').select('id,role,content,created_at').eq('conversation_id', convId).order('created_at')
    setMessages(data ?? [])
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const handleNewChat = () => { setActiveId(null); setMessages([]); setError(null); inputRef.current?.focus() }

  const handleSelectConversation = async (id: string) => {
    setActiveId(id)
    setError(null)
    await loadMessages(id)
  }

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation() // don't also trigger handleSelectConversation on the parent
    if (!window.confirm('Delete this conversation? This can\'t be undone.')) return

    setDeletingId(id)
    const previousConversations = conversations
    // Optimistic removal — smooth, instant sidebar update like ChatGPT
    setConversations(cs => cs.filter(c => c.id !== id))
    if (activeId === id) { setActiveId(null); setMessages([]) }

    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_URL}/api/ai-coach/conversations/${id}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to delete' }))
        throw new Error(err.error ?? `Server error ${res.status}`)
      }
    } catch (e: any) {
      // Roll back on failure so the sidebar never lies about what's saved
      setConversations(previousConversations)
      setError(e.message ?? 'Failed to delete conversation.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput('')
    setError(null)
    setLoading(true)

    // Optimistic user message
    const tempUserMsg: Message = { id: `tmp-${Date.now()}`, role: 'user', content: msg }
    setMessages(m => [...m, tempUserMsg])

    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_URL}/api/ai-coach/conversations`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          // omit conversation_id entirely when null — Zod accepts undefined but NOT null
          ...(activeId ? { conversation_id: activeId } : {}),
          message: msg,
        }),
        credentials: 'include',
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }))
        throw new Error(err.error ?? `Server error ${res.status}`)
      }

      const data = await res.json()
      const convId = data.data?.conversation_id ?? activeId
      if (!activeId && convId) {
        setActiveId(convId)
        await loadConversations()
      }
      const aiMsg: Message = { id: `ai-${Date.now()}`, role: 'assistant', content: data.data?.message ?? data.data?.response ?? data.message ?? '' }
      setMessages(m => [...m, aiMsg])
      if (data.data?.usage) setUsage(data.data.usage)

      // Persist to Supabase directly too (in case the backend didn't)
      if (convId) await loadMessages(convId)
    } catch (e: any) {
      setMessages(m => m.filter(x => x.id !== tempUserMsg.id))
      setError(e.message ?? 'Failed to connect to AI. Make sure the backend is running.')
    } finally { setLoading(false) }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div style={{ display:'flex', height:'calc(100vh - var(--topbar-height))', overflow:'hidden' }}>
      {/* Sidebar */}
      <div style={{ width:240, borderRight:'1px solid var(--separator)', display:'flex', flexDirection:'column', overflow:'hidden', flexShrink:0 }}>
        <div style={{ padding:'16px 14px', borderBottom:'1px solid var(--separator)' }}>
          <button className="btn btn-green btn-md" style={{ width:'100%', justifyContent:'center' }} onClick={handleNewChat}>
            <Plus size={14}/> New Chat
          </button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'8px 6px' }}>
          {loadingConvos ? (
            <div style={{ padding:12 }}>{[1,2,3].map(i => <div key={i} style={{ height:40, background:'var(--bg-tertiary)', borderRadius:8, marginBottom:6, animation:'pulse 1.5s ease-in-out infinite' }}/>)}</div>
          ) : conversations.length === 0 ? (
            <div style={{ padding:'20px 12px', textAlign:'center', color:'var(--text-tertiary)', fontSize:12 }}>No conversations yet</div>
          ) : conversations.map(c => (
            <div
              key={c.id}
              onMouseEnter={() => setHoveredId(c.id)}
              onMouseLeave={() => setHoveredId(id => id === c.id ? null : id)}
              style={{ position:'relative', marginBottom:2 }}
            >
              <button onClick={() => handleSelectConversation(c.id)} style={{ width:'100%', textAlign:'left', padding:'10px 36px 10px 12px', borderRadius:10, background:activeId===c.id?'rgba(48,209,88,0.1)':'transparent', border:activeId===c.id?'1px solid rgba(48,209,88,0.15)':'1px solid transparent', cursor:'pointer', display:'block' }}>
                <div style={{ fontSize:12, fontWeight:500, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.title || 'New Chat'}</div>
                <div style={{ fontSize:10, color:'var(--text-tertiary)', marginTop:2 }}>{new Date(c.created_at).toLocaleDateString()}</div>
              </button>
              {hoveredId === c.id && (
                <button
                  onClick={e => handleDeleteConversation(c.id, e)}
                  disabled={deletingId === c.id}
                  title="Delete conversation"
                  style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', width:24, height:24, borderRadius:6, background:'transparent', border:'none', cursor:deletingId===c.id?'wait':'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(255,69,58,0.12)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}
                >
                  <Trash2 size={13} color={deletingId===c.id?'var(--text-quaternary)':'var(--text-red)'}/>
                </button>
              )}
            </div>
          ))}
        </div>
        {usage && (
          <div style={{ padding:'12px 14px', borderTop:'1px solid var(--separator)' }}>
            <div style={{ fontSize:11, color:'var(--text-tertiary)', marginBottom:4 }}>
              {usage.queries_limit === -1 ? 'Unlimited queries' : `${usage.queries_used} / ${usage.queries_limit} queries used`}
            </div>
            {usage.queries_limit !== -1 && (
              <div style={{ height:3, background:'var(--bg-tertiary)', borderRadius:2 }}>
                <div style={{ height:'100%', width:`${Math.min(100, (usage.queries_used/usage.queries_limit)*100)}%`, background:'var(--green-400)', borderRadius:2 }}/>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Chat */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--separator)', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <div style={{ width:32, height:32, borderRadius:10, background:'linear-gradient(135deg,#2FD968,#0058CC)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Bot size={16} color="#fff"/>
          </div>
          <div>
            <div style={{ fontSize:14, fontWeight:600 }}>Finora AI Coach</div>
            <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>Your personal wealth advisor</div>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--green-400)' }}/>
            <span style={{ fontSize:11, color:'var(--text-tertiary)' }}>Online</span>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflowY:'auto', padding:20 }}>
          {messages.length === 0 && !loading ? (
            <div style={{ maxWidth:600, margin:'0 auto', paddingTop:40 }}>
              <div style={{ textAlign:'center', marginBottom:32 }}>
                <div style={{ width:64, height:64, borderRadius:20, background:'linear-gradient(135deg,rgba(48,209,88,0.2),rgba(10,132,255,0.2))', border:'1px solid rgba(48,209,88,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                  <Sparkles size={28} color="var(--text-green)"/>
                </div>
                <h2 style={{ fontSize:22, fontWeight:700, margin:'0 0 8px', letterSpacing:'-0.02em' }}>Your AI Coach</h2>
                <p style={{ fontSize:14, color:'var(--text-secondary)', lineHeight:1.6, marginBottom:8 }}>Ask me to explain financial concepts, help organize your budget and goals, or walk through what your numbers mean. I use the data you've entered to make explanations concrete.</p>
                <p style={{ fontSize:11, color:'var(--text-quaternary)', lineHeight:1.5 }}>I don't give personalized investment, tax, or legal advice, and I'm not a registered investment adviser — for decisions specific to your situation, a licensed professional is the right call.</p>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {QUICK_PROMPTS.map(p => (
                  <button key={p.text} onClick={() => handleSend(p.text)} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:12, background:'var(--bg-secondary)', border:'1px solid var(--border)', cursor:'pointer', textAlign:'left', transition:'border-color var(--transition-fast)' }} onMouseEnter={e => e.currentTarget.style.borderColor='rgba(48,209,88,0.3)'} onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
                    <span style={{ fontSize:20 }}>{p.icon}</span>
                    <span style={{ fontSize:12, fontWeight:500, color:'var(--text-primary)', lineHeight:1.3 }}>{p.text}</span>
                    <ChevronRight size={13} color="var(--text-tertiary)" style={{ marginLeft:'auto', flexShrink:0 }}/>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ maxWidth:740, margin:'0 auto', display:'flex', flexDirection:'column', gap:16 }}>
              {messages.map(m => (
                <div key={m.id} style={{ display:'flex', gap:12, flexDirection:m.role==='user'?'row-reverse':'row' }}>
                  <div style={{ width:32, height:32, borderRadius:10, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, background:m.role==='user'?'var(--green-400)':'linear-gradient(135deg,rgba(48,209,88,0.2),rgba(10,132,255,0.2))', border:m.role==='assistant'?'1px solid rgba(48,209,88,0.2)':'none', color:m.role==='user'?'#000':'var(--text-primary)' }}>
                    {m.role==='user'?'👤':<Bot size={16} color="var(--text-green)"/>}
                  </div>
                  <div style={{ maxWidth:'80%', padding:'12px 16px', borderRadius:16, background:m.role==='user'?'var(--green-400)':'var(--bg-secondary)', border:m.role==='assistant'?'1px solid var(--border)':'none', color:m.role==='user'?'#000':'var(--text-primary)' }}>
                    <MarkdownMessage content={m.content} isUser={m.role === 'user'} />
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display:'flex', gap:12 }}>
                  <div style={{ width:32, height:32, borderRadius:10, background:'linear-gradient(135deg,rgba(48,209,88,0.2),rgba(10,132,255,0.2))', border:'1px solid rgba(48,209,88,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}><Bot size={16} color="var(--text-green)"/></div>
                  <div style={{ padding:'14px 16px', borderRadius:16, background:'var(--bg-secondary)', border:'1px solid var(--border)' }}>
                    <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                      {[0,1,2].map(i => <div key={i} style={{ width:7, height:7, borderRadius:'50%', background:'var(--text-tertiary)', animation:`bounce 1.2s ease-in-out ${i*0.15}s infinite` }}/>)}
                    </div>
                  </div>
                </div>
              )}
              {error && (
                <div style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'12px 16px', borderRadius:12, background:'rgba(255,69,58,0.1)', border:'1px solid rgba(255,69,58,0.2)', maxWidth:'80%' }}>
                  <AlertCircle size={15} color="var(--text-red)" style={{ flexShrink:0, marginTop:1 }}/>
                  <span style={{ fontSize:13, color:'var(--text-red)', lineHeight:1.5 }}>{error}</span>
                </div>
              )}
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Input */}
        <div style={{ padding:'12px 20px 20px', borderTop:'1px solid var(--separator)', flexShrink:0 }}>
          <div style={{ maxWidth:740, margin:'0 auto', display:'flex', gap:10, alignItems:'flex-end', padding:'10px 14px', background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:16, transition:'border-color var(--transition-fast)' }} onFocus={() => {}} onBlur={() => {}}>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Ask your AI coach anything about wealth building..." rows={1} style={{ flex:1, background:'transparent', border:'none', outline:'none', resize:'none', color:'var(--text-primary)', fontSize:14, lineHeight:1.6, maxHeight:120, overflowY:'auto', fontFamily:'var(--font-system)' }}/>
            <button onClick={() => handleSend()} disabled={!input.trim() || loading} style={{ width:36, height:36, borderRadius:10, background:input.trim() && !loading?'var(--green-400)':'var(--bg-tertiary)', border:'none', cursor:input.trim() && !loading?'pointer':'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'background var(--transition-fast)' }}>
              <Send size={15} color={input.trim() && !loading?'#000':'var(--text-quaternary)'}/>
            </button>
          </div>
          <div style={{ maxWidth:740, margin:'6px auto 0', display:'flex', alignItems:'center', gap:6 }}>
            <Zap size={10} color="var(--text-quaternary)"/>
            <span style={{ fontSize:10, color:'var(--text-quaternary)' }}>Educational information only, not personalized financial, investment, tax, or legal advice. Finora is not a registered investment adviser.</span>
          </div>
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}`}</style>
    </div>
  )
}
