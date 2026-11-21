// ============================================================
// Newsletter HTML renderer
//
// Deliberately built to the actual industry-standard constraints
// for marketing email, not just "looks good in a browser":
// - Table-based layout. Outlook's rendering engine (Word, not a
//   real browser engine) doesn't support flexbox/grid reliably —
//   tables are still the only layout method that renders
//   consistently across Gmail, Outlook, Apple Mail, and Yahoo.
// - All styles inline on elements. Many email clients strip
//   <style> blocks or ignore embedded/external CSS entirely.
// - A hidden preheader — the preview snippet shown in the inbox
//   list next to the subject line, before the email is opened.
// - Max 600-620px content width, the de facto standard width
//   that renders well across both desktop and mobile clients.
// - CAN-SPAM required elements: a real physical postal address
//   and a working, one-click unsubscribe link in every send.
// ============================================================

export interface NewsletterBlock {
  type: 'paragraph' | 'heading' | 'cta' | 'divider' | 'highlight'
  text?: string
  ctaLabel?: string
  ctaUrl?: string
}

export interface NewsletterContent {
  headline: string
  intro: string
  blocks: NewsletterBlock[]
}

const BRAND_GREEN = '#2FD968'

function renderBlock(block: NewsletterBlock): string {
  switch (block.type) {
    case 'heading':
      return `<h2 style="margin:28px 0 12px;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.01em;">${block.text ?? ''}</h2>`
    case 'paragraph':
      return `<p style="margin:0 0 16px;color:rgba(255,255,255,0.72);font-size:16px;line-height:1.65;">${block.text ?? ''}</p>`
    case 'highlight':
      return `<div style="background:#141618;border:1px solid rgba(47,217,104,0.3);border-radius:12px;padding:18px 20px;margin:20px 0;color:${BRAND_GREEN};font-size:15px;font-weight:600;line-height:1.5;">${block.text ?? ''}</div>`
    case 'divider':
      return `<div style="height:1px;background:rgba(255,255,255,0.1);margin:28px 0;"></div>`
    case 'cta':
      return `
        <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
          <tr><td style="border-radius:10px;background:${BRAND_GREEN};">
            <a href="${block.ctaUrl ?? '#'}" style="display:inline-block;padding:14px 28px;color:#000000;text-decoration:none;font-weight:700;font-size:15px;border-radius:10px;">${block.ctaLabel ?? 'Learn More'}</a>
          </td></tr>
        </table>`
    default:
      return ''
  }
}

export function renderNewsletterHtml(params: {
  subject: string
  preheader: string
  fromName: string
  content: NewsletterContent
  unsubscribeUrl: string
}): string {
  const { preheader, fromName, content, unsubscribeUrl } = params
  const mailingAddress = process.env.COMPANY_MAILING_ADDRESS ?? '[Add your company mailing address in settings]'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://finora.app'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark light">
  <title>${escapeHtml(params.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <!-- Preheader: shown in inbox preview, hidden in the body -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000000;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- HEADER -->
        <tr><td style="padding:0 0 28px;text-align:center;">
          <span style="color:${BRAND_GREEN};font-size:22px;font-weight:800;letter-spacing:-0.02em;">Finora</span>
          <div style="color:rgba(255,255,255,0.4);font-size:12px;margin-top:4px;">from ${escapeHtml(fromName)}</div>
        </td></tr>

        <!-- BODY CARD -->
        <tr><td style="background:#0F1113;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:36px 32px;">
          <h1 style="margin:0 0 18px;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.02em;line-height:1.25;">${escapeHtml(content.headline)}</h1>
          ${content.intro ? `<p style="margin:0 0 20px;color:rgba(255,255,255,0.72);font-size:16px;line-height:1.65;">${content.intro}</p>` : ''}
          ${content.blocks.map(renderBlock).join('\n')}
        </td></tr>

        <!-- FOOTER — CAN-SPAM required elements -->
        <tr><td style="padding:28px 12px 0;text-align:center;">
          <p style="margin:0 0 8px;color:rgba(255,255,255,0.35);font-size:12px;line-height:1.6;">
            You're receiving this because you subscribed to Finora updates.<br>
            <a href="${unsubscribeUrl}" style="color:${BRAND_GREEN};text-decoration:underline;">Unsubscribe</a>
            &nbsp;·&nbsp;
            <a href="${appUrl}/legal/privacy" style="color:${BRAND_GREEN};text-decoration:underline;">Privacy Policy</a>
          </p>
          <p style="margin:0;color:rgba(255,255,255,0.25);font-size:11px;">${escapeHtml(mailingAddress)}</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
