# Goblin Courier — player-facing overhaul contract

## Experience and fantasy

Goblin Courier is a compact 5–10 minute top-down delivery run. The player is an unmistakable green goblin messenger with long ears, a satchel, and a bright parcel/charm strapped to their back. The immediate promise is spatial and concrete: pick up the glowing parcel, follow the marked courier route through visible doors, survive the keep, and deliver it at the destination gate before the delivery clock expires.

No player-facing copy may mention implementation or content accounting such as “authored rooms,” room indexes, scenario language, or internal route design. The title treatment must read as expressive pixel fantasy, and the title/pause surfaces must include a compact unobtrusive Credits disclosure naming Kenney Tiny Dungeon and Kenney Fonts/assetsdb. Exact files, source archives/IDs, retrieval, modifications, licenses, and dependency provenance belong in `THIRD_PARTY.md`.

## Core loop and onboarding

1. Start on a title card that communicates goblin, parcel, courier route, destination, controls, and delivery clock.
2. In the threshold, walk to the visible glowing parcel and press Use / E only when its proximity prompt appears.
3. Parcel state changes visibly from `WAITING` to `CARRIED`; the sprite gains its parcel/satchel marker, the route marker points to a now-unlocked visible door, and the objective text changes to “Reach the marked door.”
4. Approach the door and use it. Doors are present in every room, visually locked/unlocked, and expose a contextual prompt only within interaction range. E outside a target’s range never advances.
5. Move, SHOOT, brace, and dash through threats; choose safe/fast routes, upgrades, hazards, shrine, Warden, and final destination.
6. Deliver at the visibly marked destination before the fair visible clock reaches zero, or lose and restart.

The first room must contain the parcel, a clearly visible door, route/destination signage, objective text, and enough spatial separation to teach movement plus proximity. It does not require combat because its meaningful interaction is pickup and exit; the first combat room follows immediately.

## Controls and focus ownership

These logical names and `KeyboardEvent.code` mappings are canonical for scenarios and runtime:

| Logical input | Codes | Player label |
| --- | --- | --- |
| `up` | `ArrowUp`, `KeyW` | Move up |
| `down` | `ArrowDown`, `KeyS` | Move down |
| `left` | `ArrowLeft`, `KeyA` | Move left |
| `right` | `ArrowRight`, `KeyD` | Move right |
| `dash` | `Space` | DASH |
| `shoot` | `KeyF` | SHOOT / F |
| `brace` | `KeyJ` | BRACE / J |
| `interact` | `KeyE` | USE / E |
| `pause` | `Escape` | PAUSE |
| `mute` | `KeyM` | SOUND |

“Toss” must not appear player-facing. A clean internal migration from `toss` to `shoot` is preferred in simulation, controls, IDs, events, upgrades, scenarios, and hooks rather than compatibility aliases.

The play surface is focusable with `tabindex="0"`; Start and direct play-surface clicks focus it. While lifecycle state is `playing` and the event target is not editable/control content, mapped gameplay keydown/keyup handlers run in capture phase and call both `preventDefault()` and `stopImmediatePropagation()`. This claims keys ahead of Vimium-like listeners. Discrete actions ignore repeat. Title, pause, choosing, won/lost, buttons, inputs, textareas, selects, and contenteditable regions are not hijacked. Visibility loss pauses; held inputs clear on pause/blur/visibility loss so movement cannot stick.

## Pointer and touch

Pointer and raw touch IDs remain independent. `#joystick-zone` owns movement; action controls are `#dash-button`, `#shoot-button`, `#brace-button`, and `#interact-button`. Down/start fires SHOOT, DASH, and USE once; BRACE remains held until matching up/end/cancel. Cancellation clears only its identifier, and simultaneous movement plus action works. Clicking/tapping the stage focuses it without interfering with controls. Touch targets remain usable at compact mobile sizes and do not cover objectives, HUD, prompts, or the player.

## States, clock, and pause

Lifecycle states are `title`, `playing`, `paused`, `choosing`, `won`, and `lost`. Title starts the run; pause/resume is explicit; upgrade selection freezes play; delivery wins; HP depletion, overload limit, or clock expiry loses.

The delivery clock is a real, always-visible playing-state HUD value, tuned for a fair 5–10 minute run. It advances only from deterministic simulation frames while `playing`. It freezes during explicit pause, upgrade choice, document-hidden automatic pause, and all non-playing states. Visibility pause presents a clear paused state on return. Expiry creates an explicit “DELIVERY LATE” loss, never a silent failure. The HUD uses whole seconds or `M:SS`, warns structurally as well as by color, and deterministic scenarios prove decrement, pause freeze, visibility freeze, and expiry.

## World, progression, and spatial gating

