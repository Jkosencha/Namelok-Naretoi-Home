import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { CameraIcon, FileTextIcon, ReceiptIcon, Trash2Icon, XIcon } from "lucide-react"
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
import { EXPENSE_CATEGORY, isCurrent, lookupLabel } from "@/lib/domain"
import { friendly, money, today, type Row } from "@/lib/format"
import { fundSummary } from "@/lib/funds"

const isPdf = (name = "") => /\.pdf$/i.test(name)

// Record money spent, with a photo or scan of the receipt (stored privately)
export function ExpenseDialog({ open, onOpenChange, row, donorId, childId, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; row?: Row | null; donorId?: string; childId?: string; onSaved: () => void
}) {
  const db = useDb()
  const [lists, setLists] = useState<{ donors: Row[]; children: Row[]; sponsorships: Row[]; donations: Row[]; expenses: Row[] }>({ donors: [], children: [], sponsorships: [], donations: [], expenses: [] })
  const [v, setV] = useState<Row>({})
  const [preview, setPreview] = useState("")
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [confirm, setConfirm] = useState(false)
  const [added, setAdded] = useState(0)
  const file = useRef<HTMLInputElement>(null)
  const blank = (keep: Row = {}) => ({ spent_on: today(), description: "", category: "other", amount: "", donor_id: donorId || "", child_id: childId || "", vendor: "", receipt_path: "", receipt_name: "", notes: "", ...keep })

  useEffect(() => {
    if (!open) return
    setErr(""); setAdded(0)
    Promise.all(["donors", "children", "sponsorships", "donations", "expenses"].map((t) => db.list(t))).then(([donors, children, sponsorships, donations, expenses]) => setLists({ donors, children, sponsorships, donations, expenses }))
    setV(row ? { ...row, donor_id: row.donor_id || "", child_id: row.child_id || "" } : blank())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, row, donorId, childId, db])
  useEffect(() => {
    if (!v.receipt_path) return setPreview("")
    if (isPdf(v.receipt_name)) return setPreview("")
    db.documentUrl(v.receipt_path).then(setPreview).catch(() => setPreview(""))
  }, [v.receipt_path, v.receipt_name, db])

  const set = (patch: Row) => setV((x) => ({ ...x, ...patch }))
  const fund = v.donor_id ? lists.donors.find((d) => d.id === v.donor_id) : null
  const left = fund ? fundSummary(fund, lists.donations, lists.expenses.filter((e) => e.id !== row?.id)).balance : null
  // Picking a sponsored child suggests their sponsor's funds
  function chooseChild(id: string) {
    const sponsor = lists.sponsorships.find((s) => s.child_id === id && !s.ended_on)
    set({ child_id: id, ...(sponsor && !v.donor_id ? { donor_id: sponsor.donor_id } : {}) })
  }

  async function upload(f?: File) {
    if (!f) return
    if (f.size > 15 * 1024 * 1024) return toast.error("That file is over 15 MB. Please use a smaller photo or scan.")
    setUploading(true)
    try { set({ receipt_path: await db.uploadDocument(f, "receipts"), receipt_name: f.name }) }
    catch (e) { toast.error("Upload failed: " + (e as Error).message) }
    setUploading(false)
    if (file.current) file.current.value = ""
  }

  async function save(another: boolean) {
    setErr("")
    if (!v.description.trim()) return setErr("Say what the money was spent on.")
    if (v.amount === "" || !(Number(v.amount) >= 0)) return setErr("Enter the amount in KES.")
    setBusy(true)
    try {
      const data = { spent_on: v.spent_on, description: v.description.trim(), category: v.category, amount: Number(v.amount), donor_id: v.donor_id || null, child_id: v.child_id || null,
        vendor: v.vendor.trim(), receipt_path: v.receipt_path, receipt_name: v.receipt_name, notes: v.notes.trim() }
      if (row) await db.update("expenses", row.id, data); else await db.insert("expenses", data)
      onSaved()
      if (another) {
        toast.success(`Saved: ${data.description}`)
        setAdded((n) => n + 1)
        setV(blank({ spent_on: v.spent_on, category: v.category, donor_id: v.donor_id, vendor: v.vendor }))
        setTimeout(() => document.getElementById("ex_desc")?.focus(), 50)
        setLists((l) => ({ ...l, expenses: [...l.expenses, data] }))
      } else { toast.success(row ? "Expense updated" : "Expense recorded"); onOpenChange(false) }
    } catch (ex) { setErr("Could not save: " + friendly((ex as Error).message)) }
    setBusy(false)
  }

  const donorChoices = lists.donors.map((d) => ({ value: d.id, label: lookupLabel("donors", d) })).sort((a, b) => a.label.localeCompare(b.label))
  const childChoices = lists.children.filter((c) => isCurrent(c) || c.id === v.child_id).map((c) => ({ value: c.id, label: lookupLabel("children", c), sub: lists.sponsorships.some((s) => s.child_id === c.id && !s.ended_on) ? "sponsored" : "" })).sort((a, b) => a.label.localeCompare(b.label))
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <form onSubmit={(e) => { e.preventDefault(); save(false) }} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{row ? "Edit expense" : "Record an expense"}</DialogTitle>
              <DialogDescription>{added ? `${added} saved so far. Keep going, or close when you're done.` : "Take a photo of the receipt or attach a scan. It is stored privately."}</DialogDescription>
            </DialogHeader>

            {/* Receipt first: it's what you have in your hand */}
            <div className="flex items-center gap-3 rounded-lg border border-dashed p-3">
              {v.receipt_path ? (
                <>
                  {preview ? <img src={preview} alt="Receipt" className="h-20 w-16 rounded-md border object-cover" /> : <span className="flex h-20 w-16 items-center justify-center rounded-md bg-muted"><FileTextIcon className="size-6 text-muted-foreground" /></span>}
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{v.receipt_name || "Receipt"}</p><p className="text-xs text-muted-foreground">Receipt attached</p></div>
                  <Button type="button" size="icon" variant="ghost" aria-label="Remove receipt" onClick={() => set({ receipt_path: "", receipt_name: "" })}><XIcon /></Button>
                </>
              ) : (
                <>
                  <span className="flex size-10 items-center justify-center rounded-lg bg-muted"><ReceiptIcon className="size-5 text-muted-foreground" /></span>
                  <p className="flex-1 text-sm text-muted-foreground">No receipt attached</p>
                  <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => file.current?.click()}><CameraIcon /> {uploading ? "Uploading…" : "Add receipt"}</Button>
                </>
              )}
              <input ref={file} type="file" accept="image/*,application/pdf" hidden onChange={(e) => upload(e.target.files?.[0])} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="ex_desc">What was it for?</Label><Input id="ex_desc" value={v.description ?? ""} onChange={(e) => set({ description: e.target.value })} placeholder="e.g. Term 1 school fees" autoFocus /></div>
              <div className="grid gap-1.5"><Label htmlFor="ex_amount">Amount (KES)</Label><Input id="ex_amount" type="number" min={0} step="any" value={v.amount ?? ""} onChange={(e) => set({ amount: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label htmlFor="ex_date">Date</Label><Input id="ex_date" type="date" required value={v.spent_on ?? ""} onChange={(e) => set({ spent_on: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label htmlFor="ex_cat">Category</Label><SelectField id="ex_cat" value={v.category ?? "other"} options={EXPENSE_CATEGORY} onChange={(c) => set({ category: c })} /></div>
              <div className="grid gap-1.5"><Label htmlFor="ex_vendor">Paid to</Label><Input id="ex_vendor" value={v.vendor ?? ""} onChange={(e) => set({ vendor: e.target.value })} placeholder="Shop, school, hospital…" /></div>
              <div className="grid gap-1.5"><Label htmlFor="ex_fund">Paid from</Label>
                <SearchSelect id="ex_fund" value={v.donor_id ?? ""} onChange={(id) => set({ donor_id: id })} placeholder="General funds" choices={donorChoices} extra={[{ value: "", label: "General funds" }]} />
                {fund && left != null && <p className="text-xs text-muted-foreground">{fund.name}'s funds: {money(left)} left before this.</p>}</div>
              <div className="grid gap-1.5"><Label htmlFor="ex_child">For a child (optional)</Label>
                <SearchSelect id="ex_child" value={v.child_id ?? ""} onChange={chooseChild} placeholder="Not for one child" choices={childChoices} extra={[{ value: "", label: "Not for one child" }]} /></div>
              <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="ex_notes">Notes</Label><Textarea id="ex_notes" rows={2} value={v.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} /></div>
            </div>

            {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
            <DialogFooter className="gap-2 sm:justify-between">
              {row ? <Button type="button" variant="ghost" className="text-destructive" onClick={() => setConfirm(true)}><Trash2Icon /> Delete</Button> : <span />}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{added ? "Done" : "Cancel"}</Button>
                {!row && <Button type="button" variant="outline" disabled={busy || uploading} onClick={() => save(true)}>Save and add another</Button>}
                <Button type="submit" disabled={busy || uploading}>{busy ? "Saving…" : "Save"}</Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this expense?</AlertDialogTitle><AlertDialogDescription>Its receipt will no longer be linked. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={async () => { await db.remove("expenses", row!.id); toast.success("Expense deleted"); setConfirm(false); onOpenChange(false); onSaved() }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// Open a receipt: photos show here, PDFs open in a new tab
export function ReceiptViewer({ expense, onClose }: { expense: Row | null; onClose: () => void }) {
  const db = useDb()
  const [url, setUrl] = useState("")
  useEffect(() => {
    setUrl("")
    if (!expense?.receipt_path) return
    db.documentUrl(expense.receipt_path).then((u) => {
      if (isPdf(expense.receipt_name)) { window.open(u, "_blank", "noopener"); onClose() } else setUrl(u)
    }).catch((e) => { toast.error("Could not open the receipt: " + e.message); onClose() })
  }, [expense, db, onClose])
  return (
    <Dialog open={!!expense && !isPdf(expense.receipt_name)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Receipt</DialogTitle><DialogDescription>{expense ? `${expense.description} · ${money(expense.amount)}` : ""}</DialogDescription></DialogHeader>
        {url ? <img src={url} alt="Receipt" className="max-h-[70vh] w-full rounded-md border object-contain" /> : <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>}
      </DialogContent>
    </Dialog>
  )
}
