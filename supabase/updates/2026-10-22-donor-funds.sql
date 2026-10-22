-- Update: returning donors, foreign-currency donations, expenses with receipts,
-- and which donor sponsors which child.
--   • donations.amount stays the amount received in KES (all totals use it);
--     original_amount + exchange_rate record e.g. USD 1,000 at 129.50
--   • expenses: money spent, optionally paid from one donor's funds, with a scanned receipt
--     (receipts go in the private "documents" folder)
--   • sponsorships: a donor supporting a specific child
-- Run once in Supabase: SQL Editor → New query → paste this file → Run. Safe to re-run.

-- 1. Donors: how often they usually give, and in which currency
alter table public.donors add column if not exists giving_pattern text not null default '';
alter table public.donors drop constraint if exists donors_giving_pattern_check;
alter table public.donors add constraint donors_giving_pattern_check
  check (giving_pattern in ('', 'one_off', 'monthly', 'quarterly', 'twice_yearly', 'annual'));
alter table public.donors add column if not exists currency text not null default 'KES';

-- 2. Donations in other currencies
alter table public.donations add column if not exists original_amount numeric(12, 2) check (original_amount is null or original_amount >= 0);
alter table public.donations add column if not exists exchange_rate numeric(12, 4) check (exchange_rate is null or exchange_rate > 0);
alter table public.donations drop constraint if exists donations_currency_check;
alter table public.donations add constraint donations_currency_check
  check (currency in ('KES', 'USD', 'GBP', 'EUR')) not valid;   -- older rows are left as they are

-- 3. Expenses
create table if not exists public.expenses (
  id            uuid primary key default gen_random_uuid(),
  spent_on      date not null default current_date,
  description   text not null check (char_length(description) between 1 and 300),
  category      text not null default 'other' check (category in ('school_fees', 'school_items', 'medical', 'food', 'clothing',
                    'hygiene', 'transport', 'utilities', 'building', 'outreach', 'admin', 'other')),
  amount        numeric(12, 2) not null check (amount >= 0),          -- KES
  donor_id      uuid references public.donors (id) on delete set null, -- whose funds paid for it (null = general funds)
  child_id      uuid references public.children (id) on delete set null,
  vendor        text not null default '',
  receipt_path  text not null default '',   -- scanned receipt in the private "documents" folder
  receipt_name  text not null default '',
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists expenses_donor on public.expenses (donor_id, spent_on);

-- 4. Sponsorships
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

-- Admins only, with an audit trail
do $$
declare t text;
begin
  foreach t in array array['expenses', 'sponsorships']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.write_audit()', t);
  end loop;
end $$;
drop trigger if exists touch_expenses on public.expenses;
create trigger touch_expenses before update on public.expenses
  for each row execute function public.touch_updated_at();
