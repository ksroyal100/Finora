// ============================================================
// FINORA — Platform Constants
// ============================================================

// ── SUBSCRIPTION ──────────────────────────────────────────────

export const PLAN_PRICES = {
  pro:   { monthly: 19, yearly: 190 },
  plus:  { monthly: 39, yearly: 390 },
  elite: { monthly: 79, yearly: 790 },
} as const

export const YEARLY_DISCOUNT_PCT = 17  // ~2 months free

export const TRIAL_DAYS = 14

export const FREE_PLAN_LIMITS = {
  AI_QUERIES_PER_WEEK:     3,
  PORTFOLIO_ASSETS:        5,
  GOALS:                   3,
  BUDGET_CATEGORIES:       5,
} as const

// ── AI COACH ─────────────────────────────────────────────────

export const AI_COACH_LIMITS = {
  free:  3,     // per week
  pro:   -1,    // unlimited
  plus:  -1,
  elite: -1,
} as const

export const AI_MODELS = {
  COACH:   'openai/gpt-oss-20b',   // Fast, cheap for user coach (was llama-3.1-8b-instant, deprecated)
  AGENT:   'openai/gpt-oss-120b',  // Smart for agents (was llama-3.3-70b-versatile, deprecated)
  VISION:  'qwen/qwen3.6-27b',     // Multimodal (was llama-3.2-11b-vision-preview, deprecated)
} as const

// ── AGENTS ───────────────────────────────────────────────────

export const AGENT_NAMES = ['jarvis', 'athena', 'orion', 'titan', 'phoenix', 'merlin', 'sentinel'] as const

export const AGENT_COLORS = {
  jarvis:   '#7c3aed',
  athena:   '#ec4899',
  orion:    '#06b6d4',
  titan:    '#f59e0b',
  phoenix:  '#ef4444',
  merlin:   '#10b981',
  sentinel: '#94a3b8',
} as const

export const AGENT_EMOJIS = {
  jarvis:   '⚡',
  athena:   '💰',
  orion:    '🚀',
  titan:    '⚙️',
  phoenix:  '📈',
  merlin:   '🔍',
  sentinel: '🛡️',
} as const

// ── MARKETPLACE ───────────────────────────────────────────────

export const MARKETPLACE_COMMISSION_RATE = 0.15      // 15% platform fee
export const MARKETPLACE_MINIMUM_PAYOUT  = 10        // $10 minimum
export const MARKETPLACE_MAX_FILE_SIZE   = 500 * 1024 * 1024  // 500MB
export const MARKETPLACE_MAX_IMAGES      = 10

export const MARKETPLACE_CATEGORIES = [
  'investing', 'real_estate', 'startups', 'ai', 'software',
  'business', 'templates', 'courses', 'research_reports',
  'ai_prompt_packs', 'services', 'jobs', 'deals', 'acquisitions',
] as const

// ── COMMUNITY ─────────────────────────────────────────────────

export const COMMUNITY_MAX_POST_LENGTH    = 5000
export const COMMUNITY_MAX_COMMENT_LENGTH = 2000
export const COMMUNITY_MAX_MEDIA_FILES    = 10
export const REPUTATION_POINTS = {
  POST_CREATED:       5,
  COMMENT_CREATED:    2,
  POST_LIKED:         1,
  COURSE_COMPLETED:   50,
  GOAL_ACHIEVED:      25,
  REFERRAL_SIGNUP:    100,
} as const

// ── LEARNING ─────────────────────────────────────────────────

export const QUIZ_MIN_PASS_SCORE = 70  // 70%
export const QUIZ_MAX_ATTEMPTS   = 3

// ── PORTFOLIO ─────────────────────────────────────────────────

export const PORTFOLIO_MAX_ASSETS_FREE = 5
export const SUPPORTED_CURRENCIES = ['USD', 'GBP', 'EUR', 'CAD', 'AUD', 'JPY', 'CHF', 'INR'] as const
export const SUPPORTED_ASSET_CLASSES = ['stock', 'etf', 'crypto', 'bond', 'real_estate', 'commodity', 'cash', 'other'] as const

// ── RATE LIMITS ───────────────────────────────────────────────

