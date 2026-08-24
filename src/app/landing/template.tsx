import * as React from "react"

/**
 * Route transition for the marketing page.
 *
 * A plain fade, no rise. The landing page's own sections handle vertical
 * movement as you scroll; adding a second upward motion on mount fights it.
 */
export default function LandingTemplate({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500 motion-safe:ease-out">
      {children}
    </div>
  )
}
