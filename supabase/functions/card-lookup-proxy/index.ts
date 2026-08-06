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
// real response sample for Riftbound, One Piece, and Gundam (card_code,
// name, set_code/set_label, rarity, _defaultImagePath). There's no
// documented name-filter param, so rather than guess one, we fetch the
// whole list and do the matching ourselves — the endpoint already proved it
// works with no query params at all, so this needs no further unverified
// assumptions.
//
// A name-only match isn't enough: many of these games reuse the same name
// across many separate prints (alt art, promos, base-set generics like
// Gundam's "EX Base" cards, which share that literal name across dozens of
// otherwise-unrelated cards distinguished only by card_code). setHint — the
// item's own `set` field, which for these games doubles as wherever a
// printed set/card code the vision scanner read off the card ends up — is
// matched against card_code/set_code/set_label to narrow to the exact
// print. If the hint doesn't match anything (typo, or genuinely no hint),
// we fall back to the unnarrowed name matches rather than returning empty.
async function egmanQuery(gameSlug, name, setHint) {
  const res = await fetch(`https://deckbuilder.egmanevents.com/api/cards/${gameSlug}`);
  if (!res.ok) return [];
  const cards = await res.json();
  const nameNeedle = name.toLowerCase();
  let matches = (Array.isArray(cards) ? cards : [])
    .filter((c) => (c.name || "").toLowerCase().includes(nameNeedle));

  if (setHint) {
    const codeNeedle = setHint.toLowerCase();
    const narrowed = matches.filter((c) =>
      (c.card_code || "").toLowerCase().includes(codeNeedle) ||
      (c.set_code || "").toLowerCase().includes(codeNeedle) ||
      (c.set_label || "").toLowerCase().includes(codeNeedle)
    );
    if (narrowed.length) matches = narrowed;
  }

  // A generous cap, not 6 — these are just thumbnails in a picker grid, and
  // a card with many prints (alt art, promos) needs enough of them visible
  // to actually find the right one. card_code + rarity in the label is what
  // makes otherwise-identical-looking same-name prints distinguishable.
  return matches
    .slice(0, 20)
    .map((c) => ({
      url: c._defaultImagePath ? `https://deckbuilder.egmanevents.com/api/images/${gameSlug}/${c._defaultImagePath}` : null,
      label: `${c.name} (${c.card_code || c.set_code || ""}${c.rarity ? ' · ' + c.rarity : ''})`,
    }))
    .filter((r) => r.url);
}

// Each provider takes a search string (+ optional set/code hint) and
// returns the normalized candidate shape the client already expects from
// cardSearch.js: { url, label }[].
const PROVIDERS = {
  onepiece: (query, setHint) => egmanQuery('optcg', query, setHint),
  riftbound: (query, setHint) => egmanQuery('riftbound', query, setHint),
  gundam: (query, setHint) => egmanQuery('gundam', query, setHint),

  // api.swu-db.com (not www. — that host 404s, the docs page and the API
  // itself live on different subdomains). Confirmed CORS-blocked and now
  // confirmed by a real response sample: array at data.data, fields
  // Name/FrontArt/Set, plus MarketPrice/LowPrice (unused here, but useful
  // later for the Market Value feature). setHint isn't wired in yet — the
  // docs only showed structured `q=` examples like `set:sor`/`c=3`, not a
  // documented way to combine a name filter with a set filter, and guessing
  // at that syntax risks breaking the name search that already works.
  swu: async (query, _setHint) => {
    const res = await fetch(`https://api.swu-db.com/cards/search?q=${encodeURIComponent(query)}&pretty=true`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).slice(0, 20).map((c) => ({
      url: c.FrontArt,
      label: `${c.Name} (${c.Set || ""})`,
      price: c.MarketPrice ? Number(c.MarketPrice) : null,
    })).filter((r) => r.url);
  },
};

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get("origin") || "");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    const { provider, query, setHint } = await req.json();
    if (!provider || !PROVIDERS[provider]) {
      return json({ error: `Unknown provider: ${provider}` }, 400, headers);
    }
    if (!query || typeof query !== "string") {
      return json({ error: "Missing query" }, 400, headers);
    }
    const results = await PROVIDERS[provider](query, setHint || "");
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
