// Identifies trading cards in a photo of one binder page (a grid of clear
// plastic pockets, one card each). Holds the Anthropic API key server-side —
// this must never end up in the client bundle. Set it with:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Deploy from the repo root with:
//   supabase functions deploy scan-binder-page
//
// Requires being signed in with the shared login on the client side — Edge
// Functions verify the caller's JWT by default, and supabaseClient.functions
// .invoke() automatically attaches the current session's token.

// Scoped to an allowlist rather than "*" — this function requires a valid
// session JWT, so a wildcard origin would let any site's JS call it on
// behalf of a signed-in user's browser if a token ever leaked (e.g. via an
// unrelated XSS elsewhere). localhost stays allowed for dev/preview testing
// against the same deployed function.
const ALLOWED_ORIGINS = [
  "https://supportbgp.github.io",
  "http://localhost:5173",
  "http://localhost:4173",
];

// The exact-match list above only ever matched `localhost` — testing via
// `npm run dev -- --host` (needed to reach the dev server from a phone on
// the same LAN) serves from a private-IP origin instead, which silently
// failed CORS on that phone while the same call worked fine from a laptop's
// `localhost` origin. Matches any RFC1918 private range on Vite's dev/preview
// ports, not a specific IP, since that address varies by network.
const DEV_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):(5173|4173)$/;

