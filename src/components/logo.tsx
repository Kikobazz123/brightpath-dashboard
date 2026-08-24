import * as React from "react"

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number
}

/**
 * Brightpath Solutions mark.
 *
 * An ascending path resolving into a bright terminal point. Stroke-based on a
 * 24px grid with round caps so it reads as a sibling of the Lucide icon set,
 * and drawn in `currentColor` so it inherits both themes without a variant.
 */
export function Logo({ size = 24, className, ...props }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path
        d="M4 20c0-4.418 3.582-8 8-8s8-3.582 8-8"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <circle cx="19.75" cy="4.25" r="2.75" fill="currentColor" />
    </svg>
  )
}
