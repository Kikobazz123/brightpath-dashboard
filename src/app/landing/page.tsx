import type { Metadata } from 'next'
import { LandingPageContent } from './landing-page-content'
import { siteConfig } from '@/config/site'

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

export default function LandingPage() {
  return <LandingPageContent />
}
