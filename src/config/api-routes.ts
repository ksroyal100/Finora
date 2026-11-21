// ============================================================
// FINORA — Complete API Route Index
// All endpoints, methods, auth requirements, plan gates
// ============================================================

export const API_ROUTES = {

  // ── AUTH ─────────────────────────────────────────────────
  'POST /api/auth/signup':         { auth: false,   plan: null,    desc: 'Register new user' },
  'POST /api/auth/signin':         { auth: false,   plan: null,    desc: 'Sign in with email/password' },
  'POST /api/auth/signout':        { auth: true,    plan: null,    desc: 'Sign out current session' },
  'GET  /api/auth/callback':       { auth: false,   plan: null,    desc: 'OAuth callback handler' },
  'POST /api/auth/reset-password': { auth: false,   plan: null,    desc: 'Request password reset' },

  // ── PROFILES ─────────────────────────────────────────────
  'GET  /api/profiles':            { auth: true,    plan: null,    desc: 'Get own profile with subscription' },
  'PATCH /api/profiles':           { auth: true,    plan: null,    desc: 'Update own profile' },

  // ── USERS (Admin) ─────────────────────────────────────────
  'GET  /api/users':               { auth: true,    plan: null,    desc: 'List users (admin only)', admin: true },

  // ── SUBSCRIPTIONS ─────────────────────────────────────────
  'GET  /api/subscriptions':       { auth: true,    plan: null,    desc: 'Get subscription + entitlements' },
  'GET  /api/subscriptions/plans': { auth: false,   plan: null,    desc: 'List all subscription plans' },
  'POST /api/subscriptions/checkout': { auth: true, plan: null,   desc: 'Create Stripe checkout session' },
  'POST /api/subscriptions/portal':   { auth: true, plan: null,   desc: 'Open Stripe billing portal' },

  // ── BILLING ───────────────────────────────────────────────
  'GET  /api/billing/invoices':    { auth: true,    plan: null,    desc: 'List user invoices' },
  'POST /api/billing/webhook':     { auth: false,   plan: null,    desc: 'Stripe webhook handler' },

  // ── PORTFOLIO ─────────────────────────────────────────────
  'GET  /api/portfolio':           { auth: true,    plan: null,    desc: 'List portfolios' },
  'POST /api/portfolio':           { auth: true,    plan: null,    desc: 'Create portfolio' },
  'GET  /api/portfolio/holdings':  { auth: true,    plan: null,    desc: 'Get holdings' },
  'POST /api/portfolio/holdings':  { auth: true,    plan: null,    desc: 'Add holding' },
  'PATCH /api/portfolio/holdings': { auth: true,    plan: null,    desc: 'Update holding' },
  'DELETE /api/portfolio/holdings':{ auth: true,    plan: null,    desc: 'Remove holding' },
  'GET  /api/portfolio/transactions': { auth: true, plan: null,   desc: 'List transactions' },
  'POST /api/portfolio/transactions': { auth: true, plan: null,   desc: 'Add transaction' },
  'GET  /api/portfolio/performance':  { auth: true, plan: null,   desc: 'Performance metrics + charts data' },

  // ── GOALS ─────────────────────────────────────────────────
  'GET  /api/goals':               { auth: true,    plan: null,    desc: 'List goals', limit: 'free:3, pro+:unlimited' },
  'POST /api/goals':               { auth: true,    plan: null,    desc: 'Create goal' },
  'PATCH /api/goals':              { auth: true,    plan: null,    desc: 'Update goal' },
  'DELETE /api/goals':             { auth: true,    plan: null,    desc: 'Delete goal' },
  'GET  /api/goals/milestones':    { auth: true,    plan: null,    desc: 'Get milestones and contributions' },
  'POST /api/goals/milestones':    { auth: true,    plan: null,    desc: 'Add milestone or contribution' },

  // ── NET WORTH ─────────────────────────────────────────────
  'GET  /api/net-worth':           { auth: true,    plan: null,    desc: 'Full net worth snapshot + history' },
  'POST /api/net-worth/assets':    { auth: true,    plan: null,    desc: 'Add asset' },
  'PATCH /api/net-worth/assets':   { auth: true,    plan: null,    desc: 'Update asset' },
  'DELETE /api/net-worth/assets':  { auth: true,    plan: null,    desc: 'Remove asset' },
  'POST /api/net-worth/liabilities':  { auth: true, plan: null,   desc: 'Add liability' },
  'PATCH /api/net-worth/liabilities': { auth: true, plan: null,   desc: 'Update liability' },
  'DELETE /api/net-worth/liabilities':{ auth: true, plan: null,   desc: 'Remove liability' },

  // ── BUDGETING ─────────────────────────────────────────────
  'GET  /api/budgeting':           { auth: true,    plan: null,    desc: 'Get active budget' },
  'POST /api/budgeting':           { auth: true,    plan: null,    desc: 'Create budget' },
  'GET  /api/budgeting/transactions': { auth: true, plan: null,   desc: 'List transactions' },
  'POST /api/budgeting/transactions': { auth: true, plan: null,   desc: 'Add transaction' },
  'DELETE /api/budgeting/transactions':{ auth: true, plan: null,  desc: 'Delete transaction' },

  // ── AI COACH ─────────────────────────────────────────────
  'GET  /api/ai-coach/conversations': { auth: true, plan: null,   desc: 'List conversations', limit: 'free:3/week' },
  'POST /api/ai-coach/conversations': { auth: true, plan: null,   desc: 'Send message to AI coach' },
  'GET  /api/ai-coach/usage':      { auth: true,    plan: null,    desc: 'Get weekly usage status' },

  // ── LEARNING HUB ─────────────────────────────────────────
  'GET  /api/learning/courses':    { auth: true,    plan: null,    desc: 'List courses (gated by plan)' },
  'GET  /api/learning/paths':      { auth: true,    plan: null,    desc: 'List learning paths' },
  'GET  /api/learning/achievements':{ auth: true,   plan: null,    desc: 'Achievements, certificates, progress' },

  // ── COMMUNITY ─────────────────────────────────────────────
  'GET  /api/community/posts':     { auth: true,    plan: null,    desc: 'Feed (discover/following/trending)' },
  'POST /api/community/posts':     { auth: true,    plan: null,    desc: 'Create post' },
  'PATCH /api/community/posts':    { auth: true,    plan: null,    desc: 'Edit own post' },
  'DELETE /api/community/posts':   { auth: true,    plan: null,    desc: 'Remove own post' },
  'GET  /api/community/comments':  { auth: true,    plan: null,    desc: 'Get post comments with replies' },
  'POST /api/community/comments':  { auth: true,    plan: null,    desc: 'Add comment' },
  'DELETE /api/community/comments':{ auth: true,    plan: null,    desc: 'Remove comment' },
  'GET  /api/community/groups':    { auth: true,    plan: null,    desc: 'List/search groups' },
  'POST /api/community/groups':    { auth: true,    plan: null,    desc: 'Create group' },
  'GET  /api/community/events':    { auth: true,    plan: null,    desc: 'List events' },
  'POST /api/community/events':    { auth: true,    plan: null,    desc: 'Create event or RSVP' },
  'GET  /api/community/follow':    { auth: true,    plan: null,    desc: 'Get followers/following' },
  'POST /api/community/follow':    { auth: true,    plan: null,    desc: 'Follow/unfollow user' },

  // ── RESEARCH CENTER ───────────────────────────────────────
  'GET  /api/research/reports':    { auth: true,    plan: 'pro',   desc: 'List research reports (Pro+)' },
  'GET  /api/research/watchlists': { auth: true,    plan: null,    desc: 'List watchlists' },
  'POST /api/research/watchlists': { auth: true,    plan: null,    desc: 'Create watchlist' },
  'PATCH /api/research/watchlists':{ auth: true,    plan: null,    desc: 'Update watchlist symbols' },
  'DELETE /api/research/watchlists':{ auth: true,   plan: null,    desc: 'Delete watchlist' },
  'GET  /api/research/saved':      { auth: true,    plan: 'pro',   desc: 'Saved reports (Pro+)' },
  'POST /api/research/saved':      { auth: true,    plan: 'pro',   desc: 'Save/unsave report (Pro+)' },

  // ── MARKETPLACE ───────────────────────────────────────────
  'GET  /api/marketplace/products': { auth: false,  plan: null,    desc: 'Browse products (public)' },
  'POST /api/marketplace/products': { auth: true,   plan: 'plus',  desc: 'List product (Plus+)' },
  'GET  /api/marketplace/orders':   { auth: true,   plan: null,    desc: 'Order history' },
  'POST /api/marketplace/orders':   { auth: true,   plan: null,    desc: 'Place order / checkout' },
  'GET  /api/marketplace/reviews':  { auth: false,  plan: null,    desc: 'Product reviews (public)' },
  'POST /api/marketplace/reviews':  { auth: true,   plan: null,    desc: 'Submit review (verified purchase)' },
  'GET  /api/marketplace/wishlists':{ auth: true,   plan: null,    desc: 'My wishlist' },
  'POST /api/marketplace/wishlists':{ auth: true,   plan: null,    desc: 'Toggle wishlist item' },
  'GET  /api/marketplace/creators': { auth: true,   plan: 'plus',  desc: 'Creator store (Plus+)' },
  'POST /api/marketplace/creators': { auth: true,   plan: 'plus',  desc: 'Create store (Plus+)' },
  'PATCH /api/marketplace/creators':{ auth: true,   plan: 'plus',  desc: 'Update store' },

  // ── NOTIFICATIONS ─────────────────────────────────────────
  'GET  /api/notifications':       { auth: true,    plan: null,    desc: 'List notifications + unread count' },
  'PATCH /api/notifications':      { auth: true,    plan: null,    desc: 'Mark as read (one or all)' },
  'DELETE /api/notifications':     { auth: true,    plan: null,    desc: 'Delete notifications' },

  // ── ANALYTICS ─────────────────────────────────────────────
  'GET  /api/analytics':           { auth: true,    plan: null,    desc: 'User analytics dashboard data' },
  'POST /api/analytics':           { auth: true,    plan: null,    desc: 'Track event(s)' },

  // ── WEBHOOKS ─────────────────────────────────────────────
  'POST /api/webhooks/stripe':     { auth: false,   plan: null,    desc: 'Stripe webhook (HMAC verified)' },

  // ═══════════════════════════════════════════════════════════
  // COMMAND CENTER (Admin only)
  // ═══════════════════════════════════════════════════════════

  'GET  /api/admin/cc/analytics':     { admin: true, desc: 'Master dashboard metrics' },
  'GET  /api/admin/cc/revenue':       { admin: true, desc: 'Revenue intelligence (MRR/ARR/LTV)' },
  'POST /api/admin/cc/revenue':       { admin: true, desc: 'Ask ATHENA for financial analysis' },
  'GET  /api/admin/cc/revenue/cron':  { cron: true,  desc: 'Daily revenue snapshot (cron only)' },
  'GET  /api/admin/cc/users':         { admin: true, desc: 'User management + detail view' },
  'POST /api/admin/cc/users':         { admin: true, desc: 'Ban, unban, update plan/role' },
  'GET  /api/admin/cc/subscriptions': { admin: true, desc: 'Subscription list + metrics' },
  'POST /api/admin/cc/subscriptions': { admin: true, desc: 'Override plan, cancel, extend trial' },
  'GET  /api/admin/cc/marketplace':   { admin: true, desc: 'Marketplace management overview' },
  'POST /api/admin/cc/marketplace':   { admin: true, desc: 'Approve/reject/refund products + orders' },
  'GET  /api/admin/cc/security':      { admin: true, desc: 'Security events, audit logs' },
  'POST /api/admin/cc/security':      { admin: true, desc: 'Resolve events, ban users, ask SENTINEL' },
  'GET  /api/admin/cc/system':        { admin: true, desc: 'Feature flags, config, system health' },
  'POST /api/admin/cc/system':        { admin: true, desc: 'Create flag/config/metric' },
  'PATCH /api/admin/cc/system':       { admin: true, desc: 'Toggle flag, update config' },
  'GET  /api/admin/cc/goals':         { admin: true, desc: 'Company OKRs + auto-sync' },
  'POST /api/admin/cc/goals':         { admin: true, desc: 'Create company goal' },
  'PATCH /api/admin/cc/goals':        { admin: true, desc: 'Update goal progress' },
  'GET  /api/admin/cc/roadmap':       { admin: true, desc: 'Product roadmap' },
  'POST /api/admin/cc/roadmap':       { admin: true, desc: 'Create item or ask ORION for suggestions' },
  'PATCH /api/admin/cc/roadmap':      { admin: true, desc: 'Update roadmap item status' },
  'DELETE /api/admin/cc/roadmap':     { admin: true, desc: 'Delete roadmap item' },
  'GET  /api/admin/cc/decisions':     { admin: true, desc: 'Agent decisions (pending approvals)' },
  'POST /api/admin/cc/decisions':     { admin: true, desc: 'Approve/reject/create decisions' },
  'GET  /api/admin/cc/workflows':     { admin: true, desc: 'Multi-agent workflow list' },
  'POST /api/admin/cc/workflows':     { admin: true, desc: 'Create and start workflow' },
  'PATCH /api/admin/cc/workflows':    { admin: true, desc: 'Pause/resume/cancel workflow' },

  // ── AGENTS ───────────────────────────────────────────────
  'GET  /api/admin/cc/agents':        { admin: true, desc: 'List all agents with status' },
  'POST /api/admin/cc/agents':        { admin: true, desc: 'Chat with agent or create task' },
  'GET  /api/admin/cc/agents/voice':  { admin: true, desc: 'Voice session history' },
  'POST /api/admin/cc/agents/voice':  { admin: true, desc: 'TTS, STT, session management' },
  'GET  /api/admin/cc/agents/reports':{ admin: true, desc: 'Agent reports list' },
  'POST /api/admin/cc/agents/reports':{ admin: true, desc: 'Request or create report' },
  'PATCH /api/admin/cc/agents/reports':{ admin: true, desc: 'Pin/archive report' },

  // ── VAULT (Founder only) ──────────────────────────────────
  'GET  /api/admin/cc/vault':         { founder: true, desc: 'Founder vault documents' },
  'POST /api/admin/cc/vault':         { founder: true, desc: 'Create vault document' },
  'PATCH /api/admin/cc/vault':        { founder: true, desc: 'Update vault document' },
  'DELETE /api/admin/cc/vault':       { founder: true, desc: 'Delete vault document' },

} as const
