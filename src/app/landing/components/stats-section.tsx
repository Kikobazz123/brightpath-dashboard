"use client"

import {
  Briefcase,
  CalendarClock,
  Users,
  Clock
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { DotPattern } from '@/components/dot-pattern'

/*
 * The four numbers a services buyer actually asks about.
 *
 * Response time is now the same 15 minutes the assistant is built to hold —
 * `SLA_FIRST_TOUCH_MINUTES` in the rubric, which the pipeline measures every
 * lead against and the dashboard reports breaches of. It read "Under 2 hrs"
 * first, deliberately looser so the public promise would survive a bad week;
 * quoting the real target instead is a stronger claim, and the one number here
 * with a live measurement behind it rather than a count.
 *
 * That makes it the entry most exposed to going stale: if the breach rate on
 * /dashboard climbs, this is the line to revise, and revising it down is the
 * honest move rather than leaving it to age.
 */
const stats = [
  {
    icon: Briefcase,
    value: '120+',
    label: 'Projects delivered',
    description: 'Across web and internal tools'
  },
  {
    icon: CalendarClock,
    value: '8',
    label: 'Years in business',
    description: 'Building and supporting software'
  },
  {
    icon: Users,
    value: '45+',
    label: 'Clients supported',
    description: 'From startup to established'
  },
  {
    icon: Clock,
    value: 'Under 15 min',
    label: 'Response time',
    description: 'Typical first reply'
  }
]

export function StatsSection() {
  return (
    <section className="py-12 sm:py-16 relative">
      {/* Background with transparency */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/8 via-transparent to-secondary/20" />
      <DotPattern className="opacity-75" size="md" fadeStyle="circle" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Stats Grid */}
        <div className="stagger-in grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {stats.map((stat, index) => (
            <Card
              key={index}
              className="text-center bg-background/60 backdrop-blur-sm border-border/50 py-0"
            >
              <CardContent className="p-6">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <stat.icon className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl sm:text-3xl font-bold text-foreground">
                    {stat.value}
                  </h3>
                  <p className="font-semibold text-foreground">{stat.label}</p>
                  <p className="text-sm text-muted-foreground">{stat.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
