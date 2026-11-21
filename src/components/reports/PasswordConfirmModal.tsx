'use client'

import { useState } from 'react'
import { X, Lock, Loader2, AlertCircle } from 'lucide-react'

interface PasswordConfirmModalProps {
  open: boolean
  format: 'pdf' | 'xlsx'
  onClose: () => void
  onSuccess: () => void
}

export function PasswordConfirmModal({ open, format, onClose, onSuccess }: PasswordConfirmModalProps) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handleSubmit = async () => {
    if (!password) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, password }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Something went wrong generating your report.')
        setLoading(false)
        return
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Finora-Report-${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)

      setPassword('')
      setLoading(false)
      onSuccess()
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
      <div className="card" style={{ width: '100%', maxWidth: 380, padding: 24, position: 'relative' }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
        >
          <X size={18} />
        </button>

        <div style={{
          width: 40, height: 40, borderRadius: 10, background: 'rgba(48,209,88,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
        }}>
          <Lock size={18} color="var(--text-green)" />
        </div>

        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
          Confirm your password
        </h2>
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px' }}>
          Your {format === 'pdf' ? 'PDF' : 'Excel'} report will be locked with your account password —
          the same one you use to sign in. Anyone opening the file will need it too.
        </p>

        <input
          className="input-field"
          type="password"
          placeholder="Your account password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          autoFocus
          disabled={loading}
          style={{ marginBottom: 10 }}
        />

        {error && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12, color: 'var(--text-red)', marginBottom: 10 }}>
            <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        <button
          className="btn btn-green"
          style={{ width: '100%' }}
          onClick={handleSubmit}
          disabled={loading || !password}
        >
          {loading ? <Loader2 size={14} className="spin" /> : <Lock size={14} />}
          {loading ? 'Generating…' : `Download Password-Protected ${format === 'pdf' ? 'PDF' : 'Excel'}`}
        </button>

        <style>{`
          .spin { animation: spin 0.8s linear infinite; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  )
}
