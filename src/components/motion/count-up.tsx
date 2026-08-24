"use client"

import * as React from "react"

/**
 * Parsed shape of a display figure.
 *
 * The dashboards render values like `$1,250.00`, `45,678`, `12.5K`, `4.5%`
 * and `$2.4M`. Animating those means separating the number from the notation
 * around it, then putting the notation back on every frame — otherwise a
 * counting `$54,230` briefly renders as `54230` and the currency and grouping
 * pop back in at the end, which looks broken.
 */
interface ParsedFigure {
  prefix: string
  suffix: string
  target: number
  decimals: number
  grouped: boolean
}

const FIGURE = /^(\D*?)(-?[\d,]*\.?\d+)(.*)$/s

function parseFigure(value: string): ParsedFigure | null {
  const match = FIGURE.exec(value.trim())
  if (!match) return null

  const [, prefix, core, suffix] = match
  const target = Number.parseFloat(core.replace(/,/g, ""))
  if (!Number.isFinite(target)) return null

  const dot = core.indexOf(".")

  return {
    prefix,
    suffix,
    target,
    decimals: dot === -1 ? 0 : core.length - dot - 1,
    grouped: core.includes(","),
  }
}

function format(n: number, { prefix, suffix, decimals, grouped }: ParsedFigure) {
  const body = grouped
    ? n.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : n.toFixed(decimals)

  return `${prefix}${body}${suffix}`
}

/** Ease-out expo: fast start, long settle. Reads as decisive rather than mechanical. */
const ease = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t))

/** useLayoutEffect on the client, useEffect on the server (which never runs it). */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

export function CountUp({
  value,
  duration = 1100,
  className,
}: {
  /** The final figure, exactly as it should read when settled. */
  value: string
  duration?: number
  className?: string
}) {
  const ref = React.useRef<HTMLSpanElement>(null)

  useIsomorphicLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const figure = parseFigure(value)
    if (!figure) return

    // Anyone who has asked for less motion just gets the number.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    let raf = 0
    let start: number | null = null
    let done = false

    const step = (now: number) => {
      if (start === null) start = now
      const t = Math.min((now - start) / duration, 1)
      el.textContent = format(figure.target * ease(t), figure)
      if (t < 1) {
        raf = requestAnimationFrame(step)
      } else {
        done = true
        el.textContent = value
      }
    }

    // Only count once the tile is actually on screen. Several of these sit
    // below the fold on Dashboard 2, and a counter that finished while
    // off-screen is just a static number with extra steps.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || done) continue
          observer.disconnect()
          // Zero it before paint so the final value never flashes first.
          el.textContent = format(0, figure)
          raf = requestAnimationFrame(step)
        }
      },
      { threshold: 0.25 },
    )

    observer.observe(el)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf)
      // Leave the settled value behind on unmount, not a half-counted one.
      el.textContent = value
    }
  }, [value, duration])

  // Server and first paint render the finished figure: no layout shift, and
  // the correct number is present with JS disabled.
  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  )
}
