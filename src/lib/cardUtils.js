export function parseMoney(v) {
  if (v === "" || v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  const cleaned = String(v).replace(/[$,]/g, '').trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

export const GRADING_RE = /\b(PSA|BGS|CGC|SGC|Beckett)\s+((?:Gem\s*Mint|Black\s*Label|Gold\s*Label|Pristine|Mint)\s+)?(\d{1,2}(?:\.\d)?)\b\s*$/i;

export function detectGrading(rawName) {
  const name = (rawName || "").trim();
  const m = name.match(GRADING_RE);
  if (!m) {
    return { name: name, itemType: "single", grader: "", grade: "" };
  }
  let grader = m[1].toUpperCase();
  if (grader === "BECKETT") grader = "Beckett";
  const qualifier = (m[2] || "").trim();
  const num = m[3];
  const grade = qualifier ? (qualifier + " " + num) : num;
  const cleanedName = name.slice(0, m.index).replace(/[-–—\s]+$/, "").trim();
  return { name: cleanedName || name, itemType: "slab", grader: grader, grade: grade };
}

const GAME_ALIASES = {
  magic: "Magic", mtg: "Magic", "magic: the gathering": "Magic", "magic the gathering": "Magic",
  pokemon: "Pokemon", "pokémon": "Pokemon", pkmn: "Pokemon",
  yugioh: "Yugioh", "yu-gi-oh": "Yugioh", "yu-gi-oh!": "Yugioh", ygo: "Yugioh",
  lorcana: "Lorcana", "disney lorcana": "Lorcana",
  "one piece": "One Piece",
  sports: "Sports Singles", "sports singles": "Sports Singles",
  swu: "SWU", "star wars unlimited": "SWU", "star wars": "SWU",
  riftbound: "Riftbound",
};

// Imported spreadsheets rarely spell a game exactly like the Add/Edit form's
// dropdown does ("MTG" instead of "Magic", etc.) — coerce known variants onto
// the canonical string so the dropdown and the image-search game check (which
// compares against that exact string) both work on imported data.
function canonicalizeGame(raw) {
  const g = (raw || "").toString().trim();
  if (!g) return "Other";
  return GAME_ALIASES[g.toLowerCase()] || g;
}

export function normalizeCard(c) {
  return {
    sku: c.sku || "",
    name: c.name || "Unnamed",
    set: c.set || "",
    game: canonicalizeGame(c.game),
    condition: c.condition || "",
    printing: c.printing || "",
    qty: Number(c.qty) || 0,
    price: parseMoney(c.price),
    notes: c.notes || "",
    imageUrl: c.imageUrl || "",
    itemType: (c.itemType && c.itemType.toString().toLowerCase().indexOf("slab") !== -1) ? "slab" : (c.itemType || "single"),
    grader: c.grader || "",
    grade: c.grade || "",
    certNumber: c.certNumber || "",
    sourceUrl: c.sourceUrl || "",
    location: c.location || "",
    imageData: c.imageData || "",
    sold: (c.sold === true || c.sold === "true" || c.sold === "TRUE" || c.sold === "1" || (typeof c.sold === "string" && /^\s*sold\s*$/i.test(c.sold))),
    lastUpdated: c.lastUpdated || Date.now(),
  };
}

export function timeAgo(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return days + "d ago";
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export const SORT_COLUMNS = {
  name: c => (c.name || "").toLowerCase(),
  sku: c => (c.sku || "").toLowerCase(),
  qty: c => c.qty,
  price: c => c.price === null || c.price === undefined ? -Infinity : c.price,
  updated: c => c.lastUpdated ? new Date(c.lastUpdated).getTime() : 0,
};
