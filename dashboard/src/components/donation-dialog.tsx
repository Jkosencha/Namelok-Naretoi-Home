import { useEffect, useState } from "react"
import { toast } from "sonner"
import { InfoIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { SearchSelect } from "@/components/pickers"
import { SelectField } from "@/components/record-dialog"
import { useDb } from "@/lib/backend"
import { CURRENCIES, GIVING_PATTERN, label, lookupLabel, METHODS } from "@/lib/domain"
import { cash, fmtDate, friendly, money, rate, today, type Row } from "@/lib/format"
import { givenBy, lastRate } from "@/lib/funds"

const NEW = "__new"
const round2 = (n: number) => Math.round(n * 100) / 100

// Record a donation: pick a returning donor (their usual currency and purpose fill in),
// and for USD/GBP/EUR enter the amount and rate; the KES received works itself out (or the other way round).
export function DonationDialog({ open, onOpenChange, row, donorId, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; row?: Row | null; donorId?: string; onSaved: () => void
}) {
  const db = useDb()
  const [donors, setDonors] = useState<Row[]>([])
  const [history, setHistory] = useState<Row[]>([])
  const [v, setV] = useState<Row>({})
  const [newName, setNewName] = useState("")
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false), [confirm, setConfirm] = useState(false)

  useEffect(() => {
    if (!open) return
    setErr(""); setNewName("")
    Promise.all([db.list("donors", { order: "name", ascending: true }), db.list("donations", { order: "received_on" })]).then(([d, h]) => {
      setDonors(d); setHistory(h)
      if (row) {
        setV({ donor: row.donor_id || "", name: row.donor_id ? "" : row.donor_name, currency: row.currency || "KES", original: row.original_amount ?? "", rate: row.exchange_rate ?? "", kes: row.amount,
          method: row.method, reference: row.reference, received_on: row.received_on, purpose: row.purpose, notes: row.notes })
      } else {
        setV({ donor: "", name: "", currency: "KES", original: "", rate: "", kes: "", method: "mpesa", reference: "", received_on: today(), purpose: "", notes: "" })
        if (donorId) choose(donorId, d, h)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, row, donorId, db])

  const set = (patch: Row) => setV((x) => ({ ...x, ...patch }))
  const donor = donors.find((d) => d.id === v.donor)
  const last = donor ? history.filter(givenBy(donor)).sort((a, b) => (a.received_on < b.received_on ? 1 : -1))[0] : null
  const foreign = v.currency && v.currency !== "KES"
  const suggested = foreign ? lastRate(history, v.currency, v.donor) : null
  const purposes = [...new Set(history.map((d) => d.purpose).filter(Boolean))].slice(0, 30)

  // A returning donor: fill in what they usually send
  function choose(id: string, list = donors, hist = history) {
    const d = list.find((x) => x.id === id)
    if (!d) return set({ donor: id })
    const prev = hist.filter(givenBy(d)).sort((a, b) => (a.received_on < b.received_on ? 1 : -1))[0]
    const currency = prev?.currency || d.currency || "KES"
    const r = currency !== "KES" ? lastRate(hist, currency, d.id)?.exchange_rate ?? "" : ""
    setV((x) => ({ ...x, donor: id, name: "", currency, rate: r, method: prev?.method || (currency !== "KES" ? "bank" : x.method), purpose: prev?.purpose || x.purpose,
      original: currency !== "KES" && prev?.original_amount ? prev.original_amount : x.original, kes: currency !== "KES" && prev?.original_amount && r ? Math.round(prev.original_amount * Number(r)) : x.kes }))
  }
  // Amount × rate = KES, kept in step whichever one is typed
  const onOriginal = (original: string) => set({ original, kes: original && v.rate ? Math.round(Number(original) * Number(v.rate)) : v.kes })
  const onRate = (r: string) => set({ rate: r, kes: v.original && r ? Math.round(Number(v.original) * Number(r)) : v.kes })
  const onKes = (kes: string) => set({ kes, rate: v.original && kes ? round2(Number(kes) / Number(v.original)) : v.rate })

  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr("")
    if (v.donor === "" && !v.name.trim()) return setErr("Choose a donor, or type a name (or “Anonymous”).")
    if (foreign && (!Number(v.original) || !Number(v.rate))) return setErr(`Enter the amount in ${v.currency} and the exchange rate.`)
    if (!(Number(v.kes) >= 0) || v.kes === "") return setErr("Enter the amount received in KES.")
    setBusy(true)
    try {
      let d = donor
      if (v.donor === NEW) d = await db.insert("donors", { name: newName, organisation: "", email: "", phone: "", notes: "", giving_pattern: "", currency: v.currency })
      const data = {
        donor_id: d?.id || null, donor_name: d?.name || v.name.trim(), amount: Number(v.kes), currency: v.currency,
        original_amount: foreign ? Number(v.original) : null, exchange_rate: foreign ? Number(v.rate) : null,
        method: v.method, reference: v.reference.trim(), received_on: v.received_on, purpose: v.purpose.trim(), notes: v.notes.trim(),
      }
      if (row) await db.update("donations", row.id, data); else await db.insert("donations", data)
      toast.success(row ? "Donation updated" : `Donation from ${data.donor_name} recorded`)
      onOpenChange(false); onSaved()
    } catch (ex) { setErr("Could not save: " + friendly((ex as Error).message)) }
    setBusy(false)
  }

  const choices = donors.map((d) => ({ value: d.id, label: lookupLabel("donors", d), sub: d.giving_pattern ? label(GIVING_PATTERN, d.giving_pattern) : "" })).sort((a, b) => a.label.localeCompare(b.label))
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <form onSubmit={save} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{row ? "Edit donation" : "Record a donation"}</DialogTitle>
              <DialogDescription>Choose the donor first: their usual currency, rate and purpose fill in for you.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-1.5">
              <Label htmlFor="dn_donor">From</Label>
              <SearchSelect id="dn_donor" value={v.donor ?? ""} placeholder="Choose a donor…" createLabel="Add new donor"
                choices={choices} onChange={(id) => (id === "" || id === NEW ? set({ donor: id }) : choose(id))}
                extra={[{ value: "", label: "Someone else / anonymous" }, ...(newName ? [{ value: NEW, label: `New donor: ${newName}` }] : [])]}
                onCreate={(text) => { setNewName(text); set({ donor: NEW }) }} />
              {v.donor === "" && <Input aria-label="Name" value={v.name ?? ""} onChange={(e) => set({ name: e.target.value })} placeholder="Name, or Anonymous" />}
              {v.donor === NEW && <p className="text-xs text-muted-foreground">“{newName}” will be added to your donors when you save.</p>}
              {last && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><InfoIcon className="size-3.5" />
                Last gift: {last.currency !== "KES" && last.original_amount ? `${cash(last.original_amount, last.currency)} (${money(last.amount)})` : money(last.amount)} on {fmtDate(last.received_on)}
                {donor?.giving_pattern ? ` · usually ${label(GIVING_PATTERN, donor.giving_pattern).toLowerCase()}` : ""}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5"><Label htmlFor="dn_cur">Currency</Label>
                <SelectField id="dn_cur" value={v.currency ?? "KES"} options={CURRENCIES} onChange={(c) => {
                  const r = c !== "KES" ? lastRate(history, c, v.donor)?.exchange_rate ?? "" : ""
                  set({ currency: c, rate: r, original: c === "KES" ? "" : v.original, method: c !== "KES" ? "bank" : v.method })
                }} /></div>
              <div className="grid gap-1.5"><Label htmlFor="dn_date">Date received</Label><Input id="dn_date" type="date" required value={v.received_on ?? ""} onChange={(e) => set({ received_on: e.target.value })} /></div>
            </div>

            {foreign ? (
              <div className="grid gap-3 rounded-lg bg-muted/60 p-3.5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="grid gap-1.5"><Label htmlFor="dn_orig">Amount ({v.currency})</Label><Input id="dn_orig" type="number" min={0} step="any" value={v.original ?? ""} onChange={(e) => onOriginal(e.target.value)} placeholder="1000" /></div>
                  <div className="grid gap-1.5"><Label htmlFor="dn_rate">Rate (KES per {v.currency})</Label><Input id="dn_rate" type="number" min={0} step="any" value={v.rate ?? ""} onChange={(e) => onRate(e.target.value)} placeholder="129.50" /></div>
                  <div className="grid gap-1.5"><Label htmlFor="dn_kes">Received (KES)</Label><Input id="dn_kes" type="number" min={0} step="any" value={v.kes ?? ""} onChange={(e) => onKes(e.target.value)} className="font-medium" /></div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {suggested ? `Last ${v.currency} rate used: ${rate(suggested.exchange_rate)} on ${fmtDate(suggested.received_on)}. ` : ""}
                  If the bank took charges, type the KES actually credited: the rate adjusts to match.</p>
                {suggested && Number(v.rate) > 0 && Math.abs(Number(v.rate) / Number(suggested.exchange_rate) - 1) > 0.1 && (
                  <p role="alert" className="flex items-center gap-1.5 text-xs font-medium text-chart-4"><TriangleAlertIcon className="size-3.5 shrink-0" />
                    This rate is far from the last one ({rate(suggested.exchange_rate)}). Check the amounts before saving.</p>
                )}
              </div>
            ) : (
              <div className="grid gap-1.5"><Label htmlFor="dn_kes">Amount (KES)</Label><Input id="dn_kes" type="number" min={0} step="any" value={v.kes ?? ""} onChange={(e) => set({ kes: e.target.value })} /></div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5"><Label htmlFor="dn_method">Method</Label><SelectField id="dn_method" value={v.method ?? "mpesa"} options={METHODS} onChange={(m) => set({ method: m })} /></div>
              <div className="grid gap-1.5"><Label htmlFor="dn_ref">Reference / transaction code</Label><Input id="dn_ref" value={v.reference ?? ""} onChange={(e) => set({ reference: e.target.value })} /></div>
              <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="dn_purpose">Purpose</Label>
                <Input id="dn_purpose" list="dn_purposes" value={v.purpose ?? ""} onChange={(e) => set({ purpose: e.target.value })} placeholder="e.g. School fees, Medical, General" />
                <datalist id="dn_purposes">{purposes.map((p) => <option key={p} value={p} />)}</datalist></div>
              <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="dn_notes">Notes</Label><Textarea id="dn_notes" rows={2} value={v.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} /></div>
            </div>

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
          <AlertDialogHeader><AlertDialogTitle>Delete this donation?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={async () => { await db.remove("donations", row!.id); toast.success("Donation deleted"); setConfirm(false); onOpenChange(false); onSaved() }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
