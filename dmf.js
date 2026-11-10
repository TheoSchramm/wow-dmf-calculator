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
// Darkmoon Faire NPC who takes each category's turn-ins (warcrafttavern.com/forever/guides/darkmoon-faire);
// NPC IDs from Wowhead's Forever data. Gelvas Grimegate redeems the tickets for rewards.
const NPC = {
  "Animal Parts": {id: 14829, name: "Yebb Neblegear"},
  "Blacksmithing": {id: 14832, name: "Kerri Hicks"},
  "Engineering": {id: 14841, name: "Rinling"},
  "Leatherworking": {id: 14833, name: "Chronos"},
};
const TICKET_NPC = {id: 14828, name: "Gelvas Grimegate"};
for (const it of ITEMS) { it.npc = NPC[it.category].name; it.npcId = NPC[it.category].id; }
const WOWHEAD_ITEM_URL = id => `https://www.wowhead.com/forever/item=${id}`;
const WOWHEAD_NPC_URL = id => `https://www.wowhead.com/forever/npc=${id}`;
const WOWHEAD_SPELL_URL = id => `https://www.wowhead.com/forever/spell=${id}`;
const DMF_FACTION = {id: 909, name: "Darkmoon Faire"};
const WOWHEAD_FACTION_URL = id => `https://www.wowhead.com/forever/faction=${id}`;
const WOWHEAD_ZONE_URL = id => `https://www.wowhead.com/forever/zone=${id}`;
const WOWHEAD_QUEST_URL = id => `https://www.wowhead.com/forever/quest=${id}`;
const ICON_URL = (icon, size = "medium") => `https://wow.zamimg.com/images/wow/icons/${size}/${icon}.jpg`;
const TICKET_VALUE = [1,4,8,12,20];
// ---- Darkmoon Faire reputation ----
// Reputation is handled as points counted from Neutral 0 (Friendly 0 = 3000, Honored 0 = 9000, ...).
const STANDINGS = [
  {name: "Neutral", base: 0, size: 3000},
  {name: "Friendly", base: 3000, size: 6000},
  {name: "Honored", base: 9000, size: 12000},
  {name: "Revered", base: 21000, size: 21000},
  {name: "Exalted", base: 42000, size: 999},
];
// Each turn-in gives 250 reputation (Forever guide; wowcalc lists +100 for some quests using unconfirmed
// Classic data). A tier's quests are only offered while your reputation is below its cap:
// tiers 1-4 stop at Neutral 500 / 1100 / 1700 / 2500. Tier 5 gives reputation up to Friendly 5999/6000,
// then is replaced by its "More ..." quest (same tickets, no reputation), so tier 5 never runs out.
// Sources: warcrafttavern.com/forever/guides/darkmoon-faire, zockify.com/classic/events/darkmoon-faire,
// wowpedia.fandom.com/wiki/Darkmoon_Faire_(Classic).
const REP_PER_QUEST = 250, REP_CAP = [500, 1100, 1700, 2500, 3000 + 5999];
// Reputation bonus: the Legacy talent Diplomat, +2% per rank, 5 ranks (Wowhead Forever spell 1225485).
// Forever removed the Human racial Diplomacy (it became this talent, open to every race), so no racial bonus.
const DIPLOMAT = {id: 1225485, name: "Diplomat", icon: "inv_scroll_03", perRank: 0.02, maxRanks: 5};
function repPerQuest(bonus = 0) { return Math.round(REP_PER_QUEST * (1 + (+bonus || 0))); }
const TIER_UNLIMITED = 5;   // tier whose turn-ins never stop

function repFromStanding(standingName, value) {
  const s = STANDINGS.find(s => s.name === standingName) || STANDINGS[0];
  return s.base + Math.max(0, Math.min(s.size - 1, Math.floor(+value) || 0));
}
function repText(rep) {
  const s = [...STANDINGS].reverse().find(s => rep >= s.base);
  return s.name === "Exalted" ? "Exalted" : `${s.name} ${rep - s.base}/${s.size}`;
}
// How many turn-ins of this tier are still offered, starting at `rep` and doing only this tier.
function turnInsLeft(tier, rep, bonus = 0) {
  if (tier === TIER_UNLIMITED) return Infinity;
  const cap = REP_CAP[tier - 1];
  return rep >= cap ? 0 : Math.ceil((cap - rep) / repPerQuest(bonus));
}
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

