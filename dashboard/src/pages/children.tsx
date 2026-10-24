import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeftIcon, CheckIcon, HeartHandshakeIcon, ChevronLeftIcon, GraduationCapIcon, HomeIcon, LogOutIcon, Undo2Icon, ChevronRightIcon, ImagePlusIcon, PencilIcon, PlusIcon, SearchIcon, ShieldAlertIcon, Trash2Icon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DialogFooter, DialogHeader } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ErrorNote, Loading, Page } from "@/components/page"
import { RecordDialog, SelectField } from "@/components/record-dialog"
import { Sponsorships } from "@/pages/donors"
import { CategoryBadge } from "@/pages/overview"
import { useDb, useTables } from "@/lib/backend"
import { CATEGORY_COLOR, CHILD_CATEGORY, CHILD_STATUS, CLASS_STAGES, CLASS_TRACKS, currentClass, EVENT_TYPES, isCurrent, label, MOVED_ON, REFERRAL, RESOURCES } from "@/lib/domain"
import { age, capital, fmtDate, initials, today, type Row } from "@/lib/format"

const TL_COLOR: Record<string, string> = { medical: "var(--chart-1)", follow_up: "var(--chart-1)", school: "var(--chart-2)", case: "var(--chart-4)", other: "var(--chart-3)" }
const MAX_PHOTOS = 6
const fullName = (c: Row) => `${c.first_name} ${c.last_name}`.trim()

// A photo, or the child's initials on a soft category colour when there is none
function ChildPicture({ src, child, className = "", onClick }: { src?: string; child: Row; className?: string; onClick?: () => void }) {
  const color = CATEGORY_COLOR[child.category] || "var(--muted-foreground)"
  const inner = src ? <img src={src} alt="" className="size-full object-cover" loading="lazy" /> : (
    <span className="flex size-full items-center justify-center text-3xl font-semibold" style={{ background: `color-mix(in srgb, ${color} 12%, var(--card))`, color: `color-mix(in srgb, ${color} 75%, var(--foreground))` }}>
      {initials(child.first_name, child.last_name)}
    </span>
  )
  return onClick && src
    ? <button type="button" onClick={onClick} className={"block overflow-hidden bg-muted focus-visible:outline-2 focus-visible:outline-ring " + className}>{inner}</button>
    : <div className={"overflow-hidden bg-muted " + className}>{inner}</div>
}

