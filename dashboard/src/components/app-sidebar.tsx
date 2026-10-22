import { NavLink, useLocation } from "react-router-dom"
import {
  BookOpenIcon, CalendarDaysIcon, FileBarChartIcon, GiftIcon, GlobeIcon, HandHeartIcon, HeartHandshakeIcon, ImageIcon,
  LayoutDashboardIcon, LogOutIcon, MessageSquareIcon, ReceiptIcon, SchoolIcon, Settings2Icon, UserPlusIcon, UsersIcon, type LucideIcon,
} from "lucide-react"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarSeparator, useSidebar,
} from "@/components/ui/sidebar"
import { useSession } from "@/lib/backend"

const NAV: [string, [string, string, LucideIcon][]][] = [
  ["", [["/", "Dashboard", LayoutDashboardIcon], ["/calendar", "Calendar", CalendarDaysIcon]]],
  ["The Home", [["/children", "Children", UsersIcon]]],
  ["Money", [["/donations", "Donations", HandHeartIcon], ["/donors", "Donors", HeartHandshakeIcon], ["/expenses", "Expenses", ReceiptIcon]]],
  ["People", [["/messages", "Messages", MessageSquareIcon], ["/volunteers", "Volunteers", UserPlusIcon]]],
  ["Outreach", [["/outreach_visits", "School visits", SchoolIcon], ["/distributions", "Items handed out", GiftIcon]]],
  ["Website", [["/stories", "Stories", BookOpenIcon], ["/gallery_photos", "Gallery", ImageIcon], ["/settings", "Stats & details", Settings2Icon]]],
  ["Reports", [["/reports", "Reports", FileBarChartIcon]]],
]

export function AppSidebar() {
  const { db } = useSession()
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()
  const active = (to: string) => (to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/"))
  return (
    <Sidebar variant="floating" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Namelok Naretoi Home">
              <NavLink to="/" onClick={() => setOpenMobile(false)}>
                <img src="../images/logo.png" alt="" className="size-8 shrink-0 rounded-full" />
                <span className="text-base font-bold tracking-widest text-white">NAMELOK</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        {NAV.map(([group, items], i) => (
          <SidebarGroup key={i} className="py-1">
            {group && <SidebarGroupLabel className="text-sidebar-foreground/50">{group}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map(([to, text, Icon]) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton asChild isActive={active(to)} tooltip={text}
                      className="data-[active=true]:bg-sidebar-primary data-[active=true]:font-semibold data-[active=true]:text-sidebar-primary-foreground">
                      <NavLink to={to} onClick={() => setOpenMobile(false)}><Icon /><span>{text}</span></NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="View website"><a href="../index.html" target="_blank" rel="noopener"><GlobeIcon /><span>View website</span></a></SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Log out" onClick={async () => { await db.signOut(); location.href = location.pathname }}><LogOutIcon /><span>Log out</span></SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
