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
  category          text not null default 'disability' check (category in ('disability', 'rescued_girl', 'rescued_boy', 'vulnerable')),
  status            text not null default 'in_care' constraint children_status_check
                      check (status in ('in_care', 'boarding_school', 'graduated', 'reintegrated', 'exited')),
  left_on           date,                      -- when they finished school, went home or left
  leaving_note      text not null default '',
  admission_date    date,
  referral_channel  text not null default '' check (referral_channel in ('', 'chief', 'do', 'dc', 'court', 'hospital', 'school', 'family', 'self', 'other')),
  referral_details  text not null default '',
  guardian_name     text not null default '',
  guardian_phone    text not null default '',
  home_location     text not null default '',
  school_name       text not null default '',
  school_class      text not null default '',  -- extra class details, e.g. for a special needs unit
  -- Class moves up automatically: current class = class_level + years since class_year
  class_track       text not null default '' check (class_track in ('', 'cbc', '844', 'tertiary', 'special', 'none')),
  class_level       integer check (class_level is null or class_level >= 0),
  class_year        integer,
  medical_condition text not null default '',
  notes             text not null default '',
  photo_path        text not null default '',  -- how the child looks now (private "child-files" bucket)
  arrival_photo_path text not null default '', -- how the child looked when they came
  about             text not null default '',  -- a short description
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Current class for a child, worked out from the class and the year it was set (for reports and exports):
--    select first_name, public.current_class(class_track, class_level, class_year) from public.children;
create or replace function public.current_class(track text, level integer, set_year integer)
returns text
language sql
stable
as $$
  with ladder as (
    select case track
      when 'cbc' then array['PP1','PP2','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6',
                            'Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12']
      when '844' then array['Form 1','Form 2','Form 3','Form 4']
      when 'tertiary' then array['Year 1','Year 2','Year 3','Year 4']
    end as classes
  ), now_level as (
    select classes, level + greatest(extract(year from current_date)::int - set_year, 0) as n from ladder
  )
  select case
    when track = 'special' then 'Special needs unit'
    when track = 'none' then 'Not in school'
    when classes is null or level is null or set_year is null then ''
    when n >= array_length(classes, 1) then 'Finished ' || classes[array_length(classes, 1)]
    else classes[n + 1]
  end
  from now_level;
$$;

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

-- A small photo gallery for each child (private "child-files" bucket)
create table if not exists public.child_photos (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null references public.children (id) on delete cascade,
  path        text not null,
  caption     text not null default '' check (char_length(caption) <= 300),
  taken_on    date,
  created_at  timestamptz not null default now()
);
create index if not exists child_photos_child on public.child_photos (child_id, taken_on);

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
  giving_pattern text not null default '' constraint donors_giving_pattern_check
                   check (giving_pattern in ('', 'one_off', 'monthly', 'quarterly', 'twice_yearly', 'annual')),
  currency      text not null default 'KES',   -- the currency they usually give in
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.donations (
  id           uuid primary key default gen_random_uuid(),
  donor_id     uuid references public.donors (id) on delete set null,
  donor_name   text not null default '',
  amount       numeric(12, 2) not null check (amount >= 0),   -- received, in KES
  currency     text not null default 'KES' constraint donations_currency_check check (currency in ('KES', 'USD', 'GBP', 'EUR')),
  original_amount numeric(12, 2) check (original_amount is null or original_amount >= 0),  -- e.g. 1000 (USD)
  exchange_rate   numeric(12, 4) check (exchange_rate is null or exchange_rate > 0),       -- e.g. 129.50
  method       text not null default 'mpesa' check (method in ('mpesa', 'bank', 'paypal', 'cash', 'in_kind')),
  reference    text not null default '',
  received_on  date not null default current_date,
  purpose      text not null default '',
  notes        text not null default '',
  created_at   timestamptz not null default now()
);

