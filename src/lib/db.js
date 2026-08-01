import { supabaseClient } from './supabase.js';
import { normalizeCard } from './cardUtils.js';

function rowToCard(r) {
  return normalizeCard({
    sku: r.sku, name: r.name, set: r.set_name, game: r.game, condition: r.condition,
    printing: r.printing, qty: r.qty, price: r.price, notes: r.notes,
    imageUrl: r.image_data ? "local" : (r.image_url || ""),
    imageData: r.image_data || "",
    itemType: r.item_type, grader: r.grader, grade: r.grade, certNumber: r.cert_number,
    sold: r.sold, sourceUrl: r.source_url, location: r.location,
    lastUpdated: r.last_updated ? new Date(r.last_updated).getTime() : Date.now(),
  });
}

function cardToRow(c) {
  return {
    sku: c.sku, name: c.name, set_name: c.set, game: c.game, condition: c.condition,
    printing: c.printing, qty: c.qty, price: c.price, notes: c.notes,
    image_url: (c.imageUrl && c.imageUrl.startsWith('http')) ? c.imageUrl : '',
    image_data: c.imageUrl === 'local' ? (c.imageData || '') : '',
    item_type: c.itemType, grader: c.grader, grade: c.grade, cert_number: c.certNumber,
    sold: c.sold, source_url: c.sourceUrl, location: c.location,
    last_updated: new Date(c.lastUpdated).toISOString(),
  };
}

function rowToTicket(r) {
  return {
    id: r.id, sku: r.sku, name: r.name, set: r.set_name, condition: r.condition, printing: r.printing,
    price: r.price, qtySold: r.qty_sold, timestamp: new Date(r.ts).getTime(),
    cumulusDone: r.cumulus_done, sortswiftDone: r.sortswift_done,
  };
}

function ticketToRow(t) {
  return {
    id: t.id, sku: t.sku, name: t.name, set_name: t.set, condition: t.condition, printing: t.printing,
    price: t.price, qty_sold: t.qtySold, ts: new Date(t.timestamp).toISOString(),
    cumulus_done: t.cumulusDone, sortswift_done: t.sortswiftDone,
  };
}

export async function dbLoadAll(toast) {
  const { data: catRows, error: catErr } = await supabaseClient.from('catalog').select('*');
  let catalog = [];
  if (catErr) toast('Failed to load catalog: ' + catErr.message, true);
  else catalog = (catRows || []).map(rowToCard);

  const { data: qRows, error: qErr } = await supabaseClient.from('sync_queue').select('*');
  let queue = [];
  if (qErr) toast('Failed to load sync queue: ' + qErr.message, true);
  else queue = (qRows || []).map(rowToTicket);

  return { catalog, queue };
}

export async function dbUpsertCard(card, toast) {
  const { error } = await supabaseClient.from('catalog').upsert(cardToRow(card));
  if (error) toast('Save failed: ' + error.message, true);
}

export async function dbUpsertCards(cards, toast) {
  if (!cards.length) return;
  const { error } = await supabaseClient.from('catalog').upsert(cards.map(cardToRow));
  if (error) toast('Bulk save failed: ' + error.message, true);
}

export async function dbDeleteCard(sku, toast) {
  const { error } = await supabaseClient.from('catalog').delete().eq('sku', sku);
  if (error) toast('Delete failed: ' + error.message, true);
}

export async function dbDeleteCards(skus, toast) {
  const list = Array.from(skus);
  if (!list.length) return;
  const { error } = await supabaseClient.from('catalog').delete().in('sku', list);
  if (error) toast('Delete failed: ' + error.message, true);
}

export async function dbClearCatalog(toast) {
  const { error } = await supabaseClient.from('catalog').delete().neq('sku', '__never__');
  if (error) toast('Clear failed: ' + error.message, true);
}

export async function dbInsertTicket(ticket, toast) {
  const { error } = await supabaseClient.from('sync_queue').insert(ticketToRow(ticket));
  if (error) toast('Sync ticket failed: ' + error.message, true);
}

export async function dbInsertTickets(tickets, toast) {
  if (!tickets.length) return;
  const { error } = await supabaseClient.from('sync_queue').insert(tickets.map(ticketToRow));
  if (error) toast('Sync tickets failed: ' + error.message, true);
}

export async function dbUpdateTicketStamp(id, field, value, toast) {
  const col = field === 'cumulusDone' ? 'cumulus_done' : 'sortswift_done';
  const { error } = await supabaseClient.from('sync_queue').update({ [col]: value }).eq('id', id);
  if (error) toast('Update failed: ' + error.message, true);
}

export async function dbClearQueue(toast) {
  const { error } = await supabaseClient.from('sync_queue').delete().neq('id', '__never__');
  if (error) toast('Clear failed: ' + error.message, true);
}
