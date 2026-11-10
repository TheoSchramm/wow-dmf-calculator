#!/usr/bin/env node
// Rewrites the DROPS block in dmf.js from tools/results.json (made by tools/wowhead-drops.user.js).
// Usage: node tools/build-drops.js [path to results.json]
// Kept: normal (non-elite, non-rare) mobs in the open world, with at least MIN_SAMPLE loots in Wowhead's data.
// Dropped on purpose: elites and rares (hard / single spawn), dungeons, raids and battlegrounds, tiny samples.
const fs = require("fs"), path = require("path");
const MIN_SAMPLE = 100;
const INSTANCES = new Set([1977, 1584, 1583, 796, 2597]);   // Zul'Gurub, BRD, BRS, Scarlet Monastery, Alterac Valley

const src = process.argv[2] || path.join(__dirname, "results.json");
const data = JSON.parse(fs.readFileSync(src, "utf8"));
const lines = [];
for (const id of Object.keys(data).map(Number).sort((a, b) => a - b)) {
  const mobs = data[id].drops
    .filter(d => !d.classification && !INSTANCES.has(d.zoneId) && d.total >= MIN_SAMPLE)
    .sort((a, b) => b.looted / b.total - a.looted / a.total);
  const rows = mobs.map(d => {
    const [lo, hi] = d.level.split("-").map(s => parseInt(s, 10));
    return `[${d.npcId},${JSON.stringify(d.name)},${lo},${hi || lo},${JSON.stringify(d.zone)},${d.zoneId},${d.looted},${d.total}]`;
  });
  lines.push(`  ${id}: [   // ${data[id].name}\n    ${rows.join(",\n    ")},\n  ],`);
}
const block = `// <drops>\n${lines.join("\n")}\n  // </drops>`;

const file = path.join(__dirname, "..", "dmf.js");
const js = fs.readFileSync(file, "utf8");
const re = /\/\/ <drops>[\s\S]*?\/\/ <\/drops>/;
if (!re.test(js)) throw new Error("dmf.js has no // <drops> ... // </drops> block");
fs.writeFileSync(file, js.replace(re, () => block));
console.log(`Wrote ${lines.length} items to dmf.js`);
