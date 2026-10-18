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

-- ─────────────────────────────────────────────────────────────
-- Public website content
-- ─────────────────────────────────────────────────────────────

-- Key/value settings shown on the site: stats, contact details, payment details
create table if not exists public.site_settings (
  key        text primary key,
  value      text not null default '',
  label      text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.stories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title       text not null check (char_length(title) between 1 and 200),
  child_name  text not null default '',
  age         text not null default '',
  category    text not null default 'rescue' check (category in ('rescue', 'disability', 'education', 'community')),
  summary     text not null default '',
  body        text not null default '',
  image_url   text not null default '',
  featured    boolean not null default false,
  published   boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.gallery_photos (
  id          uuid primary key default gen_random_uuid(),
  image_url   text not null,
  caption     text not null default '',
  category    text not null default 'home' check (category in ('home', 'school', 'health')),
  published   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Messages from the website contact form
create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  first_name  text not null check (char_length(first_name) between 1 and 100),
  last_name   text not null default '' check (char_length(last_name) <= 100),
  email       text not null check (char_length(email) between 3 and 200),
  reason      text not null default '' check (char_length(reason) <= 100),
  message     text not null check (char_length(message) between 1 and 5000),
  status      text not null default 'new' check (status in ('new', 'read', 'replied', 'archived')),
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Private: children and their care
-- ─────────────────────────────────────────────────────────────
create table if not exists public.children (
  id                uuid primary key default gen_random_uuid(),
  first_name        text not null,
  last_name         text not null default '',
  date_of_birth     date,
  gender            text not null default '' check (gender in ('', 'female', 'male')),
  category          text not null default 'disability' check (category in ('disability', 'rescued', 'vulnerable')),
  status            text not null default 'in_care' check (status in ('in_care', 'boarding_school', 'reintegrated', 'exited')),
  admission_date    date,
  referral_channel  text not null default '' check (referral_channel in ('', 'chief', 'do', 'dc', 'court', 'hospital', 'school', 'family', 'self', 'other')),
  referral_details  text not null default '',
  guardian_name     text not null default '',
  guardian_phone    text not null default '',
  home_location     text not null default '',
  school_name       text not null default '',
  school_class      text not null default '',
  medical_condition text not null default '',
  notes             text not null default '',
  photo_path        text not null default '',  -- path inside the private "child-files" bucket
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Timeline for each child: surgeries, follow-ups, school reports, court dates…
create table if not exists public.child_events (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null references public.children (id) on delete cascade,
  event_date  date not null default current_date,
  type        text not null default 'other' check (type in ('medical', 'school', 'case', 'follow_up', 'other')),
  title       text not null,
  details     text not null default '',
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Private: donations
-- ─────────────────────────────────────────────────────────────
create table if not exists public.donors (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  organisation  text not null default '',
  email         text not null default '',
  phone         text not null default '',
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.donations (
  id           uuid primary key default gen_random_uuid(),
  donor_id     uuid references public.donors (id) on delete set null,
  donor_name   text not null default '',
  amount       numeric(12, 2) not null check (amount >= 0),
  currency     text not null default 'KES',
  method       text not null default 'mpesa' check (method in ('mpesa', 'bank', 'paypal', 'cash', 'in_kind')),
  reference    text not null default '',
  received_on  date not null default current_date,
  purpose      text not null default '',
  notes        text not null default '',
  created_at   timestamptz not null default now()
);
