-- Quote Release Form fields — the shop's real paper intake form, filled
-- out and signed when cards are first dropped off (before a quote is
-- priced), captured on the same `quotes` row for a "print this" feature.
-- Same reasoning as the rest of the Quote tab: an in-progress quote row
-- already represents "cards currently in our custody being evaluated,"
-- which is exactly what the release form is about — no separate intake
-- table needed.
--
-- has_expected_price / expected_price_amount map to the form's own
-- "Do you have a price in mind... Yes/No / If so, what is that number?"
-- pair — kept as two columns (a tri-state boolean, null = not asked yet,
-- plus free text) rather than one field, since the form itself asks two
-- separate questions and the second is free text ("$150", "around 200",
-- whatever the customer said), not necessarily a clean number.
-- intake_notes maps to the form's "Description of product being left"
-- block. customer_email is a real field on the paper form that this app
-- never captured before (customer_name/customer_id/phone already existed).
--
-- Deliberately NOT added to catalog_public_view or sync_queue — same
-- staff-only, buy-side-only reasoning as every other quote-specific
-- column already excluded from those two.
--
-- Run this in the Supabase SQL Editor before deploying this code.

alter table quotes add column customer_email text;
alter table quotes add column has_expected_price boolean;
alter table quotes add column expected_price_amount text;
alter table quotes add column intake_notes text;
