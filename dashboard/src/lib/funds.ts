import type { Row } from "./format"

// Donations recorded before donors were linked only carry the donor's name, so match on either
export const givenBy = (donor: Row) => (d: Row) =>
  d.donor_id === donor.id || (!d.donor_id && String(d.donor_name || "").trim().toLowerCase() === String(donor.name || "").trim().toLowerCase())

// Money in, money out and what is left for one donor (or for general funds when donor is null)
export function fundSummary(donor: Row | null, donations: Row[], expenses: Row[], until?: string) {
  const upTo = (date?: string) => !until || (!!date && date <= until)
  const gifts = (donor ? donations.filter(givenBy(donor)) : donations.filter((d) => !d.donor_id)).filter((d) => upTo(d.received_on))
  const spent = expenses.filter((e) => (donor ? e.donor_id === donor.id : !e.donor_id) && upTo(e.spent_on))
  const received = gifts.reduce((s, d) => s + Number(d.amount), 0)
  const used = spent.reduce((s, e) => s + Number(e.amount), 0)
  const sorted = [...gifts].sort((a, b) => (a.received_on < b.received_on ? 1 : -1))
  const lastForeign = sorted.find((d) => d.currency !== "KES" && d.exchange_rate)
  const foreign: Record<string, number> = {}
  gifts.filter((d) => d.currency !== "KES" && d.original_amount != null).forEach((d) => (foreign[d.currency] = (foreign[d.currency] || 0) + Number(d.original_amount)))
  return { gifts: sorted, spent, received, used, balance: received - used, last: sorted[0] || null, lastForeign: lastForeign || null, foreign }
}

// The rate used last time for this currency (to suggest it on the next donation)
export function lastRate(donations: Row[], currency: string, donorId?: string) {
  const list = donations.filter((d) => d.currency === currency && d.exchange_rate).sort((a, b) => (a.received_on < b.received_on ? 1 : -1))
  return (donorId && list.find((d) => d.donor_id === donorId)) || list[0] || null
}

// Spreadsheet download (opens in Excel or Google Sheets)
export function downloadCsv(name: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const blob = new Blob(["﻿" + [header, ...rows].map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" })
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
