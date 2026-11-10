#!/usr/bin/env node
// Rewrites the RECIPES / MATS block in dmf.js from Wowhead's Forever tooltip API (needs network).
// Usage: node tools/build-recipes.js
// SPELLS maps each crafted turn-in item id to the id of the spell that makes it. The spell tooltip lists the
// reagents with quantities and, after the created item, how many it makes per craft, e.g. "Green Firework (3)".
// Material names/icons/qualities come from the item tooltips. Rerun if Forever changes a recipe.
const fs = require("fs"), path = require("path");

const SPELLS = {   // crafted item id -> spell id
  3240: 3116, 3486: 3337, 3835: 3501, 7945: 10001, 12644: 16639,          // Blacksmithing
  4363: 3926, 4375: 3942, 9313: 23068, 11590: 15255, 15994: 19791,        // Engineering
  2309: 2161, 2314: 2166, 5739: 6661, 8185: 10556, 15564: 19058,          // Leatherworking
};
const API = "https://nether.wowhead.com/forever/tooltip";
const get = async (kind, id) => {
  const r = await fetch(`${API}/${kind}/${id}`);
  if (!r.ok) throw new Error(`${kind} ${id}: HTTP ${r.status}`);
  return r.json();
};

(async () => {
  const recipes = {}, mats = {};
  for (const [itemId, spellId] of Object.entries(SPELLS)) {
    const j = await get("spell", spellId), t = j.tooltip;
    const start = t.indexOf("Reagents:");
    if (start < 0) throw new Error(`spell ${spellId} (${j.name}) has no reagents`);
    const created = new RegExp(`item=${itemId}[^>]*>[^<]*</a></span>\\s*(?:\\((\\d+)\\))?`).exec(t.slice(start));
    if (!created) throw new Error(`spell ${spellId} (${j.name}) does not make item ${itemId}`);
    const reagentHtml = t.slice(start, start + created.index);
    const list = [...reagentHtml.matchAll(/item=(\d+)[^"]*">([^<]+)<\/a>(?:&nbsp;\((\d+)\))?/g)].map(m => [+m[1], +(m[3] || 1), m[2]]);
    recipes[itemId] = {spell: +spellId, yield: +(created[1] || 1), name: j.name, mats: list.map(([id, q]) => [id, q])};
    for (const [id, , name] of list) mats[id] = {name};
    console.log(`${j.name}: ${list.map(([, q, n]) => `${q} ${n}`).join(", ")} -> ${created[1] || 1}`);
  }
  for (const id of Object.keys(mats)) {
    const j = await get("item", id);
    mats[id] = [j.name, j.icon, j.quality];
  }
  const rows = Object.keys(recipes).map(Number).sort((a, b) => a - b).map(id => {
    const r = recipes[id];
    return `  ${id}: {spell: ${r.spell}, yield: ${r.yield}, mats: ${JSON.stringify(r.mats)}},   // ${r.name}`;
  });
  const matRows = Object.keys(mats).map(Number).sort((a, b) => a - b).map(id => `  ${id}: ${JSON.stringify(mats[id])},`);
  const block = `// <recipes>\nconst RECIPES = {\n${rows.join("\n")}\n};\nconst MATS = {\n${matRows.join("\n")}\n};\n  // </recipes>`;

  const file = path.join(__dirname, "..", "dmf.js");
  const js = fs.readFileSync(file, "utf8");
  const re = /\/\/ <recipes>[\s\S]*?\/\/ <\/recipes>/;
  if (!re.test(js)) throw new Error("dmf.js has no // <recipes> ... // </recipes> block");
  fs.writeFileSync(file, js.replace(re, () => block));
  console.log(`Wrote ${rows.length} recipes and ${matRows.length} materials to dmf.js`);
})().catch(e => { console.error("Error:", e.message); process.exit(1); });
