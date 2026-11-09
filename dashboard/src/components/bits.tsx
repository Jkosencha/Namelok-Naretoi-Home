import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { EllipsisIcon, SearchIcon, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// A number with an icon on a soft tint of one chart colour; a link when `to` is given
export function Stat({ icon: Icon, tone, title, value, sub, to }: { icon: LucideIcon; tone: number; title: string; value: string; sub?: string; to?: string }) {
  const card = (
    <Card className={cn("h-full flex-row items-center gap-4 px-5 py-5", to && "transition-shadow hover:shadow-md")}>
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, var(--chart-${tone}) 13%, transparent)`, color: `var(--chart-${tone})` }}>
        <Icon className="size-6" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-muted-foreground">{title}</span>
        <span className="block truncate text-2xl font-semibold tracking-tight">{value}</span>
        {sub && <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{sub}</span>}
      </span>
    </Card>
  )
  return to ? <Link to={to} className="block">{card}</Link> : card
}

// The search box above lists
export function SearchBox({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <div className={cn("relative w-full sm:w-64", className)}>
      <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="pl-8" />
    </div>
  )
}

// Less-used actions, tucked under a "More" button
export function MoreMenu({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="outline" aria-label="More actions"><EllipsisIcon /><span className="sr-only sm:not-sr-only">More</span></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">{children}</DropdownMenuContent>
    </DropdownMenu>
  )
}
export { DropdownMenuItem as MoreItem, DropdownMenuSeparator as MoreSeparator } from "@/components/ui/dropdown-menu"
