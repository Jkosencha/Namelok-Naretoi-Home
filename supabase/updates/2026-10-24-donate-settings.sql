-- Update: two more donation details for the Donate page.
--   • paypal_email: the PayPal address donors send to
--   • bank_swift:   the bank's SWIFT code, for donors abroad
-- Each payment method appears on the Donate page only once its details are filled in
-- (Dashboard → Stats & details). Run once in Supabase: SQL Editor → paste → Run. Safe to re-run.

insert into public.site_settings (key, value, label) values
  ('paypal_email', '', 'PayPal email'),
  ('bank_swift',   '', 'Bank SWIFT code (for donors abroad)')
on conflict (key) do nothing;
