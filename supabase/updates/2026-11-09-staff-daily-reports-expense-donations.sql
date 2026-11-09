-- Update: staff records, daily reports, editable report documents, and expenses paid from a specific donation.
-- Run once in Supabase: SQL Editor → New query → paste this file → Run. Safe to re-run.

-- 1. Staff: records and documents only (no salaries)
create table if not exists public.staff (
  id                 uuid primary key default gen_random_uuid(),
  full_name          text not null check (char_length(full_name) between 1 and 150),
  role               text not null default '',
  email              text not null default '',
  phone              text not null default '',
  start_date         date,
  contract_type      text not null default '' check (contract_type in ('', 'permanent', 'fixed_term', 'casual', 'volunteer')),
  status             text not null default 'active' check (status in ('active', 'left')),
  id_number          text not null default '',
  next_of_kin_name   text not null default '',
  next_of_kin_phone  text not null default '',
  notes              text not null default '',
  user_id            uuid references auth.users (id) on delete set null,  -- their dashboard login, once invited
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Contracts, CVs, copies of ID… (files in the private "documents" folder)
create table if not exists public.staff_documents (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references public.staff (id) on delete cascade,
  title       text not null default '',
  file_path   text not null,
  file_name   text not null default '',
  created_at  timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['staff', 'staff_documents']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.write_audit()', t);
  end loop;
end $$;
drop trigger if exists touch_staff on public.staff;
create trigger touch_staff before update on public.staff
  for each row execute function public.touch_updated_at();

-- 2. Daily reports, and a report document edited by hand (letterhead to footer)
alter table public.reports drop constraint if exists reports_kind_check;
alter table public.reports add constraint reports_kind_check
  check (kind in ('daily', 'monthly', 'quarterly', 'annual', 'custom'));
alter table public.reports add column if not exists document_html text;   -- null = built from the figures

-- 3. An expense can be paid from one specific donation
alter table public.expenses add column if not exists donation_id uuid references public.donations (id) on delete set null;
create index if not exists expenses_donation on public.expenses (donation_id);
