import { useEffect, useState } from 'react';
import { dbLoadPublicBinder } from '../lib/db.js';

function BinderCard({ item }) {
  const src = item.imageUrl === 'local'
    ? item.imageData
    : (item.imageUrl && item.imageUrl.startsWith('http') ? item.imageUrl : null);
  const sub = [item.set, item.condition, item.printing].filter(Boolean).join(' · ') +
    (item.itemType === 'slab' && (item.grader || item.grade) ? ` · ${item.grader || ''} ${item.grade || ''}`.trim() : '');
  return (
    <div className="binder-card">
      {src ? <img src={src} className="binder-card-img" /> : <div className="binder-card-img binder-card-img-empty">—</div>}
      <div className="binder-card-name">{item.name}</div>
      <div className="binder-card-sub">{sub}</div>
      <div className="binder-card-row">
        <span className="mono">{item.qty} in stock</span>
        <span className="mono">{item.price !== null ? "$" + Number(item.price).toFixed(2) : "—"}</span>
      </div>
    </div>
  );
}

export default function BinderView({ location }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    dbLoadPublicBinder(location).then(setItems).catch((err) => setError(err.message));
  }, [location]);

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <span className="mark">Ledger</span>
          <span className="sub">{location}</span>
        </div>
      </div>

      {error && (
        <div className="empty"><span className="mark">Couldn't load this binder</span>{error}</div>
      )}
      {!error && items === null && (
        <div className="empty"><span className="mark">Loading…</span></div>
      )}
      {!error && items && items.length === 0 && (
        <div className="empty">
          <span className="mark">Nothing here right now</span>
          This binder is currently empty, or everything in it has sold.
        </div>
      )}
      {!error && items && items.length > 0 && (
        <div className="binder-grid">
          {items.map((it, i) => <BinderCard key={i} item={it} />)}
        </div>
      )}

      <div className="footnote">Live inventory lookup — updates automatically as stock changes.</div>
    </div>
  );
}
