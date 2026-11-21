// ============================================================
// FINORA — Core TypeScript Types
// ============================================================

// ── BASE ─────────────────────────────────────────────────────

export type UUID = string
export type ISO8601 = string
export type CurrencyCode = 'USD' | 'GBP' | 'EUR' | 'CAD' | 'AUD'

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  code?: string
}

export interface ApiError {
  success: false
  error: string
  code: string
  details?: Record<string, string[]>
}

// ── ENUMS ────────────────────────────────────────────────────

export type SubscriptionPlan = 'free' | 'pro' | 'plus' | 'elite'
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused' | 'incomplete'
export type BillingInterval = 'monthly' | 'yearly'
export type UserRole = 'user' | 'creator' | 'moderator' | 'admin' | 'super_admin' | 'founder'
export type AssetClass = 'stock' | 'etf' | 'crypto' | 'bond' | 'real_estate' | 'commodity' | 'cash' | 'other'
export type TransactionType = 'buy' | 'sell' | 'dividend' | 'split' | 'transfer' | 'deposit' | 'withdrawal'
export type GoalStatus = 'active' | 'completed' | 'paused' | 'abandoned'
export type GoalCategory = 'emergency_fund' | 'retirement' | 'home' | 'education' | 'vacation' | 'business' | 'investment' | 'debt_payoff' | 'other'
export type AssetType = 'cash' | 'investment' | 'real_estate' | 'business' | 'vehicle' | 'personal' | 'retirement' | 'crypto' | 'other'
export type LiabilityType = 'mortgage' | 'auto_loan' | 'student_loan' | 'credit_card' | 'personal_loan' | 'medical' | 'tax' | 'other'
export type MarketplaceCategory = 'investing' | 'real_estate' | 'startups' | 'ai' | 'software' | 'business' | 'templates' | 'courses' | 'research_reports' | 'ai_prompt_packs' | 'services' | 'jobs' | 'deals' | 'acquisitions'
export type ProductStatus = 'draft' | 'pending_review' | 'published' | 'archived' | 'rejected'
export type OrderStatus = 'pending' | 'processing' | 'completed' | 'refunded' | 'disputed' | 'canceled'
export type AgentName = 'jarvis' | 'athena' | 'orion' | 'titan' | 'phoenix' | 'merlin' | 'sentinel'
export type AgentStatus = 'idle' | 'thinking' | 'working' | 'waiting' | 'error' | 'offline'
export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed' | 'canceled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical' | 'urgent'
export type WorkflowStatus = 'draft' | 'running' | 'paused' | 'completed' | 'failed' | 'canceled'
export type AdminRole = 'super_admin' | 'founder' | 'admin' | 'analyst' | 'moderator' | 'support'

// ── USER & PROFILE ────────────────────────────────────────────

export interface Profile {
  id: UUID
  email: string
  username: string | null
  display_name: string | null
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  website: string | null
  location: string | null
  timezone: string
  currency: string
  country_code: string
  role: UserRole
  kyc_status: 'none' | 'pending' | 'verified' | 'rejected'
  is_creator: boolean
  is_verified: boolean
  is_banned: boolean
  banned_at: ISO8601 | null
  banned_reason: string | null
  referral_code: string
  referred_by: UUID | null
  onboarding_completed: boolean
  onboarding_step: number
  last_active_at: ISO8601
  metadata: Record<string, unknown>
  created_at: ISO8601
  updated_at: ISO8601
}

export interface ProfileWithSubscription extends Profile {
  subscription: Subscription | null
  follower_count?: number
  following_count?: number
  reputation?: number
}

// ── SUBSCRIPTION & BILLING ────────────────────────────────────

export interface SubscriptionPlanConfig {
  id: UUID
  name: SubscriptionPlan
  display_name: string
  description: string | null
  price_monthly: number
  price_yearly: number
  stripe_price_monthly_id: string | null
  stripe_price_yearly_id: string | null
  features: string[]
  limits: PlanLimits
  is_active: boolean
  sort_order: number
}

export interface PlanLimits {
  ai_queries_per_week: number  // -1 = unlimited
  portfolio_assets: number
  goals: number
  budget_categories: number
  marketplace_purchases: boolean
  research_access: boolean
  marketplace_free_only: boolean
  creator_store?: boolean
  api_access?: boolean
  white_label?: boolean
  custom_integrations?: boolean
}