The existing eleven-room branch-sensitive run is preserved, but room numbering is never exposed. Every room defines explicit interactables with position, radius, label, locked reason, and destination. Doors/exits are drawn regardless of state, with distinct locked/unlocked geometry plus text/icon status. Interact considers only an in-range current target; combat, parcel, lever, key, chest, route, and boss conditions determine lock state. A route arrow/sign and concise objective indicate the next destination without solving combat for the player.

The threshold teaches pickup and door. Dust Gallery teaches SHOOT against visible enemies. Junctions expose spatial safe/fast exits. Lever, chest, storeroom, shrine, hazard, Warden, and delivery interactions retain their deeper mechanics. Safe route can yield two upgrades; fast route trades upgrades for pressure. Final delivery requires the carried parcel at the destination interactable.

## Combat, SHOOT, dash, and feedback

SHOOT / F emits a bright, high-contrast projectile from the goblin’s facing direction, with muzzle flash, trail, hit spark, enemy damage feedback, charge/cooldown HUD, and an early objective prompt. Player projectile and hostile projectile silhouettes/colors differ without relying on color alone. Grunt, Weaver, Sentinel, Warden patterns, instability/overload, rune shelter, cracked floor, upgrades, and boss phases remain readable.

Dash is a stateful multi-frame directional move, never an instantaneous coordinate jump. From rest it uses the last facing direction. It has anticipation frames, eased travel frames, recovery, invulnerability window, at least two afterimages/trail samples, and explicit ready/recharging HUD feedback. Reduced motion keeps the same travel and timing but substitutes restrained static afterimages for flashing/pulsing effects. Scenarios query phase, displacement across multiple stepped frames, trail count, and cooldown rather than accepting endpoint-only teleportation.

## HUD and messages

HUD resources and instructional messaging occupy separate non-overlapping regions. The resource HUD contains HP, delivery clock, parcel state, DASH state/charges, SHOOT charges, instability, and boss status where relevant. A dedicated objective/message region sits outside the HUD footprint and uses `aria-live="polite"`; contextual proximity prompt is a separate element close to the lower playfield but clear of touch controls. Compact layouts may reflow, never overlap or hide values.

No surface may display `Room N/M`, “authored,” test vocabulary, or countdown claims disconnected from the clock. Canvas flavor text must not duplicate/overlap DOM HUD or messages.

## Audiovisual direction and assets

Use Canvas2D pixel composition over Kenney Tiny Dungeon CC0 tiles where suitable. Compose the player in code from readable layers: green head/body, long pointed ears, contrasting courier cap/scarf, satchel strap, parcel/charm with seal/glow, facing pose, walk frames, shooting pose, dash anticipation/travel/recovery, and afterimages. The silhouette must remain identifiable at native and compact scale. Doors use heavy frames, colored lock plate plus lock/unlock glyph/text, and route pennants. The title uses the bundled Kenney pixel font with layered shadow/highlight, banner/route motif, and goblin/parcel visual mark.

Procedural audio may support pickup, unlock, shoot, dash, hit, warning, and delivery, but audio is optional and mute-safe. Avoid intense flashing; combat violence is mild fantasy projectiles/impact, documented in `CONTENT-NOTES.md`.

## Accessibility, embedding, persistence

Keyboard, pointer, touch, mute, focus-visible, system and explicit reduced motion, high-contrast text, non-color cues, and readable narrow layouts are required. Canvas has a useful accessible label; changing objective/prompt/state is mirrored in DOM. Pause and credits are keyboard reachable. The widget remains self-contained offline, supports parent resize messaging, and preserves production isolation from test instrumentation and network access.

Persist only mute, reduced-motion preference, best score, and delivery count under a versioned defensive storage key. Run state and clock never persist. Invalid/unavailable storage falls back safely.

## Architecture and data flow

`src/game.ts` owns deterministic state: rooms, explicit interactables/ranges, parcel state, clock, movement/dash phases/trail, combat, upgrades, gates, and outcomes. `src/App.tsx` owns DOM/canvas rendering, capture-phase focused input, pointer/touch aggregation, lifecycle UI, persistence, audio, embedding, and build-gated hooks. Assets remain local. One simulation frame is the sole gameplay time source; render state never drives rules.

Production and instrumented artifacts are built from the same source. `GAME_TEST_BUILD=1` alone permits the test surface. Production must contain no hooks, markers, test selectors/adapters, virtual-clock entry points, module scripts, external URLs, or required network access.

## Deterministic hooks

Test build queries:

