// App wiring: connects dmf.js (data + maths) to the UI components.
(() => {
  const {ITEMS, GOALS, MAX_LEVEL} = DMF;
  // Folder to paste into the Windows file dialog (no account ID, so it's safe to publish)
  const WTF_PATH = "C:\\Program Files (x86)\\World of Warcraft\\_forever_\\WTF\\Account";

  let realms = null;
  let prices = null;      // prices of the selected realm: {itemId: copper}
  const professions = () => [...document.querySelectorAll("[data-profession]:checked")].map(b => b.dataset.profession);
  document.getElementById("professions").addEventListener("change", () => render());
  const ssfBox = document.getElementById("ssf");
  ssfBox.addEventListener("change", () => {
    document.getElementById("prices").hidden = ssfBox.checked;
    document.getElementById("ssf-note").hidden = !ssfBox.checked;
    render();
  });

  const loader = UI.fileLoader(document.getElementById("loader"), {path: WTF_PATH, onFile: loadFile});
  const table = UI.resultsTable(document.getElementById("results"));
  const filters = UI.filters(document.getElementById("filters"), {
    goals: GOALS,
    defaultGoal: "box",
    maxLevel: MAX_LEVEL,
    onChange(values, changed) {
      if (changed === "realm" && values.realm) applyRealm(values.realm);
      render();
    },
  });

  function applyRealm(name) {
    prices = DMF.realmPrices(realms[name]);
    const n = DMF.applyPrices(ITEMS, prices, professions());
    const missing = ITEMS.length - n;
    loader.setStatus(
      `Prices loaded (realm "${name}"). ` +
      (missing ? `${missing} of ${ITEMS.length} items have no price yet; they're marked "No price yet" and listed last.`
               : `All ${ITEMS.length} items have a price.`),
      "ok");
  }

  function render() {
    const v = filters.values();
    const opts = {target: v.target, tickets: v.tickets, level: v.level, rep: v.rep, repBonus: v.repBonus};
    const ssf = ssfBox.checked;
    if (prices) DMF.applyPrices(ITEMS, prices, professions());   // craft from materials where you have the profession
    if (ssf) DMF.applyFarm(ITEMS, v.level);           // best mob per item for this level
    const rows = DMF.calculate(ITEMS, opts);          // reference list (one row per item)
    const plan = DMF.planRoute(ITEMS, {...opts, ssf});   // cheapest route (gold, or kills when self-found) respecting reputation caps
    table.render(rows, plan, {goal: v.goal, needed: v.target - v.tickets, hasPrices: !!realms, level: v.level, ssf});
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
      realms = null;
      loader.setLoaded(null);
      loader.setStatus(`Could not read ${file.name}: ${e.message}`, "error");
      render();
    }
  }

  loader.setStatus("No file loaded yet.");
  render();
})();
