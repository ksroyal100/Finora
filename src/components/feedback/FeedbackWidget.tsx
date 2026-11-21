'use client'

import { useState } from 'react'
import { Star, X, MessageSquarePlus, Check } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function FeedbackWidget() {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [review, setReview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pathname = usePathname()

  const reset = () => {
    setOpen(false)
    setTimeout(() => { setRating(0); setReview(''); setSubmitted(false); setError(null) }, 200)
  }

  const submit = async () => {
    if (rating === 0) return
    setSubmitting(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Please sign in to leave feedback.')

      const { error: insertError } = await supabase
        .from('user_feedback')
        .insert({ user_id: user.id, rating, review: review.trim() || null, context: pathname })

      if (insertError) throw insertError
      setSubmitted(true)
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Give feedback"
          style={{
            position: 'fixed', bottom: 24, left: 24, zIndex: 200,
            width: 48, height: 48, borderRadius: 24, border: '1px solid var(--border)',
            background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: 'var(--shadow-md)',
          }}
        >
          <MessageSquarePlus size={20} />
        </button>
      )}

      {open && (
        <div
          style={{
            position: 'fixed', bottom: 24, left: 24, zIndex: 200,
            width: 320, borderRadius: 16, background: 'var(--bg-elevated)',
            border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
            padding: 20,
          }}
        >
          <button
            onClick={reset}
            aria-label="Close"
            style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>

          {submitted ? (
            <div style={{ textAlign: 'center', padding: '16px 4px' }}>
              <div style={{
                width: 44, height: 44, borderRadius: 22, margin: '0 auto 14px',
                background: 'color-mix(in srgb, var(--text-green) 14%, transparent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Check size={20} color="var(--text-green)" />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                Thank you for helping us!
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                Your feedback goes straight to our team and genuinely shapes what we build next.
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                How's Finora working for you?
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>
                Your rating and notes are only seen by our team — never shown to other users.
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 14, justifyContent: 'center' }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    aria-label={`${star} star${star > 1 ? 's' : ''}`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                  >
                    <Star
                      size={26}
                      color={star <= (hoverRating || rating) ? 'var(--text-gold)' : 'var(--text-quaternary)'}
                      fill={star <= (hoverRating || rating) ? 'var(--text-gold)' : 'none'}
                    />
                  </button>
                ))}
              </div>

              <textarea
                value={review}
                onChange={e => setReview(e.target.value)}
                placeholder="Anything specific? (optional)"
                maxLength={1000}
                style={{
                  width: '100%', minHeight: 70, resize: 'vertical', boxSizing: 'border-box',
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 10,
                  padding: '10px 12px', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit',
                  outline: 'none', marginBottom: 12,
                }}
              />

              {error && (
                <div style={{ fontSize: 12, color: 'var(--text-red)', marginBottom: 10 }}>{error}</div>
              )}

              <button
                onClick={submit}
                disabled={rating === 0 || submitting}
                className="btn btn-green btn-md"
                style={{ width: '100%', justifyContent: 'center', opacity: rating === 0 ? 0.5 : 1 }}
              >
                {submitting ? 'Sending…' : 'Send Feedback'}
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}
