import { isConfigured, createSupabaseBackend, createDemoBackend } from "./data.js?v=2";

// ─────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────
// Build DOM safely: text is always set as text, never parsed as HTML
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v; // only ever used with our own static markup
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}

const $ = (sel, root = document) => root.querySelector(sel);
const money = (n) => "KES " + Number(n || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 });
const fmtDate = (d) => (d ? new Date(d.length === 10 ? d + "T00:00:00" : d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const age = (dob) => {
  if (!dob) return "";
  const b = new Date(dob + "T00:00:00"), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--;
  return a;
};
// Starter photos are stored as site paths ("images/…"); the dashboard is one folder down
const siteImg = (url) => (!url || /^(https?:|blob:|data:|\/|\.\.\/)/.test(url) ? url : "../" + url);
const thisYear = (d) => d && new Date(d).getFullYear() === new Date().getFullYear();

function toast(message, kind = "ok") {
  const t = h("div", { class: `toast toast-${kind}`, role: "status" }, message);
  document.body.append(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 3200);
}

const ICONS = {
  overview: '<path d="M3 13h8V3H3zM13 21h8v-8h-8zM13 3v8h8V3zM3 21h8v-6H3z"/>',
  website: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  stories: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  gallery: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  children: '<circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 3.1a4 4 0 0 1 0 7.8M21 21v-2a4 4 0 0 0-3-3.9"/>',
  donations: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  donors: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/>',
  volunteers: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
  messages: '<path d="M4 4h16v12H5.2L4 17.2z"/><path d="M8 9h8M8 12h5"/>',
  outreach: '<path d="M3 21h18M5 21V10l7-5 7 5v11M10 21v-6h4v6"/>',
  items: '<path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7"/><path d="M12 7H8a2.5 2.5 0 1 1 0-5c3 0 4 5 4 5zM12 7h4a2.5 2.5 0 1 0 0-5c-3 0-4 5-4 5z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
};
const icon = (name, size = 18) => h("span", { class: "icon", "aria-hidden": "true", html: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>` });

// ─────────────────────────────────────────────────────────────
// What each section stores and shows
// ─────────────────────────────────────────────────────────────
const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const CHILD_CATEGORY = opt([["disability", "Disability"], ["rescued", "Rescued girl"], ["vulnerable", "Vulnerable home"]]);
const CHILD_STATUS = opt([["in_care", "In care at the home"], ["boarding_school", "At boarding school"], ["reintegrated", "Back with family"], ["exited", "Left the programme"]]);
const REFERRAL = opt([["", "—"], ["chief", "Chief"], ["do", "District Officer"], ["dc", "District Commissioner"], ["court", "Court"], ["hospital", "Hospital"], ["school", "School"], ["family", "Family"], ["self", "Came on their own"], ["other", "Other"]]);
const label = (options, value) => (options.find((o) => o.value === value) || {}).label || value || "";

const RESOURCES = {
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
    intro: "Record every donation received, whatever the method.",
    columns: [["received_on", "Date"], ["donor_name", "From"], ["amount", "Amount"], ["method", "Method"], ["purpose", "Purpose"]],
    fields: [
      { name: "donor_name", label: "From (name or Anonymous)", required: true },
      { name: "amount", label: "Amount (KES)", type: "number", required: true, min: 0 },
      { name: "method", label: "Method", type: "select", options: opt([["mpesa", "M-Pesa"], ["bank", "Bank transfer"], ["paypal", "PayPal"], ["cash", "Cash"], ["in_kind", "In kind (goods)"]]) },
      { name: "reference", label: "Reference / transaction code" },
      { name: "received_on", label: "Date received", type: "date", required: true },
      { name: "purpose", label: "Purpose", help: "e.g. School fees, Medical, General" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },
  donors: {
    table: "donors", title: "Donors", singular: "donor", order: "name", ascending: true,
    intro: "People and organisations who give regularly.",
    columns: [["name", "Name"], ["organisation", "Organisation"], ["email", "Email"], ["phone", "Phone"]],
    fields: [
      { name: "name", label: "Name", required: true },
      { name: "organisation", label: "Organisation" },
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
      { name: "item", label: "Item", type: "select", options: opt([["pads", "Sanitary pads"], ["panties", "Panties"], ["boxers", "Boxers"], ["balls", "Balls"], ["socks", "Socks"], ["books", "Books"], ["other", "Other"]]) },
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
      { name: "photo_path", label: "Photo (private)", type: "privateImage" },
      { section: "Care" },
      { name: "category", label: "Category", type: "select", options: CHILD_CATEGORY },
      { name: "status", label: "Status", type: "select", options: CHILD_STATUS },
      { name: "admission_date", label: "Date admitted", type: "date" },
      { name: "referral_channel", label: "Came through", type: "select", options: REFERRAL },
      { name: "referral_details", label: "Referral details", type: "textarea", rows: 2, help: "Case number, officer's name, court reference…" },
      { name: "medical_condition", label: "Medical condition", type: "textarea", rows: 2 },
      { section: "School" },
      { name: "school_name", label: "School" },
      { name: "school_class", label: "Class / grade" },
      { section: "Family" },
      { name: "guardian_name", label: "Guardian" },
      { name: "guardian_phone", label: "Guardian's phone" },
      { name: "home_location", label: "Home area" },
      { section: "Other" },
      { name: "notes", label: "Notes", type: "textarea", rows: 4 },
    ],
  },
  child_events: {
    table: "child_events", singular: "timeline entry",
    fields: [
      { name: "event_date", label: "Date", type: "date", required: true },
      { name: "type", label: "Type", type: "select", options: opt([["medical", "Medical"], ["follow_up", "Follow-up"], ["school", "School"], ["case", "Case / legal"], ["other", "Other"]]) },
      { name: "title", label: "What happened", required: true },
      { name: "details", label: "Details", type: "textarea", rows: 4 },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// App state
// ─────────────────────────────────────────────────────────────
let db = null;
let user = null;
const app = $("#app");

const NAV = [
  ["Overview", [["overview", "Overview", "overview"]]],
  ["Website", [["settings", "Stats & details", "website"], ["stories", "Stories", "stories"], ["gallery_photos", "Gallery", "gallery"]]],
  ["The Home", [["children", "Children", "children"]]],
  ["Giving", [["donations", "Donations", "donations"], ["donors", "Donors", "donors"]]],
  ["People", [["messages", "Messages", "messages"], ["volunteers", "Volunteers", "volunteers"]]],
  ["Outreach", [["outreach_visits", "School visits", "outreach"], ["distributions", "Items handed out", "items"]]],
];

// ─────────────────────────────────────────────────────────────
// Start-up: setup screen, login, or the dashboard
// ─────────────────────────────────────────────────────────────
async function start() {
  const params = new URLSearchParams(location.search);
  if (!isConfigured()) {
    if (params.has("demo")) {
      db = createDemoBackend();
      user = await db.currentUser();
      return renderShell();
    }
    return renderSetup();
  }
  try {
    db = await createSupabaseBackend();
  } catch (e) {
    return renderMessage("Could not reach the database", "Check your internet connection and refresh. (" + e.message + ")");
  }
  user = await db.currentUser();
  if (!user) return renderLogin();
  if (!(await db.isAdmin())) return renderNotAdmin();
  startIdleTimer();
  renderShell();
}

function renderSetup() {
  app.replaceChildren(h("main", { class: "auth-page" },
    h("div", { class: "auth-card wide" },
      h("img", { src: "../images/logo.png", alt: "", class: "auth-logo" }),
      h("h1", {}, "Dashboard not connected yet"),
      h("p", {}, "The dashboard needs a Supabase database. Follow the steps in supabase/SETUP.md, then fill in js/supabase-config.js."),
      h("p", { class: "muted" }, "You can look around first in demo mode. It uses invented sample records and saves nothing."),
      h("a", { href: "?demo", class: "btn btn-primary" }, "Preview the dashboard")
    )
  ));
}

function renderMessage(title, text) {
  app.replaceChildren(h("main", { class: "auth-page" }, h("div", { class: "auth-card" }, h("h1", {}, title), h("p", {}, text))));
}

function renderNotAdmin() {
  app.replaceChildren(h("main", { class: "auth-page" },
    h("div", { class: "auth-card" },
      h("h1", {}, "No access"),
      h("p", {}, `You are signed in as ${user.email}, but this account is not on the admin list. Ask the director to add you.`),
      h("button", { class: "btn", onclick: async () => { await db.signOut(); location.reload(); } }, "Sign out")
    )
  ));
}

function renderLogin() {
  const err = h("p", { class: "form-error", role: "alert" });
  const form = h("form", { class: "auth-card", onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = "";
      const btn = form.querySelector("button");
      btn.disabled = true; btn.textContent = "Signing in…";
      try {
        user = await db.signIn(form.email.value.trim(), form.password.value);
        if (!(await db.isAdmin())) return renderNotAdmin();
        startIdleTimer();
        renderShell();
      } catch (ex) {
        err.textContent = "Sign-in failed: " + ex.message;
        btn.disabled = false; btn.textContent = "Sign in";
      }
    } },
    h("img", { src: "../images/logo.png", alt: "", class: "auth-logo" }),
    h("h1", {}, "Namelok Dashboard"),
    h("p", { class: "muted" }, "Staff sign-in"),
    h("label", {}, "Email", h("input", { name: "email", type: "email", required: true, autocomplete: "username" })),
    h("label", {}, "Password", h("input", { name: "password", type: "password", required: true, autocomplete: "current-password" })),
    err,
    h("button", { class: "btn btn-primary btn-block", type: "submit" }, "Sign in")
  );
  app.replaceChildren(h("main", { class: "auth-page" }, form));
}

// Sign out automatically after 30 minutes without activity (children's records are sensitive)
function startIdleTimer() {
  let timer;
  const reset = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => { await db.signOut(); alert("You were signed out after 30 minutes without activity."); location.reload(); }, 30 * 60 * 1000);
  };
  ["click", "keydown", "scroll", "touchstart"].forEach((ev) => addEventListener(ev, reset, { passive: true }));
  reset();
}

// ─────────────────────────────────────────────────────────────
// Layout
// ─────────────────────────────────────────────────────────────
function renderShell() {
  const nav = h("nav", { class: "side-nav", "aria-label": "Dashboard" },
    NAV.map(([group, items]) => h("div", { class: "nav-group" },
      h("span", { class: "nav-group-label" }, group),
      items.map(([route, text, ic]) => h("a", { href: "#" + route, "data-route": route }, icon(ic), h("span", {}, text)))
    ))
  );
  const sidebar = h("aside", { class: "sidebar" },
    h("a", { class: "brand", href: "#overview" }, h("img", { src: "../images/logo.png", alt: "" }), h("span", {}, "Namelok", h("small", {}, "Dashboard"))),
    nav,
    h("div", { class: "side-foot" },
      h("a", { href: "../index.html", target: "_blank", rel: "noopener" }, "View website ↗"),
      h("span", { class: "who" }, user.email),
      h("button", { class: "btn btn-ghost btn-sm", onclick: async () => { await db.signOut(); location.href = location.pathname; } }, icon("logout", 16), "Sign out")
    )
  );
  const top = h("header", { class: "topbar" },
    h("button", { class: "btn btn-ghost menu-btn", "aria-label": "Menu", onclick: () => document.body.classList.toggle("nav-open") }, icon("menu", 22)),
    h("h1", { id: "pageTitle" }, ""),
    h("div", { id: "pageActions", class: "page-actions" })
  );
  const banner = db.demo ? h("div", { class: "demo-banner" }, "Demo mode: sample data only, nothing is saved. Connect Supabase to start using the dashboard for real.") : null;
  app.replaceChildren(banner || "", h("div", { class: "shell" }, sidebar, h("div", { class: "main" }, top, h("main", { id: "view", class: "view" }))));
  nav.addEventListener("click", () => document.body.classList.remove("nav-open"));
  addEventListener("hashchange", route);
  route();
}

function setPage(title, actions = []) {
  $("#pageTitle").textContent = title;
  $("#pageActions").replaceChildren(...actions);
  document.title = `${title} – Namelok Dashboard`;
}

async function route() {
  const [name, id] = (location.hash.slice(1) || "overview").split("/");
  document.querySelectorAll(".side-nav a").forEach((a) => a.classList.toggle("active", a.dataset.route === name));
  const view = $("#view");
  view.replaceChildren(h("div", { class: "loading" }, "Loading…"));
  try {
    if (name === "overview") await viewOverview(view);
    else if (name === "settings") await viewSettings(view);
    else if (name === "messages") await viewMessages(view);
    else if (name === "children" && id) await viewChild(view, id);
    else if (name === "children") await viewChildren(view);
    else if (RESOURCES[name]) await viewResource(view, name);
    else location.hash = "#overview";
  } catch (e) {
    view.replaceChildren(h("div", { class: "empty error" }, "Something went wrong: " + e.message));
  }
}

// ─────────────────────────────────────────────────────────────
// Overview
// ─────────────────────────────────────────────────────────────
async function viewOverview(view) {
  setPage("Overview");
  const [children, donations, messages, volunteers, visits, items] = await Promise.all([
    db.list("children"), db.list("donations"), db.list("contact_messages"), db.list("volunteers"), db.list("outreach_visits"), db.list("distributions"),
  ]);
  const inCare = children.filter((c) => c.status === "in_care" || c.status === "boarding_school");
  const ytd = donations.filter((d) => thisYear(d.received_on));
  const month = new Date().toISOString().slice(0, 7);
  const monthTotal = donations.filter((d) => (d.received_on || "").startsWith(month)).reduce((s, d) => s + Number(d.amount), 0);
  const visitsYtd = visits.filter((v) => thisYear(v.visit_date));
  const reached = visitsYtd.reduce((s, v) => s + v.girls_reached + v.boys_reached, 0);
  const newMsgs = messages.filter((m) => m.status === "new").length;

  const stat = (value, text, href, sub, ic, tone) => h("a", { class: `stat-card tone-${tone}`, href },
    h("span", { class: "stat-icon" }, icon(ic, 20)),
    h("strong", {}, value), h("span", { class: "stat-label" }, text), sub ? h("small", {}, sub) : "");
  const byCat = (cat) => inCare.filter((c) => c.category === cat).length;
  const itemTotals = {};
  items.filter((i) => thisYear(i.distributed_on)).forEach((i) => (itemTotals[i.item] = (itemTotals[i.item] || 0) + i.quantity));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  view.replaceChildren(
    h("div", { class: "greeting" },
      h("p", { class: "greeting-date" }, new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })),
      h("h2", {}, `${greeting}.`),
      h("p", {}, "Here is what is happening at Namelok Naretoi Home.")
    ),
    h("div", { class: "stat-grid" },
      stat(inCare.length, "Children in care", "#children", `${byCat("disability")} disability · ${byCat("rescued")} rescued · ${byCat("vulnerable")} vulnerable`, "children", "earth"),
      stat(money(ytd.reduce((s, d) => s + Number(d.amount), 0)), `Donations in ${new Date().getFullYear()}`, "#donations", `${money(monthTotal)} this month`, "donations", "ochre"),
      stat(reached.toLocaleString(), "Pupils reached this year", "#outreach_visits", `${visitsYtd.length} school visits`, "outreach", "green"),
      stat(newMsgs, newMsgs === 1 ? "New message" : "New messages", "#messages", `${volunteers.filter((v) => v.status === "active").length} active volunteers`, "messages", "blue")
    ),
    h("div", { class: "panel-grid" },
      h("section", { class: "panel" },
        h("h2", {}, "Recent donations"),
        donations.length ? h("ul", { class: "mini-list" }, donations.slice(0, 5).map((d) => h("li", {}, h("span", {}, d.donor_name || "Anonymous", h("small", {}, fmtDate(d.received_on))), h("b", {}, money(d.amount))))) : h("p", { class: "muted" }, "No donations recorded yet.")
      ),
      h("section", { class: "panel" },
        h("h2", {}, "Items handed out this year"),
        Object.keys(itemTotals).length ? h("ul", { class: "mini-list" }, Object.entries(itemTotals).map(([k, v]) => h("li", {}, h("span", {}, label(RESOURCES.distributions.fields[0].options, k)), h("b", {}, v.toLocaleString())))) : h("p", { class: "muted" }, "Nothing recorded yet.")
      ),
      h("section", { class: "panel" },
        h("h2", {}, "Latest messages"),
        messages.length ? h("ul", { class: "mini-list" }, messages.slice(0, 5).map((m) => h("li", {}, h("span", {}, `${m.first_name} ${m.last_name}`.trim(), h("small", {}, m.reason || "General")), m.status === "new" ? h("span", { class: "badge badge-new" }, "New") : ""))) : h("p", { class: "muted" }, "No messages yet.")
      )
    )
  );
}

// ─────────────────────────────────────────────────────────────
// Website stats & details
// ─────────────────────────────────────────────────────────────
async function viewSettings(view) {
  setPage("Stats & details");
  const settings = await db.list("site_settings", { order: "key", ascending: true });
  const groups = [
    ["Numbers on the website", ["founded_year", "children_supported", "girls_rescued"]],
    ["Contact details", ["phone", "email"]],
    ["Donation details (shown on the Donate page)", ["mpesa_paybill", "mpesa_account", "bank_name", "bank_account_name", "bank_account_number", "bank_branch"]],
  ];
  const byKey = Object.fromEntries(settings.map((s) => [s.key, s]));
  const form = h("form", { class: "panel form-panel", onsubmit: async (e) => {
      e.preventDefault();
      const btn = form.querySelector("[type=submit]");
      btn.disabled = true;
      try {
        for (const s of settings) {
          const input = form.elements[s.key];
          if (input && input.value !== s.value) { await db.saveSetting(s.key, input.value.trim()); s.value = input.value.trim(); }
        }
        toast("Saved. The website will show the new details.");
      } catch (ex) { toast("Could not save: " + ex.message, "error"); }
      btn.disabled = false;
    } },
    groups.map(([title, keys]) => h("fieldset", {},
      h("legend", {}, title),
      keys.filter((k) => byKey[k]).map((k) => h("label", {}, byKey[k].label, h("input", { name: k, value: byKey[k].value, inputmode: /year|supported|rescued|paybill|number/.test(k) ? "numeric" : null })))
    )),
    h("p", { class: "muted" }, "Years of service on the website are worked out from the year founded."),
    h("button", { class: "btn btn-primary", type: "submit" }, "Save changes")
  );
  view.replaceChildren(form);
}

// ─────────────────────────────────────────────────────────────
// Generic list + form for a resource
// ─────────────────────────────────────────────────────────────
function cellValue(res, key, row, lookups) {
  const v = row[key];
  const field = res.fields.find((f) => f.name === key) || {};
  if (field.type === "image") return v ? h("img", { src: siteImg(v), alt: "", class: "thumb" }) : "";
  if (field.type === "checkbox") return v ? h("span", { class: "badge badge-yes" }, "Yes") : h("span", { class: "badge" }, "No");
  if (field.type === "date") return fmtDate(v);
  if (key === "amount") return money(v);
  if (field.options) return label(field.options, v);
  if (field.optionsFrom) return (lookups[field.optionsFrom] || {})[v] || "";
  if (key === "status") return h("span", { class: `badge badge-${v}` }, capital(v || ""));
  return v ?? "";
}

async function loadLookups(res) {
  const lookups = {};
  for (const f of res.fields.filter((f) => f.optionsFrom)) {
    const rows = await db.list(f.optionsFrom);
    f.options = [{ value: "", label: "—" }, ...rows.map((r) => ({ value: r.id, label: `${r.school_name} (${fmtDate(r.visit_date)})` }))];
    lookups[f.optionsFrom] = Object.fromEntries(f.options.map((o) => [o.value, o.label]));
  }
  return lookups;
}

async function viewResource(view, name) {
  const res = RESOURCES[name];
  const lookups = await loadLookups(res);
  const rows = await db.list(res.table, { order: res.order || "created_at", ascending: !!res.ascending });
  const reload = () => viewResource(view, name);
  setPage(res.title, [h("button", { class: "btn btn-primary", onclick: () => openForm(res, null, reload) }, icon("plus", 16), `Add ${res.singular}`)]);

  const search = h("input", { type: "search", placeholder: `Search ${res.title.toLowerCase()}…`, class: "search" });
  const tbody = h("tbody");
  const draw = () => {
    const q = search.value.toLowerCase();
    const shown = rows.filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q));
    tbody.replaceChildren(...(shown.length ? shown.map((row) => h("tr", { tabindex: 0, onclick: () => openForm(res, row, reload), onkeydown: (e) => e.key === "Enter" && openForm(res, row, reload) },
      res.columns.map(([key, text]) => h("td", { "data-label": text }, cellValue(res, key, row, lookups)))
    )) : [h("tr", {}, h("td", { colspan: res.columns.length, class: "empty" }, rows.length ? "Nothing matches your search." : `No ${res.title.toLowerCase()} yet. Use “Add ${res.singular}” to create the first one.`))]));
  };
  search.addEventListener("input", draw);

  const summary = name === "donations" ? h("p", { class: "summary" }, `${rows.length} donations · ${money(rows.reduce((s, r) => s + Number(r.amount), 0))} in total`) : name === "distributions" ? h("p", { class: "summary" }, `${rows.reduce((s, r) => s + r.quantity, 0).toLocaleString()} items in total`) : null;
  view.replaceChildren(
    res.intro ? h("p", { class: "intro" }, res.intro) : "",
    h("div", { class: "toolbar" }, search, summary || ""),
    h("div", { class: "table-wrap" }, h("table", { class: "data-table" }, h("thead", {}, h("tr", {}, res.columns.map(([, text]) => h("th", {}, text)))), tbody))
  );
  draw();
}

// Build an input for one field
function fieldInput(f, value, extras = {}) {
  const id = "f_" + f.name;
  const common = { id, name: f.name, required: f.required };
  let input;
  if (f.type === "textarea") input = h("textarea", { ...common, rows: f.rows || 3 }, value ?? "");
  else if (f.type === "select") input = h("select", common, f.options.map((o) => h("option", { value: o.value, selected: String(value ?? "") === String(o.value) }, o.label)));
  else if (f.type === "checkbox") return h("label", { class: "check" }, h("input", { ...common, type: "checkbox", checked: value ?? f.default ?? false }), f.label);
  else if (f.type === "image" || f.type === "privateImage") {
    const preview = h("img", { class: "img-preview", alt: "", hidden: !value });
    if (value) (f.type === "privateImage" ? db.privateUrl(value) : Promise.resolve(siteImg(value))).then((u) => (preview.src = u)).catch(() => {});
    const hidden = h("input", { type: "hidden", name: f.name, value: value ?? "" });
    const file = h("input", { type: "file", accept: "image/*", id, required: f.required && !value, onchange: async () => {
        const chosen = file.files[0];
        if (!chosen) return;
        if (chosen.size > 8 * 1024 * 1024) { toast("That photo is over 8 MB. Please choose a smaller one.", "error"); file.value = ""; return; }
        file.disabled = true;
        try {
          hidden.value = f.type === "privateImage" ? await db.uploadPrivate(chosen, extras.folder || "children") : await db.uploadPublic(chosen);
          preview.src = f.type === "privateImage" ? await db.privateUrl(hidden.value) : hidden.value;
          preview.hidden = false;
          toast("Photo uploaded");
        } catch (ex) { toast("Upload failed: " + ex.message, "error"); }
        file.disabled = false;
      } });
    input = h("div", { class: "img-field" }, preview, file, hidden);
    return h("div", { class: "field" }, h("label", { for: id }, f.label), input, f.help ? h("small", {}, f.help) : "");
  } else input = h("input", { ...common, type: f.type || "text", value: value ?? (f.type === "date" && f.required ? new Date().toISOString().slice(0, 10) : ""), min: f.min, pattern: f.pattern, step: f.type === "number" ? "any" : null });
  return h("div", { class: "field" }, h("label", { for: id }, f.label, f.required ? h("span", { class: "req" }, " *") : ""), input, f.help ? h("small", {}, f.help) : "");
}

function readForm(form, fields) {
  const row = {};
  for (const f of fields) {
    if (!f.name) continue;
    const el = form.elements[f.name];
    if (!el) continue;
    if (f.type === "checkbox") row[f.name] = el.checked;
    else if (f.type === "number") row[f.name] = el.value === "" ? 0 : Number(el.value);
    else if (f.type === "date") row[f.name] = el.value || null;
    else if (f.optionsFrom) row[f.name] = el.value || null;
    else row[f.name] = el.value.trim();
  }
  return row;
}

// Modal form used for adding and editing any record
function openForm(res, row, onDone, extra = {}) {
  const editing = Boolean(row);
  const dlg = h("dialog", { class: "modal" });
  const err = h("p", { class: "form-error", role: "alert" });
  const body = h("div", { class: "modal-body" });
  for (const f of res.fields) {
    if (f.section) body.append(h("h3", { class: "form-section" }, f.section));
    else body.append(fieldInput(f, row ? row[f.name] : f.default, { folder: extra.folder }));
  }
  const form = h("form", { method: "dialog", onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = "";
      if (!form.reportValidity()) return;
      const data = { ...readForm(form, res.fields), ...(extra.fixed || {}) };
      const btn = form.querySelector("[type=submit]");
      btn.disabled = true; btn.textContent = "Saving…";
      try {
        const saved = editing ? await db.update(res.table, row.id, data) : await db.insert(res.table, data);
        dlg.close();
        toast(editing ? "Changes saved" : `${capital(res.singular)} added`);
        onDone(saved);
      } catch (ex) {
        err.textContent = "Could not save: " + friendly(ex.message);
        btn.disabled = false; btn.textContent = "Save";
      }
    } },
    h("header", { class: "modal-head" }, h("h2", {}, `${editing ? "Edit" : "Add"} ${res.singular}`), h("button", { type: "button", class: "btn btn-ghost", "aria-label": "Close", onclick: () => dlg.close() }, "×")),
    body,
    h("footer", { class: "modal-foot" },
      err,
      editing ? h("button", { type: "button", class: "btn btn-danger", onclick: async () => {
          if (!confirm(`Delete this ${res.singular}? This cannot be undone.`)) return;
          try { await db.remove(res.table, row.id); dlg.close(); toast(`${capital(res.singular)} deleted`); onDone(null); }
          catch (ex) { err.textContent = "Could not delete: " + friendly(ex.message); }
        } }, "Delete") : "",
      h("span", { class: "spacer" }),
      h("button", { type: "button", class: "btn", onclick: () => dlg.close() }, "Cancel"),
      h("button", { type: "submit", class: "btn btn-primary" }, "Save")
    )
  );
  dlg.append(form);
  dlg.addEventListener("close", () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
  form.querySelector("input:not([type=hidden]):not([type=file]), textarea, select")?.focus();
}

const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function friendly(msg) {
  if (/duplicate key.*slug/i.test(msg)) return "another story already uses that web address.";
  if (/slug_check|violates check constraint "stories_slug/i.test(msg)) return "the web address can only use lowercase letters, numbers and dashes.";
  if (/row-level security/i.test(msg)) return "your account is not allowed to do this.";
  return msg;
}

// ─────────────────────────────────────────────────────────────
// Messages from the website
// ─────────────────────────────────────────────────────────────
async function viewMessages(view) {
  setPage("Messages");
  const rows = await db.list("contact_messages");
  const statuses = ["new", "read", "replied", "archived"];
  let filter = "inbox";
  const list = h("div", { class: "message-list" });
  const tabs = h("div", { class: "tabs" }, [["inbox", "Inbox"], ["archived", "Archived"], ["all", "All"]].map(([key, text]) =>
    h("button", { class: "tab" + (key === filter ? " active" : ""), onclick: (e) => { filter = key; tabs.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === e.currentTarget)); draw(); } }, text)));

  const draw = () => {
    const shown = rows.filter((m) => filter === "all" || (filter === "archived" ? m.status === "archived" : m.status !== "archived"));
    list.replaceChildren(...(shown.length ? shown.map((m) => {
      const status = h("select", { "aria-label": "Status", onchange: async () => {
          try { await db.update("contact_messages", m.id, { status: status.value }); m.status = status.value; card.classList.toggle("is-new", m.status === "new"); toast("Status updated"); }
          catch (ex) { toast("Could not update: " + ex.message, "error"); }
        } }, statuses.map((s) => h("option", { value: s, selected: s === m.status }, capital(s))));
      const card = h("article", { class: "message" + (m.status === "new" ? " is-new" : "") },
        h("header", {},
          h("div", {}, h("strong", {}, `${m.first_name} ${m.last_name}`.trim()), h("a", { href: `mailto:${m.email}` }, m.email)),
          h("div", { class: "message-meta" }, m.reason ? h("span", { class: "badge" }, m.reason) : "", h("small", {}, fmtDate(m.created_at)))
        ),
        h("p", {}, m.message),
        h("footer", {}, status,
          /volunteer/i.test(m.reason) ? h("button", { class: "btn btn-sm", onclick: () => { openForm(RESOURCES.volunteers, null, () => toast("Saved to Volunteers")); prefillVolunteer(m); } }, "Add as volunteer") : "",
          h("a", { class: "btn btn-sm btn-primary", href: `mailto:${m.email}?subject=${encodeURIComponent("Re: your message to Namelok Naretoi Home")}` }, "Reply by email"))
      );
      return card;
    }) : [h("div", { class: "empty" }, "No messages here.")]));
  };
  view.replaceChildren(h("p", { class: "intro" }, "Messages sent through the website's contact form."), tabs, list);
  draw();
}

// Fill the open volunteer form with details from a message
function prefillVolunteer(m) {
  const form = document.querySelector("dialog.modal form");
  if (!form) return;
  form.elements.name.value = `${m.first_name} ${m.last_name}`.trim();
  form.elements.email.value = m.email;
  form.elements.notes.value = m.message;
}

// ─────────────────────────────────────────────────────────────
// Children
// ─────────────────────────────────────────────────────────────
async function viewChildren(view) {
  const res = RESOURCES.children;
  const rows = await db.list("children", { order: "admission_date" });
  setPage("Children", [h("button", { class: "btn btn-primary", onclick: () => openForm(res, null, (saved) => (location.hash = "#children/" + saved.id)) }, icon("plus", 16), "Add child")]);

  const search = h("input", { type: "search", placeholder: "Search by name, school, area…", class: "search" });
  const catSel = h("select", { "aria-label": "Category" }, h("option", { value: "" }, "All categories"), CHILD_CATEGORY.map((o) => h("option", { value: o.value }, o.label)));
  const statusSel = h("select", { "aria-label": "Status" }, h("option", { value: "current" }, "Currently supported"), h("option", { value: "" }, "All statuses"), CHILD_STATUS.map((o) => h("option", { value: o.value }, o.label)));
  const grid = h("div", { class: "child-grid" });
  const draw = () => {
    const q = search.value.toLowerCase();
    const shown = rows.filter((c) =>
      (!q || [c.first_name, c.last_name, c.school_name, c.home_location, c.guardian_name].join(" ").toLowerCase().includes(q)) &&
      (!catSel.value || c.category === catSel.value) &&
      (statusSel.value === "" || (statusSel.value === "current" ? ["in_care", "boarding_school"].includes(c.status) : c.status === statusSel.value)));
    grid.replaceChildren(...(shown.length ? shown.map((c) => h("a", { class: "child-card", href: "#children/" + c.id },
      h("div", { class: "avatar" }, (c.first_name[0] || "?") + (c.last_name[0] || "")),
      h("div", {},
        h("strong", {}, `${c.first_name} ${c.last_name}`.trim()),
        h("span", {}, [age(c.date_of_birth) !== "" ? `${age(c.date_of_birth)} yrs` : "", c.school_class].filter(Boolean).join(" · ")),
        h("div", { class: "chips" }, h("span", { class: `badge badge-${c.category}` }, label(CHILD_CATEGORY, c.category)), h("span", { class: "badge" }, label(CHILD_STATUS, c.status)))
      )
    )) : [h("div", { class: "empty" }, rows.length ? "No children match these filters." : "No children recorded yet. Use “Add child” to create the first record.")]));
  };
  [search, catSel, statusSel].forEach((el) => el.addEventListener("input", draw));
  view.replaceChildren(
    h("p", { class: "intro private-note" }, "Private records. Never share these details outside the team."),
    h("div", { class: "toolbar" }, search, catSel, statusSel),
    grid
  );
  draw();
}

async function viewChild(view, id) {
  const res = RESOURCES.children;
  const [child] = (await db.list("children", { eq: { id } }));
  if (!child) { location.hash = "#children"; return; }
  const events = await db.list("child_events", { eq: { child_id: id }, order: "event_date" });
  const reload = () => viewChild(view, id);
  setPage(`${child.first_name} ${child.last_name}`.trim(), [
    h("a", { class: "btn", href: "#children" }, "← All children"),
    h("button", { class: "btn btn-primary", onclick: () => openForm(res, child, (saved) => (saved ? reload() : (location.hash = "#children")), { folder: id }) }, "Edit details"),
  ]);

  const photo = h("div", { class: "avatar avatar-lg" }, (child.first_name[0] || "?") + (child.last_name[0] || ""));
  if (child.photo_path) db.privateUrl(child.photo_path).then((u) => { if (u) photo.replaceChildren(h("img", { src: u, alt: "" })); }).catch(() => {});

  const row = (k, v) => (v || v === 0 ? h("div", { class: "kv" }, h("dt", {}, k), h("dd", {}, v)) : "");
  const timelineRes = RESOURCES.child_events;
  view.replaceChildren(
    h("div", { class: "child-layout" },
      h("section", { class: "panel child-profile" },
        h("div", { class: "child-head" }, photo, h("div", {},
          h("h2", {}, `${child.first_name} ${child.last_name}`.trim()),
          h("div", { class: "chips" }, h("span", { class: `badge badge-${child.category}` }, label(CHILD_CATEGORY, child.category)), h("span", { class: "badge" }, label(CHILD_STATUS, child.status)))
        )),
        h("dl", {},
          row("Age", age(child.date_of_birth) !== "" ? `${age(child.date_of_birth)} (born ${fmtDate(child.date_of_birth)})` : ""),
          row("Gender", capital(child.gender || "")),
          row("Admitted", fmtDate(child.admission_date)),
          row("Came through", label(REFERRAL, child.referral_channel)),
          row("Referral details", child.referral_details),
          row("Medical", child.medical_condition),
          row("School", [child.school_name, child.school_class].filter(Boolean).join(", ")),
          row("Guardian", [child.guardian_name, child.guardian_phone].filter(Boolean).join(" · ")),
          row("Home area", child.home_location),
          row("Notes", child.notes)
        )
      ),
      h("section", { class: "panel" },
        h("div", { class: "panel-head" }, h("h2", {}, "Timeline"),
          h("button", { class: "btn btn-sm btn-primary", onclick: () => openForm(timelineRes, null, reload, { fixed: { child_id: id } }) }, icon("plus", 14), "Add entry")),
        events.length ? h("ol", { class: "timeline" }, events.map((e) => h("li", { class: `tl tl-${e.type}`, tabindex: 0, onclick: () => openForm(timelineRes, e, reload, { fixed: { child_id: id } }) },
          h("small", {}, fmtDate(e.event_date) + " · " + label(timelineRes.fields[1].options, e.type)),
          h("strong", {}, e.title),
          e.details ? h("p", {}, e.details) : ""
        ))) : h("p", { class: "muted" }, "No entries yet. Add surgeries, follow-ups, school reports and case updates here.")
      )
    )
  );
}

start();
