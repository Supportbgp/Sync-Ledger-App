import { useEffect, useState } from 'react';
import { dbLoadPublicBinder } from '../lib/db.js';
import Lightbox from './Lightbox.jsx';

function BinderCard({ item, onZoom }) {
  const [broken, setBroken] = useState(false);
  const rawSrc = item.imageUrl === 'local'
    ? item.imageData
    : (item.imageUrl && item.imageUrl.startsWith('http') ? item.imageUrl : null);
  const src = broken ? null : rawSrc;
  const sub = [item.set, item.condition, item.printing].filter(Boolean).join(' · ') +
    (item.itemType === 'slab' && (item.grader || item.grade) ? ` · ${item.grader || ''} ${item.grade || ''}`.trim() : '');

  return (
    <div className="binder-card">
      <div className="binder-card-img-wrap">
        {item.itemType === 'slab' && <span className="badge slab binder-card-slab-badge">Slab</span>}
        {src ? (
          <img
            src={src}
            className="binder-card-img"
            onClick={() => onZoom(src)}
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="binder-card-img binder-card-img-empty">{item.game || "No image"}</div>
        )}
      </div>
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
  const [zoomUrl, setZoomUrl] = useState(null);

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
          {items.map((it, i) => <BinderCard key={i} item={it} onZoom={setZoomUrl} />)}
        </div>
      )}

      {zoomUrl && <Lightbox url={zoomUrl} onClose={() => setZoomUrl(null)} />}

      <div className="footnote">Live inventory lookup — updates automatically as stock changes.</div>
    </div>
  );
}
