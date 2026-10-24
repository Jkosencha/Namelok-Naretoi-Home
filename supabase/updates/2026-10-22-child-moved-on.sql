-- Update: mark when a child moves on from the programme.
--   • new status "graduated" (finished school), next to "reintegrated" (back with family)
--     and "exited" (left the programme)
--   • left_on and leaving_note: when they moved on, and a short note
-- Children who have moved on stay in the records but no longer count as currently supported.
-- Run once in Supabase: SQL Editor → New query → paste this file → Run. Safe to re-run.

alter table public.children drop constraint if exists children_status_check;
alter table public.children add constraint children_status_check
  check (status in ('in_care', 'boarding_school', 'graduated', 'reintegrated', 'exited'));

alter table public.children add column if not exists left_on date;
alter table public.children add column if not exists leaving_note text not null default '';
