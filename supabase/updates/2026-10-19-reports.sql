-- Update: saved reports (monthly / quarterly / annual / custom) and a private
-- "documents" folder for uploaded files.
-- Run once in Supabase: SQL Editor → New query → paste this file → Run. Safe to re-run.

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
