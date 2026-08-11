import { useEffect, useMemo, useState } from 'react';
import { supabaseClient } from './lib/supabase.js';
import {
  dbLoadAll, dbUpsertCard, dbUpsertCards, dbDeleteCard, dbDeleteCards, dbClearCatalog,
  dbInsertTicket, dbInsertTickets, dbUpdateTicketStamp, dbClearQueue, dbUpdatePlatformStatus,
  dbLoadSettings, dbSaveSettings,
} from './lib/db.js';
import { needsPlatformStatusReset, isTicketComplete, canonicalizeCondition, marketValueForCondition, DEFAULT_CONDITION_MULTIPLIERS } from './lib/cardUtils.js';
import { useUI } from './context/UIContext.jsx';
import { useRealtimeSync } from './hooks/useRealtimeSync.js';
import Login from './components/Login.jsx';
import logoIcon from './assets/logo-icon.png';
import CatalogPanel from './components/catalog/CatalogPanel.jsx';
import SyncQueueTab from './components/queue/SyncQueueTab.jsx';
import ImportExportPanel from './components/importexport/ImportExportPanel.jsx';
import ScannerPanel from './components/scanner/ScannerPanel.jsx';
import SettingsModal from './components/SettingsModal.jsx';

const TABS = [
  { key: 'catalog', label: 'Catalog' },
  { key: 'queue', label: 'Sync Queue' },
  { key: 'import', label: 'Import / Export' },
  { key: 'scanner', label: 'Scan Binder' },
];

const CONDITION_RANK = { NM: 0, LP: 1, MP: 2, HP: 3, DMG: 4 };

// Soft nudge, not a hard rule — a worse-condition copy of the same card in
// the same case shouldn't be priced above a better-condition copy. Flags it
// so staff can double-check, doesn't block the save either way.
function priceOrderingWarning(catalog, record) {
  const tier = canonicalizeCondition(record.condition);
  if (!tier || record.price == null) return null;
  const siblings = catalog.filter(c =>
    c.sku !== record.sku && c.name === record.name && c.game === record.game &&
    c.location === record.location && c.price != null && !c.sold
  );
  for (const s of siblings) {
    const sTier = canonicalizeCondition(s.condition);
    if (!sTier) continue;
    if (CONDITION_RANK[tier] < CONDITION_RANK[sTier] && record.price < s.price) {
      return `${record.name} (${tier}) is priced below the ${sTier} copy in this case — worth double-checking.`;
    }
    if (CONDITION_RANK[tier] > CONDITION_RANK[sTier] && record.price > s.price) {
      return `${record.name} (${tier}) is priced above the ${sTier} copy in this case — worth double-checking.`;
    }
  }
  return null;
}

// A different kind of soft nudge than priceOrderingWarning above: this one
// compares Our Price against THIS card's own computed Market Value, not
// against another physical copy. The flat condition multiplier can be
// materially wrong for a specific card (a real example landed ~18% off —
// see CLAUDE.md), so a meaningful gap is worth a second look — but it's
// still just a nudge; deliberate pricing decisions (the whole reason Our
// Price is separate from Market Value) are expected and not an error.
const MARKET_VALUE_DEVIATION_THRESHOLD = 0.15;

function priceVsMarketValueWarning(record, multipliers) {
  if (record.basePrice == null || record.price == null || !multipliers) return null;
  const mv = marketValueForCondition(record.basePrice, record.condition, multipliers);
  if (mv == null || mv <= 0) return null;
  const diff = Math.abs(record.price - mv) / mv;
  if (diff < MARKET_VALUE_DEVIATION_THRESHOLD) return null;
  const dir = record.price < mv ? 'below' : 'above';
  return `${record.name}'s price ($${record.price.toFixed(2)}) is ${dir} its estimated market value ($${mv.toFixed(2)}).`;
}

export default function App() {
  const { toast } = useUI();
  const [signedIn, setSignedIn] = useState(false);
  const [checkedSession, setCheckedSession] = useState(false);
  const [tab, setTab] = useState('catalog');
  const [catalog, setCatalog] = useState([]);
  const [queue, setQueue] = useState([]);
  // Starts as the real defaults, not null — "Pricing settings" should be
  // usable the instant staff tap it, not gated behind a network round trip
  // that (on a flaky mobile connection) could leave this null indefinitely
  // with zero feedback. Real settings just overwrite this once loaded.
  const [multipliers, setMultipliers] = useState(DEFAULT_CONDITION_MULTIPLIERS);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (session) setSignedIn(true);
      setCheckedSession(true);
    });
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    dbLoadAll(toast).then(({ catalog: c, queue: q }) => { setCatalog(c); setQueue(q); });
    // dbLoadSettings already falls back to defaults on a Supabase-shaped
    // error, but a thrown network exception would reject this promise
    // instead — the .catch keeps that from silently leaving `multipliers`
    // on a stale value with no feedback.
    dbLoadSettings(toast).then(setMultipliers).catch(() => setMultipliers(DEFAULT_CONDITION_MULTIPLIERS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  async function handleSaveSettings(next) {
    setMultipliers(next);
    await dbSaveSettings(next, toast);
    setShowSettings(false);
    toast("Pricing settings saved");
  }

  useRealtimeSync({ enabled: signedIn, setCatalog, setQueue });

  const locations = useMemo(
    () => Array.from(new Set(catalog.map(c => c.location).filter(Boolean))).sort(),
    [catalog]
  );

  const pendingCount = queue.filter(t => !isTicketComplete(t)).length;

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
    // Toasts are single-slot, not a queue — combine into one call so a
    // warning doesn't just silently overwrite an unseen "Saved" message.
    const warnings = [priceOrderingWarning(nextCatalog, record), priceVsMarketValueWarning(record, multipliers)].filter(Boolean);
    if (warnings.length) toast(warnings.join(' '), true);
    else toast(`Saved ${record.name}`);
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
      // Snapshot which platforms were relevant at sale time, same reasoning
      // as the other snapshotted fields above — editing the item's channels
      // later shouldn't retroactively change what this ticket requires.
      posChannel: card.posChannel, tcgplayerChannel: card.tcgplayerChannel, collectrChannel: card.collectrChannel,
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
        posChannel: c.posChannel, tcgplayerChannel: c.tcgplayerChannel, collectrChannel: c.collectrChannel,
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
    if (isTicketComplete(merged)) {
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
          <img src={logoIcon} alt="" className="brand-logo" />
          <span className="mark">Ledger</span>
          <span className="sub brand-tagline">singles &amp; slabs · source of truth</span>
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
          multipliers={multipliers}
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
      <div className={`panel${tab === 'scanner' ? ' active' : ''}`}>
        <ScannerPanel catalog={catalog} locations={locations} onImport={handleImport} multipliers={multipliers} />
      </div>

      <div className="footnote">
        Shared store data, live in Supabase · not connected to POS, TCG Player, or Collectr APIs ·{' '}
        <a href="#" onClick={(e) => { e.preventDefault(); setShowSettings(true); }} style={{ color: 'var(--ink-faint)' }}>Pricing settings</a>
        {' · '}
        <a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }} style={{ color: 'var(--ink-faint)' }}>Sign out</a>
      </div>
      {showSettings && (
        <SettingsModal
          multipliers={multipliers}
          onClose={() => setShowSettings(false)}
          onSave={handleSaveSettings}
        />
      )}
    </div>
  );
}
