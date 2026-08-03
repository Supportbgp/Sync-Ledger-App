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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CARD_GAMES = [
  "Magic", "Pokemon", "Yugioh", "Lorcana", "One Piece",
  "Sports Singles", "SWU", "Riftbound", "Other",
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
            foil: { type: "boolean", description: "Whether the card appears foil/holo" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: ["position", "name", "game", "confidence"],
        },
      },
    },
    required: ["cards"],
  },
};

const PROMPT_TEXT = "This is a photo of one page of a trading card binder — clear plastic " +
  "pockets, each holding one card. Identify every card you can see. For each, give its name " +
  "as printed, the game it's from, the set/expansion if you can tell, whether it looks " +
  "foil/holo, its rough grid position, and how confident you are. If you can't confidently " +
  "identify a specific card, still report it with your best guess and confidence \"low\" " +
  "rather than skipping it. Do not guess condition or price — only identification.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { image } = await req.json();
    if (!image || typeof image !== "string") {
      return json({ error: "Missing image" }, 400);
    }
    const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
      return json({ error: "Expected a base64 data URL" }, 400);
    }
    const [, mediaType, base64Data] = match;

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return json({ error: "Server not configured (missing ANTHROPIC_API_KEY secret)" }, 500);
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
      return json({ error: `Anthropic API error: ${errText}` }, 502);
    }

    const data = await anthropicRes.json();
    const toolUse = (data.content || []).find((b) => b.type === "tool_use");
    const cards = toolUse?.input?.cards || [];

    return json({ cards });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}
