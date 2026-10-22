-- Update: child categories (rescued girls / rescued boys) and school classes that
-- move up automatically every January.
-- Run once in Supabase: SQL Editor → New query → paste this file → Run.
-- Safe to re-run.

-- 1. Categories: split "rescued" into rescued girls and rescued boys
alter table public.children drop constraint if exists children_category_check;
update public.children
   set category = case when gender = 'male' then 'rescued_boy' else 'rescued_girl' end
 where category = 'rescued';
alter table public.children alter column category set default 'disability';
alter table public.children add constraint children_category_check
  check (category in ('disability', 'rescued_girl', 'rescued_boy', 'vulnerable'));

-- 2. School class: which system, which class, and the year it was set.
--    The current class is worked out from these, so it moves up each January.
alter table public.children add column if not exists class_track text not null default '';
alter table public.children add column if not exists class_level integer;
alter table public.children add column if not exists class_year integer;
alter table public.children drop constraint if exists children_class_track_check;
alter table public.children add constraint children_class_track_check
  check (class_track in ('', 'cbc', '844', 'tertiary', 'special', 'none'));
alter table public.children drop constraint if exists children_class_level_check;
alter table public.children add constraint children_class_level_check
  check (class_level is null or class_level >= 0);

-- 3. The same calculation inside the database, for reports and exports:
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