- `getState()`, `getScore()`, `getRoom()`, `getUpgrades()`, `getStats()`
- `getInteractable()` returns the nearest target and its `inRange`, `locked`, `kind`, and prompt state
- `getClock()` returns remaining frames/seconds and running/frozen state
- `getDashState()` returns phase, phase frame, start/current position, afterimage count, and cooldown
- `getFocusState()` reports whether the play surface owns focus
- `getInputState()` reports held logical inputs for blur/stuck-key regression proof

Setup methods:

- `start()`, `setupRoom(n)`, `enterRoom(n)`
- `setEnemyHp(n)`, `setBossHp(n)`, `setPosition(x,y)`, `setInstability(n)`, `setHp(n)`
- `setClockFrames(n)`, `grantUpgrade(id)`, `grantParcel()`
- `simulateVisibility(hidden)`, `probeBlurClear()`, and `probeEditableKey()` dispatch real browser events for lifecycle/input ownership assertions; they do not directly change game rules

Scenario names beginning `compact-` run at a deterministic 390×844 viewport; all others use 960×760. This closed name convention does not add fields to the canonical schema.

The test-only `#game-ready`, `data-game-state`, selected `data-testid` attributes, and `window.__game` appear only in the instrumented build. Hooks arrange state but never satisfy boot/core real-input coverage or substitute for keyboard, pointer, touch, click, proximity, or focus paths.

## Acceptance scenarios

`test/scenarios.json` remains schema version 1, with unique names/screenshots, exactly one hook-free boot and at least one hook-free core. Required explicit coverage:

- Boot/title: visible fantasy title, goblin/parcel identity markers, controls with SHOOT / F, compact credits naming both Kenney sources, no forbidden meta/room-count copy.
- Core onboarding: real Start focuses the play surface; walking to parcel reveals proximity prompt; E outside radius does nothing; in-range E picks it up; parcel HUD/sprite changes; door visibly changes locked to unlocked; only in-range E enters.
- Visible exits: representative combat, junction, and final rooms assert visible locked/unlocked exit markers and proximity reasons.
- SHOOT: real F and pointer/touch `#shoot-button` create visible projectile feedback, consume charge, travel, hit, and damage/interruption; labels contain SHOOT and never Toss.
- Dash: real Space starts anticipation without endpoint teleport, subsequent frames move directionally from rest, afterimages appear, recovery/cooldown is visible, and compact/reduced-motion variants remain readable.
- Key capture: after Start, capture-phase mapped key events are default-prevented and block a later Vimium-like listener; paused/title/editable-control events remain available; blur clears held motion.
- Layout/copy: desktop and compact mobile geometry proves HUD, objective, prompt, and touch controls do not overlap; DOM/canvas text excludes “authored,” `Room 1/11`-style strings, and design/test language.
- Clock: decrements during play, freezes across explicit pause and visibility pause/upgrade choice, resumes fairly, and causes deterministic late-delivery loss at zero.
- Credits: title and pause surfaces expose unobtrusive Credits; detailed `THIRD_PARTY.md` provenance is independently checked.
- Existing depth: keyboard/pointer/touch/cancel/multitouch, safe/fast route, two upgrades, lever, hazard/rune, enemy patterns, boss phases, win, HP/overload/clock losses, persistence, reduced motion, embedding, and restart remain asserted.

## Production-visible smoke conditions

The production validator boots the exact absolute `file:///workspace/repo/widgets/goblin-courier/dist/index.html` (or the project root used by the final gate), offline, with all HTTP(S) requests aborted. Without test hooks it must:

1. See `canvas#game-canvas`, a visible `#start-button`, expressive title heading, SHOOT / F instruction, goblin/parcel identity text/marker, and compact Credits; body has no forbidden meta copy.
2. Tap Start, verify `#play-surface` is focused, `#hud`, `#objective-region`, visible parcel/locked-door markers or their player-visible DOM mirrors, and a running delivery-clock value.
3. Replay hook-free core real inputs to move into parcel range, use E to pick up, observe parcel carried/unlocked-door outcomes, move to the visible door, and enter only by proximity.
4. Dispatch real F and Space inputs and verify player-visible projectile/dash change by DOM state or bounded screenshot/pixel predicates declared by the validator.
5. Require zero network requests, page errors, and console errors.

## Scope and acceptance gate

In scope are the existing complete run, its combat/boss/routes/upgrades/input/accessibility/embedding behaviors, and this onboarding/presentation overhaul. Out of scope are network play, procedural generation, new campaigns, and compatibility shims for renamed Toss APIs.

Acceptance requires every scenario and exact final web-game command from `/in/playtest.md`, production static plus offline smoke, repository-native widget validation/render/journey/theme gates, independent desktop and compact-mobile visual/gameplay review with material fixes, independent final cohesion review, complete credits/provenance, and no changes to pre-existing widgets beyond Goblin Courier’s already-scoped central registrations.
