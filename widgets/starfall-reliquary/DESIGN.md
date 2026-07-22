# Starfall Reliquary — Game Design

## Product statement

**Slug:** `starfall-reliquary`

Starfall Reliquary is a compact, polished top-down arena roguelike shmup: the player pilots a small warding craft through an ancient orbital garden, automatically firing into escalating constellations of enemies while steering through readable bullet patterns. A complete run lasts about 7–9 minutes and ends with the Reliquary Warden boss. The experience should feel immediately legible, tactile, and replayable inside an iframe, with enough build variety that two runs rarely converge.

The fantasy is “cultivate a weaponized constellation.” Visuals are original procedural Canvas 2D geometry and particles; sound is generated at runtime with WebAudio oscillators/noise. No remote assets, fetches, fonts, or media are required.

## Experience goals

1. Movement should feel precise within the first five seconds; danger is conveyed by silhouettes, telegraphs, and contrast rather than surprise contact.
2. Upgrades should create recognizable builds, not merely larger numbers. Every offered choice states its mechanical effect and any synergy.
3. Enemy mixtures should ask the player to reposition: chase pressure, lanes, encirclement, and aimed projectiles overlap without becoming visually muddy.
4. A run always has a clear arc: onboarding, rising density, elite punctuation, boss climax, win/summary or defeat/restart.
5. Keyboard and pointer/touch are first-class and can coexist. The game remains usable at 390×844 through 1280×800 and in iframe layouts.

## Core loop and run structure

The player moves continuously in a bounded arena. The equipped arsenal fires automatically at valid targets. Enemies drop **shards**; collecting enough fills an experience ring, pauses action, and presents three randomized upgrades. Each wave lasts 45 seconds, followed by a short banner/breather. Threat grows through spawn budget, mixed archetypes, enemy health, projectile count, and elites—not raw speed alone.

Run outline:

- Wave 1, “Drift”: chasers and introductory aimed shots; first upgrade arrives quickly.
- Wave 2, “Crosswind”: orbiters and lane-cutting splitters enter; one elite at the end.
- Wave 3, “Convergence”: denser mixed packs, mines, and coordinated ranged volleys.
- Wave 4, “Eclipse”: elite pair and compressed breathing room.
- Boss, “Reliquary Warden”: three telegraphed patterns and an enraged final third. Defeating it clears remaining hostile shots and ends the run in victory.

The HUD shows hull, XP/level, wave/time, score, current weapons, pause, and mute. Score rewards kills, elites, boss damage, collected shards, and a no-hit wave bonus. High score and preferences may persist locally; gameplay state never does.

## Controls

### Keyboard

The canonical harness input names and mappings are:

| Input | `KeyboardEvent.code` | `key` | Meaning |
|---|---|---|---|
| `up` | `KeyW` | `w` | Move up |
| `down` | `KeyS` | `s` | Move down |
| `left` | `KeyA` | `a` | Move left |
| `right` | `KeyD` | `d` | Move right |
| `pause` | `Escape` | `Escape` | Pause/resume |
| `interact` | `Enter` | `Enter` | Start, choose focused upgrade, restart |
| `mute` | `KeyM` | `m` | Toggle sound |

Arrow keys mirror WASD for players, but the canonical scenario vocabulary uses the mappings above. Simultaneous cardinal keys produce normalized diagonal speed. Keys prevent page scrolling only when the game owns focus.

### Pointer and touch

On the canvas, pointer/touch down creates a virtual stick anchored at the contact point; movement vector follows displacement with a dead zone and capped radius. The stick is rendered near the thumb. Pointer/touch up or cancel immediately stops that input. A second contact may activate the visible pause or mute buttons, but gameplay never requires multitouch. Mouse click-drag uses the same route. Buttons and upgrade cards use ordinary pointer/click semantics and have at least 44×44 CSS-pixel hit targets. `touch-action: none` is limited to the arena/control surfaces, not the whole document.

Keyboard selection uses left/right (and A/D) to focus one of three upgrade cards and Enter to commit. Pointer/touch directly selects a card. Focus remains visible.

