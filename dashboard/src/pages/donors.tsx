import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeftIcon, FileTextIcon, HandCoinsIcon, HeartHandshakeIcon, PencilIcon, PlusIcon, ReceiptIcon, SearchIcon, WalletIcon, type LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DonationDialog } from "@/components/donation-dialog"
import { ExpenseDialog, ReceiptViewer } from "@/components/expense-dialog"
import { ErrorNote, Loading, Page } from "@/components/page"
import { RecordDialog } from "@/components/record-dialog"
import { useTables } from "@/lib/backend"
import { EXPENSE_CATEGORY, GIVING_PATTERN, label, lookupLabel, METHODS, nextExpected, RESOURCES } from "@/lib/domain"
import { cash, fmtDate, iso, money, rate, type Row } from "@/lib/format"
import { fundSummary } from "@/lib/funds"

const monthYear = (d: Date) => d.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
// Is the next gift coming up, due, or late?
function expectation(donor: Row, last?: Row | null) {
  const next = nextExpected(donor.giving_pattern, last?.received_on)
  if (!next) return null
  const days = Math.round((next.getTime() - Date.now()) / 86400000)
  return { next, tone: days < -30 ? "late" : days <= 30 ? "due" : "later", text: days < -30 ? `Expected ${monthYear(next)}` : days <= 30 ? `Due around ${monthYear(next)}` : `Next around ${monthYear(next)}` }
}
const TONE: Record<string, string> = { late: "bg-chart-4/12 text-chart-4", due: "bg-chart-3/15 text-chart-3", later: "bg-muted text-muted-foreground" }

