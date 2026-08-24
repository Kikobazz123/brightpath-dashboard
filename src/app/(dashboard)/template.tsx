import * as React from "react"

/**
 * Route transition for the dashboard.
 *
 * `template.tsx` (unlike `layout.tsx`) remounts on every navigation, so the
 * enter animation replays per route without needing AnimatePresence or the
 * exit-freeze workaround the App Router otherwise forces.
 *
 * Deliberately restrained: 300ms and an 8px rise. A heavier transition
 * between admin pages stops reading as polish and starts reading as latency.
 * `motion-safe:` gates the whole thing on prefers-reduced-motion.
 */
export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-safe:ease-out">
      {children}
    </div>
  )
}
