-- Update: allow the "At university, college or polytechnic" child status (at_campus) that the dashboard offers.
-- Without it, saving a child with that status fails with children_status_check.
-- Only widens the allowed list: no records are changed.
-- Run once in Supabase: SQL Editor → New query → paste this file → Run. Safe to re-run.

begin;

alter table public.children drop constraint if exists children_status_check;
alter table public.children add constraint children_status_check
  check (status in ('in_care', 'boarding_school', 'at_campus', 'graduated', 'reintegrated', 'exited'));

commit;