export interface Subscription {
  id: UUID
  user_id: UUID
  plan: SubscriptionPlan
  status: SubscriptionStatus
  interval: BillingInterval | null
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  stripe_price_id: string | null
  trial_starts_at: ISO8601 | null
  trial_ends_at: ISO8601 | null
  current_period_start: ISO8601 | null
  current_period_end: ISO8601 | null
  cancel_at: ISO8601 | null
  canceled_at: ISO8601 | null
  cancel_reason: string | null
  coupon_code: string | null
  discount_percent: number
  metadata: Record<string, unknown>
  created_at: ISO8601
  updated_at: ISO8601
}

export interface Invoice {
  id: UUID
  user_id: UUID
  subscription_id: UUID | null
  stripe_invoice_id: string | null
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'
  amount_due: number
  amount_paid: number
  currency: string
  description: string | null
  invoice_pdf: string | null
  hosted_invoice_url: string | null
  period_start: ISO8601 | null
  period_end: ISO8601 | null
  due_date: ISO8601 | null
  paid_at: ISO8601 | null
  created_at: ISO8601
}

// ── PORTFOLIO ─────────────────────────────────────────────────

export interface Portfolio {
  id: UUID
  user_id: UUID
  name: string
  description: string | null
  currency: string
  is_default: boolean
  is_public: boolean
  total_value: number
  total_cost: number
  total_gain_loss: number
  total_gain_loss_pct: number
  day_change: number
  day_change_pct: number
  last_synced_at: ISO8601 | null
  created_at: ISO8601
  updated_at: ISO8601
}

export interface PortfolioHolding {
  id: UUID
  portfolio_id: UUID
  user_id: UUID
  symbol: string
  name: string | null
  asset_class: AssetClass
  quantity: number
  avg_cost: number
  current_price: number
  market_value: number
  unrealized_gain: number
  unrealized_gain_pct: number
  day_change: number
  day_change_pct: number
  weight_pct: number
  currency: string
  exchange: string | null
  sector: string | null
  industry: string | null
  logo_url: string | null
  last_updated_at: ISO8601
  created_at: ISO8601
}

export interface PortfolioTransaction {
  id: UUID
  portfolio_id: UUID
  user_id: UUID
  holding_id: UUID | null
  symbol: string
  type: TransactionType
  quantity: number
  price: number
  total_amount: number
  fees: number
  currency: string
  notes: string | null
  transaction_date: string
  created_at: ISO8601
}

// ── GOALS ─────────────────────────────────────────────────────

export interface Goal {
  id: UUID
  user_id: UUID
  title: string
  description: string | null
  category: GoalCategory
  status: GoalStatus
  target_amount: number
  current_amount: number
  currency: string
  target_date: string | null
  started_at: string
  completed_at: ISO8601 | null
  monthly_contribution: number | null
  priority: number
  icon: string | null
  color: string | null
  is_public: boolean
  progress_pct: number
  created_at: ISO8601
  updated_at: ISO8601
}

export interface GoalMilestone {
  id: UUID
  goal_id: UUID
  title: string
  amount: number
  reached_at: ISO8601 | null
  notes: string | null
  created_at: ISO8601
}

// ── NET WORTH ─────────────────────────────────────────────────

export interface Asset {
  id: UUID
  user_id: UUID
  name: string
  type: AssetType
  value: number
  currency: string
  institution: string | null
  account_number_last4: string | null
  notes: string | null
  is_active: boolean
  last_valued_at: string
  created_at: ISO8601
  updated_at: ISO8601
}

export interface Liability {
  id: UUID
  user_id: UUID
  name: string
  type: LiabilityType
  balance: number
  original_amount: number | null
  interest_rate: number
  minimum_payment: number
  currency: string
  institution: string | null
  due_date: string | null
  is_active: boolean
  notes: string | null
  created_at: ISO8601
  updated_at: ISO8601
}

export interface NetWorthSnapshot {
  id: UUID
  user_id: UUID
  total_assets: number
  total_liabilities: number
  net_worth: number
  snapshot_date: string
  notes: string | null
  created_at: ISO8601
}

// ── BUDGETING ─────────────────────────────────────────────────

export interface Budget {
  id: UUID
  user_id: UUID
  name: string
  period: 'weekly' | 'monthly' | 'yearly'
  total_income: number
  total_budgeted: number
  total_spent: number
  currency: string
  start_date: string
  end_date: string
  is_active: boolean
  created_at: ISO8601
  updated_at: ISO8601
}

