// Calendar: Namelok's own events (meetings, board meetings, donor visits, holidays)
// together with school visits and children's care dates from the rest of the dashboard.

export function createCalendar(ctx) {
  const { h, icon, fmtDate, setPage, db, openForm, toast } = ctx;

  const KINDS = [["meeting", "Staff meeting"], ["board", "Board meeting"], ["donor", "Donor visit"], ["event", "Community event"], ["holiday", "Holiday"], ["other", "Other"]];
  const kindLabel = (k) => (KINDS.find(([v]) => v === k) || [k, k])[1];
  // Colour groups (match the chart colours; a legend always names them)
  const toneOf = (e) => (e.source === "visit" ? 2 : e.source === "child" ? 3 : ["donor", "holiday"].includes(e.kind) ? 4 : 1);
  const LEGEND = [[1, "Meetings & events"], [2, "School visits"], [3, "Children's care"], [4, "Donors & holidays"]];

  const EVENT_FORM = {
    table: "calendar_events", singular: "event",
    fields: [
      { name: "title", label: "What", required: true },
      { name: "kind", label: "Type", type: "select", options: KINDS.map(([value, label]) => ({ value, label })) },
      { name: "starts_on", label: "Date", type: "date", required: true },
      { name: "start_time", label: "Time (optional)", type: "time" },
      { name: "ends_on", label: "Ends on (for events over several days)", type: "date" },
      { name: "location", label: "Where" },
      { name: "notes", label: "Notes", type: "textarea", rows: 3 },
    ],
  };

  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = () => iso(new Date());

  // Everything with a date, as one list: { date, title, sub, time, tone, href | edit }
  async function allEvents() {
    const [own, visits, childEvents, children] = await Promise.all(["calendar_events", "outreach_visits", "child_events", "children"].map((t) => db().list(t)));
    const name = Object.fromEntries(children.map((c) => [c.id, c.first_name]));
    const out = [];
    for (const e of own) {
      const start = new Date(e.starts_on + "T00:00:00");
      const end = new Date((e.ends_on || e.starts_on) + "T00:00:00");
      for (let d = new Date(start); d <= end && out.length < 5000; d.setDate(d.getDate() + 1)) {
        out.push({ date: iso(d), title: e.title, sub: [kindLabel(e.kind), e.location].filter(Boolean).join(" · "), time: e.start_time, source: "own", kind: e.kind, row: e });
      }
    }
    for (const v of visits) out.push({ date: v.visit_date, title: `School visit: ${v.school_name}`, sub: v.location || "Outreach", time: "", source: "visit", href: "#outreach_visits" });
    for (const e of childEvents) out.push({ date: e.event_date, title: e.title, sub: name[e.child_id] ? `${name[e.child_id]} · children's care` : "Children's care", time: "", source: "child", href: "#children/" + e.child_id });
    out.forEach((e) => (e.tone = toneOf(e)));
    return out.sort((a, b) => (a.date + (a.time || "99") < b.date + (b.time || "99") ? -1 : 1));
  }

  const openEvent = (e, reload) => {
    if (e.source === "own") openForm(EVENT_FORM, e.row, reload);
    else location.hash = e.href;
  };
  const addEvent = (date, reload) => {
    openForm(EVENT_FORM, null, reload);
    if (date) setTimeout(() => { const f = document.querySelector("dialog.modal #f_starts_on"); if (f) f.value = date; }, 0);
  };

  // Monday-first grid of dates covering the month
  function monthDays(year, month) {
    const first = new Date(year, month, 1);
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }
  const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const legend = () => h("ul", { class: "cal-legend" }, LEGEND.map(([t, text]) => h("li", {}, h("span", { class: `cal-key tone-${t}` }), text)));

  // ── Full calendar page ──
  let shown = null;
  async function viewPage(view) {
    if (!shown) { const n = new Date(); shown = { y: n.getFullYear(), m: n.getMonth() }; }
    const events = await allEvents();
    const reload = () => viewPage(view);
    const byDate = {};
    events.forEach((e) => (byDate[e.date] ||= []).push(e));
    const monthName = new Date(shown.y, shown.m, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    const move = (n) => { const d = new Date(shown.y, shown.m + n, 1); shown = { y: d.getFullYear(), m: d.getMonth() }; reload(); };
    setPage("Calendar", [h("button", { class: "btn btn-primary", onclick: () => addEvent(null, reload) }, icon("plus", 16), "Add event")]);

    const panel = h("aside", { class: "cal-day-panel card" });
    const showDay = (date) => {
      const list = byDate[date] || [];
      grid.querySelectorAll(".cal-cell").forEach((c) => c.classList.toggle("selected", c.dataset.date === date));
      panel.replaceChildren(
        h("header", { class: "card-head" }, h("h3", {}, new Date(date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })),
          h("button", { class: "btn btn-sm", onclick: () => addEvent(date, reload) }, icon("plus", 14), "Add")),
        list.length ? h("ul", { class: "event-list" }, list.map((e) => h("li", {}, h("button", { class: `event-row tone-${e.tone}`, onclick: () => openEvent(e, reload) },
          h("span", { class: "event-bar" }), h("span", { class: "event-text" }, h("strong", {}, e.title), h("small", {}, [e.time, e.sub].filter(Boolean).join(" · "))), icon("chevron", 14)))))
          : h("p", { class: "muted" }, "Nothing on this day.")
      );
    };
    const grid = h("div", { class: "cal-grid", role: "grid", "aria-label": monthName },
      WEEKDAYS.map((d) => h("div", { class: "cal-weekday", role: "columnheader" }, d)),
      monthDays(shown.y, shown.m).map((d) => {
        const date = iso(d), list = byDate[date] || [];
        const cell = h("button", { class: "cal-cell" + (d.getMonth() !== shown.m ? " other" : "") + (date === today() ? " today" : ""), "data-date": date, role: "gridcell", "aria-label": `${fmtDate(date)}, ${list.length} event${list.length === 1 ? "" : "s"}`, onclick: () => showDay(date) },
          h("span", { class: "cal-num" }, d.getDate()),
          list.slice(0, 3).map((e) => h("span", { class: `cal-chip tone-${e.tone}` }, e.time ? `${e.time} ${e.title}` : e.title)),
          list.length > 3 ? h("span", { class: "cal-more" }, `+${list.length - 3} more`) : "");
        return cell;
      }));
    view.replaceChildren(
      h("div", { class: "cal-toolbar" },
        h("div", { class: "cal-nav" },
          h("button", { class: "icon-btn", "aria-label": "Previous month", onclick: () => move(-1) }, icon("chevron-left", 18)),
          h("h2", {}, monthName),
          h("button", { class: "icon-btn", "aria-label": "Next month", onclick: () => move(1) }, icon("chevron", 18)),
          h("button", { class: "btn btn-sm", onclick: () => { shown = null; reload(); } }, "Today")),
        legend()),
      h("div", { class: "cal-layout" }, h("section", { class: "card cal-card" }, grid), panel)
    );
    const inMonth = new Date().getMonth() === shown.m && new Date().getFullYear() === shown.y;
    showDay(inMonth ? today() : iso(new Date(shown.y, shown.m, 1)));
  }

  // ── Small calendar for the overview ──
  async function widget() {
    const events = await allEvents();
    const byDate = {};
    events.forEach((e) => (byDate[e.date] ||= []).push(e));
    const next = events.filter((e) => e.date >= today()).slice(0, 2);
    let y = new Date().getFullYear(), m = new Date().getMonth();
    const body = h("div", { class: "mini-cal" });
    const draw = () => {
      body.replaceChildren(
        h("div", { class: "mini-cal-head" },
          h("button", { class: "icon-btn sm", "aria-label": "Previous month", onclick: () => { m--; if (m < 0) { m = 11; y--; } draw(); } }, icon("chevron-left", 14)),
          h("strong", {}, new Date(y, m, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })),
          h("button", { class: "icon-btn sm", "aria-label": "Next month", onclick: () => { m++; if (m > 11) { m = 0; y++; } draw(); } }, icon("chevron", 14))),
        h("div", { class: "mini-cal-grid" },
          WEEKDAYS.map((d) => h("span", { class: "mini-wd" }, d.slice(0, 2))),
          monthDays(y, m).map((d) => {
            const date = iso(d), list = byDate[date] || [];
            const tone = list.length ? list[0].tone : 0;
            return h("a", { href: "#calendar", class: "mini-day" + (d.getMonth() !== m ? " other" : "") + (date === today() ? " today" : "") + (list.length ? ` has tone-${tone}` : ""),
              title: list.map((e) => e.title).join("\n") || undefined, "aria-label": `${fmtDate(date)}${list.length ? ", " + list.length + " event" + (list.length > 1 ? "s" : "") : ""}` }, d.getDate());
          }))
      );
    };
    draw();
    // A few more dates after the two highlighted ones
    const later = events.filter((e) => e.date >= today()).slice(2, 6);
    const coming = later.length ? h("div", { class: "coming-up" }, h("h4", {}, "Coming up"),
      h("ul", {}, later.map((e) => h("li", {}, h("a", { href: e.source === "own" ? "#calendar" : e.href, class: `tone-${e.tone}` },
        h("span", { class: "cu-date" }, new Date(e.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })),
        h("span", { class: "cu-dot" }), h("span", { class: "cu-title" }, e.title)))))) : "";
    return h("div", { class: "cal-widget" },
      h("div", { class: "next-events" }, next.length ? next.map((e) => h("a", { class: `next-event tone-${e.tone}`, href: e.source === "own" ? "#calendar" : e.href },
        h("small", {}, new Date(e.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })),
        h("span", { class: "next-title" }, e.title), icon("chevron", 14))) : h("p", { class: "muted" }, "Nothing coming up.")),
      body, coming);
  }

  return { route: viewPage, widget, EVENT_FORM };
}
