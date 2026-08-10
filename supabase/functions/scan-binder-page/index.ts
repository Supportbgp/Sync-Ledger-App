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

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
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
            set: { type: "string", description: "Set/expansion name if identifiable, else an empty string" },
            rarity: { type: "string", description: "Rarity as printed or shown by a rarity symbol on the card (e.g. 'Common', 'Rare', 'Rare Holo', 'Secret Rare'), else an empty string — used only to narrow an image search among same-name/same-set prints that differ by rarity, never saved as-is" },
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
  "as printed, the game it's from, the set/expansion if you can tell, its rarity if you can " +
  "tell from printed text or a rarity symbol, whether it looks foil/holo, its rough grid " +
  "position, and how confident you are. If you can't confidently identify a specific card, " +
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
