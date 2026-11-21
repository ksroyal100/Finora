-- ============================================================
-- 017: Complete the Finora legal document set
--
-- Adds the two customer-facing documents that did not exist as their own pages:
--   * cookies          -> Cookie Policy
--   * acceptable-use   -> Acceptable Use Policy
-- and gives two existing documents the names used across the product:
--   * disclaimer       'Disclaimer'     -> 'Financial Disclaimer'
--   * refund-policy    'Refund Policy'  -> 'Refund and Cancellation Policy'
--
-- Safety properties
--   * ADDITIVE: no table, column, policy or existing document body is changed or dropped.
--   * IDEMPOTENT: safe to run twice; the second run changes nothing.
--   * AUDITED: before a title changes, the previous state is snapshotted into
--     legal_document_revisions and the version is bumped (same pattern as the admin editor).
--   * REVERSIBLE: see the ROLLBACK section at the bottom.
--   * Take a backup (or Supabase point-in-time snapshot) BEFORE running this on production.
--
-- LEGAL REVIEW REQUIRED: the two new documents are starting drafts written from what the app
-- actually does today. Have a qualified lawyer review them before relying on them. They state
-- WEALTHOS as owner/operator in the same way as the existing documents; they do NOT contain
-- company registration numbers, addresses or regulatory claims. Add those once confirmed.
-- ============================================================

