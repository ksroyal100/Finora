import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError } from '@/lib/security/rbac'
import { sendNotification } from '@/services/notification.service'
import { z } from 'zod'

const ONBOARDING_STEPS = [
  { step: 0, key: 'welcome',         title: 'Welcome to Finora',    description: 'Learn what Finora can do for you' },
  { step: 1, key: 'profile',         title: 'Complete Your Profile',  description: 'Add your name, location, and preferences' },
  { step: 2, key: 'net_worth',       title: 'Calculate Net Worth',    description: 'Add your assets and liabilities' },
  { step: 3, key: 'first_goal',      title: 'Set Your First Goal',    description: 'What are you building wealth for?' },
  { step: 4, key: 'portfolio',       title: 'Track Investments',      description: 'Add stocks, ETFs, crypto to your portfolio' },
  { step: 5, key: 'budget',          title: 'Create a Budget',        description: 'Track income and expenses' },
  { step: 6, key: 'ai_coach',        title: 'Meet Your AI Coach',     description: 'Ask your first wealth-building question' },
  { step: 7, key: 'community',       title: 'Join the Community',     description: 'Connect with other wealth builders' },
] as const

const stepSchema = z.object({
  step: z.number().min(0).max(7),
  completed: z.boolean().default(true),
})

// GET /api/onboarding — get current onboarding status
export const GET = withAuth(async (req, { userId }) => {
  const db = createAdminClient()
  const { data: profile } = await db
    .from('profiles')
    .select('onboarding_completed, onboarding_step, display_name, avatar_url')
    .eq('id', userId)
    .single()

  if (!profile) return apiError('Profile not found', 404)

  const currentStep = profile.onboarding_step ?? 0
  const completedSteps = ONBOARDING_STEPS.filter(s => s.step < currentStep)
  const nextStep = ONBOARDING_STEPS.find(s => s.step === currentStep)
  const progress = Math.round((currentStep / ONBOARDING_STEPS.length) * 100)

  return apiSuccess({
    is_completed: profile.onboarding_completed,
    current_step: currentStep,
    progress_pct: progress,
    steps: ONBOARDING_STEPS,
    completed_steps: completedSteps.map(s => s.key),
    next_step: nextStep ?? null,
    display_name: profile.display_name,
    has_avatar: !!profile.avatar_url,
  })
})

// POST /api/onboarding — advance onboarding step
export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const parsed = stepSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)

  const db = createAdminClient()
  const { data: profile } = await db.from('profiles').select('onboarding_step').eq('id', userId).single()

  const newStep = Math.max(profile?.onboarding_step ?? 0, parsed.data.step + 1)
  const isCompleted = newStep >= ONBOARDING_STEPS.length

  await db.from('profiles').update({
    onboarding_step: newStep,
    onboarding_completed: isCompleted,
  }).eq('id', userId)

  if (isCompleted) {
    await sendNotification({
      userId,
      type: 'system',
      title: '🎉 Onboarding Complete! Welcome to Finora',
      body: 'You\'re all set. Start building wealth with your AI coach, portfolio tracker, and more.',
      actionUrl: '/dashboard',
      actionLabel: 'Go to Dashboard',
    })
  }

  return apiSuccess({
    step_completed: parsed.data.step,
    next_step: newStep,
    onboarding_completed: isCompleted,
    progress_pct: Math.round((newStep / ONBOARDING_STEPS.length) * 100),
  })
})
