// "What do you want?" component: the reward to buy (with its preview), character level and tickets
// already owned. A realm picker appears only when the loaded file has prices for more than one realm.
// Calls onChange(values, changedField).
(() => {
  const UI = (window.UI = window.UI || {});

  const int = (v, fallback) => {
    const n = Math.floor(+v);
    return Number.isFinite(n) && v !== "" ? n : fallback;
  };

  UI.filters = function filters(root, {goals, defaultGoal, maxLevel, onChange}) {
    root.innerHTML = `
      <div class="filters">
        <label class="field filters__goal">
          <span class="field__label">Reward you want</span>
          <select class="select" name="goal"></select>
        </label>
        <div class="reward" data-ref="reward" aria-live="polite"></div>
        <label class="field">
          <span class="field__label">Your character level</span>
          <input class="input" name="level" type="number" min="1" max="${maxLevel}" value="${maxLevel}" inputmode="numeric">
          <span class="field__hint">Hides turn-ins you are too low level for.</span>
        </label>
        <label class="field">
          <span class="field__label">Prize tickets you already have</span>
          <input class="input" name="tickets" type="number" min="0" value="0" inputmode="numeric">
          <span class="field__hint">Leave at 0 if you have none.</span>
        </label>
        <label class="field" data-ref="realm-field" hidden>
          <span class="field__label">Use prices from realm</span>
          <select class="select" name="realm"></select>
        </label>
      </div>`;

    const el = name => root.querySelector(`[name="${name}"]`);
    const goalByKey = Object.fromEntries(goals.map(g => [g.key, g]));
    goals.forEach(g => el("goal").add(new Option(`${g.name} (${g.tickets} tickets)`, g.key, false, g.key === defaultGoal)));

    // Reward preview for the selected goal, like a quest reward box: icon, item link, redemption quest.
    function renderReward() {
      const g = goalByKey[el("goal").value];
      root.querySelector('[data-ref="reward"]').innerHTML = `
        <span class="reward__label">You will receive:</span>
        <div class="item">
          ${UI.wowhead.itemIcon(g)}
          <span class="item__name">
            <span>${UI.wowhead.itemLink(g)}</span>
            <span class="item__meta">Costs ${g.tickets} Prize Tickets &middot; Quest: ${UI.wowhead.questLink({id: g.questId, name: `${g.tickets} Tickets - ${g.name}`})}</span>
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
      const goal = goalByKey[el("goal").value];
      return {
        goal,
        target: goal.tickets,
        level: Math.min(maxLevel, Math.max(1, int(el("level").value, maxLevel))),
        tickets: Math.max(0, int(el("tickets").value, 0)),
        realm: el("realm").options.length ? el("realm").value : null,
      };
    }

    return {
      values,
      setRealms(names) {
        const sel = el("realm");
        sel.innerHTML = "";
        names.forEach(n => sel.add(new Option(n, n)));
        root.querySelector('[data-ref="realm-field"]').hidden = names.length < 2;
      },
    };
  };
})();
