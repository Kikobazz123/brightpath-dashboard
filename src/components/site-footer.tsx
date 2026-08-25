import Link from "next/link"

import { siteConfig } from "@/config/site"

/**
 * The build credit.
 *
 * Was "Made with ♥ by Brightpath Solutions", which credited the client for
 * work it did not do. It now names the person who built it and the company he
 * built it for. Both names come from `siteConfig` so the two footers cannot
 * drift apart.
 */
export function SiteFooter() {
  return (
    <footer className="border-t bg-background">
      <div className="px-4 py-6 lg:px-6">
        <div className="flex flex-col items-center justify-center space-y-2 text-center">
          <p className="flex flex-wrap items-center justify-center gap-x-1.5 text-sm text-muted-foreground">
            <span>Made by</span>
            <span className="font-medium text-foreground">
              {siteConfig.author}
            </span>
            <span>for</span>
            <Link
              href={`mailto:${siteConfig.email}`}
              className="font-medium text-foreground hover:text-primary transition-colors"
            >
              {siteConfig.name}
            </Link>
          </p>
          <p className="text-xs text-muted-foreground">{siteConfig.tagline}</p>
        </div>
      </div>
    </footer>
  )
}
