-- Sprint 2: not every item lives everywhere — some are in-store only, some
-- are TCG Player only, some live on all three. Adds a per-item "channel"
-- flag for each platform so the Sync Queue and P/T/C status chips only
-- track what's actually relevant to that item, instead of always requiring
-- all three. Defaulting every column to true preserves today's behavior for
-- every existing row (everything currently assumed to be listed everywhere)
-- — nothing disappears from tracking after this runs.
--
-- Run this in the Supabase SQL Editor before deploying the Sprint 2 code.

alter table catalog
  add column pos_channel boolean not null default true,
  add column tcgplayer_channel boolean not null default true,
  add column collectr_channel boolean not null default true;

-- sync_queue tickets snapshot the channels that were relevant at sale time
-- (same reasoning as their existing name/set/condition/price snapshot
-- columns) so editing an item's channels later can't retroactively change
-- what an already-created ticket requires.
alter table sync_queue
  add column pos_channel boolean not null default true,
  add column tcgplayer_channel boolean not null default true,
  add column collectr_channel boolean not null default true;
