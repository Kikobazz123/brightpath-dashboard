"use client"

import { Button } from "@/components/ui/button"
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card"
import { Compass, Mail, ArrowRight, LifeBuoy } from "lucide-react"
import { siteConfig } from "@/config/site"

/**
 * Floating consultation CTA.
 *
 * Upstream this was an "Upgrade to Pro" advert for the template author's
 * component store. The visual treatment is kept because it is part of the
 * design being reproduced; the content is now a real call to action.
 *
 * Positioning note: upstream pinned this at `bottom-8`, where it sat on top
 * of table rows and calendar cells on /users, /tasks, /calendar and /mail.
 * It now clears the footer and tucks out of the way on small screens, where
 * the overlap was worst.
 */
export function UpgradeToProButton() {
  const mailto = `mailto:${siteConfig.email}?subject=${encodeURIComponent("Project enquiry")}`

  return (
    <div className="fixed z-50 bottom-4 right-4 md:bottom-6 md:right-6 lg:right-8 flex flex-col items-end gap-2">
      <HoverCard openDelay={100} closeDelay={100}>
        <HoverCardTrigger asChild>
          <Button
            size="lg"
            className="px-5 py-3 bg-gradient-to-br shadow-lg from-slate-900 cursor-pointer to-slate-400 text-white font-bold"
            asChild
          >
            <a href={mailto}>
              <span className="hidden sm:inline">Start a project</span>
              <span className="sm:hidden">Enquire</span>
              <Compass size={22} className="ml-1" />
            </a>
          </Button>
        </HoverCardTrigger>
        <HoverCardContent className="mb-3 w-80 rounded-xl shadow-2xl bg-background border border-border p-4 animate-in fade-in slide-in-from-bottom-4 relative mr-4 md:mr-6 lg:mr-8">
          <div className="flex flex-col gap-3">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Compass size={18} className="text-primary" />
              Work with {siteConfig.shortName}
            </h3>
            <p className="text-muted-foreground text-sm">
              {siteConfig.tagline}. Tell us what is not working and you will get
              an honest read on whether it needs custom software at all.
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <Button className="w-full justify-center" variant="default" asChild>
                <a href={mailto}>
                  <Mail size={16} className="mr-2" />
                  Email us
                  <ArrowRight size={16} className="ml-2" />
                </a>
              </Button>
              <Button className="w-full justify-center" variant="outline" asChild>
                <a href="/landing#pricing">
                  <LifeBuoy size={16} className="mr-2" />
                  How we price
                </a>
              </Button>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  )
}
