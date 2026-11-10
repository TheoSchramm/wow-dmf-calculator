#!/usr/bin/env node
// Terminal front-end for dmf.js:  node cli.js --target greater --tickets 10 --limit 5
const fs = require("fs");
const path = require("path");
const DMF = require("./dmf.js");

const WOW_ROOT = process.env.WOW_ROOT || "C:\\Program Files (x86)\\World of Warcraft\\_forever_\\WTF\\Account";
const GOAL_BY_KEY = Object.fromEntries(DMF.GOALS.map(g => [g.key, g]));

function parseArgs(argv) {
  const a = {tickets: "0", target: "50", rep: "0", limit: "3", level: String(DMF.MAX_LEVEL)};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--strict-caps") a.strict = true;
    else if (k === "--help" || k === "-h") a.help = true;
    else if (k.startsWith("--")) a[k.slice(2)] = argv[++i];
    else throw new Error(`Unknown argument ${k}`);
  }
  return a;
}

function newestAuctionator() {
  let best = null;
  if (!fs.existsSync(WOW_ROOT)) return null;
  for (const acc of fs.readdirSync(WOW_ROOT)) {
    const f = path.join(WOW_ROOT, acc, "SavedVariables", "Auctionator.lua");
    if (fs.existsSync(f) && (!best || fs.statSync(f).mtimeMs > fs.statSync(best).mtimeMs)) best = f;
  }
  return best;
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help) {
    console.log(`Options: --level N (default ${DMF.MAX_LEVEL})  --tickets N  --target N|${Object.keys(GOAL_BY_KEY).join("|")} (default 50)  --rep N
         --strict-caps  --category NAME  --limit N  --realm NAME  --file PATH   (env WOW_ROOT sets the WTF\\Account path)
Goals:`);
    for (const g of DMF.GOALS) console.log(`  ${g.key.padEnd(12)} ${String(g.tickets).padStart(4)} tickets  ${g.name}  ${DMF.WOWHEAD_ITEM_URL(g.id)}`);
    return;
  }
  const goal = GOAL_BY_KEY[String(a.target).toLowerCase()];
  const target = goal ? goal.tickets : parseInt(a.target, 10);
  if (!(target > 0)) throw new Error(`--target must be a ticket count or one of: ${Object.keys(GOAL_BY_KEY).join(", ")}`);
  if (goal) console.log(`Goal: ${goal.name} (${goal.tickets} tickets)  ${DMF.WOWHEAD_ITEM_URL(goal.id)}\n`);
  const items = DMF.ITEMS;

  const file = a.file || newestAuctionator();
  if (!file) console.log("Auctionator.lua not found; no prices, so only quests and items needed are shown.\n");
  else {
    const realms = DMF.parseAuctionator(new Uint8Array(fs.readFileSync(file)));
    const names = Object.keys(realms).filter(r => r !== "__dbversion");
    const realm = a.realm || names.sort((x, y) => realms[y].length - realms[x].length)[0];
    if (!realms[realm]) throw new Error(`Realm '${realm}' not found. Available: ${names.join(", ")}`);
    const prices = DMF.realmPrices(realms[realm]);
    const n = DMF.applyPrices(items, prices);
    console.log(`Loaded ${Object.keys(prices).length} prices from realm '${realm}' (${file})`);
    console.log(`${n}/${items.length} DMF items have prices; scan the AH for the rest.\n`);
    const missing = items.filter(i => !i.live).map(i => i.name);
    if (missing.length) console.log("No Auctionator price (listed last):", missing.join(", "), "\n");
  }

  const tickets = parseInt(a.tickets, 10);
  const level = parseInt(a.level, 10);
  if (!(level >= 1 && level <= DMF.MAX_LEVEL)) throw new Error(`--level must be between 1 and ${DMF.MAX_LEVEL}`);
  const rows = DMF.calculate(items, {tickets, target, rep: parseInt(a.rep, 10), strict: !!a.strict, category: a.category || "", level});
  if (!rows.length) console.log(`No turn-ins available at level ${level} with these filters. Quests unlock at levels ${DMF.MIN_LEVEL.join(", ")}.`);
  for (const r of rows.slice(0, parseInt(a.limit, 10))) {
    console.log(`${r.live ? `Buying ${r.name} (${r.category}, requires level ${r.minLevel}) you will pay ${r.perTurn.toFixed(1)}s for each turn-in.`
                         : `${r.name} (${r.category}, requires level ${r.minLevel}): no Auctionator price, scan it at the AH.`}
        - Turn in at: ${r.questList.map(q => `${q.name} ${DMF.WOWHEAD_QUEST_URL(q.id)}`).join(", then repeat ")}
        - You will need ${r.quests} quests (${r.items} items) to achieve +${r.ticketsGained} (${tickets + r.ticketsGained} total) tickets.${r.live ? `
        - Total price of: ${r.total.toFixed(2)}g.` : ""}${r.overCap ? `
        - WARNING: tier ${r.tier} reputation caps after ${r.untilCap} quests (need ${r.quests}); check if turn-ins past the cap still give tickets.` : ""}
`);
  }
}

try { main(); } catch (e) { console.error("Error:", e.message); process.exit(1); }
