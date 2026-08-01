import { useMemo } from 'react';
import { downloadCsv } from '../../lib/csv.js';
import { useUI } from '../../context/UIContext.jsx';

function Ticket({ t, onToggleStamp }) {
  const complete = t.cumulusDone && t.sortswiftDone;
  const time = new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <div className={`ticket ${complete ? 'complete' : ''}`}>
      <div className="ticket-info">
        <div className="t-name">{t.name} × {t.qtySold}</div>
        <div className="t-meta">{t.set || ""} · {t.condition || ""} · {t.sku || ""}</div>
      </div>
      <div className="ticket-time">{time}</div>
      <div className="stamps">
        <div className={`stamp ${t.cumulusDone ? 'done' : ''}`} onClick={() => onToggleStamp(t.id, 'cumulusDone')}>
          <div className="stamp-circle">C</div><div className="stamp-label">Cumulus</div>
        </div>
        <div className={`stamp ${t.sortswiftDone ? 'done' : ''}`} onClick={() => onToggleStamp(t.id, 'sortswiftDone')}>
          <div className="stamp-circle">S</div><div className="stamp-label">SortSwift</div>
        </div>
      </div>
    </div>
  );
}

export default function SyncQueueTab({ queue, onToggleStamp }) {
  const { toast } = useUI();
  const sorted = useMemo(() => [...queue].sort((a, b) => b.timestamp - a.timestamp), [queue]);
  const pending = sorted.filter(t => !(t.cumulusDone && t.sortswiftDone));
  const completed = sorted.filter(t => t.cumulusDone && t.sortswiftDone);

  function exportPending() {
    const notInCumulus = queue.filter(t => !t.cumulusDone);
    if (!notInCumulus.length) { toast("Nothing pending for Cumulus", false); return; }
    downloadCsv("cumulus_update_batch.csv", notInCumulus.map(t => ({ Barcode: t.sku, QtySold: t.qtySold, Name: t.name })));
    toast(`Exported ${notInCumulus.length} rows for Cumulus import`);
  }

  return (
    <div>
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <div style={{ fontSize: '13px', color: 'var(--ink-soft)', maxWidth: '520px' }}>
          Tap each stamp once you've made the update in that system. A ticket clears once both are stamped.
        </div>
        <button className="btn secondary small" onClick={exportPending}>Export pending → Cumulus CSV</button>
      </div>
      <div>
        {pending.length ? pending.map(t => <Ticket key={t.id} t={t} onToggleStamp={onToggleStamp} />) : (
          <div className="empty"><span className="mark">Nothing waiting</span>Sold cards will show up here until both systems are confirmed.</div>
        )}
      </div>
      {completed.length > 0 && (
        <>
          <div className="section-label">Completed today</div>
          <div>{completed.slice(0, 25).map(t => <Ticket key={t.id} t={t} onToggleStamp={onToggleStamp} />)}</div>
        </>
      )}
    </div>
  );
}
