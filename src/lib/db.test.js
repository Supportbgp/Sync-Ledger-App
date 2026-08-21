import { describe, it, expect, vi, beforeEach } from 'vitest';

// supabase.js calls createClient() at module load time, which we don't want
// touching a real (or even fake) network in a unit test — replace the whole
// module with a chainable mock that mirrors supabase-js's query builder
// closely enough for db.js's own call patterns (every chain method returns
// the same thenable object, which resolves to whatever result this test
// configured for that table).
const tableResults = {};
function makeQueryBuilder(table) {
  const builder = {
    select: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    maybeSingle: vi.fn(() => builder),
    then: (resolve, reject) => Promise.resolve(tableResults[table] ?? { data: null, error: null }).then(resolve, reject),
  };
  return builder;
}
const fromMock = vi.fn((table) => makeQueryBuilder(table));
vi.mock('./supabase.js', () => ({
  supabaseClient: { from: (...args) => fromMock(...args) },
}));

const {
  rowToCard, rowToTicket, dbUpsertCard, dbInsertTicket,
  dbLoadSettings, dbLoadPublicBinder,
} = await import('./db.js');

beforeEach(() => {
  fromMock.mockClear();
  for (const key of Object.keys(tableResults)) delete tableResults[key];
});

describe('rowToCard', () => {
  it('maps snake_case DB columns to the camelCase card shape', () => {
    const row = {
      sku: 'sku-1', name: 'Charizard', set_name: 'Base Set', game: 'Pokemon', condition: 'NM',
      printing: 'Holo', rarity: 'Special Illustration Rare', qty: 3, price: 45, notes: '',
      image_url: 'https://example.com/a.jpg', image_data: '',
      item_type: 'single', grader: '', grade: '', cert_number: '', sold: false, source_url: '', location: 'Binder A',
      last_updated: '2026-01-01T00:00:00.000Z', pos_synced: true, tcgplayer_synced: false, collectr_synced: false,
      pos_channel: true, tcgplayer_channel: true, collectr_channel: true, base_price: 50,
      photo_url: '', photo_data: '', active_image: 'stock',
    };
    const card = rowToCard(row);
    expect(card.sku).toBe('sku-1');
    expect(card.set).toBe('Base Set');
    expect(card.rarity).toBe('Special Illustration Rare');
    expect(card.imageUrl).toBe('https://example.com/a.jpg');
    expect(card.basePrice).toBe(50);
    expect(card.activeImage).toBe('stock');
    expect(card.lastUpdated).toBe(new Date('2026-01-01T00:00:00.000Z').getTime());
  });

  it('maps a data-backed image to the "local" convention', () => {
    const row = { sku: 's', name: 'n', image_url: 'https://ignored.example.com', image_data: 'data:image/jpeg;base64,abc' };
    const card = rowToCard(row);
    expect(card.imageUrl).toBe('local');
    expect(card.imageData).toBe('data:image/jpeg;base64,abc');
  });
});

describe('rowToTicket', () => {
  it('maps snake_case ticket columns to the camelCase ticket shape', () => {
    const row = {
      id: 't1', sku: 'sku-1', name: 'Charizard', set_name: 'Base Set', condition: 'NM', printing: 'Holo',
      price: 45, qty_sold: 1, ts: '2026-01-01T00:00:00.000Z',
      pos_done: true, tcgplayer_done: false, collectr_done: false,
      pos_channel: true, tcgplayer_channel: true, collectr_channel: false,
    };
    const ticket = rowToTicket(row);
    expect(ticket).toMatchObject({
      id: 't1', sku: 'sku-1', set: 'Base Set', qtySold: 1,
      posDone: true, tcgplayerDone: false, collectrDone: false,
      posChannel: true, tcgplayerChannel: true, collectrChannel: false,
    });
    expect(ticket.timestamp).toBe(new Date('2026-01-01T00:00:00.000Z').getTime());
  });
});

