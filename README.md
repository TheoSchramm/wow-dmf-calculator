<p align="center">
  <img src="docs/logo.png" width="192" height="192" alt="Darkmoon Faire Prize Ticket in a gold ring">
</p>

# DMF Turn-in Calculator

Finds the cheapest Darkmoon Faire profession turn-ins (Animal Parts, Blacksmithing,
Engineering, Leatherworking) for WoW Forever, using your own Auctionator prices.

**Website: https://theoschramm.github.io/wow-dmf-calculator/**

![The calculator with an Auctionator file loaded: your character, the reward goal and the cheapest turn-ins](docs/screenshots/overview.png)

Hover any item or quest for its in-game tooltip (from Wowhead):

![Wowhead in-game tooltip shown when hovering an item](docs/screenshots/tooltip.png)

## Web version

Open the [website](https://theoschramm.github.io/wow-dmf-calculator/) and drop in your `Auctionator.lua`
(scan the auction house in game first, then `/reload`):

```
World of Warcraft\_forever_\WTF\Account\<ACCOUNT>\SavedVariables\Auctionator.lua
```

The file is read in your browser and never uploaded. The prices this tool uses and your choices (reward, level,
tickets, reputation, realm, professions) are saved in your browser, so a refresh doesn't need the file again.
"Forget saved prices" deletes them.

The page has four cards:

1. **Load your prices**
2. **Configure your run**: reward, level, tickets you have, reputation, self-found mode, professions.
3. **Get the items and turn in**: the cheapest route, step by step.
4. **All turn-ins**: every turn-in with its price, cost per ticket, reputation and turn-ins left.

Each turn-in gives 250 reputation, and tier 1-4 quests close at Neutral 500 / 1100 / 1700 / 2500, so the cheap
tiers can only be used a few times and come first. Tier 5 never closes, but after Friendly 5999 it gives tickets
without reputation.

## Command line

Needs [Node.js](https://nodejs.org) 16+. No dependencies.

```
node cli.js --target greater --tickets 10 --category Engineering --limit 5
```

Options: `--level`, `--tickets`, `--target` (a number or reward key), `--rep` (points from Neutral 0, so Friendly 0 =
3000), `--prof`, `--gather`, `--ssf`, `--strict-caps`, `--category`, `--limit`, `--realm`, `--file`.
`--help` lists every reward with its ticket cost. Without `--file` it uses the newest `Auctionator.lua` under
`WOW_ROOT`.

## Crafting

Tick your professions in step 2 (CLI: `--prof Engineering:260,Leatherworking`; skill defaults to 300). A turn-in then
costs the cheaper of its auction price and its materials, and the route says "Craft ...". Vendor-sold materials use
the lower of the auction and vendor price. Anything without a price shows "Materials not priced". Recipes needing more
skill than you have are skipped (skill values come from wiki.gg Classic, not confirmed for Forever).

Tick the gathering counterpart (Mining for Blacksmithing and Engineering, Skinning for Leatherworking; CLI:
`--gather Mining,Skinning`) and bars are priced as the cheaper of the auction price and smelting the ore (Cured Light
Hide from Light Hide + Salt). The ore still needs an Auctionator price.

## Self-found mode

Tick "Self-found" (CLI: `--ssf`) to farm instead of buying. The planner minimises expected kills, picking the best
drop chance among mobs up to 2 levels above you. Only Animal Parts drop from mobs, so crafted turn-ins are left out.
Drop chances come from Wowhead Forever's data (normal open-world mobs, at least 100 recorded loots).

To refresh the data, install `tools/wowhead-drops.user.js` in Tampermonkey, open the six Animal Parts item pages on
Wowhead Forever, click "Save drops", then "Copy all" and save the JSON as `tools/results.json`. Then run
`node tools/build-drops.js`. Recipes are regenerated with `node tools/build-recipes.js`.

## Code layout

- `dmf.js`: single source of truth (data, Auctionator parsing, maths), shared by the site and the CLI.
- `index.html`, `app.js`, `components/`, `css/`: the web UI, as plain scripts (works from `file://`).
- `cli.js`: the terminal front-end. `serve.js`: local server for the published files.
- `assets/ui/`: WoW Classic UI textures from [Gethe/wow-ui-textures](https://github.com/Gethe/wow-ui-textures),
  built by `python tools/build-ui-textures.py` (needs Pillow). The art belongs to Blizzard Entertainment; this is a
  non-commercial fan tool.

## Notes

- Prices are Auctionator's last seen minimum, as fresh as your last in-game scan plus a `/reload`.
- Quest quantities, tiers, ticket values and reputation caps come from the
  [Warcraft Tavern DMF guide](https://www.warcrafttavern.com/forever/guides/darkmoon-faire/) and
  [Wowpedia](https://wowpedia.fandom.com/wiki/Darkmoon_Faire_(Classic)). Reputation per quest is not fully verified
  for Forever; `REP_PER_QUEST` / `REP_CAP` in `dmf.js` are easy to change.
- Item, quest and recipe IDs come from Wowhead's Forever data.

## Publishing

GitHub Actions deploys the site on every push to `main` (`.github/workflows/pages.yml`). Pages source must be
"GitHub Actions".
