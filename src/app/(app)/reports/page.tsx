'use client'

import { useState } from 'react'
import { FileText, FileSpreadsheet, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { PasswordConfirmModal } from '@/components/reports/PasswordConfirmModal'

export default function ReportsPage() {
  const [modalFormat, setModalFormat] = useState<'pdf' | 'xlsx' | null>(null)
  const [justDownloaded, setJustDownloaded] = useState<'pdf' | 'xlsx' | null>(null)

  const handleSuccess = () => {
    setJustDownloaded(modalFormat)
    setModalFormat(null)
    setTimeout(() => setJustDownloaded(null), 4000)
  }

  return (
    <div className="page-container fade-in">
      <PageHeader
        title="Reports"
        description="Download a full snapshot of your net worth, portfolio, budget, and goals — encrypted with your account password."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 24 }}>
        <ReportCard
          icon={<FileText size={20} color="var(--text-red)" />}
          iconBg="rgba(255,69,58,0.12)"
          title="PDF Report"
          description="A clean, printable financial summary — ready to save or share."
          actionLabel="Download PDF"
          downloaded={justDownloaded === 'pdf'}
          onClick={() => setModalFormat('pdf')}
        />
        <ReportCard
          icon={<FileSpreadsheet size={20} color="var(--text-green)" />}
          iconBg="rgba(48,209,88,0.12)"
          title="Excel Workbook"
          description="Every number in editable sheets — net worth, portfolio, budget, and goals."
          actionLabel="Download Excel"
          downloaded={justDownloaded === 'xlsx'}
          onClick={() => setModalFormat('xlsx')}
        />
      </div>

      <div className="card" style={{ padding: 20, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: 'rgba(10,132,255,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <ShieldCheck size={17} color="var(--text-blue)" />
        </div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            Every report is password-protected
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            You'll be asked to confirm your account password before each download. That same password locks
            the file — anyone who gets a copy of it needs your sign-in password to open it. We never store
            the password anywhere; it's used once, in memory, to generate the file, then discarded.
          </p>
        </div>
      </div>

      <PasswordConfirmModal
        open={modalFormat !== null}
        format={modalFormat ?? 'pdf'}
        onClose={() => setModalFormat(null)}
        onSuccess={handleSuccess}
      />
    </div>
  )
}

function ReportCard({
  icon, iconBg, title, description, actionLabel, downloaded, onClick,
}: {
  icon: React.ReactNode; iconBg: string; title: string; description: string
  actionLabel: string; downloaded: boolean; onClick: () => void
}) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{title}</div>
      <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', lineHeight: 1.5, margin: '0 0 16px', minHeight: 36 }}>{description}</p>
      <button className="btn btn-secondary" style={{ width: '100%' }} onClick={onClick}>
        {downloaded ? <CheckCircle2 size={14} color="var(--text-green)" /> : null}
        {downloaded ? 'Downloaded' : actionLabel}
      </button>
    </div>
  )
}
