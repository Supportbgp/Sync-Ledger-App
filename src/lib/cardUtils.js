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
  gundam: "Gundam", "gundam card game": "Gundam", gcg: "Gundam",
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

// A small colored tag per game, shown next to the item name so a mixed-game
// catalog (this shop carries 9+ lines) scans by color at a glance, not just
// by reading text. Originally reused the 6 shared UI accent tokens (some
// games sharing a color), but real-phone testing found 3 exact repeats
// (Magic/SWU, Pokemon/Riftbound, Yugioh/Gundam) plus Lorcana/One Piece sitting
// only ~10° apart on the color wheel despite being different tokens — too
// close to tell apart at badge size. Every game now gets its own dedicated
// hue (`--tag-*` custom properties, `.badge.tag-*` in CSS), spaced ~30-40°
// apart around the wheel — the minimum gap needed for them to read as
// genuinely different colors rather than shades of each other — each still
// individually verified at ≥4.5:1 contrast against white. "Other" gets no
// color at all.
export const GAME_TAG_CLASS = {
  Magic: "tag-purple",
  Pokemon: "tag-amber",
  Yugioh: "tag-rust",
  Lorcana: "tag-lorcana",
  "One Piece": "tag-blue",
  "Sports Singles": "tag-green",
  SWU: "tag-swu",
  Riftbound: "tag-riftbound",
  Gundam: "tag-gundam",
};

// Suggestions for the Rarity field's <datalist> (EditModal/ScannerPanel) — a
// text input with autocomplete, not a hard <select>, since Rarity is never
// saved and staff should still be able to type something that isn't listed.
// Values are real rarity strings pokemontcg.io's own data uses (verified
// directly against pokemon-tcg-data on GitHub, not guessed), grouped by era
// so the same free-text field works whether the card in hand is a brand new
// pull or something from a binder that's years old. Games with no entry
// here just get no suggestions — the field still works as plain free text.
export const RARITY_OPTIONS_BY_GAME = {
  Pokemon: [
    "Common", "Uncommon", "Rare", "Rare Holo",
    // Modern (2023+, Scarlet & Violet era, lowercase "ex")
    "Double Rare", "Illustration Rare", "Ultra Rare", "Special Illustration Rare", "Hyper Rare",
    // Mega Evolution era (2025+, "Mega ___ ex") — verified against a real
    // Mega Evolution/Ascended Heroes sample; Mega Hyper Rare replaces plain
    // Hyper Rare as that era's gold chase-card tier, and Mega Attack Rare
    // (real API value "MEGA_ATTACK_RARE" — see the normalization note in
    // cardSearch.js's preferRarity) debuted with Ascended Heroes.
    "Mega Attack Rare", "Mega Hyper Rare",
    // Older (2012-2022, uppercase "-EX"/"-GX"/"V")
    "Rare Holo EX", "Rare Holo GX", "Rare Holo V", "Rare Ultra", "Rare Secret",
  ],
};

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
    // Reminder checkboxes for whether this item's listing is up to date on
    // each platform — reset to false whenever a relevant field changes (see
    // the reset logic in App.jsx), not here, since this function also runs on
    // every read from the database and shouldn't wipe stored true values.
    posSynced: !!c.posSynced,
    tcgplayerSynced: !!c.tcgplayerSynced,
    collectrSynced: !!c.collectrSynced,
    // Which platforms this item is actually meant to be listed on — not
    // every item lives everywhere (some are in-store only). Defaults to
    // true so existing rows keep today's "assumed everywhere" behavior.
    posChannel: c.posChannel !== false,
    tcgplayerChannel: c.tcgplayerChannel !== false,
    collectrChannel: c.collectrChannel !== false,
    // NM reference price captured from whichever card candidate staff
    // actually selected in image search — the basis for the computed
    // Market Value shown next to Our Price (`price`). Never guessed;
    // stays null until a search result with a real price gets picked.
    basePrice: parseMoney(c.basePrice),
    // Dual-image model (Sprint 6): imageUrl/imageData above are the "stock"
    // reference (card search/manual paste); photoUrl/photoData are a real
    // photo (scanner crop or manual upload). activeImage records which one
    // staff want shown — see resolveActiveImage, which falls back to
    // whichever slot isn't blank if the preferred one is.
    photoUrl: c.photoUrl || "",
    photoData: c.photoData || "",
    activeImage: c.activeImage === "stock" ? "stock" : "photo",
  };
}

// Best-guess channel defaults for a new item: match whatever the majority of
// existing items already in this same binder/case use, since staff almost
// always add several cards from the same case in a row and it's already
// been decided where that case lives. Falls back to "everywhere" for a
// brand-new location or when nothing else is known yet.
export function channelDefaultsForLocation(catalog, location) {
  const fallback = { posChannel: true, tcgplayerChannel: true, collectrChannel: true };
  if (!location) return fallback;
  const siblings = catalog.filter(c => c.location === location);
  if (!siblings.length) return fallback;
  const majority = (field) => siblings.filter(c => c[field]).length >= siblings.length / 2;
  return {
    posChannel: majority('posChannel'),
    tcgplayerChannel: majority('tcgplayerChannel'),
    collectrChannel: majority('collectrChannel'),
  };
}

