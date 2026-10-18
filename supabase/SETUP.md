# Setting up the dashboard

The dashboard (`admin/`) and the website store their data in [Supabase](https://supabase.com), a hosted database with secure logins and photo storage. The free plan is enough for Namelok. Setup takes about 15 minutes and only needs doing once.

## 1. Create the Supabase project

1. Sign up at supabase.com and click **New project**.
2. Name it `namelok`, choose a strong database password (save it somewhere safe), and pick the region closest to Kenya (e.g. *Frankfurt* or *London*).
3. Wait a minute or two for the project to start.

## 2. Create the tables

1. In the project, open **SQL Editor → New query**.
2. Paste the whole of `supabase/schema.sql` and click **Run**.
3. Open another new query, paste `supabase/seed.sql` and click **Run**. This copies in the stories and gallery photos the website shows today.

Both files are safe to run again later; they never delete data.

## 3. Lock down sign-ups

Only people you add should be able to sign in.

1. Go to **Authentication → Sign In / Providers** (or **Providers → Email**).
2. Turn **off** "Allow new users to sign up".

## 4. Add the admins (one or two people)

For each admin:

1. **Authentication → Users → Add user → Create new user.** Enter their email and a strong password, and tick **Auto confirm user**.
2. Copy the new user's **UID** from the users list.
3. In **SQL Editor**, run (with their UID and email):

   ```sql
   insert into public.admins (user_id, email)
   values ('PASTE-THE-UID-HERE', 'their@email.com');
   ```

A signed-in account that is **not** in this list can't see anything, so a forgotten test account can never open children's records.

To remove someone's access later: `delete from public.admins where email = 'their@email.com';`, then delete the user under **Authentication → Users**.

## 5. Connect the website and dashboard

1. Open **Project Settings → API**.
2. Copy the **Project URL** and the **anon / public** key into `js/supabase-config.js`:

   ```js
   window.NAMELOK_SUPABASE = {
     url: "https://xxxxxxxx.supabase.co",
     anonKey: "eyJhbGciOi...",
   };
   ```

   The anon key is meant to be public; the database's security rules decide what it can see. **Never** put the `service_role` key in this file or anywhere on the website.
3. Publish the site. The dashboard is at `/admin/` (for example `https://your-site/admin/`).

## What the public can and can't see

| Data | Public website | Admins |
|---|---|---|
| Published stories, gallery photos, stats, contact & payment details | Read only | Full access |
| Draft stories, hidden photos | Hidden | Full access |
| Contact form | Can send a message, can't read any | Full access |
| Children, timelines, donations, donors, volunteers, school visits, items | No access | Full access |
| Children's photos (private storage) | No access | Viewable through 5-minute links |

Every change to children, timelines, donations and donors is recorded in `audit_log` (who and when, not the contents). Admins are signed out after 30 minutes without activity.

## Good practice for children's records

- Only record what you need to care for the child.
- Use the dashboard on trusted devices, and sign out on shared computers.
- On the public website, use a first name or a changed name in stories, and only publish photos where the child and guardian are comfortable.
- Supabase's free plan keeps daily backups for a short period. For long-term safety, export the data now and then (**Table Editor → table → Export to CSV**) and store it securely.
