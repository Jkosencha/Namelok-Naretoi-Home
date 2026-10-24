import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { ErrorNote, Loading, Page } from "@/components/page"
import { RecordDialog } from "@/components/record-dialog"
import { useTables } from "@/lib/backend"
import { RESOURCES } from "@/lib/domain"
import { collectEvents, LEGEND, monthGrid, TONE_COLOR, type CalEvent } from "@/lib/events"
import { cn } from "@/lib/utils"
import { fmtDate, iso, shortDate, today, type Row } from "@/lib/format"

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export function useEvents() {
  const { data, error, reload } = useTables(["calendar_events", "outreach_visits", "child_events", "children"])
  const events = useMemo(() => (data ? collectEvents(data.calendar_events, data.outreach_visits, data.child_events, data.children) : null), [data])
  return { events, error, reload }
}

const Legend = () => (
  <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
    {LEGEND.map(([t, text]) => <li key={t} className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px]" style={{ background: TONE_COLOR[t as 1] }} />{text}</li>)}
  </ul>
)

export function CalendarPage() {
  const { events, error, reload } = useEvents()
  const navigate = useNavigate()
  const now = new Date()
  const [shown, setShown] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [selected, setSelected] = useState(today())
  const [dialog, setDialog] = useState<{ open: boolean; row: Row | null; date?: string }>({ open: false, row: null })
  const byDate = useMemo(() => { const m: Record<string, CalEvent[]> = {}; (events || []).forEach((e) => (m[e.date] ||= []).push(e)); return m }, [events])
  const move = (n: number) => { const d = new Date(shown.y, shown.m + n, 1); setShown({ y: d.getFullYear(), m: d.getMonth() }); setSelected(iso(d)) }
  const open = (e: CalEvent) => (e.source === "own" ? setDialog({ open: true, row: e.row! }) : navigate(e.to!))
  const dayEvents = byDate[selected] || []

  return (
    <Page title="Calendar" actions={<Button onClick={() => setDialog({ open: true, row: null, date: selected })}><PlusIcon /> Add event</Button>}>
      {error ? <ErrorNote message={error} /> : !events ? <Loading /> : (
        <div className="grid items-start gap-5 xl:grid-cols-[1fr_320px]">
          <Card className="gap-4">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => move(-1)}><ChevronLeftIcon /></Button>
                <CardTitle className="min-w-40 text-center text-base">{new Date(shown.y, shown.m, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</CardTitle>
                <Button variant="outline" size="icon" aria-label="Next month" onClick={() => move(1)}><ChevronRightIcon /></Button>
                <Button variant="outline" size="sm" onClick={() => { setShown({ y: now.getFullYear(), m: now.getMonth() }); setSelected(today()) }}>Today</Button>
              </div>
              <Legend />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1" role="grid">
                {WEEKDAYS.map((d) => <div key={d} role="columnheader" className="px-1.5 pb-1 text-xs font-medium text-muted-foreground">{d}</div>)}
                {monthGrid(shown.y, shown.m).map((d) => {
                  const date = iso(d), list = byDate[date] || [], other = d.getMonth() !== shown.m
                  return (
                    <button key={date} role="gridcell" onClick={() => setSelected(date)} aria-label={`${fmtDate(date)}, ${list.length} events`}
                      className={cn("flex min-h-16 flex-col gap-1 overflow-hidden rounded-lg border p-1.5 text-left transition-colors hover:bg-muted/60 sm:min-h-24", other && "bg-muted/40", selected === date && "border-ring ring-1 ring-ring")}>
                      <span className={cn("flex size-6 items-center justify-center rounded-full text-xs font-semibold", other && "text-muted-foreground", date === today() && "bg-chart-2 text-white")}>{d.getDate()}</span>
                      {list.slice(0, 3).map((e, i) => (
                        <span key={i} className="hidden truncate rounded-[4px] border-l-[3px] px-1.5 py-px text-[11px] font-medium sm:block" style={{ borderColor: TONE_COLOR[e.tone], background: `color-mix(in srgb, ${TONE_COLOR[e.tone]} 13%, transparent)` }}>{e.time ? `${e.time} ${e.title}` : e.title}</span>
                      ))}
                      {list.length > 0 && <span className="flex gap-0.5 sm:hidden">{list.slice(0, 4).map((e, i) => <span key={i} className="size-1.5 rounded-full" style={{ background: TONE_COLOR[e.tone] }} />)}</span>}
                      {list.length > 3 && <span className="hidden pl-1 text-[11px] font-medium text-muted-foreground sm:block">+{list.length - 3} more</span>}
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
          <Card className="xl:sticky xl:top-24">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{new Date(selected + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setDialog({ open: true, row: null, date: selected })}><PlusIcon /> Add</Button>
            </CardHeader>
            <CardContent className="grid gap-2">
              {dayEvents.length ? dayEvents.map((e, i) => <EventRow key={i} e={e} onClick={() => open(e)} />) : <p className="text-sm text-muted-foreground">Nothing on this day.</p>}
            </CardContent>
          </Card>
        </div>
      )}
      <RecordDialog resource={RESOURCES.calendar_events} row={dialog.row} open={dialog.open} initial={!dialog.row && dialog.date ? { starts_on: dialog.date } : undefined}
        onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} onSaved={() => reload()} />
    </Page>
  )
}

function EventRow({ e, onClick }: { e: CalEvent; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-lg border p-2.5 text-left hover:bg-muted/60">
      <span className="w-1 self-stretch rounded-full" style={{ background: TONE_COLOR[e.tone] }} />
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{e.title}</span><span className="block truncate text-xs text-muted-foreground">{[e.time, e.sub].filter(Boolean).join(" · ")}</span></span>
      <ChevronRightIcon className="size-4 text-muted-foreground" />
    </button>
  )
}

// Small calendar for the dashboard: event days marked, next events listed
export function CalendarCard() {
  const { events } = useEvents()
  const navigate = useNavigate()
  const [month, setMonth] = useState(new Date())
  if (!events) return <Loading />
  const upcoming = events.filter((e) => e.date >= today())
  const tones: Record<number, Date[]> = { 1: [], 2: [], 3: [], 4: [] }
  const seen = new Set<string>()
  events.forEach((e) => { if (!seen.has(e.date)) { seen.add(e.date); tones[e.tone].push(new Date(e.date + "T00:00:00")) } })
  const go = (e: CalEvent) => navigate(e.source === "own" ? "/calendar" : e.to!)
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-2">
        {upcoming.slice(0, 2).map((e, i) => (
          <button key={i} onClick={() => go(e)} className="relative rounded-lg border-l-[3px] bg-muted/60 p-2.5 pr-6 text-left" style={{ borderColor: TONE_COLOR[e.tone] }}>
            <span className="block text-[11px] text-muted-foreground">{fmtDate(e.date)}</span>
            <span className="line-clamp-2 text-xs font-semibold leading-snug">{e.title}</span>
            <ChevronRightIcon className="absolute right-1.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          </button>
        ))}
        {!upcoming.length && <p className="col-span-2 text-sm text-muted-foreground">Nothing coming up.</p>}
      </div>
      <Calendar mode="single" month={month} onMonthChange={setMonth} weekStartsOn={1} onDayClick={() => navigate("/calendar")}
        className="w-full rounded-lg bg-muted/50 p-2 [--cell-size:--spacing(9)] [&_td]:aspect-auto [&_td_button]:aspect-auto [&_td_button]:h-(--cell-size)"
        modifiers={{ tone1: tones[1], tone2: tones[2], tone3: tones[3], tone4: tones[4] }}
        modifiersClassNames={{
          tone1: "[&>button]:bg-chart-1/15 [&>button]:text-chart-1", tone2: "[&>button]:bg-chart-2/15 [&>button]:text-chart-2",
          tone3: "[&>button]:bg-chart-3/15 [&>button]:text-chart-3", tone4: "[&>button]:bg-chart-4/15 [&>button]:text-chart-4",
          today: "[&>button]:!bg-chart-2 [&>button]:!text-white",
        }} />
      {upcoming.length > 2 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Coming up</p>
          <ul>
            {upcoming.slice(2, 6).map((e, i) => (
              <li key={i}><button onClick={() => go(e)} className="flex w-full items-center gap-2.5 rounded-md px-1 py-1.5 text-left text-sm hover:bg-muted/60">
                <span className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">{shortDate(e.date)}</span>
                <span className="size-2 shrink-0 rounded-full" style={{ background: TONE_COLOR[e.tone] }} />
                <span className="truncate font-medium">{e.title}</span>
              </button></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
