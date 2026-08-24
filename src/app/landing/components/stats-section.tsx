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
 * The figures below are PLACEHOLDERS, deliberately.
 *
 * Real numbers here are the most persuasive thing on the page and the easiest
 * to get wrong, so they are left bracketed rather than invented. Replace the
 * `value` strings with your own and delete this comment. The labels are the
 * four a services buyer actually asks about; change them if yours differ.
 */
const stats = [
  {
    icon: Briefcase,
    value: '[N]',
    label: 'Projects delivered',
    description: 'Across web and internal tools'
  },
  {
    icon: CalendarClock,
    value: '[N]',
    label: 'Years in business',
    description: 'Building and supporting software'
  },
  {
    icon: Users,
    value: '[N]',
    label: 'Clients supported',
    description: 'From startup to established'
  },
  {
    icon: Clock,
    value: '[N]',
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