export interface BudgetCategory {
  id: UUID
  budget_id: UUID
  user_id: UUID
  name: string
  icon: string | null
  color: string | null
  budgeted_amount: number
  spent_amount: number
  remaining_amount: number
  is_income: boolean
  sort_order: number
  created_at: ISO8601
}

export interface BudgetTransaction {
  id: UUID
  budget_id: UUID
  category_id: UUID
  user_id: UUID
  description: string
  amount: number
  is_income: boolean
  date: string
  merchant: string | null
  notes: string | null
  receipt_url: string | null
  is_recurring: boolean
  tags: string[]
  created_at: ISO8601
}

// ── AI COACH ─────────────────────────────────────────────────

export interface AIConversation {
  id: UUID
  user_id: UUID
  title: string
  context: Record<string, unknown>
  message_count: number
  last_message_at: ISO8601 | null
  is_archived: boolean
  created_at: ISO8601
  updated_at: ISO8601
}

export interface AIMessage {
  id: UUID
  conversation_id: UUID
  user_id: UUID
  role: 'user' | 'assistant' | 'system'
  content: string
  tokens_used: number
  model: string | null
  metadata: Record<string, unknown>
  created_at: ISO8601
}

export interface AIUsageStatus {
  queries_used: number
  queries_limit: number
  queries_remaining: number
  week_start: string
  week_end: string
  is_unlimited: boolean
  plan: SubscriptionPlan
}

// ── LEARNING ─────────────────────────────────────────────────

export interface Course {
  id: UUID
  creator_id: UUID
  category_id: UUID | null
  title: string
  slug: string
  description: string | null
  short_description: string | null
  thumbnail_url: string | null
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  status: 'draft' | 'published' | 'archived'
  is_free: boolean
  price: number
  currency: string
  required_plan: SubscriptionPlan
  duration_minutes: number
  lesson_count: number
  enrollment_count: number
  average_rating: number
  rating_count: number
  tags: string[]
  certificate_enabled: boolean
  published_at: ISO8601 | null
  created_at: ISO8601
}

export interface Lesson {
  id: UUID
  course_id: UUID
  title: string
  slug: string
  description: string | null
  content: string | null
  video_url: string | null
  video_duration_seconds: number
  type: 'video' | 'article' | 'quiz' | 'assignment'
  sort_order: number
  is_free: boolean
  is_published: boolean
  estimated_minutes: number
  created_at: ISO8601
}

export interface CourseEnrollment {
  id: UUID
  course_id: UUID
  user_id: UUID
  enrolled_at: ISO8601
  completed_at: ISO8601 | null
  progress_pct: number
  last_lesson_id: UUID | null
  is_active: boolean
}

export interface Certificate {
  id: UUID
  user_id: UUID
  course_id: UUID
  certificate_number: string
  issued_at: ISO8601
  pdf_url: string | null
}

// ── COMMUNITY ─────────────────────────────────────────────────

export interface Post {
  id: UUID
  user_id: UUID
  group_id: UUID | null
  title: string | null
  content: string
  type: 'text' | 'image' | 'video' | 'link' | 'poll'
  status: 'draft' | 'published' | 'flagged' | 'removed'
  media_urls: string[]
  like_count: number
  comment_count: number
  share_count: number
  view_count: number
  is_pinned: boolean
  is_featured: boolean
  tags: string[]
  created_at: ISO8601
  updated_at: ISO8601
  author?: Profile
  is_liked?: boolean
  is_bookmarked?: boolean
}

export interface PostComment {
  id: UUID
  post_id: UUID
  user_id: UUID
  parent_id: UUID | null
  content: string
  like_count: number
  is_flagged: boolean
  is_removed: boolean
  created_at: ISO8601
  author?: Profile
  replies?: PostComment[]
}

export interface CommunityGroup {
  id: UUID
  creator_id: UUID
  name: string
  slug: string
  description: string | null
  avatar_url: string | null
  is_public: boolean
  is_verified: boolean
  member_count: number
  post_count: number
  required_plan: SubscriptionPlan
  tags: string[]
  created_at: ISO8601
  is_member?: boolean
}

// ── RESEARCH ─────────────────────────────────────────────────