## States and transitions

The authoritative lifecycle is `title → playing ↔ paused → choosing → playing → won|lost → playing`.

- **Title:** branded title, one-sentence objective, concise controls, “Begin run.” Background arena is decorative and static enough for reduced motion.
- **Playing:** simulation advances, spawns occur, weapons fire, pickups attract, audio is active when unmuted.
- **Paused:** simulation and audio clock-dependent effects stop; overlay offers Resume, Restart run, and Mute. `visibilitychange` and window blur pause safely.
- **Choosing:** simulation freezes, hostile visuals dim but remain visible, three upgrade cards appear. No enemy damage or timers advance.
- **Won/lost:** simulation freezes and WebAudio voices stop. Summary shows score, survival time, level, build, cause/outcome, best score, and Restart.

Native widget readiness is production-visible: `#widget-ready` is attached after the first usable render and `<html data-widget-state="ready">` is maintained for native render/journey checks. In the instrumented build only, `#game-ready` is attached after the first usable frame and `<html data-game-state>` reflects the lifecycle values above.

## Player, combat, and readability

The player is a luminous triangular craft with an orbiting shield arc, 100 hull, brief post-hit invulnerability, and a small collection radius. Movement accelerates rapidly but has modest damping rather than inertia-heavy drift. Contact and projectiles cause damage with a clear red hull flash, directional knock, low thump, and one short screen impulse. Damage feedback must not hide the player; the craft remains on top of particles and pickups.

Weapons acquire targets deterministically by nearest distance, then stable entity ID. Shots and enemies have explicit lifetimes and spatial bounds. Hostile projectiles use warm coral/magenta, player shots use cyan/gold, pickups use green-white, and telegraphs use outlined amber. Shape differences reinforce color.

### Starting weapon and upgrade families

The run begins with **Needle Array**, a short-cadence aimed bolt. Upgrade offerings are drawn without replacement from eligible definitions using the run RNG; at least one offer improves an owned weapon or survivability when possible. Maxed upgrades are excluded. Choices include:

- **Needle Array:** Twin Needle adds bolts, Piercing Script adds penetrations, and Quick Etching shortens the cadence. Overclock further strengthens and accelerates every bolt.
- **Orbit Blades:** each rank adds a visible persistent blade and increases contact damage. With Magnet Core, struck enemies are briefly slowed (**Harvest Ring**).
- **Comet Mortar:** each rank launches explosive comets faster, increases impact damage, and widens the blast. With Cryo Wake, the explosion chills enemies (**Thermal Shock**).
- **Prism Beam:** each rank extends the visible sweep window and increases beam width, rotation speed, and damage. Piercing Script adds beam damage (**Glass Choir**).
- **Magnet Core:** pickup radius and shard attraction; later ranks grant a small heal every fixed shard threshold.
- **Cryo Wake:** movement leaves fading slow fields; later ranks make slowed enemy deaths burst harmless chill.
- **Aegis:** one regenerating hit shield; upgrades shorten recharge and emit knockback on break.
- **Overclock:** damage/fire-rate at the cost of maximum hull, clearly disclosed.

Offers show name, icon drawn in CSS/canvas, rank, plain-language effect, and a “Synergy” ribbon only when its prerequisite is owned. A run can reach roughly 8–11 choices, enough to establish two weapon lines and a support identity.

## Enemy roster

- **Drifter:** small direct chaser; baseline pressure and clean teardrop silhouette.
- **Lancer:** pauses outside the player, shows an amber line telegraph, then dashes through the predicted position.
- **Cantor:** maintains range and fires slow aimed three-shot phrases with visible warm rings.
- **Orbiter:** circles the player before diving; creates lateral pressure and crescent silhouette.
- **Splitter:** broad, slow body that divides into two fragile sparks on death (stable IDs/order).
- **Minekeeper:** drops stationary pulsing mines with a generous fuse and ring telegraph.
- **Elite variants:** larger outlined versions with one enhanced behavior, bonus shards, never silent stat-only recolors.
- **Reliquary Warden boss:** large central mask with three attacks: rotating spoke gaps, targeted fan volleys, and summoned Drifters. Phase transitions at 66% and 33% clear a small safety radius and display an unmistakable pulse. No unavoidable damage at arena edges.

