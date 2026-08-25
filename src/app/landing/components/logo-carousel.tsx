"use client"

import { Card } from '@/components/ui/card'

/**
 * The 10Alytics mark.
 *
 * Rendered as a filled disc with the node-chart knocked out of it, rather than
 * as a two-colour logo. That is deliberate: the carousel treats every mark the
 * same way — `fill-black dark:fill-white`, no brand colour — so a full-colour
 * 10Alytics badge would sit in the row shouting while everything around it
 * whispers. The knockout uses `background`, so the chart reads as transparent
 * against whatever the section is sitting on, in either theme.
 */
const TenAlyticsMark = ({ size = 28 }: { size?: number }) => (
  <svg
    role='img'
    aria-label='10Alytics'
    viewBox='0 0 24 24'
    style={{ width: size, height: size }}
  >
    <circle cx='12' cy='12' r='11' className='fill-black dark:fill-white' />
    {/*
      * Node radius and stroke width are tuned against each other. Fatter nodes
      * or a heavier line and the four points merge into one blob at the 28px
      * the carousel actually renders — the connecting segments have to stay
      * visibly longer than the nodes are wide for this to read as a chart.
      */}
    <g
      className='stroke-background fill-background'
      strokeWidth='1'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M6.2 16.8 10.3 12 13.9 15 17.8 8.2' fill='none' />
      <circle cx='6.2' cy='16.8' r='1.55' />
      <circle cx='10.3' cy='12' r='1.55' />
      <circle cx='13.9' cy='15' r='1.55' />
      <circle cx='17.8' cy='8.2' r='1.55' />
    </g>
  </svg>
)

/**
 * One partner, repeated.
 *
 * The row used to advertise six platforms we integrate with. It now carries a
 * single real relationship. The array still holds six entries because the
 * scroll keyframe in `globals.css` translates by exactly 72rem (6 x 12rem) —
 * dropping to one entry would leave the belt jumping. Repetition is also what
 * makes it read as a marquee rather than as a lonely logo sitting still.
 */
const PARTNER = { name: '10Alytics' } as const
const partners = Array.from({ length: 6 }, () => PARTNER)

export function LogoCarousel() {
  return (
    <section className="pb-12 sm:pb-16 lg:pb-20 pt-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground mb-8">
            In partnership with
          </p>

          {/* Logo Carousel with Fade Effect */}
          <div className="relative">
            {/* Left Fade */}
            <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />

            {/* Right Fade */}
            <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

            {/* Logo Container */}
            <div className="overflow-hidden">
              <div className="flex animate-logo-scroll space-x-8 sm:space-x-12">
                {/* First set of logos */}
                {partners.map((company, index) => (
                  <Card
                    key={`first-${index}`}
                    className="flex-shrink-0 flex items-center justify-center h-16 w-40 opacity-60 hover:opacity-100 transition-opacity duration-300 border-0 shadow-none bg-transparent"
                  >
                    <div className="flex items-center gap-3">
                      <TenAlyticsMark size={28} />
                      <span className="text-foreground text-lg font-semibold whitespace-nowrap">
                        {company.name}
                      </span>
                    </div>
                  </Card>
                ))}
                {/* Second set for seamless loop - identical to first */}
                {partners.map((company, index) => (
                  <Card
                    key={`second-${index}`}
                    className="flex-shrink-0 flex items-center justify-center h-16 w-40 opacity-60 hover:opacity-100 transition-opacity duration-300 border-0 shadow-none bg-transparent"
                  >
                    <div className="flex items-center gap-3">
                      <TenAlyticsMark size={28} />
                      <span className="text-foreground text-lg font-semibold whitespace-nowrap">
                        {company.name}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
