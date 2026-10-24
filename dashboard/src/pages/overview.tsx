import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { HandHeartIcon, SchoolIcon, UserPlusIcon, UsersIcon, type LucideIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Donut, MonthBars } from "@/components/charts"
import { ErrorNote, Loading, Page } from "@/components/page"
import { CalendarCard } from "@/pages/calendar"
import { useTables } from "@/lib/backend"
import { CATEGORY_COLOR, CHILD_CATEGORY, currentClass, isCurrent, label } from "@/lib/domain"
import { initials, money, shortDate, thisYear } from "@/lib/format"

function Stat({ icon: Icon, tone, title, value, to }: { icon: LucideIcon; tone: number; title: string; value: string; to: string }) {
  return (
    <Link to={to} className="block">
      <Card className="flex-row items-center gap-4 px-5 py-5 transition-shadow hover:shadow-md">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, var(--chart-${tone}) 13%, transparent)`, color: `var(--chart-${tone})` }}>
          <Icon className="size-6" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm text-muted-foreground">{title}</span>
          <span className="block truncate text-2xl font-semibold tracking-tight">{value}</span>
        </span>
      </Card>
    </Link>
  )
}

export function Overview() {
  const { data, error } = useTables(["children", "donations", "outreach_visits", "volunteers"])
  const navigate = useNavigate()
  const year = new Date().getFullYear()
  const [chartYear, setChartYear] = useState(String(year))
  const [asTable, setAsTable] = useState(false)

  const view = useMemo(() => {
    if (!data) return null
    const { children, donations, outreach_visits: visits, volunteers } = data
    const sum = (rows: any[], f: (r: any) => number) => rows.reduce((s, r) => s + f(r), 0)
    const inCare = children.filter(isCurrent)
    const years = [...new Set([year, ...donations.map((d) => Number(String(d.received_on).slice(0, 4))).filter(Boolean)])].sort((a, b) => b - a)
    const months = Array.from({ length: 12 }, (_, m) => {
      const key = `${chartYear}-${String(m + 1).padStart(2, "0")}`, d = new Date(Number(chartYear), m, 1)
      return { label: d.toLocaleDateString("en-GB", { month: "short" }), full: d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }), value: sum(donations.filter((x) => String(x.received_on).startsWith(key)), (x) => Number(x.amount)) }
    })
    const short: Record<string, string> = { rescued_girl: "Rescued girls", rescued_boy: "Rescued boys", disability: "Disability", vulnerable: "Vulnerable" }
    return {
      inCare, years, months,
      graduated: children.filter((c) => c.status === "graduated").length,
      home: children.filter((c) => c.status === "reintegrated").length,
      reached: sum(visits.filter((v) => thisYear(v.visit_date)), (v) => v.girls_reached + v.boys_reached),
      active: volunteers.filter((v) => v.status === "active").length,
      given: sum(donations.filter((d) => thisYear(d.received_on)), (d) => Number(d.amount)),
      recent: [...children].filter((c) => c.admission_date).sort((a, b) => (a.admission_date < b.admission_date ? 1 : -1)).slice(0, 5),
      byCategory: ["rescued_girl", "rescued_boy", "disability", "vulnerable"].map((v) => ({ label: short[v], value: inCare.filter((c) => c.category === v).length, color: CATEGORY_COLOR[v] })),
    }
  }, [data, chartYear, year])

  return (
    <Page title="Dashboard">
      {error ? <ErrorNote message={error} /> : !view ? <Loading /> : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={UsersIcon} tone={1} title="Children in care" value={view.inCare.length.toLocaleString()} to="/children" />
            <Stat icon={SchoolIcon} tone={2} title={`Pupils reached ${year}`} value={view.reached.toLocaleString()} to="/outreach_visits" />
            <Stat icon={UserPlusIcon} tone={3} title="Active volunteers" value={view.active.toLocaleString()} to="/volunteers" />
            <Stat icon={HandHeartIcon} tone={4} title={`Donations ${year}`} value={money(view.given)} to="/donations" />
          </div>

          <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-[1.35fr_1fr_360px]">
            <Card className="lg:col-span-2 2xl:col-start-1 2xl:row-start-1">
              <CardHeader>
                <CardTitle>Donations</CardTitle>
                <CardDescription><span className="font-semibold text-foreground">{money(view.months.reduce((s, m) => s + m.value, 0))}</span> received in {chartYear}</CardDescription>
                <CardAction className="flex items-center gap-1">
                  <Select value={chartYear} onValueChange={setChartYear}>
                    <SelectTrigger size="sm" className="w-24" aria-label="Year"><SelectValue /></SelectTrigger>
                    <SelectContent>{view.years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" onClick={() => setAsTable(!asTable)}>{asTable ? "Chart" : "Table"}</Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                {asTable ? (
                  <Table><TableHeader><TableRow><TableHead>Month</TableHead><TableHead className="text-right">Donations</TableHead></TableRow></TableHeader>
                    <TableBody>{view.months.map((m) => <TableRow key={m.full}><TableCell>{m.full}</TableCell><TableCell className="text-right tabular-nums">{money(m.value)}</TableCell></TableRow>)}</TableBody></Table>
                ) : <MonthBars data={view.months} format={money} />}
              </CardContent>
            </Card>

            <Card className="2xl:col-start-3 2xl:row-span-2 2xl:row-start-1">
              <CardHeader><CardTitle>Calendar</CardTitle><CardAction><Button variant="link" size="sm" asChild><Link to="/calendar">Open</Link></Button></CardAction></CardHeader>
              <CardContent><CalendarCard /></CardContent>
            </Card>

            <Card className="2xl:col-start-2 2xl:row-span-2 2xl:row-start-2">
              <CardHeader><CardTitle>Children in care</CardTitle><CardDescription>By category</CardDescription></CardHeader>
              <CardContent className="grid gap-4">
                {view.inCare.length ? <Donut data={view.byCategory} centerLabel="In care" /> : <p className="text-sm text-muted-foreground">No children in care recorded yet.</p>}
                {(view.graduated > 0 || view.home > 0) && (
                  <Link to="/children" className="grid grid-cols-2 gap-3 border-t pt-4 text-sm">
                    <span><span className="block text-xl font-semibold tabular-nums">{view.graduated}</span><span className="text-muted-foreground">finished school</span></span>
                    <span><span className="block text-xl font-semibold tabular-nums">{view.home}</span><span className="text-muted-foreground">back with family</span></span>
                  </Link>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 2xl:col-span-1 2xl:col-start-1 2xl:row-span-2 2xl:row-start-2">
              <CardHeader><CardTitle>Recently admitted</CardTitle><CardAction><Button variant="link" size="sm" asChild><Link to="/children">All children</Link></Button></CardAction></CardHeader>
              <CardContent className="px-2 sm:px-4">
                {view.recent.length ? (
                  <Table>
                    <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead className="hidden sm:table-cell">Class</TableHead><TableHead className="hidden text-right sm:table-cell">Admitted</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {view.recent.map((c) => (
                        <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate("/children/" + c.id)}>
                          <TableCell><span className="flex items-center gap-2.5 font-medium"><Avatar className="size-7"><AvatarFallback className="text-[10px]">{initials(c.first_name, c.last_name)}</AvatarFallback></Avatar>{`${c.first_name} ${c.last_name}`.trim()}</span></TableCell>
                          <TableCell><CategoryBadge value={c.category} /></TableCell>
                          <TableCell className="hidden sm:table-cell">{currentClass(c)?.name || "—"}</TableCell>
                          <TableCell className="hidden text-right tabular-nums sm:table-cell">{shortDate(c.admission_date)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : <p className="text-sm text-muted-foreground">No admissions recorded yet.</p>}
              </CardContent>
            </Card>

            <Card className="relative min-h-40 justify-center gap-4 overflow-hidden border-0 bg-[#3e4a5e] lg:col-span-2 2xl:col-span-1 2xl:col-start-3 2xl:row-start-3 px-6 py-6 text-white dark:bg-[#2b3546]">
              <p className="relative z-10 max-w-56 text-base font-semibold leading-snug">See what visitors see on the Namelok website</p>
              <Button asChild variant="secondary" className="relative z-10 w-fit bg-white text-[#1f2937] hover:bg-white/90"><a href="../index.html" target="_blank" rel="noopener">Open website</a></Button>
              <span aria-hidden className="absolute -bottom-12 -right-10 size-44 rounded-full border-[26px] border-chart-2" />
              <span aria-hidden className="absolute -bottom-4 -right-2 size-24 rounded-full border-[14px] border-chart-3" />
            </Card>
          </div>
        </>
      )}
    </Page>
  )
}

export function CategoryBadge({ value }: { value: string }) {
  const color = CATEGORY_COLOR[value] || "var(--muted-foreground)"
  return <Badge variant="secondary" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color: `color-mix(in srgb, ${color} 80%, var(--foreground))` }}>{label(CHILD_CATEGORY, value)}</Badge>
}
