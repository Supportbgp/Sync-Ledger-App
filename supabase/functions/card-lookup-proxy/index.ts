// Server-side proxy for card image/price lookups that block direct browser
// calls with no CORS headers (confirmed for One Piece and SWU by
// live-testing fetch() from the deployed app before building this), or that
// aren't a documented public API at all (Egman's deckbuilder — used with his
// explicit go-ahead, see CLAUDE.md). The fetch happens here, in Deno, where
// CORS doesn't apply at all (it's a browser-only restriction) — the browser
// only ever talks to this function, never to the upstream API directly.
//
// Deploy from the repo root with:
//   supabase functions deploy card-lookup-proxy
//
// Requires being signed in with the shared login on the client side, same as
// scan-binder-page — Edge Functions verify the caller's JWT by default.

const ALLOWED_ORIGINS = [
  "https://supportbgp.github.io",
  "http://localhost:5173",
  "http://localhost:4173",
];

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

// Egman's deckbuilder (deckbuilder.egmanevents.com) exposes one JSON
// endpoint per game returning that game's FULL card list — confirmed by a
// real response sample for Riftbound and One Piece (card_code, name,
// set_code/set_label, _defaultImagePath). There's no documented name-filter
// param, so rather than guess one, we fetch the whole list and do the name
// match ourselves — the endpoint already proved it works with no query
// params at all, so this needs no further unverified assumptions.
async function egmanQuery(gameSlug, query) {
  const res = await fetch(`https://deckbuilder.egmanevents.com/api/cards/${gameSlug}`);
  if (!res.ok) return [];
  const cards = await res.json();
  const needle = query.toLowerCase();
  return (Array.isArray(cards) ? cards : [])
    .filter((c) => (c.name || "").toLowerCase().includes(needle))
    .slice(0, 6)
    .map((c) => ({
      url: c._defaultImagePath ? `https://deckbuilder.egmanevents.com/api/images/${gameSlug}/${c._defaultImagePath}` : null,
      label: `${c.name} (${c.set_label || c.set_code || ""})`,
    }))
    .filter((r) => r.url);
}

// Each provider takes a search string and returns the normalized candidate
// shape the client already expects from cardSearch.js: { url, label }[].
const PROVIDERS = {
  onepiece: (query) => egmanQuery('optcg', query),
  riftbound: (query) => egmanQuery('riftbound', query),

  // TODO: endpoint + domain are confirmed from swu-db.com's own docs
  // (api.swu-db.com, not www. — that was the earlier 404's real cause), but
  // the response field names below are still an unconfirmed best guess —
  // no real response sample seen yet. Adjust once a real sample confirms
  // the fields. Wrong field names just mean empty results, not a crash —
  // every candidate without a resolved url is filtered out below.
  swu: async (query) => {
    const res = await fetch(`https://api.swu-db.com/cards/search?q=${encodeURIComponent(query)}&pretty=true`);
    if (!res.ok) return [];
    const data = await res.json();
    const cards = data.data || data.cards || data.results || [];
    return cards.slice(0, 6).map((c) => ({
      url: c.FrontArt || c.frontArt || c.image,
      label: `${c.Name || c.name} (${c.Set || c.set || ""})`,
    })).filter((r) => r.url);
  },
};

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get("origin") || "");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    const { provider, query } = await req.json();
    if (!provider || !PROVIDERS[provider]) {
      return json({ error: `Unknown provider: ${provider}` }, 400, headers);
    }
    if (!query || typeof query !== "string") {
      return json({ error: "Missing query" }, 400, headers);
    }
    const results = await PROVIDERS[provider](query);
    return json({ results }, 200, headers);
  } catch (err) {
    return json({ error: String(err) }, 500, headers);
  }
});

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "content-type": "application/json" },
  });
}
