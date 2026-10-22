import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Trash2Icon, UploadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useDb } from "@/lib/backend"
import { CLASS_TRACKS, currentClass, lookupLabel, type Field, type Option, type Resource } from "@/lib/domain"
import { capital, friendly, siteImg, today, type Row } from "@/lib/format"

// Radix Select can't hold an empty value, so "" is stored as this placeholder while editing
const NONE = "__none__"

export function SelectField({ id, value, options, onChange, placeholder }: { id?: string; value: string; options: Option[]; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Select value={value === "" ? NONE : value} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger id={id} className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.value || NONE} value={o.value === "" ? NONE : o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

function ImageField({ field, value, onChange }: { field: Field; value: string; onChange: (v: string) => void }) {
  const db = useDb()
  const [preview, setPreview] = useState("")
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!value) return setPreview("")
    if (field.type === "privateImage") db.privateUrl(value).then(setPreview).catch(() => setPreview(""))
    else setPreview(siteImg(value))
  }, [value, field.type, db])
  return (
    <div className="flex items-center gap-3">
      {preview ? <img src={preview} alt="" className="h-16 w-20 rounded-md object-cover" /> : <div className="flex h-16 w-20 items-center justify-center rounded-md bg-muted text-muted-foreground"><UploadIcon className="size-5" /></div>}
      <Input type="file" accept="image/*" disabled={busy} onChange={async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.size > 8 * 1024 * 1024) { toast.error("That photo is over 8 MB. Please choose a smaller one."); e.target.value = ""; return }
        setBusy(true)
        try {
          onChange(field.type === "privateImage" ? await db.uploadPrivate(file, "children") : await db.uploadPublic(file))
          toast.success("Photo uploaded")
        } catch (err) { toast.error("Upload failed: " + (err as Error).message) }
        setBusy(false)
      }} />
    </div>
  )
}

// School system + class this year. Saving unchanged keeps the yearly move-up going.
function ClassField({ values, set }: { values: Row; set: (patch: Row) => void }) {
  const track = CLASS_TRACKS[values.class_track]
  const list = track?.classes || []
  const options = [...list.map((name, i) => ({ value: String(i), label: name })), ...(list.length ? [{ value: String(list.length), label: "Finished " + list[list.length - 1] }] : [])]
  return (
    <div className={"grid gap-2 " + (list.length ? "sm:grid-cols-[1.4fr_1fr]" : "")}>
      <SelectField id="f_class_track" value={values.class_track || ""} placeholder="Not recorded"
        options={[{ value: "", label: "— Not recorded —" }, ...Object.entries(CLASS_TRACKS).map(([value, t]) => ({ value, label: t.label }))]}
        onChange={(v) => set({ class_track: v, _class_level: CLASS_TRACKS[v]?.classes.length ? "0" : "" })} />
      {list.length > 0 && <SelectField id="f_class_level" value={values._class_level ?? ""} options={options} onChange={(v) => set({ _class_level: v })} />}
    </div>
  )
}

