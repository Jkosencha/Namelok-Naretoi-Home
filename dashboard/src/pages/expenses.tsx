import { useCallback, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { DownloadIcon, PlusIcon, ReceiptIcon, SearchIcon, TriangleAlertIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ExpenseDialog, ReceiptViewer } from "@/components/expense-dialog"
import { ErrorNote, Loading, Page } from "@/components/page"
import { SelectField } from "@/components/record-dialog"
import { useTables } from "@/lib/backend"
import { EXPENSE_CATEGORY, label, lookupLabel } from "@/lib/domain"
import { fmtDate, iso, money, type Row } from "@/lib/format"
import { downloadCsv } from "@/lib/funds"

// Quarters and years to filter by, newest first
export function periodOptions(dates: string[]) {
  const now = new Date()
  const years = [...new Set([now.getFullYear(), ...dates.map((d) => Number(d.slice(0, 4)))])].sort((a, b) => b - a)
  const out: { value: string; label: string }[] = []
  for (const y of years) {
    for (let q = 4; q >= 1; q--) if (y < now.getFullYear() || q <= Math.floor(now.getMonth() / 3) + 1) out.push({ value: `${y}-Q${q}`, label: `Q${q} ${y}` })
    out.push({ value: String(y), label: `All of ${y}` })
  }
  return [...out, { value: "", label: "All time" }]
}
export function periodRange(p: string): [string, string] | null {
  if (!p) return null
  const m = p.match(/^(\d{4})-Q(\d)$/)
  if (m) { const y = Number(m[1]), q = Number(m[2]); return [iso(new Date(y, (q - 1) * 3, 1)), iso(new Date(y, q * 3, 0))] }
  return [`${p}-01-01`, `${p}-12-31`]
}
export const thisQuarter = () => { const n = new Date(); return `${n.getFullYear()}-Q${Math.floor(n.getMonth() / 3) + 1}` }

export function ExpensesPage() {
  const { data, error, reload } = useTables(["expenses", "donors", "children"], { expenses: { order: "spent_on" } })
  const [q, setQ] = useState(""), [period, setPeriod] = useState(thisQuarter()), [fund, setFund] = useState("all"), [cat, setCat] = useState(""), [missing, setMissing] = useState(false)
  const [dialog, setDialog] = useState<{ open: boolean; row: Row | null }>({ open: false, row: null })
  const [receipt, setReceipt] = useState<Row | null>(null)
  const closeReceipt = useCallback(() => setReceipt(null), [])
  const rows = useMemo(() => data?.expenses || [], [data])
  const range = periodRange(period)
  const name = (table: string, id?: string) => { const r = id && data?.[table].find((x) => x.id === id); return r ? lookupLabel(table, r) : "" }
  const inPeriod = rows.filter((e) => !range || (e.spent_on >= range[0] && e.spent_on <= range[1]))
  const shown = inPeriod.filter((e) => (fund === "all" || (fund === "" ? !e.donor_id : e.donor_id === fund)) && (!cat || e.category === cat) && (!missing || !e.receipt_path) &&
    (!q || [e.description, e.vendor, e.notes, name("children", e.child_id)].join(" ").toLowerCase().includes(q.toLowerCase())))
  const total = shown.reduce((s, e) => s + Number(e.amount), 0)
  const noReceipt = inPeriod.filter((e) => !e.receipt_path).length

  const csv = () => downloadCsv(`expenses-${period || "all"}.csv`, ["Date", "Description", "Category", "Paid to", "Paid from", "Child", "Amount (KES)", "Receipt", "Notes"],
    shown.map((e) => [e.spent_on, e.description, label(EXPENSE_CATEGORY, e.category), e.vendor, name("donors", e.donor_id) || "General funds", name("children", e.child_id), e.amount, e.receipt_path ? "Yes" : "Missing", e.notes]))

  return (
    <Page title="Expenses" intro="Money spent, with the receipt attached. Choose whose funds paid for it, so each donor's statement shows what was spent and what is left."
      actions={<><Button variant="outline" onClick={csv} disabled={!shown.length}><DownloadIcon /> Download</Button><Button onClick={() => setDialog({ open: true, row: null })}><PlusIcon /> Record expense</Button></>}>
      {error ? <ErrorNote message={error} /> : !data ? <Loading /> : (
        <Card className="gap-0 py-0">
          <div className="flex flex-wrap items-center gap-3 border-b p-3">
            <div className="relative w-full sm:w-60"><SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search expenses…" className="pl-8" /></div>
            <div className="w-[calc(50%-6px)] sm:w-36"><SelectField value={period} onChange={setPeriod} options={periodOptions(rows.map((e) => e.spent_on))} /></div>
            <div className="w-[calc(50%-6px)] sm:w-48"><SelectField value={fund} onChange={setFund} options={[{ value: "all", label: "All funds" }, { value: "", label: "General funds" }, ...data.donors.map((d) => ({ value: d.id, label: d.name }))]} /></div>
            <div className="w-full sm:w-52"><SelectField value={cat} onChange={setCat} options={[{ value: "", label: "All categories" }, ...EXPENSE_CATEGORY]} /></div>
            {noReceipt > 0 && <Button size="sm" variant={missing ? "secondary" : "ghost"} onClick={() => setMissing(!missing)} className="text-chart-3"><TriangleAlertIcon /> {noReceipt} without a receipt</Button>}
            <p className="text-sm sm:ml-auto"><span className="font-semibold">{money(total)}</span> <span className="text-muted-foreground">· {shown.length} expense{shown.length === 1 ? "" : "s"}</span></p>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead className="px-4">Date</TableHead><TableHead className="px-4">What for</TableHead><TableHead className="hidden px-4 lg:table-cell">Category</TableHead>
              <TableHead className="hidden px-4 md:table-cell">Paid from</TableHead><TableHead className="px-4 text-right">Amount</TableHead><TableHead className="w-12 px-2"><span className="sr-only">Receipt</span></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {shown.length ? shown.map((e) => (
                <TableRow key={e.id} className="cursor-pointer" onClick={() => setDialog({ open: true, row: e })}>
                  <TableCell className="px-4 tabular-nums">{fmtDate(e.spent_on)}</TableCell>
                  <TableCell className="max-w-72 whitespace-normal px-4"><span className="block font-medium">{e.description}</span>
                    <span className="block text-xs text-muted-foreground">{[e.vendor, name("children", e.child_id)].filter(Boolean).join(" · ")}</span></TableCell>
                  <TableCell className="hidden px-4 lg:table-cell">{label(EXPENSE_CATEGORY, e.category)}</TableCell>
                  <TableCell className="hidden px-4 md:table-cell">{e.donor_id ? <Link to={"/donors/" + e.donor_id} onClick={(ev) => ev.stopPropagation()} className="hover:underline">{name("donors", e.donor_id)}</Link> : <span className="text-muted-foreground">General funds</span>}</TableCell>
                  <TableCell className="px-4 text-right font-medium tabular-nums">{money(e.amount)}</TableCell>
                  <TableCell className="px-2">{e.receipt_path
                    ? <Button size="icon" variant="ghost" aria-label="View receipt" onClick={(ev) => { ev.stopPropagation(); setReceipt(e) }}><ReceiptIcon /></Button>
                    : <Badge variant="outline" className="text-chart-3" title="No receipt attached">!</Badge>}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">{rows.length ? "No expenses match. Try another period." : "No expenses yet. Use “Record expense” to add the first."}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      )}
      <ExpenseDialog open={dialog.open} row={dialog.row} onOpenChange={(o) => setDialog((x) => ({ ...x, open: o }))} onSaved={reload} />
      <ReceiptViewer expense={receipt} onClose={closeReceipt} />
    </Page>
  )
}
