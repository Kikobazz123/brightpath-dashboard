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
 * Each is stated as an honest floor rather than a rounded-up best case: "120+"
 * is a count there is a list behind, and "Under 2 hrs" is looser than the
 * assistant's own target — `SLA_FIRST_TOUCH_MINUTES` defaults to 15 — because
 * the promise on a marketing page should be the one that survives a bad week.
 * Anything here that stops being true gets edited down, not left to age.
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
    value: 'Under 2 hrs',
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
