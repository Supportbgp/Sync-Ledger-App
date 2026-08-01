-- Phase 3: rename the Sync Queue's two stamps to the P/T/C model and add a
-- third, plus a persistent per-item status on the catalog itself.
-- Run this in the Supabase SQL Editor before deploying the Phase 3 code.

ALTER TABLE sync_queue RENAME COLUMN cumulus_done TO pos_done;
ALTER TABLE sync_queue RENAME COLUMN sortswift_done TO tcgplayer_done;
ALTER TABLE sync_queue ADD COLUMN collectr_done boolean NOT NULL DEFAULT false;

ALTER TABLE catalog ADD COLUMN pos_synced boolean NOT NULL DEFAULT false;
ALTER TABLE catalog ADD COLUMN tcgplayer_synced boolean NOT NULL DEFAULT false;
ALTER TABLE catalog ADD COLUMN collectr_synced boolean NOT NULL DEFAULT false;