Spawn locations are selected outside a player safety radius and clamped onscreen after resize. Spawn budgets and simultaneous projectile caps prevent runaway load. Enemy contact is resolved once per invulnerability window.

## Progression, tuning, and endings

XP thresholds rise gently (`12 + level × 7`, tuned after playtest). Common enemies drop 1 shard, ranged/special enemies 2, elites 8, and boss segments bonus shards. Upgrade rarity is not a hidden power lottery: most choices are comparable, with rarer capstones gated by prerequisites. If no eligible definition remains, offer deterministic hull repair/score choices.

Target baseline: first level-up by 25 seconds, 3–4 choices by wave 2 end, boss arrival around 6:30, average first-play completion 8 minutes, and 2–4 recoverable mistakes per wave. Loss displays the immediate cause. Victory requires boss HP at zero and must be reachable through normal play. Restart fully resets entities, IDs, RNG stream, clocks, score, upgrades, and input state without page reload.

## Visual and audio direction

Canvas fills a framed arena beneath a compact HTML HUD/overlay layer. The world is a midnight indigo “orbital garden” with a procedurally drawn sparse star grid, concentric reliquary lines, and soft vignette. Entities are high-contrast geometric glyphs with thin bloom-like duplicate strokes, not raster assets. Particles are pooled and capped. CSS uses a locally defined system-font stack; `theme.css` owns semantic custom properties for both light and dark schemes and is imported exactly once by `src/main.tsx`.

Generated WebAudio uses a lazy `AudioContext` created/resumed only after user gesture. A tiny synthesizer produces restrained events: needle ticks, mortar body, shard chime, damage thump, level-up arpeggio, wave cue, victory cadence, and boss drone pulses. Master mute is always visible, defaults according to persisted preference, and is reflected by icon plus text/accessible name. Muting cancels active voices. Failure to create audio never blocks play or logs an error.

## Responsive behavior

The arena takes the largest safe rectangle, with a minimum usable height of 360 px. Desktop uses a slim HUD above the arena and a right-side build rail when space permits. Narrow portrait view stacks HUD compactly, keeps cards in a vertically scrollable modal, and reserves a thumb-safe lower zone without shrinking the simulated world to illegibility. Canvas backing size follows device pixel ratio capped at 2; world coordinates use CSS pixel dimensions and resize preserves relative positions safely. No horizontal document overflow is permitted at journey viewports 390×844, 768×1024, and 1280×800.

## Accessibility and content

- Semantic HTML controls and dialogs surround the canvas; buttons have names, keyboard focus rings, and minimum targets.
- A persistent text status (`role="status"`, polite) announces wave starts, level-up choices, pause, critical hull, victory, and defeat without narrating every kill.
- Upgrade selection is a labeled modal/dialog with focus moved inside and restored afterward. HUD values have textual labels.
- Color never carries meaning alone; projectile factions, telegraphs, health states, and upgrade types also differ by shape, line, or text.
- `prefers-reduced-motion` removes screen shake, large zooms, background drift, and particle trails, while preserving essential telegraphs at full duration. A local “Reduced effects” toggle may override and persist.
- `prefers-contrast: more` strengthens outlines and backgrounds. Sound is supplementary; mute never removes gameplay information.
- Pause occurs on loss of visibility. Touch controls do not require precision gestures.
- Content note: abstract fantasy combat, frequent projectiles, mild screen motion, brief damage flashes, and stylized enemy destruction; no gore. Flash luminance/frequency is constrained, but `CONTENT-NOTES.md` should disclose intense motion and fantasy violence.

## Architecture and ownership

