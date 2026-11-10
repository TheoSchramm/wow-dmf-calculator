// Money component: renders a copper amount as gold / silver / copper coins, vanilla style.
// Plain script (no modules) so index.html still works when opened straight from disk.
(() => {
  const UI = (window.UI = window.UI || {});

  UI.money = function money(copper) {
    const total = Math.max(0, Math.round(copper));
    const g = Math.floor(total / 10000);
    const s = Math.floor((total % 10000) / 100);
    const c = total % 100;
    const parts = [];
    if (g) parts.push(`<span class="money__part money__part--gold">${g.toLocaleString()}</span>`);
    if (s || (g && c)) parts.push(`<span class="money__part money__part--silver">${s}</span>`);
    if (c || !parts.length) parts.push(`<span class="money__part money__part--copper">${c}</span>`);
    const label = `${g ? g + " gold " : ""}${s ? s + " silver " : ""}${c ? c + " copper" : ""}`.trim() || "0 copper";
    return `<span class="money" title="${label}">${parts.join("")}</span>`;
  };
})();