export const RATE_LIMITS = {
  DEFAULT:    { requests: 60,  window: 60 },     // per minute
  AUTH:       { requests: 10,  window: 900 },    // per 15 min
  AI_COACH:   { requests: 20,  window: 60 },     // per minute
  MARKETPLACE:{ requests: 30,  window: 60 },
  ADMIN:      { requests: 200, window: 60 },
  WEBHOOK:    { requests: 100, window: 60 },
  STRICT:     { requests: 5,   window: 60 },
} as const

// ── SECURITY ─────────────────────────────────────────────────

export const SESSION_TIMEOUT_MINUTES = 60
export const ADMIN_SESSION_TIMEOUT_MINUTES = 30
export const MAX_LOGIN_ATTEMPTS = 5
export const LOCKOUT_DURATION_MINUTES = 15

export const SECURITY_EVENT_SEVERITY = {
  LOW:      'low',
  MEDIUM:   'medium',
  HIGH:     'high',
  CRITICAL: 'critical',
} as const

// ── STORAGE BUCKETS ───────────────────────────────────────────

export const STORAGE_BUCKETS = {
  AVATARS:    'avatars',
  MARKETPLACE:'marketplace',
  LEARNING:   'learning',
  COMMUNITY:  'community',
  VAULT:      'founder-vault',
  REPORTS:    'research-reports',
} as const

// ── NOTIFICATION TYPES ────────────────────────────────────────

export const NOTIFICATION_TYPES = [
  'system', 'billing', 'subscription', 'community',
  'marketplace', 'learning', 'research', 'goal',
  'portfolio', 'ai_coach', 'security', 'admin', 'agent',
] as const

// ── FINANCIAL HEALTH ──────────────────────────────────────────

export const HEALTH_SCORE_LABELS = {
  90: 'Excellent',
  75: 'Great',
  60: 'Good',
  45: 'Fair',
  30: 'Needs Work',
  0:  'Critical',
} as const

export const EMERGENCY_FUND_TARGET_MONTHS = 6
export const MIN_SAVINGS_RATE_PCT         = 20
export const HIGH_INTEREST_THRESHOLD_PCT  = 15  // Above this = high interest debt

// ── APP METADATA ──────────────────────────────────────────────

// Brand & ownership model (single source of truth — change it here, nowhere else):
//   WEALTHOS is the parent media & technology company (think Meta -> Instagram).
//   Finora is the product. Customer-facing UI shows Finora branding only; WEALTHOS appears
//   solely as the legal owner/operator in copyright and legal text, never as UI branding.
export const APP_NAME        = 'Finora'                 // the product
export const COMPANY_NAME    = 'WEALTHOS'               // parent company that owns and operates the product
export const PRODUCT_BYLINE  = `${APP_NAME} is a ${COMPANY_NAME} product`
export const APP_TAGLINE     = 'Your Wealth Creation Platform'
export const APP_DESCRIPTION = 'Build wealth through personal finance, investing, real estate, startups, and AI.'
export const SUPPORT_EMAIL   = 'support@finora.app'
export const LEGAL_EMAIL     = 'legal@wealthos.ai'      // company legal contact (parent company domain)

/** "© 2026 WEALTHOS. All rights reserved. Finora is a WEALTHOS product." */
export function copyrightLine(year: number = new Date().getFullYear()): string {
  return `© ${year} ${COMPANY_NAME}. All rights reserved. ${PRODUCT_BYLINE}.`
}

// NOTE: these handles currently belong to the parent company WEALTHOS. Create Finora-specific
// accounts and update them here when you have them.
export const SOCIAL_LINKS = {
  twitter:  'https://twitter.com/wealthos_ai',
  youtube:  'https://youtube.com/@wealthos',
  linkedin: 'https://linkedin.com/company/wealthos',
  github:   'https://github.com/wealthos',
} as const

// ── FEATURE FLAGS (defaults) ──────────────────────────────────

export const DEFAULT_FEATURE_FLAGS = {
  ENABLE_AI_COACH:           true,
  ENABLE_MARKETPLACE:        true,
  ENABLE_RESEARCH_CENTER:    true,
  ENABLE_COMMUNITY:          true,
  ENABLE_LEARNING_HUB:       true,
  ENABLE_CREATOR_STORES:     true,
  ENABLE_VOICE_AGENTS:       true,
  ENABLE_BETA_FEATURES:      false,
  MAINTENANCE_MODE:          false,
  ENABLE_REFERRAL_PROGRAM:   true,
} as const