export function RecordDialog({ resource, row, open, onOpenChange, onSaved, onRemoved, fixed, initial }: {
  resource: Resource; row: Row | null; open: boolean; onOpenChange: (o: boolean) => void; onSaved: (saved: Row | null) => void; onRemoved?: (row: Row) => void; fixed?: Row; initial?: Row
}) {
  const db = useDb()
  const editing = Boolean(row)
  const [values, setValues] = useState<Row>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [lookups, setLookups] = useState<Record<string, Option[]>>({})

  const fields = resource.fields
  const year = new Date().getFullYear()
  useEffect(() => {
    if (!open) return
    const start: Row = {}
    for (const f of fields) if (f.name && f.type !== "class") start[f.name] = row ? row[f.name] ?? "" : f.default ?? (f.type === "date" && f.required ? today() : f.type === "checkbox" ? false : f.type === "select" && f.options?.length ? f.options[0].value : "")
    if (fields.some((f) => f.type === "class")) {
      const cur = row ? currentClass(row) : null
      start.class_track = row?.class_track || ""
      start._class_level = cur?.auto ? String(cur.level) : ""
      start._orig = { track: start.class_track, level: start._class_level }
    }
    setValues({ ...start, ...(initial || {}) })
    setError("")
    for (const f of fields.filter((f) => f.optionsFrom)) {
      db.list(f.optionsFrom!).then((rows) => setLookups((l) => ({ ...l, [f.name!]: [{ value: "", label: "—" }, ...rows.map((r) => ({ value: r.id, label: lookupLabel(f.optionsFrom!, r) })).sort((a, b) => a.label.localeCompare(b.label))] })))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, row, fields, db, JSON.stringify(initial ?? null)])

  const set = (patch: Row) => setValues((v) => ({ ...v, ...patch }))
  const required = useMemo(() => fields.filter((f) => f.required && f.name), [fields])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const missing = required.find((f) => f.type !== "image" ? values[f.name!] === "" || values[f.name!] == null : !values[f.name!])
    if (missing) return setError(`Please fill in “${missing.label}”.`)
    const data: Row = {}
    for (const f of fields) {
      if (!f.name) continue
      if (f.type === "class") {
        const track = values.class_track
        const hasLadder = (CLASS_TRACKS[track]?.classes || []).length > 0
        const level = hasLadder && values._class_level !== "" ? Number(values._class_level) : null
        data.class_track = track
        if (row && track === values._orig.track && String(values._class_level) === values._orig.level && row.class_year != null) {
          data.class_level = row.class_level; data.class_year = row.class_year // keep the automatic move-up going
        } else {
          data.class_level = level; data.class_year = hasLadder ? year : null
        }
        continue
      }
      const v = values[f.name]
      data[f.name] = f.type === "checkbox" ? Boolean(v) : f.type === "number" ? (v === "" ? 0 : Number(v)) : f.type === "date" ? v || null : f.optionsFrom ? v || null : typeof v === "string" ? v.trim() : v
    }
    setSaving(true)
    try {
      const saved = editing ? await db.update(resource.table, row!.id, { ...data, ...fixed }) : await db.insert(resource.table, { ...data, ...fixed })
      toast.success(editing ? "Changes saved" : `${capital(resource.singular)} added`)
      onOpenChange(false)
      onSaved(saved)
    } catch (err) {
      setError("Could not save: " + friendly((err as Error).message))
    }
    setSaving(false)
  }

  async function remove() {
    try {
      await db.remove(resource.table, row!.id)
      onRemoved?.(row!)
      toast.success(`${capital(resource.singular)} deleted`)
      setConfirmDelete(false); onOpenChange(false); onSaved(null)
    } catch (err) { setError("Could not delete: " + friendly((err as Error).message)) }
  }

  const input = (f: Field) => {
    const id = "f_" + f.name
    const v = values[f.name!] ?? ""
    switch (f.type) {
      case "textarea": return <Textarea id={id} rows={f.rows || 3} value={v} onChange={(e) => set({ [f.name!]: e.target.value })} />
      case "select": return <SelectField id={id} value={String(v ?? "")} options={f.optionsFrom ? lookups[f.name!] || [] : f.options!} onChange={(x) => set({ [f.name!]: x })} />
      case "image": case "privateImage": return <ImageField field={f} value={v} onChange={(x) => set({ [f.name!]: x })} />
      case "class": return <ClassField values={values} set={set} />
      default: return <Input id={id} type={f.type || "text"} value={v} min={f.min} pattern={f.pattern} step={f.type === "number" ? "any" : undefined} onChange={(e) => set({ [f.name!]: e.target.value })} />
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={save} className="grid gap-5">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit" : "Add"} {resource.singular}</DialogTitle>
              <DialogDescription className="sr-only">Fill in the details and save.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
              {fields.map((f, i) => f.section ? (
                <p key={"s" + i} className="col-span-full -mb-1 mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{f.section}</p>
              ) : f.type === "checkbox" ? (
                <label key={f.name} className="col-span-full flex items-center gap-2.5 text-sm font-medium">
                  <Checkbox checked={Boolean(values[f.name!])} onCheckedChange={(c) => set({ [f.name!]: c === true })} /> {f.label}
                </label>
              ) : (
                <div key={f.name} className={"grid gap-1.5 " + (["textarea", "image", "class"].includes(f.type || "") || (f.type === "privateImage" && fields.filter((x) => x.type === "privateImage").length === 1) ? "col-span-full" : "")}>
                  <Label htmlFor={"f_" + (f.type === "class" ? "class_track" : f.name)}>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
                  {input(f)}
                  {f.type === "class" && CLASS_TRACKS[values.class_track]?.classes.length ? <p className="text-xs text-muted-foreground">Class in {year}. It moves up automatically every January; change it here if the child repeats or skips a year.</p> : null}
                  {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
                </div>
              ))}
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter className="gap-2 sm:justify-between">
              {editing ? <Button type="button" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)}><Trash2Icon /> Delete</Button> : <span />}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {resource.singular}?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={remove}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
