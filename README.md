# SPEARHEAD // Tactical Kinetic Simulator v2

**FUTURELAB R&D prototype · Matthews Operations Lab**

A mobile-first small-unit tactics and TCCC (Tactical Combat Casualty Care) training game. Players lead a fireteam through six live-fire problems, each built to teach one idea through play rather than instructions.

**Play:** open `index.html` through GitHub Pages. The original v1 build is kept at [`legacy.html`](legacy.html).

## Controls (touch first)
| Gesture | Does |
|---|---|
| Drag from a soldier | Draw their route. Time slows while you draw. The route snaps to the nearest cover; the shield shows full / half / no cover |
| Tap ground | Move the selected soldier |
| Tap an enemy | Whole team focuses fire |
| Tap a wounded soldier | Send the medic (or the selected soldier) to help |
| Long-press ground | Set the selected soldier's sector of fire |
| Drag empty ground / pinch | Pan / zoom (camera follows the squad otherwise) |
| SLOW-MO button | Toggle ¼ speed |
| Action bar | Hold, Frag, 40mm, Smoke, Flare, Breach, Drag/Drop casualty |

Desktop: mouse works the same, plus wheel zoom, `Space` slow-mo, `1-9` select, `P` pause.

## Missions
1. **Eyes Open**: cover vs. concealment, line of sight, sectors
2. **Suppress & Flank**: fire and maneuver against a machine-gun nest
3. **Breach & Clear**: the fatal funnel, breaching charges, frag before entry
4. **Night Redoubt**: sectors of fire in a 360° defense, flares, night vision
5. **Care Under Fire**: TCCC phases: tourniquet under fire, drag to cover, MARCH, CASEVAC
6. **Corridor Exfil**: urban bounding, smoke, an armed technical

Each awards up to 3 stars (win · no KIA · mission challenge). The debrief generates an After Action Review from what actually happened (hits taken in the open, care attempted under fire, MARCH order errors, suppressed and flanking kills, doorway hits).

## Systems
- **Line of sight & fog of war**: ray-cast visibility polygons per soldier; walls cast shadows, smoke and deep brush block sight.
- **Cover**: per-shot cover check (full/half) against the shooter's direction; cover nodes drive both friendly route-snapping and enemy AI.
- **Suppression**: near misses build suppression; suppressed units shoot worse, move slower, and get pinned. The Team Leader rallies nearby troops.
- **Enemy AI**: seeks cover against the known threat, bounds forward while allies fire, flankers swing wide, snipers relocate and telegraph with a laser glint, morale breaks into retreats, muzzle flashes give positions away.
- **Units**: Team Leader, Rifleman, Automatic Rifleman, Grenadier, Designated Marksman, Combat Medic, Breacher vs. Rifleman, Machine Gunner, RPG Gunner, Sniper, Flanker, Technical.
- **Squad builder**: points budget, roles, armor / optic / extra-kit loadouts.
- **TCCC model**: casualties bleed out on a timer; Care Under Fire allows only a tourniquet; Tactical Field Care (medic, no effective fire) runs the MARCH sequence; stable casualties are carried to the LZ for CASEVAC.
- **Sandbox editor**: draw walls, sandbags, brush, buildings with doors, place enemies, squad start and exfil, toggle night, then test-play.

## Code
Plain HTML/CSS/JS, no build step, no dependencies.
```
index.html   css/style.css
js/util.js    math, geometry, A* pathfinding
js/data.js    weapons, units, loadouts, missions, field manual
js/world.js   map, nav grid, cover nodes, LoS, visibility polygons
js/sim.js     perception, combat, suppression, AI, TCCC, objectives
js/render.js  oblique top-down renderer, fog of war, FX
js/input.js   touch/mouse gestures
js/ui.js      menus, HUD, MARCH panel, debrief, settings
js/editor.js  sandbox editor
js/audio.js   synthesized sound
```

> Training game. It simplifies tactics and medicine to teach decision-making and is not a substitute for certified TCCC or tactics instruction. Medical content summarizes the CoTCCC guidelines (January 2024 edition).
