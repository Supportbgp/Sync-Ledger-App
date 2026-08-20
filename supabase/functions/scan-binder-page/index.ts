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
                "at all is usually good enough to judge its overall visual style, even when the fine print " +
                "isn't legible. Use this order of visual cues: " +
                "(1) Artwork fills almost the entire card front edge-to-edge with little or no colored info " +
                "box/border left, depicting a wide or multi-character scene → 'Special Illustration Rare'. " +
                "(2) Artwork is large and bleeds past a normal card frame, but a colored HP/type info box is " +
                "still visible, usually a single-subject illustration → 'Illustration Rare'. " +
                "(3) The card's border itself is gold, rainbow, or another metallic/textured finish replacing " +
                "the normal colored frame → 'Hyper Rare' (or 'Rare Secret' for an older/non-modern card style). " +
                "(4) A normal colored border and attack/ability text box, but the artwork itself has a visible " +
                "holographic/foil sheen → 'Rare Holo'. " +
                "(5) None of the above (a plain, non-foil card with a standard border) — telling Common/" +
                "Uncommon/Rare apart at this point genuinely requires reading a tiny rarity symbol next to the " +
                "collector number, which often isn't reliable from a binder photo. Only report one of these " +
                "three if that symbol/text is actually legible; otherwise leave this field as an empty string " +
                "rather than guessing. " +
                "IMPORTANT: this is NOT the same as a Pokemon card's type/subtype printed in its name area — " +
                "'ex', 'GX', 'V', 'VMAX', and 'VSTAR' are card subtypes, not rarities, and must never be " +
                "reported in this field even if that's the only text you can make out (an 'ex'/'V'/etc. card " +
                "is frequently ALSO an Illustration Rare or Special Illustration Rare print — use the visual " +
                "cues above to identify that, rather than reporting the subtype itself). Used only to narrow " +
                "an image search among same-name/same-set prints that differ by rarity, never saved as-is.",
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
  "be read. For rarity, judge PRIMARILY from the card's overall visual style — how much of the " +
  "card front is illustration vs. a normal colored border/text box, and whether the border itself " +
  "is a special foil/metallic finish — rather than trying to read tiny printed rarity text, which " +
  "is often illegible from an ordinary binder photo even when the card itself is clearly " +
  "identifiable. A nearly borderless, edge-to-edge illustration is a Special Illustration Rare or " +
  "Illustration Rare; a gold/rainbow/metallic border replacing the normal frame is a Hyper Rare or " +
  "Rare Secret; a normal bordered card with a foil sheen over the art is a Rare Holo. Only fall " +
  "back to reading a tiny rarity symbol/text for the plain Common/Uncommon/Rare tiers, and leave " +
  "rarity blank rather than guess if that's not legible. Pokemon 'ex'/'GX'/'V'/'VMAX'/'VSTAR' are " +
  "card subtypes printed in the name area, not rarities, and must never be reported as the rarity " +
  "— use the visual cues above instead, since these subtypes are frequently also Illustration Rare " +
  "or Special Illustration Rare prints. If you can't confidently identify a specific card, " +
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
