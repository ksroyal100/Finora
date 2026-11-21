import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider, ThemeScript } from '@/components/providers/ThemeProvider'

export const metadata: Metadata = {
  title: {
    default: 'Finora — Your Wealth Creation Platform',
    template: '%s · Finora',
  },
  description: 'Build wealth through investing, real estate, startups, and AI. Your complete wealth creation platform.',
  keywords: ['wealth', 'investing', 'personal finance', 'portfolio', 'wealth building'],
  authors: [{ name: 'Finora' }],
  creator: 'WEALTHOS', // the company that builds Finora
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://finora.app',
    siteName: 'Finora',
    title: 'Finora — Your Wealth Creation Platform',
    description: 'Build wealth through investing, real estate, startups, and AI.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Finora — Your Wealth Creation Platform',
    description: 'Build wealth through investing, real estate, startups, and AI.',
    creator: '@wealthos_ai',
  },
  robots: { index: true, follow: true },
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/favicon.ico' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
    { media: '(prefers-color-scheme: light)', color: '#EAE8E3' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
