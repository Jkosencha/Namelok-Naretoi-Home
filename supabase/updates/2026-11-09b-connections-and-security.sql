-- Update: connect related records automatically, and tighten security.
-- Nothing is deleted: existing records are only linked up, and every step runs as one
-- transaction, so if anything fails nothing changes.
-- Run once in Supabase: SQL Editor → New query → paste this file → Run. Safe to re-run.

begin;

-- ─────────────────────────────────────────────────────────────
-- 1. Donations ↔ donors
-- ─────────────────────────────────────────────────────────────
-- A donation from a named person or organisation always belongs to a donor:
-- the existing donor with that name, or a new one created on the spot.
-- "Anonymous" (or no name) stays unlinked.
create or replace function public.is_anonymous_name(n text)
returns boolean language sql immutable as $$
  select btrim(coalesce(n, '')) = '' or lower(btrim(n)) in ('anonymous', 'anon', 'well-wisher', 'well wisher', 'unknown');
$$;

create or replace function public.link_donation_donor()
returns trigger language plpgsql set search_path = public as $$
declare found_id uuid;
begin
  if new.donor_id is not null then
    -- keep the shown name in step with the donor record
    select coalesce(name, new.donor_name) into new.donor_name from public.donors where id = new.donor_id;
    return new;
  end if;
  new.donor_name := btrim(coalesce(new.donor_name, ''));
  if public.is_anonymous_name(new.donor_name) then return new; end if;
  select id into found_id from public.donors where lower(btrim(name)) = lower(new.donor_name) order by created_at limit 1;
  if found_id is null then
    insert into public.donors (name, currency) values (new.donor_name, coalesce(new.currency, 'KES')) returning id into found_id;
  end if;
  new.donor_id := found_id;
  return new;
end $$;
drop trigger if exists link_donor on public.donations;
create trigger link_donor before insert or update of donor_id, donor_name on public.donations
  for each row execute function public.link_donation_donor();

-- Renaming a donor updates the name shown on their donations
create or replace function public.sync_donor_name()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.name is distinct from old.name then
    update public.donations set donor_name = new.name where donor_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists sync_donor_name on public.donors;
create trigger sync_donor_name after update of name on public.donors
  for each row execute function public.sync_donor_name();

-- Link the donations already recorded: create donors for names that have none yet, then link by name
insert into public.donors (name, currency)
select distinct on (lower(btrim(d.donor_name))) btrim(d.donor_name), d.currency
  from public.donations d
 where d.donor_id is null and not public.is_anonymous_name(d.donor_name)
   and not exists (select 1 from public.donors x where lower(btrim(x.name)) = lower(btrim(d.donor_name)))
 order by lower(btrim(d.donor_name)), d.received_on;
update public.donations d set donor_id = x.id
  from (select distinct on (lower(btrim(name))) id, lower(btrim(name)) as k from public.donors order by lower(btrim(name)), created_at) x
 where d.donor_id is null and lower(btrim(d.donor_name)) = x.k;

-- ─────────────────────────────────────────────────────────────
-- 2. Expenses ↔ donations: an expense paid from a gift is paid from that gift's donor
-- ─────────────────────────────────────────────────────────────
create or replace function public.expense_donor_from_donation()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.donation_id is not null then
    select donor_id into new.donor_id from public.donations where id = new.donation_id;
  end if;
  return new;
end $$;
drop trigger if exists expense_donor on public.expenses;
create trigger expense_donor before insert or update of donation_id, donor_id on public.expenses
  for each row execute function public.expense_donor_from_donation();

create or replace function public.donation_donor_to_expenses()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.donor_id is distinct from old.donor_id then
    update public.expenses set donor_id = new.donor_id where donation_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists donation_donor_to_expenses on public.donations;
create trigger donation_donor_to_expenses after update of donor_id on public.donations
  for each row execute function public.donation_donor_to_expenses();

update public.expenses e set donor_id = d.donor_id
  from public.donations d where e.donation_id = d.id and e.donor_id is distinct from d.donor_id;

-- ─────────────────────────────────────────────────────────────
-- 3. School visits ↔ items handed out: moving a visit's date moves its items too
-- ─────────────────────────────────────────────────────────────
create or replace function public.visit_date_to_items()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.visit_date is distinct from old.visit_date then
    update public.distributions set distributed_on = new.visit_date
     where visit_id = new.id and distributed_on = old.visit_date;
  end if;
  return new;
end $$;
drop trigger if exists visit_date_to_items on public.outreach_visits;
create trigger visit_date_to_items after update of visit_date on public.outreach_visits
  for each row execute function public.visit_date_to_items();

-- ─────────────────────────────────────────────────────────────
-- 4. Security
-- ─────────────────────────────────────────────────────────────
-- Visitors to the website (the "anon" role) can read only the published website content and
-- send a contact message. Everything else is closed to them, now and for tables added later.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant select on public.site_settings, public.stories, public.gallery_photos to anon;
grant insert (first_name, last_name, email, reason, message) on public.contact_messages to anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

-- Database functions can only be called by signed-in users (row rules still decide what they see)
revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;

-- Slow down anyone flooding the contact form
create or replace function public.limit_contact_messages()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.contact_messages where created_at > now() - interval '10 minutes') >= 30
     or (select count(*) from public.contact_messages where lower(email) = lower(new.email) and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many messages right now. Please try again later or call 0722 537 380.';
  end if;
  return new;
end $$;
revoke execute on function public.limit_contact_messages() from anon, public;
drop trigger if exists limit_contact_messages on public.contact_messages;
create trigger limit_contact_messages before insert on public.contact_messages
  for each row execute function public.limit_contact_messages();

-- Audit trail on everything sensitive, including who changes bank details or gives someone access.
-- Records which row changed (and for settings, which setting), never the contents.
alter table public.audit_log add column if not exists record_key text;
create or replace function public.write_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare r jsonb := coalesce(to_jsonb(new), to_jsonb(old));
begin
  insert into public.audit_log (table_name, record_id, record_key, action, user_id)
  values (tg_table_name,
          case when r->>'id' ~ '^[0-9a-fA-F-]{36}$' then (r->>'id')::uuid end,
          coalesce(r->>'id', r->>'key', r->>'user_id'),
          tg_op, auth.uid());
  return coalesce(new, old);
end $$;
do $$
declare t text;
begin
  foreach t in array array['admins', 'site_settings', 'stories', 'gallery_photos', 'volunteers', 'outreach_visits',
                           'distributions', 'calendar_events', 'contact_messages']
  loop
    execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.write_audit()', t);
  end loop;
end $$;

-- Uploads: limit size and file type, so nothing but photos can go in the public folder
update storage.buckets set file_size_limit = 8 * 1024 * 1024,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
 where id in ('site-media', 'child-files');
update storage.buckets set public = false, file_size_limit = 20 * 1024 * 1024,
       allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
         'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'application/vnd.oasis.opendocument.text']
 where id = 'documents';
update storage.buckets set public = false where id = 'child-files';

commit;

-- After running: this should list only public_read / public_insert rules for visitors,
-- and no table without row security.
--   select tablename, rowsecurity from pg_tables where schemaname = 'public' and not rowsecurity;
