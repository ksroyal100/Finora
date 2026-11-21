import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import fs from 'fs'

// Import the inner content of each page directly, bypassing the
// PublicPageShell wrapper (we only want the actual legal text).
import TermsPage from '../src/app/legal/terms/page'
import PrivacyPage from '../src/app/legal/privacy/page'
import DisclaimerPage from '../src/app/legal/disclaimer/page'
import RefundPage from '../src/app/legal/refund-policy/page'
import CopyrightPage from '../src/app/legal/copyright/page'

const pages: Record<string, React.ComponentType> = {
  terms: TermsPage,
  privacy: PrivacyPage,
  disclaimer: DisclaimerPage,
  'refund-policy': RefundPage,
  copyright: CopyrightPage,
}

const out: Record<string, string> = {}

for (const [slug, Component] of Object.entries(pages)) {
  const full = renderToStaticMarkup(React.createElement(Component))
  // Strip the outer PublicPageShell chrome (header/back-link/container) —
  // it renders a <main> wrapping everything; we want just the inner content div.
  out[slug] = full
}

fs.writeFileSync('/tmp/legal-extracted.json', JSON.stringify(out, null, 2))
console.log('done, wrote /tmp/legal-extracted.json')
for (const k of Object.keys(out)) console.log(k, out[k].length, 'chars')
