-- Cost-basis tracking for sold items — real ask: include what the shop paid
-- for a card alongside what it sold for, so sales reporting can feed a tax
-- breakdown (revenue - cost = profit), not just revenue/volume. This was
-- explicitly scoped OUT of the original sales-reporting work twice (see
-- CLAUDE.md's "Sales reporting" and "Price tracking & spike alerts"
-- sections — "most inbound paths... never capture what the shop paid for an
-- item at all; only Quote-tab trade-ins have a real payout amount") — this
-- migration is that deferred, separate initiative.
--
-- `cost` is nullable everywhere, no default — same "never force a value"
-- discipline as `catalog.base_price` (phase5_market_value.sql). Most items
-- (Scanner/Import/manual add) have no way to know their real cost
-- automatically, so this stays blank until staff enter it by hand; only a
-- Quote-tab trade-in's cost is auto-computed (see quoteUtils.js's
-- computeQuoteItemCosts) from the quote's own real payout amount.
alter table catalog add column cost numeric;

-- Snapshotted at Mark Sold time from catalog.cost, same "snapshot at the
-- time" discipline sale_price/qty_sold/condition already use on this table
-- (phase12_sales_history.sql) — a sale's recorded cost must never
-- retroactively change just because the (possibly already-deleted) catalog
-- row's own cost gets edited later.
alter table sales add column cost numeric;

-- A quote's computed per-item cost has to survive the trip through
-- sorting_queue on its way to becoming a real Catalog row — same reasoning
-- phase11_quote_source_url.sql already documents for sourceUrl (a real
-- relational column per item field, unlike quotes.items' schema-less
-- jsonb, which needs no migration for a new key). Discarded, same as price/
-- set/rarity/sourceUrl, if the item is instead placed into Bulk
-- (findBulkRow/buildBulkCatalogItem — a Bulk row has no per-print identity,
-- so an individual cost has no meaning on it either).
alter table sorting_queue add column cost numeric;

-- Run this in the Supabase SQL Editor before deploying this code — no
-- code-side default masks a missing column here, so Mark Sold / an accepted
-- quote's Sorting handoff would start throwing a real error rather than
-- silently dropping the cost value.
