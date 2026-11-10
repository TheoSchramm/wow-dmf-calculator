// Results component: a one-sentence answer, then an auction-house style list of every turn-in option,
// cheapest first.
(() => {
  const UI = (window.UI = window.UI || {});
  const {esc, wowhead} = UI;

  function questsLine(r) {
    const links = r.questList.map(wowhead.questLink);
    return links.length > 1
      ? `Quests: ${links[0]}, then repeat ${links.slice(1).join(", ")}`
      : `Quest: ${links[0]}`;
  }

  function itemCell(r, isBest) {
    const tags = [];
    if (isBest) tags.push('<span class="tag tag--best">Cheapest</span>');
    if (!r.live) tags.push('<span class="tag tag--muted" title="Your Auctionator file has no price for this item. Search for it at the auction house, then /reload.">No price yet</span>');
    return `
      <div class="item">
        ${wowhead.itemIcon(r, {category: r.category})}
        <span class="item__name">
          <span>${wowhead.itemLink(r)}${tags.join("")}</span>
          <span class="item__meta">${r.qnt} per turn-in to ${esc(r.npc)} &middot; ${questsLine(r)}</span>
        </span>
      </div>`;
  }

  const money = (v, unit) => v == null ? '<span class="no-price">No price</span>' : UI.money(v * unit);

  UI.resultsTable = function resultsTable(root) {
    root.innerHTML = `
      <div class="summary tooltip" data-ref="summary" role="status" aria-live="polite"></div>
      <div class="table-wrap">
        <table class="ah-table">
          <thead>
            <tr>
              <th scope="col">Item to buy</th>
              <th scope="col" class="num">Price each</th>
              <th scope="col" class="num">How many to buy</th>
              <th scope="col" class="num">Times to turn in</th>
              <th scope="col" class="num">Total cost</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>`;
    const body = root.querySelector("tbody");
    const summary = root.querySelector('[data-ref="summary"]');

    return {
      render(rows, {goal, needed, hasPrices}) {
        if (needed <= 0) {
          summary.innerHTML = `You already have enough tickets for ${wowhead.itemLink(goal)}. Take them to Gelvas Grimegate at the Darkmoon Faire.`;
          body.innerHTML = "";
          return;
        }
        const best = rows.find(r => r.total != null);
        if (!hasPrices) {
          summary.textContent = "Load your Auctionator.lua in step 1 to see which turn-in is cheapest.";
        } else if (best) {
          summary.innerHTML = `Cheapest way: buy <strong>${best.items} &times; ${wowhead.itemLink(best)}</strong>
            for about ${UI.money(best.total * 10000)}, then turn them in to <strong>${esc(best.npc)}</strong>
            ${best.quests} time${best.quests === 1 ? "" : "s"} for ${wowhead.tickets(needed)} more.`;
        } else {
          summary.textContent = "None of these items has a price in your Auctionator file yet. Search for them at the auction house, then /reload.";
        }

        body.innerHTML = rows.map(r => {
          const isBest = r === best;
          return `
          <tr class="${isBest ? "is-best" : ""}">
            <td>${itemCell(r, isBest)}</td>
            <td class="num">${money(r.price, 100)}</td>
            <td class="num">${r.items}</td>
            <td class="num">${r.quests}</td>
            <td class="num">${money(r.total, 10000)}</td>
          </tr>`;
        }).join("");
      },
    };
  };
})();
