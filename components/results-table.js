// Results table component: auction-house style list of the cheapest turn-ins.
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
    if (isBest) tags.push('<span class="tag tag--best">Best</span>');
    if (!r.live) tags.push('<span class="tag tag--muted" title="No Auctionator price. Scan this item at the auction house.">No AH price</span>');
    if (r.overCap) {
      tags.push(`<span class="tag tag--warn" title="Tier ${r.tier} reputation caps after ${r.untilCap} quests. Check whether turn-ins past the cap still give tickets.">Rep cap after ${r.untilCap}</span>`);
    }
    return `
      <div class="item">
        ${wowhead.itemIcon(r, {count: r.qnt, category: r.category})}
        <span class="item__name">
          <span>${wowhead.itemLink(r)}${tags.join("")}</span>
          <span class="item__meta">${esc(r.category)} &middot; Tier ${r.tier} &middot; ${questsLine(r)}</span>
        </span>
      </div>`;
  }

  const money = (v, unit) => v == null ? '<span class="no-price">No price</span>' : UI.money(v * unit);

  UI.resultsTable = function resultsTable(root) {
    root.innerHTML = `
      <div class="table-wrap">
        <table class="ah-table">
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col" class="num">Req. level</th>
              <th scope="col" class="num">Per turn-in</th>
              <th scope="col" class="num">Quests</th>
              <th scope="col" class="num">Items</th>
              <th scope="col" class="num">Total cost</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>`;
    const body = root.querySelector("tbody");

    return {
      render(rows, {limit, level, unlockLevels}) {
        if (!rows.length) {
          body.innerHTML = `<tr class="empty"><td colspan="6">No turn-ins available at level ${level} with these filters. Quests unlock at levels ${unlockLevels.join(", ")}.</td></tr>`;
          return;
        }
        body.innerHTML = rows.slice(0, limit).map((r, i) => {
          const best = i === 0 && r.total != null;
          return `
          <tr class="${best ? "is-best" : ""}">
            <td>${itemCell(r, best)}</td>
            <td class="num level-req">${r.minLevel}</td>
            <td class="num">${money(r.perTurn, 100)}</td>
            <td class="num">${r.quests}</td>
            <td class="num">${r.items}</td>
            <td class="num">${money(r.total, 10000)}</td>
          </tr>`;
        }).join("");
      },
    };
  };
})();
