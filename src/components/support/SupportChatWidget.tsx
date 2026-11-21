'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircle, X, Send, Loader2, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import MarkdownMessage from '@/components/shared/MarkdownMessage'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

interface Message { role: 'user' | 'assistant'; content: string }

const WELCOME: Message = {
  role: 'assistant',
  content: "Hi! I'm the Finora support assistant. Ask me how to use a feature, or troubleshoot an issue. For billing disputes, refunds, or account security, use the Contact page instead — I'll let you know if that's needed.",
}

export function SupportChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    const nextMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch(`${API_URL}/api/support/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          // Exclude the static welcome message — the API only needs real turns
          messages: nextMessages.filter(m => m !== WELCOME).slice(-10),
        }),
      })

      const body = await res.json()
      if (!res.ok || !body.success) {
        setError(body?.error ?? 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }

      setMessages(prev => [...prev, { role: 'assistant', content: body.data.reply }])
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating launcher button */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={open ? 'Close support chat' : 'Open support chat'}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 200,
          width: 52, height: 52, borderRadius: 26, border: 'none', cursor: 'pointer',
          background: open ? 'var(--bg-elevated)' : 'var(--green-400)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        }}
      >
        {open ? <X size={20} color="var(--text-primary)" /> : <MessageCircle size={22} color="#000" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 88, right: 24, zIndex: 200,
          width: 360, maxWidth: 'calc(100vw - 32px)', height: 480, maxHeight: 'calc(100vh - 140px)',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 18,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Finora Support</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>AI assistant · not financial advice</div>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '82%', padding: '9px 12px', borderRadius: 12, fontSize: 13, lineHeight: 1.5,
                  background: m.role === 'user' ? 'var(--green-400)' : 'var(--bg-tertiary)',
                  color: m.role === 'user' ? '#000' : 'var(--text-primary)',
                }}>
                  <MarkdownMessage content={m.content} isUser={m.role === 'user'} />
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '9px 12px', borderRadius: 12, background: 'var(--bg-tertiary)' }}>
                  <Loader2 size={14} className="spin" color="var(--text-tertiary)" />
                </div>
              </div>
            )}
            {error && <div style={{ fontSize: 12, color: 'var(--text-red)', textAlign: 'center' }}>{error}</div>}
          </div>

          <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input-field"
                placeholder="Ask a question…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                style={{ flex: 1, height: 38, fontSize: 13 }}
                disabled={loading}
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                style={{
                  width: 38, height: 38, borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: 'var(--green-400)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: loading || !input.trim() ? 0.5 : 1, flexShrink: 0,
                }}
              >
                <Send size={15} color="#000" />
              </button>
            </div>
            <a href="/contact" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8, textDecoration: 'none' }}>
              Need a human instead? Contact support <ExternalLink size={10} />
            </a>
          </div>
        </div>
      )}

      <style>{`
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}
