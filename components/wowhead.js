// Wowhead helpers shared by the components: item icon (in a slot frame), item link and quest link.
// Links point at Wowhead's Forever pages, so Wowhead's tooltip script shows in-game tooltips on hover.
(() => {
  const UI = (window.UI = window.UI || {});

  const esc = s => String(s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));

  UI.esc = esc;

  UI.wowhead = {
    // Icon in a UI-Quickslot2 frame; the first letter shows if the icon can't load (e.g. offline).
    // size "large" uses Wowhead's 56px icon in a bigger slot frame (reward showcase).
    itemIcon(item, {count = "", category = "", size = "medium"} = {}) {
      return `<a class="item__icon${size === "large" ? " item__icon--large" : ""}" href="${esc(DMF.WOWHEAD_ITEM_URL(item.id))}" target="_blank" rel="noopener"
          data-category="${esc(category)}" tabindex="-1" aria-hidden="true">
          ${esc(item.name[0])}
          <img src="${esc(DMF.ICON_URL(item.icon, size))}" alt="" loading="lazy" onerror="this.remove()">
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
    npcLink(npc) {
      return `<a class="npc-link" href="${esc(DMF.WOWHEAD_NPC_URL(npc.id))}" target="_blank" rel="noopener">${esc(npc.name)}</a>`;
    },
    questLink(quest) {
      return `<a class="quest-link" href="${esc(DMF.WOWHEAD_QUEST_URL(quest.id))}" target="_blank" rel="noopener"><span class="quest-link__icon" aria-hidden="true"></span>${esc(quest.name)}</a>`;
    },
  };
})();
