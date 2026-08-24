"use client"

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, Compass, LifeBuoy, Sparkles } from 'lucide-react'
import { siteConfig } from '@/config/site'
import { PublicLeadForm } from './public-lead-form'

/**
 * `signedIn` comes from the server page. A signed-in visitor is staff, not a
 * prospect — they have the dashboard's own capture screen and a queue of real
 * leads, so the public enquiry form is removed rather than left as something
 * to fill in by accident and then have to delete.
 */
export function ContactSection({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <section id="contact" className="py-24 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <Badge variant="outline" className="mb-4">Get In Touch</Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            Start with the problem
          </h2>
          <p className="text-lg text-muted-foreground">
            Tell us what is not working and we will tell you what it would take to fix it. No sales sequence, no discovery call about the discovery call.
          </p>
        </div>

        <div className={signedIn ? "grid gap-8 lg:grid-cols-3" : "grid gap-8 lg:grid-cols-3"}>
          {/* Contact Options */}
          <div
            className={
              signedIn
                ? "grid gap-6 lg:col-span-3 lg:grid-cols-3"
                : "space-y-6 order-2 lg:order-1"
            }
          >
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  Email us directly
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-3">
                  The fastest route. Describe the problem in your own words and you will get a reply from someone who can answer it.
                </p>
                <Button variant="outline" size="sm" className="cursor-pointer" asChild>
                  <a href={`mailto:${siteConfig.email}`}>
                    {siteConfig.email}
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Compass className="h-5 w-5 text-primary" />
                  Book discovery
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-3">
                  Already know roughly what you need? Skip ahead to a fixed-price scoping engagement.
                </p>
                <Button variant="outline" size="sm" className="cursor-pointer" asChild>
                  <a href="#pricing">
                    See what it includes
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LifeBuoy className="h-5 w-5 text-primary" />
                  Existing client?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-3">
                  If you are on a support retainer, use your usual channel so the request is tracked against your hours.
                </p>
                <Button variant="outline" size="sm" className="cursor-pointer" asChild>
                  <a href="/sign-in">
                    Client sign in
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/*
            The enquiry form is the product's front door: what a visitor types
            here is captured, analysed, scored and drafted against before a rep
            opens it. It used to be a form that logged to the console.
          */}
          {signedIn ? null : (
            <div className="lg:col-span-2 order-1 lg:order-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Tell us what is not working
                  </CardTitle>
                  <p className="text-muted-foreground flex items-start gap-2 pt-2 text-sm">
                    <Sparkles className="mt-0.5 size-4 shrink-0" />
                    <span>
                      Enquiries are read and prioritised as they arrive, so a
                      reply comes back with something specific rather than an
                      acknowledgement.
                    </span>
                  </p>
                </CardHeader>
                <CardContent>
                  <PublicLeadForm />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
