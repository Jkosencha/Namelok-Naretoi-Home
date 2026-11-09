// Invite a staff member to the dashboard by email.
// Runs on Supabase (Edge Functions), where the service key is kept secret: the website
// never sees it. Only a signed-in admin can call this.
//
//   POST { email, staff_id?, redirect_to }   → sends the invitation email, gives dashboard access
//   POST { action: "remove", user_id }       → takes dashboard access away (the login stays)
//
// Deploy: Supabase → Edge Functions → Deploy a new function → name it "invite-staff" →
// paste this file → Deploy. SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY
// are provided by Supabase automatically.

import { createClient } from "npm:@supabase/supabase-js@2";

// Only the Namelok dashboard may call this from a browser (plus a local copy while developing)
const ALLOWED = [/^https:\/\/namelok-naretoi-home\.netlify\.app$/, /^https:\/\/(www\.)?nameloknaretoi(home)?\.(org|or\.ke)$/, /^http:\/\/localhost(:\d+)?$/];
Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") ?? "";
  const cors: Record<string, string> = {
    "Access-Control-Allow-Origin": ALLOWED.some((re) => re.test(origin)) ? origin : "https://namelok-naretoi-home.netlify.app",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (origin && !ALLOWED.some((re) => re.test(origin))) return reply({ error: "Not allowed from this website." }, 403);
  if (req.method !== "POST") return reply({ error: "Use POST." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Who is asking? Check their session and that they are on the admin list.
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return reply({ error: "Please sign in again." }, 401);
  const { data: isAdmin } = await caller.rpc("is_admin");
  if (isAdmin !== true) return reply({ error: "Only admins can invite or remove staff." }, 403);

  let body: { action?: string; email?: string; staff_id?: string; user_id?: string; redirect_to?: string };
  try { body = await req.json(); } catch { return reply({ error: "Invalid request." }, 400); }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Take away dashboard access
  if (body.action === "remove") {
    if (!body.user_id) return reply({ error: "Missing user." }, 400);
    if (body.user_id === user.id) return reply({ error: "You can't remove your own access." }, 400);
    const { error } = await admin.from("admins").delete().eq("user_id", body.user_id);
    if (error) return reply({ error: error.message }, 500);
    return reply({ ok: true });
  }

  // Invite
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return reply({ error: "Enter a valid email address." }, 400);

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: body.redirect_to });
  if (inviteError) {
    const exists = /already (been )?registered|already exists/i.test(inviteError.message);
    return reply({ error: exists ? "This email already has a login. Use the existing account." : inviteError.message }, exists ? 409 : 500);
  }

  const userId = invited.user.id;
  const { error: adminError } = await admin.from("admins").upsert({ user_id: userId, email }, { onConflict: "user_id" });
  if (adminError) return reply({ error: adminError.message }, 500);
  if (body.staff_id) await admin.from("staff").update({ user_id: userId, email }).eq("id", body.staff_id);

  return reply({ ok: true, user_id: userId });
});
