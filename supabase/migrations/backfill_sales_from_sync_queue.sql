-- One-time data backfill, not a schema migration — run this ONCE, after
-- phase12_sales_history.sql has already been run and deployed. Every
-- sync_queue ticket that exists today represents a real historical sale
-- that happened before the `sales` table existed, so none of them have a
-- matching sales row yet. This copies them over so the Reports tab can
-- report on sales history from before this feature shipped, not just
-- going forward.
--
-- Field mapping notes, read before running:
--   - sync_queue has no `game` column at all (never did — see db.js's
--     rowToTicket/ticketToRow) — backfilled here via a join back to
--     `catalog` on sku. This recovers the CURRENT game value, not a true
--     historical snapshot — fine in virtually every case since Game
--     rarely changes after an item is created, but not a perfect record.
--     A sku whose catalog row has since been deleted backfills with a
--     blank game, which the Reports tab groups under "Unknown" rather
--     than erroring.
--   - sync_queue.price and sales.sale_price come from the exact same
--     source (the catalog item's price at sale time — see
--     App.jsx's handleBatchSell, which sets both from the same `c.price`),
--     so this is a direct, lossless copy, not an approximation.
--   - sync_queue.qty_sold already correctly reflects a partial sale from
--     before the batch-only Mark Sold flow shipped (see CLAUDE.md's
--     "Catalog: click-to-select rows, per-row Sell removed" section) —
--     copied as-is.
--
-- Double-counting safety: if you already tested Mark Sold against this
-- real project after phase12_sales_history.sql was deployed, that test
-- already wrote a real row to BOTH sync_queue and sales (the write hook
-- fires on both for every new sale going forward) — backfilling it again
-- here would double it. This query guards against that automatically by
-- only backfilling sync_queue rows older than the EARLIEST sold_at
-- already in `sales` (or everything, if `sales` is still empty).
--
-- Run the SELECT first to preview exactly what would be inserted, then
-- the INSERT. Do not run the INSERT more than once — there's no
-- unique-constraint protection against re-running it, since a sync_queue
-- ticket has no reciprocal link back to a sales row to de-duplicate on.

-- Preview — run this first and sanity-check the row count/contents:
select
  sq.sku,
  sq.name,
  coalesce(c.game, '') as game,
  sq.condition,
  sq.qty_sold,
  sq.price as sale_price,
  sq.ts as sold_at
from sync_queue sq
left join catalog c on c.sku = sq.sku
where sq.ts < coalesce((select min(sold_at) from sales), 'infinity'::timestamptz)
order by sq.ts;

-- The actual backfill — run once, after confirming the preview looks right:
insert into sales (sku, name, game, condition, qty_sold, sale_price, sold_at)
select
  sq.sku,
  sq.name,
  coalesce(c.game, '') as game,
  sq.condition,
  sq.qty_sold,
  sq.price as sale_price,
  sq.ts as sold_at
from sync_queue sq
left join catalog c on c.sku = sq.sku
where sq.ts < coalesce((select min(sold_at) from sales), 'infinity'::timestamptz);
