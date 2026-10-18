-- Namelok Naretoi Home: database for the website and the admin dashboard.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste this file → Run.
-- Safe to re-run: every object is created with IF NOT EXISTS / OR REPLACE.
--
-- Security model
--   * Public website (anon key): can READ published stories, gallery photos and site
--     settings, and can INSERT contact messages. Nothing else.
--   * Admins: users listed in public.admins can read and write everything.
--   * Signed-in users who are NOT in public.admins get nothing, so an accidental
--     sign-up can never see children's records.


-- ─────────────────────────────────────────────────────────────
-- Admin allowlist
-- ─────────────────────────────────────────────────────────────
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Keep updated_at current on every edit
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
