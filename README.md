# DMF Turn-in Calculator

Finds the cheapest Darkmoon Faire profession turn-ins (Animal Parts, Blacksmithing,
Engineering, Leatherworking) for WoW Forever, using your own Auctionator prices.

**Website: https://theoschramm.github.io/wow-dmf-calculator/**

## Web version (GitHub Pages)

Open the [website](https://theoschramm.github.io/wow-dmf-calculator/) (or a local copy of `index.html`),
then drop in your `Auctionator.lua`:

```
World of Warcraft\_forever_\WTF\Account\<ACCOUNT>\SavedVariables\Auctionator.lua
```

The file is parsed entirely in your browser and is never uploaded.

## Command line

Needs [Node.js](https://nodejs.org) 16+. No dependencies.

```
node cli.js --target greater --tickets 10 --category Engineering --limit 5
```

Options: `--level`, `--tickets`, `--target` (a number or reward key: flower, minor, monthmutton, lesser, greater,
tonk, box, mutton, amulet, orb; default 50), `--rep`, `--strict-caps`, `--category`, `--limit`, `--realm`, `--file`.
`--help` lists every reward with its ticket cost and Wowhead link.
It finds the newest `Auctionator.lua` under `WOW_ROOT` (env var; defaults to the Classic `_forever_` WTF path).

## Code layout

- `dmf.js` is the single source of truth: item data, level requirements, Auctionator parsing and the ranking maths.
- `index.html` (web UI) and `cli.js` (terminal) are thin front-ends over it. Edit items or rules in `dmf.js` only.
- Web UI:
  - `index.html`: page skeleton (frames and mount points only).
  - `css/styles.css`: all styling. It only places real WoW Classic UI textures (dialog frames, red panel
    buttons, edit boxes, check boxes, item slots, auction rows, highlights, coins) from `assets/ui/`.
  - `assets/ui/`: those textures, built by `python tools/build-ui-textures.py` (needs Pillow) from
    [Gethe/wow-ui-textures](https://github.com/Gethe/wow-ui-textures) (`classic` branch). The script only
    crops them and rearranges border "edge files" into 9-slice images for CSS `border-image`.
    The art belongs to Blizzard Entertainment; this is a non-commercial fan tool.
  - `components/`: one file per UI piece, each a plain script that registers on `window.UI`
    (`money.js`, `file-loader.js`, `filters.js`, `results-table.js`). Plain scripts rather than ES modules,
    so `index.html` still works when opened straight from disk.
  - `app.js`: wires `dmf.js` to the components.
- `serve.js` only serves published files; add new top-level files to its `PUBLIC` list
  (files in `css/`, `components/` and `assets/ui/` are allowed automatically).

## Notes

- Prices are Auctionator's last seen minimum, so they're as fresh as your last in-game
  scan plus a `/reload` or logout (that's when WoW writes the file).
- There are no built-in prices. Items Auctionator has no price for are listed last as "No AH price",
  still showing the quests and items needed.
- Each turn-in item links its Wowhead quest(s); tier 5 has a first-time quest plus a repeatable "More ..." quest.
  Each goal is a real reward item, linked with the "N Tickets - ..." quest that redeems it.
  Item and quest IDs come from Wowhead's Forever data.

- Quest quantities, tiers, ticket values and reputation caps come from the
  [Warcraft Tavern DMF guide](https://www.warcrafttavern.com/forever/guides/darkmoon-faire/).
  Each quest gives 250 reputation and each tier caps at 500/1100/1700/2500/5999. It's unverified
  whether turn-ins past a cap still give tickets, so over-cap routes are flagged (or excluded with
  strict caps) rather than assumed.
- Tier 5 Animal Parts: Evil Bat Eyes (quest 7903) and Glowing Scorpid Blood (quest 8222) are separate
  quests, so they're separate options.

## Publishing

The site is deployed to https://theoschramm.github.io/wow-dmf-calculator/ by GitHub Actions
(`.github/workflows/pages.yml`) on every push to `main`; it can also be run by hand from the Actions tab.
Only the site files are published (`index.html`, `app.js`, `dmf.js`, `css/`, `components/`, `assets/`).
Pages source must be set to "GitHub Actions" (Settings > Pages).
