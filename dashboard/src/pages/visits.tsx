import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { PlusIcon, Trash2Icon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { SearchBox } from "@/components/bits"
import { ErrorNote, Loading, Page } from "@/components/page"
import { RecordDialog, SelectField } from "@/components/record-dialog"
import { useDb, useTables } from "@/lib/backend"
import { ITEMS, label, RESOURCES } from "@/lib/domain"
import { fmtDate, friendly, today, type Row } from "@/lib/format"

type Line = { id?: string; item: string; quantity: string; starter?: boolean } // starter: the empty row a new visit opens with
const summary = (items: Row[]) => items.map((i) => `${Number(i.quantity).toLocaleString()} ${label(ITEMS, i.item).toLowerCase()}`).join(" · ")

export function VisitsPage() {
  const { data, error, reload } = useTables(["outreach_visits", "distributions"], { outreach_visits: { order: "visit_date" } })
  const [q, setQ] = useState("")
  const [dialog, setDialog] = useState<{ open: boolean; row: Row | null }>({ open: false, row: null })
  const [other, setOther] = useState<Row | null>(null)
  // Older entries recorded before items lived on the visit
  const loose = (data?.distributions || []).filter((d) => !d.visit_id).sort((a, b) => (a.distributed_on < b.distributed_on ? 1 : -1))
  const itemsOf = useMemo(() => {
    const m: Record<string, Row[]> = {}
    for (const d of data?.distributions || []) if (d.visit_id) (m[d.visit_id] ||= []).push(d)
    for (const list of Object.values(m)) list.sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    return m
  }, [data])
  const rows = data?.outreach_visits || []
  const shown = rows.filter((v) => !q || [v.school_name, v.location, v.topics].join(" ").toLowerCase().includes(q.toLowerCase()))
  const reached = shown.reduce((s, v) => s + v.girls_reached + v.boys_reached, 0)

  return (
    <Page title="School visits"
      actions={<Button onClick={() => setDialog({ open: true, row: null })}><PlusIcon /> Record a visit</Button>}>
      {error ? <ErrorNote message={error} /> : !data ? <Loading /> : (
        <Card className="gap-0 py-0">
          <div className="flex flex-wrap items-center gap-3 border-b p-3">
            <SearchBox value={q} onChange={setQ} placeholder="Search school, area, topic…" className="sm:w-72" />
            <p className="text-sm sm:ml-auto"><span className="font-semibold">{shown.length} visit{shown.length === 1 ? "" : "s"}</span> <span className="text-muted-foreground">· {reached.toLocaleString()} pupils reached</span></p>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead className="px-4">Date</TableHead><TableHead className="px-4">School</TableHead><TableHead className="hidden px-4 text-right md:table-cell">Pupils</TableHead>
              <TableHead className="hidden px-4 lg:table-cell">Items handed out</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {shown.length ? shown.map((v) => (
                <TableRow key={v.id} className="cursor-pointer" onClick={() => setDialog({ open: true, row: v })}>
                  <TableCell className="px-4 tabular-nums">{fmtDate(v.visit_date)}{v.visit_date > today() && <span className="ml-2 rounded bg-chart-2/15 px-1.5 py-0.5 text-xs text-chart-2">Planned</span>}</TableCell>
                  <TableCell className="px-4"><span className="block font-medium">{v.school_name}</span><span className="text-xs text-muted-foreground">{v.location}</span></TableCell>
                  <TableCell className="hidden px-4 text-right tabular-nums md:table-cell">{v.girls_reached + v.boys_reached + v.parents_reached === 0
                    ? <span className="text-muted-foreground">{v.visit_date > today() ? "Not yet" : "Not recorded"}</span>
                    : <>{(v.girls_reached + v.boys_reached).toLocaleString()}
                      <span className="block text-xs text-muted-foreground">{v.girls_reached} girls · {v.boys_reached} boys{v.parents_reached ? ` · ${v.parents_reached} parents` : ""}</span></>}</TableCell>
                  <TableCell className="hidden max-w-80 whitespace-normal px-4 text-sm lg:table-cell">{itemsOf[v.id] ? summary(itemsOf[v.id]) : <span className="text-muted-foreground">None</span>}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={4} className="h-28 text-center text-muted-foreground">{rows.length ? "No visits match." : "No visits yet. Use “Record a visit” to add the first."}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      )}
      {loose.length > 0 && (
        <Card className="gap-0 py-0">
          <div className="border-b px-4 py-3"><p className="font-medium">Other hand-outs</p>
            <p className="text-sm text-muted-foreground">Recorded earlier, not at a visit. From now on, record hand-outs at the home as a visit with “Namelok Naretoi Home” as the place.</p></div>
          <Table>
            <TableHeader><TableRow><TableHead className="px-4">Date</TableHead><TableHead className="px-4">Item</TableHead><TableHead className="px-4 text-right">Quantity</TableHead><TableHead className="hidden px-4 md:table-cell">Notes</TableHead></TableRow></TableHeader>
            <TableBody>{loose.map((d) => (
              <TableRow key={d.id} className="cursor-pointer" onClick={() => setOther(d)}>
                <TableCell className="px-4 tabular-nums">{fmtDate(d.distributed_on)}</TableCell><TableCell className="px-4">{label(ITEMS, d.item)}</TableCell>
                <TableCell className="px-4 text-right tabular-nums">{Number(d.quantity).toLocaleString()}</TableCell><TableCell className="hidden px-4 md:table-cell">{d.notes}</TableCell>
              </TableRow>))}</TableBody>
          </Table>
        </Card>
      )}
      <RecordDialog resource={RESOURCES.distributions} row={other} open={!!other} onOpenChange={(o) => !o && setOther(null)} onSaved={reload} />
      <VisitDialog open={dialog.open} row={dialog.row} items={dialog.row ? itemsOf[dialog.row.id] || [] : []}
        onOpenChange={(o) => setDialog((x) => ({ ...x, open: o }))} onSaved={reload} />
    </Page>
  )
}

// One form for the visit and what was handed out there
function VisitDialog({ open, onOpenChange, row, items, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; row: Row | null; items: Row[]; onSaved: () => void }) {
  const db = useDb()
  const [v, setV] = useState<Row>({})
  const [lines, setLines] = useState<Line[]>([])
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false), [confirm, setConfirm] = useState(false)
  // Fill the form only when it opens, so nothing typed is lost if the page refreshes behind it
  const latest = useRef({ row, items })
  latest.current = { row, items }
  useEffect(() => {
    if (!open) return
    const { row, items } = latest.current
    setErr("")
    setV(row ? { ...row } : { school_name: "", location: "", visit_date: today(), girls_reached: "", boys_reached: "", parents_reached: "", topics: "", notes: "" })
    setLines(items.length ? items.map((i) => ({ id: i.id, item: i.item, quantity: String(i.quantity) })) : row ? [] : [{ item: "pads", quantity: "", starter: true }])
  }, [open, row?.id])
  const set = (patch: Row) => setV((x) => ({ ...x, ...patch }))
  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch, starter: false } : l)))
  const num = (x: unknown) => (x === "" || x == null ? 0 : Math.max(0, Math.round(Number(x))))

  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr("")
    if (!String(v.school_name || "").trim()) return setErr("Enter the school or community.")
    if (!v.visit_date) return setErr("Choose the date of the visit.")
    const filled = lines.filter((l) => l.quantity !== "" && Number(l.quantity) > 0)
    const blank = lines.filter((l) => !filled.includes(l) && !(l.starter && l.quantity === "")).length
    if (blank) return setErr(`Type how many for ${blank === 1 ? "the item" : `the ${blank} items`} without a number, or remove ${blank === 1 ? "it" : "them"} with the ×.`)
    setBusy(true)
    try {
      const data = { school_name: v.school_name.trim(), location: (v.location || "").trim(), visit_date: v.visit_date, girls_reached: num(v.girls_reached), boys_reached: num(v.boys_reached),
        parents_reached: num(v.parents_reached), topics: (v.topics || "").trim(), notes: (v.notes || "").trim() }
      const visit = row ? await db.update("outreach_visits", row.id, data) : await db.insert("outreach_visits", data)
      // Items: keep, change, add or remove to match the form
      for (const old of items) if (!filled.some((l) => l.id === old.id)) await db.remove("distributions", old.id)
      for (const l of filled) {
        const item = { visit_id: visit.id, item: l.item, quantity: num(l.quantity), distributed_on: v.visit_date }
        if (l.id) await db.update("distributions", l.id, item); else await db.insert("distributions", { ...item, notes: "" })
      }
      toast.success(filled.length ? `Visit saved with ${filled.length} item${filled.length === 1 ? "" : "s"}` : row ? "Visit saved" : "Visit recorded"); onOpenChange(false); onSaved()
    } catch (ex) {
      const msg = "Could not save: " + friendly((ex as Error).message)
      setErr(msg); toast.error(msg)
    }
    setBusy(false)
  }
  async function remove() {
    try {
      for (const i of items) await db.remove("distributions", i.id)
      await db.remove("outreach_visits", row!.id)
      toast.success("Visit deleted"); setConfirm(false); onOpenChange(false); onSaved()
    } catch (ex) { setErr("Could not delete: " + friendly((ex as Error).message)) }
  }

  const field = (name: string, title: string, type = "text") => (
    <div className="grid gap-1.5"><Label htmlFor={"vi_" + name}>{title}</Label><Input id={"vi_" + name} type={type} min={type === "number" ? 0 : undefined} value={v[name] ?? ""} onChange={(e) => set({ [name]: e.target.value })} /></div>
  )
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={save} className="grid gap-5">
            <DialogHeader><DialogTitle>{row ? "Edit visit" : "Record a visit"}</DialogTitle><DialogDescription>Handing out at the home? Use “Namelok Naretoi Home” as the place.</DialogDescription></DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">{field("school_name", "School or community")}</div>
              {field("location", "Area")}{field("visit_date", "Date", "date")}
            </div>
            <div className="grid grid-cols-3 gap-4">{field("girls_reached", "Girls reached", "number")}{field("boys_reached", "Boys reached", "number")}{field("parents_reached", "Parents reached", "number")}</div>

            <div className="grid gap-2 rounded-lg bg-muted/50 p-3.5">
              <p className="text-sm font-medium">Items handed out</p>
              {lines.length ? lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_110px_auto] gap-2">
                  <SelectField value={l.item} onChange={(item) => setLine(i, { item })} options={ITEMS} />
                  <Input type="number" min={1} inputMode="numeric" aria-label="Quantity" placeholder="Qty" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
                  <Button type="button" size="icon" variant="ghost" aria-label="Remove item" onClick={() => setLines((ls) => ls.filter((_, k) => k !== i))}><XIcon /></Button>
                </div>
              )) : <p className="text-sm text-muted-foreground">Nothing handed out at this visit.</p>}
              <Button type="button" size="sm" variant="outline" className="w-fit" onClick={() => setLines((ls) => [...ls, { item: ls.length ? "other" : "pads", quantity: "" }])}><PlusIcon /> Add an item</Button>
            </div>

            <div className="grid gap-1.5"><Label htmlFor="vi_topics">Topics covered</Label><Textarea id="vi_topics" rows={2} value={v.topics ?? ""} onChange={(e) => set({ topics: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label htmlFor="vi_notes">Notes</Label><Textarea id="vi_notes" rows={2} value={v.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} /></div>
            {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
            <DialogFooter className="gap-2 sm:justify-between">
              {row ? <Button type="button" variant="ghost" className="text-destructive" onClick={() => setConfirm(true)}><Trash2Icon /> Delete</Button> : <span />}
              <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button></div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this visit?</AlertDialogTitle>
            <AlertDialogDescription>{items.length ? `The ${items.length} item${items.length === 1 ? "" : "s"} recorded at this visit will be deleted too. ` : ""}This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={remove}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