export function DonorsPage() {
  const { data, error, reload } = useTables(["donors", "donations", "expenses", "sponsorships"], { donors: { order: "name", ascending: true } })
  const navigate = useNavigate()
  const [q, setQ] = useState(""), [adding, setAdding] = useState(false)
  const year = String(new Date().getFullYear())
  const rows = useMemo(() => (data?.donors || []).map((d) => {
    const f = fundSummary(d, data!.donations, data!.expenses)
    return { d, f, thisYear: f.gifts.filter((g) => g.received_on.startsWith(year)).reduce((s, g) => s + Number(g.amount), 0),
      sponsoring: data!.sponsorships.filter((s) => s.donor_id === d.id && !s.ended_on).length, exp: expectation(d, f.last) }
  }), [data, year])
  const shown = rows.filter(({ d }) => !q || [d.name, d.organisation, d.email].join(" ").toLowerCase().includes(q.toLowerCase()))

  return (
    <Page title="Donors" intro="People and organisations who give. Open a donor to see their gifts, what was spent from their funds, what is left, and the children they sponsor."
      actions={<Button onClick={() => setAdding(true)}><PlusIcon /> Add donor</Button>}>
      {error ? <ErrorNote message={error} /> : !data ? <Loading /> : (
        <Card className="gap-0 py-0">
          <div className="border-b p-3"><div className="relative w-full sm:w-72"><SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search donors…" className="pl-8" /></div></div>
          <Table>
            <TableHeader><TableRow>
              <TableHead className="px-4">Donor</TableHead><TableHead className="hidden px-4 md:table-cell">Last gift</TableHead><TableHead className="hidden px-4 lg:table-cell">Next gift</TableHead>
              <TableHead className="hidden px-4 text-right sm:table-cell">Given in {year}</TableHead><TableHead className="px-4 text-right">Their funds left</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {shown.length ? shown.map(({ d, f, thisYear, sponsoring, exp }) => (
                <TableRow key={d.id} className="cursor-pointer" onClick={() => navigate("/donors/" + d.id)}>
                  <TableCell className="px-4"><span className="block font-medium">{d.name}</span>
                    <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">{d.giving_pattern && <span>{label(GIVING_PATTERN, d.giving_pattern)}</span>}{d.currency && d.currency !== "KES" && <span>in {d.currency}</span>}{sponsoring > 0 && <span>sponsors {sponsoring} child{sponsoring === 1 ? "" : "ren"}</span>}</span></TableCell>
                  <TableCell className="hidden px-4 md:table-cell">{f.last ? <><span className="block tabular-nums">{fmtDate(f.last.received_on)}</span><span className="text-xs text-muted-foreground">{f.last.currency !== "KES" && f.last.original_amount ? cash(f.last.original_amount, f.last.currency) : money(f.last.amount)}</span></> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="hidden px-4 lg:table-cell">{exp ? <span className={"rounded-md px-2 py-0.5 text-xs font-medium " + TONE[exp.tone]}>{exp.text}</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="hidden px-4 text-right tabular-nums sm:table-cell">{money(thisYear)}</TableCell>
                  <TableCell className="px-4 text-right font-medium tabular-nums">{f.spent.length ? money(f.balance) : <span className="text-xs font-normal text-muted-foreground">General funds</span>}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={5} className="h-28 text-center text-muted-foreground">{data.donors.length ? "No donors match." : "No donors yet. They are also added when you record a donation from someone new."}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      )}
      <RecordDialog resource={RESOURCES.donors} row={null} open={adding} onOpenChange={setAdding} onSaved={(s) => { reload(); if (s) navigate("/donors/" + s.id) }} />
    </Page>
  )
}

function Stat({ icon: Icon, tone, title, value, sub }: { icon: LucideIcon; tone: number; title: string; value: string; sub?: string }) {
  return (
    <Card className="flex-row items-center gap-4 px-5 py-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, var(--chart-${tone}) 13%, transparent)`, color: `var(--chart-${tone})` }}><Icon className="size-5" /></span>
      <span className="min-w-0"><span className="block text-sm text-muted-foreground">{title}</span><span className="block truncate text-xl font-semibold tracking-tight">{value}</span>{sub && <span className="block text-xs text-muted-foreground">{sub}</span>}</span>
    </Card>
  )
}

export function DonorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, error, reload } = useTables(["donors", "donations", "expenses", "sponsorships", "children"], { donors: { eq: { id } }, donations: { order: "received_on" }, expenses: { order: "spent_on" } })
  const [editing, setEditing] = useState(false)
  const [gift, setGift] = useState<{ open: boolean; row: Row | null }>({ open: false, row: null })
  const [spend, setSpend] = useState<{ open: boolean; row: Row | null }>({ open: false, row: null })
  const [receipt, setReceipt] = useState<Row | null>(null)
  const closeReceipt = useCallback(() => setReceipt(null), [])
  const donor = data?.donors[0]
  useEffect(() => { if (data && !donor) navigate("/donors") }, [data, donor, navigate])
  const f = donor ? fundSummary(donor, data!.donations, data!.expenses) : null
  const exp = donor && f ? expectation(donor, f.last) : null
  const usdLeft = f?.lastForeign && f.balance > 0 ? f.balance / Number(f.lastForeign.exchange_rate) : null
  const q = (() => { const n = new Date(); const qn = Math.floor(n.getMonth() / 3); return qn === 0 ? { quarter: 4, year: n.getFullYear() - 1 } : { quarter: qn, year: n.getFullYear() } })()

  return (
    <Page title={donor?.name || "Donor"} actions={donor && <>
      <Button variant="outline" asChild><Link to="/donors"><ArrowLeftIcon /> All donors</Link></Button>
      <Button variant="outline" onClick={() => setEditing(true)}><PencilIcon /> Edit</Button>
      <Button variant="outline" asChild><Link to={`/reports/new?donor=${donor.id}&kind=quarterly&quarter=${q.quarter}&year=${q.year}`}><FileTextIcon /> Quarterly statement</Link></Button>
      <Button variant="outline" onClick={() => setSpend({ open: true, row: null })}><ReceiptIcon /> Record expense</Button>
      <Button onClick={() => setGift({ open: true, row: null })}><PlusIcon /> Record donation</Button></>}>
      {error ? <ErrorNote message={error} /> : !donor || !f ? <Loading /> : (
        <>
          <p className="-mt-1 text-sm text-muted-foreground">{[donor.organisation !== donor.name && donor.organisation, donor.giving_pattern && `Usually gives ${label(GIVING_PATTERN, donor.giving_pattern).toLowerCase()}`, donor.currency !== "KES" && `in ${donor.currency}`, donor.email, donor.phone].filter(Boolean).join(" · ")}</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={HandCoinsIcon} tone={1} title="Received" value={money(f.received)} sub={[`${f.gifts.length} gift${f.gifts.length === 1 ? "" : "s"}`, ...Object.entries(f.foreign).map(([c, n]) => cash(n, c))].join(" · ")} />
            <Stat icon={ReceiptIcon} tone={4} title="Spent from their funds" value={money(f.used)} sub={`${f.spent.length} expense${f.spent.length === 1 ? "" : "s"}`} />
            <Stat icon={WalletIcon} tone={2} title="Funds left" value={f.spent.length ? money(f.balance) : "—"}
              sub={!f.spent.length ? "Their gifts go to general funds. Choose them under “Paid from” to track spending." : usdLeft != null ? `≈ ${cash(Math.round(usdLeft), f.lastForeign!.currency)} at the last rate (${rate(f.lastForeign!.exchange_rate)})` : undefined} />
            <Stat icon={HeartHandshakeIcon} tone={3} title="Next gift" value={exp ? monthYear(exp.next) : "—"} sub={exp ? (exp.tone === "late" ? "Later than usual" : exp.tone === "due" ? "Due soon" : `Last one ${fmtDate(f.last?.received_on)}`) : "Set how often they give to see this"} />
          </div>

          <Sponsorships mode="donor" id={donor.id} rows={data!.sponsorships.filter((s) => s.donor_id === donor.id)} children={data!.children} donors={data!.donors} onChanged={reload} />

          <Tabs defaultValue="donations">
            <TabsList><TabsTrigger value="donations">Donations <span className="text-muted-foreground">{f.gifts.length}</span></TabsTrigger><TabsTrigger value="expenses">Spent from their funds <span className="text-muted-foreground">{f.spent.length}</span></TabsTrigger></TabsList>
            <TabsContent value="donations">
              <Card className="gap-0 py-0"><Table>
                <TableHeader><TableRow><TableHead className="px-4">Date</TableHead><TableHead className="px-4">Amount</TableHead><TableHead className="hidden px-4 sm:table-cell">Rate</TableHead><TableHead className="px-4 text-right">KES received</TableHead><TableHead className="hidden px-4 md:table-cell">Method</TableHead><TableHead className="hidden px-4 lg:table-cell">Purpose</TableHead></TableRow></TableHeader>
                <TableBody>{f.gifts.length ? f.gifts.map((d) => (
                  <TableRow key={d.id} className="cursor-pointer" onClick={() => setGift({ open: true, row: d })}>
                    <TableCell className="px-4 tabular-nums">{fmtDate(d.received_on)}</TableCell>
                    <TableCell className="px-4 tabular-nums">{d.currency !== "KES" && d.original_amount != null ? cash(d.original_amount, d.currency) : money(d.amount)}</TableCell>
                    <TableCell className="hidden px-4 tabular-nums sm:table-cell">{d.exchange_rate ? rate(d.exchange_rate) : "—"}</TableCell>
                    <TableCell className="px-4 text-right font-medium tabular-nums">{money(d.amount)}</TableCell>
                    <TableCell className="hidden px-4 md:table-cell">{label(METHODS, d.method)}</TableCell>
                    <TableCell className="hidden px-4 lg:table-cell">{d.purpose}</TableCell>
                  </TableRow>)) : <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No donations recorded yet.</TableCell></TableRow>}</TableBody>
              </Table></Card>
            </TabsContent>
            <TabsContent value="expenses">
              <Card className="gap-0 py-0"><Table>
                <TableHeader><TableRow><TableHead className="px-4">Date</TableHead><TableHead className="px-4">What for</TableHead><TableHead className="hidden px-4 md:table-cell">Category</TableHead><TableHead className="px-4 text-right">Amount</TableHead><TableHead className="w-12 px-2"><span className="sr-only">Receipt</span></TableHead></TableRow></TableHeader>
                <TableBody>{f.spent.length ? [...f.spent].sort((a, b) => (a.spent_on < b.spent_on ? 1 : -1)).map((e) => (
                  <TableRow key={e.id} className="cursor-pointer" onClick={() => setSpend({ open: true, row: e })}>
                    <TableCell className="px-4 tabular-nums">{fmtDate(e.spent_on)}</TableCell>
                    <TableCell className="whitespace-normal px-4"><span className="block font-medium">{e.description}</span><span className="text-xs text-muted-foreground">{[e.vendor, (() => { const c = data!.children.find((x) => x.id === e.child_id); return c ? lookupLabel("children", c) : "" })()].filter(Boolean).join(" · ")}</span></TableCell>
                    <TableCell className="hidden px-4 md:table-cell">{label(EXPENSE_CATEGORY, e.category)}</TableCell>
                    <TableCell className="px-4 text-right font-medium tabular-nums">{money(e.amount)}</TableCell>
                    <TableCell className="px-2">{e.receipt_path ? <Button size="icon" variant="ghost" aria-label="View receipt" onClick={(ev) => { ev.stopPropagation(); setReceipt(e) }}><ReceiptIcon /></Button> : <Badge variant="outline" className="text-chart-3" title="No receipt attached">!</Badge>}</TableCell>
                  </TableRow>)) : <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Nothing spent from this donor's funds yet. When you record an expense, choose “{donor.name}” under “Paid from”.</TableCell></TableRow>}</TableBody>
              </Table></Card>
            </TabsContent>
          </Tabs>
        </>
      )}
      {donor && <RecordDialog resource={RESOURCES.donors} row={donor} open={editing} onOpenChange={setEditing} onSaved={(s) => (s ? reload() : navigate("/donors"))} />}
      <DonationDialog open={gift.open} row={gift.row} donorId={donor?.id} onOpenChange={(o) => setGift((x) => ({ ...x, open: o }))} onSaved={reload} />
      <ExpenseDialog open={spend.open} row={spend.row} donorId={donor?.id} onOpenChange={(o) => setSpend((x) => ({ ...x, open: o }))} onSaved={reload} />
      <ReceiptViewer expense={receipt} onClose={closeReceipt} />
    </Page>
  )
}

// Who sponsors whom, shown on both the donor's and the child's page
export function Sponsorships({ mode, id, rows, children, donors, onChanged }: { mode: "donor" | "child"; id: string; rows: Row[]; children: Row[]; donors: Row[]; onChanged: () => void }) {
  const [edit, setEdit] = useState<{ open: boolean; row: Row | null }>({ open: false, row: null })
  const resource = useMemo(() => ({ ...RESOURCES.sponsorships, fields: RESOURCES.sponsorships.fields.filter((f) => f.name !== (mode === "donor" ? "donor_id" : "child_id")) }), [mode])
  const today = iso(new Date())
  const donorCurrency = mode === "donor" ? donors.find((d) => d.id === id)?.currency || "KES" : "KES"
  const initial = useMemo(() => ({ started_on: iso(new Date()), currency: donorCurrency }), [donorCurrency])
  const current = rows.filter((s) => !s.ended_on || s.ended_on >= today), past = rows.filter((s) => s.ended_on && s.ended_on < today)
  const item = (s: Row) => {
    const who = mode === "donor" ? children.find((c) => c.id === s.child_id) : donors.find((d) => d.id === s.donor_id)
    const name = who ? lookupLabel(mode === "donor" ? "children" : "donors", who) : "—"
    return (
      <li key={s.id} className="flex items-center gap-3 py-2.5">
        <div className="min-w-0 flex-1">
          {who ? <Link to={(mode === "donor" ? "/children/" : "/donors/") + who.id} className="font-medium hover:underline">{name}</Link> : name}
          <p className="text-xs text-muted-foreground">{[s.started_on && `since ${fmtDate(s.started_on)}`, s.ended_on && `until ${fmtDate(s.ended_on)}`, s.amount && `${cash(s.amount, s.currency)}${s.frequency ? " " + label(GIVING_PATTERN, s.frequency).toLowerCase() : ""}`, s.notes].filter(Boolean).join(" · ")}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setEdit({ open: true, row: s })}>Edit</Button>
      </li>
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === "donor" ? "Children they sponsor" : "Sponsored by"}</CardTitle>
        <CardAction><Button size="sm" variant="outline" onClick={() => setEdit({ open: true, row: null })}><PlusIcon /> {mode === "donor" ? "Add a child" : "Add a sponsor"}</Button></CardAction>
      </CardHeader>
      <CardContent>
        {rows.length ? <ul className="divide-y">{current.map(item)}{past.length > 0 && <li className="pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Past</li>}{past.map(item)}</ul>
          : <p className="text-sm text-muted-foreground">{mode === "donor" ? "Not sponsoring a specific child." : "No sponsor yet. Add one if a donor supports this child directly."}</p>}
      </CardContent>
      <RecordDialog resource={resource} row={edit.row} open={edit.open} fixed={{ [mode === "donor" ? "donor_id" : "child_id"]: id }}
        initial={edit.row ? undefined : initial}
        onOpenChange={(o) => setEdit((x) => ({ ...x, open: o }))} onSaved={onChanged} />
    </Card>
  )
}
