// Results component: the step-by-step route (cheapest way to reach the goal, respecting reputation caps),
// then a reference list of every turn-in: price, cost per ticket and turn-ins left before its cap.
(() => {
  const UI = (window.UI = window.UI || {});
  const {esc, wowhead} = UI;

  const npcOf = r => ({id: r.npcId, name: r.npc});
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

  // Quests a step uses: tier 5 switches from its first quest to "More ..." at the reputation cap.
  function stepQuests(step) {
    const q = step.item.questList;
    if (q.length < 2) return q;
    const cap = DMF.REP_CAP[step.item.tier - 1];
    if (step.repBefore >= cap) return [q[1]];
    return step.repBefore + step.turnIns * step.repPer > cap ? q : [q[0]];
  }

  const pct = chance => `${+(chance * 100).toFixed(chance < 0.1 ? 1 : 0)}%`;
  const levels = m => m.minLevel === m.maxLevel ? `level ${m.minLevel}` : `level ${m.minLevel}-${m.maxLevel}`;
  const kills = n => Math.round(n).toLocaleString();
  const mobLink = m => wowhead.npcLink({id: m.npcId, name: m.name});
  const zoneLink = m => wowhead.zoneLink({id: m.zoneId, name: m.zone});

  // First line of a step: buy it (auction house prices) or farm it (self-found, fewest kills).
  function stepAction(s, ssf) {
    const turnIn = `then turn them in to ${wowhead.npcLink(npcOf(s.item))} <span class="route__qty">${plural(s.turnIns, "time")}</span> (each turn-in takes ${s.item.qnt} and gives ${wowhead.tickets(DMF.TICKET_VALUE[s.item.tier - 1])}).`;
    if (!ssf && s.via === "craft") {
      const c = s.craft, mats = c.mats.map(m => `<span class="route__qty">${m.qty} &times;</span> ${wowhead.itemLink(m)}${m.vendor ? " (vendor)" : ""}`).join(", ");
      const ah = s.ahPrice != null ? ` instead of about ${UI.money(s.ahPrice * s.items * 100)} at the auction house` : "";
      return `Craft <span class="route__qty">${s.items} &times;</span> ${wowhead.itemLink(s.item)} (${plural(c.crafts, "craft")}${c.yield > 1 ? `, ${c.yield} per craft` : ""})
        from ${mats} for about ${UI.money(s.cost * 10000)}${ah}, ${turnIn}`;
    }
    if (!ssf) return `Buy <span class="route__qty">${s.items} &times;</span> ${wowhead.itemLink(s.item)} for about ${UI.money(s.cost * 10000)}, ${turnIn}`;
    const m = s.item.farm.mob;
    return `Kill ${mobLink(m)} in ${zoneLink(m)} (${levels(m)}, ${pct(m.chance)} drop) until you loot
      <span class="route__qty">${s.items} &times;</span> ${wowhead.itemLink(s.item)}, about <span class="route__qty">${kills(s.cost)} kills</span>; ${turnIn}`;
  }
  const othersHtml = s => s.item.farm && s.item.farm.others.length
    ? `<div class="route__meta">Also drops it:${s.item.farm.others.map(m => `<br>${mobLink(m)} (${esc(m.zone)}, ${levels(m)}, ${pct(m.chance)})`).join("")}</div>` : "";

  function routeHtml(plan, goal, needed, ssf) {
    const steps = plan.steps.map(s => `
      <li class="route__step">
        ${wowhead.itemIcon(s.item, {category: s.item.category})}
        <div class="route__text">
          <div>${stepAction(s, ssf)}</div>
          <div class="route__meta">
            ${stepQuests(s).map(wowhead.questLink).join(" then ")}
            &middot; You now have ${wowhead.tickets(s.ticketsAfter)}
            &middot; ${wowhead.factionLink("Reputation")} ${esc(DMF.repText(s.repBefore))} &rarr; ${esc(DMF.repText(s.repAfter))}
          </div>
          ${ssf ? othersHtml(s) : ""}
        </div>
      </li>`).join("");
    return `
      <p class="route__title">${ssf ? "Fewest-kills" : "Cheapest"} route to ${wowhead.itemLink(goal)}: ${wowhead.tickets(needed)} more for about
        <strong>${ssf ? `${kills(plan.cost)} kills` : UI.money(plan.cost * 10000)}</strong> in ${plural(plan.steps.length, "step")}.</p>
      <ol class="route__steps">
        ${steps}
        <li class="route__step route__step--final">
          ${wowhead.itemIcon(goal)}
          <div class="route__text">
            <div>Take your ${wowhead.tickets(plan.tickets)} to ${wowhead.npcLink(DMF.TICKET_NPC)} and get ${wowhead.itemLink(goal)}.</div>
            <div class="route__meta">${wowhead.questLink({id: goal.questId, name: `${goal.tickets} Tickets - ${goal.name}`})}</div>
          </div>
        </li>
      </ol>`;
  }

  function cantReachHtml(plan, goal, level) {
    const why = plan.reason === "nomob"
      ? `The turn-ins that never close (tier 5) drop from mobs of level 53 and up, and none of them is within reach at level ${level}.`
      : plan.reason === "level"
      ? `Lower-tier quests close as your reputation rises, and the turn-ins that never close need level ${DMF.MIN_LEVEL[4]}.`
      : plan.reason === "noprice"
        ? "The turn-ins that never close (tier 5) have no price in your Auctionator file yet. Scan them at the auction house, then /reload."
        : "Your reputation has closed too many of the turn-in quests.";
    return `You can't reach ${wowhead.itemLink(goal)} yet. ${why}
      Right now the most you can get is ${wowhead.tickets(plan.maxTickets)}${level < DMF.MIN_LEVEL[4] ? ` at level ${level}` : ""}.`;
  }

  function itemCell(r, inRoute, ssf) {
    const tags = [];
    if (inRoute) tags.push('<span class="tag tag--best">In your route</span>');
    if (ssf) {
      if (!r.farm) {
        const mobItem = DMF.DROPS_FROM[r.category];
        tags.push(`<span class="tag tag--muted" title="${mobItem ? "No mob you can fight at your level drops it." : "This item is crafted, no mob drops it."}">${mobItem ? "No mob at your level" : "Crafted"}</span>`);
      }
    } else if (r.via === "craft") {
      tags.push(`<span class="tag tag--muted" title="Cheaper to craft from materials (${r.craft.toFixed(1)}s each) than to buy at the auction house${r.ahPrice != null ? ` (${r.ahPrice.toFixed(1)}s)` : ""}.">Craft it</span>`);
    } else if (!r.live) tags.push('<span class="tag tag--muted" title="Your Auctionator file has no price for this item. Search for it at the auction house, then /reload.">No price yet</span>');
    if (!ssf && r.craftMissing && r.craftMissing.length) tags.push(`<span class="tag tag--muted" title="Can't price crafting it: no auction price for ${UI.esc(r.craftMissing.join(", "))}. Scan them at the auction house, then /reload.">Materials not priced</span>`);
    if (!ssf && r.craftSkill) tags.push(`<span class="tag tag--muted" title="Crafting it needs ${UI.esc(r.category)} ${r.craftSkill}; you entered a lower skill.">Needs skill ${r.craftSkill}</span>`);
    if (r.turnInsLeft === 0) tags.push('<span class="tag tag--muted" title="Your reputation is past this quest\'s limit, so the NPC no longer offers it.">Closed at your reputation</span>');
    return `
      <div class="item">
        ${wowhead.itemIcon(r, {category: r.category})}
        <span class="item__name">
          <span>${wowhead.itemLink(r)}${tags.join("")}</span>
          <span class="item__meta">Turn in <span class="item__qty">${r.qnt}</span> for ${wowhead.tickets(DMF.TICKET_VALUE[r.tier - 1])} to ${wowhead.npcLink(npcOf(r))}</span>
          <span class="item__quests">${r.questList.map(q => `<span>${wowhead.questLink(q)}</span>`).join("")}</span>
        </span>
      </div>`;
  }

  const money = (v, unit) => v == null ? '<span class="no-price">No price</span>' : UI.money(v * unit);

  function leftCell(r) {
    if (r.turnInsLeft === Infinity) return '<span title="Never closes: after Friendly 5999 the &quot;More ...&quot; quest keeps giving tickets">No limit</span>';
    const cap = DMF.repText(DMF.REP_CAP[r.tier - 1]);
    return `<span title="Offered until ${esc(cap)}">${r.turnInsLeft}</span><span class="left-cap">until ${esc(cap)}</span>`;
  }

  // Self-found reference table cell: best mob.
  function mobCell(r) {
    if (!r.farm) return '<span class="no-price">-</span>';
    const m = r.farm.mob;
    return `${mobLink(m)}<span class="left-cap">${zoneLink(m)}, ${levels(m)}, ${pct(m.chance)} drop</span>`;
  }

  UI.resultsTable = function resultsTable(root) {
    root.innerHTML = `
      <div class="summary tooltip" data-ref="summary" role="status" aria-live="polite"></div>
      <h3 class="table-title">All turn-ins</h3>
      <div class="table-wrap">
        <table class="ah-table">
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col" class="num" data-ref="h1">Price each</th>
              <th scope="col" class="num" data-ref="h2">Cost per ticket</th>
              <th scope="col" class="num">Turn-ins left</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>`;
    const body = root.querySelector("tbody");
    const summary = root.querySelector('[data-ref="summary"]');

    return {
      render(rows, plan, {goal, needed, hasPrices, level, ssf}) {
        root.querySelector('[data-ref="h1"]').textContent = ssf ? "Best mob" : "Price each";
        root.querySelector('[data-ref="h1"]').classList.toggle("num", !ssf);
        root.querySelector('[data-ref="h2"]').textContent = ssf ? "Kills per ticket" : "Cost per ticket";
        if (needed <= 0) {
          summary.innerHTML = `You already have enough tickets for ${wowhead.itemLink(goal)}. Take them to ${wowhead.npcLink(DMF.TICKET_NPC)} at the Darkmoon Faire.`;
        } else if (!ssf && !hasPrices) {
          summary.textContent = "Load your Auctionator.lua in step 1 to get your cheapest route.";
        } else if (plan.ok) {
          summary.innerHTML = routeHtml(plan, goal, needed, ssf);
        } else {
          summary.innerHTML = cantReachHtml(plan, goal, level);
        }

        const routeIds = new Set((plan.ok ? plan.steps : []).map(s => s.item.id));
        // cheapest per ticket first; closed and unpriced items last
        const cost = r => ssf ? (r.farm ? r.qnt * r.farm.kills / r.ticketValue : null) : r.perTicket;
        const sorted = [...rows].sort((a, b) =>
          (a.turnInsLeft === 0) - (b.turnInsLeft === 0) ||
          (cost(a) == null) - (cost(b) == null) ||
          (cost(a) ?? 0) - (cost(b) ?? 0) || a.tier - b.tier);
        body.innerHTML = sorted.map(r => `
          <tr class="${routeIds.has(r.id) ? "is-best" : ""}${r.turnInsLeft === 0 ? " is-closed" : ""}">
            <td>${itemCell(r, routeIds.has(r.id), ssf)}</td>
            <td class="${ssf ? "" : "num"}">${ssf ? mobCell(r) : money(r.price, 100)}</td>
            <td class="num">${ssf ? (cost(r) == null ? '<span class="no-price">-</span>' : (cost(r) < 10 ? cost(r).toFixed(1) : kills(cost(r)))) : money(r.perTicket, 100)}</td>
            <td class="num">${leftCell(r)}</td>
          </tr>`).join("");
      },
    };
  };
})();
