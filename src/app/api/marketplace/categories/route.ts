import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/marketplace/categories — public category list with counts
export async function GET() {
  const db = createAdminClient()

  const { data: products } = await db
    .from('marketplace_products')
    .select('category')
    .eq('status', 'published')

  const categoryCounts = (products ?? []).reduce((acc, p) => {
    acc[p.category] = (acc[p.category] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const categories = [
    { key: 'investing',        label: 'Investing',          icon: '📈', description: 'Stocks, ETFs, portfolios' },
    { key: 'real_estate',      label: 'Real Estate',        icon: '🏠', description: 'Properties, REITs, analysis' },
    { key: 'startups',         label: 'Startups',           icon: '🚀', description: 'Startup playbooks, pitch decks' },
    { key: 'ai',               label: 'AI & Automation',    icon: '🤖', description: 'AI tools, prompts, workflows' },
    { key: 'software',         label: 'Software',           icon: '💻', description: 'SaaS tools, apps, scripts' },
    { key: 'business',         label: 'Business',           icon: '💼', description: 'Business plans, frameworks' },
    { key: 'templates',        label: 'Templates',          icon: '📋', description: 'Financial, legal, business templates' },
    { key: 'courses',          label: 'Courses',            icon: '🎓', description: 'Premium wealth-building courses' },
    { key: 'research_reports', label: 'Research Reports',   icon: '🔍', description: 'Market research, analysis' },
    { key: 'ai_prompt_packs',  label: 'AI Prompt Packs',   icon: '⚡', description: 'ChatGPT, Claude prompt collections' },
    { key: 'services',         label: 'Services',           icon: '🤝', description: 'Consulting, coaching, done-for-you' },
    { key: 'jobs',             label: 'Jobs & Gigs',        icon: '💰', description: 'Opportunities, side hustles' },
    { key: 'deals',            label: 'Deals',              icon: '🎯', description: 'Exclusive deals and discounts' },
    { key: 'acquisitions',     label: 'Acquisitions',       icon: '🏆', description: 'Businesses for sale' },
  ].map(cat => ({ ...cat, product_count: categoryCounts[cat.key] ?? 0 }))

  return NextResponse.json({
    success: true,
    data: categories,
    total_products: Object.values(categoryCounts).reduce((s, c) => s + c, 0),
  })
}
