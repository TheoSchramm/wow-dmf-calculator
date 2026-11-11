// "What do you want?" component: the reward to buy (with its preview), character level and tickets
// already owned. A realm picker appears only when the loaded file has prices for more than one realm.
// Calls onChange(values, changedField).
(() => {
  const UI = (window.UI = window.UI || {});

  const int = (v, fallback) => {
    const n = Math.floor(+v);
    return Number.isFinite(n) && v !== "" ? n : fallback;
  };

  UI.filters = function filters(root, {goals, defaultGoal, maxLevel, onChange, initial = {}}) {
    root.innerHTML = `
      <div class="filters">
        <div class="filters__inputs">
          <div class="field">
            <span class="field__label" id="goal-label">Reward you want</span>
            <div data-ref="goal"></div>
          </div>
          <div class="sep" aria-hidden="true"></div>
          <div class="filters__row">
            <label class="field">
              <span class="field__label">Your character level</span>
              <input class="input" name="level" type="text" data-digits maxlength="${String(maxLevel).length}" value="${maxLevel}" inputmode="numeric" autocomplete="off">
              <span class="field__hint">Hides turn-ins you are too low level for.</span>
            </label>
            <label class="field">
              <span class="field__label">Prize tickets you already have</span>
              <input class="input" name="tickets" type="text" data-digits maxlength="6" value="0" inputmode="numeric" autocomplete="off">
              <span class="field__hint">Leave at 0 if you have none.</span>
            </label>
          </div>
          <div class="sep" aria-hidden="true"></div>
          <div class="field">
            <span class="field__label" id="rep-label">Your ${UI.wowhead.factionLink()} reputation</span>
            <div class="rep-input">
              <select class="select" name="standing" aria-labelledby="rep-label">
                ${DMF.STANDINGS.map(s => `<option value="${s.name}">${s.name}</option>`).join("")}
              </select>
              <input class="input" name="repValue" type="text" data-digits maxlength="5" value="0" inputmode="numeric" autocomplete="off" aria-labelledby="rep-label">
              <span class="rep-input__max" data-ref="rep-max">/ 3000</span>
            </div>
            <span class="field__hint">Check it in game: Reputation tab (U). Quests close once you pass their limit.</span>
          </div>
          <div class="sep" aria-hidden="true"></div>
          <div class="field">
            <span class="field__label" id="diplomat-label">Reputation bonus</span>
            <div class="diplomat">
              ${UI.wowhead.spellIcon(DMF.DIPLOMAT)}
              <span>${UI.wowhead.spellLink(DMF.DIPLOMAT)} (Legacy talent)</span>
              <select class="select" name="diplomat" aria-labelledby="diplomat-label">
                ${Array.from({length: DMF.DIPLOMAT.maxRanks + 1}, (_, i) => `<option value="${i}">${i ? `Rank ${i} (+${Math.round(i * DMF.DIPLOMAT.perRank * 100)}%)` : "Not learned"}</option>`).join("")}
              </select>
            </div>
            <span class="field__hint">Raises the reputation each turn-in gives, so lower-tier quests close sooner.</span>
          </div>
          <label class="field" data-ref="realm-field" hidden>
            <div class="sep" aria-hidden="true"></div>
            <span class="field__label">Use prices from realm</span>
            <select class="select" name="realm"></select>
          </label>
        </div>
        <aside class="reward-card tooltip" data-ref="reward" aria-live="polite" aria-label="Selected reward"></aside>
      </div>`;

    const el = name => root.querySelector(`[name="${name}"]`);
    // restore saved field values (only those that still fit their field)
    for (const name of ["level", "tickets", "repValue"]) if (/^\d*$/.test(initial[name] ?? "x")) el(name).value = initial[name];
    for (const name of ["standing", "diplomat"]) if ([...el(name).options].some(o => o.value === String(initial[name]))) el(name).value = initial[name];
    const goalByKey = Object.fromEntries(goals.map(g => [g.key, g]));
    const goalPicker = UI.itemPicker(root.querySelector('[data-ref="goal"]'), {
      items: goals.map(g => ({value: g.key, name: g.name, icon: g.icon, quality: g.quality, noteHtml: UI.wowhead.tickets(g.tickets)})),
      value: defaultGoal,
      labelId: "goal-label",
      onChange() { renderReward(); onChange(values(), "goal"); },
    });

    // Reward showcase for the selected goal, like the in-game quest reward panel.
    function renderReward() {
      const g = goalByKey[goalPicker.value()];
      const w = UI.wowhead;
      root.querySelector('[data-ref="reward"]').innerHTML = `
        <span class="reward-card__label">You will receive:</span>
        <div class="reward-card__body">
          ${w.itemIcon(g, {size: "large"})}
          <div class="reward-card__text">
            ${w.itemLink(g, "reward-card__name")}
            <span class="reward-card__cost">Costs ${w.tickets(g.tickets)}</span>
          </div>
        </div>
        <div class="reward-card__quest">${w.questLink({id: g.questId, name: `${g.tickets} Tickets - ${g.name}`})}</div>
        <div class="reward-card__npc">Redeem with ${w.npcLink(DMF.TICKET_NPC)} at the Darkmoon Faire.</div>`;
    }
    renderReward();

    // keep the reputation value's range in step with the chosen standing
    function syncStanding() {
      const s = DMF.STANDINGS.find(s => s.name === el("standing").value);
      el("repValue").maxLength = String(s.size - 1).length;
      root.querySelector('[data-ref="rep-max"]').textContent = s.name === "Exalted" ? "" : `/ ${s.size}`;
      el("repValue").hidden = s.name === "Exalted";
    }
    syncStanding();

    root.addEventListener("input", e => {
      if (!e.target.name) return;
      if (e.target.hasAttribute("data-digits")) {          // digits only (typing, pasting, dropping)
        const clean = e.target.value.replace(/\D/g, "");
        if (clean !== e.target.value) e.target.value = clean;
      }
      if (e.target.name === "standing") syncStanding();
      onChange(values(), e.target.name);
    });
    root.addEventListener("change", e => e.target.name === "realm" && onChange(values(), "realm"));

    function values() {
      const goal = goalByKey[goalPicker.value()];
      return {
        goal,
        target: goal.tickets,
        level: Math.min(maxLevel, Math.max(1, int(el("level").value, maxLevel))),
        tickets: Math.max(0, int(el("tickets").value, 0)),
        rep: DMF.repFromStanding(el("standing").value, el("repValue").value),
        repBonus: (+el("diplomat").value || 0) * DMF.DIPLOMAT.perRank,
        realm: el("realm").options.length ? el("realm").value : null,
      };
    }

    return {
      values,
      // the fields as typed, for saving: {goal, level, tickets, standing, repValue, diplomat, realm}
      raw: () => ({goal: goalPicker.value(), level: el("level").value, tickets: el("tickets").value, standing: el("standing").value,
                   repValue: el("repValue").value, diplomat: el("diplomat").value, realm: el("realm").value}),
      setRealms(names, selected) {
        const sel = el("realm");
        sel.innerHTML = "";
        names.forEach(n => sel.add(new Option(n, n)));
        if (names.includes(selected)) sel.value = selected;
        root.querySelector('[data-ref="realm-field"]').hidden = names.length < 2;
      },
    };
  };
})();
