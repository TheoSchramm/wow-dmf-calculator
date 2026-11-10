// Wowhead helpers shared by the components: item icon (in a slot frame), item link and quest link.
// Links point at Wowhead's Forever pages, so Wowhead's tooltip script shows in-game tooltips on hover.
(() => {
  const UI = (window.UI = window.UI || {});

  const esc = s => String(s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));

  UI.esc = esc;

  UI.wowhead = {
    // Icon in a UI-Quickslot2 frame; the first letter shows if the icon can't load (e.g. offline).
    itemIcon(item, {count = "", category = ""} = {}) {
      return `<a class="item__icon" href="${esc(DMF.WOWHEAD_ITEM_URL(item.id))}" target="_blank" rel="noopener"
          data-category="${esc(category)}" tabindex="-1" aria-hidden="true">
          ${esc(item.name[0])}
          <img src="${esc(DMF.ICON_URL(item.icon))}" alt="" loading="lazy" onerror="this.remove()">
          ${count !== "" ? `<span class="item__count">${esc(count)}</span>` : ""}
        </a>`;
    },
    itemLink(item, className = "") {
      return `<a class="item__title q${item.quality} ${className}" href="${esc(DMF.WOWHEAD_ITEM_URL(item.id))}" target="_blank" rel="noopener">${esc(item.name)}</a>`;
    },
    // A ticket amount as "<n> [Darkmoon Faire Prize Ticket icon]"; the icon reads as "tickets" for screen readers.
    tickets(n) {
      return `<span class="tickets">${esc(n)}<img class="tickets__icon" src="${esc(DMF.ICON_URL("inv_misc_ticket_darkmoon_01", "small"))}"
          alt=" tickets" title="Darkmoon Faire Prize Ticket" onerror="this.replaceWith(' tickets')"></span>`;
    },
    questLink(quest) {
      return `<a class="quest-link" href="${esc(DMF.WOWHEAD_QUEST_URL(quest.id))}" target="_blank" rel="noopener">${esc(quest.name)}</a>`;
    },
  };
})();