export interface ResearchReport {
  id: UUID
  author_id: UUID
  title: string
  slug: string
  summary: string | null
  content: string | null
  report_type: 'market' | 'stock' | 'etf' | 'real_estate' | 'ai' | 'software' | 'startup' | 'macro'
  tags: string[]
  thumbnail_url: string | null
  pdf_url: string | null
  required_plan: SubscriptionPlan
  view_count: number
  save_count: number
  is_published: boolean
  is_featured: boolean
  published_at: ISO8601 | null
  created_at: ISO8601
  author?: Profile
  is_saved?: boolean
}

export interface Watchlist {
  id: UUID
  user_id: UUID
  name: string
  description: string | null
  symbols: string[]
  is_default: boolean
  is_public: boolean
  created_at: ISO8601
  updated_at: ISO8601
}

// ── MARKETPLACE ───────────────────────────────────────────────

export interface MarketplaceProduct {
  id: UUID
  creator_id: UUID
  store_id: UUID | null
  title: string
  slug: string
  description: string | null
  short_description: string | null
  category: MarketplaceCategory
  subcategory: string | null
  status: ProductStatus
  price: number
  compare_price: number | null
  currency: string
  is_free: boolean
  thumbnail_url: string | null
  preview_url: string | null
  media_urls: string[]
  tags: string[]
  features: string[]
  purchase_count: number
  view_count: number
  wishlist_count: number
  average_rating: number
  rating_count: number
  required_plan: SubscriptionPlan
  is_featured: boolean
  is_digital: boolean
  license_type: string
  requirements: string[]
  metadata: Record<string, unknown>
  published_at: ISO8601 | null
  created_at: ISO8601
  creator?: Profile
  store?: CreatorStore
  is_purchased?: boolean
  is_wishlisted?: boolean
}

export interface MarketplaceOrder {
  id: UUID
  buyer_id: UUID
  order_number: string
  status: OrderStatus
  subtotal: number
  discount: number
  platform_fee: number
  total: number
  currency: string
  stripe_payment_intent_id: string | null
  coupon_code: string | null
  completed_at: ISO8601 | null
  created_at: ISO8601
  items?: MarketplaceOrderItem[]
}

export interface MarketplaceOrderItem {
  id: UUID
  order_id: UUID
  product_id: UUID
  creator_id: UUID
  title: string
  price: number
  quantity: number
  subtotal: number
  commission_rate: number
  commission_amount: number
  creator_revenue: number
  download_url: string | null
  access_granted_at: ISO8601 | null
  created_at: ISO8601
}

export interface CreatorStore {
  id: UUID
  user_id: UUID
  store_name: string
  slug: string
  description: string | null
  tagline: string | null
  logo_url: string | null
  banner_url: string | null
  is_verified: boolean
  is_active: boolean
  total_sales: number
  total_revenue: number
  average_rating: number
  stripe_account_status: string
  commission_rate: number
  created_at: ISO8601
}

export interface ProductReview {
  id: UUID
  product_id: UUID
  user_id: UUID
  rating: number
  title: string | null
  content: string | null
  is_verified_purchase: boolean
  helpful_count: number
  is_featured: boolean
  created_at: ISO8601
  author?: Profile
}

export interface CreatorPayout {
  id: UUID
  creator_id: UUID
  amount: number
  currency: string
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'canceled'
  stripe_transfer_id: string | null
  period_start: string
  period_end: string
  order_count: number
  paid_at: ISO8601 | null
  created_at: ISO8601
}

// ── NOTIFICATIONS ─────────────────────────────────────────────

export interface Notification {
  id: UUID
  user_id: UUID
  type: string
  channel: 'in_app' | 'email' | 'push'
  title: string
  body: string
  action_url: string | null
  action_label: string | null
  image_url: string | null
  is_read: boolean
  read_at: ISO8601 | null
  data: Record<string, unknown>
  created_at: ISO8601
}

// ── FINANCIAL HEALTH ──────────────────────────────────────────

export interface FinancialHealthScore {
  id: UUID
  user_id: UUID
  overall_score: number
  emergency_fund_score: number
  debt_score: number
  savings_rate_score: number
  investment_score: number
  insurance_score: number
  snapshot_date: string
  insights: HealthInsight[]
  recommendations: HealthRecommendation[]
  created_at: ISO8601
}

export interface HealthInsight {
  type: string
  title: string
  description: string
  severity: 'positive' | 'neutral' | 'warning' | 'danger'
}

export interface HealthRecommendation {
  priority: number
  action: string
  description: string
  impact: 'low' | 'medium' | 'high'
}

// ── DASHBOARD ─────────────────────────────────────────────────

