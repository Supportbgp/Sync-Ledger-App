import { supabaseClient } from './supabase.js';
import { normalizeCard, DEFAULT_CONDITION_MULTIPLIERS } from './cardUtils.js';

export function rowToCard(r) {
  return normalizeCard({
    sku: r.sku, name: r.name, set: r.set_name, game: r.game, condition: r.condition,
    printing: r.printing, qty: r.qty, price: r.price, notes: r.notes,
    imageUrl: r.image_data ? "local" : (r.image_url || ""),
    imageData: r.image_data || "",
    itemType: r.item_type, grader: r.grader, grade: r.grade, certNumber: r.cert_number,
    sold: r.sold, sourceUrl: r.source_url, location: r.location,
    lastUpdated: r.last_updated ? new Date(r.last_updated).getTime() : Date.now(),
    posSynced: r.pos_synced, tcgplayerSynced: r.tcgplayer_synced, collectrSynced: r.collectr_synced,
    posChannel: r.pos_channel, tcgplayerChannel: r.tcgplayer_channel, collectrChannel: r.collectr_channel,
    basePrice: r.base_price,
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
    pos_synced: !!c.posSynced, tcgplayer_synced: !!c.tcgplayerSynced, collectr_synced: !!c.collectrSynced,
    pos_channel: c.posChannel !== false, tcgplayer_channel: c.tcgplayerChannel !== false, collectr_channel: c.collectrChannel !== false,
    base_price: c.basePrice ?? null,
  };
}

export function rowToTicket(r) {
  return {
    id: r.id, sku: r.sku, name: r.name, set: r.set_name, condition: r.condition, printing: r.printing,
    price: r.price, qtySold: r.qty_sold, timestamp: new Date(r.ts).getTime(),
    posDone: r.pos_done, tcgplayerDone: r.tcgplayer_done, collectrDone: r.collectr_done,
    posChannel: r.pos_channel, tcgplayerChannel: r.tcgplayer_channel, collectrChannel: r.collectr_channel,
  };
}

function ticketToRow(t) {
  return {
    id: t.id, sku: t.sku, name: t.name, set_name: t.set, condition: t.condition, printing: t.printing,
    price: t.price, qty_sold: t.qtySold, ts: new Date(t.timestamp).toISOString(),
    pos_done: t.posDone, tcgplayer_done: t.tcgplayerDone, collectr_done: t.collectrDone,
    pos_channel: t.posChannel !== false, tcgplayer_channel: t.tcgplayerChannel !== false, collectr_channel: t.collectrChannel !== false,
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

const TICKET_STAMP_COLUMNS = { posDone: 'pos_done', tcgplayerDone: 'tcgplayer_done', collectrDone: 'collectr_done' };

export async function dbUpdateTicketStamp(id, field, value, toast) {
  const col = TICKET_STAMP_COLUMNS[field];
  const { error } = await supabaseClient.from('sync_queue').update({ [col]: value }).eq('id', id);
  if (error) toast('Update failed: ' + error.message, true);
}

const PLATFORM_STATUS_COLUMNS = { posSynced: 'pos_synced', tcgplayerSynced: 'tcgplayer_synced', collectrSynced: 'collectr_synced' };

export async function dbUpdatePlatformStatus(sku, field, value, toast) {
  const col = PLATFORM_STATUS_COLUMNS[field];
  const { error } = await supabaseClient.from('catalog').update({ [col]: value }).eq('sku', sku);
  if (error) toast('Update failed: ' + error.message, true);
}

export async function dbClearQueue(toast) {
  const { error } = await supabaseClient.from('sync_queue').delete().neq('id', '__never__');
  if (error) toast('Clear failed: ' + error.message, true);
}

// Condition-multiplier settings — a singleton row (id=1), created by the
// migration. Falls back to the app's own defaults if the row is somehow
// missing rather than failing the whole settings load.
export async function dbLoadSettings(toast) {
  const { data, error } = await supabaseClient.from('store_settings').select('*').eq('id', 1).maybeSingle();
  if (error) {
    toast('Failed to load settings: ' + error.message, true);
    return { ...DEFAULT_CONDITION_MULTIPLIERS };
  }
  if (!data) return { ...DEFAULT_CONDITION_MULTIPLIERS };
  return { LP: data.lp_pct, MP: data.mp_pct, HP: data.hp_pct, DMG: data.dmg_pct };
}

export async function dbSaveSettings(multipliers, toast) {
  const { error } = await supabaseClient.from('store_settings').update({
    lp_pct: multipliers.LP, mp_pct: multipliers.MP, hp_pct: multipliers.HP, dmg_pct: multipliers.DMG,
    updated_at: new Date().toISOString(),
  }).eq('id', 1);
  if (error) toast('Failed to save settings: ' + error.message, true);
}

// Public binder lookup (QR-code page) — reads from catalog_public_view, a
// restricted view exposing only browsing-relevant columns for unauthenticated
// access. No session/login involved; see supabase/migrations for the view
// definition and its anon grant.
export async function dbLoadPublicBinder(location) {
  const { data, error } = await supabaseClient
    .from('catalog_public_view')
    .select('*')
    .eq('location', location);
  if (error) throw error;
  return (data || []).map(r => ({
    name: r.name, set: r.set_name, game: r.game, condition: r.condition, printing: r.printing,
    itemType: r.item_type, grader: r.grader, grade: r.grade,
    qty: r.qty, price: r.price,
    imageUrl: r.image_data ? "local" : (r.image_url || ""),
    imageData: r.image_data || "",
  }));
}
