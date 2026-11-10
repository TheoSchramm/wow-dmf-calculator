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
    return step.repBefore + step.turnIns * DMF.REP_PER_QUEST > cap ? q : [q[0]];
  }

  function routeHtml(plan, goal, needed) {
    const steps = plan.steps.map(s => `
      <li class="route__step">
        ${wowhead.itemIcon(s.item, {category: s.item.category})}
        <div class="route__text">
          <div>Buy <span class="route__qty">${s.items} &times;</span> ${wowhead.itemLink(s.item)} for about ${UI.money(s.cost * 10000)},
            then turn them in to ${wowhead.npcLink(npcOf(s.item))} <span class="route__qty">${plural(s.turnIns, "time")}</span>
            (${s.item.qnt} per turn-in).</div>
          <div class="route__meta">
            ${stepQuests(s).map(wowhead.questLink).join(" then ")}
            &middot; You now have ${wowhead.tickets(s.ticketsAfter)}
            &middot; Reputation ${esc(DMF.repText(s.repBefore))} &rarr; ${esc(DMF.repText(s.repAfter))}
          </div>
        </div>
      </li>`).join("");
    return `
      <p class="route__title">Cheapest route to ${wowhead.itemLink(goal)}: ${wowhead.tickets(needed)} more for about
        <strong>${UI.money(plan.cost * 10000)}</strong> in ${plural(plan.steps.length, "step")}.</p>
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
    const why = plan.reason === "level"
      ? `Lower-tier quests close as your reputation rises, and the turn-ins that never close need level ${DMF.MIN_LEVEL[4]}.`
      : plan.reason === "noprice"
        ? "The turn-ins that never close (tier 5) have no price in your Auctionator file yet. Scan them at the auction house, then /reload."
        : "Your reputation has closed too many of the turn-in quests.";
    return `You can't reach ${wowhead.itemLink(goal)} yet. ${why}
      Right now the most you can get is ${wowhead.tickets(plan.maxTickets)}${level < DMF.MIN_LEVEL[4] ? ` at level ${level}` : ""}.`;
  }

  function itemCell(r, inRoute) {
    const tags = [];
    if (inRoute) tags.push('<span class="tag tag--best">In your route</span>');
    if (!r.live) tags.push('<span class="tag tag--muted" title="Your Auctionator file has no price for this item. Search for it at the auction house, then /reload.">No price yet</span>');
    if (r.turnInsLeft === 0) tags.push('<span class="tag tag--muted" title="Your reputation is past this quest\'s limit, so the NPC no longer offers it.">Closed at your reputation</span>');
    return `
      <div class="item">
        ${wowhead.itemIcon(r, {category: r.category})}
        <span class="item__name">
          <span>${wowhead.itemLink(r)}${tags.join("")}</span>
          <span class="item__meta"><span class="item__qty">${r.qnt}</span> per turn-in to ${wowhead.npcLink(npcOf(r))}</span>
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

  UI.resultsTable = function resultsTable(root) {
    root.innerHTML = `
      <div class="summary tooltip" data-ref="summary" role="status" aria-live="polite"></div>
      <h3 class="table-title">All turn-ins</h3>
      <div class="table-wrap">
        <table class="ah-table">
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col" class="num">Price each</th>
              <th scope="col" class="num">Cost per ticket</th>
              <th scope="col" class="num">Turn-ins left</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>`;
    const body = root.querySelector("tbody");
    const summary = root.querySelector('[data-ref="summary"]');

    return {
      render(rows, plan, {goal, needed, hasPrices, level}) {
        if (needed <= 0) {
          summary.innerHTML = `You already have enough tickets for ${wowhead.itemLink(goal)}. Take them to ${wowhead.npcLink(DMF.TICKET_NPC)} at the Darkmoon Faire.`;
        } else if (!hasPrices) {
          summary.textContent = "Load your Auctionator.lua in step 1 to get your cheapest route.";
        } else if (plan.ok) {
          summary.innerHTML = routeHtml(plan, goal, needed);
        } else {
          summary.innerHTML = cantReachHtml(plan, goal, level);
        }

        const routeIds = new Set((plan.ok ? plan.steps : []).map(s => s.item.id));
        // cheapest per ticket first; closed and unpriced items last
        const sorted = [...rows].sort((a, b) =>
          (a.turnInsLeft === 0) - (b.turnInsLeft === 0) ||
          (a.perTicket == null) - (b.perTicket == null) ||
          (a.perTicket ?? 0) - (b.perTicket ?? 0) || a.tier - b.tier);
        body.innerHTML = sorted.map(r => `
          <tr class="${routeIds.has(r.id) ? "is-best" : ""}${r.turnInsLeft === 0 ? " is-closed" : ""}">
            <td>${itemCell(r, routeIds.has(r.id))}</td>
            <td class="num">${money(r.price, 100)}</td>
            <td class="num">${money(r.perTicket, 100)}</td>
            <td class="num">${leftCell(r)}</td>
          </tr>`).join("");
      },
    };
  };
})();
