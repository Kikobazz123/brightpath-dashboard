"use client"

/**
 * Toast host.
 *
 * Two corrections to the version this shipped with. It needed the client
 * directive — it reads a hook, so rendering it from the root layout (a Server
 * Component) fails the build outright. And it was reading `next-themes`, which
 * nothing in this app mounts; the theme actually lives in
 * `@/components/theme-provider`, so toasts were falling back to "system"
 * regardless of what the user had chosen.
 */

import { Toaster as Sonner, type ToasterProps } from "sonner"

import { useTheme } from "@/hooks/use-theme"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
