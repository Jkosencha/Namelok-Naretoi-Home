// Reports: monthly / quarterly / annual / custom reports built from the dashboard's
// records, saved with their figures, printable to PDF. Old reports can be uploaded.
// Donor reports only ever show totals, never a child's name.
import { donut, columns, lineChart, dataTable } from "./charts.js?v=3";

export function createReports(ctx) {
  const { h, icon, money, fmtDate, toast, setPage, db, CHILD_CATEGORY, classAt, friendly } = ctx;

  const KINDS = { monthly: "Monthly", quarterly: "Quarterly", annual: "Annual", custom: "Custom" };
  const STAGES = ["Pre-primary", "Primary", "Junior school", "Senior school", "Secondary", "College", "Special needs unit"];
  const ITEMS = { pads: "Sanitary pads", panties: "Panties", boxers: "Boxers", balls: "Balls", socks: "Socks", books: "Books", other: "Other items" };
  const METHODS = { mpesa: "M-Pesa", bank: "Bank transfer", paypal: "PayPal", cash: "Cash", in_kind: "In kind" };
  const EVENTS = { medical: "Medical treatment", follow_up: "Follow-ups", school: "School updates", case: "Case / legal updates", other: "Other" };
  const catLabel = (v) => (CHILD_CATEGORY.find((o) => o.value === v) || {}).label || v;
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const longDate = (s) => new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const paras = (text) => (text || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => h("p", {}, p));
  const count = (rows, key) => rows.reduce((m, r) => ((m[r[key]] = (m[r[key]] || 0) + 1), m), {});

  // ── Periods ──
  function periodFor(kind, v) {
    if (kind === "monthly") {
      const [y, m] = v.month.split("-").map(Number);
      return { start: iso(new Date(y, m - 1, 1)), end: iso(new Date(y, m, 0)) };
    }
    if (kind === "quarterly") {
      const q = Number(v.quarter), y = Number(v.year);
      return { start: iso(new Date(y, (q - 1) * 3, 1)), end: iso(new Date(y, q * 3, 0)) };
    }
    if (kind === "annual") return { start: `${v.year}-01-01`, end: `${v.year}-12-31` };
    return { start: v.start, end: v.end };
  }
  function titleFor(kind, start, end, donorName) {
    const s = new Date(start + "T00:00:00"), e = new Date(end + "T00:00:00");
    const base =
      kind === "monthly" ? `Monthly report – ${s.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`
      : kind === "quarterly" ? `Quarterly report – Q${Math.floor(s.getMonth() / 3) + 1} ${s.getFullYear()} (${s.toLocaleDateString("en-GB", { month: "short" })}–${e.toLocaleDateString("en-GB", { month: "short" })})`
      : kind === "annual" ? `Annual report ${s.getFullYear()}`
      : `Report – ${fmtDate(start)} to ${fmtDate(end)}`;
    return donorName ? `${base} for ${donorName}` : base;
  }

  // ── Figures for a period (saved with the report) ──
  async function computeFigures(start, end, donor) {
    const [children, events, donations, visits, items, volunteers] = await Promise.all(
      ["children", "child_events", "donations", "outreach_visits", "distributions", "volunteers"].map((t) => db().list(t))
    );
    const today = iso(new Date());
    const within = (d) => d && d.slice(0, 10) >= start && d.slice(0, 10) <= end;
    const endYear = Number(end.slice(0, 4));
    const admitted = children.filter((c) => within(c.admission_date));
    // Children in care at the end of the period (by admission date and their current status)
    const inCare = children.filter((c) => (c.admission_date || c.created_at.slice(0, 10)) <= end && ["in_care", "boarding_school"].includes(c.status));
    const stages = {};
    inCare.forEach((c) => { const cl = classAt(c, endYear); if (cl && STAGES.includes(cl.stage)) stages[cl.stage] = (stages[cl.stage] || 0) + 1; });
    const matchesDonor = (d) => !donor || d.donor_id === donor.id || (d.donor_name || "").trim().toLowerCase() === donor.name.trim().toLowerCase();
    const gifts = donations.filter((d) => within(d.received_on) && matchesDonor(d));
    const byMonth = {};
    gifts.forEach((d) => { const k = d.received_on.slice(0, 7); byMonth[k] = (byMonth[k] || 0) + Number(d.amount); });
    const sumBy = (rows, key, val) => rows.reduce((m, r) => ((m[r[key] || "Other"] = (m[r[key] || "Other"] || 0) + val(r)), m), {});
    const held = visits.filter((v) => within(v.visit_date) && v.visit_date <= today);
    const itemTotals = sumBy(items.filter((i) => within(i.distributed_on)), "item", (i) => i.quantity);
    return {
      generated_at: new Date().toISOString(),
      children: {
        admitted: count(admitted, "category"), admitted_total: admitted.length,
        in_care: count(inCare, "category"), in_care_total: inCare.length, stages,
      },
      events: count(events.filter((e) => within(e.event_date) && e.event_date <= today), "type"),
      donations: {
        total: gifts.reduce((s, d) => s + Number(d.amount), 0), count: gifts.length,
        by_method: sumBy(gifts, "method", (d) => Number(d.amount)),
        by_purpose: sumBy(gifts, "purpose", (d) => Number(d.amount)),
        by_month: byMonth,
        top_donors: donor ? [] : Object.entries(sumBy(gifts, "donor_name", (d) => Number(d.amount))).sort((a, b) => b[1] - a[1]).slice(0, 5),
        list: donor ? gifts.sort((a, b) => (a.received_on < b.received_on ? -1 : 1)).map((d) => [d.received_on, Number(d.amount), METHODS[d.method] || d.method, d.purpose || ""]) : [],
      },
      outreach: {
        visits: held.length,
        girls: held.reduce((s, v) => s + v.girls_reached, 0),
        boys: held.reduce((s, v) => s + v.boys_reached, 0),
        parents: held.reduce((s, v) => s + v.parents_reached, 0),
        list: held.sort((a, b) => (a.visit_date < b.visit_date ? -1 : 1)).map((v) => [v.visit_date, v.school_name, v.location || "", v.girls_reached + v.boys_reached]),
      },
      items: itemTotals,
      volunteers: { joined: volunteers.filter((v) => within(v.created_at)).length, active: volunteers.filter((v) => v.status === "active").length },
    };
  }

  // ── List of saved reports ──
  async function viewList(view) {
    const rows = await db().list("reports", { order: "period_start" });
    setPage("Reports", [
      h("button", { class: "btn", onclick: () => uploadForm(() => viewList(view)) }, icon("upload", 16), "Upload a report"),
      h("a", { class: "btn btn-primary", href: "#reports/new" }, icon("plus", 16), "New report"),
    ]);
    const search = h("input", { type: "search", class: "search", placeholder: "Search reports…" });
    const kindSel = h("select", { "aria-label": "Type" }, h("option", { value: "" }, "All types"), Object.entries(KINDS).map(([k, t]) => h("option", { value: k }, t)));
    const years = [...new Set(rows.map((r) => r.period_start.slice(0, 4)))].sort().reverse();
    const yearSel = h("select", { "aria-label": "Year" }, h("option", { value: "" }, "All years"), years.map((y) => h("option", { value: y }, y)));
    const tbody = h("tbody");
    const draw = () => {
      const q = search.value.toLowerCase();
      const shown = rows.filter((r) => (!q || (r.title + " " + r.donor_name).toLowerCase().includes(q)) && (!kindSel.value || r.kind === kindSel.value) && (!yearSel.value || r.period_start.startsWith(yearSel.value)));
      tbody.replaceChildren(...(shown.length ? shown.map((r) => h("tr", { tabindex: 0, onclick: () => (location.hash = "#reports/" + r.id), onkeydown: (e) => e.key === "Enter" && (location.hash = "#reports/" + r.id) },
        h("td", { "data-label": "Report" }, h("span", { class: "report-title-cell" }, icon(r.file_name ? "file" : "report", 16), r.title)),
        h("td", { "data-label": "Period" }, `${fmtDate(r.period_start)} – ${fmtDate(r.period_end)}`),
        h("td", { "data-label": "For" }, r.donor_name || "All donors"),
        h("td", { "data-label": "Type" }, KINDS[r.kind]),
        h("td", { "data-label": "Status" }, h("span", { class: `badge ${r.status === "final" ? "badge-yes" : "badge-new"}` }, r.status === "final" ? "Final" : "Draft"))
      )) : [h("tr", {}, h("td", { colspan: 5, class: "empty" }, rows.length ? "No reports match." : "No reports yet. Use “New report” to make the first one."))]));
    };
    [search, kindSel, yearSel].forEach((el) => el.addEventListener("input", draw));
    view.replaceChildren(
      h("p", { class: "intro" }, "Reports are built from the dashboard's records for the period you choose, and saved with their figures so they never change after you send them. Donor reports show totals only, never a child's name."),
      h("div", { class: "toolbar" }, search, kindSel, yearSel),
      h("div", { class: "table-wrap" }, h("table", { class: "data-table" }, h("thead", {}, h("tr", {}, ["Report", "Period", "For", "Type", "Status"].map((t) => h("th", {}, t)))), tbody))
    );
    draw();
  }

  // ── New / edit report ──
  async function viewForm(view, id) {
    const existing = id ? (await db().list("reports", { eq: { id } }))[0] : null;
    const donors = await db().list("donors", { order: "name", ascending: true });
    setPage(existing ? "Edit report" : "New report", [h("a", { class: "btn", href: existing ? "#reports/" + id : "#reports" }, "Cancel")]);
    const last = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const y = new Date().getFullYear();
    const kind = h("select", { id: "r_kind" }, Object.entries(KINDS).map(([k, t]) => h("option", { value: k, selected: (existing?.kind || "monthly") === k }, t)));
    const month = h("input", { type: "month", id: "r_month", value: existing?.period_start.slice(0, 7) || iso(last).slice(0, 7) });
    const qYear = h("select", { id: "r_qyear" }, [y, y - 1, y - 2, y - 3].map((v) => h("option", { value: v }, v)));
    const quarter = h("select", { id: "r_quarter" }, [1, 2, 3, 4].map((q) => h("option", { value: q, selected: q === Math.max(1, Math.floor(new Date().getMonth() / 3)) }, `Q${q}`)));
    const aYear = h("select", { id: "r_ayear" }, [y, y - 1, y - 2, y - 3, y - 4].map((v) => h("option", { value: v, selected: v === y - 1 }, v)));
    const cStart = h("input", { type: "date", id: "r_start", value: existing?.period_start || iso(last) });
    const cEnd = h("input", { type: "date", id: "r_end", value: existing?.period_end || iso(new Date(y, new Date().getMonth(), 0)) });
    if (existing?.kind === "quarterly") { qYear.value = existing.period_start.slice(0, 4); quarter.value = Math.floor(Number(existing.period_start.slice(5, 7)) / 3) + 1; }
    if (existing?.kind === "annual") aYear.value = existing.period_start.slice(0, 4);
    const pick = {
      monthly: h("div", { class: "field" }, h("label", { for: "r_month" }, "Month"), month),
      quarterly: h("div", { class: "field" }, h("label", { for: "r_quarter" }, "Quarter"), h("div", { class: "pair" }, quarter, qYear)),
      annual: h("div", { class: "field" }, h("label", { for: "r_ayear" }, "Year"), aYear),
      custom: h("div", { class: "field" }, h("label", { for: "r_start" }, "From – to"), h("div", { class: "pair" }, cStart, cEnd)),
    };
    const periodBox = h("div", {});
    const showPeriod = () => periodBox.replaceChildren(pick[kind.value]);
    kind.addEventListener("change", showPeriod);
    showPeriod();
    const donorSel = h("select", { id: "r_donor" }, h("option", { value: "" }, "All donors (general report)"), donors.map((d) => h("option", { value: d.id, selected: existing?.donor_id === d.id }, d.name + (d.organisation && d.organisation !== d.name ? ` (${d.organisation})` : ""))));
    const area = (name, label, help) => h("div", { class: "field field-wide" }, h("label", { for: "r_" + name }, label), h("textarea", { id: "r_" + name, rows: name === "summary" ? 5 : 4 }, existing?.[name] || ""), help ? h("small", {}, help) : "");
    const err = h("p", { class: "form-error", role: "alert" });
    const save = h("button", { class: "btn btn-primary", type: "submit" }, existing ? "Save changes" : "Create report");
    const form = h("form", { class: "panel form-panel report-form", onsubmit: async (e) => {
        e.preventDefault();
        err.textContent = "";
        const v = { month: month.value, quarter: quarter.value, year: kind.value === "annual" ? aYear.value : qYear.value, start: cStart.value, end: cEnd.value };
        if (kind.value === "monthly" && !v.month) return (err.textContent = "Choose a month.");
        if (kind.value === "custom" && (!v.start || !v.end || v.end < v.start)) return (err.textContent = "Choose a start date and an end date after it.");
        const { start, end } = periodFor(kind.value, v);
        const donor = donors.find((d) => d.id === donorSel.value) || null;
        const periodChanged = !existing || existing.period_start !== start || existing.period_end !== end || (existing.donor_id || "") !== (donor?.id || "");
        save.disabled = true; save.textContent = "Working out the figures…";
        try {
          const row = {
            kind: kind.value, period_start: start, period_end: end, donor_id: donor?.id || null, donor_name: donor?.name || "",
            title: existing && !periodChanged ? existing.title : titleFor(kind.value, start, end, donor?.name),
            summary: form.querySelector("#r_summary").value.trim(), highlights: form.querySelector("#r_highlights").value.trim(),
            challenges: form.querySelector("#r_challenges").value.trim(), next_steps: form.querySelector("#r_next_steps").value.trim(),
          };
          if (periodChanged || !existing?.figures) row.figures = await computeFigures(start, end, donor);
          const saved = existing ? await db().update("reports", existing.id, row) : await db().insert("reports", { ...row, status: "draft" });
          toast(existing ? "Report saved" : "Report created");
          location.hash = "#reports/" + saved.id;
        } catch (ex) {
          err.textContent = "Could not save: " + friendly(ex.message);
          save.disabled = false; save.textContent = existing ? "Save changes" : "Create report";
        }
      } },
      h("fieldset", {}, h("legend", {}, "Period and audience"),
        h("div", { class: "field" }, h("label", { for: "r_kind" }, "Type of report"), kind),
        periodBox,
        h("div", { class: "field field-wide" }, h("label", { for: "r_donor" }, "Prepared for"), donorSel, h("small", {}, "Choose a donor to show only their donations. Children and outreach figures are always totals for the whole home."))),
      h("fieldset", {}, h("legend", {}, "Your words"),
        area("summary", "Summary", "A short overview of the period. Leave a blank line between paragraphs."),
        area("highlights", "Highlights", "Good news, milestones, thank-yous."),
        area("challenges", "Challenges"),
        area("next_steps", "Plans for the next period")),
      err,
      h("div", { class: "form-actions" }, save)
    );
    view.replaceChildren(form);
  }

  // ── Upload an existing report file ──
  function uploadForm(onDone) {
    const y = new Date().getFullYear();
    const dlg = h("dialog", { class: "modal" });
    const err = h("p", { class: "form-error", role: "alert" });
    const file = h("input", { type: "file", id: "u_file", required: true, accept: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt" });
    const form = h("form", { onsubmit: async (e) => {
        e.preventDefault();
        if (!form.reportValidity()) return;
        const f = file.files[0];
        if (f.size > 20 * 1024 * 1024) return (err.textContent = "That file is over 20 MB. Please upload a smaller copy.");
        const start = form.querySelector("#u_start").value, end = form.querySelector("#u_end").value;
        if (end < start) return (err.textContent = "The end date must be after the start date.");
        const btn = form.querySelector("[type=submit]"); btn.disabled = true; btn.textContent = "Uploading…";
        try {
          const path = await db().uploadDocument(f, "reports");
          await db().insert("reports", { title: form.querySelector("#u_title").value.trim(), kind: form.querySelector("#u_kind").value, period_start: start, period_end: end,
            donor_id: null, donor_name: form.querySelector("#u_donor").value.trim(), status: "final", file_path: path, file_name: f.name });
          dlg.close(); toast("Report uploaded"); onDone();
        } catch (ex) { err.textContent = "Could not upload: " + friendly(ex.message); btn.disabled = false; btn.textContent = "Upload"; }
      } },
      h("header", { class: "modal-head" }, h("h2", {}, "Upload a report"), h("button", { type: "button", class: "btn btn-ghost", "aria-label": "Close", onclick: () => dlg.close() }, "×")),
      h("div", { class: "modal-body" },
        h("div", { class: "field field-wide" }, h("label", { for: "u_file" }, "File (PDF, Word, Excel or PowerPoint, up to 20 MB)"), file),
        h("div", { class: "field field-wide" }, h("label", { for: "u_title" }, "Title", h("span", { class: "req" }, " *")), h("input", { id: "u_title", required: true, placeholder: "e.g. Annual report 2024" })),
        h("div", { class: "field" }, h("label", { for: "u_kind" }, "Type"), h("select", { id: "u_kind" }, Object.entries(KINDS).map(([k, t]) => h("option", { value: k }, t)))),
        h("div", { class: "field" }, h("label", { for: "u_donor" }, "Prepared for (optional)"), h("input", { id: "u_donor", placeholder: "Donor name" })),
        h("div", { class: "field" }, h("label", { for: "u_start" }, "Period from"), h("input", { type: "date", id: "u_start", required: true, value: `${y - 1}-01-01` })),
        h("div", { class: "field" }, h("label", { for: "u_end" }, "to"), h("input", { type: "date", id: "u_end", required: true, value: `${y - 1}-12-31` }))
      ),
      h("footer", { class: "modal-foot" }, err, h("span", { class: "spacer" }), h("button", { type: "button", class: "btn", onclick: () => dlg.close() }, "Cancel"), h("button", { type: "submit", class: "btn btn-primary" }, "Upload"))
    );
    file.addEventListener("change", () => { const t = form.querySelector("#u_title"); if (!t.value && file.files[0]) t.value = file.files[0].name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "); });
    dlg.append(form);
    dlg.addEventListener("close", () => dlg.remove());
    document.body.append(dlg);
    dlg.showModal();
  }

  // ── One report ──
  async function viewReport(view, id) {
    const r = (await db().list("reports", { eq: { id } }))[0];
    if (!r) { location.hash = "#reports"; return; }
    const reload = () => viewReport(view, id);
    const isFile = Boolean(r.file_name) && !r.figures && !r.summary;
    const actions = [h("a", { class: "btn", href: "#reports" }, "← All reports")];
    if (isFile) {
      actions.push(h("button", { class: "btn btn-primary", onclick: async () => {
        try { const url = await db().documentUrl(r.file_path, r.file_name); if (url) window.open(url, "_blank", "noopener"); else toast("This demo report has no file attached.", "error"); }
        catch (ex) { toast("Could not open the file: " + ex.message, "error"); }
      } }, icon("download", 16), "Download"));
    } else {
      if (r.status === "draft") actions.push(h("a", { class: "btn", href: `#reports/${id}/edit` }, "Edit"));
      if (r.status === "draft") actions.push(h("button", { class: "btn", title: "Recount the figures from the latest records", onclick: async () => {
        await db().update("reports", id, { figures: await computeFigures(r.period_start, r.period_end, r.donor_id ? { id: r.donor_id, name: r.donor_name } : null) });
        toast("Figures updated"); reload();
      } }, "Update figures"));
      actions.push(h("button", { class: "btn", onclick: async () => {
        await db().update("reports", id, { status: r.status === "final" ? "draft" : "final" });
        toast(r.status === "final" ? "Back to draft" : "Marked as final"); reload();
      } }, r.status === "final" ? "Back to draft" : "Mark as final"));
      actions.push(h("button", { class: "btn btn-primary", onclick: () => window.print() }, icon("print", 16), "Print / Save PDF"));
    }
    actions.push(h("button", { class: "btn btn-danger", onclick: async () => {
      if (!confirm("Delete this report? This cannot be undone.")) return;
      await db().remove("reports", id); toast("Report deleted"); location.hash = "#reports";
    } }, "Delete"));
    setPage(r.title, actions);

    if (isFile) {
      view.replaceChildren(h("section", { class: "panel file-card" },
        h("span", { class: "file-icon" }, icon("file", 28)),
        h("div", {}, h("h2", {}, r.file_name), h("p", { class: "muted" }, `${KINDS[r.kind]} report · ${fmtDate(r.period_start)} – ${fmtDate(r.period_end)}${r.donor_name ? " · for " + r.donor_name : ""}`), h("p", { class: "muted" }, "Uploaded file. Use Download to open it."))));
      return;
    }
    let f = r.figures;
    let liveNote = "";
    if (!f) { f = await computeFigures(r.period_start, r.period_end, r.donor_id ? { id: r.donor_id, name: r.donor_name } : null); liveNote = "Figures worked out just now from the latest records."; }
    view.replaceChildren(
      r.status === "draft" ? h("p", { class: "intro draft-note" }, "Draft: check the figures and your text, then mark it as final before sending.") : "",
      renderDocument(r, f, liveNote)
    );
  }

  // ── The printable document (always light, like paper) ──
  function renderDocument(r, f, liveNote) {
    const tile = (value, label) => h("div", { class: "rd-tile" }, h("strong", {}, value), h("span", {}, label));
    const section = (title, ...body) => h("section", { class: "rd-section" }, h("h2", {}, title), ...body);
    const kv = (obj, labels, fmt = (n) => n.toLocaleString()) => {
      const entries = Object.entries(obj || {}).filter(([, n]) => n);
      return entries.length ? dataTable(entries.map(([k, n]) => [labels[k] || k, fmt(n)]), ["", ""]) : h("p", { class: "rd-muted" }, "None recorded in this period.");
    };
    const cats = ["rescued_girl", "rescued_boy", "disability", "vulnerable"];
    const catColor = { rescued_girl: "var(--series-1)", rescued_boy: "var(--series-4)", disability: "var(--series-2)", vulnerable: "var(--series-3)" };
    const inCare = cats.map((c) => ({ label: catLabel(c), value: f.children.in_care[c] || 0, color: catColor[c] }));
    const stageItems = STAGES.map((s) => ({ label: s, short: { "Pre-primary": "Pre-prim.", "Junior school": "Junior", "Senior school": "Senior", Secondary: "Form 1–4", "Special needs unit": "Special" }[s] || s, value: f.children.stages[s] || 0 }));
    const months = Object.keys(f.donations.by_month || {}).sort();
    const reached = f.outreach.girls + f.outreach.boys;

    return h("article", { class: "report-doc" },
      h("header", { class: "rd-head" },
        h("img", { src: "../images/logo.png", alt: "" }),
        h("div", {}, h("p", { class: "rd-org" }, "Namelok Naretoi Home · Narok, Kenya"), h("h1", {}, r.title),
          h("p", { class: "rd-period" }, `${longDate(r.period_start)} – ${longDate(r.period_end)}`, r.donor_name ? ` · Prepared for ${r.donor_name}` : ""))
      ),
      h("div", { class: "rd-tiles" },
        tile(f.children.in_care_total, "children in care"),
        tile(f.children.admitted_total, "children admitted"),
        tile(money(f.donations.total), r.donor_name ? "your donations" : "donations received"),
        tile(reached.toLocaleString(), "pupils reached")
      ),
      r.summary ? section("Summary", ...paras(r.summary)) : "",
      section("Children in our care",
        h("div", { class: "rd-two" },
          h("div", {}, h("h3", {}, "By category"), f.children.in_care_total ? donut(inCare, { centerLabel: "In care" }) : h("p", { class: "rd-muted" }, "No children in care recorded.")),
          h("div", {}, h("h3", {}, "By school stage"), columns(stageItems, { color: "var(--series-2)" }))),
        h("h3", {}, "Admitted in this period"), kv(f.children.admitted, Object.fromEntries(cats.map((c) => [c, catLabel(c)]))),
        h("h3", {}, "Care and follow-up"), kv(f.events, EVENTS)
      ),
      section(r.donor_name ? `Donations from ${r.donor_name}` : "Donations",
        h("p", {}, `${f.donations.count} donation${f.donations.count === 1 ? "" : "s"}, ${money(f.donations.total)} in total.`),
        months.length > 1 ? lineChart(months.map((m) => ({ label: new Date(m + "-01T00:00:00").toLocaleDateString("en-GB", { month: "short" }), value: f.donations.by_month[m] })), { color: "var(--series-1)", format: money }) : "",
        h("div", { class: "rd-two" },
          h("div", {}, h("h3", {}, "By purpose"), kv(f.donations.by_purpose, {}, money)),
          h("div", {}, h("h3", {}, "By method"), kv(f.donations.by_method, METHODS, money))),
        f.donations.list.length ? h("div", {}, h("h3", {}, "Each donation"), dataTable(f.donations.list.map(([d, a, m, p]) => [fmtDate(d), money(a), m, p]), ["Date", "Amount", "Method", "Purpose"])) : "",
        f.donations.top_donors.length ? h("div", {}, h("h3", {}, "Largest donors"), dataTable(f.donations.top_donors.map(([n, a]) => [n, money(a)]), ["Donor", "Total"])) : ""
      ),
      section("School outreach",
        h("p", {}, `${f.outreach.visits} school visit${f.outreach.visits === 1 ? "" : "s"}, reaching ${f.outreach.girls.toLocaleString()} girls, ${f.outreach.boys.toLocaleString()} boys and ${f.outreach.parents.toLocaleString()} parents.`),
        f.outreach.list.length ? dataTable(f.outreach.list.map(([d, s, l, n]) => [fmtDate(d), s, l, n.toLocaleString()]), ["Date", "School", "Area", "Pupils"]) : "",
        h("h3", {}, "Items handed out"), kv(f.items, ITEMS)
      ),
      r.highlights ? section("Highlights", ...paras(r.highlights)) : "",
      r.challenges ? section("Challenges", ...paras(r.challenges)) : "",
      r.next_steps ? section("Plans for the next period", ...paras(r.next_steps)) : "",
      h("footer", { class: "rd-foot" },
        h("p", {}, "Namelok Naretoi Home · Narok, Kenya · 0722 537 380"),
        h("p", {}, `Figures from the Namelok dashboard, ${fmtDate(f.generated_at)}. ${liveNote}`))
    );
  }

  return {
    async route(view, id, sub) {
      if (id === "new") return viewForm(view, null);
      if (id && sub === "edit") return viewForm(view, id);
      if (id) return viewReport(view, id);
      return viewList(view);
    },
  };
}
