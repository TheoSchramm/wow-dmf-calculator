// Filters component: character level, tickets, goal (with its reward item), reputation, category,
// realm, row limit and the reputation-cap toggle. Calls onChange(values, changedField).
(() => {
  const UI = (window.UI = window.UI || {});

  const int = (v, fallback) => {
    const n = Math.floor(+v);
    return Number.isFinite(n) && v !== "" ? n : fallback;
  };

  UI.filters = function filters(root, {goals, defaultGoal, categories, maxLevel, onChange}) {
    root.innerHTML = `
      <div class="filters">
        <label class="field">
          <span class="field__label">Character level</span>
          <input class="input" name="level" type="number" min="1" max="${maxLevel}" value="${maxLevel}">
        </label>
        <label class="field">
          <span class="field__label">Tickets you have</span>
          <input class="input" name="tickets" type="number" min="0" value="0">
        </label>
        <label class="field">
          <span class="field__label">Faire reputation</span>
          <input class="input" name="rep" type="number" min="0" value="0">
        </label>
        <label class="field">
          <span class="field__label">Show results</span>
          <input class="input" name="limit" type="number" min="1" max="50" value="10">
        </label>
        <label class="field filters__wide">
          <span class="field__label">Goal</span>
          <select class="select" name="goal"></select>
        </label>
        <label class="field">
          <span class="field__label">Category</span>
          <select class="select" name="category"><option value="">All</option></select>
        </label>
        <label class="field">
          <span class="field__label">Realm</span>
          <select class="select" name="realm" disabled><option>Load a file first</option></select>
        </label>
        <label class="checkbox filters__check">
          <input name="strict" type="checkbox">
          <span>Respect reputation caps</span>
        </label>
        <div class="reward" data-ref="reward" aria-live="polite"></div>
      </div>`;

    const el = name => root.querySelector(`[name="${name}"]`);
    const goalByKey = Object.fromEntries(goals.map(g => [g.key, g]));
    goals.forEach(g => el("goal").add(new Option(`${g.name} (${g.tickets} tickets)`, g.key, false, g.key === defaultGoal)));
    categories.forEach(c => el("category").add(new Option(c, c)));

    // Reward preview for the selected goal, like a quest reward box: icon, item link, redemption quest.
    function renderReward() {
      const g = goalByKey[el("goal").value];
      root.querySelector('[data-ref="reward"]').innerHTML = `
        <span class="reward__label">You will receive:</span>
        <div class="item">
          ${UI.wowhead.itemIcon(g)}
          <span class="item__name">
            <span>${UI.wowhead.itemLink(g)}</span>
            <span class="item__meta">${g.tickets} Prize Tickets &middot; Quest: ${UI.wowhead.questLink({id: g.questId, name: `${g.tickets} Tickets - ${g.name}`})}</span>
          </span>
        </div>`;
    }
    renderReward();

    root.addEventListener("input", e => {
      if (!e.target.name) return;
      if (e.target.name === "goal") renderReward();
      onChange(values(), e.target.name);
    });
    root.addEventListener("change", e => e.target.name === "realm" && onChange(values(), "realm"));

    function values() {
      return {
        level: Math.min(maxLevel, Math.max(1, int(el("level").value, maxLevel))),
        tickets: Math.max(0, int(el("tickets").value, 0)),
        rep: Math.max(0, int(el("rep").value, 0)),
        limit: Math.max(1, int(el("limit").value, 10)),
        target: goalByKey[el("goal").value].tickets,
        category: el("category").value,
        realm: el("realm").disabled ? null : el("realm").value,
        strict: el("strict").checked,
      };
    }

    return {
      values,
      setRealms(names) {
        const sel = el("realm");
        sel.innerHTML = "";
        names.forEach(n => sel.add(new Option(n, n)));
        sel.disabled = !names.length;
      },
    };
  };
})();
