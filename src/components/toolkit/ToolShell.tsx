'use client'

import { ReactNode, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Save, Copy, Download, Share2, History, Trash2, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { SavedScenario } from '@/lib/toolkit/useToolkitHistory'

interface ToolShellProps<TInput, TResult> {
  title: string
  description: string
  categoryLabel: string
  inputsPanel: ReactNode
  resultsPanel: ReactNode
  scenarios: SavedScenario<TInput, TResult>[]
  onSave: (name: string) => void
  onDuplicate: (id: string) => void
  onRemove: (id: string) => void
  onLoad: (scenario: SavedScenario<TInput, TResult>) => void
}

export function ToolShell<TInput, TResult>({
  title, description, categoryLabel, inputsPanel, resultsPanel,
  scenarios, onSave, onDuplicate, onRemove, onLoad,
}: ToolShellProps<TInput, TResult>) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [copied, setCopied] = useState(false)

  const handleSave = () => {
    onSave(saveName)
    setSaveName('')
    setSaveOpen(false)
  }

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(`${title} — calculated on Finora Financial Toolkit. ${window.location.href}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard API unavailable — no-op, this is a nice-to-have
    }
  }

  return (
    <div className="page-container fade-in">
      <Link href="/financial-toolkit" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'none', marginBottom: 14 }}>
        <ChevronLeft size={14} /> Financial Toolkit
      </Link>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--green-400)', marginBottom: 4 }}>
            {categoryLabel}
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-primary)', margin: 0 }}>{title}</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '6px 0 0', maxWidth: 560, lineHeight: 1.5 }}>{description}</p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setHistoryOpen(v => !v)}>
            <History size={13} /> History{scenarios.length > 0 ? ` (${scenarios.length})` : ''}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleShare}>
            {copied ? <Check size={13} /> : <Share2 size={13} />} {copied ? 'Copied' : 'Share'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
            <Download size={13} /> Export PDF
          </button>
          <button className="btn btn-green btn-sm" onClick={() => setSaveOpen(v => !v)}>
            <Save size={13} /> Save
          </button>
        </div>
      </div>

      {/* Save form popover */}
      <AnimatePresence>
        {saveOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden', marginBottom: 16 }}
          >
            <div className="card" style={{ padding: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                className="input-field" placeholder="Name this scenario…" value={saveName}
                onChange={e => setSaveName(e.target.value)} style={{ flex: 1 }}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                autoFocus
              />
              <button className="btn btn-green btn-sm" onClick={handleSave}>Save Scenario</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History panel */}
      <AnimatePresence>
        {historyOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden', marginBottom: 16 }}
          >
            <div className="card" style={{ padding: scenarios.length ? 8 : 24 }}>
              {scenarios.length === 0 ? (
                <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>
                  No saved scenarios yet — click Save to keep this one for comparison later.
                </p>
              ) : scenarios.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{new Date(s.createdAt).toLocaleString()}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => onLoad(s)}>Load</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => onDuplicate(s.id)} title="Duplicate"><Copy size={13} /></button>
                  <button className="btn btn-ghost btn-sm" onClick={() => onRemove(s.id)} title="Delete" style={{ color: 'var(--text-red)' }}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="toolkit-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: 20, alignItems: 'start' }}>
        <div className="card" style={{ padding: 22, position: 'sticky', top: 84 }}>
          {inputsPanel}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {resultsPanel}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .toolkit-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
