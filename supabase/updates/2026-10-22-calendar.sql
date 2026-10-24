-- Update: calendar events (meetings, board meetings, donor visits, holidays…).
-- School visits and children's follow-ups already show on the calendar from their own tables.
-- Run once in Supabase: SQL Editor → New query → paste this file → Run. Safe to re-run.

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
