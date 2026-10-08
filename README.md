# Laker Quest

A 16-bit style game, in the style of Earthbound, that takes place on Grand Valley State University's Allendale campus.  Campus made from OpenStreeMap data.

At midnight the Cook Carillon rang thirteen times, out of tune, and since then campus has been strange. Squirrels pick fights, overdue books fly around the library, and the geese are worse than usual. Find out what's going on in the tower.

## Running it

For local:

```sh
cd laker_quest
python3 -m http.server 8000
# then visit http://localhost:8000
```

Otherwise, use the Github Pages link:

https://irawoodring.github.io/laker_quest

## Publishing on GitHub Pages

`.github/workflows/pages.yml` publishes the game to GitHub Pages every time `main` changes. One-time setup: in the repo on GitHub, go to **Settings → Pages** and set **Source** to **GitHub Actions**. After that, each push or merge to `main` redeploys automatically; the **Actions** tab shows progress and the site's address. You can also rerun a deploy by hand from **Actions → Deploy to GitHub Pages → Run workflow**.

## Controls

| Key | Action |
| --- | --- |
| Arrow keys / WASD | Walk |
| Shift | Run |
| Z / Enter / Space | Talk, check, confirm |
| X / Esc | Menu, back |
| M | Campus map |

Save by checking a phone (in Kirkhof, Zumberge, the Fieldhouse, your dorm, and a few other places) and calling home.

## Side quests

Besides the main story there are seven side quests. Open the menu (X) and choose **Quests** to see what you've picked up and what's next.

| Quest | Who gives it | What to do |
| --- | --- | --- |
| Goose Diplomacy | Groundskeeper at Zumberge Pond | Defeat 3 Ornery Geese |
| The Lost Lakercard | Student in Kirkhof | Find the Lakercard by the Transformational Link |
| Overdue Notice | Librarian (after you get the Carillon Score) | Defeat 4 Overdue Books |
| Fourth and Long | Coach in the Fieldhouse (after the bat) | Find the game ball on Lubbers Field |
| River Coffee | Angler on the Grand River | Bring a Coffee |
| Pizza Run | Neighbor in Allendale | Bring a Pizza Slice |
| Laker Passport | Tour Guide at the Alumni House (after the orientation) | Collect stamps at the Cook Carillon, Zumberge Pond and Lubbers Stadium |

### Adding a quest

Quests live in `src/quests.js`. Each quest is one entry in `LQ.QUESTS` with a title, the NPC who gives it, a goal line per step, a reward, and a `talk(g, q)` function for what the giver says at each step. The comment at the top of that file lists the helpers you can use: start a quest, move it to the next step, count enemies beaten since it started, check for and take items, and pay the reward. Items to find on the map go in `LQ.PICKUPS`; a pickup appears only while its quest is on the right step, and walking over it picks it up.

To give a quest to a new character, add the NPC to `LQ.NPCS` in `src/data.js` (use `img` for a spot on GVSU's campus map image or `tile` for a map tile) and point the quest's `giver` at its id.

## Earthbound mechanics

- **Rolling HP meter.** Damage drains your HP meter gradually instead of all at once. If you take mortal damage, you can still survive by winning before the meter reaches zero.
- **Psychedelic battle backgrounds.** Each enemy has its own palette-cycling background with scanline distortion.
- **Visible enemies.** Enemies wander the map and chase you on sight. If you touch one from behind, you get a free turn; if it catches you from behind, it gets one.
- **Instant wins.** Once you're far stronger than an enemy, it runs from you, and catching it wins the fight instantly.
- **SMAAAASH!!** Bash attacks can land critical hits.
- **PSI.** You learn PSI as you level up: Lifeup, PSI Laker, and Shield.

## The campus

The campus map is built from [OpenStreetMap](https://www.openstreetmap.org) data by `tools/osm_to_map.py`. It draws real building footprints, roads, footpaths, parking lots, ponds, streams, the Grand River, woods, sports fields, Lubbers Stadium (field and bleachers), the Transformational Link arch and The Meadows golf course into tiles about 9 meters across. The map covers from just north of Lake Michigan Drive (M-45) south to Luce Street, and from Allendale (around 48th Ave) east across the Grand River. The output is `src/campus_map.js`, 362×303 tiles with 404 buildings, 104 of them named.

GVSU's official campus map, the image with the A–F / 1–9 grid, is used for two things:

- **Parking permit colors**, which OpenStreetMap doesn't have.
- **Placement.** Signs, NPCs and enemy areas in `src/campus.js` and `src/data.js` are written in pixel coordinates on that image. The converter lines the image up with the OSM buildings and stores the conversion as `imgAffine` in `campus_map.js`.

Map data © OpenStreetMap contributors, available under the [Open Database License](https://www.openstreetmap.org/copyright).

### Editing the map

`src/campus_map.js` has one line per row of tiles, with the row number in a comment and a tile legend at the top. To change a tile, change its character. Buildings are the connected groups of `B` tiles, so adding, removing or reshaping `B`s changes the building; walls, roofs and doors are worked out when the game loads. Building names are listed under `buildings`. Each one names the building that contains its `at` tile, and can set a `style` (`house`, `shop`, `stone`, `glass`, `modern`, `brick`).

Rerunning the converter overwrites hand edits, so make lasting changes in `tools/osm_to_map.py` or keep a copy.

To regenerate the map (needs Pillow and numpy), export the area from openstreetmap.org (Export → choose the area → Export), then:

```sh
python3 tools/osm_to_map.py map.osm --campus-image allendale_campus_map.jpg --preview preview.png
```

`--campus-image` is optional; without it, lots are plain gray and image-coordinate placement isn't updated. Neither the `.osm` export nor the campus map image is included in the repo.

`tools/trace_map.py` is the older approach. It builds the map by tracing the campus map image alone and writes the same file format.

## Code layout

| File | What's in it |
| --- | --- |
| `src/font.js` | Hand-drawn 5×7 bitmap font |
| `src/engine.js` | Input, sprite helpers, window frames, sound effects |
| `src/sprites.js` | Character template and enemy pixel art |
| `src/campus_map.js` | The campus tile map, one row per line, plus building names (generated by `tools/osm_to_map.py`, editable by hand) |
| `src/campus.js` | Signs, interiors and map labels, placed in campus map coordinates |
| `src/world.js` | Builds the playable map; draws tiles, buildings of any shape, trees and furniture |
| `src/data.js` | Stats, items, PSI, enemies, NPC dialogue, interiors |
| `src/quests.js` | Side quests and items to find on the map |
| `src/battle.js` | Battle system and animated backgrounds |
| `src/game.js` | Game states (splash, title, overworld, battle, ending), menus, saving |
| `assets/` | The Laker Game Labs logo for the splash screen |

All game art is drawn in code. The only image file is the Laker Game Labs logo shown on the splash screen, `assets/laker-game-labs.png`.
