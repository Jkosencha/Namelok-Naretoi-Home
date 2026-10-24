import { useMemo, useState } from "react"
import { PlusIcon, SearchIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ErrorNote, Loading, Page } from "@/components/page"
import { RecordDialog } from "@/components/record-dialog"
import { useTables } from "@/lib/backend"
import { label, lookupLabel, RESOURCES } from "@/lib/domain"
import { capital, fmtDate, money, siteImg, type Row } from "@/lib/format"

export function ResourcePage({ name }: { name: string }) {
  const res = RESOURCES[name]
  const lookupTables = res.fields.filter((f) => f.optionsFrom).map((f) => f.optionsFrom!)
  const { data, error, reload } = useTables([res.table, ...lookupTables], { [res.table]: { order: res.order || "created_at", ascending: !!res.ascending } })
  const [q, setQ] = useState("")
  const [editing, setEditing] = useState<Row | null>(null)
  const [open, setOpen] = useState(false)

  const rows = data?.[res.table] || []
  const shown = useMemo(() => rows.filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase())), [rows, q])
  const lookup = (table: string, id: string) => { const v = data?.[table]?.find((r) => r.id === id); return v ? lookupLabel(table, v) : "" }

  const cell = (key: string, row: Row) => {
    const v = row[key]
    const field = res.fields.find((f) => f.name === key) || {}
    if (field.type === "image") return v ? <img src={siteImg(v)} alt="" className="h-10 w-14 rounded-md object-cover" /> : null
    if (field.type === "checkbox") return v ? <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Yes</Badge> : <Badge variant="outline">No</Badge>
    if (field.type === "date") return fmtDate(v)
    if (key === "amount") return <span className="font-medium tabular-nums">{money(v)}</span>
    if (field.optionsFrom) return lookup(field.optionsFrom, v)
    if (key === "status") return <Badge variant={v === "active" ? "secondary" : "outline"}>{capital(String(v || ""))}</Badge>
    if (field.options) return label(field.options, v)
    return v ?? ""
  }

  const summary = name === "donations" ? `${rows.length} donations · ${money(rows.reduce((s, r) => s + Number(r.amount), 0))} in total`
    : name === "distributions" ? `${rows.reduce((s, r) => s + r.quantity, 0).toLocaleString()} items in total` : ""

  return (
    <Page title={res.title} intro={res.intro} actions={<Button onClick={() => { setEditing(null); setOpen(true) }}><PlusIcon /> Add {res.singular}</Button>}>
      {error ? <ErrorNote message={error} /> : !data ? <Loading /> : (
        <Card className="gap-0 py-0">
          <div className="flex flex-wrap items-center gap-3 border-b p-3">
            <div className="relative w-full sm:w-72">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${res.title.toLowerCase()}…`} className="pl-8" />
            </div>
            {summary && <p className="ml-auto text-sm font-medium">{summary}</p>}
          </div>
          <Table>
            <TableHeader>
              <TableRow>{res.columns!.map(([, text]) => <TableHead key={text} className="px-4">{text}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {shown.length ? shown.map((row) => (
                <TableRow key={row.id} tabIndex={0} className="cursor-pointer" onClick={() => { setEditing(row); setOpen(true) }} onKeyDown={(e) => { if (e.key === "Enter") { setEditing(row); setOpen(true) } }}>
                  {res.columns!.map(([key]) => <TableCell key={key} className="px-4">{cell(key, row)}</TableCell>)}
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={res.columns!.length} className="h-28 text-center text-muted-foreground">
                  {rows.length ? "Nothing matches your search." : `No ${res.title.toLowerCase()} yet. Use “Add ${res.singular}” to create the first one.`}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
      <RecordDialog resource={res} row={editing} open={open} onOpenChange={setOpen} onSaved={() => reload()} />
    </Page>
  )
}