// A ticket only needs stamping on the platforms it was actually relevant to
// at sale time — a channel the item wasn't listed on counts as trivially
// satisfied so it doesn't block "complete" or show up as a stamp to make.
export function isTicketComplete(t) {
  return (!t.posChannel || t.posDone) && (!t.tcgplayerChannel || t.tcgplayerDone) && (!t.collectrChannel || t.collectrDone);
}

// Fields that, when changed, mean a listing may now be wrong on every
// platform — used to decide when to reset the three status checkboxes above.
export const PLATFORM_RESET_FIELDS = ['price', 'qty', 'condition', 'sold'];

export function needsPlatformStatusReset(existing, next) {
  if (!existing) return true; // brand new item
  return PLATFORM_RESET_FIELDS.some(f => existing[f] !== next[f]);
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

// Default condition-multiplier table (percent of NM) — anchored to
// CrystalCommerce's confirmed 100%/50% NM-to-Damaged default, centered on
// community-cited ranges (see CLAUDE.md). Store-configurable via
// store_settings; this is only the fallback before that loads.
export const DEFAULT_CONDITION_MULTIPLIERS = { NM: 100, LP: 85, MP: 65, HP: 45, DMG: 25 };

// The five recognized condition tiers with their full display names, in
// NM-first order — the Condition field's dropdown (EditModal/ScannerPanel)
// and SettingsModal's editable multiplier rows both read from this one
// list instead of keeping their own separate copies of the same names.
// Each full name is already a recognized alias in CONDITION_ALIASES below
// (e.g. "near mint" → NM), so picking one from the dropdown round-trips
// through canonicalizeCondition with no changes needed there.
export const CONDITION_TIERS = [
  { key: "NM", name: "Near Mint" },
  { key: "LP", name: "Lightly Played" },
  { key: "MP", name: "Moderately Played" },
  { key: "HP", name: "Heavily Played" },
  { key: "DMG", name: "Damaged" },
];
export const CONDITION_OPTIONS = CONDITION_TIERS.map(t => t.name);

const CONDITION_ALIASES = {
  nm: "NM", "near mint": "NM", mint: "NM", m: "NM",
  lp: "LP", "lightly played": "LP", "light play": "LP", "slightly played": "LP", sp: "LP",
  mp: "MP", "moderately played": "MP", "moderate play": "MP",
  hp: "HP", "heavily played": "HP", "heavy play": "HP",
  dmg: "DMG", damaged: "DMG", poor: "DMG", d: "DMG",
};

// Condition stays free text in the form (staff write "NM", "Near Mint",
// "nm" inconsistently) — this maps whatever's typed onto one of the five
// multiplier tiers, or null if it doesn't recognize it at all (a genuinely
// unrecognized condition shouldn't silently get treated as NM/100%).
export function canonicalizeCondition(raw) {
  const c = (raw || "").toString().trim().toLowerCase();
  if (!c) return null;
  return CONDITION_ALIASES[c] || null;
}

// basePrice is the NM reference price; multipliers is the store's
// configured (or default) percent-of-NM table. Returns null rather than
// guessing if either input is missing or the condition isn't recognized.
export function marketValueForCondition(basePrice, condition, multipliers) {
  if (basePrice == null) return null;
  const tier = canonicalizeCondition(condition);
  if (!tier) return null;
  const pct = tier === "NM" ? 100 : (multipliers && multipliers[tier]);
  if (pct == null) return null;
  return Math.round(basePrice * pct) / 100;
}

// A url/data pair follows the same convention throughout the app: url ===
// 'local' means the real image lives in the data column (a client-resized
// data: URI); otherwise url is used directly if it's a real http(s) link.
// Returns null if neither is actually populated.
function resolveSrc(url, data) {
  if (url === "local" && data) return data;
  if (url && url.startsWith("http")) return url;
  return null;
}

// Which image slot ("stock" or "photo") should actually be displayed for
// this item. Honors the stored preference (activeImage), but falls back to
// whichever slot actually has something if the preferred one is blank —
// "it defaults to any that is not blank."
export function resolveActiveImage(card) {
  const stockSrc = resolveSrc(card.imageUrl, card.imageData);
  const photoSrc = resolveSrc(card.photoUrl, card.photoData);
  const preferred = card.activeImage === "stock" ? "stock" : "photo";
  if (preferred === "stock") return stockSrc ? "stock" : (photoSrc ? "photo" : "stock");
  return photoSrc ? "photo" : (stockSrc ? "stock" : "photo");
}

// The actual src string (http URL or data: URI) to render for whichever
// slot resolveActiveImage picks, or null if neither slot has anything.
export function activeImageSrc(card) {
  const which = resolveActiveImage(card);
  return which === "stock" ? resolveSrc(card.imageUrl, card.imageData) : resolveSrc(card.photoUrl, card.photoData);
}

export const SORT_COLUMNS = {
  name: c => (c.name || "").toLowerCase(),
  sku: c => (c.sku || "").toLowerCase(),
  qty: c => c.qty,
  price: c => c.price === null || c.price === undefined ? -Infinity : c.price,
  updated: c => c.lastUpdated ? new Date(c.lastUpdated).getTime() : 0,
};