describe('dbUpsertCard (cardToRow via the real call)', () => {
  it('sends the correctly-shaped row to catalog.upsert, including the local-image convention', async () => {
    tableResults.catalog = { data: null, error: null };
    const card = {
      sku: 'sku-1', name: 'Charizard', set: 'Base Set', game: 'Pokemon', condition: 'NM', printing: 'Holo',
      rarity: 'Special Illustration Rare',
      qty: 3, price: 45, notes: '', imageUrl: 'local', imageData: 'data:image/jpeg;base64,abc',
      itemType: 'single', grader: '', grade: '', certNumber: '', sold: false, sourceUrl: '', location: 'Binder A',
      lastUpdated: Date.parse('2026-01-01T00:00:00.000Z'),
      posSynced: true, tcgplayerSynced: false, collectrSynced: false,
      posChannel: true, tcgplayerChannel: true, collectrChannel: true, basePrice: 50,
      photoUrl: '', photoData: '', activeImage: 'photo',
    };
    const toast = vi.fn();
    await dbUpsertCard(card, toast);

    const builder = fromMock.mock.results[0].value;
    expect(fromMock).toHaveBeenCalledWith('catalog');
    expect(builder.upsert).toHaveBeenCalledTimes(1);
    const sentRow = builder.upsert.mock.calls[0][0];
    expect(sentRow.image_url).toBe(''); // 'local' never writes a URL
    expect(sentRow.image_data).toBe('data:image/jpeg;base64,abc');
    expect(sentRow.base_price).toBe(50);
    expect(sentRow.active_image).toBe('photo');
    expect(sentRow.rarity).toBe('Special Illustration Rare');
    expect(toast).not.toHaveBeenCalled();
  });

  it('reports a save error to the toast instead of throwing', async () => {
    tableResults.catalog = { data: null, error: { message: 'boom' } };
    const toast = vi.fn();
    await dbUpsertCard({ sku: 's', name: 'n', lastUpdated: Date.now() }, toast);
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('boom'), true);
  });
});

describe('dbInsertTicket (ticketToRow via the real call)', () => {
  it('sends the correctly-shaped row to sync_queue.insert', async () => {
    tableResults.sync_queue = { data: null, error: null };
    const ticket = {
      id: 't1', sku: 'sku-1', name: 'Charizard', set: 'Base Set', condition: 'NM', printing: 'Holo',
      price: 45, qtySold: 1, timestamp: Date.parse('2026-01-01T00:00:00.000Z'),
      posDone: true, tcgplayerDone: false, collectrDone: false,
      posChannel: true, tcgplayerChannel: false, collectrChannel: true,
    };
    await dbInsertTicket(ticket, vi.fn());
    const builder = fromMock.mock.results[0].value;
    const sentRow = builder.insert.mock.calls[0][0];
    expect(sentRow.set_name).toBe('Base Set');
    expect(sentRow.qty_sold).toBe(1);
    expect(sentRow.tcgplayer_channel).toBe(false);
  });
});

describe('dbLoadSettings', () => {
  it('returns the mapped multiplier row when one exists', async () => {
    tableResults.store_settings = { data: { lp_pct: 80, mp_pct: 60, hp_pct: 40, dmg_pct: 20 }, error: null };
    const result = await dbLoadSettings(vi.fn());
    expect(result).toEqual({ LP: 80, MP: 60, HP: 40, DMG: 20 });
  });
  it('falls back to defaults when the row is missing', async () => {
    tableResults.store_settings = { data: null, error: null };
    const result = await dbLoadSettings(vi.fn());
    expect(result).toEqual({ NM: 100, LP: 85, MP: 65, HP: 45, DMG: 25 });
  });
  it('falls back to defaults and toasts on a load error, without throwing', async () => {
    tableResults.store_settings = { data: null, error: { message: 'down' } };
    const toast = vi.fn();
    const result = await dbLoadSettings(toast);
    expect(result).toEqual({ NM: 100, LP: 85, MP: 65, HP: 45, DMG: 25 });
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('down'), true);
  });
});

describe('dbLoadPublicBinder', () => {
  it('maps public-view rows the same way rowToCard does for images', async () => {
    tableResults.catalog_public_view = {
      data: [
        { name: 'Charizard', set_name: 'Base Set', game: 'Pokemon', condition: 'NM', printing: 'Holo',
          item_type: 'single', grader: '', grade: '', qty: 3, price: 45,
          image_url: 'https://example.com/a.jpg', image_data: '',
          photo_url: '', photo_data: 'data:image/jpeg;base64,abc', active_image: 'photo' },
      ],
      error: null,
    };
    const items = await dbLoadPublicBinder('Binder A');
    expect(items).toHaveLength(1);
    expect(items[0].imageUrl).toBe('https://example.com/a.jpg');
    expect(items[0].photoUrl).toBe('local');
    expect(items[0].photoData).toBe('data:image/jpeg;base64,abc');
  });

  it('throws on a load error rather than silently returning nothing', async () => {
    tableResults.catalog_public_view = { data: null, error: { message: 'nope' } };
    await expect(dbLoadPublicBinder('Binder A')).rejects.toBeTruthy();
  });
});
