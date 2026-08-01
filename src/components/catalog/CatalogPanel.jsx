import { useMemo, useState } from 'react';
import { SORT_COLUMNS } from '../../lib/cardUtils.js';
import CatalogToolbar from './CatalogToolbar.jsx';
import BatchBar from './BatchBar.jsx';
import CatalogTable from './CatalogTable.jsx';
import EditModal from './EditModal.jsx';
import SellModal from './SellModal.jsx';
import { useUI } from '../../context/UIContext.jsx';

export default function CatalogPanel({ catalog, onSaveCard, onDeleteCard, onSellCard, onBatchDelete, onBatchSell, onTogglePlatformStatus }) {
  const { showConfirm } = useUI();
  const [search, setSearch] = useState("");
  const [gameFilter, setGameFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortState, setSortState] = useState({ col: 'name', dir: 1 });
  const [selectedSkus, setSelectedSkus] = useState(new Set());
  const [editingSku, setEditingSku] = useState(undefined); // undefined = closed, null = adding, sku = editing
  const [sellingSku, setSellingSku] = useState(null);

  const games = useMemo(() => Array.from(new Set(catalog.map(c => c.game).filter(Boolean))).sort(), [catalog]);
  const locations = useMemo(() => Array.from(new Set(catalog.map(c => c.location).filter(Boolean))).sort(), [catalog]);

  const filteredRows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return catalog.filter(c => {
      if (s) {
        const hay = (c.name + " " + c.set + " " + c.sku + " " + c.notes + " " + c.location).toLowerCase();
        if (!hay.includes(s)) return false;
      }
      if (gameFilter && c.game !== gameFilter) return false;
      if (locationFilter && c.location !== locationFilter) return false;
      if (typeFilter && c.itemType !== typeFilter) return false;
      if (statusFilter === "available" && (c.sold || c.qty <= 0)) return false;
      if (statusFilter === "sold" && !(c.sold || c.qty <= 0)) return false;
      return true;
    });
  }, [catalog, search, gameFilter, locationFilter, typeFilter, statusFilter]);

  const sortedRows = useMemo(() => {
    const sortKey = SORT_COLUMNS[sortState.col] || SORT_COLUMNS.name;
    const rows = filteredRows.slice();
    rows.sort((a, b) => {
      const av = sortKey(a), bv = sortKey(b);
      const cmp = typeof av === "string" ? av.localeCompare(bv) : (av > bv ? 1 : av < bv ? -1 : 0);
      return cmp * sortState.dir;
    });
    return rows;
  }, [filteredRows, sortState]);

  function setSort(col) {
    setSortState(s => s.col === col ? { col, dir: s.dir * -1 } : { col, dir: 1 });
  }

  function toggleSelected(sku, checked) {
    setSelectedSkus(prev => {
      const next = new Set(prev);
      if (checked) next.add(sku); else next.delete(sku);
      return next;
    });
  }
  function toggleSelectAll(skus, checked) {
    setSelectedSkus(prev => {
      const next = new Set(prev);
      skus.forEach(sku => checked ? next.add(sku) : next.delete(sku));
      return next;
    });
  }

  async function handleBatchDelete() {
    const count = selectedSkus.size;
    if (!count) return;
    if (!(await showConfirm(`Delete ${count} selected item(s)? This can't be undone.`))) return;
    await onBatchDelete(selectedSkus);
    setSelectedSkus(new Set());
  }

  async function handleBatchSell() {
    const count = selectedSkus.size;
    if (!count) return;
    if (!(await showConfirm(`Mark ${count} selected item(s) as sold? This creates sync tickets for each.`))) return;
    await onBatchSell(selectedSkus);
    setSelectedSkus(new Set());
  }

  const editingCard = editingSku ? catalog.find(c => c.sku === editingSku) : null;
  const sellingCard = sellingSku ? catalog.find(c => c.sku === sellingSku) : null;

  return (
    <div>
      <CatalogToolbar
        search={search} setSearch={setSearch}
        gameFilter={gameFilter} setGameFilter={setGameFilter}
        locationFilter={locationFilter} setLocationFilter={setLocationFilter}
        typeFilter={typeFilter} setTypeFilter={setTypeFilter}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        games={games} locations={locations}
        onAddItem={() => setEditingSku(null)}
      />
      {selectedSkus.size > 0 && (
        <BatchBar
          count={selectedSkus.size}
          onMarkSold={handleBatchSell}
          onDelete={handleBatchDelete}
          onClear={() => setSelectedSkus(new Set())}
        />
      )}
      <div className="card">
        <CatalogTable
          catalogEmpty={catalog.length === 0}
          rows={sortedRows}
          sortState={sortState}
          onSort={setSort}
          selectedSkus={selectedSkus}
          onToggleSelected={toggleSelected}
          onToggleSelectAll={toggleSelectAll}
          onEdit={(sku) => setEditingSku(sku)}
          onSell={(sku) => setSellingSku(sku)}
          onTogglePlatformStatus={onTogglePlatformStatus}
        />
      </div>
      {editingSku !== undefined && (
        <EditModal
          card={editingCard}
          locations={locations}
          onClose={() => setEditingSku(undefined)}
          onSave={async (record, prevSku) => { await onSaveCard(record, prevSku); setEditingSku(undefined); }}
          onDelete={async (sku) => { await onDeleteCard(sku); setEditingSku(undefined); }}
        />
      )}
      {sellingCard && (
        <SellModal
          card={sellingCard}
          onClose={() => setSellingSku(null)}
          onConfirm={async (qty) => { await onSellCard(sellingCard, qty); setSellingSku(null); }}
        />
      )}
    </div>
  );
}
