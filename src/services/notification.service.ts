// ============================================================
// FINORA — Notification Service
// ============================================================

import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'

type NotificationType =
  | 'system' | 'billing' | 'subscription' | 'community'
  | 'marketplace' | 'learning' | 'research' | 'goal'
  | 'portfolio' | 'ai_coach' | 'security' | 'admin' | 'agent'

interface NotificationParams {
  userId: string
  type: NotificationType
  title: string
  body: string
  actionUrl?: string
  actionLabel?: string
  imageUrl?: string
  data?: Record<string, unknown>
  channels?: ('in_app' | 'email')[]
  email?: {
    subject?: string
    template?: string
    templateData?: Record<string, unknown>
  }
}

// ── SEND NOTIFICATION ─────────────────────────────────────────

export async function sendNotification(params: NotificationParams) {
  const db = createAdminClient()
  const channels = params.channels ?? ['in_app']

  // Get user preferences
  const { data: prefs } = await db
    .from('notification_preferences')
    .select('*')
    .eq('user_id', params.userId)
    .single()

  const isInAppEnabled = prefs?.in_app_enabled ?? true
  const isEmailEnabled  = prefs?.email_enabled ?? true

  const typeKey = `${params.type}_notifications` as keyof typeof prefs
  const isTypeEnabled = prefs ? (prefs[typeKey] ?? true) : true

  if (!isTypeEnabled) return { sent: false, reason: 'user_preference' }

  const results: Record<string, boolean> = {}

  // In-app notification
  if (channels.includes('in_app') && isInAppEnabled) {
    const { error } = await db.from('notifications').insert({
      user_id: params.userId,
      type: params.type,
      channel: 'in_app',
      title: params.title,
      body: params.body,
      action_url: params.actionUrl ?? null,
      action_label: params.actionLabel ?? null,
      image_url: params.imageUrl ?? null,
      data: params.data ?? {},
      is_sent: true,
      sent_at: new Date().toISOString(),
    })
    results.in_app = !error
  }

  // Email notification
  if (channels.includes('email') && isEmailEnabled) {
    const { data: profile } = await db
      .from('profiles')
      .select('email, display_name')
      .eq('id', params.userId)
      .single()

    if (profile?.email) {
      const emailResult = await sendEmail({
        to: profile.email,
        subject: params.email?.subject ?? params.title,
        template: (params.email?.template as any) ?? 'generic',
        data: {
          name: profile.display_name ?? 'Wealth Builder',
          title: params.title,
          body: params.body,
          action_url: params.actionUrl,
          action_label: params.actionLabel,
          ...params.email?.templateData,
        },
      })

      // Record email notification
      await db.from('notifications').insert({
        user_id: params.userId,
        type: params.type,
        channel: 'email',
        title: params.title,
        body: params.body,
        action_url: params.actionUrl ?? null,
        is_sent: emailResult.success,
        sent_at: emailResult.success ? new Date().toISOString() : null,
      })

      results.email = emailResult.success
    }
  }

  return { sent: true, results }
}

// ── BULK NOTIFICATIONS ────────────────────────────────────────

export async function sendBulkNotification(
  userIds: string[],
  params: Omit<NotificationParams, 'userId'>
) {
  const db = createAdminClient()

  // Batch insert in-app notifications
  const rows = userIds.map(userId => ({
    user_id: userId,
    type: params.type,
    channel: 'in_app' as const,
    title: params.title,
    body: params.body,
    action_url: params.actionUrl ?? null,
    action_label: params.actionLabel ?? null,
    image_url: params.imageUrl ?? null,
    data: params.data ?? {},
    is_sent: true,
    sent_at: new Date().toISOString(),
  }))

  const { error } = await db.from('notifications').insert(rows)
  return { sent: !error, count: userIds.length }
}

// ── NOTIFY ALL USERS BY PLAN ──────────────────────────────────

export async function notifyUsersByPlan(
  plans: string[],
  params: Omit<NotificationParams, 'userId'>
) {
  const db = createAdminClient()
  const { data: users } = await db
    .from('subscriptions')
    .select('user_id')
    .in('plan', plans)
    .eq('status', 'active')

  if (!users?.length) return { sent: false, count: 0 }

  const userIds = users.map(u => u.user_id)
  return sendBulkNotification(userIds, params)
}

// ── SPECIFIC NOTIFICATION HELPERS ────────────────────────────

