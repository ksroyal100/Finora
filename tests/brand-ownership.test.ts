import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { APP_NAME, COMPANY_NAME, PRODUCT_BYLINE, copyrightLine } from '@/config/constants'

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'src')

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|css|json)$/.test(e.name)) out.push(p)
  }
  return out
}

describe('brand & ownership model', () => {
  it('Finora is the product, WEALTHOS the parent company', () => {
    expect(APP_NAME).toBe('Finora')
    expect(COMPANY_NAME).toBe('WEALTHOS')
    expect(PRODUCT_BYLINE).toBe('Finora is a WEALTHOS product')
  })

  it('copyright line discloses the owner accurately', () => {
    expect(copyrightLine(2026)).toBe('© 2026 WEALTHOS. All rights reserved. Finora is a WEALTHOS product.')
  })

  // WealthOS may only appear where it is a legitimate ownership reference or a
  // deliberate migration fallback. Anything new must be added here consciously.
  const ALLOWED = new Set([
    'src/config/constants.ts',                    // single source of ownership truth + parent-company handles
    'src/app/layout.tsx',                         // metadata creator = owning company
    'src/components/providers/ThemeProvider.tsx', // legacy localStorage key so users keep their theme
    'src/lib/toolkit/useToolkitHistory.ts',       // legacy localStorage key so users keep saved scenarios
    'src/middleware.ts',                          // historical comment about the old two-app layout
  ])

  it('no unexpected WealthOS references in application source', () => {
    const offenders = walk(SRC)
      .filter(f => /wealth-?os/i.test(fs.readFileSync(f, 'utf8')))
      .map(f => path.relative(ROOT, f).split(path.sep).join('/'))
      .filter(f => !ALLOWED.has(f))
    expect(offenders).toEqual([])
  })

  it('package name and public assets carry no WealthOS branding', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
    expect(pkg.name).not.toMatch(/wealth-?os/i)
    const manifest = fs.readFileSync(path.join(ROOT, 'public/manifest.json'), 'utf8')
    expect(manifest).not.toMatch(/wealth-?os/i)
  })

  it('legacy NEXT_PUBLIC_UI_URL (pre-merge) is no longer used', () => {
    const offenders = walk(SRC).filter(f => fs.readFileSync(f, 'utf8').includes('NEXT_PUBLIC_UI_URL'))
    expect(offenders).toEqual([])
  })
})