// ---- Self-found mode: which mobs drop the Animal Parts ----
// Only the Animal Parts drop from mobs; the other categories are crafted, so they have no farm spot.
// Rows: [npcId, name, minLevel, maxLevel, zone, zoneId, timesLooted, timesMobLooted]. Drop chance = looted / mob looted.
// Generated by tools/build-drops.js from Wowhead Forever's "Dropped By" tabs (scraped with tools/wowhead-drops.user.js).
// Excludes elites, rares, dungeons/raids/battlegrounds and mobs with fewer than 100 recorded loots.
const DROPS = {
  // <drops>
  4582: [   // Soft Bushy Tail
    [4660,"Maraudine Bonepaw",37,38,"Desolace",405,779,1744],
    [4662,"Magram Bonepaw",37,38,"Desolace",405,1337,5500],
    [2729,"Elder Crag Coyote",39,40,"Badlands",3,31222,130705],
    [2728,"Feral Crag Coyote",37,38,"Badlands",3,9917,44997],
    [4690,"Rabid Bonepaw",36,38,"Desolace",405,366,1699],
    [4681,"Mage Hunter",38,39,"Desolace",405,2794,13336],
    [259267,"Plains Coyote",36,37,"Riverglades",16591,34,171],
    [4685,"Ley Hunter",39,40,"Desolace",405,1524,7678],
    [4678,"Mana Eater",37,38,"Desolace",405,477,2469],
    [2727,"Crag Coyote",35,36,"Badlands",3,9759,51374],
    [4689,"Starving Bonepaw",30,32,"Desolace",405,555,4742],
    [4688,"Bonepaw Hyena",33,35,"Desolace",405,271,2328],
  ],
  5117: [   // Vibrant Plume
    [7376,"Sky Shadow",55,56,"Deadwind Pass",41,3239,10721],
    [1809,"Carrion Vulture",50,52,"Tirisfal Glades",85,499,1679],
    [5362,"Northspring Harpy",48,49,"Feralas",357,3936,13462],
    [5363,"Northspring Roguefeather",48,49,"Feralas",357,3893,13423],
    [5364,"Northspring Slayer",49,50,"Feralas",357,5189,18300],
    [5366,"Northspring Windcaller",49,50,"Feralas",357,5099,18244],
    [7456,"Winterspring Screecher",57,60,"Winterspring",618,846,3507],
    [7098,"Ironbeak Screecher",52,53,"Felwood",361,592,2565],
    [4104,"Screeching Windcaller",30,30,"Thousand Needles",400,4849,21039],
    [7455,"Winterspring Owl",54,56,"Winterspring",618,1204,5340],
    [4100,"Screeching Harpy",28,29,"Thousand Needles",400,6134,33662],
    [4101,"Screeching Roguefeather",29,30,"Thousand Needles",400,6290,35415],
    [4490,"Grenka Bloodscreech",31,31,"Thousand Needles",400,400,3053],
    [7808,"Marauding Owlbeast",46,46,"The Hinterlands",47,431,3559],
    [2929,"Savage Owlbeast",46,47,"The Hinterlands",47,4175,36597],
    [5305,"Frayfeather Skystormer",45,46,"Feralas",357,5698,52721],
    [5300,"Frayfeather Hippogryph",43,44,"Feralas",357,5004,47669],
    [5306,"Frayfeather Patriarch",46,47,"Feralas",357,1841,17892],
    [6380,"Thunderhead Consort",52,61,"Azshara",16,630,6390],
    [6379,"Thunderhead Patriarch",52,61,"Azshara",16,439,4654],
    [5430,"Searing Roc",47,49,"Tanaris",440,385,4887],
    [5304,"Frayfeather Stagwing",44,45,"Feralas",357,4300,55105],
    [2927,"Vicious Owlbeast",42,43,"The Hinterlands",47,1517,19444],
    [2928,"Primitive Owlbeast",44,45,"The Hinterlands",47,2446,32062],
    [7099,"Ironbeak Hunter",50,51,"Felwood",361,261,3465],
    [7097,"Ironbeak Owl",48,49,"Felwood",361,227,3185],
    [6375,"Thunderhead Hippogryph",46,48,"Azshara",16,505,8181],
    [6378,"Thunderhead Skystormer",50,52,"Azshara",16,448,8135],
    [6377,"Thunderhead Stagwing",48,50,"Azshara",16,436,7980],
    [5428,"Roc",41,43,"Tanaris",440,859,16317],
    [5429,"Fire Roc",43,45,"Tanaris",440,1594,33096],
    [5982,"Black Slayer",46,48,"Blasted Lands",4,7910,170791],
  ],
  5134: [   // Small Furry Paw
    [2069,"Moonstalker",14,15,"Darkshore",148,24693,74881],
    [3241,"Savannah Patriarch",15,16,"The Barrens",17,4002,12328],
    [3415,"Savannah Huntress",11,12,"The Barrens",17,13727,61348],
    [2070,"Moonstalker Runt",10,17,"Darkshore",148,7652,35206],
    [3243,"Savannah Highmane",12,13,"The Barrens",17,980,4575],
    [3425,"Savannah Prowler",14,15,"The Barrens",17,25404,120085],
    [2071,"Moonstalker Matriarch",19,20,"Darkshore",148,1855,15858],
    [3416,"Savannah Matriarch",17,18,"The Barrens",17,749,7619],
    [2237,"Moonstalker Sire",17,18,"Darkshore",148,3599,39541],
    [3475,"Echeyakee",16,60,"The Barrens",17,490,8414],
    [3619,"Ghost Saber",19,20,"Darkshore",148,22,480],
  ],
  11404: [   // Evil Bat Eye
    [8602,"Monstrous Plaguebat",56,58,"Eastern Plaguelands",139,10516,51849],
    [8601,"Noxious Plaguebat",54,56,"Eastern Plaguelands",139,12191,66625],
    [8600,"Plaguebat",53,55,"Eastern Plaguelands",139,26375,147150],
  ],
  11407: [   // Torn Bear Pelt
    [3811,"Giant Ashenvale Bear",29,30,"Ashenvale",331,789,3121],
    [271334,"Maddened Rotclaw",25,26,"Wetlands",11,176,890],
    [3810,"Elder Ashenvale Bear",25,26,"Ashenvale",331,2603,15666],
    [2356,"Elder Gray Bear",25,26,"Hillsbrad Foothills",267,9103,58205],
    [12678,"Ursangous",25,25,"Ashenvale",331,498,3801],
    [3809,"Ashenvale Bear",21,22,"Ashenvale",331,3793,45712],
    [2354,"Vicious Gray Bear",22,23,"Hillsbrad Foothills",267,7792,95795],
    [2351,"Gray Bear",21,22,"Hillsbrad Foothills",267,6177,76395],
  ],
  19933: [   // Glowing Scorpid Blood
    [9698,"Firetail Scorpid",56,57,"Burning Steppes",46,921,3820],
    [11737,"Stonelash Flayer",57,58,"Silithus",1377,9662,42419],
    [11736,"Stonelash Pincer",56,56,"Silithus",1377,12056,54346],
    [9695,"Deathlash Scorpid",54,55,"Burning Steppes",46,1044,7029],
    [11735,"Stonelash Scorpid",54,55,"Silithus",1377,12391,88389],
    [9691,"Venomtip Scorpid",52,53,"Burning Steppes",46,1761,21898],
    [5988,"Scorpok Stinger",49,51,"Blasted Lands",4,9401,125183],
  ],
  // </drops>
};
// You can fight a mob up to this many levels above you.
const MOB_LEVEL_SLACK = 2;
const DROPS_FROM = {"Animal Parts": true};   // categories whose items drop from mobs (the rest are crafted)

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
// Self-found mode: for each item, the mob that needs the fewest kills at this character level.
// item.farm = {mob, kills (expected kills per item), others: next best mobs} or null when nothing drops it / nothing is fightable yet.
function applyFarm(items, level = MAX_LEVEL) {
  for (const it of items) {
    const mobs = (DROPS[it.id] || [])
      .map(([npcId, name, minLevel, maxLevel, zone, zoneId, looted, total]) =>
        ({npcId, name, minLevel, maxLevel, zone, zoneId, looted, total, chance: looted / total}))
      .filter(m => m.minLevel <= level + MOB_LEVEL_SLACK)
      .sort((a, b) => b.chance - a.chance);
    it.farm = mobs.length ? {mob: mobs[0], kills: 1 / mobs[0].chance, others: mobs.slice(1, 4)} : null;
  }
}
// One row per item (single-item view, used by the CLI and the page's reference table).
// untilCap / turnInsLeft: turn-ins still offered from `rep` before the tier's reputation cap.
function calculate(items, {tickets = 0, target = 50, rep = 0, strict = false, category = "", level = MAX_LEVEL, repBonus = 0} = {}) {
  let rows = items.filter(i => (!category || i.category.toLowerCase() === category.toLowerCase()) && i.minLevel <= level).map(i => {
    const tv = TICKET_VALUE[i.tier - 1], quests = Math.max(0, Math.ceil((target - tickets) / tv));
    const untilCap = turnInsLeft(i.tier, rep, repBonus);
    const priced = i.price != null;
    return {...i, quests, untilCap, turnInsLeft: untilCap, overCap: quests > untilCap, items: quests * i.qnt,
            ticketValue: tv, ticketsGained: quests * tv,
            perTurn: priced ? i.qnt * i.price : null,                  // silver per turn-in
            perTicket: priced ? i.qnt * i.price / tv : null,           // silver per ticket
            total: priced ? quests * i.qnt * i.price / 100 : null};    // gold, if this item alone did it all
  });
  if (strict) rows = rows.filter(r => !r.overCap);
  // Priced items ranked by total cost; items without an Auctionator price go last (fewest quests first).
  return rows.sort((a, b) =>
    (a.total == null) - (b.total == null) || (a.total ?? 0) - (b.total ?? 0) || a.quests - b.quests || a.name.localeCompare(b.name));
}

