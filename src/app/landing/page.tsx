import type { Metadata } from 'next'
import { LandingPageContent } from './landing-page-content'
import { siteConfig } from '@/config/site'
import { isSignedIn } from '@/lib/auth/session'

const description =
  'We design, build and support the software growing businesses run on: internal tools, integrations and full product builds. Scoped before quoted, and supported after launch.'

export const metadata: Metadata = {
  title: `${siteConfig.name} — ${siteConfig.tagline}`,
  description,
  keywords: [
    'software development',
    'professional services',
    'internal tools',
    'systems integration',
    'process automation',
    'software support',
  ],
  openGraph: {
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description,
  },
}

/**
 * Reading the session makes this page dynamic, which is the trade for showing
 * a returning user the way back into the app. The marketing content is static
 * either way; only the navbar differs.
 */
export default async function LandingPage() {
  return <LandingPageContent signedIn={await isSignedIn()} />
}
