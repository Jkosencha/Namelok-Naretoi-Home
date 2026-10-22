import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeftIcon, DownloadIcon, FileIcon, FileTextIcon, PencilIcon, PlusIcon, PrinterIcon, RefreshCwIcon, SearchIcon, Trash2Icon, UploadIcon } from "lucide-react"
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
import { CategoryBars, Donut, TrendLine } from "@/components/charts"
import { ErrorNote, Loading, Page } from "@/components/page"
import { SelectField } from "@/components/record-dialog"
import { useDb, useTables, type Backend } from "@/lib/backend"
import { CATEGORY_COLOR, CHILD_CATEGORY, CHILD_STATUS, classAt, EXPENSE_CATEGORY, isCurrent, label } from "@/lib/domain"
import { cash, fmtDate, friendly, iso, longDate, money, rate, type Row } from "@/lib/format"
import { fundSummary } from "@/lib/funds"

const KINDS: Record<string, string> = { monthly: "Monthly", quarterly: "Quarterly", annual: "Annual", custom: "Custom" }
const STAGES = ["Pre-primary", "Primary", "Junior school", "Senior school", "Secondary", "College", "Special needs unit"]
const STAGE_SHORT: Record<string, string> = { "Pre-primary": "Pre-prim.", "Junior school": "Junior", "Senior school": "Senior", Secondary: "Form 1–4", "Special needs unit": "Special" }
const ITEMS: Record<string, string> = { pads: "Sanitary pads", panties: "Panties", boxers: "Boxers", balls: "Balls", socks: "Socks", books: "Books", other: "Other items" }
const METHODS: Record<string, string> = { mpesa: "M-Pesa", bank: "Bank transfer", paypal: "PayPal", cash: "Cash", in_kind: "In kind" }
const EVENTS: Record<string, string> = { medical: "Medical treatment", follow_up: "Follow-ups", school: "School updates", case: "Case / legal updates", other: "Other" }
const CATS = ["rescued_girl", "rescued_boy", "disability", "vulnerable"]
const count = (rows: Row[], key: string) => rows.reduce((m: Row, r) => ((m[r[key]] = (m[r[key]] || 0) + 1), m), {})
const paras = (text: string) => (text || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

function periodFor(kind: string, v: Row) {
  if (kind === "monthly") { const [y, m] = v.month.split("-").map(Number); return { start: iso(new Date(y, m - 1, 1)), end: iso(new Date(y, m, 0)) } }
  if (kind === "quarterly") { const q = Number(v.quarter), y = Number(v.year); return { start: iso(new Date(y, (q - 1) * 3, 1)), end: iso(new Date(y, q * 3, 0)) } }
  if (kind === "annual") return { start: `${v.year}-01-01`, end: `${v.year}-12-31` }
  return { start: v.start, end: v.end }
}
function titleFor(kind: string, start: string, end: string, donorName?: string) {
  const s = new Date(start + "T00:00:00"), e = new Date(end + "T00:00:00")
  const base = kind === "monthly" ? `Monthly report – ${s.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`
    : kind === "quarterly" ? `Quarterly report – Q${Math.floor(s.getMonth() / 3) + 1} ${s.getFullYear()} (${s.toLocaleDateString("en-GB", { month: "short" })}–${e.toLocaleDateString("en-GB", { month: "short" })})`
    : kind === "annual" ? `Annual report ${s.getFullYear()}` : `Report – ${fmtDate(start)} to ${fmtDate(end)}`
  return donorName ? `${base} for ${donorName}` : base
}

// Figures for a period, saved with the report so it never changes after sending
async function computeFigures(db: Backend, start: string, end: string, donor: { id: string; name: string } | null) {
  const [children, events, donations, visits, items, volunteers, expenses, sponsorships, donors] = await Promise.all(
    ["children", "child_events", "donations", "outreach_visits", "distributions", "volunteers", "expenses", "sponsorships", "donors"].map((t) => db.list(t)))
  const todayIso = iso(new Date())
  const within = (d?: string) => !!d && d.slice(0, 10) >= start && d.slice(0, 10) <= end
  const endYear = Number(end.slice(0, 4))
  const admitted = children.filter((c) => within(c.admission_date))
  // In care at the end of the period: admitted by then, and not yet moved on by then
  const inCare = children.filter((c) => (c.admission_date || c.created_at.slice(0, 10)) <= end && (isCurrent(c) || (c.left_on && c.left_on > end)))
  const movedOn = children.filter((c) => !isCurrent(c) && within(c.left_on))
  const stages: Row = {}
  inCare.forEach((c) => { const cl = classAt(c, endYear); if (cl && STAGES.includes(cl.stage)) stages[cl.stage] = (stages[cl.stage] || 0) + 1 })
  const matches = (d: Row) => !donor || d.donor_id === donor.id || String(d.donor_name || "").trim().toLowerCase() === donor.name.trim().toLowerCase()
  const gifts = donations.filter((d) => within(d.received_on) && matches(d))
  const sumBy = (rows: Row[], key: string, val: (r: Row) => number) => rows.reduce((m: Row, r) => ((m[r[key] || "Other"] = (m[r[key] || "Other"] || 0) + val(r)), m), {})
  const byMonth: Row = {}
  gifts.forEach((d) => { const k = d.received_on.slice(0, 7); byMonth[k] = (byMonth[k] || 0) + Number(d.amount) })
  const held = visits.filter((v) => within(v.visit_date) && v.visit_date <= todayIso)
  return {
    generated_at: new Date().toISOString(),
    children: { admitted: count(admitted, "category"), admitted_total: admitted.length, in_care: count(inCare, "category"), in_care_total: inCare.length, stages, moved_on: count(movedOn, "status") },
    events: count(events.filter((e) => within(e.event_date) && e.event_date <= todayIso), "type"),
    donations: {
      total: gifts.reduce((s, d) => s + Number(d.amount), 0), count: gifts.length,
      by_method: sumBy(gifts, "method", (d) => Number(d.amount)), by_purpose: sumBy(gifts, "purpose", (d) => Number(d.amount)), by_month: byMonth,
      top_donors: donor ? [] : Object.entries(sumBy(gifts, "donor_name", (d) => Number(d.amount))).sort((a, b) => b[1] - a[1]).slice(0, 5),
      list: donor ? gifts.sort((a, b) => (a.received_on < b.received_on ? -1 : 1)).map((d) => [d.received_on, Number(d.amount), METHODS[d.method] || d.method, d.purpose || "", d.currency || "KES", d.original_amount, d.exchange_rate]) : [],
    },
    funds: fundsFor(donor ? donors.find((d) => d.id === donor.id) || donor : null, donations, expenses, sponsorships, start, end),
    outreach: {
      visits: held.length, girls: held.reduce((s, v) => s + v.girls_reached, 0), boys: held.reduce((s, v) => s + v.boys_reached, 0), parents: held.reduce((s, v) => s + v.parents_reached, 0),
      list: held.sort((a, b) => (a.visit_date < b.visit_date ? -1 : 1)).map((v) => [v.visit_date, v.school_name, v.location || "", v.girls_reached + v.boys_reached]),
    },
    items: sumBy(items.filter((i) => within(i.distributed_on)), "item", (i) => i.quantity),
    volunteers: { joined: volunteers.filter((v) => within(v.created_at)).length, active: volunteers.filter((v) => v.status === "active").length },
  }
}

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
    <Page title="Reports" intro="Reports are built from the dashboard's records for the period you choose, and saved with their figures so they never change after you send them. Donor reports show totals only, never a child's name."
      actions={<><Button variant="outline" onClick={() => setUpload(true)}><UploadIcon /> Upload a report</Button><Button asChild><Link to="/reports/new"><PlusIcon /> New report</Link></Button></>}>
      {error ? <ErrorNote message={error} /> : !data ? <Loading /> : (
        <Card className="gap-0 py-0">
          <div className="flex flex-wrap items-center gap-3 border-b p-3">
            <div className="relative w-full sm:w-72"><SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reports…" className="pl-8" /></div>
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
          <DialogHeader><DialogTitle>Upload a report</DialogTitle><DialogDescription>PDF, Word, Excel or PowerPoint, up to 20 MB. Stored privately.</DialogDescription></DialogHeader>
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
  const [v, setV] = useState<Row>({ kind: "monthly", month: iso(last).slice(0, 7), quarter: String(Math.max(1, Math.floor(now.getMonth() / 3))), qyear: String(y), ayear: String(y - 1), start: iso(last), end: iso(new Date(y, now.getMonth(), 0)), donor: "", summary: "", highlights: "", challenges: "", next_steps: "" })
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false)
  const [params] = useSearchParams()
  useEffect(() => {
    if (id || !params.get("donor")) return
    setV((x) => ({ ...x, donor: params.get("donor") || "", kind: params.get("kind") || x.kind, quarter: params.get("quarter") || x.quarter, qyear: params.get("year") || x.qyear }))
  }, [id, params])
  useEffect(() => {
    if (!existing) return
    const ps = existing.period_start
    setV((x) => ({ ...x, kind: existing.kind, month: ps.slice(0, 7), quarter: String(Math.floor(Number(ps.slice(5, 7)) / 3) + 1), qyear: ps.slice(0, 4), ayear: ps.slice(0, 4), start: ps, end: existing.period_end,
      donor: existing.donor_id || "", summary: existing.summary, highlights: existing.highlights, challenges: existing.challenges, next_steps: existing.next_steps }))
  }, [existing])
  const donors = data?.donors || []
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr("")
    if (v.kind === "custom" && (!v.start || !v.end || v.end < v.start)) return setErr("Choose a start date and an end date after it.")
    const { start, end } = periodFor(v.kind, { month: v.month, quarter: v.quarter, year: v.kind === "annual" ? v.ayear : v.qyear, start: v.start, end: v.end })
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
              {v.kind === "monthly" && <div className="grid gap-1.5"><Label htmlFor="r_month">Month</Label><Input id="r_month" type="month" value={v.month} onChange={(e) => setV({ ...v, month: e.target.value })} /></div>}
              {v.kind === "quarterly" && <div className="grid gap-1.5"><Label>Quarter</Label><div className="grid grid-cols-2 gap-2">
                <SelectField value={v.quarter} onChange={(q) => setV({ ...v, quarter: q })} options={["1", "2", "3", "4"].map((q) => ({ value: q, label: "Q" + q }))} />
                <SelectField value={v.qyear} onChange={(q) => setV({ ...v, qyear: q })} options={[y, y - 1, y - 2, y - 3].map((n) => ({ value: String(n), label: String(n) }))} /></div></div>}
              {v.kind === "annual" && <div className="grid gap-1.5"><Label>Year</Label><SelectField value={v.ayear} onChange={(a) => setV({ ...v, ayear: a })} options={[y, y - 1, y - 2, y - 3, y - 4].map((n) => ({ value: String(n), label: String(n) }))} /></div>}
              {v.kind === "custom" && <div className="grid gap-1.5"><Label>From – to</Label><div className="grid grid-cols-2 gap-2"><Input type="date" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} /><Input type="date" value={v.end} onChange={(e) => setV({ ...v, end: e.target.value })} /></div></div>}
              <div className="grid gap-1.5 sm:col-span-2"><Label>Prepared for</Label>
                <SelectField value={v.donor} onChange={(d) => setV({ ...v, donor: d })} options={[{ value: "", label: "All donors (general report)" }, ...donors.map((d) => ({ value: d.id, label: d.name + (d.organisation && d.organisation !== d.name ? ` (${d.organisation})` : "") }))]} />
                <p className="text-xs text-muted-foreground">Choose a donor to show only their donations. Children and outreach figures are always totals for the whole home.</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Your words</CardTitle><CardDescription>Leave a blank line between paragraphs.</CardDescription></CardHeader>
            <CardContent className="grid gap-4">
              {area("summary", "Summary", "A short overview of the period.")}{area("highlights", "Highlights", "Good news, milestones, thank-yous.")}{area("challenges", "Challenges")}{area("next_steps", "Plans for the next period")}
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
  const isFile = !!r && Boolean(r.file_name) && !r.figures && !r.summary
  useEffect(() => { if (data && !r) navigate("/reports") }, [data, r, navigate])
  useEffect(() => { if (r && !r.figures && !isFile) computeFigures(db, r.period_start, r.period_end, r.donor_id ? { id: r.donor_id, name: r.donor_name } : null).then(setLive) }, [r, isFile, db])
  const f = r?.figures || live

  const actions = !r ? null : (
    <>
      <Button variant="outline" asChild><Link to="/reports"><ArrowLeftIcon /> All reports</Link></Button>
      {isFile ? <Button onClick={async () => { try { const url = await db.documentUrl(r.file_path, r.file_name); if (url) window.open(url, "_blank", "noopener"); else toast.error("This demo report has no file attached.") } catch (e) { toast.error("Could not open the file: " + (e as Error).message) } }}><DownloadIcon /> Download</Button> : (
        <>
          {r.status === "draft" && <Button variant="outline" asChild><Link to={`/reports/${r.id}/edit`}><PencilIcon /> Edit</Link></Button>}
          {r.status === "draft" && <Button variant="outline" onClick={async () => { await db.update("reports", r.id, { figures: await computeFigures(db, r.period_start, r.period_end, r.donor_id ? { id: r.donor_id, name: r.donor_name } : null) }); toast.success("Figures updated"); reload() }}><RefreshCwIcon /> Update figures</Button>}
          <Button variant="outline" onClick={async () => { await db.update("reports", r.id, { status: r.status === "final" ? "draft" : "final" }); toast.success(r.status === "final" ? "Back to draft" : "Marked as final"); reload() }}>{r.status === "final" ? "Back to draft" : "Mark as final"}</Button>
          <Button onClick={() => window.print()}><PrinterIcon /> Print / Save PDF</Button>
        </>
      )}
      <Button variant="ghost" className="text-destructive" onClick={() => setConfirm(true)}><Trash2Icon /> Delete</Button>
    </>
  )

  return (
    <Page title={r?.title || "Report"} actions={actions}>
      {error ? <ErrorNote message={error} /> : !r ? <Loading /> : isFile ? (
        <Card className="max-w-2xl flex-row items-center gap-5 px-6">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-muted text-primary"><FileIcon className="size-7" /></span>
          <div><p className="break-all font-semibold">{r.file_name}</p><p className="text-sm text-muted-foreground">{KINDS[r.kind]} report · {fmtDate(r.period_start)} – {fmtDate(r.period_end)}{r.donor_name ? " · for " + r.donor_name : ""}</p><p className="text-sm text-muted-foreground">Uploaded file. Use Download to open it.</p></div>
        </Card>
      ) : !f ? <Loading /> : (
        <>
          {r.status === "draft" && <p className="w-fit rounded-lg bg-chart-3/15 px-3 py-1.5 text-sm font-medium">Draft: check the figures and your text, then mark it as final before sending.</p>}
          <ReportDocument r={r} f={f} live={!r.figures} />
        </>
      )}
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

// The printable document: always light, like paper
function ReportDocument({ r, f, live }: { r: Row; f: Row; live: boolean }) {
  const months = useMemo(() => Object.keys(f.donations.by_month || {}).sort(), [f])
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mt-7 break-inside-avoid"><h2 className="mb-3 border-b pb-1.5 text-lg font-semibold">{title}</h2>{children}</section>
  )
  const KV = ({ obj, labels = {}, fmt = (n: number) => n.toLocaleString() }: { obj: Row; labels?: Row; fmt?: (n: number) => string }) => {
    const entries = Object.entries(obj || {}).filter(([, n]) => n)
    return entries.length ? (
      <Table><TableBody>{entries.map(([k, n]) => <TableRow key={k}><TableCell className="px-1">{labels[k] || k}</TableCell><TableCell className="px-1 text-right tabular-nums">{fmt(n as number)}</TableCell></TableRow>)}</TableBody></Table>
    ) : <p className="text-sm italic text-muted-foreground">None recorded in this period.</p>
  }
  const Tile = ({ value, text, color, small }: { value: string; text: string; color: string; small?: boolean }) => (
    <div className="rounded-lg border-t-[3px] bg-muted/60 px-4 py-3" style={{ borderColor: color }}><p className={(small || value.length > 11 ? "text-lg" : "text-2xl") + " whitespace-nowrap font-bold leading-tight"}>{value}</p><p className="text-xs text-muted-foreground">{text}</p></div>
  )
  const reached = f.outreach.girls + f.outreach.boys
  return (
    <article className="report-doc light mx-auto w-full max-w-[860px] rounded-md border bg-white p-7 text-[13.5px] leading-relaxed text-neutral-700 shadow-lg sm:p-12 [&_h1]:text-neutral-900 [&_h2]:text-neutral-900 [&_h3]:text-neutral-900" style={{ colorScheme: "light" }}>
      <header className="flex items-center gap-5 border-b-[3px] pb-5" style={{ borderColor: "var(--chart-1)" }}>
        <img src="../images/logo.png" alt="" className="size-16 sm:size-20" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--chart-1)" }}>Namelok Naretoi Home · Narok, Kenya</p>
          <h1 className="mt-1 text-2xl font-bold leading-tight">{r.title}</h1>
          <p className="text-neutral-500">{longDate(r.period_start)} – {longDate(r.period_end)}{r.donor_name ? ` · Prepared for ${r.donor_name}` : ""}</p>
        </div>
      </header>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile value={String(f.children.in_care_total)} text="children in care" color="var(--chart-1)" />
        <Tile value={String(f.children.admitted_total)} text="children admitted" color="var(--chart-4)" />
        <Tile value={money(f.donations.total)} text={r.donor_name ? "your donations" : "donations received"} color="var(--chart-3)" />
        <Tile value={reached.toLocaleString()} text="pupils reached" color="var(--chart-2)" />
      </div>
      {r.summary && <Section title="Summary">{paras(r.summary).map((p, i) => <p key={i} className="mb-2.5">{p}</p>)}</Section>}
      <Section title="Children in our care">
        <div className="grid items-start gap-6 sm:grid-cols-2">
          <div><h3 className="mb-2 text-sm font-semibold">By category</h3>{f.children.in_care_total ? <Donut centerLabel="In care" data={CATS.map((c) => ({ label: label(CHILD_CATEGORY, c), value: f.children.in_care[c] || 0, color: CATEGORY_COLOR[c] }))} /> : <p className="text-sm italic text-muted-foreground">No children in care recorded.</p>}</div>
          <div><h3 className="mb-2 text-sm font-semibold">By school stage</h3><CategoryBars data={STAGES.map((s) => ({ label: STAGE_SHORT[s] || s, value: f.children.stages[s] || 0 }))} /></div>
        </div>
        <h3 className="mb-1 mt-4 text-sm font-semibold">Admitted in this period</h3><KV obj={f.children.admitted} labels={Object.fromEntries(CATS.map((c) => [c, label(CHILD_CATEGORY, c)]))} />
        {f.children.moved_on && <><h3 className="mb-1 mt-4 text-sm font-semibold">Moved on in this period</h3><KV obj={f.children.moved_on} labels={Object.fromEntries(CHILD_STATUS.map((o) => [o.value, o.label]))} /></>}
        <h3 className="mb-1 mt-4 text-sm font-semibold">Care and follow-up</h3><KV obj={f.events} labels={EVENTS} />
      </Section>
      <Section title={r.donor_name ? `Donations from ${r.donor_name}` : "Donations"}>
        <p className="mb-2">{f.donations.count} donation{f.donations.count === 1 ? "" : "s"}, {money(f.donations.total)} in total.</p>
        {months.length > 1 && <TrendLine format={money} data={months.map((m) => ({ label: new Date(m + "-01T00:00:00").toLocaleDateString("en-GB", { month: "short" }), value: f.donations.by_month[m] }))} />}
        <div className="grid gap-6 sm:grid-cols-2">
          <div><h3 className="mb-1 mt-4 text-sm font-semibold">By purpose</h3><KV obj={f.donations.by_purpose} fmt={money} /></div>
          <div><h3 className="mb-1 mt-4 text-sm font-semibold">By method</h3><KV obj={f.donations.by_method} labels={METHODS} fmt={money} /></div>
        </div>
        {f.donations.list.length > 0 && <><h3 className="mb-1 mt-4 text-sm font-semibold">Each donation</h3>
          <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Rate</TableHead><TableHead className="text-right">KES received</TableHead><TableHead>Method</TableHead><TableHead>Purpose</TableHead></TableRow></TableHeader>
            <TableBody>{f.donations.list.map((d: any[], i: number) => (
              <TableRow key={i}><TableCell>{fmtDate(d[0])}</TableCell>
                <TableCell className="tabular-nums">{d[4] && d[4] !== "KES" && d[5] != null ? cash(d[5], d[4]) : money(d[1])}</TableCell>
                <TableCell className="tabular-nums">{d[6] ? rate(d[6]) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{money(d[1])}</TableCell><TableCell>{d[2]}</TableCell><TableCell>{d[3]}</TableCell></TableRow>))}</TableBody></Table></>}
        {f.donations.top_donors.length > 0 && <><h3 className="mb-1 mt-4 text-sm font-semibold">Largest donors</h3>
          <Table><TableHeader><TableRow><TableHead>Donor</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
            <TableBody>{f.donations.top_donors.map(([n, a]: [string, number]) => <TableRow key={n}><TableCell>{n}</TableCell><TableCell className="text-right tabular-nums">{money(a)}</TableCell></TableRow>)}</TableBody></Table></>}
      </Section>
      {f.funds && r.donor_name && f.funds.list && (
        <Section title="Your funds">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile value={money(f.funds.opening)} text={`balance on ${fmtDate(r.period_start)}`} color="var(--muted-foreground)" small />
            <Tile value={money(f.funds.received)} text="received this period" color="var(--chart-1)" small />
            <Tile value={money(f.funds.spent)} text="spent this period" color="var(--chart-4)" small />
            <Tile value={money(f.funds.closing)} text={`remaining on ${fmtDate(r.period_end)}`} color="var(--chart-2)" small />
          </div>
          <p className="mt-3">{money(f.funds.opening)} carried over + {money(f.funds.received)} received − {money(f.funds.spent)} spent = <strong>{money(f.funds.closing)} remaining</strong>
            {f.funds.closing_foreign ? `, about ${cash(f.funds.closing_foreign[1], f.funds.closing_foreign[0])} at the latest rate of ${rate(f.funds.closing_foreign[2])}` : ""}.
            {f.funds.sponsored ? ` Your support covered ${f.funds.sponsored} sponsored child${f.funds.sponsored === 1 ? "" : "ren"} in this period.` : ""}</p>
          <h3 className="mb-1 mt-4 text-sm font-semibold">Spending by category</h3>
          <KV obj={f.funds.by_category} labels={Object.fromEntries(EXPENSE_CATEGORY.map((o) => [o.value, o.label]))} fmt={money} />
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
          <KV obj={f.funds.by_category} labels={Object.fromEntries(EXPENSE_CATEGORY.map((o) => [o.value, o.label]))} fmt={money} />
        </Section>
      )}
      <Section title="School outreach">
        <p className="mb-2">{f.outreach.visits} school visit{f.outreach.visits === 1 ? "" : "s"}, reaching {f.outreach.girls.toLocaleString()} girls, {f.outreach.boys.toLocaleString()} boys and {f.outreach.parents.toLocaleString()} parents.</p>
        {f.outreach.list.length > 0 && <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>School</TableHead><TableHead>Area</TableHead><TableHead className="text-right">Pupils</TableHead></TableRow></TableHeader>
          <TableBody>{f.outreach.list.map((v: any[], i: number) => <TableRow key={i}><TableCell>{fmtDate(v[0])}</TableCell><TableCell>{v[1]}</TableCell><TableCell>{v[2]}</TableCell><TableCell className="text-right tabular-nums">{v[3].toLocaleString()}</TableCell></TableRow>)}</TableBody></Table>}
        <h3 className="mb-1 mt-4 text-sm font-semibold">Items handed out</h3><KV obj={f.items} labels={ITEMS} />
      </Section>
      {r.highlights && <Section title="Highlights">{paras(r.highlights).map((p, i) => <p key={i} className="mb-2.5">{p}</p>)}</Section>}
      {r.challenges && <Section title="Challenges">{paras(r.challenges).map((p, i) => <p key={i} className="mb-2.5">{p}</p>)}</Section>}
      {r.next_steps && <Section title="Plans for the next period">{paras(r.next_steps).map((p, i) => <p key={i} className="mb-2.5">{p}</p>)}</Section>}
      <footer className="mt-8 border-t pt-3 text-xs text-neutral-500">
        <p>Namelok Naretoi Home · Narok, Kenya · 0722 537 380</p>
        <p>Figures from the Namelok dashboard, {fmtDate(f.generated_at)}.{live ? " Figures worked out just now from the latest records." : ""}</p>
      </footer>
    </article>
  )
}
