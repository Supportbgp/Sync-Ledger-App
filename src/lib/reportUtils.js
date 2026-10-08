// Pure, testable logic for the Reports tab (Feature A, PR 2 of the sales-
// reporting/price-tracking roadmap — see CLAUDE.md). Deliberately separate
// from quoteUtils.js despite the similar "totals math" shape — sales
// reporting and Quote-tab offer math are unrelated features that happen to
// both sum money, and coupling them would make neither easier to change.

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Revenue/volume only — no cost-basis/profit (see CLAUDE.md's "Sales
// reporting" section for why that's an explicit, separate scope cut).
// `sales` is whatever dbLoadSales returns: already-normalized rows with
// `qtySold`/`salePrice`/`game`. A blank/null salePrice contributes 0 to
// revenue but still counts its qty toward units, since the sale genuinely
// happened even if the price wasn't captured.
export function computeSalesReport(sales) {
  let revenue = 0;
  let units = 0;
  const byGameMap = new Map();

  for (const s of sales || []) {
    const qty = Number(s.qtySold) || 0;
    const lineRevenue = s.salePrice == null ? 0 : Number(s.salePrice) * qty;
    units += qty;
    revenue += lineRevenue;

    const game = s.game || 'Unknown';
    const entry = byGameMap.get(game) || { game, units: 0, revenue: 0 };
    entry.units += qty;
    entry.revenue += lineRevenue;
    byGameMap.set(game, entry);
  }

  const byGame = Array.from(byGameMap.values())
    .map(g => ({ ...g, revenue: round2(g.revenue) }))
    .sort((a, b) => b.revenue - a.revenue);

  return { revenue: round2(revenue), units, byGame };
}

// Calendar-month/calendar-year presets, computed from a real Date so this
// is testable without mocking the system clock for every case — callers
// pass `now` only in tests, real usage omits it. Upper bound is exclusive
// (the start of the NEXT period), matching how dbLoadSales's `.lt()` filter
// expects it.
export function presetDateRange(preset, now = new Date()) {
  if (preset === 'year') {
    return {
      from: new Date(now.getFullYear(), 0, 1).toISOString(),
      to: new Date(now.getFullYear() + 1, 0, 1).toISOString(),
    };
  }
  // Default: month.
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
  };
}

// Converts two <input type="date"> strings ("YYYY-MM-DD") into the
// [from, to) bounds dbLoadSales expects — `to` is bumped one day past the
// picked end date so that date is itself included (a customer reading
// "Jan 1 to Jan 31" expects Jan 31's sales in the report, not excluded by
// an exact-midnight boundary). Returns null if either input is blank,
// so the caller can tell "no custom range chosen yet" apart from a real one.
export function customDateRangeToBounds(fromStr, toStr) {
  if (!fromStr || !toStr) return null;
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T00:00:00`);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}
