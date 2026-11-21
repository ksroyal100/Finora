import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { calculateMRR, getSubscriptionMetrics } from '@/services/subscription.service'

// POST /api/admin/cc/revenue/cron — called daily by Vercel Cron
// Schedule: 0 2 * * * (2 AM UTC daily)
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  // Fail closed: if CRON_SECRET is unset, never accept the literal string "Bearer undefined".
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  try {
    const [mrr, metrics] = await Promise.all([calculateMRR(), getSubscriptionMetrics()])

    // Get yesterday's metrics for delta calculations
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const { data: prevDay } = await db
      .from('revenue_metrics')
      .select('mrr, total_customers')
      .eq('date', yesterday.toISOString().split('T')[0])
      .single()

    const arr = mrr * 12
    const prevMRR = prevDay?.mrr ?? mrr
    const newMRR = Math.max(0, mrr - prevMRR)
    const churnMRR = Math.max(0, prevMRR - mrr)
    const netNewMRR = mrr - prevMRR

    // Marketplace revenue today
    const { data: mpOrders } = await db
      .from('marketplace_orders')
      .select('total')
      .eq('status', 'completed')
      .gte('created_at', new Date().toISOString().slice(0, 10))

    const mpRevenue = (mpOrders ?? []).reduce((s, o) => s + o.total, 0)
    const totalRevenue = mrr + mpRevenue

    // Customer counts by plan
    const planPrices = { pro: 19, plus: 39, elite: 79 } as Record<string, number>
    const totalPaid = metrics?.paid ?? 0
    const arpu = totalPaid > 0 ? mrr / totalPaid : 0
    const churnRate = prevDay?.total_customers && prevDay.total_customers > 0
      ? Math.max(0, (prevDay.total_customers - (metrics?.total ?? 0)) / prevDay.total_customers)
      : 0
    const retentionRate = 1 - churnRate
    const ltv = churnRate > 0 ? arpu / churnRate : arpu * 24

    await db.from('revenue_metrics').upsert({
      date: today,
      mrr,
      arr,
      new_mrr: newMRR,
      expansion_mrr: 0,
      contraction_mrr: 0,
      churn_mrr: churnMRR,
      net_new_mrr: netNewMRR,
      total_customers: metrics?.total ?? 0,
      free_users: metrics?.free ?? 0,
      pro_users: metrics?.pro ?? 0,
      plus_users: metrics?.plus ?? 0,
      elite_users: metrics?.elite ?? 0,
      marketplace_revenue: mpRevenue,
      total_revenue: totalRevenue,
      churn_rate: churnRate,
      retention_rate: retentionRate,
      ltv,
      arpu,
    }, { onConflict: 'date' })

    // Generate net worth snapshots for active users (sample)
    const { data: activeUsers } = await db
      .from('profiles')
      .select('id')
      .gte('last_active_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(100)

    for (const user of activeUsers ?? []) {
      try {
        await db.rpc('auto_net_worth_snapshot', { p_user_id: user.id })
      } catch {
        // Non-critical — one user's snapshot failing shouldn't stop the cron job
      }
    }

    // Trigger ATHENA financial summary if MRR changes significantly
    if (Math.abs(netNewMRR) > 100) {
      const { orchestrator } = await import('@/lib/agents/orchestrator')
      const summary = await orchestrator.delegateToAthena(
        `Daily MRR Update: MRR is now $${mrr.toFixed(2)} (${netNewMRR >= 0 ? '+' : ''}$${netNewMRR.toFixed(2)} vs yesterday). 
         ARR: $${arr.toFixed(2)}. Total customers: ${metrics?.total}. 
         Provide a brief financial insight and any concerning trends.`
      )

      await db.from('agent_reports').insert({
        agent_name: 'athena',
        title: `Daily Revenue Report: ${today}`,
        report_type: 'daily_revenue',
        content: summary.content,
        summary: `MRR: $${mrr.toFixed(2)} | ARR: $${arr.toFixed(2)} | Net new: ${netNewMRR >= 0 ? '+' : ''}$${netNewMRR.toFixed(2)}`,
        key_metrics: { mrr, arr, net_new_mrr: netNewMRR, total_customers: metrics?.total, arpu, ltv },
      })
    }

    return NextResponse.json({ success: true, date: today, mrr, arr })
  } catch (err) {
    console.error('[Revenue Cron]', err)
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 })
  }
}