export interface WealthDashboard {
  net_worth: number
  net_worth_change: number
  net_worth_change_pct: number
  total_assets: number
  total_liabilities: number
  total_income: number
  total_expenses: number
  savings_rate: number
  portfolio_value: number
  portfolio_day_change: number
  cash_flow: number
  health_score: number
  active_goals: number
  goals_on_track: number
  monthly_budget_used_pct: number
  recent_transactions: BudgetTransaction[]
  top_holdings: PortfolioHolding[]
  recent_goals: Goal[]
  net_worth_history: NetWorthSnapshot[]
}

// ── COMMAND CENTER ────────────────────────────────────────────

export interface Agent {
  id: UUID
  name: AgentName
  display_name: string
  title: string
  avatar_url: string | null
  personality: AgentPersonality
  capabilities: string[]
  status: AgentStatus
  current_task_id: UUID | null
  model: string
  temperature: number
  max_tokens: number
  voice_config: VoiceConfig
  memory_collection: string | null
  is_active: boolean
  total_tasks_completed: number
  total_tokens_used: number
  last_active_at: ISO8601 | null
  created_at: ISO8601
}

export interface AgentPersonality {
  tone: string
  style: string
  traits: string[]
}

export interface VoiceConfig {
  provider: 'edge_tts' | 'piper' | 'kokoro' | 'whisper'
  voice: string
  rate: string
  pitch: string
  language?: string
}

export interface AgentConversation {
  id: UUID
  agent_name: AgentName
  initiator_id: UUID
  title: string
  context: Record<string, unknown>
  message_count: number
  total_tokens_used: number
  last_message_at: ISO8601 | null
  is_archived: boolean
  conversation_type: 'chat' | 'voice' | 'task' | 'report'
  created_at: ISO8601
}

export interface AgentMessage {
  id: UUID
  conversation_id: UUID
  role: 'user' | 'agent' | 'system' | 'tool'
  content: string
  agent_name: AgentName | null
  tokens_used: number
  model: string | null
  voice_audio_url: string | null
  tool_calls: unknown[] | null
  tool_results: unknown[] | null
  is_voice: boolean
  created_at: ISO8601
}

export interface AgentTask {
  id: UUID
  assigned_to: AgentName
  assigned_by: AgentName | null
  created_by: UUID
  workflow_id: UUID | null
  title: string
  description: string | null
  priority: TaskPriority
  status: TaskStatus
  input_data: Record<string, unknown>
  output_data: Record<string, unknown>
  dependencies: UUID[]
  due_at: ISO8601 | null
  started_at: ISO8601 | null
  completed_at: ISO8601 | null
  failure_reason: string | null
  retry_count: number
  progress_pct: number
  tokens_used: number
  created_at: ISO8601
  updated_at: ISO8601
}

export interface AgentWorkflow {
  id: UUID
  created_by: UUID
  title: string
  description: string | null
  goal: string
  status: WorkflowStatus
  orchestrator: AgentName
  participating_agents: AgentName[]
  steps: WorkflowStep[]
  current_step: number
  total_steps: number
  input_data: Record<string, unknown>
  output_data: Record<string, unknown>
  final_report: string | null
  scheduled_at: ISO8601 | null
  started_at: ISO8601 | null
  completed_at: ISO8601 | null
  duration_seconds: number | null
  tokens_used: number
  is_recurring: boolean
  cron_expression: string | null
  next_run_at: ISO8601 | null
  created_at: ISO8601
}

export interface WorkflowStep {
  id: string
  title: string
  description: string
  agent: AgentName
  action: string
  input_mapping: Record<string, string>
  output_mapping: Record<string, string>
  depends_on: string[]
  status: TaskStatus
  started_at?: ISO8601
  completed_at?: ISO8601
  result?: unknown
}

export interface AgentReport {
  id: UUID
  agent_name: AgentName
  workflow_id: UUID | null
  title: string
  report_type: string
  content: string
  summary: string | null
  key_metrics: Record<string, unknown>
  recommendations: string[]
  action_items: string[]
  is_pinned: boolean
  is_archived: boolean
  created_at: ISO8601
}

export interface AgentDecision {
  id: UUID
  agent_name: AgentName
  task_id: UUID | null
  workflow_id: UUID | null
  title: string
  situation: string
  decision: string
  rationale: string | null
  confidence_score: number
  requires_approval: boolean
  approved_by: UUID | null
  approved_at: ISO8601 | null
  is_executed: boolean
  created_at: ISO8601
}

