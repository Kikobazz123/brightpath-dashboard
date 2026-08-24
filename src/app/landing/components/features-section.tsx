"use client"

import {
  ArrowRight,
  Boxes,
  Cable,
  ClipboardList,
  Gauge,
  LineChart,
  Repeat,
  ShieldCheck,
  Workflow
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Image3D } from '@/components/image-3d'
import { siteConfig } from '@/config/site'

const buildServices = [
  {
    icon: Boxes,
    title: 'Internal tools',
    description: 'The admin panel, portal or tracker your team currently runs on a spreadsheet.'
  },
  {
    icon: Cable,
    title: 'Integrations',
    description: 'Getting the systems you already pay for to talk to each other reliably.'
  },
  {
    icon: Workflow,
    title: 'Process automation',
    description: 'Removing the manual re-typing between one system and the next.'
  },
  {
    icon: LineChart,
    title: 'Reporting you trust',
    description: 'One number, one definition, so meetings stop arguing about whose figure is right.'
  }
]

const supportServices = [
  {
    icon: ClipboardList,
    title: 'Discovery and scoping',
    description: 'A fixed-price piece of work that ends in a plan and an estimate you can act on.'
  },
  {
    icon: Repeat,
    title: 'Ongoing development',
    description: 'Steady iteration after launch, at a predictable monthly commitment.'
  },
  {
    icon: ShieldCheck,
    title: 'Maintenance and updates',
    description: 'Dependencies patched, backups verified, and someone to call when it breaks.'
  },
  {
    icon: Gauge,
    title: 'Performance and cost review',
    description: 'Finding what is slow, and what you are paying for twice.'
  }
]

export function FeaturesSection() {
  return (
    <section id="services" className="py-24 sm:py-32 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          <Badge variant="outline" className="mb-4">What we do</Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            Two ways we usually help
          </h2>
          <p className="text-lg text-muted-foreground">
            Most engagements start as a build or as ongoing support, and often
            become both. Either way the first step is the same conversation
            about what the problem actually is.
          </p>
        </div>

        {/* Build work */}
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-8 xl:gap-16 mb-24">
          {/* Left Image */}
          <Image3D
            lightSrc="/feature-1-light.png"
            darkSrc="/feature-1-dark.png"
            alt="Reporting view from a client operations tool"
            direction="left"
          />
          {/* Right Content */}
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                Building the thing you cannot buy
              </h3>
              <p className="text-muted-foreground text-base text-pretty">
                Off-the-shelf software covers most of what a business needs. We
                build the part it does not, and we keep that part small enough
                to stay maintainable.
              </p>
            </div>

            <ul className="grid gap-4 sm:grid-cols-2">
              {buildServices.map((feature, index) => (
                <li key={index} className="group hover:bg-accent/5 flex items-start gap-3 p-2 rounded-lg transition-colors">
                  <div className="mt-0.5 flex shrink-0 items-center justify-center">
                    <feature.icon className="size-5 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-foreground font-medium">{feature.title}</h3>
                    <p className="text-muted-foreground mt-1 text-sm">{feature.description}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-4 pe-4 pt-2">
              <Button size="lg" className="cursor-pointer" asChild>
                <a href={`mailto:${siteConfig.email}`} className='flex items-center'>
                  Discuss a build
                  <ArrowRight className="ms-2 size-4" aria-hidden="true" />
                </a>
              </Button>
              <Button size="lg" variant="outline" className="cursor-pointer" asChild>
                <a href="#pricing">
                  How we price
                </a>
              </Button>
            </div>
          </div>
        </div>

        {/* Support work - Flipped Layout */}
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-8 xl:gap-16">
          {/* Left Content */}
          <div className="space-y-6 order-2 lg:order-1">
            <div className="space-y-4">
              <h3 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                Looking after it once it exists
              </h3>
              <p className="text-muted-foreground text-base text-pretty">
                The expensive failures are rarely the build. They are the two
                years afterwards, when nobody owns the thing and the person who
                understood it has left.
              </p>
            </div>

            <ul className="grid gap-4 sm:grid-cols-2">
              {supportServices.map((feature, index) => (
                <li key={index} className="group hover:bg-accent/5 flex items-start gap-3 p-2 rounded-lg transition-colors">
                  <div className="mt-0.5 flex shrink-0 items-center justify-center">
                    <feature.icon className="size-5 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-foreground font-medium">{feature.title}</h3>
                    <p className="text-muted-foreground mt-1 text-sm">{feature.description}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-4 pe-4 pt-2">
              <Button size="lg" className="cursor-pointer" asChild>
                <a href="#contact" className='flex items-center'>
                  Talk about support
                  <ArrowRight className="ms-2 size-4" aria-hidden="true" />
                </a>
              </Button>
              <Button size="lg" variant="outline" className="cursor-pointer" asChild>
                <a href="#faq">
                  Common questions
                </a>
              </Button>
            </div>
          </div>

          {/* Right Image */}
          <Image3D
            lightSrc="/feature-2-light.png"
            darkSrc="/feature-2-dark.png"
            alt="Monitoring view from a supported client system"
            direction="right"
            className="order-1 lg:order-2"
          />
        </div>
      </div>
    </section>
  )
}