INSERT INTO legal_documents (slug, title, content, version, published_at)
VALUES ('cookies', 'Cookie Policy', $doc$<div style="font-size:15px;line-height:1.7;color:var(--text-secondary)"><p style="margin-bottom:12px">This Cookie Policy explains how Finora (the &quot;Service&quot;), a software product owned and operated by WEALTHOS (&quot;WEALTHOS,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), uses cookies and similar technologies such as browser local storage. It should be read together with our Privacy Policy.</p><section style="margin-top:28px"><h2 style="font-size:17px;font-weight:700;color:var(--text-primary);margin-bottom:8px">1. What These Technologies Are</h2><p style="margin-bottom:12px">Cookies are small text files that a website stores in your browser. Local storage is a similar browser feature that keeps data on your own device. We use both only as described below.</p></section><section style="margin-top:28px"><h2 style="font-size:17px;font-weight:700;color:var(--text-primary);margin-bottom:8px">2. What We Use</h2><ul style="margin:0 0 12px 20px;list-style:disc"><li style="margin-bottom:6px"><strong>Essential authentication cookies.</strong> When you sign in, our authentication provider (Supabase) sets session cookies that keep you signed in and help protect your account. The Service cannot work without them.</li><li style="margin-bottom:6px"><strong>Preference storage (local storage).</strong> Your browser stores your light/dark theme choice and any calculator scenarios you save in the Financial Toolkit. This data stays on your device and is not used for tracking.</li><li style="margin-bottom:6px"><strong>Error monitoring.</strong> If enabled, our error-monitoring provider (Sentry) receives technical diagnostics when something breaks, so we can fix problems. We do not use it for advertising.</li><li style="margin-bottom:6px"><strong>Payments.</strong> When you subscribe, Stripe processes your payment and may set its own cookies on its checkout pages for fraud prevention and security. Those are governed by Stripe&#39;s own policies.</li></ul></section><section style="margin-top:28px"><h2 style="font-size:17px;font-weight:700;color:var(--text-primary);margin-bottom:8px">3. What We Do Not Use</h2><p style="margin-bottom:12px">The Service does not currently use advertising cookies or cross-site tracking cookies, and we do not sell your personal information. If we introduce analytics or other non-essential cookies in future, we will update this policy and, where the law requires, ask for your consent first.</p></section><section style="margin-top:28px"><h2 style="font-size:17px;font-weight:700;color:var(--text-primary);margin-bottom:8px">4. Managing Cookies</h2><p style="margin-bottom:12px">You can block or delete cookies in your browser settings. Blocking essential cookies will prevent you from signing in. Clearing your browser&#39;s site data will reset your theme and remove saved calculator scenarios.</p></section><section style="margin-top:28px"><h2 style="font-size:17px;font-weight:700;color:var(--text-primary);margin-bottom:8px">5. Changes and Contact</h2><p style="margin-bottom:12px">We may update this policy from time to time; the &quot;Last updated&quot; date above shows the latest version. Questions can be sent through our Contact page.</p></section></div>$doc$, 1, NOW())
ON CONFLICT (slug) DO NOTHING;

INSERT INTO legal_documents (slug, title, content, version, published_at)
VALUES ('acceptable-use', 'Acceptable Use Policy', $doc$<div style="font-size:15px;line-height:1.7;color:var(--text-secondary)"><p style="margin-bottom:12px">This Acceptable Use Policy (&quot;AUP&quot;) applies to everyone who uses Finora (the &quot;Service&quot;), a software product owned and operated by WEALTHOS (&quot;WEALTHOS,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). It forms part of, and should be read together with, our Terms of Service.</p><section style="margin-top:28px"><h2 style="font-size:17px;font-weight:700;color:var(--text-primary);margin-bottom:8px">1. General Conduct</h2><p style="margin-bottom:12px">You agree not to:</p><ul style="margin:0 0 12px 20px;list-style:disc"><li style="margin-bottom:6px">use the Service for any unlawful purpose or in violation of any applicable law;</li><li style="margin-bottom:6px">attempt to gain unauthorized access to any account, system, or network related to the Service;</li><li style="margin-bottom:6px">reverse engineer, scrape, or interfere with the normal operation of the Service;</li><li style="margin-bottom:6px">upload malicious code or attempt to disrupt the Service&#39;s availability;</li><li style="margin-bottom:6px">impersonate any person or entity, or misrepresent your affiliation.</li></ul></section><section style="margin-top:28px"><h2 style="font-size:17px;font-weight:700;color:var(--text-primary);margin-bottom:8px">2. Financial Misconduct</h2><p style="margin-bottom:12px">You may not use the Service, including any AI feature, to plan, carry out, or conceal financial crime or misconduct, including insider trading, market manipulation, securities fraud, money laundering or structuring, tax evasion, or unlicensed lending schemes.</p></section><section style="margin-top:28px"><h2 style="font-size:17px;font-weight:700;color:var(--text-primary);margin-bottom:8px">3. AI Features</h2><ul style="margin:0 0 12px 20px;list-style:disc"><li style="margin-bottom:6px">Do not attempt to bypass, disable, or manipulate the safeguards of the AI Coach or Support Chat.</li><li style="margin-bottom:6px">Do not use automated tools to send bulk or scripted requests to AI features.</li><li style="margin-bottom:6px">Do not present AI output or calculator results to others as regulated financial, investment, tax, or legal advice.</li></ul></section><section style="margin-top:28px"><h2 style="font-size:17px;font-weight:700;color:var(--text-primary);margin-bottom:8px">4. Community and Marketplace Content</h2><p style="margin-bottom:12px">Content you post or sell through the Service must not be unlawful, infringing, deceptive, defamatory, harassing, hateful, or spam, and must not include personal information of others without their permission. You are responsible for having the rights to anything you share or sell.</p></section><section style="margin-top:28px"><h2 style="font-size:17px;font-weight:700;color:var(--text-primary);margin-bottom:8px">5. Account and Plan Integrity</h2><ul style="margin:0 0 12px 20px;list-style:disc"><li style="margin-bottom:6px">Do not share your login credentials or sell, rent, or transfer your account.</li><li style="margin-bottom:6px">Do not create multiple or automated accounts to abuse free trials, free-plan limits, or referral programs.</li><li style="margin-bottom:6px">Do not use the Service to circumvent plan limits or billing.</li></ul></section><section style="margin-top:28px"><h2 style="font-size:17px;font-weight:700;color:var(--text-primary);margin-bottom:8px">6. Enforcement</h2><p style="margin-bottom:12px">If we believe this AUP has been violated, we may remove content, limit features, suspend or terminate accounts, and, where legally required or appropriate, report conduct to the relevant authorities. Where practical we will tell you why, but we may act immediately where needed to protect users or the Service.</p></section><section style="margin-top:28px"><h2 style="font-size:17px;font-weight:700;color:var(--text-primary);margin-bottom:8px">7. Reporting a Violation</h2><p style="margin-bottom:12px">If you see conduct that breaches this policy, please let us know through our Contact page.</p></section></div>$doc$, 1, NOW())
ON CONFLICT (slug) DO NOTHING;

-- Retitle existing documents (snapshot first, only if the title differs).
INSERT INTO legal_document_revisions (document_id, slug, title, content, version, updated_by)
SELECT id, slug, title, content, version, updated_by FROM legal_documents
WHERE (slug = 'disclaimer'    AND title <> 'Financial Disclaimer')
   OR (slug = 'refund-policy' AND title <> 'Refund and Cancellation Policy');

UPDATE legal_documents
SET title = 'Financial Disclaimer', version = version + 1, updated_at = NOW()
WHERE slug = 'disclaimer' AND title <> 'Financial Disclaimer';

UPDATE legal_documents
SET title = 'Refund and Cancellation Policy', version = version + 1, updated_at = NOW()
WHERE slug = 'refund-policy' AND title <> 'Refund and Cancellation Policy';

-- ============================================================
-- ROLLBACK (run manually if needed; not executed by the migration)
--
--   DELETE FROM legal_documents WHERE slug IN ('cookies', 'acceptable-use');
--
--   UPDATE legal_documents d SET title = 'Disclaimer', version = d.version + 1, updated_at = NOW()
--   WHERE d.slug = 'disclaimer' AND d.title = 'Financial Disclaimer';
--   UPDATE legal_documents d SET title = 'Refund Policy', version = d.version + 1, updated_at = NOW()
--   WHERE d.slug = 'refund-policy' AND d.title = 'Refund and Cancellation Policy';
-- ============================================================
