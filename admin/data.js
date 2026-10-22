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
    // Private documents (reports, proposals, contracts): short-lived download links only
    async uploadDocument(file, folder = "reports") {
      const path = `${folder}/${Date.now()}-${safeName(file.name)}`;
      check(await sb.storage.from("documents").upload(path, file, { upsert: false }));
      return path;
    },
    async documentUrl(path, downloadName) {
      if (!path) return "";
      const data = check(await sb.storage.from("documents").createSignedUrl(path, 300, downloadName ? { download: downloadName } : undefined));
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
      { id: childA, first_name: "Demo Child", last_name: "A", date_of_birth: "2014-03-02", gender: "female", category: "disability", status: "in_care", admission_date: day(400), referral_channel: "hospital", referral_details: "", guardian_name: "Demo Guardian", guardian_phone: "0700 000 001", home_location: "Narok", school_name: "Demo Primary", school_class: "", class_track: "cbc", class_level: 6, class_year: new Date().getFullYear() - 1, medical_condition: "Club foot, post-surgery", notes: "", photo_path: "", created_at: stamp(400) },
      { id: childB, first_name: "Demo Child", last_name: "B", date_of_birth: "2011-07-19", gender: "female", category: "rescued_girl", status: "boarding_school", admission_date: day(200), referral_channel: "chief", referral_details: "", guardian_name: "", guardian_phone: "", home_location: "Narok South", school_name: "Demo Secondary", school_class: "", class_track: "844", class_level: 1, class_year: new Date().getFullYear(), medical_condition: "", notes: "", photo_path: "", created_at: stamp(200) },
      { id: childC, first_name: "Demo Child", last_name: "C", date_of_birth: "2017-01-11", gender: "male", category: "vulnerable", status: "reintegrated", admission_date: day(700), referral_channel: "family", referral_details: "", guardian_name: "Demo Parent", guardian_phone: "0700 000 003", home_location: "Narok East", school_name: "", school_class: "", class_track: "", class_level: null, class_year: null, medical_condition: "", notes: "", photo_path: "", created_at: stamp(700) },
      { id: uid(), first_name: "Demo Child", last_name: "D", date_of_birth: "2012-09-30", gender: "male", category: "rescued_boy", status: "in_care", admission_date: day(60), referral_channel: "court", referral_details: "", guardian_name: "", guardian_phone: "", home_location: "Narok North", school_name: "Demo Junior School", school_class: "", class_track: "cbc", class_level: 9, class_year: new Date().getFullYear() - 2, medical_condition: "", notes: "", photo_path: "", created_at: stamp(60) },
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
    reports: [],
    calendar_events: [],
    distributions: [
      { id: uid(), visit_id: visit1, item: "pads", quantity: 240, distributed_on: day(10), notes: "", created_at: stamp(10) },
      { id: uid(), visit_id: visit1, item: "books", quantity: 60, distributed_on: day(10), notes: "", created_at: stamp(10) },
    ],
  };


  // ── A fuller year of invented activity so the charts have something to show ──
  // Fixed seed: the demo looks the same every time. Every surname is "Demo".
  let seed = 20261019;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const between = (a, b) => Math.floor(a + rand() * (b - a + 1));
  const thisYear = now.getFullYear();
  const girls = ["Naserian", "Nashipai", "Sein", "Nkoitiko", "Resiato", "Silantoi", "Naisula", "Kasaine", "Nalangu", "Simaloi", "Faith", "Mercy", "Joy", "Grace", "Esther", "Lucy"];
  const boys = ["Lemayian", "Saitoti", "Kiprono", "Parsanka", "Olekina", "Tajeu", "Ntimama", "Sankale", "Brian", "Kevin", "Dennis", "Peter", "Moses", "Daniel"];
  const areas = ["Narok", "Narok South", "Narok North", "Ololulung'a", "Ntulele", "Suswa", "Mulot", "Nairage Ngare"];
  const schools = ["Ilmashariani Primary", "Ololulung'a Primary", "Narok Township Primary", "Maasai Girls Secondary", "Narok Boys High", "Ntulele Mixed Secondary", "Narok Special Unit", "Mulot Junior School"];
  const plan = [["rescued_girl", 14], ["rescued_boy", 6], ["disability", 12], ["vulnerable", 6]];
  for (const [category, count] of plan) {
    for (let i = 0; i < count; i++) {
      const female = category === "rescued_girl" ? true : category === "rescued_boy" ? false : rand() < 0.55;
      const id = uid();
      const admittedDaysAgo = between(5, 1100);
      const ageYears = category === "disability" ? between(4, 15) : between(9, 17);
      const r = rand();
      const status = r < 0.55 ? "in_care" : r < 0.82 ? "boarding_school" : r < 0.95 ? "reintegrated" : "exited";
      // School class for this year, chosen to fit the child's age
      let track = "cbc", level = Math.max(0, Math.min(13, ageYears - 4));
      if (category === "disability" && rand() < 0.3) { track = "special"; level = null; }
      else if (ageYears >= 16 && rand() < 0.5) { track = "844"; level = Math.min(3, ageYears - 16 + between(0, 1)); }
      const recordedYearsAgo = level == null ? 0 : Math.min(between(0, 2), level);
      tables.children.push({
        id, first_name: female ? pick(girls) : pick(boys), last_name: "Demo",
        date_of_birth: `${thisYear - ageYears}-${String(between(1, 12)).padStart(2, "0")}-${String(between(1, 28)).padStart(2, "0")}`,
        gender: female ? "female" : "male", category, status, admission_date: day(admittedDaysAgo),
        referral_channel: category.startsWith("rescued") ? pick(["chief", "chief", "do", "court", "school", "self"]) : pick(["hospital", "family", "chief", "school"]),
        referral_details: "", guardian_name: "", guardian_phone: "", home_location: pick(areas),
        school_name: track === "special" ? "Narok Special Unit" : pick(schools),
        school_class: track === "special" ? pick(["Unit A", "Unit B, level 2", "Vocational skills"]) : "",
        class_track: track, class_level: level == null ? null : level - recordedYearsAgo, class_year: level == null ? null : thisYear - recordedYearsAgo,
        medical_condition: category === "disability" ? pick(["Club foot, post-surgery", "Cerebral palsy", "Hearing impairment", "Spina bifida", "Contractures, in rehabilitation"]) : "",
        notes: "", photo_path: "", created_at: stamp(admittedDaysAgo),
      });
      // A few timeline entries each, some of them in the coming weeks
      for (let e = 0; e < between(1, 3); e++) {
        const daysAgo = between(-45, admittedDaysAgo);
        const type = category === "disability" ? pick(["medical", "follow_up", "school"]) : pick(["case", "school", "follow_up"]);
        const titles = { medical: "Hospital review", follow_up: "Follow-up visit", school: "School report", case: "Case update with the chief" };
        tables.child_events.push({ id: uid(), child_id: id, event_date: day(daysAgo), type, title: titles[type], details: "", created_at: stamp(daysAgo > 0 ? daysAgo : between(3, 40)) });
      }
    }
  }

  // Donors and a year of donations (school-fee season in January and May is busier)
  const donorNames = [["Wellspring International", "Wellspring International"], ["Narok Town Church", ""], ["Hands of Namelok Initiative", "Hands of Namelok Initiative"], ["Third Ladder", "Third Ladder"], ["Amina K.", ""], ["John M.", ""], ["Rotary Club of Narok", "Rotary"], ["Anonymous", ""]];
  for (const [name, organisation] of donorNames.slice(0, 7)) tables.donors.push({ id: uid(), name, organisation, email: "", phone: "", notes: "", created_at: stamp(between(100, 600)) });
  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const busy = [0, 4].includes(monthStart.getMonth()) ? 2 : 1;
    for (let k = 0; k < between(2, 4) * busy; k++) {
      const [name] = pick(donorNames);
      const d = new Date(monthStart.getFullYear(), monthStart.getMonth(), between(1, 27));
      if (d > now) continue;
      const big = rand() < 0.15;
      tables.donations.push({ id: uid(), donor_id: null, donor_name: name, amount: big ? between(20, 80) * 1000 : between(5, 60) * 100,
        currency: "KES", method: big ? "bank" : pick(["mpesa", "mpesa", "mpesa", "cash", "paypal"]), reference: "DEMO" + between(1000, 9999),
        received_on: d.toISOString().slice(0, 10), purpose: pick(["School fees", "Medical", "General", "Sanitary pads", "Food"]), notes: "", created_at: d.toISOString() });
    }
  }

  // School visits through the year, a few planned ahead, with items handed out
  for (let v = 0; v < 18; v++) {
    const daysAgo = v < 3 ? -between(5, 50) : between(3, 360);
    const planned = daysAgo < 0;
    const id = uid();
    const girlsReached = planned ? 0 : between(40, 220), boysReached = planned ? 0 : between(30, 180);
    tables.outreach_visits.push({ id, school_name: pick(schools.filter((x) => !x.includes("Special"))), location: pick(areas), visit_date: day(daysAgo),
      girls_reached: girlsReached, boys_reached: boysReached, parents_reached: planned ? 0 : between(0, 60),
      topics: pick(["Menstrual hygiene", "Staying in school", "Children's rights", "FGM and early marriage", "Body safety and abstinence"]), notes: planned ? "Planned" : "", created_at: stamp(planned ? between(2, 30) : daysAgo + 2) });
    if (!planned) {
      tables.distributions.push({ id: uid(), visit_id: id, item: "pads", quantity: girlsReached * 2, distributed_on: day(daysAgo), notes: "", created_at: stamp(daysAgo) });
      for (const item of ["panties", "boxers", "books", "balls", "socks"]) if (rand() < 0.45) tables.distributions.push({ id: uid(), visit_id: id, item, quantity: item === "balls" ? between(2, 10) : between(20, 120), distributed_on: day(daysAgo), notes: "", created_at: stamp(daysAgo) });
    }
  }

  // Messages from the website and volunteers
  const reasons = ["General Inquiry", "Partnership / Sponsorship", "Volunteering", "Donation Question", "Media / Press"];
  for (let i = 0; i < 16; i++) {
    const daysAgo = between(0, 200);
    tables.contact_messages.push({ id: uid(), first_name: pick([...girls, ...boys]), last_name: "Demo", email: "visitor@example.com", reason: pick(reasons),
      message: "This is an invented demo message.", status: daysAgo < 20 ? pick(["new", "new", "read"]) : pick(["read", "replied", "archived"]), created_at: stamp(daysAgo) });
  }
  for (let i = 0; i < 9; i++) tables.volunteers.push({ id: uid(), name: pick([...girls, ...boys]) + " Demo", email: "", phone: "", role: pick(["speaker", "mentor", "outreach", "donations"]), status: pick(["active", "active", "contacted", "new", "inactive"]), notes: "", created_at: stamp(between(10, 400)) });

  // Two saved reports so the Reports page has something to show
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  tables.reports.push(
    { id: uid(), title: `Monthly report – ${lastMonth.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`, kind: "monthly", period_start: iso(lastMonth), period_end: iso(lmEnd), donor_id: null, donor_name: "", status: "final",
      summary: "An invented demo summary: a steady month at the home with new admissions and three school visits.", highlights: "Demo highlight: two children moved up to secondary school.", challenges: "Demo challenge: school fees for the new term.", next_steps: "Demo next step: plan the December holiday programme.", figures: null, file_path: "", file_name: "", created_at: stamp(15) },
    { id: uid(), title: "Annual report 2025 (uploaded)", kind: "annual", period_start: `${now.getFullYear() - 1}-01-01`, period_end: `${now.getFullYear() - 1}-12-31`, donor_id: null, donor_name: "Wellspring International", status: "final",
      summary: "", highlights: "", challenges: "", next_steps: "", figures: null, file_path: "", file_name: "annual-report-2025.pdf", created_at: stamp(280) }
  );

  // Calendar: meetings, board meetings, donor visits and holidays around this month
  const onDay = (d) => iso(new Date(now.getFullYear(), now.getMonth(), d));
  [
    [3, "Staff meeting", "meeting", "09:00", "Namelok office"],
    [7, "Board meeting", "board", "10:00", "Narok Town Hall"],
    [12, "Wellspring International visit", "donor", "11:30", "Namelok Naretoi Home"],
    [18, "Staff meeting", "meeting", "09:00", "Namelok office"],
    [21, "Community forum on girls' education", "event", "14:00", "Ntulele"],
    [26, "Rotary Club of Narok lunch", "donor", "13:00", "Narok"],
    [31, "Staff meeting", "meeting", "09:00", "Namelok office"],
    [38, "Board meeting", "board", "10:00", "Narok Town Hall"],
    [45, "Christmas holiday", "holiday", "", ""],
  ].forEach(([d, title, kind, start_time, location]) => tables.calendar_events.push({ id: uid(), title, kind, starts_on: onDay(d), ends_on: kind === "holiday" ? onDay(d + 6) : null, start_time, location, notes: "", created_at: stamp(20) }));

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
    async uploadDocument(file) { return URL.createObjectURL(file); },
    async documentUrl(path) { return path; },
    async privateUrl(path) { return path; },
  };
}
