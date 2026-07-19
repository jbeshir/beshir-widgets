# Goblin Courier overhaul worklog

## Intake and provenance

- Date: 2026-07-19.
- Authoritative source: `/in/beshir-widgets`.
- Staged complete repository: `/workspace/repo`, copied with `.git` and every widget preserved.
- Baseline HEAD: `1e8330418fa85a8d55f0a8c648f57858d2daf630`.
- Baseline status: clean.
- Scope: substantive player-facing overhaul of Goblin Courier plus only its already-in-scope central registrations. Pre-existing widgets must not be altered.
- Mounted workflow read completely: `/in/SKILL.md` and `/in/playtest.md`.

## Authoritative observed defects

- HUD health overlaps instructions; internal “authored rooms” and room-count copy leaks into play.
- Title typography/fantasy is plain; player silhouette is not recognizably a goblin courier carrying a parcel.
- Initial room has no meaningful visible pickup/door/objective; global E secretly advances.
- Copy implies time pressure without a visible real countdown.
- Gameplay keys are not reliably claimed before Vimium-like extension listeners.
- Dash is an instant unanimated teleport.
- Primary attack is obscurely named Toss rather than SHOOT / F.
- Route/destination/courier fantasy and modest asset attribution are missing.

## Design phase

- Inspected current `src/App.tsx`, `src/game.ts`, styling/assets, package scripts, scenarios, production validator, and existing docs.
- Confirmed baseline mechanisms behind defects: bubble-phase window keyboard handling; no focusable play surface; instant 72px dash displacement; internal `toss` naming throughout; room-index tip; title “Eleven authored rooms”; threshold global-E transition; HUD and tip competing over the stage; no delivery-clock state.
- Replaced `DESIGN.md` with explicit experience, onboarding, controls/focus capture, touch, clock/pause, spatial door/proximity, SHOOT, multi-phase dash, layout, goblin/parcel composition, credits/provenance, accessibility, architecture, deterministic hooks, production smoke, and defect-by-defect acceptance contracts.
- Replaced `PLAN.md` with validation-first vertical slices, clean API migrations, independent design/fix/review ownership, exact final web-game commands, native gates, review evidence, and delivery manifest checks.
- Re-verified `DESIGN.md` against a fresh read rather than assumed content, confirmed it already states the player-facing overhaul contract in full, and left it unchanged.
- Cross-checked every row of the Authoritative observed defects ledger above against `DESIGN.md`'s Acceptance scenarios section and `PLAN.md`'s vertical slices; all eight defects trace to explicit scenario coverage.
- Tightened `PLAN.md`'s vertical slices with an explicit files/assets touchpoint, state/API delta, and named canonical scenario per slice, and an explicit defect-retired note per slice, so slice-to-defect traceability does not depend on cross-referencing prose alone.
- Confirmed via `grep` that `src/App.tsx` and `src/game.ts` still use pre-overhaul naming (`toss`, `Room {g.room+1}/11`, bubble-phase non-capture key listeners, instantaneous 72px dash displacement) — `DESIGN.md`/`PLAN.md` describe the target contract for the fix agent, not yet-implemented behavior.
- No runtime, test, package, asset, or other-widget files were changed by the design agent.

## Implementation and validation ledger

### Fix-agent overhaul (2026-07-19)

- Cleanly migrated primary action and state from Toss to SHOOT / F, including projectile trail, muzzle flash, hit spark, charges, upgrade copy, touch/pointer control ID, scenarios, and harness mapping.
- Added a code-composed long-eared green goblin, courier scarf/strap, and parcel/seal layer; retained the exact CC0 Tiny Dungeon sheet for floor detail and Kenney Pixel Square for UI/title treatment.
- Replaced global interaction progression with positioned parcel/door/cache/altar interactables, radius checks, locked reasons, visible world/DOM markers, route prompts, and a parcel-gated destination.
- Added deterministic seven-minute delivery clock, explicit late loss, pause/visibility/choice freeze through lifecycle-only simulation, and clock query/setup hooks.
- Replaced teleport dash with anticipation, eight travel frames, recovery, cooldown, directional-from-rest motion, invulnerability, and fading afterimages.
- Added focusable `#play-surface`, Start/click focus, capture-phase mapped keyboard claiming with `preventDefault` plus `stopImmediatePropagation` only during play/non-editable targets, and held-input clearing on blur/pause/visibility.
- Separated resource HUD, objective/live region, proximity prompt, world marker, and touch regions; added responsive compact layout and title/pause credits.
- Replaced scenarios with defect-oriented boot/core/input/pause/loss/win/regression coverage and updated production/harness SHOOT mappings.
- Local `npm run typecheck`, `npm run build:test`, and `npm run build` pass. Local browser gates cannot launch because this parent environment has no Playwright Chromium executable; exact webgamedev child gates remain for orchestration.

