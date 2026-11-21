'use client'

import { useState } from 'react'
import { X, AlertTriangle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface DeleteAccountModalProps {
  open: boolean
  onClose: () => void
}

export function DeleteAccountModal({ open, onClose }: DeleteAccountModalProps) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  if (!open) return null

  const canSubmit = password.length > 0 && confirmation === 'DELETE'

  const handleDelete = async () => {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirmation }),
      })
      const body = await res.json()
      if (!res.ok || !body.success) {
        setError(body?.error ?? 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }

      // Account is gone server-side — clear the local session and leave
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/signin')
    } catch {
      setError('Network error — please try again.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 24, position: 'relative' }}>
        <button
          onClick={onClose}
          disabled={loading}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
        >
          <X size={18} />
        </button>

        <div style={{
          width: 40, height: 40, borderRadius: 10, background: 'rgba(255,69,58,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
        }}>
          <AlertTriangle size={18} color="var(--text-red)" />
        </div>

        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
          Delete your account?
        </h2>
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 16px' }}>
          This <strong>permanently</strong> deletes your profile, net worth, portfolio, budgets, goals, and
          every other record tied to your account. This cannot be undone.
        </p>

        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>
          Confirm your password
        </label>
        <input
          className="input-field"
          type="password"
          placeholder="Your account password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          disabled={loading}
          style={{ marginBottom: 14 }}
        />

        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>
          Type <strong style={{ color: 'var(--text-primary)' }}>DELETE</strong> to confirm
        </label>
        <input
          className="input-field"
          placeholder="DELETE"
          value={confirmation}
          onChange={e => setConfirmation(e.target.value)}
          disabled={loading}
          style={{ marginBottom: 10 }}
        />

        {error && (
          <div style={{ fontSize: 12, color: 'var(--text-red)', marginBottom: 10 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className="btn"
            style={{ flex: 1, background: 'var(--text-red)', color: '#fff', opacity: canSubmit && !loading ? 1 : 0.5 }}
            onClick={handleDelete}
            disabled={!canSubmit || loading}
          >
            {loading ? <Loader2 size={14} className="spin" /> : 'Delete My Account'}
          </button>
        </div>

        <style>{`.spin { animation: spin 0.8s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
