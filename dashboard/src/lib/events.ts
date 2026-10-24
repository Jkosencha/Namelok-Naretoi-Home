import { RESOURCES, label } from "./domain"
import { iso, type Row } from "./format"

// Everything with a date: Namelok's own events, school visits and children's care dates
export type CalEvent = { date: string; title: string; sub: string; time: string; tone: 1 | 2 | 3 | 4; source: "own" | "visit" | "child"; row?: Row; to?: string }
export const LEGEND: [number, string][] = [[1, "Meetings & events"], [2, "School visits"], [3, "Children's care"], [4, "Donors & holidays"]]
export const TONE_COLOR = { 1: "var(--chart-1)", 2: "var(--chart-2)", 3: "var(--chart-3)", 4: "var(--chart-4)" } as const

export function collectEvents(own: Row[], visits: Row[], childEvents: Row[], children: Row[]): CalEvent[] {
  const kindOpts = RESOURCES.calendar_events.fields.find((f) => f.name === "kind")!.options
  const name = Object.fromEntries(children.map((c) => [c.id, c.first_name]))
  const out: CalEvent[] = []
  for (const e of own) {
    const end = new Date((e.ends_on || e.starts_on) + "T00:00:00")
    for (let d = new Date(e.starts_on + "T00:00:00"); d <= end && out.length < 5000; d.setDate(d.getDate() + 1)) {
      out.push({ date: iso(d), title: e.title, sub: [label(kindOpts, e.kind), e.location].filter(Boolean).join(" · "), time: e.start_time || "", tone: ["donor", "holiday"].includes(e.kind) ? 4 : 1, source: "own", row: e })
    }
  }
  for (const v of visits) out.push({ date: v.visit_date, title: `School visit: ${v.school_name}`, sub: v.location || "Outreach", time: "", tone: 2, source: "visit", to: "/outreach_visits" })
  for (const e of childEvents) out.push({ date: e.event_date, title: e.title, sub: name[e.child_id] ? `${name[e.child_id]} · children's care` : "Children's care", time: "", tone: 3, source: "child", to: "/children/" + e.child_id })
  return out.sort((a, b) => (a.date + (a.time || "99") < b.date + (b.time || "99") ? -1 : 1))
}

// Monday-first dates covering a month
export function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  const start = new Date(first)
  start.setDate(1 - ((first.getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
}
