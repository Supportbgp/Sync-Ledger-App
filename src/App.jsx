import { useEffect, useMemo, useState } from 'react';
import { supabaseClient } from './lib/supabase.js';
import {
  dbLoadAll, dbUpsertCard, dbUpsertCards, dbDeleteCard, dbDeleteCards, dbClearCatalog,
  dbInsertTicket, dbInsertTickets, dbUpdateTicketStamp, dbClearQueue, dbUpdatePlatformStatus,
} from './lib/db.js';
import { needsPlatformStatusReset } from './lib/cardUtils.js';
import { useUI } from './context/UIContext.jsx';
import { useRealtimeSync } from './hooks/useRealtimeSync.js';
import Login from './components/Login.jsx';
import CatalogPanel from './components/catalog/CatalogPanel.jsx';
import SyncQueueTab from './components/queue/SyncQueueTab.jsx';
import ImportExportPanel from './components/importexport/ImportExportPanel.jsx';

const TABS = [
  { key: 'catalog', label: 'Catalog' },
  { key: 'queue', label: 'Sync Queue' },
  { key: 'import', label: 'Import / Export' },
];

export default function App() {
  const { toast } = useUI();
  const [signedIn, setSignedIn] = useState(false);
  const [checkedSession, setCheckedSession] = useState(false);
  const [tab, setTab] = useState('catalog');
  const [catalog, setCatalog] = useState([]);
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (session) setSignedIn(true);
      setCheckedSession(true);
    });
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    dbLoadAll(toast).then(({ catalog: c, queue: q }) => { setCatalog(c); setQueue(q); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  useRealtimeSync({ enabled: signedIn, setCatalog, setQueue });

  const locations = useMemo(
    () => Array.from(new Set(catalog.map(c => c.location).filter(Boolean))).sort(),
    [catalog]
  );

  const pendingCount = queue.filter(t => !(t.posDone && t.tcgplayerDone && t.collectrDone)).length;

  async function handleSaveCard(record, prevSku) {
    const idx = catalog.findIndex(c => c.sku === prevSku);
    const existing = prevSku && idx >= 0 ? catalog[idx] : null;
    if (needsPlatformStatusReset(existing, record)) {
      record.posSynced = false;
      record.tcgplayerSynced = false;
      record.collectrSynced = false;
    }
    let nextCatalog;
    if (existing) {
      if (record.sku !== prevSku) {
        await dbDeleteCard(prevSku, toast);
        nextCatalog = catalog.filter(c => c.sku !== prevSku).concat([record]);
      } else {
        nextCatalog = catalog.slice();
        nextCatalog[idx] = record;
      }
    } else {
      nextCatalog = catalog.concat([record]);
    }
    setCatalog(nextCatalog);
    await dbUpsertCard(record, toast);
    toast(`Saved ${record.name}`);
  }

  async function handleDeleteCard(sku) {
    await dbDeleteCard(sku, toast);
    setCatalog(prev => prev.filter(c => c.sku !== sku));
    toast("Item deleted");
  }

  async function handleSellCard(card, qty) {
    const updated = {
      ...card, qty: card.qty - qty, lastUpdated: Date.now(),
      posSynced: false, tcgplayerSynced: false, collectrSynced: false,
    };
    if (updated.qty <= 0) updated.sold = true;
    const ticket = {
      id: 't' + Date.now() + Math.random().toString(36).slice(2, 7),
      sku: updated.sku, name: updated.name, set: updated.set, condition: updated.condition,
      printing: updated.printing, price: updated.price, qtySold: qty, timestamp: Date.now(),
      posDone: false, tcgplayerDone: false, collectrDone: false,
    };
    setCatalog(prev => prev.map(c => c.sku === card.sku ? updated : c));
    setQueue(prev => [...prev, ticket]);
    await dbUpsertCard(updated, toast);
    await dbInsertTicket(ticket, toast);
    toast(`Marked ${qty} × ${updated.name} sold`);
  }

  async function handleBatchDelete(skus) {
    const count = skus.size;
    await dbDeleteCards(skus, toast);
    setCatalog(prev => prev.filter(c => !skus.has(c.sku)));
    toast(`Deleted ${count} item(s)`);
  }

  async function handleBatchSell(skus) {
    let affected = 0;
    const updatedList = [];
    const newTickets = [];
    const nextCatalog = catalog.map(c => {
      if (!skus.has(c.sku) || c.sold || c.qty <= 0) return c;
      const qtySold = c.qty;
      const updated = {
        ...c, qty: 0, sold: true, lastUpdated: Date.now(),
        posSynced: false, tcgplayerSynced: false, collectrSynced: false,
      };
      updatedList.push(updated);
      newTickets.push({
        id: 't' + Date.now() + Math.random().toString(36).slice(2, 7),
        sku: c.sku, name: c.name, set: c.set, condition: c.condition, printing: c.printing, price: c.price,
        qtySold, timestamp: Date.now(), posDone: false, tcgplayerDone: false, collectrDone: false,
      });
      affected++;
      return updated;
    });
    setCatalog(nextCatalog);
    setQueue(prev => [...prev, ...newTickets]);
    await dbUpsertCards(updatedList, toast);
    await dbInsertTickets(newTickets, toast);
    toast(`Marked ${affected} item(s) sold`);
  }

  async function handleToggleStamp(id, field) {
    const t = queue.find(x => x.id === id);
    if (!t) return;
    const nextVal = !t[field];
    setQueue(prev => prev.map(x => x.id === id ? { ...x, [field]: nextVal } : x));
    await dbUpdateTicketStamp(id, field, nextVal, toast);
    const merged = { ...t, [field]: nextVal };
    if (merged.posDone && merged.tcgplayerDone && merged.collectrDone) {
      toast(`${t.name} synced`);
    }
  }

  async function handleTogglePlatformStatus(sku, field) {
    const card = catalog.find(c => c.sku === sku);
    if (!card) return;
    const nextVal = !card[field];
    setCatalog(prev => prev.map(c => c.sku === sku ? { ...c, [field]: nextVal } : c));
    await dbUpdatePlatformStatus(sku, field, nextVal, toast);
  }

  async function handleImport(newRows, mode) {
    if (mode === "replace") {
      await dbClearCatalog(toast);
    }
    await dbUpsertCards(newRows, toast);
    const { catalog: c, queue: q } = await dbLoadAll(toast);
    setCatalog(c);
    setQueue(q);
  }

  async function handleClearAll() {
    await dbClearCatalog(toast);
    await dbClearQueue(toast);
    setCatalog([]);
    setQueue([]);
    toast("All data cleared");
  }

  async function handleLogout() {
    await supabaseClient.auth.signOut();
    location.reload();
  }

  if (!checkedSession) return null;
  if (!signedIn) return <Login onSignedIn={() => setSignedIn(true)} />;

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <span className="mark">Ledger</span>
          <span className="sub">singles &amp; slabs · source of truth</span>
        </div>
        <div className={`pending-badge${pendingCount === 0 ? ' zero' : ''}`}>
          <span className="pending-dot"></span>
          <span>{pendingCount} pending sync</span>
        </div>
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <div key={t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
            {t.key === 'catalog' && <span className="count">{catalog.length}</span>}
            {t.key === 'queue' && <span className="count">{pendingCount}</span>}
          </div>
        ))}
      </div>

      <div className={`panel${tab === 'catalog' ? ' active' : ''}`}>
        <CatalogPanel
          catalog={catalog}
          onSaveCard={handleSaveCard}
          onDeleteCard={handleDeleteCard}
          onSellCard={handleSellCard}
          onBatchDelete={handleBatchDelete}
          onBatchSell={handleBatchSell}
          onTogglePlatformStatus={handleTogglePlatformStatus}
        />
      </div>
      <div className={`panel${tab === 'queue' ? ' active' : ''}`}>
        <SyncQueueTab queue={queue} onToggleStamp={handleToggleStamp} />
      </div>
      <div className={`panel${tab === 'import' ? ' active' : ''}`}>
        <ImportExportPanel
          catalog={catalog}
          queue={queue}
          locations={locations}
          onImport={handleImport}
          onClearAll={handleClearAll}
        />
      </div>

      <div className="footnote">
        Shared store data, live in Supabase · not connected to POS, TCG Player, or Collectr APIs ·{' '}
        <a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }} style={{ color: 'var(--ink-faint)' }}>Sign out</a>
      </div>
    </div>
  );
}
