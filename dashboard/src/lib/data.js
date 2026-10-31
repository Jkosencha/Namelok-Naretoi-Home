// Data layer for the dashboard. The rest of the app only calls these methods,
// so it works the same against Supabase or the in-memory demo.

import { createClient } from "@supabase/supabase-js";

export function isConfigured() {
  const cfg = window.NAMELOK_SUPABASE || {};
  return Boolean(cfg.url && cfg.anonKey);
}

// ─────────────────────────────────────────────────────────────
// Supabase
// ─────────────────────────────────────────────────────────────
export async function createSupabaseBackend() {
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
    async privateUrls(paths) {
      const list = [...new Set(paths.filter(Boolean))];
      if (!list.length) return {};
      const data = check(await sb.storage.from("child-files").createSignedUrls(list, 300));
      return Object.fromEntries(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
    },
    async removePrivate(path) {
      if (path) check(await sb.storage.from("child-files").remove([path]));
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
  // crypto.randomUUID needs https (or localhost) and a recent browser; fall back to a random v4-style id
  const uid = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3) | 8).toString(16); }));
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
      ["bank_swift", "", "Bank SWIFT code (for donors abroad)"],
      ["paypal_email", "", "PayPal email"],
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
      { id: childA, first_name: "Demo Child", last_name: "A", date_of_birth: "2014-03-02", gender: "female", category: "disability", status: "in_care", admission_date: day(400), referral_channel: "hospital", referral_details: "", guardian_name: "Demo Guardian", guardian_phone: "0700 000 001", home_location: "Narok", school_name: "Demo Primary", school_class: "", class_track: "cbc", class_level: 6, class_year: new Date().getFullYear() - 1, medical_condition: "Club foot, post-surgery", notes: "", photo_path: "", arrival_photo_path: "", about: "", left_on: null, leaving_note: "", created_at: stamp(400) },
      { id: childB, first_name: "Demo Child", last_name: "B", date_of_birth: "2011-07-19", gender: "female", category: "rescued_girl", status: "boarding_school", admission_date: day(200), referral_channel: "chief", referral_details: "", guardian_name: "", guardian_phone: "", home_location: "Narok South", school_name: "Demo Secondary", school_class: "", class_track: "844", class_level: 1, class_year: new Date().getFullYear(), medical_condition: "", notes: "", photo_path: "", arrival_photo_path: "", about: "", left_on: null, leaving_note: "", created_at: stamp(200) },
      { id: childC, first_name: "Demo Child", last_name: "C", date_of_birth: "2017-01-11", gender: "male", category: "vulnerable", status: "reintegrated", admission_date: day(700), referral_channel: "family", referral_details: "", guardian_name: "Demo Parent", guardian_phone: "0700 000 003", home_location: "Narok East", school_name: "", school_class: "", class_track: "", class_level: null, class_year: null, medical_condition: "", notes: "", photo_path: "", arrival_photo_path: "", about: "", left_on: day(90), leaving_note: "Went home to a parent", created_at: stamp(700) },
      { id: uid(), first_name: "Demo Child", last_name: "D", date_of_birth: "2012-09-30", gender: "male", category: "rescued_boy", status: "in_care", admission_date: day(60), referral_channel: "court", referral_details: "", guardian_name: "", guardian_phone: "", home_location: "Narok North", school_name: "Demo Junior School", school_class: "", class_track: "cbc", class_level: 9, class_year: new Date().getFullYear() - 2, medical_condition: "", notes: "", photo_path: "", arrival_photo_path: "", about: "", left_on: null, leaving_note: "", created_at: stamp(60) },
    ],
    child_events: [
      { id: uid(), child_id: childA, event_date: day(380), type: "medical", title: "Surgery", details: "Corrective surgery completed.", created_at: stamp(380) },
      { id: uid(), child_id: childA, event_date: day(20), type: "follow_up", title: "Physiotherapy check", details: "Walking unaided.", created_at: stamp(20) },
      { id: uid(), child_id: childB, event_date: day(190), type: "case", title: "Case reported to chief", details: "", created_at: stamp(190) },
      { id: uid(), child_id: childA, event_date: day(-4), type: "follow_up", title: "Physiotherapy review", details: "", created_at: stamp(1) },
      { id: uid(), child_id: childB, event_date: day(-15), type: "school", title: "Term report collection", details: "", created_at: stamp(3) },
    ],
    donors: [{ id: uid(), name: "Demo Donor", organisation: "Example Trust", email: "donor@example.com", phone: "", notes: "", giving_pattern: "one_off", currency: "KES", created_at: stamp(90) }],
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
    expenses: [],
    sponsorships: [],
    child_photos: [],
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
      let ageYears = category === "disability" ? between(4, 15) : between(9, 17);
      const r = rand();
      const status = r < 0.55 ? "in_care" : r < 0.8 ? "boarding_school" : r < 0.88 ? "graduated" : r < 0.96 ? "reintegrated" : "exited";
      if (status === "graduated") ageYears = between(18, 20);
      const movedOn = ["graduated", "reintegrated", "exited"].includes(status);
      const leftDaysAgo = movedOn ? between(1, Math.max(2, admittedDaysAgo - 30)) : 0;
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
        notes: "", photo_path: "", arrival_photo_path: "", about: "", created_at: stamp(admittedDaysAgo),
        left_on: movedOn ? day(leftDaysAgo) : null,
        leaving_note: { graduated: "Finished school, now at college", reintegrated: "Went home to an aunt in Narok", exited: "Moved away with family" }[status] || "",
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
  // Two overseas donors give in USD through the bank, at a different rate each time
  const donorDefs = [
    ["Wellspring International", "Wellspring International", "quarterly", "USD"], ["Third Ladder", "Third Ladder", "annual", "USD"],
    ["Narok Town Church", "", "monthly", "KES"], ["Hands of Namelok Initiative", "Hands of Namelok Initiative", "twice_yearly", "KES"],
    ["Amina K.", "", "monthly", "KES"], ["John M.", "", "", "KES"], ["Rotary Club of Narok", "Rotary", "annual", "KES"],
  ];
  const donorRow = {};
  for (const [name, organisation, giving_pattern, currency] of donorDefs) {
    const d = { id: uid(), name, organisation, email: "", phone: "", notes: "", giving_pattern, currency, created_at: stamp(between(400, 700)) };
    tables.donors.push(d); donorRow[name] = d;
  }
  const fxRate = () => Math.round((127.6 + rand() * 4) * 100) / 100;
  const gift = (donor, d, amount, extra = {}) => tables.donations.push({ id: uid(), donor_id: donor ? donor.id : null, donor_name: donor ? donor.name : "Anonymous", amount,
    currency: "KES", original_amount: null, exchange_rate: null, method: "mpesa", reference: "DEMO" + between(1000, 9999), received_on: iso(d), purpose: "General", notes: "", created_at: d.toISOString(), ...extra });
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  // Wellspring: USD 2,500 each quarter for school fees and the sponsored children
  for (let q = 0; q < 5; q++) {
    const d = new Date(now.getFullYear(), now.getMonth() - q * 3, between(3, 12));
    if (d > now) continue;
    const r = fxRate(), usd = q % 2 ? 1500 : 1800;
    gift(donorRow["Wellspring International"], d, Math.round(usd * r - 1500), { currency: "USD", original_amount: usd, exchange_rate: r, method: "bank", reference: "SWIFT" + between(100000, 999999), purpose: "School fees & sponsored children", notes: "KES 1,500 bank charges deducted" });
  }
  // Third Ladder: USD 6,000 once a year for medical care
  for (let y = 0; y < 2; y++) {
    const d = new Date(now.getFullYear() - y, 1, 14);
    if (d > now) continue;
    const r = fxRate();
    gift(donorRow["Third Ladder"], d, Math.round(2500 * r), { currency: "USD", original_amount: 2500, exchange_rate: r, method: "bank", reference: "SWIFT" + between(100000, 999999), purpose: "Medical" });
  }
  // Local gifts in KES
  const locals = ["Narok Town Church", "Hands of Namelok Initiative", "Amina K.", "John M.", "Rotary Club of Narok", null];
  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const busy = [0, 4].includes(monthStart.getMonth()) ? 2 : 1;
    for (let k = 0; k < between(1, 3) * busy; k++) {
      const name = pick(locals);
      const d = new Date(monthStart.getFullYear(), monthStart.getMonth(), between(1, 27));
      if (d > now) continue;
      const big = rand() < 0.15;
      gift(name && donorRow[name], d, big ? between(20, 80) * 1000 : between(5, 60) * 100,
        { method: big ? "bank" : pick(["mpesa", "mpesa", "mpesa", "cash"]), purpose: pick(["School fees", "Medical", "General", "Sanitary pads", "Food"]) });
    }
  }

  // Sponsorships: Wellspring sponsors three children, Amina K. one
  const sponsorable = tables.children.filter((c) => ["in_care", "boarding_school"].includes(c.status));
  [["Wellspring International", 0, 300, "USD", "quarterly"], ["Wellspring International", 1, 300, "USD", "quarterly"], ["Wellspring International", 5, 300, "USD", "quarterly"], ["Amina K.", 2, 3000, "KES", "monthly"]]
    .forEach(([name, i, amount, currency, frequency]) => tables.sponsorships.push({ id: uid(), donor_id: donorRow[name].id, child_id: sponsorable[i].id, started_on: day(between(200, 500)), ended_on: null, amount, currency, frequency, notes: currency === "USD" ? "Covers school fees, uniform and books" : "Covers upkeep at the home", created_at: stamp(200) }));

  // A year of expenses, some paid from a donor's funds, most with a scanned receipt
  const demoReceipt = (n) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420"><rect width="300" height="420" fill="#fbfaf6"/><text x="150" y="50" font-family="monospace" font-size="18" text-anchor="middle">DEMO RECEIPT</text><text x="150" y="76" font-family="monospace" font-size="12" text-anchor="middle" fill="#666">No. ${n}</text>${[0, 1, 2, 3, 4].map((i) => `<rect x="30" y="${110 + i * 34}" width="${150 + ((n * (i + 3)) % 80)}" height="10" fill="#ddd"/>`).join("")}<rect x="30" y="300" width="240" height="2" fill="#bbb"/><text x="30" y="335" font-family="monospace" font-size="14">TOTAL</text><rect x="180" y="323" width="90" height="14" fill="#ccc"/></svg>`);
  const spend = (d, description, category, amount, donor, child, vendor) => {
    const n = between(1000, 9999);
    tables.expenses.push({ id: uid(), spent_on: iso(d), description, category, amount, donor_id: donor ? donor.id : null, child_id: child ? child.id : null, vendor,
      receipt_path: rand() < 0.85 ? demoReceipt(n) : "", receipt_name: "receipt-" + n + ".jpg", notes: "", created_at: d.toISOString(), updated_at: d.toISOString() });
  };
  const sponsored = tables.sponsorships.map((s) => tables.children.find((c) => c.id === s.child_id));
  for (let m = 0; m < 12; m++) {
    const at = (day) => { const d = new Date(now.getFullYear(), now.getMonth() - m, day); return d > now ? null : d; };
    const month = new Date(now.getFullYear(), now.getMonth() - m, 1).getMonth();
    let d;
    if ((d = at(5))) spend(d, "Food supplies for the month", "food", between(38, 52) * 1000, m % 2 ? donorRow["Wellspring International"] : null, null, "Narok Wholesalers");
    if ((d = at(9))) spend(d, "Water and electricity", "utilities", between(6, 9) * 1000, null, null, "Kenya Power");
    if ([0, 4, 8].includes(month)) {
      sponsored.slice(0, 3).forEach((c, i) => { if ((d = at(10 + i))) spend(d, `Term ${[0, 4, 8].indexOf(month) + 1} school fees`, "school_fees", between(14, 22) * 1000, donorRow["Wellspring International"], c, c.school_name || "School") });
      if ((d = at(14))) spend(d, "Uniforms and exercise books", "school_items", between(18, 30) * 1000, donorRow["Wellspring International"], null, "Narok Uniform House");
      if ((d = at(16))) spend(d, "School fees for other children", "school_fees", between(60, 90) * 1000, null, null, "Various schools");
    }
    if (rand() < 0.8 && (d = at(between(12, 25)))) spend(d, pick(["Hospital review and medicine", "Physiotherapy sessions", "Clinic visit"]), "medical", between(8, 28) * 1000, rand() < 0.85 ? donorRow["Third Ladder"] : null, pick(tables.children), "Narok County Referral Hospital");
    if (rand() < 0.4 && (d = at(between(10, 26)))) spend(d, "Sanitary pads for school outreach", "hygiene", between(8, 15) * 1000, null, null, "Supplier");
    if (rand() < 0.5 && (d = at(between(1, 27)))) spend(d, "Transport to schools and hospital", "transport", between(2, 6) * 1000, null, null, "Matatu / fuel");
    if ((d = at(28))) spend(d, "Bank charges", "admin", between(4, 9) * 100, null, null, "Bank");
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

  // Demo photos: plain drawn placeholders, never pictures of real children
  const demoPhoto = (hue, scene) => {
    const ground = scene % 3 === 0 ? `<rect y="300" width="400" height="100" fill="hsl(${hue} 30% 72%)"/>` : scene % 3 === 1 ? `<circle cx="330" cy="80" r="34" fill="hsl(45 90% 80%)"/>` : `<rect x="40" y="60" width="90" height="70" rx="6" fill="hsl(${hue} 35% 82%)"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue} 45% 88%)"/><stop offset="1" stop-color="hsl(${hue} 35% 76%)"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/>${ground}<circle cx="200" cy="170" r="52" fill="hsl(${hue} 25% 52%)"/><path d="M110 400c0-70 40-130 90-130s90 60 90 130z" fill="hsl(${hue} 25% 52%)"/><text x="200" y="384" font-family="sans-serif" font-size="15" text-anchor="middle" fill="hsl(${hue} 30% 30%)" opacity=".7">Demo photo</text></svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  };
  const captions = ["First day at the home", "Back to school", "After physiotherapy", "Christmas at the home", "Sports day", "With the other children", "Prize giving day", "Visiting home"];
  const abouts = [
    "A cheerful child who loves singing and helping in the kitchen. Settled in quickly and now has many friends at the home.",
    "Quiet at first, now confident in class. Enjoys drawing and football, and wants to become a nurse.",
    "Loves reading and is always the first to the classroom. Has made great progress since coming to the home.",
  ];
  tables.children.slice(4, 16).forEach((c, i) => {
    const hue = (i * 47) % 360;
    c.about = abouts[i % abouts.length];
    c.arrival_photo_path = demoPhoto(hue, 0);
    c.photo_path = demoPhoto((hue + 25) % 360, 1);
    const admitted = Math.round((now - new Date(c.admission_date)) / 86400000);
    for (let n = 0; n < 2 + (i % 4); n++) {
      const ago = Math.round(admitted * (1 - (n + 1) / 6));
      tables.child_photos.push({ id: uid(), child_id: c.id, path: demoPhoto((hue + 60 + n * 35) % 360, n + 2), caption: captions[(i + n) % captions.length], taken_on: day(ago), created_at: stamp(ago) });
    }
  });

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
      if (table === "children") {
        tables.child_events = tables.child_events.filter((e) => e.child_id !== id);
        tables.child_photos = tables.child_photos.filter((e) => e.child_id !== id);
        tables.sponsorships = tables.sponsorships.filter((e) => e.child_id !== id);
        tables.expenses.forEach((e) => { if (e.child_id === id) e.child_id = null; });
      }
      if (table === "donors") {
        tables.sponsorships = tables.sponsorships.filter((e) => e.donor_id !== id);
        tables.expenses.forEach((e) => { if (e.donor_id === id) e.donor_id = null; });
        tables.donations.forEach((e) => { if (e.donor_id === id) e.donor_id = null; });
        tables.reports.forEach((e) => { if (e.donor_id === id) e.donor_id = null; });
      }
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
    async privateUrls(paths) { return Object.fromEntries(paths.filter(Boolean).map((p) => [p, p])); },
    async removePrivate() {},
  };
}
