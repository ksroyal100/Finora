#!/usr/bin/env npx tsx
// ============================================================
// FINORA — Development Seed Script
// Run: npx tsx scripts/seed.ts
//
// DEVELOPMENT ONLY. It creates a founder account and demo users.
//  - It refuses to run when NODE_ENV=production.
//  - Against a non-local Supabase project it requires SEED_CONFIRM=yes.
//  - Passwords are NEVER hard-coded: set SEED_FOUNDER_PASSWORD / SEED_TEST_PASSWORD, or random ones
//    are generated and printed once at the end. Optionally set SEED_FOUNDER_EMAIL.
// ============================================================

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { randomBytes } from 'node:crypto'

config({ path: '.env.local' })

// ── safety rails: this script must never touch a real production database ──────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const isLocalDb = /localhost|127\.0\.0\.1/.test(supabaseUrl)
if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed: NODE_ENV=production. This script is for development databases only.')
  process.exit(1)
}
if (!isLocalDb && process.env.SEED_CONFIRM !== 'yes') {
  console.error(`Refusing to seed a non-local database (${supabaseUrl || 'URL not set'}).`)
  console.error('If this is a throwaway DEVELOPMENT project, re-run with SEED_CONFIRM=yes.')
  process.exit(1)
}

const randomPassword = () => randomBytes(15).toString('base64url')
const FOUNDER_EMAIL = process.env.SEED_FOUNDER_EMAIL ?? 'founder@finora.test'
const FOUNDER_PASSWORD = process.env.SEED_FOUNDER_PASSWORD ?? randomPassword()
const TEST_PASSWORD = process.env.SEED_TEST_PASSWORD ?? randomPassword()
const show = (generated: boolean, value: string) => (generated ? value : '(from environment)')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function seed() {
  console.log('🌱 Seeding Finora development database...\n')

  // ── 1. Admin User ─────────────────────────────────────────────
  console.log('👤 Creating admin user...')
  const { data: adminAuth } = await supabase.auth.admin.createUser({
    email: FOUNDER_EMAIL,
    password: FOUNDER_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Finora Founder' },
  })

  if (adminAuth?.user) {
    await supabase.from('profiles').update({ role: 'founder' }).eq('id', adminAuth.user.id)
    await supabase.from('admin_users').upsert({
      id: adminAuth.user.id,
      user_id: adminAuth.user.id,
      admin_role: 'founder',
      is_founder: true,
      permissions: { all: true },
      allowed_modules: ['*'],
      is_active: true,
    })
    await supabase.from('subscriptions').upsert({
      user_id: adminAuth.user.id,
      plan: 'elite',
      status: 'active',
    }, { onConflict: 'user_id' })
    console.log(`   ✅ Founder created: ${FOUNDER_EMAIL}`)
  }

  // ── 2. Test Users ─────────────────────────────────────────────
  console.log('\n👥 Creating test users...')
  const testUsers = [
    { email: 'pro@test.com', name: 'Pro User', plan: 'pro' },
    { email: 'plus@test.com', name: 'Plus User', plan: 'plus' },
    { email: 'free@test.com', name: 'Free User', plan: 'free' },
  ]

  for (const u of testUsers) {
    const { data: auth } = await supabase.auth.admin.createUser({
      email: u.email, password: TEST_PASSWORD, email_confirm: true,
      user_metadata: { full_name: u.name },
    })
    if (auth?.user) {
      await supabase.from('subscriptions').upsert({
        user_id: auth.user.id, plan: u.plan, status: 'active',
      }, { onConflict: 'user_id' })
      console.log(`   ✅ ${u.email} (${u.plan})`)
    }
  }

  // ── 3. Learning Categories ────────────────────────────────────
  console.log('\n📚 Creating learning categories...')
  const categories = [
    { name: 'Investing',       slug: 'investing',       icon: '📈', color: '#10b981', sort_order: 0 },
    { name: 'Personal Finance',slug: 'personal-finance',icon: '💰', color: '#7c3aed', sort_order: 1 },
    { name: 'Real Estate',     slug: 'real-estate',     icon: '🏠', color: '#f59e0b', sort_order: 2 },
    { name: 'Entrepreneurship',slug: 'entrepreneurship',icon: '🚀', color: '#ef4444', sort_order: 3 },
    { name: 'AI & Technology', slug: 'ai-technology',   icon: '🤖', color: '#06b6d4', sort_order: 4 },
    { name: 'Wealth Mindset',  slug: 'wealth-mindset',  icon: '🧠', color: '#8b5cf6', sort_order: 5 },
  ]

  const { error: catErr } = await supabase.from('learning_categories').upsert(categories, { onConflict: 'slug' })
  console.log(catErr ? `   ❌ ${catErr.message}` : `   ✅ ${categories.length} categories`)

  // ── 4. Achievements ───────────────────────────────────────────
  console.log('\n🏆 Creating achievements...')
  const achievements = [
    { name: 'First Steps',     slug: 'first-steps',     description: 'Complete your profile',       icon: '👣', points: 10,  criteria: { action: 'profile_complete' } },
    { name: 'Goal Setter',     slug: 'goal-setter',     description: 'Create your first goal',      icon: '🎯', points: 25,  criteria: { action: 'goal_created', count: 1 } },
    { name: 'Investor',        slug: 'investor',        description: 'Add your first holding',      icon: '📈', points: 50,  criteria: { action: 'holding_added', count: 1 } },
    { name: 'Budget Master',   slug: 'budget-master',   description: 'Track 30 transactions',       icon: '💰', points: 100, criteria: { action: 'transactions', count: 30 } },
    { name: 'Community Member',slug: 'community-member',description: 'Make your first post',        icon: '🤝', points: 15,  criteria: { action: 'post_created', count: 1 } },
    { name: 'Knowledge Seeker',slug: 'knowledge-seeker',description: 'Complete a course',          icon: '🎓', points: 75,  criteria: { action: 'course_completed', count: 1 } },
    { name: 'Wealth Builder',  slug: 'wealth-builder',  description: 'Reach $10K net worth',        icon: '💎', points: 200, criteria: { action: 'net_worth', threshold: 10000 } },
    { name: 'Millionaire Club',slug: 'millionaire-club',description: 'Reach $1M net worth',         icon: '🏆', points: 1000,criteria: { action: 'net_worth', threshold: 1000000 } },
    { name: 'AI Coach Fan',    slug: 'ai-coach-fan',    description: 'Have 10 AI conversations',    icon: '🤖', points: 30,  criteria: { action: 'ai_conversations', count: 10 } },
    { name: 'Market Watcher',  slug: 'market-watcher',  description: 'Save 10 research reports',    icon: '🔍', points: 50,  criteria: { action: 'reports_saved', count: 10 } },
  ]

  const { error: achErr } = await supabase.from('achievements').upsert(achievements, { onConflict: 'slug' })
  console.log(achErr ? `   ❌ ${achErr.message}` : `   ✅ ${achievements.length} achievements`)

  // ── 5. Feature Flags ─────────────────────────────────────────
  console.log('\n🚩 Creating feature flags...')
  const flags = [
    { key: 'enable_ai_coach',          name: 'AI Coach',            is_enabled: true,  rollout_percentage: 100 },
    { key: 'enable_marketplace',        name: 'Marketplace',         is_enabled: true,  rollout_percentage: 100 },
    { key: 'enable_research_center',    name: 'Research Center',     is_enabled: true,  rollout_percentage: 100 },
    { key: 'enable_community',          name: 'Community',           is_enabled: true,  rollout_percentage: 100 },
    { key: 'enable_learning_hub',       name: 'Learning Hub',        is_enabled: true,  rollout_percentage: 100 },
    { key: 'enable_creator_stores',     name: 'Creator Stores',      is_enabled: true,  rollout_percentage: 100, allowed_plans: ['plus', 'elite'] },
    { key: 'enable_voice_agents',       name: 'Voice Agents',        is_enabled: true,  rollout_percentage: 100 },
    { key: 'enable_beta_features',      name: 'Beta Features',       is_enabled: false, rollout_percentage: 0 },
    { key: 'maintenance_mode',          name: 'Maintenance Mode',    is_enabled: false, rollout_percentage: 0 },
    { key: 'enable_referral_program',   name: 'Referral Program',    is_enabled: true,  rollout_percentage: 100 },
  ]

  const { error: flagErr } = await supabase.from('feature_flags').upsert(flags, { onConflict: 'key' })
  console.log(flagErr ? `   ❌ ${flagErr.message}` : `   ✅ ${flags.length} feature flags`)

  // ── 6. System Config ─────────────────────────────────────────
  console.log('\n⚙️  Creating system config...')
  const config_items = [
    { key: 'app_name',             value: '"Finora"',             description: 'Platform name',                   is_public: true },
    { key: 'support_email',        value: '"support@finora.app"',  description: 'Support email',                   is_public: true },
    { key: 'marketplace_commission',value: '0.15',                  description: 'Platform commission rate (15%)',  is_public: false },
    { key: 'min_payout_amount',    value: '10',                     description: 'Minimum creator payout ($10)',    is_public: false },
    { key: 'trial_days',           value: '14',                     description: 'Free trial duration',            is_public: true },
    { key: 'ai_weekly_limit_free', value: '3',                      description: 'AI queries per week (free plan)',is_public: true },
  ]

  for (const item of config_items) {
    await supabase.from('system_config').upsert({ ...item, value: JSON.parse(item.value) }, { onConflict: 'key' })
  }
  console.log(`   ✅ ${config_items.length} config items`)

  // ── 7. Revenue Metrics Seed ───────────────────────────────────
  console.log('\n📊 Seeding revenue metrics history...')
  const today = new Date()
  const metricsRows = []
  for (let i = 30; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const baseMRR = 1000 + (30 - i) * 50 + Math.random() * 100
    metricsRows.push({
      date: date.toISOString().split('T')[0],
      mrr: Math.round(baseMRR),
      arr: Math.round(baseMRR * 12),
      total_customers: 50 + (30 - i) * 3,
      free_users: 40 + (30 - i) * 2,
      pro_users: 8 + (30 - i),
      plus_users: 2,
      elite_users: 1,
      marketplace_revenue: Math.round(Math.random() * 500),
      total_revenue: Math.round(baseMRR + Math.random() * 500),
      churn_rate: 0.02,
      retention_rate: 0.98,
      arpu: Math.round(baseMRR / (8 + (30 - i))),
      ltv: Math.round(baseMRR / (8 + (30 - i)) * 24),
    })
  }

  const { error: metricsErr } = await supabase.from('revenue_metrics').upsert(metricsRows, { onConflict: 'date' })
  console.log(metricsErr ? `   ❌ ${metricsErr.message}` : `   ✅ 31 days of revenue metrics`)

  console.log('\n✅ Seeding complete!\n')
  console.log('🔑 Login credentials:')
  console.log(`   Founder:  ${FOUNDER_EMAIL} / ${show(!process.env.SEED_FOUNDER_PASSWORD, FOUNDER_PASSWORD)}`)
  console.log(`   Demo users (pro@test.com, plus@test.com, free@test.com) / ${show(!process.env.SEED_TEST_PASSWORD, TEST_PASSWORD)}`)
  console.log('   Passwords are shown only once. Store them somewhere safe if you need them again.\n')
}

seed().catch(err => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
