// Item picker: a dropdown whose options show the item icon and its quality colour, in every browser
// (a native <select> can't show images in Firefox/Safari). Follows the WAI-ARIA "select-only combobox"
// pattern: a button with role="combobox" and a role="listbox" popup.
//
// Keyboard: Enter/Space/Down/Up opens; Up/Down/Home/End move; Enter/Space picks; Escape/Tab closes;
// typing a letter jumps to the next item starting with it.
//
// UI.itemPicker(root, {items, value, label, onChange}) -> {value()}
//   items: [{value, name, icon, quality, noteHtml}]  (noteHtml is trusted markup shown after the name)
(() => {
  const UI = (window.UI = window.UI || {});
  let uid = 0;

  UI.itemPicker = function itemPicker(root, {items, value, labelId, onChange}) {
    const id = `item-picker-${++uid}`;
    const esc = UI.esc;
    const optionHtml = it => `
      <img class="item-picker__icon" src="${esc(DMF.ICON_URL(it.icon))}" alt="" onerror="this.style.visibility='hidden'">
      <span class="item-picker__name">${esc(it.name)}</span>
      ${it.noteHtml ? `<span class="item-picker__note">${it.noteHtml}</span>` : ""}`;

    root.innerHTML = `
      <div class="item-picker">
        <button type="button" class="item-picker__button" role="combobox" aria-haspopup="listbox"
                aria-expanded="false" aria-controls="${id}-list" aria-labelledby="${labelId} ${id}-current">
          <span class="item-picker__current" id="${id}-current"></span>
          <span class="item-picker__arrow" aria-hidden="true"></span>
        </button>
        <ul class="item-picker__list" id="${id}-list" role="listbox" aria-labelledby="${labelId}" tabindex="-1" hidden>
          ${items.map((it, i) => `
          <li class="item-picker__option" id="${id}-opt-${i}" role="option" data-index="${i}"
              data-quality="${it.quality}" aria-selected="false">${optionHtml(it)}</li>`).join("")}
        </ul>
      </div>`;

    const button = root.querySelector(".item-picker__button");
    const current = root.querySelector(".item-picker__current");
    const list = root.querySelector(".item-picker__list");
    const options = [...list.children];
    let selected = Math.max(0, items.findIndex(it => it.value === value));
    let active = selected;

    const isOpen = () => !list.hidden;

    function showSelected() {
      const it = items[selected];
      current.innerHTML = optionHtml(it);
      button.dataset.quality = it.quality;
      options.forEach((o, i) => o.setAttribute("aria-selected", String(i === selected)));
    }

    function setActive(i) {
      active = Math.max(0, Math.min(items.length - 1, i));
      options.forEach((o, j) => o.classList.toggle("is-active", j === active));
      button.setAttribute("aria-activedescendant", options[active].id);
      options[active].scrollIntoView({block: "nearest"});
    }

    function open() {
      if (isOpen()) return;
      list.hidden = false;
      button.setAttribute("aria-expanded", "true");
      root.querySelector(".item-picker").classList.add("is-open");
      setActive(selected);
    }

    function close() {
      if (!isOpen()) return;
      list.hidden = true;
      button.setAttribute("aria-expanded", "false");
      button.removeAttribute("aria-activedescendant");
      root.querySelector(".item-picker").classList.remove("is-open");
    }

    function pick(i) {
      const changed = i !== selected;
      selected = i;
      showSelected();
      close();
      button.focus();
      if (changed) onChange(items[selected].value);
    }

    // type-ahead: jump to the next item whose name starts with the typed letter
    function jumpTo(ch) {
      const c = ch.toLowerCase();
      for (let k = 1; k <= items.length; k++) {
        const i = (active + k) % items.length;
        if (items[i].name.toLowerCase().startsWith(c)) return setActive(i);
      }
    }

    button.addEventListener("click", () => (isOpen() ? close() : open()));
    button.addEventListener("keydown", e => {
      const k = e.key;
      if (!isOpen()) {
        if (["ArrowDown", "ArrowUp", "Enter", " "].includes(k)) { e.preventDefault(); open(); }
        else if (k.length === 1 && /\S/.test(k)) { open(); jumpTo(k); }
        return;
      }
      if (k === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
      else if (k === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
      else if (k === "Home" || k === "PageUp") { e.preventDefault(); setActive(0); }
      else if (k === "End" || k === "PageDown") { e.preventDefault(); setActive(items.length - 1); }
      else if (k === "Enter" || k === " ") { e.preventDefault(); pick(active); }
      else if (k === "Escape") { e.preventDefault(); close(); }
      else if (k === "Tab") { close(); }
      else if (k.length === 1 && /\S/.test(k)) { jumpTo(k); }
    });

    list.addEventListener("mousedown", e => e.preventDefault());   // keep focus on the button
    list.addEventListener("click", e => {
      const o = e.target.closest(".item-picker__option");
      if (o) pick(+o.dataset.index);
    });
    list.addEventListener("mousemove", e => {
      const o = e.target.closest(".item-picker__option");
      if (o && +o.dataset.index !== active) setActive(+o.dataset.index);
    });
    document.addEventListener("mousedown", e => { if (!root.contains(e.target)) close(); });

    showSelected();
    return {value: () => items[selected].value};
  };
})();
