"use client"

import * as React from "react"
import {
  LayoutDashboard,
  Mail,
  CheckSquare,
  Calendar,
  Settings,
  HelpCircle,
  CreditCard,
  LayoutTemplate,
  Users,
  Target,
  UserPlus,
} from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { SidebarNotification } from "@/components/sidebar-notification"
import { siteConfig } from "@/config/site"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: siteConfig.user,
  navGroups: [
    /**
     * Three groups, each named for what a person came to do: work the pipeline,
     * run the day, or change how the company is presented.
     *
     * The middle group used to be labelled "Template pages" and the routes were
     * ordered by what the theme happened to ship — a second demo dashboard, a
     * chat mock, sign-in and error galleries. Naming a group after where its
     * code came from tells a client they are looking at a demo, and the entries
     * that only existed to show off the template have been dropped.
     *
     * Dropping a link does not delete the route: /dashboard-2, /chat, the auth
     * gallery and the error pages all still render if visited directly, and the
     * error pages still do their real job when Next.js throws. They are simply
     * no longer advertised as places to go.
     */
    {
      label: "Sales assistant",
      items: [
        {
          title: "Pipeline",
          url: "/dashboard",
          icon: LayoutDashboard,
        },
        {
          title: "Leads",
          url: "/leads",
          icon: Target,
        },
        {
          title: "Capture lead",
          url: "/leads/new",
          icon: UserPlus,
        },
      ],
    },
    {
      label: "Workspace",
      items: [
        {
          title: "Inbox",
          url: "/mail",
          icon: Mail,
        },
        {
          title: "Tasks",
          url: "/tasks",
          icon: CheckSquare,
        },
        {
          title: "Calendar",
          url: "/calendar",
          icon: Calendar,
        },
        {
          title: "Team",
          url: "/users",
          icon: Users,
        },
      ],
    },
    {
      label: "Company",
      items: [
        {
          title: "Website",
          url: "/landing",
          target: "_blank",
          icon: LayoutTemplate,
        },
        {
          title: "Pricing",
          url: "/pricing",
          icon: CreditCard,
        },
        {
          title: "FAQs",
          url: "/faqs",
          icon: HelpCircle,
        },
        {
          title: "Settings",
          url: "#",
          icon: Settings,
          items: [
            {
              title: "Account",
              url: "/settings/account",
            },
            {
              title: "Profile",
              url: "/settings/user",
            },
            {
              title: "Notifications",
              url: "/settings/notifications",
            },
            {
              title: "Connections",
              url: "/settings/connections",
            },
            {
              title: "Appearance",
              url: "/settings/appearance",
            },
            {
              title: "Plans & Billing",
              url: "/settings/billing",
            },
          ],
        },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Logo size={24} className="text-current" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{siteConfig.name}</span>
                  <span className="truncate text-xs">{siteConfig.sidebarSubtitle}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {data.navGroups.map((group) => (
          <NavMain key={group.label} label={group.label} items={group.items} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarNotification />
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
