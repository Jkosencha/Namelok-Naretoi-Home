import { useState } from "react"
import { toast } from "sonner"
import { MailIcon, UserPlusIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ErrorNote, Loading, Page } from "@/components/page"
import { RecordDialog, SelectField } from "@/components/record-dialog"
import { useDb, useTables } from "@/lib/backend"
import { RESOURCES } from "@/lib/domain"
import { capital, fmtDate, type Row } from "@/lib/format"

export function MessagesPage() {
  const db = useDb()
  const { data, error, reload } = useTables(["contact_messages"])
  const [tab, setTab] = useState("inbox")
  const [volunteer, setVolunteer] = useState<Row | null>(null)
  const rows = (data?.contact_messages || []).filter((m) => tab === "all" || (tab === "archived" ? m.status === "archived" : m.status !== "archived"))
  return (
    <Page title="Messages" intro="Messages sent through the website's contact form.">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="inbox">Inbox</TabsTrigger><TabsTrigger value="archived">Archived</TabsTrigger><TabsTrigger value="all">All</TabsTrigger></TabsList>
      </Tabs>
      {error ? <ErrorNote message={error} /> : !data ? <Loading /> : rows.length ? (
        <div className="grid gap-3">
          {rows.map((m) => (
            <Card key={m.id} className={m.status === "new" ? "border-l-4 border-l-chart-2" : ""}>
              <CardContent className="grid gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-semibold">{`${m.first_name} ${m.last_name}`.trim()}</p><a href={`mailto:${m.email}`} className="text-sm text-primary underline-offset-4 hover:underline">{m.email}</a></div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">{m.reason && <Badge variant="secondary">{m.reason}</Badge>}{fmtDate(m.created_at)}</div>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.message}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="w-36"><SelectField value={m.status} options={["new", "read", "replied", "archived"].map((s) => ({ value: s, label: capital(s) }))}
                    onChange={async (v) => { try { await db.update("contact_messages", m.id, { status: v }); toast.success("Status updated"); reload() } catch (e) { toast.error((e as Error).message) } }} /></div>
                  {/volunteer/i.test(m.reason) && <Button variant="outline" size="sm" onClick={() => setVolunteer({ name: `${m.first_name} ${m.last_name}`.trim(), email: m.email, notes: m.message })}><UserPlusIcon /> Add as volunteer</Button>}
                  <Button size="sm" asChild><a href={`mailto:${m.email}?subject=${encodeURIComponent("Re: your message to Namelok Naretoi Home")}`}><MailIcon /> Reply by email</a></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : <Card className="py-14 text-center text-sm text-muted-foreground">No messages here.</Card>}
      <RecordDialog resource={RESOURCES.volunteers} row={null} open={!!volunteer} initial={volunteer || undefined} onOpenChange={(o) => !o && setVolunteer(null)} onSaved={() => toast.success("Saved to Volunteers")} />
    </Page>
  )
}
