"use client"

import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useState } from 'react'
import { siteConfig } from '@/config/site'

/*
 * Every price below is a PLACEHOLDER.
 *
 * Rates are the one thing on this page that must not be guessed, so they are
 * bracketed rather than invented. Replace the `monthly` / `annual` strings
 * with your real figures and delete this comment.
 *
 * `billingSensitive: false` means the tier ignores the monthly/annual toggle
 * and shows as a one-off engagement instead.
 */
const plans = [
  {
    name: 'Discovery',
    description: 'A fixed-price piece of work that ends in a plan you can act on',
    monthly: '[PRICE]',
    annual: '[PRICE]',
    billingSensitive: false,
    note: 'Fixed price, one-off',
    features: [
      'Structured review of the current process',
      'Written scope and technical approach',
      'Build estimate with assumptions stated',
      'Recommendation even if that is "do not build"',
      'Credited against the project if you proceed'
    ],
    cta: 'Book discovery',
    popular: false
  },
  {
    name: 'Project build',
    description: 'Design, build and launch of an agreed scope of work',
    monthly: '[PRICE]',
    annual: '[PRICE]',
    billingSensitive: false,
    note: 'Fixed price, from',
    features: [
      'Scope fixed before work begins',
      'Weekly working software, not status decks',
      'One named point of contact throughout',
      'Handover documentation you can act on',
      'Source code and infrastructure in your accounts',
      'Post-launch fixes included for an agreed window'
    ],
    cta: 'Discuss a project',
    popular: true,
    includesPrevious: 'Everything in Discovery, plus'
  },
  {
    name: 'Retained support',
    description: 'Ongoing development and maintenance at a predictable rate',
    monthly: '[PRICE]',
    annual: '[PRICE]',
    billingSensitive: true,
    note: 'Per month',
    features: [
      'Agreed block of development time each month',
      'Dependency patching and backup verification',
      'Defined response time for urgent issues',
      'Quarterly review of cost and performance',
      'Roll unused time into the following month',
      'Thirty days notice, no long lock-in'
    ],
    cta: 'Talk about support',
    popular: false,
    includesPrevious: 'Suitable after any build, plus'
  }
]

export function PricingSection() {
  const [isYearly, setIsYearly] = useState(false)

  return (
    <section id="pricing" className="py-24 sm:py-32 bg-muted/40">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center mb-12">
          <Badge variant="outline" className="mb-4">How we price</Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            Three ways to start
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Most clients begin with discovery, because a real estimate needs a
            real scope. If you already know what you need, skip straight to a
            project or a support retainer.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center mb-2">
            <ToggleGroup
              type="single"
              value={isYearly ? "yearly" : "monthly"}
              onValueChange={(value) => setIsYearly(value === "yearly")}
              className="bg-secondary text-secondary-foreground border-none rounded-full p-1 cursor-pointer shadow-none"
            >
              <ToggleGroupItem
                value="monthly"
                className="data-[state=on]:bg-background data-[state=on]:border-border border-transparent border px-6 !rounded-full data-[state=on]:text-foreground hover:bg-transparent cursor-pointer transition-colors"
              >
                Monthly
              </ToggleGroupItem>
              <ToggleGroupItem
                value="yearly"
                className="data-[state=on]:bg-background data-[state=on]:border-border border-transparent border px-6 !rounded-full data-[state=on]:text-foreground hover:bg-transparent cursor-pointer transition-colors"
              >
                Annually
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <p className="text-sm text-muted-foreground">
            <span className="text-primary font-semibold">Save [X]%</span> on annual retainers
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="mx-auto max-w-6xl">
          <div className="rounded-xl border">
            <div className="grid lg:grid-cols-3">
              {plans.map((plan, index) => (
                <div
                  key={index}
                  className={`p-8 grid grid-rows-subgrid row-span-4 gap-6 ${
                    plan.popular
                      ? 'my-2 mx-4 rounded-xl bg-card border-transparent shadow-xl ring-1 ring-foreground/10 backdrop-blur'
                      : ''
                  }`}
                >
                  {/* Plan Header */}
                  <div>
                    <div className="text-lg font-medium tracking-tight mb-2">{plan.name}</div>
                    <div className="text-muted-foreground text-balance text-sm">{plan.description}</div>
                  </div>

                  {/* Pricing */}
                  <div>
                    <div className="text-4xl font-bold mb-1">
                      {plan.billingSensitive && isYearly ? plan.annual : plan.monthly}
                    </div>
                    <div className="text-muted-foreground text-sm">
                      {plan.billingSensitive && isYearly ? 'Per month, billed annually' : plan.note}
                    </div>
                  </div>

                  {/* CTA Button */}
                  <div>
                    <Button
                      asChild
                      className={`w-full cursor-pointer my-2 ${
                        plan.popular
                          ? 'shadow-md border-[0.5px] border-white/25 shadow-black/20 bg-primary ring-1 ring-primary/15 text-primary-foreground hover:bg-primary/90'
                          : 'shadow-sm shadow-black/15 border border-transparent bg-background ring-1 ring-foreground/10 hover:bg-muted/50'
                      }`}
                      variant={plan.popular ? 'default' : 'secondary'}
                    >
                      <a href={`mailto:${siteConfig.email}?subject=${encodeURIComponent(plan.name)}`}>
                        {plan.cta}
                      </a>
                    </Button>
                  </div>

                  {/* Features */}
                  <div>
                    <ul role="list" className="space-y-3 text-sm">
                      {plan.includesPrevious && (
                        <li className="flex items-center gap-3 font-medium">
                          {plan.includesPrevious}:
                        </li>
                      )}
                      {plan.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-center gap-3">
                          <Check className="text-muted-foreground size-4 flex-shrink-0" strokeWidth={2.5} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bespoke note */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground">
            Something that does not fit these three? {' '}
            <Button variant="link" className="p-0 h-auto cursor-pointer" asChild>
              <a href="#contact">
                Tell us what you need
              </a>
            </Button>
          </p>
        </div>
      </div>
    </section>
  )
}
