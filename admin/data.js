// Data layer for the dashboard. The rest of the app only calls these methods,
// so it works the same against Supabase or the in-memory demo.

const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export function isConfigured() {
  const cfg = window.NAMELOK_SUPABASE || {};
  return Boolean(cfg.url && cfg.anonKey);
}

// ─────────────────────────────────────────────────────────────
// Supabase
// ─────────────────────────────────────────────────────────────
export async function createSupabaseBackend() {
  const { createClient } = await import(SUPABASE_CDN);
  const { url, anonKey } = window.NAMELOK_SUPABASE;
  const sb = createClient(url, anonKey);

  const check = ({ data, error }) => {
    if (error) throw new Error(error.message);
    return data;
  };

  return {
    demo: false,

    async currentUser() {
      const { data } = await sb.auth.getSession();
      return data.session?.user || null;
    },
    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      return data.user;
    },
    async signOut() {
      await sb.auth.signOut();
    },
    async isAdmin() {
      const { data, error } = await sb.rpc("is_admin");
      return !error && data === true;
    },

    async list(table, { order = "created_at", ascending = false, eq } = {}) {
      let query = sb.from(table).select("*").order(order, { ascending });
      if (eq) for (const [col, val] of Object.entries(eq)) query = query.eq(col, val);
      return check(await query);
    },
    async insert(table, row) {
      return check(await sb.from(table).insert(row).select().single());
    },
    async update(table, id, row) {
      return check(await sb.from(table).update(row).eq("id", id).select().single());
    },
    async remove(table, id) {
      check(await sb.from(table).delete().eq("id", id));
    },
    async saveSetting(key, value) {
      check(await sb.from("site_settings").update({ value }).eq("key", key));
    },

    // Public photos for the website
    async uploadPublic(file) {
      const path = `${Date.now()}-${safeName(file.name)}`;
      check(await sb.storage.from("site-media").upload(path, file, { upsert: false }));
      return sb.storage.from("site-media").getPublicUrl(path).data.publicUrl;
    },
    // Private files for children's records: only viewable through short-lived links
    async uploadPrivate(file, folder) {
      const path = `${folder}/${Date.now()}-${safeName(file.name)}`;
      check(await sb.storage.from("child-files").upload(path, file, { upsert: false }));
      return path;
    },
    async privateUrl(path) {
      if (!path) return "";
      const data = check(await sb.storage.from("child-files").createSignedUrl(path, 300));
      return data.signedUrl;
    },
  };
}

function safeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
}

