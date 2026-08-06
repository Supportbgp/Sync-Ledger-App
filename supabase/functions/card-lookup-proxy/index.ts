// Server-side proxy for card image/price lookups that block direct browser
// calls with no CORS headers — confirmed for One Piece (optcgapi.com) and
// SWU (www.swu-db.com) by live-testing fetch() from the deployed app before
// building this. The fetch happens here, in Deno, where CORS doesn't apply
// at all (it's a browser-only restriction) — the browser only ever talks to
// this function, never to the upstream API directly.
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

// Each provider takes a search string and returns the normalized candidate
// shape the client already expects from cardSearch.js: { url, label }[].
const PROVIDERS = {
  // TODO: confirmed CORS-blocked, but the real search-by-name endpoint isn't
  // confirmed yet — optcgapi.com/documentation only showed per-card-ID
  // lookups in research so far. Fill in once verified; until then this
  // provider intentionally returns nothing rather than guess a path.
  onepiece: async (_query) => {
    return [];
  },

  // TODO: endpoint shape (/cards/search?q=) is confirmed from swu-db.com's
  // own docs, but the response field names below (FrontArt/MarketPrice) are
  // an unconfirmed best guess from secondhand research, not a verified
  // response — browser CORS blocked reading the actual body during testing.
  // Adjust once a real response sample (e.g. via Postman) confirms the
  // fields. Wrong field names just mean empty results, not a crash — every
  // candidate without a resolved url is filtered out below.
  swu: async (query) => {
    const res = await fetch(`https://www.swu-db.com/cards/search?q=${encodeURIComponent(query)}`);
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
