"use client"

import { LandingNavbar } from './components/navbar'
import { HeroSection } from './components/hero-section'
import { LogoCarousel } from './components/logo-carousel'
import { StatsSection } from './components/stats-section'
import { FeaturesSection } from './components/features-section'
import { PricingSection } from './components/pricing-section'
import { CTASection } from './components/cta-section'
import { ContactSection } from './components/contact-section'
import { FaqSection } from './components/faq-section'
import { LandingFooter } from './components/footer'
import { AboutSection } from './components/about-section'

/*
 * The floating theme-customizer gear was removed from the marketing site as
 * well as the dashboard. On a page selling software services, a widget
 * inviting visitors to recolour the site is a tell that they are looking at a
 * template — the opposite of what the page is there to do.
 */
export function LandingPageContent({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <LandingNavbar signedIn={signedIn} />

      {/* Main Content */}
      <main>
        <HeroSection />
        <LogoCarousel />
        <StatsSection />
        <AboutSection />
        <FeaturesSection />
        <PricingSection />
        <FaqSection />
        <CTASection />
        <ContactSection signedIn={signedIn} />
      </main>

      {/* Footer */}
      <LandingFooter />
    </div>
  )
}
