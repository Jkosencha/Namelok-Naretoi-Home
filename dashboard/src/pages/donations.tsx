import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { DownloadIcon, PlusIcon, ReceiptIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DonationDialog } from "@/components/donation-dialog"
import { ExpenseDialog } from "@/components/expense-dialog"
import { SearchBox } from "@/components/bits"
import { ErrorNote, Loading, Page } from "@/components/page"
import { SelectField } from "@/components/record-dialog"
import { useTables } from "@/lib/backend"
import { label, METHODS } from "@/lib/domain"
import { cash, fmtDate, money, rate, type Row } from "@/lib/format"
import { downloadCsv } from "@/lib/funds"

export function DonationsPage() {
  const { data, error, reload } = useTables(["donations", "donors", "expenses"], { donations: { order: "received_on" } })
  const [q, setQ] = useState(""), [year, setYear] = useState(String(new Date().getFullYear())), [cur, setCur] = useState("")
  const [dialog, setDialog] = useState<{ open: boolean; row: Row | null }>({ open: false, row: null })
  const [spend, setSpend] = useState<Row | null>(null)
  // How much of each gift has been spent (expenses recorded against that donation)
  const spentOf = useMemo(() => {
    const m: Record<string, number> = {}
    for (const e of data?.expenses || []) if (e.donation_id) m[e.donation_id] = (m[e.donation_id] || 0) + Number(e.amount)
    return m
  }, [data])
  const rows = useMemo(() => data?.donations || [], [data])
  const years = [...new Set([String(new Date().getFullYear()), ...rows.map((d) => d.received_on.slice(0, 4))])].sort().reverse()
  const shown = rows.filter((d) => (!year || d.received_on.startsWith(year)) && (!cur || d.currency === cur) &&
    (!q || [d.donor_name, d.purpose, d.reference, d.notes].join(" ").toLowerCase().includes(q.toLowerCase())))
  const total = shown.reduce((s, d) => s + Number(d.amount), 0)
  const spentTotal = shown.reduce((s, d) => s + (spentOf[d.id] || 0), 0)
  const foreign: Record<string, number> = {}
  shown.filter((d) => d.currency !== "KES" && d.original_amount).forEach((d) => (foreign[d.currency] = (foreign[d.currency] || 0) + Number(d.original_amount)))

  const csv = () => downloadCsv(`donations-${year || "all"}.csv`, ["Date", "From", "Currency", "Amount", "Rate", "KES received", "KES spent", "KES left", "Method", "Reference", "Purpose", "Notes"],
    shown.map((d) => [d.received_on, d.donor_name, d.currency, d.original_amount ?? d.amount, d.exchange_rate ?? "", d.amount, spentOf[d.id] || 0, Number(d.amount) - (spentOf[d.id] || 0), label(METHODS, d.method), d.reference, d.purpose, d.notes]))

  return (
    <Page title="Donations"
      actions={<><Button variant="outline" onClick={csv} disabled={!shown.length}><DownloadIcon /> Download</Button><Button onClick={() => setDialog({ open: true, row: null })}><PlusIcon /> Record donation</Button></>}>
      {error ? <ErrorNote message={error} /> : !data ? <Loading /> : (
        <Card className="gap-0 py-0">
          <div className="flex flex-wrap items-center gap-3 border-b p-3">
            <SearchBox value={q} onChange={setQ} placeholder="Search donor, purpose, reference…" />
            <div className="w-[calc(50%-6px)] sm:w-32"><SelectField value={year} onChange={setYear} options={[...years.map((y) => ({ value: y, label: y })), { value: "", label: "All years" }]} /></div>
            <div className="w-[calc(50%-6px)] sm:w-40"><SelectField value={cur} onChange={setCur} options={[{ value: "", label: "All currencies" }, { value: "KES", label: "KES only" }, { value: "USD", label: "USD only" }, { value: "GBP", label: "GBP only" }, { value: "EUR", label: "EUR only" }]} /></div>
            <p className="text-sm sm:ml-auto"><span className="font-semibold">{money(total)}</span> <span className="text-muted-foreground">from {shown.length} donation{shown.length === 1 ? "" : "s"}{Object.entries(foreign).map(([c, n]) => ` · ${cash(n, c)}`).join("")} · {money(spentTotal)} spent from them</span></p>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead className="px-4">Date</TableHead><TableHead className="px-4">From</TableHead><TableHead className="px-4 text-right">Received</TableHead>
              <TableHead className="hidden px-4 sm:table-cell">Spent</TableHead><TableHead className="hidden px-4 xl:table-cell">Method</TableHead>
              <TableHead className="hidden px-4 2xl:table-cell">Purpose</TableHead><TableHead className="w-12 px-2"><span className="sr-only">Record expense</span></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {shown.length ? shown.map((d) => {
                const donor = data.donors.find((x) => x.id === d.donor_id)
                return (
                  <TableRow key={d.id} className="cursor-pointer" onClick={() => setDialog({ open: true, row: d })}>
                    <TableCell className="px-4 tabular-nums">{fmtDate(d.received_on)}</TableCell>
                    <TableCell className="px-4 font-medium">{donor ? <Link to={"/donors/" + donor.id} onClick={(e) => e.stopPropagation()} className="hover:underline">{d.donor_name}</Link> : d.donor_name}</TableCell>
                    <TableCell className="px-4 text-right">
                      <span className="block font-medium tabular-nums">{money(d.amount)}</span>
                      {d.currency !== "KES" && d.original_amount != null && <span className="block text-xs tabular-nums text-muted-foreground">{cash(d.original_amount, d.currency)} at {rate(d.exchange_rate)}</span>}
                    </TableCell>
                    <TableCell className="hidden w-48 px-4 sm:table-cell"><SpentBar amount={Number(d.amount)} spent={spentOf[d.id] || 0} /></TableCell>
                    <TableCell className="hidden px-4 xl:table-cell">{label(METHODS, d.method)}</TableCell>
                    <TableCell className="hidden px-4 2xl:table-cell">{d.purpose}</TableCell>
                    <TableCell className="px-2"><Button size="icon" variant="ghost" aria-label="Record an expense from this donation" title="Record an expense from this donation"
                      onClick={(e) => { e.stopPropagation(); setSpend(d) }}><ReceiptIcon /></Button></TableCell>
                  </TableRow>
                )
              }) : <TableRow><TableCell colSpan={7} className="h-28 text-center text-muted-foreground">{rows.length ? "No donations match." : "No donations yet. Use “Record donation” to add the first."}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      )}
      <ExpenseDialog open={!!spend} onOpenChange={(o) => !o && setSpend(null)} donorId={spend?.donor_id || undefined} donationId={spend?.id} onSaved={reload} />
      <DonationDialog open={dialog.open} row={dialog.row} onOpenChange={(o) => setDialog((x) => ({ ...x, open: o }))} onSaved={reload} />
    </Page>
  )
}

// Spent and left of one gift, with a small bar
export function SpentBar({ amount, spent }: { amount: number; spent: number }) {
  const pct = amount > 0 ? Math.min(100, Math.round((spent / amount) * 100)) : 0
  const over = spent > amount
  return (
    <div className="grid gap-1">
      <div className="flex justify-between gap-2 text-xs tabular-nums">
        <span className={over ? "font-medium text-destructive" : "font-medium"}>{money(spent)}</span>
        <span className="text-muted-foreground">{over ? `${money(spent - amount)} over` : `${money(amount - spent)} left`}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={"h-full rounded-full " + (over ? "bg-destructive" : "bg-chart-2")} style={{ width: pct + "%" }} /></div>
    </div>
  )
}
