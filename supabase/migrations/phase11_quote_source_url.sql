-- Quote line items gain a Source link, matching a catalog row's own
-- sourceUrl field — real ask: staff want to paste the same TCGplayer/
-- product-page link on a quote item as they already can in EditModal, not
-- just an image. `quotes.items` itself needs no migration (a jsonb array —
-- the new `sourceUrl` key just starts appearing in newly-saved items,
-- same as any other jsonb field addition in this app), but `sorting_queue`
-- is a real relational table (phase10_sorting_bulk.sql) with one column
-- per item field, and an accepted quote's items pass through it on their
-- way to becoming a Catalog row — so it needs a real new column for the
-- value to actually survive that trip instead of being silently dropped
-- between Quote and Catalog.
alter table sorting_queue add column source_url text not null default '';

-- Run this in the Supabase SQL Editor before deploying this code — no
-- code-side default masks a missing column here for sorting_queue's insert
-- path (quotes.items needs no such step, being jsonb).
