export type Row = Record<string, any>

export const money = (n: number | string) => "KES " + Number(n || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })
// An amount in its own currency, e.g. "USD 1,250"
export const cash = (n: number | string, currency = "KES") => currency === "KES" ? money(n) : `${currency} ${Number(n || 0).toLocaleString("en-GB", { maximumFractionDigits: 2 })}`
export const rate = (n: number | string) => Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 4 })
export const fmtDate = (d?: string | null) =>
  d ? new Date(d.length === 10 ? d + "T00:00:00" : d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""
export const shortDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })
export const longDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
export const today = () => iso(new Date())
export const thisYear = (d?: string | null) => !!d && new Date(d).getFullYear() === new Date().getFullYear()
export function age(dob?: string | null): number | "" {
  if (!dob) return ""
  const b = new Date(dob + "T00:00:00"), n = new Date()
  let a = n.getFullYear() - b.getFullYear()
  if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--
  return a
}
// Photos saved as site paths ("images/…") live one folder up from /admin/
export const siteImg = (url?: string) => (!url || /^(https?:|blob:|data:|\/|\.\.\/)/.test(url) ? url || "" : "../" + url)
export const initials = (first = "", last = "") => ((first[0] || "?") + (last[0] || "")).toUpperCase()
export const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export function friendly(msg: string) {
  if (/duplicate key.*slug/i.test(msg)) return "another story already uses that web address."
  if (/stories_slug/i.test(msg)) return "the web address can only use lowercase letters, numbers and dashes."
  if (/row-level security/i.test(msg)) return "your account is not allowed to do this."
  return msg
}