export function ChildrenPage() {
  const db = useDb()
  const { data, error, reload } = useTables(["children", "sponsorships"], { children: { order: "admission_date" } })
  const sponsored = useMemo(() => new Set((data?.sponsorships || []).filter((s) => !s.ended_on || s.ended_on >= today()).map((s) => s.child_id)), [data])
  const navigate = useNavigate()
  const [q, setQ] = useState("")
  const [cat, setCat] = useState("all")
  const [stage, setStage] = useState("")
  const [status, setStatus] = useState("current")
  const [adding, setAdding] = useState(false)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const rows = useMemo(() => data?.children || [], [data])
  useEffect(() => { if (rows.length) db.privateUrls(rows.map((c) => c.photo_path)).then(setUrls).catch(() => setUrls({})) }, [rows, db])

  const statusTabs = [
    { value: "current", label: "Currently supported", n: rows.filter(isCurrent).length },
    ...MOVED_ON.map((v) => ({ value: v, label: label(CHILD_STATUS, v), n: rows.filter((c) => c.status === v).length })),
    { value: "", label: "All", n: rows.length },
  ]
  const byStatus = useMemo(() => rows.filter((c) => status === "" || (status === "current" ? isCurrent(c) : c.status === status)), [rows, status])
  const shown = useMemo(() => byStatus.filter((c) =>
    (!q || [c.first_name, c.last_name, c.school_name, c.home_location, c.guardian_name, currentClass(c)?.name].join(" ").toLowerCase().includes(q.toLowerCase())) &&
    (cat === "all" || c.category === cat) && (!stage || currentClass(c)?.stage === stage)), [byStatus, q, cat, stage])

  return (
    <Page title="Children" intro={<span className="inline-flex items-center gap-2 text-destructive"><ShieldAlertIcon className="size-4 shrink-0" />Private records. Never share these details outside the team.</span>}
      actions={<Button onClick={() => setAdding(true)}><PlusIcon /> Add child</Button>}>
      <Tabs value={status} onValueChange={setStatus} className="max-w-full overflow-x-auto">
        <TabsList variant="line">
          {statusTabs.map((t) => (
            <TabsTrigger key={t.value || "all"} value={t.value} className="px-3">{t.label} <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{t.n}</span></TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={cat} onValueChange={setCat} className="max-w-full overflow-x-auto">
          <TabsList>
            <TabsTrigger value="all">All <span className="tabular-nums text-muted-foreground">{byStatus.length}</span></TabsTrigger>
            {CHILD_CATEGORY.map((o) => (
              <TabsTrigger key={o.value} value={o.value}>
                <span className="size-2 rounded-full" style={{ background: CATEGORY_COLOR[o.value] }} />{o.label}
                <span className="tabular-nums text-muted-foreground">{byStatus.filter((c) => c.category === o.value).length}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex w-full flex-wrap gap-2 xl:ml-auto xl:w-auto">
          <div className="relative w-full sm:w-60">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, school, area…" className="bg-card pl-8" />
          </div>
          <div className="w-full sm:w-44"><SelectField value={stage} onChange={setStage} options={[{ value: "", label: "All school stages" }, ...CLASS_STAGES.map((s) => ({ value: s, label: s }))]} /></div>
        </div>
      </div>
      {error ? <ErrorNote message={error} /> : !data ? <Loading /> : shown.length ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {shown.map((c) => {
            const cl = currentClass(c)
            const years = age(c.date_of_birth)
            return (
              <Link key={c.id} to={"/children/" + c.id} className="group rounded-xl focus-visible:outline-2 focus-visible:outline-ring">
                <Card className="h-full gap-0 py-0 transition-shadow group-hover:shadow-md">
                  <ChildPicture src={urls[c.photo_path]} child={c} className="aspect-[4/3] w-full" />
                  <div className="grid gap-1 p-3.5">
                    <p className="flex items-center gap-1.5 font-semibold"><span className="truncate">{fullName(c)}</span>{sponsored.has(c.id) && <HeartHandshakeIcon className="size-3.5 shrink-0 text-chart-2" aria-label="Sponsored" />}</p>
                    <p className="truncate text-xs text-muted-foreground">{[years !== "" ? `${years} yrs` : "", cl?.name].filter(Boolean).join(" · ") || "—"}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1"><CategoryBadge value={c.category} />{c.status !== "in_care" && <Badge variant="outline">{label(CHILD_STATUS, c.status)}{!isCurrent(c) && c.left_on ? ` · ${c.left_on.slice(0, 4)}` : ""}</Badge>}</div>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      ) : <Card className="py-14 text-center text-sm text-muted-foreground">{rows.length ? (byStatus.length ? "No children match these filters." : "No children with this status yet.") : "No children recorded yet. Use “Add child” to create the first record."}</Card>}
      <RecordDialog resource={RESOURCES.children} row={null} open={adding} onOpenChange={setAdding} onSaved={(saved) => { reload(); if (saved) navigate("/children/" + saved.id) }} />
    </Page>
  )
}

type Pic = { src: string; title: string; date?: string; photo?: Row }

export function ChildPage() {
  const { id } = useParams()
  const db = useDb()
  const navigate = useNavigate()
  const { data, error, reload } = useTables(["children", "child_events", "child_photos", "sponsorships", "donors"], {
    children: { eq: { id } }, child_events: { eq: { child_id: id }, order: "event_date" }, sponsorships: { eq: { child_id: id } }, child_photos: { eq: { child_id: id }, order: "taken_on", ascending: true },
  })
  const [editing, setEditing] = useState(false)
  const [entry, setEntry] = useState<{ open: boolean; row: Row | null }>({ open: false, row: null })
  const [photoEdit, setPhotoEdit] = useState<{ open: boolean; row: Row | null }>({ open: false, row: null })
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [viewer, setViewer] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [moving, setMoving] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const child = data?.children[0]
  const photos = useMemo(() => data?.child_photos || [], [data])
  useEffect(() => {
    if (!child) return
    db.privateUrls([child.photo_path, child.arrival_photo_path, ...photos.map((p) => p.path)]).then(setUrls).catch(() => setUrls({}))
  }, [child, photos, db])
  useEffect(() => { if (data && !child) navigate("/children") }, [data, child, navigate])

  // Everything the viewer can step through: then, now, and the gallery
  const pics: Pic[] = useMemo(() => !child ? [] : [
    ...(urls[child.arrival_photo_path] ? [{ src: urls[child.arrival_photo_path], title: "When they came", date: child.admission_date }] : []),
    ...(urls[child.photo_path] ? [{ src: urls[child.photo_path], title: "Now" }] : []),
    ...photos.filter((p) => urls[p.path]).map((p) => ({ src: urls[p.path], title: p.caption || "Photo", date: p.taken_on, photo: p })),
  ], [child, photos, urls])
  const open = (src: string) => setViewer(pics.findIndex((p) => p.src === src))

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return
    const room = MAX_PHOTOS - photos.length
    const list = [...files].slice(0, room)
    if (files.length > room) toast.message(`Only ${room} more photo${room === 1 ? "" : "s"} fit in the gallery, so the rest were skipped.`)
    const tooBig = list.find((f) => f.size > 8 * 1024 * 1024)
    if (tooBig) return toast.error(`${tooBig.name} is over 8 MB. Please choose a smaller one.`)
    setUploading(true)
    try {
      for (const f of list) await db.insert("child_photos", { child_id: id, path: await db.uploadPrivate(f, "children"), caption: "", taken_on: today() })
      toast.success(list.length === 1 ? "Photo added" : `${list.length} photos added`)
      reload()
    } catch (e) { toast.error("Upload failed: " + (e as Error).message) }
    setUploading(false)
    if (fileInput.current) fileInput.current.value = ""
  }

  const cl = child ? currentClass(child) : null
  const classText = !cl ? "" : !cl.auto ? cl.name : `${cl.name} · ${cl.stage}` + (child!.class_year < new Date().getFullYear() ? `\n(recorded as ${CLASS_TRACKS[child!.class_track].classes[child!.class_level] || "Finished"} in ${child!.class_year}, moved up automatically)` : "")
  const rows: [string, string][] = child ? [
    ["Age", age(child.date_of_birth) !== "" ? `${age(child.date_of_birth)} (born ${fmtDate(child.date_of_birth)})` : ""],
    ["Gender", capital(child.gender || "")], ["Admitted", fmtDate(child.admission_date)], ["Came through", label(REFERRAL, child.referral_channel)],
    ["Referral details", child.referral_details], ["Medical", child.medical_condition], ["School", child.school_name], ["Class", classText],
    ["Class details", child.school_class !== cl?.name ? child.school_class : ""], ["Guardian", [child.guardian_name, child.guardian_phone].filter(Boolean).join(" · ")], ["Home area", child.home_location], ["Notes", child.notes],
  ] : []

  return (
    <Page title={child ? fullName(child) : "Child"} actions={<>
      <Button variant="outline" asChild><Link to="/children"><ArrowLeftIcon /> All children</Link></Button>
      {child && (isCurrent(child)
        ? <Button variant="outline" onClick={() => setMoving(true)}><LogOutIcon /> Mark as moved on</Button>
        : <Button variant="outline" onClick={async () => {
            try { await db.update("children", child.id, { status: "in_care", left_on: null, leaving_note: "" }); toast.success("Back in care"); reload() }
            catch (e) { toast.error("Could not save: " + (e as Error).message) }
          }}><Undo2Icon /> Bring back into care</Button>)}
      <Button onClick={() => setEditing(true)} disabled={!child}><PencilIcon /> Edit details</Button></>}>
      {error ? <ErrorNote message={error} /> : !child ? <Loading /> : (
        <>
          {/* Then and now, with a few words about the child */}
          <Card className="gap-0 py-0 lg:flex-row">
            <div className="grid grid-cols-2 gap-2 p-3 lg:w-[460px] lg:shrink-0">
              {([["When they came", child.arrival_photo_path, child.admission_date ? fmtDate(child.admission_date) : ""], ["Now", child.photo_path, ""]] as const).map(([title, path, sub]) => (
                <figure key={title} className="grid gap-1.5">
                  {urls[path] ? <ChildPicture src={urls[path]} child={child} onClick={() => open(urls[path])} className="aspect-[3/4] w-full rounded-lg" />
                    : <button type="button" onClick={() => setEditing(true)} className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground hover:bg-muted/60">
                        <ImagePlusIcon className="size-6" />Add photo</button>}
                  <figcaption className="grid px-0.5 text-xs"><span className="font-medium">{title}</span><span className="text-muted-foreground">{sub || "Current photo"}</span></figcaption>
                </figure>
              ))}
            </div>
            <div className="grid content-start gap-3 border-t p-5 lg:border-l lg:border-t-0 lg:p-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">{fullName(child)}</h2>
                <p className="text-sm text-muted-foreground">{[age(child.date_of_birth) !== "" ? `${age(child.date_of_birth)} years old` : "", cl ? cl.name : "", child.admission_date ? (isCurrent(child) || !child.left_on ? `with us since ${fmtDate(child.admission_date)}` : `with us ${fmtDate(child.admission_date)} – ${fmtDate(child.left_on)}`) : ""].filter(Boolean).join(" · ")}</p>
              </div>
              <div className="flex flex-wrap gap-1.5"><CategoryBadge value={child.category} /><Badge variant="outline">{label(CHILD_STATUS, child.status)}</Badge></div>
              {!isCurrent(child) && (
                <div className="flex items-start gap-3 rounded-lg bg-muted/70 px-3.5 py-3 text-sm">
                  <MovedOnIcon status={child.status} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <p><span className="font-medium">{label(CHILD_STATUS, child.status)}{child.left_on ? ` on ${fmtDate(child.left_on)}` : ""}.</span>{child.leaving_note && ` ${child.leaving_note}`}
                    <span className="block text-muted-foreground">No longer counted as currently supported. Their records and photos are kept.</span></p>
                </div>
              )}
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">About</h3>
                {child.about ? <p className="max-w-prose whitespace-pre-wrap leading-relaxed">{child.about}</p>
                  : <p className="text-sm text-muted-foreground">No description yet. <button className="font-medium text-foreground underline underline-offset-2" onClick={() => setEditing(true)}>Add a few words</button> about their personality, interests and progress.</p>}
              </div>
            </div>
          </Card>

          {/* Gallery */}
          <Card>
            <CardHeader>
              <CardTitle>Gallery</CardTitle>
              <CardDescription>{photos.length} of {MAX_PHOTOS} photos · private, only the team can see them</CardDescription>
              <CardAction>
                <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => addPhotos(e.target.files)} />
                <Button size="sm" variant="outline" disabled={uploading || photos.length >= MAX_PHOTOS} onClick={() => fileInput.current?.click()}><ImagePlusIcon /> {uploading ? "Uploading…" : "Add photos"}</Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {photos.length ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {photos.map((p) => (
                    <figure key={p.id} className="grid gap-1.5">
                      <ChildPicture src={urls[p.path]} child={child} onClick={() => open(urls[p.path])} className="aspect-square w-full rounded-lg" />
                      <figcaption className="px-0.5 text-xs"><span className="block truncate font-medium">{p.caption || "No caption"}</span><span className="text-muted-foreground">{fmtDate(p.taken_on)}</span></figcaption>
                    </figure>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">No photos yet. Add up to {MAX_PHOTOS}, for example school days, birthdays and milestones.</p>}
            </CardContent>
          </Card>

          <div className="grid items-start gap-5 lg:grid-cols-[minmax(300px,1fr)_1.3fr]">
            <div className="grid gap-5">
            <Sponsorships mode="child" id={child.id} rows={data!.sponsorships} children={[child]} donors={data!.donors} onChanged={reload} />
            <Card>
              <CardHeader><CardTitle>Details</CardTitle></CardHeader>
              <CardContent>
                <dl className="divide-y">
                  {rows.filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[120px_1fr] gap-3 py-2.5 text-sm"><dt className="text-muted-foreground">{k}</dt><dd className="whitespace-pre-wrap">{v}</dd></div>
                  ))}
                </dl>
              </CardContent>
            </Card>
            </div>
            <Card>
              <CardHeader><CardTitle>Timeline</CardTitle><CardAction><Button size="sm" onClick={() => setEntry({ open: true, row: null })}><PlusIcon /> Add entry</Button></CardAction></CardHeader>
              <CardContent>
                {data!.child_events.length ? (
                  <ol className="ml-2 border-l-2 pl-5">
                    {data!.child_events.map((e) => (
                      <li key={e.id} className="relative mb-2">
                        <span className="absolute -left-[27px] top-3 size-3 rounded-full ring-4 ring-card" style={{ background: TL_COLOR[e.type] || TL_COLOR.other }} />
                        <button onClick={() => setEntry({ open: true, row: e })} className="w-full rounded-lg p-2 text-left hover:bg-muted/60">
                          <span className="block text-xs text-muted-foreground">{fmtDate(e.event_date)} · {label(EVENT_TYPES, e.type)}</span>
                          <span className="block font-medium">{e.title}</span>
                          {e.details && <span className="mt-1 block whitespace-pre-wrap text-sm text-muted-foreground">{e.details}</span>}
                        </button>
                      </li>
                    ))}
                  </ol>
                ) : <p className="text-sm text-muted-foreground">No entries yet. Add surgeries, follow-ups, school reports and case updates here.</p>}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <PhotoViewer pics={pics} index={viewer} setIndex={setViewer} childName={child ? fullName(child) : ""}
        onEdit={(p) => { setViewer(null); setPhotoEdit({ open: true, row: p }) }}
        onDelete={async (p) => {
          try { await db.remove("child_photos", p.id); await db.removePrivate(p.path).catch(() => {}); toast.success("Photo deleted"); setViewer(null); reload() }
          catch (e) { toast.error("Could not delete: " + (e as Error).message) }
        }} />
      {child && <RecordDialog resource={RESOURCES.children} row={child} open={editing} onOpenChange={setEditing} onSaved={(s) => (s ? reload() : navigate("/children"))} />}
      {child && <MoveOnDialog open={moving} onOpenChange={setMoving} child={child} onSaved={reload} />}
      <RecordDialog resource={RESOURCES.child_events} row={entry.row} open={entry.open} fixed={{ child_id: id }} onOpenChange={(o) => setEntry((x) => ({ ...x, open: o }))} onSaved={() => reload()} />
      <RecordDialog resource={RESOURCES.child_photos} row={photoEdit.row} open={photoEdit.open} fixed={{ child_id: id }} onOpenChange={(o) => setPhotoEdit((x) => ({ ...x, open: o }))}
        onRemoved={(p) => db.removePrivate(p.path).catch(() => {})} onSaved={() => reload()} />
    </Page>
  )
}

// Full-size photo with arrows to step through the child's pictures
function PhotoViewer({ pics, index, setIndex, childName, onEdit, onDelete }: {
  pics: Pic[]; index: number | null; setIndex: (i: number | null) => void; childName: string; onEdit: (p: Row) => void; onDelete: (p: Row) => void
}) {
  const pic = index != null ? pics[index] : null
  const step = (d: number) => index != null && pics.length > 1 && setIndex((index + d + pics.length) % pics.length)
  return (
    <Dialog open={!!pic} onOpenChange={(o) => !o && setIndex(null)}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl [&>[data-slot=dialog-close]]:z-10 [&>[data-slot=dialog-close]]:bg-white/90 [&>[data-slot=dialog-close]]:text-neutral-900 [&>[data-slot=dialog-close]]:hover:bg-white" onKeyDown={(e) => { if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1) }}>
        {pic && (
          <>
            <div className="relative flex items-center justify-center bg-neutral-950">
              <img src={pic.src} alt={`${childName}: ${pic.title}`} className="max-h-[72vh] w-full object-contain" />
              {pics.length > 1 && <>
                <Button size="icon" variant="secondary" aria-label="Previous photo" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full opacity-90" onClick={() => step(-1)}><ChevronLeftIcon /></Button>
                <Button size="icon" variant="secondary" aria-label="Next photo" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full opacity-90" onClick={() => step(1)}><ChevronRightIcon /></Button>
              </>}
            </div>
            <div className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate">{pic.title}</DialogTitle>
                <DialogDescription>{[pic.date ? fmtDate(pic.date) : "", `${index! + 1} of ${pics.length}`].filter(Boolean).join(" · ")}</DialogDescription>
              </div>
              {pic.photo && <>
                <Button size="sm" variant="outline" onClick={() => onEdit(pic.photo!)}><PencilIcon /> Edit caption</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(pic.photo!)}><Trash2Icon /> Delete</Button>
              </>}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

const MOVE_ON_CHOICES = [
  { value: "graduated", icon: GraduationCapIcon, title: "Finished school", text: "Completed their schooling with our support" },
  { value: "reintegrated", icon: HomeIcon, title: "Back with family", text: "Went home to a parent or relative" },
  { value: "exited", icon: LogOutIcon, title: "Left the programme", text: "Moved away or left for another reason" },
]
function MovedOnIcon({ status, className }: { status: string; className?: string }) {
  const Icon = MOVE_ON_CHOICES.find((c) => c.value === status)?.icon || LogOutIcon
  return <Icon className={className} />
}

// Finished school, back with family, or left: the child stays in the records
function MoveOnDialog({ open, onOpenChange, child, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; child: Row; onSaved: () => void }) {
  const db = useDb()
  const [status, setStatus] = useState("graduated")
  const [date, setDate] = useState(today())
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setStatus("graduated"); setDate(today()); setNote("") } }, [open])
  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await db.update("children", child.id, { status, left_on: date || null, leaving_note: note.trim() })
      toast.success(`${child.first_name}: ${label(CHILD_STATUS, status).toLowerCase()}`)
      onOpenChange(false); onSaved()
    } catch (ex) { toast.error("Could not save: " + (ex as Error).message) }
    setBusy(false)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{fullName(child)} has moved on</DialogTitle>
            <DialogDescription>They will no longer count as currently supported. Their records and photos are kept, and you can bring them back into care at any time.</DialogDescription>
          </DialogHeader>
          <div role="radiogroup" aria-label="How they moved on" className="grid gap-2">
            {MOVE_ON_CHOICES.map(({ value, icon: Icon, title, text }) => (
              <button key={value} type="button" role="radio" aria-checked={status === value} onClick={() => setStatus(value)}
                className={"flex items-center gap-3 rounded-lg border p-3 text-left transition-colors " + (status === value ? "border-primary bg-primary/5" : "hover:bg-muted/60")}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon className="size-4" /></span>
                <span className="flex-1"><span className="block text-sm font-medium">{title}</span><span className="block text-xs text-muted-foreground">{text}</span></span>
                {status === value && <CheckIcon className="size-4 text-primary" />}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <div className="grid gap-1.5"><Label htmlFor="mo_date">Date</Label><Input id="mo_date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="mo_note">Note (optional)</Label><Textarea id="mo_note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={status === "graduated" ? "e.g. Finished Form 4, now at college" : "e.g. Went home to an aunt in Narok"} /></div>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
