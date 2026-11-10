// DMF turn-in calculator core. Works in the browser (<script src>) and in Node (require).
// Single source of truth for items, Auctionator parsing and the ranking maths.
// Wrapped in a function so only DMF is exposed; top-level consts in a classic <script>
// would otherwise clash with the page's own declarations (e.g. `const {ITEMS} = DMF`).
(() => {
// Minimum character level to accept a turn-in quest, by tier (same for all four NPCs; no profession skill check).
// Source: wofwforever.com/en/guides/wow-forever-darkmoon-faire, matches Classic quest data.
const MIN_LEVEL = [1,10,20,30,40];
const MAX_LEVEL = 60;
// Turn-in items: [name, itemId, category, tier, quantity, icon, quality, quests]
// quests: [[questId, name], ...] (exposed as item.questList; row.quests is the number of turn-ins needed).
// Tier 5 has a first-time quest and a repeatable "More ..." quest.
// Item icon/quality and quest IDs/names from Wowhead's Forever data (nether.wowhead.com/forever/tooltip/...).
// quality: 1 common (white), 2 uncommon (green). Prices come only from your Auctionator file.
const ITEMS = [
  ["Small Furry Paw",5134,"Animal Parts",1,5,"ability_hunter_mendpet",1,[[7899,"Small Furry Paws"]]],
  ["Torn Bear Pelt",11407,"Animal Parts",2,5,"inv_misc_pelt_bear_ruin_05",1,[[7900,"Torn Bear Pelts"]]],
  ["Soft Bushy Tail",4582,"Animal Parts",3,5,"inv_misc_monstertail_02",1,[[7901,"Soft Bushy Tails"]]],
  ["Vibrant Plume",5117,"Animal Parts",4,5,"inv_feather_12",1,[[7902,"Vibrant Plumes"]]],
  ["Evil Bat Eye",11404,"Animal Parts",5,10,"inv_misc_eye_01",1,[[7903,"Evil Bat Eyes"],[7943,"More Bat Eyes"]]],
  ["Glowing Scorpid Blood",19933,"Animal Parts",5,10,"spell_shadow_lifedrain",1,[[8222,"Glowing Scorpid Blood"],[8223,"More Glowing Scorpid Blood"]]],
  ["Coarse Weightstone",3240,"Blacksmithing",1,10,"inv_stone_weightstone_02",1,[[7889,"Coarse Weightstone"]]],
  ["Heavy Grinding Stone",3486,"Blacksmithing",2,7,"inv_stone_grindingstone_03",1,[[7890,"Heavy Grinding Stone"]]],
  ["Green Iron Bracers",3835,"Blacksmithing",3,3,"inv_bracer_06",2,[[7891,"Green Iron Bracers"]]],
  ["Big Black Mace",7945,"Blacksmithing",4,3,"inv_mace_15",2,[[7892,"Big Black Mace"]]],
  ["Dense Grinding Stone",12644,"Blacksmithing",5,8,"inv_stone_grindingstone_05",1,[[7893,"Rituals of Strength"],[7939,"More Dense Grinding Stones"]]],
  ["Copper Modulator",4363,"Engineering",1,3,"inv_gizmo_03",1,[[7894,"Copper Modulator"]]],
  ["Whirring Bronze Gizmo",4375,"Engineering",2,7,"inv_gizmo_02",1,[[7895,"Whirring Bronze Gizmo"]]],
  ["Green Firework",9313,"Engineering",3,36,"spell_nature_abolishmagic",1,[[7896,"Green Fireworks"]]],
  ["Mechanical Repair Kit",11590,"Engineering",4,6,"inv_gizmo_03",1,[[7897,"Mechanical Repair Kits"]]],
  ["Thorium Widget",15994,"Engineering",5,6,"inv_gizmo_04",1,[[7898,"Thorium Widget"],[7942,"More Thorium Widgets"]]],
  ["Embossed Leather Boots",2309,"Leatherworking",1,3,"inv_boots_05",2,[[7881,"Carnival Boots"]]],
  ["Toughened Leather Armor",2314,"Leatherworking",2,3,"inv_chest_leather_10",2,[[7882,"Carnival Jerkins"]]],
  ["Barbaric Harness",5739,"Leatherworking",3,3,"inv_chest_leather_04",2,[[7883,"The World's Largest Gnome!"]]],
  ["Turtle Scale Leggings",8185,"Leatherworking",4,1,"inv_pants_02",2,[[7884,"Crocolisk Boy and the Bearded Murloc"]]],
  ["Rugged Armor Kit",15564,"Leatherworking",5,8,"inv_misc_armorkit_09",1,[[7885,"Armor Kits"],[7941,"More Armor Kits"]]],
].map(([name,id,category,tier,qnt,icon,quality,quests]) => ({
  name, id, category, tier, qnt, icon, quality, questList: quests.map(([id, name]) => ({id, name})),
  minLevel: MIN_LEVEL[tier-1], price: null, live: false,
}));
const WOWHEAD_ITEM_URL = id => `https://www.wowhead.com/forever/item=${id}`;
const WOWHEAD_QUEST_URL = id => `https://www.wowhead.com/forever/quest=${id}`;
const ICON_URL = (icon, size = "medium") => `https://wow.zamimg.com/images/wow/icons/${size}/${icon}.jpg`;
const TICKET_VALUE = [1,4,8,12,20];
// Source: warcrafttavern.com/forever/guides/darkmoon-faire
const REP_PER_QUEST = 250, REP_CAP = [500,1100,1700,2500,5999];
// Prize ticket rewards (sold by Gelvas Grimegate through "N Tickets - ..." quests), cheapest first.
// key is used by the CLI's --target. Costs: warcrafttavern.com/forever/guides/darkmoon-faire; IDs: Wowhead Forever data.
const GOALS = [
  ["flower","Darkmoon Flower",5,19295,"inv_misc_herb_19",1,7930],
  ["minor","Minor Darkmoon Prize",5,19298,"inv_misc_bag_04",2,7931],
  ["monthmutton","Last Month's Mutton",10,19292,"inv_misc_food_18",1,7935],
  ["lesser","Lesser Darkmoon Prize",12,19297,"inv_misc_bag_07_black",2,7932],
  ["greater","Greater Darkmoon Prize",40,19296,"inv_misc_bag_21",2,7933],
  ["tonk","Schematic: Steam Tonk Controller",40,22729,"inv_scroll_03",1,9249],
  ["box","Darkmoon Storage Box",50,19291,"inv_box_04",1,7934],
  ["mutton","Last Year's Mutton",50,19293,"inv_misc_food_18",1,7936],
  ["amulet","Amulet of the Darkmoon",1200,19491,"inv_jewelry_necklace_14",4,7981],
  ["orb","Orb of the Darkmoon",1200,19426,"inv_jewelry_necklace_16",4,7940],
].map(([key,name,tickets,id,icon,quality,questId]) => ({key, name, tickets, id, icon, quality, questId}));
// Tier 5 Animal Parts: Evil Bat Eyes (7903) and Glowing Scorpid Blood (8222) are separate quests, so separate options.

// ---- Lua string literal + CBOR parsing (mirrors dmf_prices.py) ----
const ESC = {a:7,b:8,f:12,n:10,r:13,t:9,v:11,"\\":92,'"':34,"'":39,"\n":10};
const isDigit = b => b >= 48 && b <= 57;
function luaString(d, pos) {              // d[pos] is the opening quote
  const out = []; pos++;
  while (d[pos] !== 0x22) {
    const c = d[pos];
    if (c !== 0x5C) { out.push(c); pos++; continue; }
    pos++;
    const ch = d[pos];
    if (isDigit(ch)) {
      let j = pos, v = 0;
      while (j < pos + 3 && isDigit(d[j])) v = v * 10 + d[j++] - 48;
      out.push(v & 255); pos = j;
    } else if (ch === 0x78) { out.push(parseInt(String.fromCharCode(d[pos+1], d[pos+2]), 16)); pos += 3; }
    else if (ch === 0x7A) { pos++; while ([32,9,10,13].includes(d[pos])) pos++; }
    else { out.push(ESC[String.fromCharCode(ch)]); pos++; }
  }
  return [Uint8Array.from(out), pos + 1];
}
function cbor(d, pos = 0) {
  const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
  const ib = d[pos++], major = ib >> 5, info = ib & 31;
  if (major === 7 && info >= 25 && info <= 27) {
    if (info === 25) { // half float
      const h = dv.getUint16(pos), s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 31, f = h & 1023;
      const v = e === 0 ? s * 2**-14 * f/1024 : e === 31 ? (f ? NaN : s*Infinity) : s * 2**(e-15) * (1 + f/1024);
      return [v, pos + 2];
    }
    return info === 26 ? [dv.getFloat32(pos), pos + 4] : [dv.getFloat64(pos), pos + 8];
  }
  let arg;
  if (info < 24) arg = info;
  else if (info <= 27) {
    const size = [1,2,4,8][info - 24]; arg = 0;
    for (let i = 0; i < size; i++) arg = arg * 256 + d[pos + i];
    pos += size;
  } else throw new Error("unsupported CBOR info " + info);
  if (major === 0) return [arg, pos];
  if (major === 1) return [-1 - arg, pos];
  if (major === 2 || major === 3) {
    const raw = d.subarray(pos, pos + arg);
    return [new TextDecoder(major === 3 ? "utf-8" : "latin1").decode(raw), pos + arg];
  }
  if (major === 4) { const a = []; for (let i = 0; i < arg; i++) { let v; [v,pos] = cbor(d,pos); a.push(v); } return [a,pos]; }
  if (major === 5) { const o = {}; for (let i = 0; i < arg; i++) { let k,v; [k,pos] = cbor(d,pos); [v,pos] = cbor(d,pos); o[k] = v; } return [o,pos]; }
  if (major === 7) return [{20:false,21:true,22:null}[info] ?? null, pos];
  throw new Error("unsupported CBOR major " + major);
}
function findBytes(d, needle, from = 0) {
  outer: for (let i = from; i <= d.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (d[i+j] !== needle.charCodeAt(j)) continue outer;
    return i;
  }
  return -1;
}
function parseAuctionator(d) {
  const start = findBytes(d, "AUCTIONATOR_PRICE_DATABASE");
  if (start < 0) throw new Error("AUCTIONATOR_PRICE_DATABASE not found. Is this Auctionator.lua?");
  let end = findBytes(d, "\nAUCTIONATOR_", start + 1);
  if (end < 0) end = d.length;
  const block = d.subarray(start, end), text = new TextDecoder("latin1").decode(block);
  const realms = {};
  for (const m of text.matchAll(/\["([^"]+)"\] = "/g)) {
    realms[m[1]] = luaString(block, m.index + m[0].length - 1)[0];
  }
  if (!Object.keys(realms).length) throw new Error("No realm price data found.");
  return realms;
}
function realmPrices(blob) {
  const db = cbor(blob)[0], prices = {};
  for (const [k, e] of Object.entries(db)) if (/^\d+$/.test(k) && e && e.m) prices[+k] = e.m;
  return prices;
}


// ---- Shared calculation (used by both the web page and the CLI) ----
function applyPrices(items, prices) {   // prices: {itemId: copper}; returns count of items with a price
  let n = 0;
  for (const it of items) {
    const c = prices[it.id];
    if (c) { it.price = c / 100; it.live = true; n++; } else { it.price = null; it.live = false; }
  }
  return n;
}
function calculate(items, {tickets = 0, target = 50, rep = 0, strict = false, category = "", level = MAX_LEVEL} = {}) {
  let rows = items.filter(i => (!category || i.category.toLowerCase() === category.toLowerCase()) && i.minLevel <= level).map(i => {
    const tv = TICKET_VALUE[i.tier - 1], quests = Math.max(0, Math.ceil((target - tickets) / tv));
    const untilCap = Math.max(0, Math.ceil((REP_CAP[i.tier - 1] - rep) / REP_PER_QUEST));
    const priced = i.price != null;
    return {...i, quests, untilCap, overCap: quests > untilCap, items: quests * i.qnt, ticketsGained: quests * tv,
            perTurn: priced ? i.qnt * i.price : null,                  // silver
            total: priced ? quests * i.qnt * i.price / 100 : null};    // gold
  });
  if (strict) rows = rows.filter(r => !r.overCap);
  // Priced items ranked by total cost; items without an Auctionator price go last (fewest quests first).
  return rows.sort((a, b) =>
    (a.total == null) - (b.total == null) || (a.total ?? 0) - (b.total ?? 0) || a.quests - b.quests || a.name.localeCompare(b.name));
}

const DMF = {ITEMS, TICKET_VALUE, REP_PER_QUEST, REP_CAP, MIN_LEVEL, MAX_LEVEL, GOALS, WOWHEAD_ITEM_URL, WOWHEAD_QUEST_URL, ICON_URL,
  parseAuctionator, realmPrices, applyPrices, calculate};
if (typeof module !== "undefined") module.exports = DMF; else globalThis.DMF = DMF;
})();
