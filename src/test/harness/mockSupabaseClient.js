// Stands in for src/lib/supabase.js during the Playwright E2E suite only —
// swapped in by vite.config.js's alias, active exclusively under
// `vite --mode harness` (which only playwright.config.js's webServer ever
// invokes). The real app (main.jsx/App.jsx/BinderView.jsx/Login.jsx) runs
// completely unmodified against this; nothing here is imported by production
// code, so it can't ship. See CLAUDE.md's testing section.
//
// State lives on `window.__HARNESS_DB__` / `window.__HARNESS_SIGNED_IN__` so
// a Playwright spec can seed/inspect it via `page.addInitScript` before
// navigation, or `page.evaluate` afterward, without needing a bundler-level
// per-test config.

const PRIMARY_KEY = {
  catalog: 'sku',
  sync_queue: 'id',
  store_settings: 'id',
  catalog_public_view: 'sku',
};

function defaultSeed() {
  return {
    catalog: [],
    sync_queue: [],
    store_settings: [{ id: 1, lp_pct: 85, mp_pct: 65, hp_pct: 45, dmg_pct: 25 }],
    catalog_public_view: [],
  };
}

function getDb() {
  if (!window.__HARNESS_DB__) {
    window.__HARNESS_DB__ = window.__HARNESS_SEED__
      ? JSON.parse(JSON.stringify(window.__HARNESS_SEED__))
      : defaultSeed();
  }
  return window.__HARNESS_DB__;
}

function matchesFilters(row, filters) {
  return filters.every(([type, field, value]) => {
    if (type === 'eq') return row[field] === value;
    if (type === 'neq') return row[field] !== value;
    if (type === 'in') return value.includes(row[field]);
    return true;
  });
}

function execute(table, op, filters) {
  const db = getDb();
  const key = PRIMARY_KEY[table];
  const rows = db[table] || (db[table] = []);

  if (op.type === 'select') {
    const matched = rows.filter((r) => matchesFilters(r, filters));
    return { data: op.single ? matched[0] ?? null : matched, error: null };
  }
  if (op.type === 'upsert') {
    const payload = Array.isArray(op.payload) ? op.payload : [op.payload];
    for (const item of payload) {
      const idx = rows.findIndex((r) => r[key] === item[key]);
      if (idx === -1) rows.push(item);
      else rows[idx] = item;
    }
    return { data: null, error: null };
  }
  if (op.type === 'insert') {
    const payload = Array.isArray(op.payload) ? op.payload : [op.payload];
    rows.push(...payload);
    return { data: null, error: null };
  }
  if (op.type === 'update') {
    for (const r of rows) {
      if (matchesFilters(r, filters)) Object.assign(r, op.payload);
    }
    return { data: null, error: null };
  }
  if (op.type === 'delete') {
    db[table] = rows.filter((r) => !matchesFilters(r, filters));
    return { data: null, error: null };
  }
  return { data: null, error: null };
}

function makeBuilder(table) {
  const filters = [];
  let op = { type: 'select' };
  const builder = {
    select() { op = { type: 'select' }; return builder; },
    upsert(payload) { op = { type: 'upsert', payload }; return builder; },
    insert(payload) { op = { type: 'insert', payload }; return builder; },
    update(payload) { op = { type: 'update', payload }; return builder; },
    delete() { op = { type: 'delete' }; return builder; },
    eq(field, value) { filters.push(['eq', field, value]); return builder; },
    neq(field, value) { filters.push(['neq', field, value]); return builder; },
    in(field, values) { filters.push(['in', field, values]); return builder; },
    maybeSingle() { op = { ...op, single: true }; return builder; },
    then(resolve, reject) {
      return Promise.resolve().then(() => execute(table, op, filters)).then(resolve, reject);
    },
  };
  return builder;
}

function makeChannel() {
  const channel = {
    on() { return channel; },
    subscribe() { return channel; },
  };
  return channel;
}

// Matches Login.jsx's shared-password flow closely enough to exercise it for
// real in the Login E2E spec, without touching Supabase Auth. Exported so
// e2e/login.spec.js doesn't need to duplicate the literal.
export const HARNESS_PASSWORD = 'harness-test-password';

export const supabaseClient = {
  auth: {
    async getSession() {
      const signedIn = window.__HARNESS_SIGNED_IN__ !== false;
      return { data: { session: signedIn ? { user: { id: 'harness-user' } } : null } };
    },
    async signInWithPassword({ password }) {
      if (password === HARNESS_PASSWORD) {
        window.__HARNESS_SIGNED_IN__ = true;
        return { data: { session: { user: { id: 'harness-user' } } }, error: null };
      }
      return { data: null, error: { message: 'Invalid login credentials' } };
    },
    async signOut() {
      window.__HARNESS_SIGNED_IN__ = false;
      return { error: null };
    },
    onAuthStateChange() {
      return { data: { subscription: { unsubscribe() {} } } };
    },
  },
  from(table) { return makeBuilder(table); },
  channel() { return makeChannel(); },
  removeChannel() {},
  functions: {
    // No real card-search/scanner backend in the harness — every provider
    // resolves to "no matches" rather than hanging or erroring, which is
    // enough to exercise the surrounding UI (status text, empty states).
    async invoke() { return { data: { results: [] }, error: null }; },
  },
};

export const SUPABASE_URL = 'https://harness.invalid';
export const SUPABASE_ANON_KEY = 'harness-anon-key';
export const SHARED_LOGIN_EMAIL = 'harness@example.com';
