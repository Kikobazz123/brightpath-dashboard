/**
 * Single source of truth for brand identity.
 *
 * Every component that renders the company name, tagline, contact address or
 * header navigation reads from here. Rebranding the whole dashboard is an edit
 * to this file, not a grep across the component tree.
 */

export const siteConfig = {
  name: "Brightpath Solutions",
  shortName: "Brightpath",
  tagline: "Software and Professional Services for Growing Businesses",

  /** Rendered under the brand name in the sidebar header. */
  sidebarSubtitle: "Admin Dashboard",

  email: "Zaxellimited360@gmail.com",

  /** The signed-in account shown in the sidebar footer. Demo data. */
  user: {
    name: "Brightpath Solutions",
    email: "Zaxellimited360@gmail.com",
    avatar: "",
  },

  /** Ghost buttons on the right of the dashboard header. */
  headerLinks: [
    { label: "Landing Page", href: "/landing", external: false },
    { label: "Pricing", href: "/pricing", external: false },
    { label: "Contact", href: "mailto:Zaxellimited360@gmail.com", external: true },
  ],
} as const

export type SiteConfig = typeof siteConfig
