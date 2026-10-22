import type { Row } from "./format"

export type Option = { value: string; label: string }
export type Field = {
  name?: string
  label?: string
  section?: string
  type?: "text" | "textarea" | "select" | "checkbox" | "number" | "date" | "time" | "email" | "image" | "privateImage" | "class"
  required?: boolean
  options?: Option[]
  optionsFrom?: string
  help?: string
  rows?: number
  min?: number
  pattern?: string
  default?: unknown
}
export type Resource = {
  table: string
  title: string
  singular: string
  order?: string
  ascending?: boolean
  intro?: string
  columns?: [string, string][]
  fields: Field[]
}

// How a linked record is named in dropdowns and tables
export function lookupLabel(table: string, r: Record<string, any>) {
  if (table === "donors") return r.name + (r.organisation && r.organisation !== r.name ? ` (${r.organisation})` : "")
  if (table === "children") return `${r.first_name} ${r.last_name}`.trim()
  if (table === "outreach_visits") return `${r.school_name} (${r.visit_date})`
  return r.name || r.title || r.id
}
const opt = (pairs: [string, string][]): Option[] => pairs.map(([value, label]) => ({ value, label }))
export const label = (options: Option[] | undefined, value: unknown) => (options?.find((o) => o.value === value) || { label: String(value ?? "") }).label

export const CHILD_CATEGORY = opt([["disability", "Disability"], ["rescued_girl", "Rescued girl"], ["rescued_boy", "Rescued boy"], ["vulnerable", "Vulnerable home"]])
export const CHILD_STATUS = opt([["in_care", "In care at the home"], ["boarding_school", "At boarding school"], ["graduated", "Finished school"], ["reintegrated", "Back with family"], ["exited", "Left the programme"]])
// Currently supported vs. moved on (moved-on children stay in the records)
export const CURRENT_STATUSES = ["in_care", "boarding_school"]
export const MOVED_ON = ["graduated", "reintegrated", "exited"]
export const isCurrent = (c: { status?: string }) => CURRENT_STATUSES.includes(c.status || "")
export const REFERRAL = opt([["", "—"], ["chief", "Chief"], ["do", "District Officer"], ["dc", "District Commissioner"], ["court", "Court"], ["hospital", "Hospital"], ["school", "School"], ["family", "Family"], ["self", "Came on their own"], ["other", "Other"]])
export const EVENT_TYPES = opt([["medical", "Medical"], ["follow_up", "Follow-up"], ["school", "School"], ["case", "Case / legal"], ["other", "Other"]])
export const ITEMS = opt([["pads", "Sanitary pads"], ["panties", "Panties"], ["boxers", "Boxers"], ["balls", "Balls"], ["socks", "Socks"], ["books", "Books"], ["other", "Other"]])
export const CURRENCIES = opt([["KES", "KES – Kenya shilling"], ["USD", "USD – US dollar"], ["GBP", "GBP – British pound"], ["EUR", "EUR – Euro"]])
export const METHODS = opt([["bank", "Bank transfer"], ["mpesa", "M-Pesa"], ["paypal", "PayPal"], ["cash", "Cash"], ["in_kind", "In kind (goods)"]])
export const GIVING_PATTERN = opt([["", "Not sure yet"], ["one_off", "One-off"], ["monthly", "Monthly"], ["quarterly", "Quarterly"], ["twice_yearly", "Twice a year"], ["annual", "Once a year"]])
export const EXPENSE_CATEGORY = opt([["school_fees", "School fees"], ["school_items", "Uniform, books & school items"], ["medical", "Medical"], ["food", "Food"], ["clothing", "Clothing & bedding"],
  ["hygiene", "Sanitary & hygiene"], ["transport", "Transport"], ["utilities", "Water, power & rent"], ["building", "Building & repairs"], ["outreach", "School outreach"], ["admin", "Office & bank charges"], ["other", "Other"]])
// When the next gift is likely, from how often a donor gives and their last gift
const PATTERN_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, twice_yearly: 6, annual: 12 }
export function nextExpected(pattern: string, last?: string) {
  const months = PATTERN_MONTHS[pattern]
  if (!months || !last) return null
  const d = new Date(last + "T00:00:00")
  d.setMonth(d.getMonth() + months)
  return d
}

