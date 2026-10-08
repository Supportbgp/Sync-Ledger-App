import { useEffect, useState } from 'react';
import { computeSalesReport, presetDateRange, customDateRangeToBounds } from '../../lib/reportUtils.js';

const PRESETS = [
  { key: 'month', label: 'This month' },
  { key: 'year', label: 'This year' },
  { key: 'custom', label: 'Custom' },
];

// Revenue/volume reporting (Feature A, PR 2 — see CLAUDE.md's "Sales
// reporting" section). Deliberately queries only the selected date range on
// demand via `onLoadSales` rather than holding the whole sales history in
// App.jsx's top-level state the way catalog/quotes/sorting are — sales only
// ever grows, with no natural cap, so eagerly loading all of it on every
// sign-in doesn't scale the way it does for those.
export default function ReportsTab({ onLoadSales }) {
  const [preset, setPreset] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);

  const range = preset === 'custom' ? customDateRangeToBounds(customFrom, customTo) : presetDateRange(preset);

  useEffect(() => {
    if (!range) { setSales([]); return; }
    let cancelled = false;
    setLoading(true);
    onLoadSales(range.from, range.to).then(rows => {
      if (!cancelled) { setSales(rows); setLoading(false); }
    });
    return () => { cancelled = true; };
    // onLoadSales is a plain function recreated on every App.jsx render
    // (this app doesn't use useCallback anywhere) — depending on the
    // range's own primitive values instead is what actually determines
    // when a re-fetch is needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.from, range?.to]);

  const report = computeSalesReport(sales);

  return (
    <div>
      <div className="toolbar">
        <div style={{ fontSize: '13px', color: 'var(--ink-soft)', maxWidth: '560px' }}>
          Revenue and volume from Mark Sold events only — not a profit report (no cost basis is tracked yet).
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {PRESETS.map(p => (
            <button
              key={p.key} type="button"
              className={`btn small${preset === p.key ? '' : ' ghost'}`}
              onClick={() => setPreset(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <span style={{ color: 'var(--ink-faint)' }}>to</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        )}
      </div>

      {loading ? (
        <div className="empty"><span className="mark">Loading…</span></div>
      ) : preset === 'custom' && !range ? (
        <div className="empty"><span className="mark">Pick both dates</span>Choose a From and To date to see that range's report.</div>
      ) : sales.length === 0 ? (
        <div className="empty"><span className="mark">Nothing sold in this range</span></div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '13px', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--ink-faint)', textTransform: 'uppercase' }}>Units sold</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '14px' }}>{report.units}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--ink-faint)', textTransform: 'uppercase' }}>Revenue</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '14px' }}>${report.revenue.toFixed(2)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr><th>Game</th><th>Units</th><th>Revenue</th></tr>
            </thead>
            <tbody>
              {report.byGame.map(g => (
                <tr key={g.game}>
                  <td>{g.game}</td>
                  <td>{g.units}</td>
                  <td>${g.revenue.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
