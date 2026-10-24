-- Update: children's photos and a short "About" text.
--   • photo_path (already there)  = how the child looks now
--   • arrival_photo_path           = how the child looked when they came
--   • child_photos                 = a small gallery for each child, with captions
-- All photos stay in the private "child-files" folder: admins only, short-lived links.
-- Run once in Supabase: SQL Editor → New query → paste this file → Run. Safe to re-run.

alter table public.children add column if not exists about text not null default '';
alter table public.children add column if not exists arrival_photo_path text not null default '';

create table if not exists public.child_photos (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null references public.children (id) on delete cascade,
  path        text not null,                         -- path inside the private "child-files" bucket
  caption     text not null default '' check (char_length(caption) <= 300),
  taken_on    date,
  created_at  timestamptz not null default now()
);
create index if not exists child_photos_child on public.child_photos (child_id, taken_on);

alter table public.child_photos enable row level security;
drop policy if exists admin_all on public.child_photos;
create policy admin_all on public.child_photos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.child_photos to authenticated;

drop trigger if exists audit_child_photos on public.child_photos;
create trigger audit_child_photos after insert or update or delete on public.child_photos
  for each row execute function public.write_audit();
