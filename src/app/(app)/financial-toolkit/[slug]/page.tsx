import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getToolBySlug } from '@/lib/toolkit/registry'
import { ToolGate } from '@/components/toolkit/ToolGate'

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tool = getToolBySlug(slug)
  if (!tool) notFound()

  if (tool.status === 'live' && tool.tier === 'free') {
    return <ToolGate tool={tool} />
  }

  return (
    <div className="page-container fade-in">
      <Link href="/financial-toolkit" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'none', marginBottom: 24 }}>
        <ChevronLeft size={14} /> Financial Toolkit
      </Link>
      <ToolGate tool={tool} />
    </div>
  )
}
