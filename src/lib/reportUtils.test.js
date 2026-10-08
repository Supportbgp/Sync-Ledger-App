import { describe, it, expect } from 'vitest';
import { computeSalesReport, presetDateRange, customDateRangeToBounds } from './reportUtils.js';

describe('computeSalesReport', () => {
  it('sums revenue and units across all sales', () => {
    const sales = [
      { game: 'Pokemon', qtySold: 2, salePrice: 10 },
      { game: 'Magic', qtySold: 1, salePrice: 50 },
    ];
    const report = computeSalesReport(sales);
    expect(report.units).toBe(3);
    expect(report.revenue).toBe(70);
  });

  it('breaks totals down by game, sorted by revenue descending', () => {
    const sales = [
      { game: 'Pokemon', qtySold: 1, salePrice: 5 },
      { game: 'Magic', qtySold: 1, salePrice: 100 },
      { game: 'Pokemon', qtySold: 1, salePrice: 5 },
    ];
    const report = computeSalesReport(sales);
    expect(report.byGame).toEqual([
      { game: 'Magic', units: 1, revenue: 100 },
      { game: 'Pokemon', units: 2, revenue: 10 },
    ]);
  });

  it('groups a blank game under "Unknown" rather than dropping it', () => {
    const report = computeSalesReport([{ game: '', qtySold: 1, salePrice: 5 }]);
    expect(report.byGame).toEqual([{ game: 'Unknown', units: 1, revenue: 5 }]);
  });

  it('still counts units for a sale with a null salePrice, contributing 0 revenue', () => {
    const report = computeSalesReport([{ game: 'Pokemon', qtySold: 3, salePrice: null }]);
    expect(report.units).toBe(3);
    expect(report.revenue).toBe(0);
  });

  it('returns zeroed totals and no game rows for an empty array', () => {
    expect(computeSalesReport([])).toEqual({ revenue: 0, units: 0, byGame: [] });
  });

  it('is a no-op-safe default for null/undefined input', () => {
    expect(computeSalesReport(null)).toEqual({ revenue: 0, units: 0, byGame: [] });
    expect(computeSalesReport(undefined)).toEqual({ revenue: 0, units: 0, byGame: [] });
  });

  it('rounds to the cent despite floating-point noise', () => {
    const sales = [
      { game: 'Pokemon', qtySold: 1, salePrice: 0.1 },
      { game: 'Pokemon', qtySold: 1, salePrice: 0.2 },
    ];
    const report = computeSalesReport(sales);
    expect(report.revenue).toBe(0.3);
  });
});

describe('presetDateRange', () => {
  it('returns the current calendar month\'s [start, start-of-next-month) bounds', () => {
    const now = new Date(2026, 2, 15); // March 15, 2026 (local)
    const range = presetDateRange('month', now);
    expect(new Date(range.from)).toEqual(new Date(2026, 2, 1));
    expect(new Date(range.to)).toEqual(new Date(2026, 3, 1));
  });

  it('returns the current calendar year\'s [start, start-of-next-year) bounds', () => {
    const now = new Date(2026, 2, 15);
    const range = presetDateRange('year', now);
    expect(new Date(range.from)).toEqual(new Date(2026, 0, 1));
    expect(new Date(range.to)).toEqual(new Date(2027, 0, 1));
  });

  it('defaults to the month preset for an unrecognized value', () => {
    const now = new Date(2026, 2, 15);
    expect(presetDateRange('bogus', now)).toEqual(presetDateRange('month', now));
  });
});

describe('customDateRangeToBounds', () => {
  it('makes the end date inclusive by bumping the upper bound to the start of the next day', () => {
    const range = customDateRangeToBounds('2026-01-01', '2026-01-31');
    expect(new Date(range.from)).toEqual(new Date(2026, 0, 1));
    expect(new Date(range.to)).toEqual(new Date(2026, 1, 1));
  });

  it('returns null when either date is blank', () => {
    expect(customDateRangeToBounds('', '2026-01-31')).toBeNull();
    expect(customDateRangeToBounds('2026-01-01', '')).toBeNull();
    expect(customDateRangeToBounds('', '')).toBeNull();
  });
});