export async function notifyGoalMilestone(userId: string, goalTitle: string, progressPct: number) {
  const milestones = [25, 50, 75, 100]
  const milestone = milestones.find(m => progressPct >= m)
  if (!milestone) return

  const isComplete = milestone === 100
  return sendNotification({
    userId,
    type: 'goal',
    title: isComplete ? `🎉 Goal Complete: ${goalTitle}!` : `🎯 ${milestone}% Milestone: ${goalTitle}`,
    body: isComplete
      ? `Congratulations! You've achieved your goal!`
      : `You're ${milestone}% of the way there. Keep going!`,
    actionUrl: '/goals',
    actionLabel: 'View Goals',
  })
}

export async function notifySubscriptionExpiring(userId: string, daysLeft: number, plan: string) {
  return sendNotification({
    userId,
    type: 'billing',
    title: `Your ${plan} subscription expires in ${daysLeft} days`,
    body: 'Renew now to keep uninterrupted access to all premium features.',
    actionUrl: '/billing',
    actionLabel: 'Renew Now',
    channels: ['in_app', 'email'],
    email: { subject: `⚠️ Finora ${plan} expires in ${daysLeft} days` },
  })
}

export async function notifyPortfolioAlert(userId: string, symbol: string, change: number) {
  const isGain = change > 0
  return sendNotification({
    userId,
    type: 'portfolio',
    title: `${symbol} ${isGain ? '📈' : '📉'} ${isGain ? '+' : ''}${change.toFixed(2)}%`,
    body: `${symbol} has moved ${Math.abs(change).toFixed(2)}% today.`,
    actionUrl: '/portfolio',
    actionLabel: 'View Portfolio',
  })
}

export async function notifyAgentReport(userId: string, agentName: string, reportTitle: string, reportId: string) {
  return sendNotification({
    userId,
    type: 'agent',
    title: `📊 ${agentName.toUpperCase()}: ${reportTitle}`,
    body: `Your AI executive has completed a new report.`,
    actionUrl: `${process.env.NEXT_PUBLIC_ADMIN_URL ?? ''}/cc/agents?report=${reportId}`,
    actionLabel: 'Read Report',
    channels: ['in_app', 'email'],
    email: { template: 'agent_report', templateData: { agent_name: agentName, report_title: reportTitle } },
  })
}

export async function notifySecurityAlert(
  userId: string,
  eventType: string,
  ipAddress: string,
  time: string
) {
  return sendNotification({
    userId,
    type: 'security',
    title: `🔐 Security Alert: ${eventType}`,
    body: `Unusual activity detected on your account from ${ipAddress}.`,
    actionUrl: '/settings/security',
    actionLabel: 'Review Activity',
    channels: ['in_app', 'email'],
    email: {
      template: 'security_alert',
      templateData: { event_type: eventType, ip: ipAddress, time },
    },
  })
}

export async function notifyMarketplacePurchase(
  buyerId: string,
  productTitle: string,
  orderId: string
) {
  return sendNotification({
    userId: buyerId,
    type: 'marketplace',
    title: `✅ Purchase Complete: ${productTitle}`,
    body: 'Your purchase is ready. Access it in your library.',
    actionUrl: '/library',
    actionLabel: 'View Library',
    channels: ['in_app', 'email'],
    email: { template: 'order_receipt', templateData: { order_id: orderId } },
  })
}

export async function notifyWeeklyDigest(
  userId: string,
  data: {
    net_worth: number
    net_worth_change: number
    portfolio_change: number
    budget_pct: number
    goals_on_track: number
    total_goals: number
  }
) {
  // Check weekly digest preference
  const db = createAdminClient()
  const { data: prefs } = await db
    .from('notification_preferences')
    .select('weekly_digest, email_enabled')
    .eq('user_id', userId)
    .single()

  if (!prefs?.weekly_digest || !prefs?.email_enabled) return

  return sendNotification({
    userId,
    type: 'system',
    title: '📊 Your Weekly Wealth Summary',
    body: `Net worth changed ${data.net_worth_change >= 0 ? '+' : ''}$${Math.abs(data.net_worth_change).toFixed(0)} this week.`,
    actionUrl: '/dashboard',
    actionLabel: 'View Dashboard',
    channels: ['email'],
    email: { template: 'weekly_digest', templateData: data },
  })
}
