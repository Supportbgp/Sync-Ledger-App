-- Persist Rarity so it can be filtered in the Catalog tab. Rarity was
-- previously a transient scratch/search-hint field in EditModal/
-- ScannerPanel (used only to narrow the card-image search), discarded on
-- save — never an actual catalog attribute until now.
--
-- Deliberately NOT added to catalog_public_view (a staff-side
-- disambiguation aid, not something the public binder page needs) or to
-- sync_queue (unlike condition/printing, which get snapshotted onto a sold
-- ticket because they factor into pricing, rarity plays no role in pricing
-- or sync bookkeeping).
--
-- Run this in the Supabase SQL Editor before deploying this code.

alter table catalog add column rarity text not null default '';
