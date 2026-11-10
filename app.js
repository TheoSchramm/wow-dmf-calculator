// App wiring: connects dmf.js (data + maths) to the UI components.
(() => {
  const {ITEMS, GOALS, MIN_LEVEL, MAX_LEVEL} = DMF;
  // Folder to paste into the Windows file dialog (no account ID, so it's safe to publish)
  const WTF_PATH = "C:\\Program Files (x86)\\World of Warcraft\\_forever_\\WTF\\Account";

  let realms = null;

  const loader = UI.fileLoader(document.getElementById("loader"), {path: WTF_PATH, onFile: loadFile});
  const table = UI.resultsTable(document.getElementById("results"));
  const filters = UI.filters(document.getElementById("filters"), {
    goals: GOALS,
    defaultGoal: "box",
    categories: [...new Set(ITEMS.map(i => i.category))],
    maxLevel: MAX_LEVEL,
    onChange(values, changed) {
      if (changed === "realm" && values.realm) applyRealm(values.realm);
      render();
    },
  });

  function applyRealm(name) {
    const prices = DMF.realmPrices(realms[name]);
    const n = DMF.applyPrices(ITEMS, prices);
    loader.setStatus(
      `Loaded ${Object.keys(prices).length} prices from realm "${name}". ${n} of ${ITEMS.length} turn-in items have prices; ` +
      `items marked "No AH price" need an auction house scan in game and are listed last.`,
      "ok");
  }

  function render() {
    const v = filters.values();
    const rows = DMF.calculate(ITEMS, {
      target: v.target, rep: v.rep, strict: v.strict, tickets: v.tickets, category: v.category, level: v.level,
    });
    table.render(rows, {limit: v.limit, level: v.level, unlockLevels: MIN_LEVEL});
  }

  async function loadFile(file) {
    try {
      realms = DMF.parseAuctionator(new Uint8Array(await file.arrayBuffer()));
      const names = Object.keys(realms)
        .filter(r => r !== "__dbversion")
        .sort((a, b) => realms[b].length - realms[a].length);
      filters.setRealms(names);
      loader.setLoaded(file.name);
      applyRealm(names[0]);
      render();
    } catch (e) {
      loader.setLoaded(null);
      loader.setStatus(`Could not read ${file.name}: ${e.message}`, "error");
    }
  }

  loader.setStatus("No file loaded. Load Auctionator.lua to see prices; until then the list only shows quests and items needed.");
  render();
})();