The widget is self-contained under `widgets/starfall-reliquary/` with its own `package.json`, one `package-lock.json`, `widget.json`, `wrangler.jsonc`, Vite/TypeScript configuration, README, `journey.json`, source, tests, and generated `dist/` and `dist-test/`. It follows repository Preact conventions but keeps the 60 Hz simulation in framework-independent TypeScript modules.

Suggested boundaries:

- `src/main.tsx`: sole bootstrap; imports `./theme.css` exactly once and mounts the app.
- `src/App.tsx`: HTML shell, overlays, HUD, focus management, settings.
- `src/game/model.ts`: authoritative serializable run state, entity IDs, upgrades.
- `src/game/simulation.ts`: fixed-step movement, collision, spawns, weapons, progression.
- `src/game/catalog.ts`: enemy/weapon/upgrade declarative definitions.
- `src/game/input.ts`: keyboard and pointer/touch aggregation into one movement intent.
- `src/game/render.ts`: Canvas 2D drawing only; no authority over state.
- `src/game/audio.ts`: gesture-gated procedural WebAudio and mute.
- `src/game/random.ts`: seeded stream owned by run state; no incidental render RNG.
- `src/testSurface.ts`: test-build-only module selected by build-time flag and absent from production output.

Use a fixed 60 Hz accumulator with a capped catch-up count in production. The contract’s manual scheduler drives the same real animation-frame path in tests. Simulation owns all gameplay timers as frame counts or fixed-step seconds; React/Preact owns no combat timing. Rendering interpolates only if useful. Input events update held state; the simulation consumes it. Stable entity iteration and tie-breaking keep seeded runs deterministic.

## Persistence

Store only versioned preferences and summary records in `localStorage`: `starfall-reliquary:v1` containing mute, reduced-effects override, best score, and completed-runs count. Validate shape and ranges on read; corrupt or unavailable storage falls back silently. No analytics, cookies, service worker, network request, or mid-run save. Fresh scenario contexts clear storage.

## Deterministic instrumentation

Instrumentation exists only when the explicit test build flag is enabled and must be unreachable/absent in production emitted HTML and executable text. The instrumented build exposes `window.__game` with narrow methods:

- `getState()` → a read-only combat snapshot including lifecycle/player state, entities and health, unlock counters, Cryo fields, shards, Aegis cooldown, and input state
- `getScore()` → integer
- `start()` → same transition as activating Begin, for setup convenience only
- `restart()` → same reset path as the Restart control
- `setSeed(seed: number)` → allowed only on title/end state; resets the next run RNG
- `grantXp(amount: number)` → setup helper that uses normal XP/level-up logic
- `setHull(amount: number)` → setup helper with normal clamping
- `spawnEnemy(archetype: string, x?: number, y?: number)` → stable setup insertion
- `spawnShard(x: number, y: number, value?: number)` → stable pickup setup insertion
- `clearEnemies()` → remove enemies and hostile shots for isolated recharge coverage
- `setEnemyHealth(index: number, hp: number)` → put an existing foe near death so normal weapons exercise on-death effects
- `setWave(wave: number)` → setup helper that resets wave scheduler consistently
- `damagePlayer(amount: number)` → normal damage/loss path
- `damageBoss(amount: number)` → normal boss damage/victory path; requires boss present
- `getChecksum()` → stable compact checksum of authoritative state for regression assertions

Hooks arrange deterministic state but never synthesize or replace keyboard, pointer, touch, click, pause, upgrade, or restart routes required by coverage. Unknown archetypes, invalid states, or non-finite arguments throw. Test setup uses the harness-seeded `Math.random` before app load plus explicit stable IDs; runtime render effects consume a separate visual-only deterministic stream.

## Canonical scenario intent

`test/scenarios.json` must contain exactly one boot and at least one core scenario, all boot/core scenarios free of `call:` setup/actions, plus explicit coverage for keyboard, pointer, touch start/move/end/cancel, pause/resume, upgrade selection, win, loss, restart, weapon/synergy regression, boss phase, and responsive controls. Every supported event mode must traverse actual DOM/canvas handlers. Useful scenarios include:

