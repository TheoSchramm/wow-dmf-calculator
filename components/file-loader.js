// File loader component: drop zone / file picker for Auctionator.lua, the copyable
// WTF folder path for the Windows file dialog, and a tooltip-style status line.
(() => {
  const UI = (window.UI = window.UI || {});

  UI.fileLoader = function fileLoader(root, {path, onFile, onForget}) {
    root.innerHTML = `
      <div class="loader">
        <label class="drop-zone" data-ref="drop">
          <span class="slot" aria-hidden="true"></span>
          <span class="drop-zone__text">
            <span class="drop-zone__title" data-ref="title">Drop <code>Auctionator.lua</code> here, or click to choose</span>
            <span class="drop-zone__hint">Read in your browser only. Nothing is uploaded. The prices are kept in this browser, so you only load it again to refresh them.</span>
          </span>
          <input data-ref="file" type="file" accept=".lua,text/plain" class="sr-only">
        </label>

        <div class="sep" aria-hidden="true"></div>
        <div class="field">
          <span class="field__label">In the file dialog, paste this folder, then open your account folder and <code>SavedVariables</code></span>
          <div class="path-row">
            <input data-ref="path" class="input input--path" type="text" readonly spellcheck="false" aria-label="Folder path">
            <button data-ref="copy" type="button" class="button">Copy path</button>
          </div>
          <p data-ref="copied" class="copy-feedback" aria-live="polite"></p>
        </div>

        <div class="sep" aria-hidden="true"></div>
        <div data-ref="status" class="tooltip" role="status" aria-live="polite"></div>
        <button data-ref="forget" type="button" class="button" hidden>Forget saved prices</button>
      </div>`;

    const ref = name => root.querySelector(`[data-ref="${name}"]`);
    const drop = ref("drop"), fileIn = ref("file"), pathBox = ref("path");
    const defaultTitle = ref("title").innerHTML;

    pathBox.value = path;
    pathBox.onfocus = pathBox.onclick = () => pathBox.select();

    ref("copy").onclick = async () => {
      let ok = false;
      pathBox.focus();
      pathBox.select();
      pathBox.setSelectionRange(0, path.length);
      try { ok = document.execCommand("copy"); } catch (e) { /* fall through */ }
      if (!ok) { try { await navigator.clipboard.writeText(path); ok = true; } catch (e) { /* ignore */ } }
      ref("copied").textContent = ok
        ? "Copied. Paste it into the file name box of the file dialog."
        : "Could not copy. The path is selected, press Ctrl+C.";
    };

    ref("forget").onclick = () => onForget && onForget();
    const take = file => file && onFile(file);
    fileIn.onchange = () => take(fileIn.files[0]);
    drop.ondragover = e => { e.preventDefault(); drop.classList.add("is-over"); };
    drop.ondragleave = () => drop.classList.remove("is-over");
    drop.ondrop = e => {
      e.preventDefault();
      drop.classList.remove("is-over");
      take(e.dataTransfer.files[0]);
    };

    return {
      setStatus(message, kind = "") {
        const status = ref("status");
        status.textContent = message;
        status.className = "tooltip" + (kind ? ` tooltip--${kind}` : "");
      },
      setSaved(saved) { ref("forget").hidden = !saved; },
      setLoaded(fileName) {
        drop.classList.toggle("is-loaded", !!fileName);
        if (fileName) ref("title").textContent = `${fileName} loaded. Drop another file to replace it.`;
        else ref("title").innerHTML = defaultTitle;
      },
    };
  };
})();