function isAllowedOrigin(origin) {
  return ALLOWED_ORIGINS.includes(origin) || DEV_ORIGIN_RE.test(origin);
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

const CARD_GAMES = [
  "Magic", "Pokemon", "Yugioh", "Lorcana", "One Piece",
  "Sports Singles", "SWU", "Riftbound", "Gundam", "Other",
];

const DETECT_CARDS_TOOL = {
  name: "report_detected_cards",
  description: "Reports every trading card detected in the binder page photo.",
  input_schema: {
    type: "object",
    properties: {
      cards: {
        type: "array",
        items: {
          type: "object",
          properties: {
            position: { type: "string", description: "Rough grid position, e.g. 'row1-col2' — top-left is row1-col1" },
            name: { type: "string", description: "Card name as printed" },
            game: { type: "string", enum: CARD_GAMES },
            set: {
              type: "string",
              description: "The SPECIFIC printed set/expansion name if you can identify it, else an empty string. For Pokemon especially: prefer the specific expansion (e.g. 'Paldean Fates', 'Obsidian Flames', 'Ascended Heroes') over the general era/block — 'Scarlet & Violet' alone is too vague if a more specific name is legible near the set symbol/collector number at the bottom of the card. Only fall back to the era name if the specific expansion truly isn't legible.",
            },
            number: {
              type: "string",
              description: "The printed collector number for this exact print, read from near the set symbol at the bottom of the card — e.g. '280' or '280/217' if a total-count denominator is shown. Else an empty string if not legible. This is one of the strongest signals for telling apart same-name prints (a card can have many alternate-art/rarity versions with the same name), so look closely for it even if you're unsure of the set or rarity. Used only to narrow an image search, never saved as-is.",
            },
            rarity: {
              type: "string",
              description: "Rarity — determine this PRIMARILY from the card's overall visual layout/border " +
                "treatment, not by trying to read tiny printed rarity text/symbols, which are often too small " +
                "or blurry to trust in an ordinary binder-page photo. A photo good enough to identify the card " +
                "at all is usually good enough to judge its overall visual style. Report EXACTLY one of the " +
                "values below (they match this game's real rarity database) based on which visual description " +
                "fits, or an empty string if none clearly apply. Pokemon has used two rarity-naming systems by " +
                "era — use whichever era the card's overall art style/set matches: " +
                "MODERN cards (2023-present, Scarlet & Violet era, 'ex' lowercase suffix): " +
                "'Double Rare' = normal small boxed artwork (NOT full art) for an 'ex' Pokemon, with an all-over " +
                "foil/holo sheen across the whole card face, not just over the art window. " +
                "'Illustration Rare' = artwork covers the card's ENTIRE front edge-to-edge with no colored info " +
                "box left at all, plus a holographic border line around the very edge; usually a non-'ex' " +
                "Pokemon or a Trainer/Supporter card. " +
                "'Ultra Rare' = the same full-bleed edge-to-edge treatment as Illustration Rare, but for an " +
                "'ex' Pokemon. " +
                "'Special Illustration Rare' = the same full-bleed edge-to-edge art, PLUS a visible extra " +
                "sparkle/glitter-foil texture over the whole card (often a wider, multi-element scene); for an " +
                "'ex' Pokemon or a Trainer/Supporter card. " +
                "'Hyper Rare' = the card's entire border/background is a gold-toned holographic finish " +
                "replacing the normal color scheme — a distinctly gold, 'gilded' looking card. " +
                "OLDER cards (roughly 2012-2022, '-EX'/'-GX'/'V' suffix, uppercase): " +
                "'Rare Holo' = normal small boxed artwork with a holographic sheen over just the art. " +
                "'Rare Holo EX' / 'Rare Holo GX' / 'Rare Holo V' = normal card frame for an EX/GX/V-suffixed " +
                "Pokemon, but the illustration typically breaks past the frame's edge (the Pokemon visually " +
                "overlapping the border) instead of staying boxed inside a small window, plus a holo sheen. " +
                "'Rare Ultra' = full-art version of the same EX/GX/V Pokemon — artwork extends well past the " +
                "normal small window, though a colored bar remains where the attack text sits (bottom-only for " +
                "EX-era cards; thin bars top AND bottom for GX/V-era cards). " +
                "'Rare Secret' = the same full-art extent as Rare Ultra, but with a gold-toned holographic " +
                "border/background replacing the normal frame colors, and/or a collector number higher than " +
                "the set's listed total (e.g. '105' printed in a set whose total is '100'). " +
                "ANY era, plain non-foil card with a standard small-boxed border and none of the above visual " +
                "traits: 'Common' / 'Uncommon' / 'Rare' — these three genuinely cannot be told apart by look " +
                "alone; only report one if a tiny rarity symbol next to the collector number is actually " +
                "legible, otherwise leave this field blank rather than guessing. " +
                "IMPORTANT: never report a Pokemon card's type/subtype printed in its name area — 'ex', 'EX', " +
                "'GX', 'V', 'VMAX', and 'VSTAR' are card subtypes, not rarities, even though they're a required " +
                "clue for several of the values above (e.g. telling 'Illustration Rare' apart from 'Ultra " +
                "Rare' requires noticing the 'ex' suffix in the name). Used only to narrow an image search " +
                "among same-name/same-set prints that differ by rarity, never saved as-is.",
            },
            foil: { type: "boolean", description: "Whether the card appears foil/holo" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            bbox: {
              type: "object",
              description: "Bounding box of just this one card's pocket within the full photo, as fractions (0.0 to 1.0) of the photo's total width/height — used to crop this exact card out of the page photo as its own real-photo reference. The bottom edge of a pocket is usually the clearest, most unambiguous line on the page — anchor there first, then find the top edge, which more often blends into the pocket/page above it. If you're unsure exactly where the card ends, err toward a slightly LARGER box rather than a tight one — a little extra background is much less of a problem than clipping part of the card.",
              properties: {
                x_min: { type: "number", description: "Left edge, as a fraction of image width" },
                y_min: { type: "number", description: "Top edge, as a fraction of image height — the edge most likely to be underestimated (cut too low, clipping the card's top). When unsure, place this slightly higher (smaller value) than your best guess." },
                x_max: { type: "number", description: "Right edge, as a fraction of image width" },
                y_max: { type: "number", description: "Bottom edge, as a fraction of image height — usually the clearest edge to locate; anchor this one first." },
              },
              required: ["x_min", "y_min", "x_max", "y_max"],
            },
          },
          required: ["position", "name", "game", "confidence", "bbox"],
        },
      },
    },
    required: ["cards"],
  },
};

const PROMPT_TEXT = "This is a photo of one page of a trading card binder — clear plastic " +
  "pockets, each holding one card. Identify every card you can see. For each, give its name " +
  "as printed, the game it's from, the set/expansion if you can tell, its printed collector " +
  "number if legible, its rarity if you can tell from printed text or a rarity symbol, " +
  "whether it looks foil/holo, its rough grid position, and how confident you are. A single " +
  "card name can have many different prints (alternate arts, different rarities, etc.) that " +
  "only the set, number, and rarity actually tell apart, so look closely for those even when " +
  "you're confident about the name. For set, prefer the specific expansion name over the " +
  "general era/block if it's legible near the set symbol — for Pokemon cards, 'Scarlet & " +
  "Violet' alone is too vague when a more specific expansion name (e.g. 'Paldean Fates') can " +
  "be read. For rarity, judge PRIMARILY from the card's overall visual style, matching one of " +
  "Pokemon's real rarity names exactly (not a description) — how much of the card front is " +
  "illustration vs. a normal colored border/text box, whether the border itself is a foil/metallic " +
  "finish, and whether the Pokemon's name has an 'ex'/'EX'/'GX'/'V' suffix — rather than trying to " +
  "read tiny printed rarity text, which is often illegible from an ordinary binder photo even when " +
  "the card itself is clearly identifiable. Modern cards (2023+, lowercase 'ex'): full-bleed " +
  "edge-to-edge art with a holo border line is 'Illustration Rare' (non-ex) or 'Ultra Rare' (ex); " +
  "the same full-bleed art plus extra glitter foil is 'Special Illustration Rare'; a normal small " +
  "boxed-art frame with all-over foil for an ex Pokemon is 'Double Rare'; an all-gold border/" +
  "background is 'Hyper Rare'. Older cards (2012-2022, uppercase '-EX'/'-GX'/'V'): a normal frame " +
  "with the art breaking past its border, foil, for an EX/GX/V Pokemon is 'Rare Holo EX'/'Rare Holo " +
  "GX'/'Rare Holo V'; a non-EX/GX/V card with foil over just the art is 'Rare Holo'; full art with a " +
  "text bar remaining is 'Rare Ultra'; the same full art plus a gold border (or a collector number " +
  "past the set's total) is 'Rare Secret'. Only fall back to reading a tiny rarity symbol/text for " +
  "the plain Common/Uncommon/Rare tiers, and leave rarity blank rather than guess if that's not " +
  "legible. The 'ex'/'EX'/'GX'/'V'/'VMAX'/'VSTAR' suffix itself is a card subtype, not a rarity, and " +
  "must never be reported as the rarity value — it's only a clue for picking the right rarity name " +
  "above. If you can't confidently identify a specific card, " +
  "still report it with your best guess and confidence \"low\" rather than skipping it. Do " +
  "not guess condition or price — only identification. Also give " +
  "a bounding box around just that one card's pocket (not the whole page), as fractions of " +
  "the full photo's width/height — this is used to crop that exact card out of the page " +
  "photo, so it needs to actually bound that card and not a neighboring one. Anchor on the " +
  "pocket's bottom edge first, since it's usually the clearest line on the page, then find " +
  "the top edge — that one's more often underestimated because it blends into the pocket " +
  "above. When uncertain, err toward a slightly larger box rather than a tight one: a little " +
  "extra background in the crop is fine, clipping part of the card is not.";

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get("origin") || "");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    const { image } = await req.json();
    if (!image || typeof image !== "string") {
      return json({ error: "Missing image" }, 400, headers);
    }
    const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
      return json({ error: "Expected a base64 data URL" }, 400, headers);
    }
    const [, mediaType, base64Data] = match;

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return json({ error: "Server not configured (missing ANTHROPIC_API_KEY secret)" }, 500, headers);
    }

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 2048,
        tools: [DETECT_CARDS_TOOL],
        tool_choice: { type: "tool", name: "report_detected_cards" },
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
              { type: "text", text: PROMPT_TEXT },
            ],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return json({ error: `Anthropic API error: ${errText}` }, 502, headers);
    }

    const data = await anthropicRes.json();
    const toolUse = (data.content || []).find((b) => b.type === "tool_use");
    const cards = toolUse?.input?.cards || [];

    return json({ cards }, 200, headers);
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
