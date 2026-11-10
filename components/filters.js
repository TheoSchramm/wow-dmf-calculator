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
        <div class="field filters__goal">
          <span class="field__label" id="goal-label">Reward you want</span>
          <div data-ref="goal"></div>
        </div>
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
    const goalPicker = UI.itemPicker(root.querySelector('[data-ref="goal"]'), {
      items: goals.map(g => ({value: g.key, name: g.name, icon: g.icon, quality: g.quality, noteHtml: UI.wowhead.tickets(g.tickets)})),
      value: defaultGoal,
      labelId: "goal-label",
      onChange() { renderReward(); onChange(values(), "goal"); },
    });

    // Reward preview for the selected goal, like a quest reward box: icon, item link, redemption quest.
    function renderReward() {
      const g = goalByKey[goalPicker.value()];
      root.querySelector('[data-ref="reward"]').innerHTML = `
        <span class="reward__label">You will receive:</span>
        <div class="item">
          ${UI.wowhead.itemIcon(g)}
          <span class="item__name">
            <span>${UI.wowhead.itemLink(g)}</span>
            <span class="item__meta">Costs ${UI.wowhead.tickets(g.tickets)} &middot; Quest: ${UI.wowhead.questLink({id: g.questId, name: `${g.tickets} Tickets - ${g.name}`})}</span>
          </span>
        </div>`;
    }
    renderReward();

    root.addEventListener("input", e => e.target.name && onChange(values(), e.target.name));
    root.addEventListener("change", e => e.target.name === "realm" && onChange(values(), "realm"));

    function values() {
      const goal = goalByKey[goalPicker.value()];
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