// Each child category keeps one colour everywhere (charts and badges)
export const CATEGORY_COLOR: Record<string, string> = { disability: "var(--chart-1)", vulnerable: "var(--chart-2)", rescued_girl: "var(--chart-3)", rescued_boy: "var(--chart-4)" }

// ── School classes that move up automatically every January ──
// Stored: class_track, class_level (position on its ladder), class_year (when it was set).
export const CLASS_TRACKS: Record<string, { label: string; classes: string[] }> = {
  cbc: { label: "CBC (PP1 to Grade 12)", classes: ["PP1", "PP2", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"] },
  "844": { label: "8-4-4 secondary (Form 1 to 4)", classes: ["Form 1", "Form 2", "Form 3", "Form 4"] },
  tertiary: { label: "College, TVET or university", classes: ["Year 1", "Year 2", "Year 3", "Year 4"] },
  special: { label: "Special needs unit (set by hand)", classes: [] },
  none: { label: "Not in school", classes: [] },
}
export const CLASS_STAGES = ["Pre-primary", "Primary", "Junior school", "Senior school", "Secondary", "College", "Special needs unit", "Not in school", "Finished school"]
function stageOf(track: string, name: string) {
  if (track === "special") return "Special needs unit"
  if (track === "none") return "Not in school"
  if (track === "844") return "Secondary"
  if (track === "tertiary") return "College"
  if (/^PP/.test(name)) return "Pre-primary"
  const g = Number((name.match(/Grade (\d+)/) || [])[1])
  return g <= 6 ? "Primary" : g <= 9 ? "Junior school" : "Senior school"
}
export type ClassInfo = { name: string; stage: string; level?: number; auto: boolean; finished?: boolean }
// The child's class in a given school year
export function classAt(c: Row, year: number): ClassInfo | null {
  const track = CLASS_TRACKS[c.class_track]
  if (!track) return null
  if (!track.classes.length) return { name: c.class_track === "special" ? c.school_class || "Special needs unit" : "Not in school", stage: stageOf(c.class_track, ""), auto: false }
  if (c.class_level == null || c.class_year == null) return null
  const n = c.class_level + Math.max(year - c.class_year, 0)
  if (n >= track.classes.length) return { name: "Finished " + track.classes[track.classes.length - 1], stage: "Finished school", level: track.classes.length, auto: true, finished: true }
  const name = track.classes[n]
  return { name, stage: stageOf(c.class_track, name), level: n, auto: true }
}
export const currentClass = (c: Row) => classAt(c, new Date().getFullYear())

// ── What each list page stores and shows ──
export const RESOURCES: Record<string, Resource> = {
  stories: {
    table: "stories", title: "Stories", singular: "story", order: "sort_order", ascending: true,
    intro: "Stories shown on the website. Only published stories are visible to the public.",
    columns: [["title", "Title"], ["child_name", "Child"], ["category", "Category"], ["published", "Published"]],
    fields: [
      { name: "title", label: "Title", required: true },
      { name: "slug", label: "Web address", required: true, help: "Lowercase words joined by dashes, e.g. from-risk-to-resilience", pattern: "[a-z0-9-]+" },
      { name: "child_name", label: "Child's name (as shown publicly)", help: "Use a first name or a changed name to protect the child." },
      { name: "age", label: "Age" },
      { name: "category", label: "Category", type: "select", options: opt([["rescue", "Rescue"], ["disability", "Disability"], ["education", "Education"], ["community", "Community"]]) },
      { name: "summary", label: "Short summary (for cards)", type: "textarea", rows: 3 },
      { name: "body", label: "Full story", type: "textarea", rows: 12, help: "Leave a blank line between paragraphs." },
      { name: "image_url", label: "Photo", type: "image" },
      { name: "featured", label: "Feature at the top of the Stories page", type: "checkbox" },
      { name: "published", label: "Published on the website", type: "checkbox" },
      { name: "sort_order", label: "Order", type: "number", help: "Lower numbers appear first." },
    ],
  },
  gallery_photos: {
    table: "gallery_photos", title: "Gallery", singular: "photo", order: "sort_order", ascending: true,
    intro: "Photos on the website gallery. Only use photos where the people shown are comfortable being public.",
    columns: [["image_url", "Photo"], ["caption", "Caption"], ["category", "Category"], ["published", "Published"]],
    fields: [
      { name: "image_url", label: "Photo", type: "image", required: true },
      { name: "caption", label: "Caption" },
      { name: "category", label: "Category", type: "select", options: opt([["home", "Life at the Home"], ["school", "School Outreach"], ["health", "Healthcare"]]) },
      { name: "published", label: "Show on the website", type: "checkbox", default: true },
      { name: "sort_order", label: "Order", type: "number" },
    ],
  },
  donations: {
    table: "donations", title: "Donations", singular: "donation", order: "received_on",
    fields: [],
  },
  donors: {
    table: "donors", title: "Donors", singular: "donor", order: "name", ascending: true,
    fields: [
      { name: "name", label: "Name", required: true },
      { name: "organisation", label: "Organisation" },
      { name: "giving_pattern", label: "Usually gives", type: "select", options: GIVING_PATTERN },
      { name: "currency", label: "Usually gives in", type: "select", options: CURRENCIES },
      { name: "email", label: "Email", type: "email" },
      { name: "phone", label: "Phone" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },
  volunteers: {
    table: "volunteers", title: "Volunteers", singular: "volunteer",
    intro: "Speakers, mentors, outreach helpers and donation-drive volunteers.",
    columns: [["name", "Name"], ["role", "Role"], ["status", "Status"], ["phone", "Phone"], ["email", "Email"]],
    fields: [
      { name: "name", label: "Name", required: true },
      { name: "role", label: "Role", type: "select", options: opt([["speaker", "Workshop speaker"], ["mentor", "Mentor & role model"], ["outreach", "School outreach"], ["donations", "Donation drives"], ["other", "Other"]]) },
      { name: "status", label: "Status", type: "select", options: opt([["new", "New"], ["contacted", "Contacted"], ["active", "Active"], ["inactive", "Inactive"]]) },
      { name: "phone", label: "Phone" },
      { name: "email", label: "Email", type: "email" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },
  outreach_visits: {
    table: "outreach_visits", title: "School visits", singular: "visit", order: "visit_date",
    intro: "Awareness visits to schools and communities.",
    columns: [["visit_date", "Date"], ["school_name", "School"], ["location", "Location"], ["girls_reached", "Girls"], ["boys_reached", "Boys"], ["parents_reached", "Parents"]],
    fields: [
      { name: "school_name", label: "School or community", required: true },
      { name: "location", label: "Location" },
      { name: "visit_date", label: "Date", type: "date", required: true },
      { name: "girls_reached", label: "Girls reached", type: "number", min: 0 },
      { name: "boys_reached", label: "Boys reached", type: "number", min: 0 },
      { name: "parents_reached", label: "Parents reached", type: "number", min: 0 },
      { name: "topics", label: "Topics covered", type: "textarea", rows: 2 },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },
  distributions: {
    table: "distributions", title: "Items handed out", singular: "entry", order: "distributed_on",
    intro: "Pads, panties, boxers, balls, socks, books and other items given to children.",
    columns: [["distributed_on", "Date"], ["item", "Item"], ["quantity", "Quantity"], ["visit_id", "Visit"]],
    fields: [
      { name: "item", label: "Item", type: "select", options: ITEMS },
      { name: "quantity", label: "Quantity", type: "number", required: true, min: 1 },
      { name: "distributed_on", label: "Date", type: "date", required: true },
      { name: "visit_id", label: "At school visit (optional)", type: "select", optionsFrom: "outreach_visits" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },
  children: {
    table: "children", title: "Children", singular: "child", order: "admission_date",
    fields: [
      { section: "Personal" },
      { name: "first_name", label: "First name", required: true },
      { name: "last_name", label: "Last name" },
      { name: "date_of_birth", label: "Date of birth", type: "date" },
      { name: "gender", label: "Gender", type: "select", options: opt([["", "—"], ["female", "Female"], ["male", "Male"]]) },
      { name: "about", label: "About", type: "textarea", rows: 3, help: "A short description: personality, interests, progress." },
      { section: "Photos (private)" },
      { name: "arrival_photo_path", label: "When they came", type: "privateImage" },
      { name: "photo_path", label: "Now", type: "privateImage" },
      { section: "Care" },
      { name: "category", label: "Category", type: "select", options: CHILD_CATEGORY },
      { name: "status", label: "Status", type: "select", options: CHILD_STATUS },
      { name: "admission_date", label: "Date admitted", type: "date" },
      { name: "left_on", label: "Date moved on", type: "date", help: "When they finished school, went home or left" },
      { name: "leaving_note", label: "Note on moving on", help: "e.g. Finished Form 4, now at college" },
      { name: "referral_channel", label: "Came through", type: "select", options: REFERRAL },
      { name: "referral_details", label: "Referral details", type: "textarea", rows: 2, help: "Case number, officer's name, court reference…" },
      { name: "medical_condition", label: "Medical condition", type: "textarea", rows: 2 },
      { section: "School" },
      { name: "school_name", label: "School" },
      { name: "class", label: "School system and class", type: "class" },
      { name: "school_class", label: "Class details (optional)", help: "e.g. the unit or level for a special needs class" },
      { section: "Family" },
      { name: "guardian_name", label: "Guardian" },
      { name: "guardian_phone", label: "Guardian's phone" },
      { name: "home_location", label: "Home area" },
      { section: "Other" },
      { name: "notes", label: "Notes", type: "textarea", rows: 4 },
    ],
  },
  sponsorships: {
    table: "sponsorships", title: "Sponsorships", singular: "sponsorship", order: "started_on",
    fields: [
      { name: "donor_id", label: "Sponsor", type: "select", optionsFrom: "donors", required: true },
      { name: "child_id", label: "Child", type: "select", optionsFrom: "children", required: true },
      { name: "started_on", label: "Since", type: "date" },
      { name: "ended_on", label: "Until (leave empty if ongoing)", type: "date" },
      { name: "amount", label: "Amount (optional)", type: "number", min: 0 },
      { name: "currency", label: "Currency", type: "select", options: CURRENCIES },
      { name: "frequency", label: "How often", type: "select", options: GIVING_PATTERN },
      { name: "notes", label: "Notes", type: "textarea", rows: 2, help: "e.g. Covers school fees and uniform" },
    ],
  },
  child_photos: {
    table: "child_photos", title: "Photos", singular: "photo", order: "taken_on",
    fields: [
      { name: "path", label: "Photo", type: "privateImage", required: true },
      { name: "caption", label: "Caption", help: "e.g. First day at school" },
      { name: "taken_on", label: "Date taken", type: "date" },
    ],
  },
  child_events: {
    table: "child_events", title: "Timeline", singular: "timeline entry",
    fields: [
      { name: "event_date", label: "Date", type: "date", required: true },
      { name: "type", label: "Type", type: "select", options: EVENT_TYPES },
      { name: "title", label: "What happened", required: true },
      { name: "details", label: "Details", type: "textarea", rows: 4 },
    ],
  },
  calendar_events: {
    table: "calendar_events", title: "Calendar", singular: "event",
    fields: [
      { name: "title", label: "What", required: true },
      { name: "kind", label: "Type", type: "select", options: opt([["meeting", "Staff meeting"], ["board", "Board meeting"], ["donor", "Donor visit"], ["event", "Community event"], ["holiday", "Holiday"], ["other", "Other"]]) },
      { name: "starts_on", label: "Date", type: "date", required: true },
      { name: "start_time", label: "Time (optional)", type: "time" },
      { name: "ends_on", label: "Ends on (for events over several days)", type: "date" },
      { name: "location", label: "Where" },
      { name: "notes", label: "Notes", type: "textarea", rows: 3 },
    ],
  },
}