export interface VaultDocument {
  id: UUID
  title: string
  slug: string
  document_type: 'business_plan' | 'strategy' | 'acquisition_target' | 'investment_opportunity' | 'company_vision' | 'confidential_report' | 'financial_projection' | 'legal' | 'other'
  content: string | null
  summary: string | null
  file_url: string | null
  is_encrypted: boolean
  tags: string[]
  priority: number
  created_by: UUID | null
  last_accessed_at: ISO8601 | null
  created_at: ISO8601
  updated_at: ISO8601
}

export interface CompanyGoal {
  id: UUID
  title: string
  description: string | null
  goal_type: 'mrr' | 'arr' | 'users' | 'retention' | 'marketplace_revenue' | 'custom'
  target_value: number
  current_value: number
  currency: string
  period: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  assigned_agent: AgentName | null
  status: 'active' | 'completed' | 'paused' | 'failed'
  priority: TaskPriority
  progress_pct: number
  starts_at: string
  ends_at: string
  completed_at: ISO8601 | null
  created_at: ISO8601
}

export interface RevenueMetrics {
  id: UUID
  date: string
  mrr: number
  arr: number
  new_mrr: number
  expansion_mrr: number
  contraction_mrr: number
  churn_mrr: number
  net_new_mrr: number
  total_customers: number
  free_users: number
  pro_users: number
  plus_users: number
  elite_users: number
  marketplace_revenue: number
  total_revenue: number
  churn_rate: number
  retention_rate: number
  ltv: number
  cac: number
  arpu: number
}

export interface CommandCenterDashboard {
  revenue: RevenueMetrics
  revenue_trend: RevenueMetrics[]
  agent_statuses: Record<AgentName, AgentStatus>
  active_workflows: AgentWorkflow[]
  pending_decisions: AgentDecision[]
  recent_reports: AgentReport[]
  company_goals: CompanyGoal[]
  platform_stats: PlatformStats
  system_health: SystemHealth
}

export interface PlatformStats {
  total_users: number
  new_users_today: number
  new_users_week: number
  new_users_month: number
  active_users_today: number
  active_subscriptions: number
  marketplace_products: number
  marketplace_orders_today: number
  ai_queries_today: number
  courses_published: number
  community_posts_today: number
}

export interface SystemHealth {
  api_latency_ms: number
  database_connections: number
  error_rate_pct: number
  uptime_pct: number
  memory_usage_pct: number
  cpu_usage_pct: number
  active_users: number
  queue_depth: number
  last_checked_at: ISO8601
}

// ── ADMIN ─────────────────────────────────────────────────────

export interface AdminUser {
  id: UUID
  user_id: UUID | null
  admin_role: AdminRole
  is_founder: boolean
  permissions: Record<string, boolean>
  allowed_modules: string[]
  ip_whitelist: string[]
  two_factor_required: boolean
  two_factor_verified: boolean
  last_login_at: ISO8601 | null
  last_login_ip: string | null
  session_timeout_minutes: number
  is_active: boolean
  created_at: ISO8601
}

export interface AuditLog {
  id: UUID
  user_id: UUID | null
  admin_id: UUID | null
  action: string
  resource_type: string | null
  resource_id: string | null
  old_data: unknown | null
  new_data: unknown | null
  ip_address: string | null
  user_agent: string | null
  metadata: Record<string, unknown>
  created_at: ISO8601
}

export interface SecurityEvent {
  id: UUID
  user_id: UUID | null
  event_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string | null
  ip_address: string | null
  is_resolved: boolean
  resolved_at: ISO8601 | null
  created_at: ISO8601
}

export interface FeatureFlag {
  id: UUID
  key: string
  name: string
  description: string | null
  is_enabled: boolean
  rollout_percentage: number
  allowed_plans: string[]
  allowed_user_ids: UUID[]
  created_at: ISO8601
}

export interface RoadmapItem {
  id: UUID
  title: string
  description: string | null
  category: 'feature' | 'improvement' | 'bug_fix' | 'integration' | 'infrastructure'
  status: 'idea' | 'planned' | 'in_progress' | 'in_review' | 'completed' | 'canceled'
  priority: TaskPriority
  effort_estimate: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  impact_score: number
  assigned_agent: AgentName | null
  target_release: string | null
  planned_date: string | null
  completed_date: string | null
  votes: number
  user_requests: number
  tags: string[]
  created_at: ISO8601
  updated_at: ISO8601
}