// Cheapest route to `target` tickets, respecting reputation caps.
// Every turn-in adds repPerQuest(repBonus) reputation and a tier is only offered below its cap, and caps rise with
// the tier, so lower tiers always go first. Within a tier all items give the same tickets and share the cap,
// so only the cheapest eligible item per tier matters. We try every count for tiers 1-4 (each is at most
// ~11 because of the caps) and fill the rest with tier 5, which never runs out.
// With ssf: true the "price" of an item is the expected number of kills to loot it (item.farm, see applyFarm), so the
// route needs the fewest kills instead of the least gold; items nothing drops (crafted ones) are left out.
// Returns {ok, steps: [{item, turnIns, items, cost, ticketsAfter, repBefore, repAfter}], cost, ssf,
//          tickets, repEnd, reason, maxTickets}. cost is gold, or kills in ssf mode.
function planRoute(items, {target = 50, tickets = 0, rep = 0, level = MAX_LEVEL, repBonus = 0, ssf = false} = {}) {
  const unit = it => ssf ? (it.farm ? it.farm.kills : null) : it.price;   // silver per item, or kills per item
  const scale = ssf ? 1 : 100;
  const rq = repPerQuest(repBonus);
  const need = Math.max(0, target - tickets);
  if (need === 0) return {ok: true, steps: [], cost: 0, tickets, repEnd: rep};

  const best = [];     // cheapest priced, level-eligible item per tier (index 0..4)
  for (const it of items) {
    if (unit(it) == null || it.minLevel > level) continue;
    const t = it.tier - 1, perTurn = it.qnt * unit(it);
    if (!best[t] || perTurn < best[t].qnt * unit(best[t])) best[t] = it;
  }
  const perTurn = t => best[t].qnt * unit(best[t]);   // silver, or kills

  let winner = null;
  const maxK = t => best[t] ? Math.min(turnInsLeft(t + 1, rep, repBonus), Math.ceil(need / TICKET_VALUE[t])) : 0;
  const ranges = [0, 1, 2, 3].map(maxK);
  let maxTickets = 0;
  for (let k1 = 0; k1 <= ranges[0]; k1++)
  for (let k2 = 0; k2 <= ranges[1]; k2++)
  for (let k3 = 0; k3 <= ranges[2]; k3++)
  for (let k4 = 0; k4 <= ranges[3]; k4++) {
    const ks = [k1, k2, k3, k4];
    // feasible if the last turn-in of each used tier still starts below that tier's cap
    let done = 0, ok = true;
    for (let t = 0; t < 4 && ok; t++) {
      if (ks[t] && rep + rq * (done + ks[t] - 1) >= REP_CAP[t]) ok = false;
      done += ks[t];
    }
    if (!ok) continue;
    let got = ks.reduce((s, k, t) => s + k * TICKET_VALUE[t], 0);
    maxTickets = Math.max(maxTickets, got);
    let k5 = 0;
    if (got < need) {
      if (!best[4]) continue;
      k5 = Math.ceil((need - got) / TICKET_VALUE[4]);
      got += k5 * TICKET_VALUE[4];
    }
    const counts = [...ks, k5];
    const cost = counts.reduce((s, k, t) => s + (k ? k * perTurn(t) : 0), 0);
    const quests = counts.reduce((a, b) => a + b, 0);
    if (!winner || cost < winner.cost - 1e-9 || (Math.abs(cost - winner.cost) < 1e-9 && quests < winner.quests)) {
      winner = {counts, cost, quests};
    }
  }

  if (!winner) {
    const missing = [0, 1, 2, 3, 4].filter(t => !best[t]).map(t => t + 1);
    return {ok: false, steps: [], cost: null, tickets, repEnd: rep, maxTickets: tickets + maxTickets,
            reason: best[4] ? "caps" : (level < MIN_LEVEL[4] ? "level" : ssf ? "nomob" : "noprice"), missingTiers: missing};
  }

  const steps = [];
  let r = rep, t = tickets;
  winner.counts.forEach((k, i) => {
    if (!k) return;
    const it = best[i];
    const repBefore = r;
    // tier 5 stops giving reputation at its cap ("More ..." quests give none)
    r = i + 1 === TIER_UNLIMITED ? Math.max(r, Math.min(REP_CAP[i], r + k * rq)) : r + k * rq;
    t += k * TICKET_VALUE[i];
    steps.push({item: it, turnIns: k, items: k * it.qnt, cost: k * perTurn(i) / scale, ticketsAfter: t, repBefore, repAfter: r, repPer: rq});
  });
  return {ok: true, steps, cost: winner.cost / scale, ssf, tickets: t, repEnd: r};
}

const DMF = {ITEMS, TICKET_VALUE, REP_PER_QUEST, DIPLOMAT, repPerQuest, REP_CAP, STANDINGS, MIN_LEVEL, MAX_LEVEL, GOALS, TICKET_NPC,
  WOWHEAD_ITEM_URL, WOWHEAD_SPELL_URL, WOWHEAD_FACTION_URL, DMF_FACTION, WOWHEAD_QUEST_URL, WOWHEAD_ZONE_URL, WOWHEAD_NPC_URL, ICON_URL,
  parseAuctionator, realmPrices, DROPS_FROM, applyPrices, applyFarm, calculate, planRoute, turnInsLeft, repFromStanding, repText};
if (typeof module !== "undefined") module.exports = DMF; else globalThis.DMF = DMF;
})();
