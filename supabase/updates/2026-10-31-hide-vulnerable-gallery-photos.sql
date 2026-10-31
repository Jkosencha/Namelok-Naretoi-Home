-- Update: take photos that show a single child at a vulnerable moment (medical treatment,
-- rehabilitation, distress) off the public website gallery.
-- They are unpublished, not deleted: they stay in Dashboard → Gallery, hidden from visitors.
-- Run once in Supabase: SQL Editor → New query → paste this file → Run. Safe to re-run.

update public.gallery_photos
   set published = false
 where published
   and image_url ~ '(^|/)(hsp1|hsp2|hsp3|hsp4|nam5|child1|child2|child4|child5|child7|child8)\.jpg$';