- boot/title readiness;
- core keyboard begin + movement causing a player-position/checksum change;
- pointer drag movement and pointer release stop;
- touch drag/end movement plus a separate touch-cancel stop regression;
- pause button and Escape resume with frame invariance while paused;
- XP setup followed by real click/keyboard upgrade selection;
- forced near-loss setup followed by real movement/contact or normal damage path, then real Restart click;
- boss setup/damage to near-zero followed by normal weapon collision to reach victory;
- deterministic synergy activation and stable checksum.

## Production-visible smoke criteria

The clean production validator loads the exact offline `dist/index.html` with networking disabled and without test hooks.

- **Boot predicate:** `#widget-ready` is attached, `<html data-widget-state="ready">` is present, the visible `[data-testid="start-button"]` is enabled, the visible canvas has nonzero dimensions of at least 300×300 CSS pixels, and a sampled central canvas region contains multiple non-background colors (procedural arena/player preview rendered).
- **Core real-input predicate:** activate `[data-testid="start-button"]` by ordinary click, record a production-visible read-only player indicator `[data-player-position]` (formatted rounded `x,y`, intended for accessibility/status—not test-only), hold the canonical `KeyD`/`d` route for a bounded real-time interval, release it, and require that the indicator changes, the visible HUD wave text reads Wave 1, canvas pixels change, and no error/defeat overlay appears. This DOM indicator is legitimate player-visible assistive state and remains in production.
- Both phases require zero page errors, console errors, and network requests while offline.

## Native widget integration

`widget.json` identifies `starfall-reliquary`, worker `widget-starfall-reliquary`, hostname `starfall-reliquary.widgets.beshir.org`, Preact, `npm run build`, `dist`, static/no data sources, and embeddability. `wrangler.jsonc` matches those values. Root README’s widget index gains exactly one entry. The repository validator’s local-theme allowlist must include the slug because the native validator currently closes the list explicitly; this is an intentional shared index/validation registration, not an unrelated behavior change.

`journey.json` covers title, active play, paused, and upgrade-choice states across mobile/tablet/desktop and light/dark. The native journey may use production-visible controls and explicit `data-widget-state="ready"`; it must not depend on instrumentation. Native render, journey, widget validation, and theme audit must pass.

## Scope, performance, and failure policy

Keep all visual/audio assets procedural. Pool projectiles and particles; cap hostile projectiles around 260, player projectiles around 180, enemies around 90, and cosmetic particles around 300. Spatial hashing or a simple uniform grid handles collisions. A full run should remain responsive on a mid-range mobile device. When caps are reached, defer spawns or recycle cosmetics, never silently remove imminent hostile threats.

Out of scope: online leaderboards, accounts, multiplayer, remote telemetry, asset downloads, sprawling metagame, localization infrastructure, and save-resume. Persistence errors, WebAudio denial, and reduced Canvas features degrade gracefully without console errors.

## Acceptance criteria

1. A player can start, move, level, choose meaningful upgrades, form at least one named synergy, fight all roster roles, pause/mute, defeat the boss, lose, and restart using documented real controls.
2. Keyboard, mouse/pointer drag, touch start/move/end/cancel, buttons, and upgrade focus all work; state cannot remain stuck after blur/cancel.
3. Build presentation is legible and overflow-free at native journey viewports in light/dark, while maintaining strong game-world contrast.
4. Reduced-motion, semantic overlays, focus behavior, status announcements, non-color cues, and mute behavior satisfy the accessibility plan.
5. Test and production builds derive from the same source. Instrumentation is gated and wholly absent from production; production works directly over exact offline `file://` with no network.
6. The canonical deterministic suite covers boot, core, input modes, pause, upgrades/synergies, win, loss/restart, and regressions with unique screenshots and no browser/console failures.
7. Production validator’s static checks and boot/core real-input pixel/DOM predicates pass, as do repository widget validation, native render, journey, and theme audit.
8. All final-delivery manifest files, reports, logs, gallery images, independent reviews, provenance, content note, complete `/out/repo`, and `/out/SUMMARY.md` exist and pass before `DONE` is claimed.
