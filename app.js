// App wiring: connects dmf.js (data + maths) to the UI components.
(() => {
  const {ITEMS, GOALS, MAX_LEVEL} = DMF;
  // Folder to paste into the Windows file dialog (no account ID, so it's safe to publish)
  const WTF_PATH = "C:\\Program Files (x86)\\World of Warcraft\\_forever_\\WTF\\Account";

  // Prices are kept in this browser (localStorage) so a refresh doesn't need the file again. Only the prices of the
  // items this tool uses are saved, per realm, never the file itself.
  const STORE_KEY = "dmf-prices-v1";
  const RELEVANT = new Set([...ITEMS.map(i => i.id), ...Object.keys(DMF.MATS).map(Number)]);
  const readSaved = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { return null; } };
  const writeSaved = saved => { try { localStorage.setItem(STORE_KEY, JSON.stringify(saved)); return true; } catch (e) { return false; } };
  const forgetSaved = () => { try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ } };
  // The choices (reward, level, reputation, ticked boxes, skills, realm) are kept too, so a refresh restores them.
  const SETTINGS_KEY = "dmf-settings-v1";
  const settings = (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { return {}; } })();
  let savedNote = "";     // appended to the status line: where the prices came from

  let realms = null;      // {realm name: {itemId: copper}} for the loaded or saved file
  let prices = null;      // prices of the selected realm: {itemId: copper}
  // {profession: skill level} for the ticked professions; the skill box only shows while its profession is ticked
  const professions = () => Object.fromEntries([...document.querySelectorAll("[data-profession]:checked")].map(b => {
    const skill = parseInt(document.querySelector(`[data-skill="${b.dataset.profession}"]`).value, 10);
    return [b.dataset.profession, Math.min(DMF.MAX_SKILL, Math.max(1, Number.isFinite(skill) ? skill : DMF.MAX_SKILL))];
  }));
  // gathering professions ticked under a ticked profession (Mining sits under Blacksmithing and Engineering)
  const gathering = () => [...new Set([...document.querySelectorAll("[data-gather]:checked")]
    .filter(b => b.closest(".profession").querySelector("[data-profession]").checked).map(b => b.dataset.gather))];
  const professionsBox = document.getElementById("professions");
  // a profession's skill and gathering boxes are always shown, usable once the profession is ticked
  const syncProfession = box => {
    const on = box.querySelector("[data-profession]").checked;
    box.classList.toggle("is-on", on);
    for (const input of box.querySelectorAll(".profession__skill input, .profession__gather input")) input.disabled = !on;
  };
  professionsBox.addEventListener("change", e => {
    const t = e.target;
    if (t.dataset.profession) syncProfession(t.closest(".profession"));
    if (t.dataset.gather) for (const b of professionsBox.querySelectorAll(`[data-gather="${t.dataset.gather}"]`)) b.checked = t.checked;   // one Mining, shared
    render();
  });
  professionsBox.addEventListener("input", e => {
    if (!e.target.hasAttribute("data-digits")) return;      // digits only
    const clean = e.target.value.replace(/\D/g, "");
    if (clean !== e.target.value) e.target.value = clean;
    render();
  });
  const ssfBox = document.getElementById("ssf");
  const syncSsf = () => {
    document.getElementById("prices").hidden = ssfBox.checked;       // step 1 is not needed without the auction house
    document.getElementById("ssf-skip").hidden = !ssfBox.checked;
    document.getElementById("professions").hidden = ssfBox.checked;   // crafting is priced from the auction house
    document.getElementById("ssf-note").hidden = !ssfBox.checked;
  };
  ssfBox.addEventListener("change", () => { syncSsf(); render(); });
  // restore the ticked boxes and skills
  ssfBox.checked = !!settings.ssf;
  syncSsf();
  for (const b of document.querySelectorAll("[data-profession]")) {
    const saved = (settings.professions || {})[b.dataset.profession];
    if (saved) {
      b.checked = !!saved.on;
      if (/^\d{1,3}$/.test(saved.skill)) document.querySelector(`[data-skill="${b.dataset.profession}"]`).value = saved.skill;
    }
  }
  for (const b of document.querySelectorAll("[data-gather]")) b.checked = !!(settings.gather || {})[b.dataset.gather];
  for (const box of document.querySelectorAll(".profession")) syncProfession(box);

  const loader = UI.fileLoader(document.getElementById("loader"), {path: WTF_PATH, onFile: loadFile, onForget() {
    forgetSaved();
    realms = prices = null;
    savedNote = "";
    loader.setSaved(false);
    loader.setLoaded(null);
    loader.setStatus("Saved prices forgotten. No file loaded.");
    filters.setRealms([]);
    for (const it of ITEMS) { it.price = it.ahPrice = it.craft = null; it.live = false; it.via = "ah"; }
    render();
  }});
  const table = UI.resultsTable(document.getElementById("results"), document.getElementById("all-table"));
  const filters = UI.filters(document.getElementById("filters"), {
    goals: GOALS,
    defaultGoal: GOALS.some(g => g.key === settings.goal) ? settings.goal : "box",
    maxLevel: MAX_LEVEL,
    initial: settings.filters,
    onChange(values, changed) {
      if (changed === "realm" && values.realm) applyRealm(values.realm);
      render();
    },
  });

  function applyRealm(name) {
    prices = realms[name];
    const n = DMF.applyPrices(ITEMS, prices, professions(), gathering());
    const missing = ITEMS.length - n;
    loader.setStatus(
      `Prices loaded (realm "${name}")${savedNote}. ` +
      (missing ? `${missing} of ${ITEMS.length} items have no price yet; they're marked "No price yet" and listed last.`
               : `All ${ITEMS.length} items have a price.`),
      "ok");
  }

  // save the choices so a refresh restores them
  function saveSettings() {
    const professionsState = {}, gather = {};
    for (const b of document.querySelectorAll("[data-profession]")) {
      professionsState[b.dataset.profession] = {on: b.checked, skill: document.querySelector(`[data-skill="${b.dataset.profession}"]`).value};
    }
    for (const b of document.querySelectorAll("[data-gather]")) gather[b.dataset.gather] = b.checked;
    const raw = filters.raw();
    if (raw.realm) settings.realm = raw.realm;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({goal: raw.goal, filters: raw, realm: settings.realm, ssf: ssfBox.checked, professions: professionsState, gather}));
    } catch (e) { /* storage blocked: nothing to save */ }
  }

  function render() {
    saveSettings();
    const v = filters.values();
    const opts = {target: v.target, tickets: v.tickets, level: v.level, rep: v.rep, repBonus: v.repBonus};
    const ssf = ssfBox.checked;
    if (prices) DMF.applyPrices(ITEMS, prices, professions(), gathering());   // craft from materials where you have the profession
    if (ssf) DMF.applyFarm(ITEMS, v.level);           // best mob per item for this level
    const rows = DMF.calculate(ITEMS, opts);          // reference list (one row per item)
    const plan = DMF.planRoute(ITEMS, {...opts, ssf});   // cheapest route (gold, or kills when self-found) respecting reputation caps
    table.render(rows, plan, {goal: v.goal, needed: v.target - v.tickets, hasPrices: !!realms, level: v.level, ssf});
  }

  async function loadFile(file) {
    try {
      const blobs = DMF.parseAuctionator(new Uint8Array(await file.arrayBuffer()));
      realms = {};
      for (const [name, blob] of Object.entries(blobs)) {
        if (name === "__dbversion") continue;
        const all = DMF.realmPrices(blob), own = {};
        for (const id of Object.keys(all)) if (RELEVANT.has(+id)) own[id] = all[id];
        realms[name] = {...own, __count: Object.keys(all).length};
      }
      const saved = writeSaved({name: file.name, savedAt: Date.now(), realms});
      savedNote = saved ? ", saved in this browser" : "";
      loader.setSaved(saved);
      const names = Object.keys(realms).sort((a, b) => realms[b].__count - realms[a].__count);
      const realm = names.includes(settings.realm) ? settings.realm : names[0];
      filters.setRealms(names, realm);
      loader.setLoaded(file.name);
      applyRealm(realm);
      render();
    } catch (e) {
      realms = null;
      loader.setLoaded(null);
      loader.setStatus(`Could not read ${file.name}: ${e.message}`, "error");
      render();
    }
  }

  // restore the prices saved by an earlier visit
  (() => {
    const saved = readSaved();
    if (!saved || !saved.realms || !Object.keys(saved.realms).length) { loader.setStatus("No file loaded yet."); return; }
    realms = saved.realms;
    const names = Object.keys(realms).sort((a, b) => (realms[b].__count || 0) - (realms[a].__count || 0));
    const when = new Date(saved.savedAt).toLocaleString([], {dateStyle: "medium", timeStyle: "short"});
    savedNote = `, from ${saved.name} saved on ${when}`;
    const realm = names.includes(settings.realm) ? settings.realm : names[0];
    filters.setRealms(names, realm);
    loader.setLoaded(saved.name);
    loader.setSaved(true);
    applyRealm(realm);
  })();
  render();
})();
