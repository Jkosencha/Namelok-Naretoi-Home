import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "next-themes"
import { BellIcon, BookOpenIcon, HeartHandshakeIcon, MessageSquareIcon, MoonIcon, SearchIcon, SunIcon, UserPlusIcon, UsersIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { usePageTitleValue } from "@/components/page"
import { useSession } from "@/lib/backend"
import { CHILD_CATEGORY, label } from "@/lib/domain"
import type { Row } from "@/lib/format"

type Hit = { text: string; sub: string; to: string; icon: typeof UsersIcon }

export const displayName = (email: string) => (email || "Admin").split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

export function SiteHeader() {
  const { db, user } = useSession()
  const title = usePageTitleValue()
  const navigate = useNavigate()
  const { resolvedTheme, setTheme } = useTheme()
  const [q, setQ] = useState("")
  const [index, setIndex] = useState<Hit[] | null>(null)
  const [newMessages, setNewMessages] = useState(0)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => { db.list("contact_messages").then((m) => setNewMessages(m.filter((x) => x.status === "new").length)).catch(() => {}) }, [db, title])
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setQ("") }
    document.addEventListener("click", close)
    return () => document.removeEventListener("click", close)
  }, [])
  const loadIndex = async () => {
    if (index) return
    const [children, donors, volunteers, messages, stories] = await Promise.all(["children", "donors", "volunteers", "contact_messages", "stories"].map((t) => db.list(t)))
    setIndex([
      ...children.map((c: Row) => ({ text: `${c.first_name} ${c.last_name}`.trim(), sub: "Child · " + label(CHILD_CATEGORY, c.category), to: "/children/" + c.id, icon: UsersIcon })),
      ...donors.map((d: Row) => ({ text: d.name, sub: "Donor" + (d.organisation ? " · " + d.organisation : ""), to: "/donors", icon: HeartHandshakeIcon })),
      ...volunteers.map((v: Row) => ({ text: v.name, sub: "Volunteer", to: "/volunteers", icon: UserPlusIcon })),
      ...messages.map((m: Row) => ({ text: `${m.first_name} ${m.last_name}`.trim(), sub: "Message · " + (m.reason || "General"), to: "/messages", icon: MessageSquareIcon })),
      ...stories.map((s: Row) => ({ text: s.title, sub: "Story", to: "/stories", icon: BookOpenIcon })),
    ])
  }
  const hits = q.trim() && index ? index.filter((r) => (r.text + " " + r.sub).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8) : []
  const go = (to: string) => { setQ(""); navigate(to) }

  return (
    <header className="flex flex-wrap items-center gap-3 rounded-xl bg-card px-3 py-2.5 ring-1 ring-foreground/10 sm:px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="hidden h-5 sm:block" />
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <div ref={box} className="relative order-last w-full sm:order-none sm:ml-auto sm:w-80">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onFocus={loadIndex} onChange={(e) => { setQ(e.target.value); loadIndex() }} onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) go(hits[0].to); if (e.key === "Escape") setQ("") }}
          placeholder="Search children, donors, volunteers…" aria-label="Search" className="bg-muted/60 pl-8" />
        {q.trim() && (
          <div className="absolute inset-x-0 top-full z-50 mt-2 rounded-lg border bg-popover p-1 shadow-md">
            {hits.length ? hits.map((h, i) => (
              <button key={i} onClick={() => go(h.to)} className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
                <h.icon className="size-4 text-muted-foreground" />
                <span className="min-w-0"><span className="block truncate font-medium">{h.text}</span><span className="block truncate text-xs text-muted-foreground">{h.sub}</span></span>
              </button>
            )) : <p className="px-2 py-1.5 text-sm text-muted-foreground">{index ? "No matches" : "Searching…"}</p>}
          </div>
        )}
      </div>
      <div className="ml-auto flex items-center gap-1 sm:ml-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Switch theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}</Button>
          </TooltipTrigger>
          <TooltipContent>{resolvedTheme === "dark" ? "Light theme" : "Dark theme"}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Messages" onClick={() => navigate("/messages")}>
              <BellIcon />{newMessages > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-chart-4 ring-2 ring-card" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{newMessages ? `${newMessages} new message${newMessages > 1 ? "s" : ""}` : "Messages"}</TooltipContent>
        </Tooltip>
        <Avatar className="ml-1 size-8"><AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">{displayName(user.email).slice(0, 1)}</AvatarFallback></Avatar>
      </div>
    </header>
  )
}
