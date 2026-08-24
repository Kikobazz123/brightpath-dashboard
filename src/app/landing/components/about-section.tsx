"use client"

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { CardDecorator } from '@/components/ui/card-decorator'
import { Mail, Handshake, Ruler, LifeBuoy, MessagesSquare } from 'lucide-react'
import { siteConfig } from '@/config/site'

const values = [
  {
    icon: Handshake,
    title: 'One team, start to finish',
    description: 'The people who scope your project are the people who build it. Nothing is handed to a delivery team that was not in the room.'
  },
  {
    icon: Ruler,
    title: 'Scoped before quoted',
    description: 'We work out what the thing actually is before putting a number on it, so the estimate you approve is the one you pay.'
  },
  {
    icon: MessagesSquare,
    title: 'Plain language',
    description: 'Progress reported in terms of what now works, not story points burned down. You should never need a translator to read an update.'
  },
  {
    icon: LifeBuoy,
    title: 'Still here after launch',
    description: 'Software is not finished when it ships. Support and iteration are part of the engagement, not a separate conversation.'
  }
]

export function AboutSection() {
  return (
    <section id="about" className="py-24 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-4xl text-center mb-16">
          <Badge variant="outline" className="mb-4">
            About {siteConfig.shortName}
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">
            A small team that stays close to the work
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Growing businesses rarely need more software. They need the right
            software, built by people who understood the problem first. We keep
            engagements small enough to stay accountable for the outcome rather
            than just the deliverable.
          </p>
        </div>

        {/* How we work */}
        <div className="stagger-in grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 xl:grid-cols-4 mb-12">
          {values.map((value, index) => (
            <Card key={index} className='group shadow-xs py-2'>
              <CardContent className='p-8'>
                <div className='flex flex-col items-center text-center'>
                  <CardDecorator>
                    <value.icon className='h-6 w-6' aria-hidden />
                  </CardDecorator>
                  <h3 className='mt-6 font-medium text-balance'>{value.title}</h3>
                  <p className='text-muted-foreground mt-3 text-sm'>{value.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Call to Action */}
        <div className="mt-16 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="text-muted-foreground">
              Not sure whether your problem needs custom software at all? Ask us. We will tell you if it does not.
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="cursor-pointer" asChild>
              <a href={`mailto:${siteConfig.email}`}>
                <Mail className="mr-2 h-4 w-4" />
                Email us
              </a>
            </Button>
            <Button size="lg" variant="outline" className="cursor-pointer" asChild>
              <a href="#contact">
                Send a project brief
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
