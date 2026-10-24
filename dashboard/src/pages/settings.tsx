import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ErrorNote, Loading, Page } from "@/components/page"
import { useDb, useTables } from "@/lib/backend"

const GROUPS: [string, string, string[]][] = [
  ["Numbers on the website", "Years of service are worked out from the year founded.", ["founded_year", "children_supported", "girls_rescued"]],
  ["Contact details", "Shown in the website's header, footer and Contact page.", ["phone", "email"]],
  ["Donation details", "Shown on the Donate page. Each way of giving appears there only once its details are filled in; until then the page asks donors to call. Type the account name exactly as the bank has it.",
    ["mpesa_paybill", "mpesa_account", "paypal_email", "bank_name", "bank_account_name", "bank_account_number", "bank_branch", "bank_swift"]],
]

export function SettingsPage() {
  const db = useDb()
  const { data, error } = useTables(["site_settings"], { site_settings: { order: "key", ascending: true } })
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (data) setValues(Object.fromEntries(data.site_settings.map((s) => [s.key, s.value]))) }, [data])
  const byKey = Object.fromEntries((data?.site_settings || []).map((s) => [s.key, s]))
  async function save() {
    setSaving(true)
    try {
      for (const s of data!.site_settings) if ((values[s.key] ?? "").trim() !== s.value) { await db.saveSetting(s.key, values[s.key].trim()); s.value = values[s.key].trim() }
      toast.success("Saved. The website will show the new details.")
    } catch (e) { toast.error("Could not save: " + (e as Error).message) }
    setSaving(false)
  }
  return (
    <Page title="Stats & details" actions={<Button onClick={save} disabled={!data || saving}>{saving ? "Saving…" : "Save changes"}</Button>}>
      {error ? <ErrorNote message={error} /> : !data ? <Loading /> : (
        <div className="grid max-w-3xl gap-5">
          {GROUPS.map(([title, help, keys]) => (
            <Card key={title}>
              <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{help}</CardDescription></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {keys.filter((k) => byKey[k]).map((k) => (
                  <div key={k} className="grid gap-1.5"><Label htmlFor={"s_" + k}>{byKey[k].label}</Label>
                    <Input id={"s_" + k} value={values[k] ?? ""} inputMode={/year|supported|rescued|paybill|number/.test(k) ? "numeric" : undefined} onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))} /></div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </Page>
  )
}
