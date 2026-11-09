import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeftIcon, FileTextIcon, MailIcon, PencilIcon, PlusIcon, ShieldCheckIcon, ShieldOffIcon, Trash2Icon, UploadIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { SearchBox } from "@/components/bits"
import { ErrorNote, Loading, Page } from "@/components/page"
import { RecordDialog } from "@/components/record-dialog"
import { useDb, useSession, useTables } from "@/lib/backend"
import { CONTRACT_TYPE, label, RESOURCES, STAFF_STATUS } from "@/lib/domain"
import { fmtDate, friendly, initials, type Row } from "@/lib/format"

const nameParts = (n: string) => { const p = n.trim().split(/\s+/); return [p[0] || "", p.length > 1 ? p[p.length - 1] : ""] as const }
// Does this person have a dashboard login? (admins table, matched by login or by email)
function accessOf(m: Row, admins: Row[]) {
  return admins.find((a) => (m.user_id && a.user_id === m.user_id) || (m.email && a.email?.toLowerCase() === m.email.toLowerCase())) || null
}

export function StaffPage() {
  const { data, error, reload } = useTables(["staff", "admins"], { staff: { order: "full_name", ascending: true } })
  const navigate = useNavigate()
  const [q, setQ] = useState(""), [status, setStatus] = useState("active")
  const [adding, setAdding] = useState(false)
  const rows = useMemo(() => data?.staff || [], [data])
  const shown = rows.filter((m) => (status === "all" || m.status === status) && (!q || [m.full_name, m.role, m.email, m.phone].join(" ").toLowerCase().includes(q.toLowerCase())))
  const count = (s: string) => rows.filter((m) => m.status === s).length

  return (
    <Page title="Staff"
      actions={<Button onClick={() => setAdding(true)}><PlusIcon /> Add staff member</Button>}>
      {error ? <ErrorNote message={error} /> : !data ? <Loading /> : (
        <Card className="gap-0 py-0">
          <div className="flex flex-wrap items-center gap-3 border-b p-3">
            <Tabs value={status} onValueChange={setStatus}>
              <TabsList>
                <TabsTrigger value="active">Working here <span className="text-muted-foreground">{count("active")}</span></TabsTrigger>
                <TabsTrigger value="left">Has left <span className="text-muted-foreground">{count("left")}</span></TabsTrigger>
                <TabsTrigger value="all">All <span className="text-muted-foreground">{rows.length}</span></TabsTrigger>
              </TabsList>
            </Tabs>
            <SearchBox value={q} onChange={setQ} placeholder="Search staff…" className="sm:ml-auto" />
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead className="px-4">Name</TableHead><TableHead className="hidden px-4 md:table-cell">Contact</TableHead>
              <TableHead className="hidden px-4 lg:table-cell">Started</TableHead><TableHead className="hidden px-4 lg:table-cell">Contract</TableHead><TableHead className="px-4">Dashboard</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {shown.length ? shown.map((m) => {
                const [a, b] = nameParts(m.full_name)
                return (
                  <TableRow key={m.id} className="cursor-pointer" onClick={() => navigate("/staff/" + m.id)}>
                    <TableCell className="px-4"><span className="flex items-center gap-3">
                      <Avatar className="size-9"><AvatarFallback className="text-xs">{initials(a, b)}</AvatarFallback></Avatar>
                      <span><span className="block font-medium">{m.full_name}</span><span className="block text-xs text-muted-foreground">{m.role || "No role set"}</span></span></span></TableCell>
                    <TableCell className="hidden px-4 md:table-cell"><span className="block">{m.phone}</span><span className="block text-xs text-muted-foreground">{m.email}</span></TableCell>
                    <TableCell className="hidden px-4 tabular-nums lg:table-cell">{fmtDate(m.start_date)}</TableCell>
                    <TableCell className="hidden px-4 lg:table-cell">{m.contract_type ? label(CONTRACT_TYPE, m.contract_type) : ""}</TableCell>
                    <TableCell className="px-4">{accessOf(m, data.admins) ? <Badge variant="secondary" className="bg-chart-2/15 text-chart-2"><ShieldCheckIcon /> Has access</Badge> : <Badge variant="outline">No login</Badge>}</TableCell>
                  </TableRow>
                )
              }) : <TableRow><TableCell colSpan={5} className="h-28 text-center text-muted-foreground">{rows.length ? "No staff match." : "No staff recorded yet. Use “Add staff member” to add the first."}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      )}
      <RecordDialog resource={RESOURCES.staff} row={null} open={adding} onOpenChange={setAdding} onSaved={(s) => { reload(); if (s) navigate("/staff/" + s.id) }} />
    </Page>
  )
}

export function StaffMemberPage() {
  const { id } = useParams()
  const db = useDb()
  const { user } = useSession()
  const navigate = useNavigate()
  const { data, error, reload } = useTables(["staff", "admins", "staff_documents"], { staff: { eq: { id } }, staff_documents: { eq: { staff_id: id } } })
  const [editing, setEditing] = useState(false), [inviting, setInviting] = useState(false), [removing, setRemoving] = useState(false), [delDoc, setDelDoc] = useState<Row | null>(null)
  const [docTitle, setDocTitle] = useState(""), [uploading, setUploading] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const m = data?.staff[0]
  useEffect(() => { if (data && !m) navigate("/staff") }, [data, m, navigate])
  const access = m ? accessOf(m, data!.admins) : null
  const isMe = !!access && access.email?.toLowerCase() === user.email?.toLowerCase()

  async function upload(f?: File) {
    if (!f || !m) return
    if (f.size > 20 * 1024 * 1024) return toast.error("That file is over 20 MB. Please upload a smaller copy.")
    setUploading(true)
    try {
      const path = await db.uploadDocument(f, "staff")
      await db.insert("staff_documents", { staff_id: m.id, title: docTitle.trim() || f.name.replace(/\.[^.]+$/, ""), file_path: path, file_name: f.name })
      toast.success("Document added"); setDocTitle(""); reload()
    } catch (e) { toast.error("Upload failed: " + friendly((e as Error).message)) }
    setUploading(false)
    if (file.current) file.current.value = ""
  }

  const rows: [string, string][] = m ? [
    ["Role", m.role], ["Phone", m.phone], ["Email", m.email], ["Started", fmtDate(m.start_date)], ["Contract", m.contract_type ? label(CONTRACT_TYPE, m.contract_type) : ""],
    ["Status", label(STAFF_STATUS, m.status)], ["ID number", m.id_number], ["Next of kin", [m.next_of_kin_name, m.next_of_kin_phone].filter(Boolean).join(" · ")], ["Notes", m.notes],
  ] : []

  return (
    <Page title={m?.full_name || "Staff member"} actions={m && <>
      <Button variant="outline" asChild><Link to="/staff"><ArrowLeftIcon /> All staff</Link></Button>
      <Button onClick={() => setEditing(true)}><PencilIcon /> Edit details</Button></>}>
      {error ? <ErrorNote message={error} /> : !m ? <Loading /> : (
        <div className="grid items-start gap-5 lg:grid-cols-[1.3fr_1fr]">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <Avatar className="size-14"><AvatarFallback className="text-lg font-semibold">{initials(...nameParts(m.full_name))}</AvatarFallback></Avatar>
                <div><CardTitle className="text-xl">{m.full_name}</CardTitle><CardDescription>{[m.role, label(STAFF_STATUS, m.status)].filter(Boolean).join(" · ")}</CardDescription></div>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="divide-y">{rows.filter(([, v]) => v).map(([k, v]) => <div key={k} className="grid grid-cols-[120px_1fr] gap-3 py-2.5 text-sm"><dt className="text-muted-foreground">{k}</dt><dd className="whitespace-pre-wrap">{v}</dd></div>)}</dl>
            </CardContent>
          </Card>

          <div className="grid gap-5">
            <Card>
              <CardHeader><CardTitle>Dashboard access</CardTitle>
                <CardDescription>{access ? `Signs in as ${access.email}` : "No login yet. Invite them to give them their own access to this dashboard."}</CardDescription></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {access ? (
                  <>
                    <Badge variant="secondary" className="bg-chart-2/15 text-chart-2"><ShieldCheckIcon /> Has access</Badge>
                    {!isMe && <Button size="sm" variant="ghost" className="ml-auto text-destructive" onClick={() => setRemoving(true)}><ShieldOffIcon /> Remove access</Button>}
                    {isMe && <span className="text-xs text-muted-foreground">This is you.</span>}
                  </>
                ) : <Button size="sm" onClick={() => setInviting(true)} disabled={m.status === "left"}><MailIcon /> Invite to the dashboard</Button>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
              <CardContent className="grid gap-3">
                {data!.staff_documents.length ? (
                  <ul className="divide-y">
                    {data!.staff_documents.map((d) => (
                      <li key={d.id} className="flex items-center gap-3 py-2">
                        <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                        <button className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline" onClick={async () => {
                          try { const url = await db.documentUrl(d.file_path, d.file_name); if (url) window.open(url, "_blank", "noopener"); else toast.message("This demo document has no file attached.") }
                          catch (e) { toast.error("Could not open: " + (e as Error).message) }
                        }}>{d.title || d.file_name}</button>
                        <span className="hidden text-xs text-muted-foreground sm:inline">{fmtDate(d.created_at)}</span>
                        <Button size="icon" variant="ghost" aria-label="Delete document" onClick={() => setDelDoc(d)}><Trash2Icon /></Button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-muted-foreground">No documents yet.</p>}
                <div className="flex gap-2">
                  <Input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="Title, e.g. Employment contract" />
                  <Button variant="outline" disabled={uploading} onClick={() => file.current?.click()}><UploadIcon /> {uploading ? "Uploading…" : "Upload"}</Button>
                  <input ref={file} type="file" hidden accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => upload(e.target.files?.[0])} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {m && <RecordDialog resource={RESOURCES.staff} row={m} open={editing} onOpenChange={setEditing} onSaved={(s) => (s ? reload() : navigate("/staff"))} />}
      {m && <InviteDialog open={inviting} onOpenChange={setInviting} member={m} onDone={reload} />}
      <AlertDialog open={removing} onOpenChange={setRemoving}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remove {m?.full_name}'s access?</AlertDialogTitle>
            <AlertDialogDescription>They will no longer be able to open the dashboard. Their staff record stays, and you can invite them again later.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={async () => {
              try { await db.removeAccess(access!.user_id); toast.success("Access removed"); reload() } catch (e) { toast.error((e as Error).message) }
            }}>Remove access</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!delDoc} onOpenChange={(o) => !o && setDelDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete “{delDoc?.title || delDoc?.file_name}”?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={async () => { await db.remove("staff_documents", delDoc!.id); setDelDoc(null); toast.success("Document deleted"); reload() }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  )
}

function InviteDialog({ open, onOpenChange, member, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; member: Row; onDone: () => void }) {
  const db = useDb()
  const [email, setEmail] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setEmail(member.email || ""); setErr("") } }, [open, member])
  async function send(e: React.FormEvent) {
    e.preventDefault(); setErr("")
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr("Enter a valid email address.")
    setBusy(true)
    try {
      await db.inviteStaff(email.trim(), member.id)
      toast.success(`Invitation sent to ${email.trim()}`); onOpenChange(false); onDone()
    } catch (ex) { setErr((ex as Error).message) }
    setBusy(false)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={send} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Invite {member.full_name}</DialogTitle>
            <DialogDescription>They'll get an email with a link to set their password.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5"><Label htmlFor="inv_email">Their email</Label><Input id="inv_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></div>
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={busy}><MailIcon /> {busy ? "Sending…" : "Send invitation"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