### Independent review round 1 fixes (2026-07-19)

- Replaced the platform-dependent red devil emoji with a deterministic CSS goblin portrait: green face, paired pointed ears, eyes/nose, courier cap, strap, and sealed parcel. Strengthened the canvas player with distinct head, face, arms, legs, body, strap, and carried-parcel layers.
- Added closed-compatible `compact-` scenario viewport routing at 390×844, two compact screenshots, 44px minimum mobile action targets, and compact objective/prompt clearance above touch controls.
- Added real-event evidence for capture ordering, default prevention, `stopImmediatePropagation`, title/editable non-hijacking, blur-held-input clearing, visibility pause/clock freeze, pause credits, and reduced-motion dash trail/cooldown parity.
- Added an impact cross/spark and earlier impact capture, explicit cooldown screenshot assertion, reduced persistent footer instruction copy, and 19-scenario total coverage.
- Updated deterministic hook documentation for input/visibility event probes and compact viewport naming. Local `npm run typecheck` and `npm run build:test` pass after the fixes.

### Independent review round 2 fixes (2026-07-19)

- Decoupled threshold world rendering from nearest-interactable prompt selection: the glowing parcel and east door now render simultaneously before pickup; the door has its own frame, lock plate, `LOCKED — PARCEL REQUIRED` marker, and changes in place to `OPEN` after pickup.
- Kept contextual prompts nearest-target-only: no prompt appears out of range, parcel `USE / E` appears in range, and interaction remains proximity gated.
- Added pre-pickup simultaneous parcel/locked-door evidence, open-door transition assertion, and paused-state mapped-key non-hijack proof.
- Expanded genuine compact evidence with title-card and in-range onboarding/prompt screenshots; preserved marker word spacing and 44px action targets.
- Scenario suite now contains 23 cases. Local `npm run typecheck` and `npm run build:test` pass.

### Final cohesion review fixes (2026-07-19)

- Expanded the compact playfield to a stable 520px gameplay height and 650px title height so the portrait, controls, clock explanation, Start action, and credits are initially visible without nested-card scrolling. Added strict essential-rectangle and `scrollHeight` assertions.
- Reflowed compact HUD, marker, prompt, objective, joystick, and action controls into separate vertical/horizontal bands; added pairwise non-intersection evidence at the in-range onboarding moment.
- Restored deterministic rune-frame/recharge behavior and explicit regression coverage for safe/fast routes, lever, first upgrade/effect, cache upgrade/effect, cracked-floor hazard setup plus rune recharge, three Warden phases and destination transition, a full threshold-to-delivery route, projectile HP loss, overload loss, mute/delivery persistence, resize postMessage integration, and restart reset.
- Added the narrow `setHp(n)` setup hook for deterministic real-projectile HP-loss arrangement and documented it above. Existing clock-loss coverage remains intact.
- Final suite contains 34 canonical scenarios while preserving all prior 23 cases. Local `npm run typecheck` and `npm run build:test` pass after this final fix round.
- Cohesion retest exposed exact-threshold instability decaying from 100 to 99.85 before overload resolution. Fixed simulation ordering by limiting passive decay to values below 100; three exact threshold crossings now deterministically produce `CHARM OVERLOAD` loss. Typecheck and instrumented build pass after the correction.

The fix/review agents must append, without deleting the provenance above:

- Each runtime/test/assets slice and migration completed.
- Every build/playtest/production failure, preserved evidence, fix round, and retest result.
- Independent desktop and compact-mobile review findings, material fixes, round artifacts, and stop reason.
- Independent final cohesion findings and disposition.
- Exact final web-game commands, logs, reports, hashes, scenario count, tool versions/image identifier.
- Exact repository-native validator/render/journey/theme commands and results.
- Other-widget diff audit and final `/out/repo` plus `/out/SUMMARY.md` delivery.
