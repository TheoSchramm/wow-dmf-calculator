// Results component: the step-by-step route (cheapest way to reach the goal, respecting reputation caps),
// then a reference list of every turn-in: price, cost per ticket and remaining turn-ins before its cap.
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

  // One line per material; a material you make yourself lists its raw ingredients on lines under it.
  const qtyOf = (n, x) => `<span class="route__qty">${n} &times;</span> ${wowhead.itemLink(x)}`;
  const matIcon = x => `<img class="route__icon" src="${esc(DMF.ICON_URL(x.icon, "small"))}" alt="" width="18" height="18" onerror="this.remove()">`;
  // a row of the materials panel: what on the left, its price in a column on the right
  const row = (left, cost, cls = "") => `<div class="route__row ${cls}"><span>${left}</span>${cost == null ? "" : `<span class="route__price">${UI.money(cost)}</span>`}</div>`;
  const matHtml = m => {
    const verb = DMF.REFINE[m.id] && DMF.REFINE[m.id].by === "Skinning" ? "cure" : "smelt";
    const from = m.refined ? m.refined.map(r => row(`${verb} from ${matIcon(r)}${qtyOf(r.qty, r)}`, r.cost, "route__row--sub")).join("") : "";
    return row(`${matIcon(m)}${qtyOf(m.qty, m)}${m.vendor ? " (vendor)" : ""}`, m.cost) + from;
  };
  const pct = chance => `${+(chance * 100).toFixed(chance < 0.1 ? 1 : 0)}%`;
  const levels = m => m.minLevel === m.maxLevel ? `level ${m.minLevel}` : `level ${m.minLevel}-${m.maxLevel}`;
  const kills = n => Math.round(n).toLocaleString();
  const mobLink = m => wowhead.npcLink({id: m.npcId, name: m.name});
  const zoneLink = m => wowhead.zoneLink({id: m.zoneId, name: m.zone});

  // A step is three sections split by a divider: the turn-in, how to get the items, where that leaves you. One fact per line.
  const line = html => `<div class="route__line">${html}</div>`;
  // short facts share a line, split by a bar
  const pair = (...parts) => line(parts.join(' <span class="route__bar">|</span> '));
  const sep = '<div class="route__sep" role="separator"></div>';
  const tix = n => wowhead.tickets(n);
  function getItems(s, ssf) {
    if (!ssf && s.via === "craft") {
      const c = s.craft;
      return line(`Craft: ${qtyOf(s.items, s.item)} (${plural(c.crafts, "craft")}${c.yield > 1 ? `, ${c.yield} per craft` : ""})`)
        + `<div class="route__mats">${c.mats.map(matHtml).join("")}`
        + row("Craft total", s.cost * 10000, "route__row--total")
        + (s.ahPrice != null ? row("Buy it instead", s.ahPrice * s.items * 100, "route__row--ah") : "") + "</div>";
    }
    if (!ssf) return pair(`Buy: ${qtyOf(s.items, s.item)}`, `Total: ${UI.money(s.cost * 10000)}`);
    const m = s.item.farm.mob;
    return pair(`Kill: ${mobLink(m)}`, `${zoneLink(m)}, ${levels(m)}`, `${pct(m.chance)} drop`)
      + pair(`Until you loot: ${qtyOf(s.items, s.item)}`, `About <span class="route__qty">${kills(s.cost)}</span> kills`)
      + othersHtml(s);
  }
  const turnInSection = s =>
    line(`Complete: ${stepQuests(s).map(wowhead.questLink).join(" then ")} (${wowhead.npcLink(npcOf(s.item))}) <span class="route__qty">${s.turnIns}x</span>`)
    + pair(`Requires: ${s.item.qnt}x ${wowhead.itemLink(s.item)}`, `Rewards: ${tix(DMF.TICKET_VALUE[s.item.tier - 1])}`);
  const afterSection = s =>
    line(`You now have: ${tix(s.ticketsAfter)}`)
    + line(`${wowhead.factionLink("Reputation")}: ${rank(DMF.repText(s.repBefore))} -&gt; ${rank(DMF.repText(s.repAfter))}`);
  const othersHtml = s => s.item.farm && s.item.farm.others.length
    ? `<div class="route__meta">Also drops it:${s.item.farm.others.map(m => `<br>${mobLink(m)} (${esc(m.zone)}, ${levels(m)}, ${pct(m.chance)})`).join("")}</div>` : "";

  function routeHtml(plan, goal, needed, ssf) {
    const steps = plan.steps.map(s => `
      <li class="route__step">
        ${wowhead.itemIcon(s.item, {category: s.item.category})}
        <div class="route__text">
          <div class="route__action">${turnInSection(s)}${sep}${getItems(s, ssf)}${sep}${afterSection(s)}</div>
        </div>
      </li>`).join("");
    return `
      <p class="route__title">${ssf ? "Fewest-kills" : "Cheapest"} route to ${matIcon(goal)}${wowhead.itemLink(goal)}: ${wowhead.tickets(needed)} more for about
        <strong>${ssf ? `${kills(plan.cost)} kills` : UI.money(plan.cost * 10000)}</strong> in ${plural(plan.steps.length, "step")}.</p>
      <ol class="route__steps">
        ${steps}
        <li class="route__step route__step--final">
          ${wowhead.itemIcon(goal)}
          <div class="route__text">
            <div>Talk to ${wowhead.npcLink(DMF.TICKET_NPC)} to turn in ${wowhead.questLink({id: goal.questId, name: `${goal.tickets} Tickets - ${goal.name}`})} and enjoy your ${wowhead.itemLink(goal)}</div>
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

  // "Friendly 5999/6000" -> the standing name in purple
  const rank = t => esc(t).replace(/^([A-Za-z]+)/, '<span class="rep-rank">$1</span>');

  const money = (v, unit) => v == null ? '<span class="no-price">No price</span>' : UI.money(v * unit);

  // reputation one turn-in gives; tier 5 gives it only up to the next rank, then its "More ..." quest gives none
  function repCell(r, repBonus) {
    const gain = `+${DMF.repPerQuest(repBonus)}`;
    if (r.tier !== 5) return gain;
    const next = DMF.repText(DMF.REP_CAP[4] + 1).split(" ")[0];   // Friendly 5999/6000 is the last point before this rank
    return `${gain}<span class="left-cap rep-note" title="Gives reputation until ${esc(DMF.repText(DMF.REP_CAP[4]))}. After that the &quot;More ...&quot; quest gives tickets but no reputation.">until ${rank(next)}</span>`;
  }

  function leftCell(r) {
    if (r.turnInsLeft === Infinity) return '<span title="Never closes: after Friendly 5999 the &quot;More ...&quot; quest keeps giving tickets">No limit</span>';
    const cap = DMF.repText(DMF.REP_CAP[r.tier - 1]);
    return `<span title="The quest is offered until your reputation reaches ${esc(cap)}">${r.turnInsLeft}</span><span class="left-cap">closes at ${rank(cap)}</span>`;
  }

  // Self-found reference table cell: best mob.
  function mobCell(r) {
    if (!r.farm) return '<span class="no-price">-</span>';
    const m = r.farm.mob;
    return `${mobLink(m)}<span class="left-cap">${zoneLink(m)}, ${levels(m)}, ${pct(m.chance)} drop</span>`;
  }

  // root holds the route summary (card 3); tableRoot holds the reference table of every turn-in (its own card)
  UI.resultsTable = function resultsTable(root, tableRoot) {
    root.innerHTML = `<div class="summary tooltip" data-ref="summary" role="status" aria-live="polite"></div>`;
    tableRoot.innerHTML = `
      <div class="table-wrap tooltip">
        <table class="ah-table">
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col" class="num" data-ref="h1">Price each</th>
              <th scope="col" class="num" data-ref="h2">Cost per ticket</th>
              <th scope="col" class="num">Reputation</th>
              <th scope="col" class="num">Remaining Turn-ins</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>`;
    const body = tableRoot.querySelector("tbody");
    const summary = root.querySelector('[data-ref="summary"]');

    return {
      render(rows, plan, {goal, needed, hasPrices, level, ssf, repBonus = 0}) {
        tableRoot.querySelector('[data-ref="h1"]').textContent = ssf ? "Best mob" : "Price each";
        tableRoot.querySelector('[data-ref="h1"]').classList.toggle("num", !ssf);
        tableRoot.querySelector('[data-ref="h2"]').textContent = ssf ? "Kills per ticket" : "Cost per ticket";
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
            <td class="num">${repCell(r, repBonus)}</td>
            <td class="num">${leftCell(r)}</td>
          </tr>`).join("");
      },
    };
  };
})();
