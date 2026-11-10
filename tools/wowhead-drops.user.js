// ==UserScript==
// @name         Wowhead drops scraper (DMF calculator)
// @namespace    wow-dmf-calculator
// @version      1.0
// @description  Reads the "Dropped By" tab of a Wowhead item page and collects it as JSON, across several item pages.
// @match        https://www.wowhead.com/*item=*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// ==/UserScript==
(() => {
  "use strict";
  const KEY = "dmfDrops";
  const itemId = +(location.pathname.match(/item=(\d+)/) || [])[1];
  if (!itemId) return;

  const num = s => +String(s || "").replace(/[^\d.]/g, "") || 0;
  const load = () => { try { return JSON.parse(GM_getValue(KEY, "{}")); } catch { return {}; } };

  function scrape() {
    const panel = document.querySelector("#tab-dropped-by");
    if (!panel) return null;
    const rows = [...panel.querySelectorAll("tbody tr.listview-row")].map(tr => {
      const td = tr.children;                       // Changes, Name, Level, Location, React, Count, %, Pop.
      const a = td[1].querySelector("a");
      const zone = td[3].querySelector("a");
      const tips = td[5].querySelectorAll(".tip");  // [times looted with item, total times looted]
      const looted = num(tips[0]?.textContent), total = num(tips[1]?.textContent);
      return {
        npcId: +(a?.href.match(/npc=(\d+)/) || [])[1] || null,
        name: a?.textContent.trim(),
        level: td[2].firstChild?.textContent.trim(),            // "37 - 38"
        classification: td[2].querySelector(".small")?.textContent.trim() || "",   // Elite / Rare
        zoneId: +(zone?.href.match(/zone=(\d+)/) || [])[1] || null,
        zone: zone?.textContent.trim() || td[3].textContent.trim(),
        looted, total,
        chance: total ? +(looted / total * 100).toFixed(2) : num(td[6].textContent),  // %
      };
    });
    const range = panel.querySelector(".listview-nav span")?.textContent || "";
    const m = range.match(/(\d+)\D+(\d+)\D+of\D+(\d+)/);
    return {rows, partial: !!m && +m[2] < +m[3]};
  }

  async function run() {
    let r = scrape();
    if (!r) {   // tab not built yet: open it, then wait for the table
      [...document.querySelectorAll("a, button, li")].find(e => /^\s*dropped by/i.test(e.textContent))?.click();
      for (let i = 0; i < 20 && !(r = scrape()); i++) await new Promise(ok => setTimeout(ok, 250));
    }
    if (!r) return flash("No 'Dropped By' tab found on this page");
    const all = load();
    all[itemId] = {name: document.querySelector("h1")?.textContent.trim(), drops: r.rows};
    GM_setValue(KEY, JSON.stringify(all));
    refresh();
    flash(`Saved ${r.rows.length} mobs for item ${itemId}` + (r.partial ? " (list is paginated: open the other pages and save again)" : ""));
  }

  const box = document.createElement("div");
  box.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:99999;display:flex;gap:6px;align-items:center;" +
    "background:#222;color:#fff;font:12px sans-serif;padding:8px;border:1px solid #888;border-radius:4px";
  const msg = document.createElement("span");
  const mk = (label, fn) => { const b = document.createElement("button"); b.textContent = label; b.onclick = fn; return b; };
  const copy = mk("Copy all", () => { GM_setClipboard(JSON.stringify(load(), null, 1), "text"); flash("Copied to clipboard"); });
  const clear = mk("Clear", () => { GM_setValue(KEY, "{}"); refresh(); });
  box.append(mk("Save drops", run), copy, clear, msg);
  document.body.append(box);

  function refresh() { copy.textContent = `Copy all (${Object.keys(load()).length} items)`; }
  function flash(t) { msg.textContent = t; }
  refresh();
})();