// ─────────────────────────────────────────────────────────────
// Demo: in-memory sample data so the dashboard can be previewed before
// Supabase is set up. Nothing is saved; a page refresh resets it.
// All people and records here are invented placeholders.
// ─────────────────────────────────────────────────────────────
export function createDemoBackend() {
  const uid = () => crypto.randomUUID();
  const now = new Date();
  const day = (offset) => new Date(now.getTime() - offset * 86400000).toISOString().slice(0, 10);
  const stamp = (offset) => new Date(now.getTime() - offset * 86400000).toISOString();

  const childA = uid(), childB = uid(), childC = uid(), visit1 = uid();
  const tables = {
    site_settings: [
      ["founded_year", "1991", "Year founded (years of service is counted from this)"],
      ["children_supported", "350", "Children supported"],
      ["girls_rescued", "50", "Girls rescued"],
      ["phone", "0722 537 380", "Phone number"],
      ["email", "jenniferkosencha@gmail.com", "Email address"],
      ["mpesa_paybill", "", "M-Pesa paybill number"],
      ["mpesa_account", "", "M-Pesa account number"],
      ["bank_name", "", "Bank name"],
      ["bank_account_name", "", "Bank account name"],
      ["bank_account_number", "", "Bank account number"],
      ["bank_branch", "", "Bank branch"],
    ].map(([key, value, label]) => ({ key, value, label, updated_at: stamp(3) })),
    stories: [
      { id: uid(), slug: "from-risk-to-resilience", title: "From Risk to Resilience", child_name: "Jackie", age: "20", category: "rescue", summary: "Rescued at 13 and kept in school, Jackie went on to graduate from university.", body: "", image_url: "images/web/thumbs/sch7.jpg", featured: false, published: true, sort_order: 1, created_at: stamp(40) },
      { id: uid(), slug: "beyond-the-diagnosis", title: "Beyond the Diagnosis", child_name: "Susan", age: "8", category: "disability", summary: "Surgery and rehabilitation mean Susan now walks.", body: "", image_url: "images/web/thumbs/hsp3.jpg", featured: false, published: true, sort_order: 2, created_at: stamp(30) },
      { id: uid(), slug: "draft-story", title: "Draft story (not yet published)", child_name: "", age: "", category: "education", summary: "", body: "", image_url: "", featured: false, published: false, sort_order: 3, created_at: stamp(2) },
    ],
    gallery_photos: [
      { id: uid(), image_url: "images/web/thumbs/sch4.jpg", caption: "Handing out sanitary pads at a school", category: "school", published: true, sort_order: 1, created_at: stamp(20) },
      { id: uid(), image_url: "images/web/thumbs/hsp3.jpg", caption: "A medical worker fitting a leg brace", category: "health", published: true, sort_order: 2, created_at: stamp(18) },
      { id: uid(), image_url: "images/web/thumbs/nam3.jpg", caption: "Staff and children outside the home", category: "home", published: true, sort_order: 3, created_at: stamp(15) },
    ],
    contact_messages: [
      { id: uid(), first_name: "Demo", last_name: "Visitor", email: "visitor@example.com", reason: "Volunteering", message: "I would like to speak at one of your school workshops.", status: "new", created_at: stamp(1) },
      { id: uid(), first_name: "Sample", last_name: "Partner", email: "partner@example.com", reason: "Partnership / Sponsorship", message: "Our organisation would like to sponsor school fees.", status: "read", created_at: stamp(6) },
    ],
    children: [
      { id: childA, first_name: "Demo Child", last_name: "A", date_of_birth: "2014-03-02", gender: "female", category: "disability", status: "in_care", admission_date: day(400), referral_channel: "hospital", referral_details: "", guardian_name: "Demo Guardian", guardian_phone: "0700 000 001", home_location: "Narok", school_name: "Demo Primary", school_class: "Grade 5", medical_condition: "Club foot, post-surgery", notes: "", photo_path: "", created_at: stamp(400) },
      { id: childB, first_name: "Demo Child", last_name: "B", date_of_birth: "2011-07-19", gender: "female", category: "rescued", status: "boarding_school", admission_date: day(200), referral_channel: "chief", referral_details: "", guardian_name: "", guardian_phone: "", home_location: "Narok South", school_name: "Demo Secondary", school_class: "Form 2", medical_condition: "", notes: "", photo_path: "", created_at: stamp(200) },
      { id: childC, first_name: "Demo Child", last_name: "C", date_of_birth: "2017-01-11", gender: "male", category: "vulnerable", status: "reintegrated", admission_date: day(700), referral_channel: "family", referral_details: "", guardian_name: "Demo Parent", guardian_phone: "0700 000 003", home_location: "Narok East", school_name: "", school_class: "", medical_condition: "", notes: "", photo_path: "", created_at: stamp(700) },
    ],
    child_events: [
      { id: uid(), child_id: childA, event_date: day(380), type: "medical", title: "Surgery", details: "Corrective surgery completed.", created_at: stamp(380) },
      { id: uid(), child_id: childA, event_date: day(20), type: "follow_up", title: "Physiotherapy check", details: "Walking unaided.", created_at: stamp(20) },
      { id: uid(), child_id: childB, event_date: day(190), type: "case", title: "Case reported to chief", details: "", created_at: stamp(190) },
      { id: uid(), child_id: childA, event_date: day(-4), type: "follow_up", title: "Physiotherapy review", details: "", created_at: stamp(1) },
      { id: uid(), child_id: childB, event_date: day(-15), type: "school", title: "Term report collection", details: "", created_at: stamp(3) },
    ],
    donors: [{ id: uid(), name: "Demo Donor", organisation: "Example Trust", email: "donor@example.com", phone: "", notes: "", created_at: stamp(90) }],
    donations: [
      { id: uid(), donor_id: null, donor_name: "Demo Donor", amount: 5000, currency: "KES", method: "mpesa", reference: "DEMO123", received_on: day(4), purpose: "School fees", notes: "", created_at: stamp(4) },
      { id: uid(), donor_id: null, donor_name: "Sample Church Group", amount: 12000, currency: "KES", method: "bank", reference: "DEMO789", received_on: day(70), purpose: "Medical", notes: "", created_at: stamp(70) },
      { id: uid(), donor_id: null, donor_name: "Demo Friends", amount: 8000, currency: "KES", method: "mpesa", reference: "DEMO321", received_on: day(100), purpose: "General", notes: "", created_at: stamp(100) },
      { id: uid(), donor_id: null, donor_name: "Anonymous", amount: 1000, currency: "KES", method: "mpesa", reference: "DEMO456", received_on: day(35), purpose: "", notes: "", created_at: stamp(35) },
    ],
    volunteers: [{ id: uid(), name: "Demo Volunteer", email: "vol@example.com", phone: "", role: "speaker", status: "active", notes: "", created_at: stamp(50) }],
    outreach_visits: [{ id: uid(), school_name: "Demo Girls Secondary", location: "Narok South", visit_date: day(-9), girls_reached: 0, boys_reached: 0, parents_reached: 0, topics: "Planned: hygiene and staying in school", notes: "", created_at: stamp(2) },
      { id: uid(), school_name: "Demo Mixed Day School", location: "Ololulung'a", visit_date: day(40), girls_reached: 140, boys_reached: 120, parents_reached: 25, topics: "Children's rights", notes: "", created_at: stamp(40) },
      { id: visit1, school_name: "Demo Primary School", location: "Narok", visit_date: day(10), girls_reached: 120, boys_reached: 95, parents_reached: 30, topics: "Menstrual hygiene, staying in school", notes: "", created_at: stamp(10) }],
    distributions: [
      { id: uid(), visit_id: visit1, item: "pads", quantity: 240, distributed_on: day(10), notes: "", created_at: stamp(10) },
      { id: uid(), visit_id: visit1, item: "books", quantity: 60, distributed_on: day(10), notes: "", created_at: stamp(10) },
    ],
  };


  const copy = (x) => JSON.parse(JSON.stringify(x));
  const delay = () => new Promise((r) => setTimeout(r, 120));

  return {
    demo: true,
    async currentUser() { return { email: "demo@namelok" }; },
    async signIn() { return { email: "demo@namelok" }; },
    async signOut() {},
    async isAdmin() { return true; },

    async list(table, { order = "created_at", ascending = false, eq } = {}) {
      await delay();
      let rows = copy(tables[table] || []);
      if (eq) rows = rows.filter((r) => Object.entries(eq).every(([k, v]) => r[k] === v));
      rows.sort((a, b) => (a[order] > b[order] ? 1 : a[order] < b[order] ? -1 : 0) * (ascending ? 1 : -1));
      return rows;
    },
    async insert(table, row) {
      await delay();
      const full = { id: uid(), created_at: new Date().toISOString(), ...row };
      tables[table].push(full);
      return copy(full);
    },
    async update(table, id, row) {
      await delay();
      const found = tables[table].find((r) => r.id === id);
      Object.assign(found, row);
      return copy(found);
    },
    async remove(table, id) {
      await delay();
      tables[table] = tables[table].filter((r) => r.id !== id);
      if (table === "children") tables.child_events = tables.child_events.filter((e) => e.child_id !== id);
    },
    async saveSetting(key, value) {
      await delay();
      tables.site_settings.find((s) => s.key === key).value = value;
    },
    async uploadPublic(file) { return URL.createObjectURL(file); },
    async uploadPrivate(file) { return URL.createObjectURL(file); },
    async privateUrl(path) { return path; },
  };
}
