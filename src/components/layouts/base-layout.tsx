"use client"

import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { useSidebarConfig } from "@/hooks/use-sidebar-config"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

interface BaseLayoutProps {
  children: React.ReactNode
  title?: string
  description?: string
}

/*
 * The floating theme-customizer gear and "Start a project" button were removed
 * here for the same reason as in `app/(dashboard)/layout.tsx`: both were
 * template overlays that sat on top of real content on every screen.
 */
export function BaseLayout({ children, title, description }: BaseLayoutProps) {
  const { config } = useSidebarConfig()

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "16rem",
          "--sidebar-width-icon": "3rem", 
          "--header-height": "calc(var(--spacing) * 14)",
        } as React.CSSProperties
      }
      className={config.collapsible === "none" ? "sidebar-none-mode" : ""}
    >
      {config.side === "left" ? (
        <>
          <AppSidebar 
            variant={config.variant} 
            collapsible={config.collapsible} 
            side={config.side} 
          />
          <SidebarInset>
            <SiteHeader />
            <div className="flex flex-1 flex-col">
              <div className="@container/main flex flex-1 flex-col gap-2">
                <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                  {title && (
                    <div className="px-4 lg:px-6">
                      <div className="flex flex-col gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                        {description && (
                          <p className="text-muted-foreground">{description}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {children}
                </div>
              </div>
            </div>
            <SiteFooter />
          </SidebarInset>
        </>
      ) : (
        <>
          <SidebarInset>
            <SiteHeader />
            <div className="flex flex-1 flex-col">
              <div className="@container/main flex flex-1 flex-col gap-2">
                <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                  {title && (
                    <div className="px-4 lg:px-6">
                      <div className="flex flex-col gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                        {description && (
                          <p className="text-muted-foreground">{description}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {children}
                </div>
              </div>
            </div>
            <SiteFooter />
          </SidebarInset>
          <AppSidebar 
            variant={config.variant} 
            collapsible={config.collapsible} 
            side={config.side} 
          />
        </>
      )}
    </SidebarProvider>
  )
}