-- Money spent, optionally from one donor's funds, with a scanned receipt ("documents" folder)
create table if not exists public.expenses (
  id            uuid primary key default gen_random_uuid(),
  spent_on      date not null default current_date,
  description   text not null check (char_length(description) between 1 and 300),
  category      text not null default 'other' check (category in ('school_fees', 'school_items', 'medical', 'food', 'clothing',
                    'hygiene', 'transport', 'utilities', 'building', 'outreach', 'admin', 'other')),
  amount        numeric(12, 2) not null check (amount >= 0),          -- KES
  donor_id      uuid references public.donors (id) on delete set null, -- null = general funds
  child_id      uuid references public.children (id) on delete set null,
  vendor        text not null default '',
  receipt_path  text not null default '',
  receipt_name  text not null default '',
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists expenses_donor on public.expenses (donor_id, spent_on);

-- A donor supporting a specific child
create table if not exists public.sponsorships (
  id          uuid primary key default gen_random_uuid(),
  donor_id    uuid not null references public.donors (id) on delete cascade,
  child_id    uuid not null references public.children (id) on delete cascade,
  started_on  date,
  ended_on    date,
  amount      numeric(12, 2) check (amount is null or amount >= 0),
  currency    text not null default 'KES' check (currency in ('KES', 'USD', 'GBP', 'EUR')),
  frequency   text not null default '' check (frequency in ('', 'one_off', 'monthly', 'quarterly', 'twice_yearly', 'annual')),
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  check (ended_on is null or started_on is null or ended_on >= started_on)
);

-- ─────────────────────────────────────────────────────────────
-- Private: volunteers and school outreach
-- ─────────────────────────────────────────────────────────────
create table if not exists public.volunteers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null default '',
  phone       text not null default '',
  role        text not null default 'other' check (role in ('speaker', 'mentor', 'outreach', 'donations', 'other')),
  status      text not null default 'new' check (status in ('new', 'contacted', 'active', 'inactive')),
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.outreach_visits (
  id               uuid primary key default gen_random_uuid(),
  school_name      text not null,
  location         text not null default '',
  visit_date       date not null default current_date,
  girls_reached    integer not null default 0 check (girls_reached >= 0),
  boys_reached     integer not null default 0 check (boys_reached >= 0),
  parents_reached  integer not null default 0 check (parents_reached >= 0),
  topics           text not null default '',
  notes            text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Items handed out (pads, panties, boxers, balls, socks, books…), optionally tied to a visit
create table if not exists public.distributions (
  id              uuid primary key default gen_random_uuid(),
  visit_id        uuid references public.outreach_visits (id) on delete set null,
  item            text not null check (item in ('pads', 'panties', 'boxers', 'balls', 'socks', 'books', 'other')),
  quantity        integer not null check (quantity > 0),
  distributed_on  date not null default current_date,
  notes           text not null default '',
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Audit trail for sensitive tables: who changed which record, and when.
-- Stores no record contents, only the fact of the change.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  record_id   uuid,
  action      text not null,
  user_id     uuid,
  at          timestamptz not null default now()
);

create or replace function public.write_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (table_name, record_id, action, user_id)
  values (tg_table_name, coalesce(new.id, old.id), tg_op, auth.uid());
  return coalesce(new, old);
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Triggers
-- ─────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['site_settings', 'stories', 'gallery_photos', 'children', 'donors', 'volunteers', 'outreach_visits', 'expenses']
  loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
  foreach t in array array['children', 'child_events', 'child_photos', 'donations', 'donors', 'expenses', 'sponsorships']
  loop
    execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.write_audit()', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['admins', 'site_settings', 'stories', 'gallery_photos', 'contact_messages', 'children',
                           'child_events', 'child_photos', 'donors', 'donations', 'expenses', 'sponsorships', 'volunteers', 'outreach_visits', 'distributions', 'audit_log']
  loop
    execute format('alter table public.%I enable row level security', t);
    -- Admins: full access to everything (audit_log is read-only, see below)
    execute format('drop policy if exists admin_all on public.%I', t);
    if t = 'audit_log' then
      execute format('create policy admin_all on public.%I for select to authenticated using (public.is_admin())', t);
    else
      execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    end if;
  end loop;
end $$;

-- Public website: read published content
drop policy if exists public_read on public.site_settings;
create policy public_read on public.site_settings for select to anon, authenticated using (true);

drop policy if exists public_read on public.stories;
create policy public_read on public.stories for select to anon, authenticated using (published);

drop policy if exists public_read on public.gallery_photos;
create policy public_read on public.gallery_photos for select to anon, authenticated using (published);

-- Public website: send a contact message (cannot read any back)
drop policy if exists public_insert on public.contact_messages;
create policy public_insert on public.contact_messages for insert to anon, authenticated
  with check (status = 'new');

-- Table privileges (RLS above decides which rows)
grant usage on schema public to anon, authenticated;
grant select on public.site_settings, public.stories, public.gallery_photos to anon;
grant insert (first_name, last_name, email, reason, message) on public.contact_messages to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.audit_log from authenticated;

-- ─────────────────────────────────────────────────────────────
-- File storage
--   site-media  : public photos used on the website (anyone can view, admins upload)
--   child-files : private photos/documents for children's records (admins only)
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('site-media', 'site-media', true), ('child-files', 'child-files', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists site_media_admin_write on storage.objects;
create policy site_media_admin_write on storage.objects for all to authenticated
  using (bucket_id = 'site-media' and public.is_admin())
  with check (bucket_id = 'site-media' and public.is_admin());

drop policy if exists child_files_admin on storage.objects;
create policy child_files_admin on storage.objects for all to authenticated
  using (bucket_id = 'child-files' and public.is_admin())
  with check (bucket_id = 'child-files' and public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- Starting content (matches what the website shows today)
-- ─────────────────────────────────────────────────────────────
insert into public.site_settings (key, value, label) values
  ('founded_year',       '1991', 'Year founded (years of service is counted from this)'),
  ('children_supported', '350',  'Children supported'),
  ('girls_rescued',      '50',   'Girls rescued'),
  ('phone',              '0722 537 380', 'Phone number'),
  ('email',              'jenniferkosencha@gmail.com', 'Email address'),
  ('mpesa_paybill',      '', 'M-Pesa paybill number'),
  ('mpesa_account',      '', 'M-Pesa account number'),
  ('bank_name',          '', 'Bank name'),
  ('bank_account_name',  '', 'Bank account name'),
  ('bank_account_number','', 'Bank account number'),
  ('bank_branch',        '', 'Bank branch')
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────
-- Saved reports and the private "documents" folder
-- ─────────────────────────────────────────────────────────────
create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 1 and 200),
  kind          text not null default 'monthly' check (kind in ('monthly', 'quarterly', 'annual', 'custom')),
  period_start  date not null,
  period_end    date not null,
  donor_id      uuid references public.donors (id) on delete set null,
  donor_name    text not null default '',          -- who the report is for ('' = all donors)
  status        text not null default 'draft' check (status in ('draft', 'final')),
  summary       text not null default '',
  highlights    text not null default '',
  challenges    text not null default '',
  next_steps    text not null default '',
  figures       jsonb,                              -- numbers as they were when the report was made
  file_path     text not null default '',           -- an uploaded report file in the "documents" folder
  file_name     text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (period_end >= period_start)
);

alter table public.reports enable row level security;
drop policy if exists admin_all on public.reports;
create policy admin_all on public.reports for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.reports to authenticated;

drop trigger if exists touch_reports on public.reports;
create trigger touch_reports before update on public.reports
  for each row execute function public.touch_updated_at();
drop trigger if exists audit_reports on public.reports;
create trigger audit_reports after insert or update or delete on public.reports
  for each row execute function public.write_audit();

-- Private folder for uploaded documents (reports, proposals, contracts…): admins only
insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
on conflict (id) do update set public = false;

drop policy if exists documents_admin on storage.objects;
create policy documents_admin on storage.objects for all to authenticated
  using (bucket_id = 'documents' and public.is_admin())
  with check (bucket_id = 'documents' and public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- Calendar events
-- ─────────────────────────────────────────────────────────────
create table if not exists public.calendar_events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 200),
  kind        text not null default 'meeting' check (kind in ('meeting', 'board', 'donor', 'event', 'holiday', 'other')),
  starts_on   date not null,
  ends_on     date,                                  -- for events lasting several days
  start_time  text not null default '' check (start_time = '' or start_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  location    text not null default '',
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

alter table public.calendar_events enable row level security;
drop policy if exists admin_all on public.calendar_events;
create policy admin_all on public.calendar_events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.calendar_events to authenticated;

drop trigger if exists touch_calendar_events on public.calendar_events;
create trigger touch_calendar_events before update on public.calendar_events
  for each row execute function public.touch_updated_at();
