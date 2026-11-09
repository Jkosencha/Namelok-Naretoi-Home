import { useEffect, useRef, useState } from "react"
import DOMPurify from "dompurify"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeftIcon, DownloadIcon, FileIcon, FileTextIcon, PencilIcon, PlusIcon, PrinterIcon, RefreshCwIcon, SaveIcon, SlidersHorizontalIcon, Trash2Icon, UploadIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { MoreItem, MoreMenu, MoreSeparator, SearchBox } from "@/components/bits"
import { ErrorNote, Loading, Page } from "@/components/page"
import { SelectField } from "@/components/record-dialog"
import { useDb, useTables, type Backend } from "@/lib/backend"
import { CALENDAR_KINDS, CHILD_CATEGORY, EVENT_TYPES, EXPENSE_CATEGORY, isCurrent, ITEMS, label } from "@/lib/domain"
import { cash, fmtDate, friendly, iso, longDate, money, rate, type Row } from "@/lib/format"
import { fundSummary } from "@/lib/funds"

const KINDS: Record<string, string> = { daily: "Daily", monthly: "Monthly", quarterly: "Quarterly", annual: "Annual", custom: "Custom" }
const labelsOf = (options: { value: string; label: string }[]) => Object.fromEntries(options.map((o) => [o.value, o.label]))
const paras = (text: string) => (text || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

function periodFor(kind: string, v: Row) {
  if (kind === "daily") return { start: v.day, end: v.day }
  if (kind === "monthly") { const [y, m] = v.month.split("-").map(Number); return { start: iso(new Date(y, m - 1, 1)), end: iso(new Date(y, m, 0)) } }
  if (kind === "quarterly") { const q = Number(v.quarter), y = Number(v.year); return { start: iso(new Date(y, (q - 1) * 3, 1)), end: iso(new Date(y, q * 3, 0)) } }
  if (kind === "annual") return { start: `${v.year}-01-01`, end: `${v.year}-12-31` }
  return { start: v.start, end: v.end }
}
function titleFor(kind: string, start: string, end: string, donorName?: string) {
  const s = new Date(start + "T00:00:00"), e = new Date(end + "T00:00:00")
  const base = kind === "daily" ? `Daily report – ${s.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`
    : kind === "monthly" ? `Monthly report – ${s.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`
    : kind === "quarterly" ? `Quarterly report – Q${Math.floor(s.getMonth() / 3) + 1} ${s.getFullYear()} (${s.toLocaleDateString("en-GB", { month: "short" })}–${e.toLocaleDateString("en-GB", { month: "short" })})`
    : kind === "annual" ? `Annual report ${s.getFullYear()}` : `Report – ${fmtDate(start)} to ${fmtDate(end)}`
  return donorName ? `${base} for ${donorName}` : base
}

// Figures for a period, saved with the report so it never changes after sending
async function computeFigures(db: Backend, start: string, end: string, donor: { id: string; name: string } | null) {
  const [children, events, donations, visits, items, expenses, sponsorships, donors, calendar] = await Promise.all(
    ["children", "child_events", "donations", "outreach_visits", "distributions", "expenses", "sponsorships", "donors", "calendar_events"].map((t) => db.list(t)))
  const todayIso = iso(new Date())
  const within = (d?: string) => !!d && d.slice(0, 10) >= start && d.slice(0, 10) <= end
  const matches = (d: Row) => !donor || d.donor_id === donor.id || String(d.donor_name || "").trim().toLowerCase() === donor.name.trim().toLowerCase()
  const held = visits.filter((v) => within(v.visit_date) && v.visit_date <= todayIso).sort((a, b) => (a.visit_date < b.visit_date ? -1 : 1))
  const itemTotals: Row = {}
  for (const i of items.filter((i) => within(i.distributed_on))) itemTotals[i.item] = (itemTotals[i.item] || 0) + i.quantity
  return {
    generated_at: new Date().toISOString(),
    activities: activitiesFor(start, end, { children, events, donations: donations.filter(matches), visits, items, calendar }),
    funds: fundsFor(donor ? donors.find((d) => d.id === donor.id) || donor : null, donations, expenses, sponsorships, start, end),
    outreach: {
      visits: held.length, girls: held.reduce((s, v) => s + v.girls_reached, 0), boys: held.reduce((s, v) => s + v.boys_reached, 0), parents: held.reduce((s, v) => s + v.parents_reached, 0),
      list: held.map((v) => [v.visit_date, v.school_name, v.location || "", v.girls_reached + v.boys_reached]),
    },
    items: itemTotals,
  }
}

// Everything that happened in the period, in date order: [date, kind, what, detail].
// Children are never named, so the report stays safe to send to donors.
function activitiesFor(start: string, end: string, t: Record<string, Row[]>) {
  const within = (d?: string) => !!d && d.slice(0, 10) >= start && d.slice(0, 10) <= end
  const out: [string, string, string, string][] = []
  const itemsAt = (visitId: string) => t.items.filter((i) => i.visit_id === visitId).map((i) => `${Number(i.quantity).toLocaleString()} ${label(ITEMS, i.item).toLowerCase()}`).join(", ")
  for (const e of t.calendar) {
    const last = e.ends_on || e.starts_on
    if (e.starts_on > end || last < start) continue
    out.push([e.starts_on < start ? start : e.starts_on, label(CALENDAR_KINDS, e.kind) || "Event", e.title, [e.start_time, e.location, e.ends_on && e.ends_on !== e.starts_on ? `until ${fmtDate(e.ends_on)}` : ""].filter(Boolean).join(" · ")])
  }
  for (const v of t.visits.filter((v) => within(v.visit_date))) {
    const pupils = v.girls_reached + v.boys_reached
    out.push([v.visit_date, "School visit", v.school_name + (v.location ? `, ${v.location}` : ""),
      [pupils ? `${pupils.toLocaleString()} pupils reached` : "", v.topics, itemsAt(v.id) ? `Handed out ${itemsAt(v.id)}` : ""].filter(Boolean).join(" · ")])
  }
  for (const e of t.events.filter((e) => within(e.event_date))) out.push([e.event_date, "Child care", e.title, e.type === "other" ? "" : label(EVENT_TYPES, e.type)])
  for (const c of t.children.filter((c) => within(c.admission_date))) out.push([c.admission_date, "Admission", "A child joined the home", label(CHILD_CATEGORY, c.category)])
  for (const c of t.children.filter((c) => !isCurrent(c) && within(c.left_on))) out.push([c.left_on, "Moved on", MOVED_ON_NAMES[c.status] || "A child moved on", ""])
  for (const d of t.donations.filter((d) => within(d.received_on)))
    out.push([d.received_on, "Donation", `${money(d.amount)} from ${d.donor_name || "Anonymous"}`, [d.currency !== "KES" && d.original_amount ? cash(d.original_amount, d.currency) : "", d.purpose].filter(Boolean).join(" · ")])
  const order = ["Admission", "Moved on", "School visit", "Child care", "Donation"]
  return out.sort((a, b) => (a[0] !== b[0] ? (a[0] < b[0] ? -1 : 1) : order.indexOf(a[1]) - order.indexOf(b[1])))
}
const MOVED_ON_NAMES: Record<string, string> = { graduated: "A child finished school", reintegrated: "A child went back to their family", exited: "A child left the programme" }

// Money in, money out and what is left: for a donor's statement, or all spending for a general report
function fundsFor(donor: Row | null, donations: Row[], expenses: Row[], sponsorships: Row[], start: string, end: string) {
  const inPeriod = (e: Row) => e.spent_on >= start && e.spent_on <= end
  const spentList = (rows: Row[]) => rows.filter(inPeriod).sort((a, b) => (a.spent_on < b.spent_on ? -1 : 1))
  const byCategory = (rows: Row[]) => rows.reduce((m: Row, e) => ((m[e.category] = (m[e.category] || 0) + Number(e.amount)), m), {})
  if (!donor) {
    const spent = spentList(expenses)
    return { spent: spent.reduce((s, e) => s + Number(e.amount), 0), by_category: byCategory(spent) }
  }
  const before = new Date(start + "T00:00:00"); before.setDate(before.getDate() - 1)
  const opening = fundSummary(donor, donations, expenses, iso(before)).balance
  const all = fundSummary(donor, donations, expenses, end)
  const received = all.gifts.filter((d) => d.received_on >= start).reduce((s, d) => s + Number(d.amount), 0)
  const spent = spentList(all.spent)
  const used = spent.reduce((s, e) => s + Number(e.amount), 0)
  const closing = opening + received - used
  const r = all.lastForeign
  return {
    opening, received, spent: used, closing, by_category: byCategory(spent),
    list: spent.map((e) => [e.spent_on, e.description, e.category, Number(e.amount), Boolean(e.receipt_path)]),
    closing_foreign: r && closing > 0 ? [r.currency, Math.round(closing / Number(r.exchange_rate)), Number(r.exchange_rate)] : null,
    sponsored: sponsorships.filter((s) => s.donor_id === donor.id && (!s.started_on || s.started_on <= end) && (!s.ended_on || s.ended_on >= start)).length,
  }
}

// ── List ──
export function ReportsList() {
  const { data, error, reload } = useTables(["reports"], { reports: { order: "period_start" } })
  const navigate = useNavigate()
  const [q, setQ] = useState(""), [kind, setKind] = useState(""), [year, setYear] = useState(""), [upload, setUpload] = useState(false)
  const rows = data?.reports || []
  const years = [...new Set(rows.map((r) => r.period_start.slice(0, 4)))].sort().reverse()
  const shown = rows.filter((r) => (!q || (r.title + " " + r.donor_name).toLowerCase().includes(q.toLowerCase())) && (!kind || r.kind === kind) && (!year || r.period_start.startsWith(year)))
  return (
    <Page title="Reports"
      actions={<><Button variant="outline" onClick={() => setUpload(true)}><UploadIcon /> Upload a report</Button><Button asChild><Link to="/reports/new"><PlusIcon /> New report</Link></Button></>}>
      {error ? <ErrorNote message={error} /> : !data ? <Loading /> : (
        <Card className="gap-0 py-0">
          <div className="flex flex-wrap items-center gap-3 border-b p-3">
            <SearchBox value={q} onChange={setQ} placeholder="Search reports…" className="sm:w-72" />
            <div className="w-full sm:w-40"><SelectField value={kind} onChange={setKind} options={[{ value: "", label: "All types" }, ...Object.entries(KINDS).map(([value, label]) => ({ value, label }))]} /></div>
            <div className="w-full sm:w-36"><SelectField value={year} onChange={setYear} options={[{ value: "", label: "All years" }, ...years.map((y) => ({ value: y, label: y }))]} /></div>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead className="px-4">Report</TableHead><TableHead className="hidden px-4 sm:table-cell">Period</TableHead><TableHead className="hidden px-4 lg:table-cell">For</TableHead><TableHead className="hidden px-4 md:table-cell">Type</TableHead><TableHead className="px-4">Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {shown.length ? shown.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate("/reports/" + r.id)}>
                  <TableCell className="px-4"><span className="flex items-center gap-2 whitespace-normal font-medium">{r.file_name ? <FileIcon className="size-4 text-muted-foreground" /> : <FileTextIcon className="size-4 text-muted-foreground" />}{r.title}</span></TableCell>
                  <TableCell className="hidden px-4 sm:table-cell">{fmtDate(r.period_start)} – {fmtDate(r.period_end)}</TableCell>
                  <TableCell className="hidden px-4 lg:table-cell">{r.donor_name || "All donors"}</TableCell>
                  <TableCell className="hidden px-4 md:table-cell">{KINDS[r.kind]}</TableCell>
                  <TableCell className="px-4"><Badge variant={r.status === "final" ? "secondary" : "outline"}>{r.status === "final" ? "Final" : "Draft"}</Badge></TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={5} className="h-28 text-center text-muted-foreground">{rows.length ? "No reports match." : "No reports yet. Use “New report” to make the first one."}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      )}
      <UploadDialog open={upload} onOpenChange={setUpload} onDone={reload} />
    </Page>
  )
}

function UploadDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const db = useDb()
  const y = new Date().getFullYear()
  const [file, setFile] = useState<File | null>(null)
  const [v, setV] = useState({ title: "", kind: "annual", donor: "", start: `${y - 1}-01-01`, end: `${y - 1}-12-31` })
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return setErr("Choose a file to upload.")
    if (file.size > 20 * 1024 * 1024) return setErr("That file is over 20 MB. Please upload a smaller copy.")
    if (!v.title.trim()) return setErr("Give the report a title.")
    if (v.end < v.start) return setErr("The end date must be after the start date.")
    setBusy(true)
    try {
      const path = await db.uploadDocument(file, "reports")
      await db.insert("reports", { title: v.title.trim(), kind: v.kind, period_start: v.start, period_end: v.end, donor_id: null, donor_name: v.donor.trim(), status: "final", file_path: path, file_name: file.name })
      toast.success("Report uploaded"); onOpenChange(false); onDone()
    } catch (ex) { setErr("Could not upload: " + friendly((ex as Error).message)) }
    setBusy(false)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader><DialogTitle>Upload a report</DialogTitle><DialogDescription>PDF, Word, Excel or PowerPoint, up to 20 MB.</DialogDescription></DialogHeader>
          <div className="grid gap-1.5"><Label htmlFor="u_file">File</Label><Input id="u_file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt"
            onChange={(e) => { const f = e.target.files?.[0] || null; setFile(f); if (f && !v.title) setV((x) => ({ ...x, title: f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") })) }} /></div>
          <div className="grid gap-1.5"><Label htmlFor="u_title">Title</Label><Input id="u_title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="e.g. Annual report 2024" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label>Type</Label><SelectField value={v.kind} onChange={(k) => setV({ ...v, kind: k })} options={Object.entries(KINDS).map(([value, label]) => ({ value, label }))} /></div>
            <div className="grid gap-1.5"><Label htmlFor="u_donor">Prepared for (optional)</Label><Input id="u_donor" value={v.donor} onChange={(e) => setV({ ...v, donor: e.target.value })} placeholder="Donor name" /></div>
            <div className="grid gap-1.5"><Label htmlFor="u_start">Period from</Label><Input id="u_start" type="date" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label htmlFor="u_end">to</Label><Input id="u_end" type="date" value={v.end} onChange={(e) => setV({ ...v, end: e.target.value })} /></div>
          </div>
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Uploading…" : "Upload"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── New / edit ──
export function ReportForm() {
  const { id } = useParams()
  const db = useDb()
  const navigate = useNavigate()
  const { data, error } = useTables(["donors", ...(id ? ["reports"] : [])], { donors: { order: "name", ascending: true }, ...(id ? { reports: { eq: { id } } } : {}) })
  const existing = id ? data?.reports?.[0] : null
  const now = new Date(), y = now.getFullYear()
  const last = new Date(y, now.getMonth() - 1, 1)
  const [v, setV] = useState<Row>({ kind: "monthly", day: iso(now), month: iso(last).slice(0, 7), quarter: String(Math.max(1, Math.floor(now.getMonth() / 3))), qyear: String(y), ayear: String(y - 1), start: iso(last), end: iso(new Date(y, now.getMonth(), 0)), donor: "", summary: "", highlights: "", challenges: "", next_steps: "" })
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false)
  const [params] = useSearchParams()
  useEffect(() => {
    if (id || !params.get("donor")) return
    setV((x) => ({ ...x, donor: params.get("donor") || "", kind: params.get("kind") || x.kind, quarter: params.get("quarter") || x.quarter, qyear: params.get("year") || x.qyear }))
  }, [id, params])
  useEffect(() => {
    if (!existing) return
    const ps = existing.period_start
    setV((x) => ({ ...x, kind: existing.kind, day: ps, month: ps.slice(0, 7), quarter: String(Math.floor(Number(ps.slice(5, 7)) / 3) + 1), qyear: ps.slice(0, 4), ayear: ps.slice(0, 4), start: ps, end: existing.period_end,
      donor: existing.donor_id || "", summary: existing.summary, highlights: existing.highlights, challenges: existing.challenges, next_steps: existing.next_steps }))
  }, [existing])
  const donors = data?.donors || []
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr("")
    if (v.kind === "custom" && (!v.start || !v.end || v.end < v.start)) return setErr("Choose a start date and an end date after it.")
    if (v.kind === "daily" && !v.day) return setErr("Choose the day.")
    const { start, end } = periodFor(v.kind, { day: v.day, month: v.month, quarter: v.quarter, year: v.kind === "annual" ? v.ayear : v.qyear, start: v.start, end: v.end })
    const donor = donors.find((d) => d.id === v.donor) || null
    const changed = !existing || existing.period_start !== start || existing.period_end !== end || (existing.donor_id || "") !== (donor?.id || "")
    setBusy(true)
    try {
      const row: Row = { kind: v.kind, period_start: start, period_end: end, donor_id: donor?.id || null, donor_name: donor?.name || "",
        title: existing && !changed ? existing.title : titleFor(v.kind, start, end, donor?.name), summary: v.summary.trim(), highlights: v.highlights.trim(), challenges: v.challenges.trim(), next_steps: v.next_steps.trim() }
      if (changed || !existing?.figures) row.figures = await computeFigures(db, start, end, donor ? { id: donor.id, name: donor.name } : null)
      const saved = existing ? await db.update("reports", existing.id, row) : await db.insert("reports", { ...row, status: "draft" })
      toast.success(existing ? "Report saved" : "Report created")
      navigate("/reports/" + saved.id)
    } catch (ex) { setErr("Could not save: " + friendly((ex as Error).message)); setBusy(false) }
  }
  const area = (name: string, title: string, help?: string) => (
    <div className="grid gap-1.5"><Label htmlFor={"r_" + name}>{title}</Label><Textarea id={"r_" + name} rows={name === "summary" ? 5 : 4} value={v[name]} onChange={(e) => setV({ ...v, [name]: e.target.value })} />{help && <p className="text-xs text-muted-foreground">{help}</p>}</div>
  )
  return (
    <Page title={id ? "Edit report" : "New report"} actions={<Button variant="outline" asChild><Link to={id ? "/reports/" + id : "/reports"}>Cancel</Link></Button>}>
      {error ? <ErrorNote message={error} /> : !data ? <Loading /> : (
        <form onSubmit={submit} className="grid max-w-3xl gap-5">
          <Card>
            <CardHeader><CardTitle>Period and audience</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5"><Label>Type of report</Label><SelectField value={v.kind} onChange={(k) => setV({ ...v, kind: k })} options={Object.entries(KINDS).map(([value, label]) => ({ value, label }))} /></div>
              {v.kind === "daily" && <div className="grid gap-1.5"><Label htmlFor="r_day">Day</Label><Input id="r_day" type="date" value={v.day} onChange={(e) => setV({ ...v, day: e.target.value })} /></div>}
              {v.kind === "monthly" && <div className="grid gap-1.5"><Label htmlFor="r_month">Month</Label><Input id="r_month" type="month" value={v.month} onChange={(e) => setV({ ...v, month: e.target.value })} /></div>}
              {v.kind === "quarterly" && <div className="grid gap-1.5"><Label>Quarter</Label><div className="grid grid-cols-2 gap-2">
                <SelectField value={v.quarter} onChange={(q) => setV({ ...v, quarter: q })} options={["1", "2", "3", "4"].map((q) => ({ value: q, label: "Q" + q }))} />
                <SelectField value={v.qyear} onChange={(q) => setV({ ...v, qyear: q })} options={[y, y - 1, y - 2, y - 3].map((n) => ({ value: String(n), label: String(n) }))} /></div></div>}
              {v.kind === "annual" && <div className="grid gap-1.5"><Label>Year</Label><SelectField value={v.ayear} onChange={(a) => setV({ ...v, ayear: a })} options={[y, y - 1, y - 2, y - 3, y - 4].map((n) => ({ value: String(n), label: String(n) }))} /></div>}
              {v.kind === "custom" && <div className="grid gap-1.5"><Label>From – to</Label><div className="grid grid-cols-2 gap-2"><Input type="date" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} /><Input type="date" value={v.end} onChange={(e) => setV({ ...v, end: e.target.value })} /></div></div>}
              <div className="grid gap-1.5 sm:col-span-2"><Label>Prepared for</Label>
                <SelectField value={v.donor} onChange={(d) => setV({ ...v, donor: d })} options={[{ value: "", label: "All donors (general report)" }, ...donors.map((d) => ({ value: d.id, label: d.name + (d.organisation && d.organisation !== d.name ? ` (${d.organisation})` : "") }))]} />
                <p className="text-xs text-muted-foreground">Adds what this donor gave, what was spent and what is left.</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Your words</CardTitle><CardDescription>Leave a blank line between paragraphs.</CardDescription></CardHeader>
            <CardContent className="grid gap-4">
              {area("summary", "Summary", "A short overview of the period.")}{area("highlights", "Highlights", "Good news, milestones, thank-yous.")}{area("challenges", "Challenges")}{area("next_steps", v.kind === "daily" ? "Plans for tomorrow" : "Plans for the next period")}
            </CardContent>
          </Card>
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
          <div className="flex justify-end"><Button type="submit" disabled={busy}>{busy ? "Working out the figures…" : id ? "Save changes" : "Create report"}</Button></div>
        </form>
      )}
    </Page>
  )
}

// ── One report ──
export function ReportView() {
  const { id } = useParams()
  const db = useDb()
  const navigate = useNavigate()
  const { data, error, reload } = useTables(["reports"], { reports: { eq: { id } } })
  const r = data?.reports[0]
  const [live, setLive] = useState<Row | null>(null)
  const [confirm, setConfirm] = useState(false)
  // Edit the document in place, letterhead to footer; the edited version is saved with the report
  const [editing, setEditing] = useState(false), [docKey, setDocKey] = useState(0), [saving, setSaving] = useState(false), [resetting, setResetting] = useState(false)
  const docRef = useRef<HTMLDivElement>(null)
  const edited = !!r?.document_html
  async function saveDocument() {
    if (!docRef.current) return
    setSaving(true)
    try {
      await db.update("reports", r!.id, { document_html: cleanDocument(docRef.current.innerHTML) })
      toast.success("Document saved"); setEditing(false); reload()
    } catch (e) { toast.error("Could not save: " + (e as Error).message) }
    setSaving(false)
  }
  const isFile = !!r && Boolean(r.file_name) && !r.figures && !r.summary
  useEffect(() => { if (data && !r) navigate("/reports") }, [data, r, navigate])
  useEffect(() => { if (r && !r.figures && !isFile) computeFigures(db, r.period_start, r.period_end, r.donor_id ? { id: r.donor_id, name: r.donor_name } : null).then(setLive) }, [r, isFile, db])
  const f = r?.figures || live

  const actions = !r ? null : editing ? (
    <>
      <Button variant="outline" onClick={() => { setEditing(false); setDocKey((k) => k + 1) }}>Cancel</Button>
      <Button onClick={saveDocument} disabled={saving}><SaveIcon /> {saving ? "Saving…" : "Save document"}</Button>
    </>
  ) : (
    <>
      <Button variant="outline" asChild><Link to="/reports"><ArrowLeftIcon /> All reports</Link></Button>
      {isFile ? <Button onClick={async () => { try { const url = await db.documentUrl(r.file_path, r.file_name); if (url) window.open(url, "_blank", "noopener"); else toast.error("This demo report has no file attached.") } catch (e) { toast.error("Could not open the file: " + (e as Error).message) } }}><DownloadIcon /> Download</Button> : (
        <>
          {r.status === "draft" && <Button variant="outline" onClick={() => setEditing(true)}><PencilIcon /> Edit document</Button>}
          <Button variant="outline" onClick={async () => { await db.update("reports", r.id, { status: r.status === "final" ? "draft" : "final" }); toast.success(r.status === "final" ? "Back to draft" : "Marked as final"); reload() }}>{r.status === "final" ? "Back to draft" : "Mark as final"}</Button>
          <Button onClick={() => window.print()}><PrinterIcon /> Print / Save PDF</Button>
        </>
      )}
      <MoreMenu>
        {!isFile && r.status === "draft" && !edited && <MoreItem asChild><Link to={`/reports/${r.id}/edit`}><SlidersHorizontalIcon /> Edit details</Link></MoreItem>}
        {!isFile && r.status === "draft" && !edited && <MoreItem onSelect={async () => { await db.update("reports", r.id, { figures: await computeFigures(db, r.period_start, r.period_end, r.donor_id ? { id: r.donor_id, name: r.donor_name } : null) }); toast.success("Figures updated"); reload() }}><RefreshCwIcon /> Update figures</MoreItem>}
        {!isFile && r.status === "draft" && edited && <MoreItem onSelect={() => setResetting(true)}><RefreshCwIcon /> Start again from the records</MoreItem>}
        {!isFile && r.status === "draft" && <MoreSeparator />}
        <MoreItem variant="destructive" onSelect={() => setConfirm(true)}><Trash2Icon /> Delete report</MoreItem>
      </MoreMenu>
    </>
  )

  return (
    <Page title={r?.title || "Report"} actions={actions}>
      {error ? <ErrorNote message={error} /> : !r ? <Loading /> : isFile ? (
        <Card className="max-w-2xl flex-row items-center gap-5 px-6">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-muted text-primary"><FileIcon className="size-7" /></span>
          <div><p className="break-all font-semibold">{r.file_name}</p><p className="text-sm text-muted-foreground">{KINDS[r.kind]} report · {fmtDate(r.period_start)} – {fmtDate(r.period_end)}{r.donor_name ? " · for " + r.donor_name : ""}</p></div>
        </Card>
      ) : !f ? <Loading /> : (
        <>
          {editing ? <p className="w-fit rounded-lg bg-chart-1/12 px-3 py-1.5 text-sm font-medium">Click any text to change it, then press “Save document”.</p>
            : edited ? <p className="w-fit rounded-lg bg-muted px-3 py-1.5 text-sm">Edited document</p>
            : r.status === "draft" && <p className="w-fit rounded-lg bg-chart-3/15 px-3 py-1.5 text-sm font-medium">Draft: mark it as final before sending.</p>}
          {(() => {
            const props = { ref: docRef, contentEditable: editing, suppressContentEditableWarning: true, spellCheck: editing,
              className: editing ? "rounded-md outline-2 outline-offset-4 outline-dashed outline-chart-1/60 [&_*]:cursor-text" : undefined }
            return edited
              ? <div key={docKey + ":" + r.updated_at} {...props} dangerouslySetInnerHTML={{ __html: cleanDocument(r.document_html) }} />
              : <div key={docKey} {...props}><ReportDocument r={r} f={f} live={!r.figures} /></div>
          })()}
        </>
      )}
      <AlertDialog open={resetting} onOpenChange={setResetting}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Start again from the records?</AlertDialogTitle>
            <AlertDialogDescription>Your changes to the document will be lost, and it will be rebuilt from the report's details and figures.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { await db.update("reports", r!.id, { document_html: null }); toast.success("Rebuilt from the records"); setDocKey((k) => k + 1); reload() }}>Start again</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this report?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={async () => { await db.remove("reports", r!.id); toast.success("Report deleted"); navigate("/reports") }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  )
}

// Saved documents are shown as HTML, so strip anything that could run code
function cleanDocument(html: string) {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true, svg: true }, FORBID_ATTR: ["contenteditable"] })
}

// Building blocks of the printed report
function Section({ title, children, first }: { title: string; children: React.ReactNode; first?: boolean }) {
  return <section className={(first ? "mt-6" : "mt-7") + " break-inside-avoid"}><h2 className="mb-3 border-b pb-1.5 text-lg font-semibold">{title}</h2>{children}</section>
}
function KV({ obj, labels = {}, fmt = (n: number) => n.toLocaleString() }: { obj: Row; labels?: Row; fmt?: (n: number) => string }) {
  const entries = Object.entries(obj || {}).filter(([, n]) => n)
  return entries.length ? (
    <Table><TableBody>{entries.map(([k, n]) => <TableRow key={k}><TableCell className="px-1">{labels[k] || k}</TableCell><TableCell className="px-1 text-right tabular-nums">{fmt(n as number)}</TableCell></TableRow>)}</TableBody></Table>
  ) : <p className="text-sm italic text-muted-foreground">None recorded in this period.</p>
}
function Tile({ value, text, color }: { value: string; text: string; color: string }) {
  return (
    <div className="rounded-lg border-t-[3px] bg-muted/60 px-4 py-3" style={{ borderColor: color }}>
      <p className="whitespace-nowrap text-lg font-bold leading-tight">{value}</p><p className="text-xs text-muted-foreground">{text}</p>
    </div>
  )
}

// The printable document: always light, like paper
function ReportDocument({ r, f, live }: { r: Row; f: Row; live: boolean }) {
  return (
    <article className="report-doc light mx-auto w-full max-w-[860px] rounded-md border bg-white p-7 text-[13.5px] leading-relaxed text-neutral-700 shadow-lg sm:p-12 [&_h1]:text-neutral-900 [&_h2]:text-neutral-900 [&_h3]:text-neutral-900" style={{ colorScheme: "light" }}>
      <header className="flex items-center gap-5 border-b-[3px] pb-5" style={{ borderColor: "var(--chart-1)" }}>
        <img src="../images/logo.png" alt="" className="size-16 sm:size-20" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--chart-1)" }}>Namelok Naretoi Home · Narok, Kenya</p>
          <h1 className="mt-1 text-2xl font-bold leading-tight">{r.title}</h1>
          <p className="text-neutral-500">{r.period_start === r.period_end ? longDate(r.period_start) : `${longDate(r.period_start)} – ${longDate(r.period_end)}`}{r.donor_name ? ` · Prepared for ${r.donor_name}` : ""}</p>
        </div>
      </header>
      {r.summary && <Section title="Summary" first>{paras(r.summary).map((p, i) => <p key={i} className="mb-2.5">{p}</p>)}</Section>}
      {f.activities && (
        <Section title={r.kind === "daily" ? "What happened today" : "Activities"} first={!r.summary}>
          {f.activities.length ? (
            <Table>
              <TableHeader><TableRow>{r.kind !== "daily" && <TableHead className="w-28">Date</TableHead>}<TableHead className="w-32">Type</TableHead><TableHead>What</TableHead></TableRow></TableHeader>
              <TableBody>{f.activities.map((a: string[], i: number) => (
                <TableRow key={i} className="align-top">
                  {r.kind !== "daily" && <TableCell className="tabular-nums">{fmtDate(a[0])}</TableCell>}
                  <TableCell>{a[1]}</TableCell>
                  <TableCell className="whitespace-normal"><span className="font-medium text-neutral-900">{a[2]}</span>{a[3] && <span className="block text-xs text-neutral-500">{a[3]}</span>}</TableCell>
                </TableRow>))}</TableBody>
            </Table>
          ) : <p className="text-sm italic text-muted-foreground">No activities recorded {r.kind === "daily" ? "for this day" : "in this period"}.</p>}
        </Section>
      )}
      {f.funds && r.donor_name && f.funds.list && (
        <Section title="Your funds">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile value={money(f.funds.opening)} text={`balance on ${fmtDate(r.period_start)}`} color="var(--muted-foreground)" />
            <Tile value={money(f.funds.received)} text="received this period" color="var(--chart-1)" />
            <Tile value={money(f.funds.spent)} text="spent this period" color="var(--chart-4)" />
            <Tile value={money(f.funds.closing)} text={`remaining on ${fmtDate(r.period_end)}`} color="var(--chart-2)" />
          </div>
          <p className="mt-3">{money(f.funds.opening)} carried over + {money(f.funds.received)} received − {money(f.funds.spent)} spent = <strong>{money(f.funds.closing)} remaining</strong>
            {f.funds.closing_foreign ? `, about ${cash(f.funds.closing_foreign[1], f.funds.closing_foreign[0])} at the latest rate of ${rate(f.funds.closing_foreign[2])}` : ""}.
            {f.funds.sponsored ? ` Your support covered ${f.funds.sponsored} sponsored child${f.funds.sponsored === 1 ? "" : "ren"} in this period.` : ""}</p>
          <h3 className="mb-1 mt-4 text-sm font-semibold">Spending by category</h3>
          <KV obj={f.funds.by_category} labels={labelsOf(EXPENSE_CATEGORY)} fmt={money} />
          {f.funds.list.length > 0 && <><h3 className="mb-1 mt-4 text-sm font-semibold">Each expense</h3>
            <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>What for</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>{f.funds.list.map((e: any[], i: number) => (
                <TableRow key={i}><TableCell>{fmtDate(e[0])}</TableCell><TableCell className="whitespace-normal">{e[1]}</TableCell><TableCell>{label(EXPENSE_CATEGORY, e[2])}</TableCell><TableCell className="text-right tabular-nums">{money(e[3])}</TableCell></TableRow>))}
                <TableRow className="font-semibold"><TableCell colSpan={3}>Total spent</TableCell><TableCell className="text-right tabular-nums">{money(f.funds.spent)}</TableCell></TableRow>
              </TableBody></Table>
            <p className="mt-2 text-xs text-neutral-500">Receipts for every expense are kept on file{f.funds.list.some((e: any[]) => !e[4]) ? " (a few are still being collected)" : ""} and are available on request.</p></>}
        </Section>
      )}
      {f.funds && !r.donor_name && f.funds.spent > 0 && (
        <Section title="Spending">
          <p className="mb-2">{money(f.funds.spent)} spent in this period.</p>
          <KV obj={f.funds.by_category} labels={labelsOf(EXPENSE_CATEGORY)} fmt={money} />
        </Section>
      )}
      <Section title="School outreach">
        <p className="mb-2">{f.outreach.visits} school visit{f.outreach.visits === 1 ? "" : "s"}, reaching {f.outreach.girls.toLocaleString()} girls, {f.outreach.boys.toLocaleString()} boys and {f.outreach.parents.toLocaleString()} parents.</p>
        {f.outreach.list.length > 0 && <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>School</TableHead><TableHead>Area</TableHead><TableHead className="text-right">Pupils</TableHead></TableRow></TableHeader>
          <TableBody>{f.outreach.list.map((v: any[], i: number) => <TableRow key={i}><TableCell>{fmtDate(v[0])}</TableCell><TableCell>{v[1]}</TableCell><TableCell>{v[2]}</TableCell><TableCell className="text-right tabular-nums">{v[3].toLocaleString()}</TableCell></TableRow>)}</TableBody></Table>}
        <h3 className="mb-1 mt-4 text-sm font-semibold">Items handed out</h3><KV obj={f.items} labels={labelsOf(ITEMS)} />
      </Section>
      {r.highlights && <Section title="Highlights">{paras(r.highlights).map((p, i) => <p key={i} className="mb-2.5">{p}</p>)}</Section>}
      {r.challenges && <Section title="Challenges">{paras(r.challenges).map((p, i) => <p key={i} className="mb-2.5">{p}</p>)}</Section>}
      {r.next_steps && <Section title={r.kind === "daily" ? "Plans for tomorrow" : "Plans for the next period"}>{paras(r.next_steps).map((p, i) => <p key={i} className="mb-2.5">{p}</p>)}</Section>}
      <footer className="mt-8 border-t pt-3 text-xs text-neutral-500">
        <p>Namelok Naretoi Home · Narok, Kenya · 0722 537 380</p>
        <p>Figures from the Namelok dashboard, {fmtDate(f.generated_at)}.{live ? " Figures worked out just now from the latest records." : ""}</p>
      </footer>
    </article>
  )
}
