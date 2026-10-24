import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { DownloadIcon, PlusIcon, SearchIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DonationDialog } from "@/components/donation-dialog"
import { ErrorNote, Loading, Page } from "@/components/page"
import { SelectField } from "@/components/record-dialog"
import { useTables } from "@/lib/backend"
import { label, METHODS } from "@/lib/domain"
import { cash, fmtDate, money, rate, type Row } from "@/lib/format"
import { downloadCsv } from "@/lib/funds"

export function DonationsPage() {
  const { data, error, reload } = useTables(["donations", "donors"], { donations: { order: "received_on" } })
  const [q, setQ] = useState(""), [year, setYear] = useState(String(new Date().getFullYear())), [cur, setCur] = useState("")
  const [dialog, setDialog] = useState<{ open: boolean; row: Row | null }>({ open: false, row: null })
  const rows = useMemo(() => data?.donations || [], [data])
  const years = [...new Set([String(new Date().getFullYear()), ...rows.map((d) => d.received_on.slice(0, 4))])].sort().reverse()
  const shown = rows.filter((d) => (!year || d.received_on.startsWith(year)) && (!cur || d.currency === cur) &&
    (!q || [d.donor_name, d.purpose, d.reference, d.notes].join(" ").toLowerCase().includes(q.toLowerCase())))
  const total = shown.reduce((s, d) => s + Number(d.amount), 0)
  const foreign: Record<string, number> = {}
  shown.filter((d) => d.currency !== "KES" && d.original_amount).forEach((d) => (foreign[d.currency] = (foreign[d.currency] || 0) + Number(d.original_amount)))

  const csv = () => downloadCsv(`donations-${year || "all"}.csv`, ["Date", "From", "Currency", "Amount", "Rate", "KES received", "Method", "Reference", "Purpose", "Notes"],
    shown.map((d) => [d.received_on, d.donor_name, d.currency, d.original_amount ?? d.amount, d.exchange_rate ?? "", d.amount, label(METHODS, d.method), d.reference, d.purpose, d.notes]))

  return (
    <Page title="Donations" intro="Every donation received. Foreign-currency gifts keep the amount and the rate used, and are counted in KES everywhere."
      actions={<><Button variant="outline" onClick={csv} disabled={!shown.length}><DownloadIcon /> Download</Button><Button onClick={() => setDialog({ open: true, row: null })}><PlusIcon /> Record donation</Button></>}>
      {error ? <ErrorNote message={error} /> : !data ? <Loading /> : (
        <Card className="gap-0 py-0">
          <div className="flex flex-wrap items-center gap-3 border-b p-3">
            <div className="relative w-full sm:w-64"><SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search donor, purpose, reference…" className="pl-8" /></div>
            <div className="w-[calc(50%-6px)] sm:w-32"><SelectField value={year} onChange={setYear} options={[...years.map((y) => ({ value: y, label: y })), { value: "", label: "All years" }]} /></div>
            <div className="w-[calc(50%-6px)] sm:w-40"><SelectField value={cur} onChange={setCur} options={[{ value: "", label: "All currencies" }, { value: "KES", label: "KES only" }, { value: "USD", label: "USD only" }, { value: "GBP", label: "GBP only" }, { value: "EUR", label: "EUR only" }]} /></div>
            <p className="text-sm sm:ml-auto"><span className="font-semibold">{money(total)}</span> <span className="text-muted-foreground">from {shown.length} donation{shown.length === 1 ? "" : "s"}{Object.entries(foreign).map(([c, n]) => ` · ${cash(n, c)}`).join("")}</span></p>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead className="px-4">Date</TableHead><TableHead className="px-4">From</TableHead><TableHead className="px-4 text-right">Received</TableHead>
              <TableHead className="hidden px-4 md:table-cell">Method</TableHead><TableHead className="hidden px-4 lg:table-cell">Purpose</TableHead>
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
                    <TableCell className="hidden px-4 md:table-cell">{label(METHODS, d.method)}</TableCell>
                    <TableCell className="hidden px-4 lg:table-cell">{d.purpose}</TableCell>
                  </TableRow>
                )
              }) : <TableRow><TableCell colSpan={5} className="h-28 text-center text-muted-foreground">{rows.length ? "No donations match." : "No donations yet. Use “Record donation” to add the first."}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      )}
      <DonationDialog open={dialog.open} row={dialog.row} onOpenChange={(o) => setDialog((x) => ({ ...x, open: o }))} onSaved={reload} />
    </Page>
  )
}
