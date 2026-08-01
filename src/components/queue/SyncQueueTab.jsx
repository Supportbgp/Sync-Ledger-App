import { useMemo } from 'react';

const STAMPS = [
  { field: 'posDone', letter: 'P', label: 'POS' },
  { field: 'tcgplayerDone', letter: 'T', label: 'TCG Player' },
  { field: 'collectrDone', letter: 'C', label: 'Collectr' },
];

function Ticket({ t, onToggleStamp }) {
  const complete = t.posDone && t.tcgplayerDone && t.collectrDone;
  const time = new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <div className={`ticket ${complete ? 'complete' : ''}`}>
      <div className="ticket-info">
        <div className="t-name">{t.name} × {t.qtySold}</div>
        <div className="t-meta">{t.set || ""} · {t.condition || ""} · {t.sku || ""}</div>
      </div>
      <div className="ticket-time">{time}</div>
      <div className="stamps">
        {STAMPS.map(s => (
          <div key={s.field} className={`stamp ${t[s.field] ? 'done' : ''}`} onClick={() => onToggleStamp(t.id, s.field)}>
            <div className="stamp-circle">{s.letter}</div><div className="stamp-label">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SyncQueueTab({ queue, onToggleStamp }) {
  const sorted = useMemo(() => [...queue].sort((a, b) => b.timestamp - a.timestamp), [queue]);
  const pending = sorted.filter(t => !(t.posDone && t.tcgplayerDone && t.collectrDone));
  const completed = sorted.filter(t => t.posDone && t.tcgplayerDone && t.collectrDone);

  return (
    <div>
      <div className="toolbar">
        <div style={{ fontSize: '13px', color: 'var(--ink-soft)', maxWidth: '520px' }}>
          Tap each stamp once you've made the update in that system. A ticket clears once all three are stamped.
        </div>
      </div>
      <div>
        {pending.length ? pending.map(t => <Ticket key={t.id} t={t} onToggleStamp={onToggleStamp} />) : (
          <div className="empty"><span className="mark">Nothing waiting</span>Sold cards will show up here until all three systems are confirmed.</div>
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
