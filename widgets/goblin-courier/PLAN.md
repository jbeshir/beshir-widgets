# Goblin Courier overhaul plan

## Phase handoff and ownership

The design agent changes only `DESIGN.md`, `PLAN.md`, and `WORKLOG.md`. A distinct fix agent owns Goblin Courier runtime/tests/assets and only already-scoped central registrations. Independent reviewers inspect produced artifacts without being the implementing author. Each phase leaves reproducible files in the repository; one writer owns coupled runtime code at a time.

## Vertical slices

Each slice names the defect(s) it retires (from the Authoritative observed defects ledger in `WORKLOG.md`), the files/assets it touches, and its state/API delta; canonical scenarios are listed per slice and must all exist in `test/scenarios.json` before that slice is considered done.

1. **Validation contract first.** Retires no defect directly; unblocks proving all others. Files/assets: `test/scenarios.json`, `test/playtest.cjs`, `test/validate-production.cjs`. State/API: none yet — scenarios reference the hooks defined below as they land in later slices. Migrate scenario logical input/IDs from Toss to SHOOT; add deterministic queries/setup for interactables, parcel, clock, focus, and dash phases. Extend schema scenarios for every user defect, real keyboard/pointer/touch paths, desktop and compact layouts, credits, and existing combat/depth. Update production validator to replay the declared hook-free boot/core inputs and player-visible smoke predicates. Canonical scenarios: `boot-reaches-ready` (revised meta/copy assertions), schema additions for every scenario group named below before their slice lands.
2. **Spatial onboarding.** Retires: initial room has no visible pickup/door/objective and global E secretly advances; route/destination fantasy missing. Files/assets: `src/game.ts` (interactables/parcel/route state), `src/App.tsx` (interactable render/prompt DOM), `public/` door and route-marker art. State/API: `getInteractable()`, `grantParcel()`, per-room interactable list with `position`, `radius`, `label`, `lockedReason`, `destination`; parcel `WAITING`/`CARRIED` field. Add explicit positioned interactables to simulation, parcel pickup state, per-room visible doors/exits, range gating, lock reasons, route cue, contextual prompt, objective region, and meaningful threshold-to-gallery flow. Remove global-E room transitions and all room-count/design copy. Canonical scenarios: `core-onboarding-parcel-pickup`, `core-onboarding-out-of-range-noop`, `core-visible-exits-locked-unlocked` (threshold/gallery/final rooms).
3. **Goblin courier identity and presentation.** Retires: title typography/fantasy plain and silhouette not recognizable; HUD/instruction overlap; asset attribution missing. Files/assets: `src/App.tsx` (title/pause/Credits DOM, HUD/objective/prompt regions), `src/game.ts` (facing/pose fields for composition), `public/` sprite layers and Kenney font, `THIRD_PARTY.md`, `CONTENT-NOTES.md`. State/API: `getFocusState()`; no new simulation fields beyond pose bookkeeping already implied by dash/facing. Compose an animated green long-eared goblin with satchel/parcel layers; add pickup/carry state markers, courier/destination marks, expressive pixel title, readable doors, separate HUD/objective/prompt regions, responsive compact layout, and title/pause Credits. Update exact `THIRD_PARTY.md` provenance and content notes. Canonical scenarios: `boot-title-identity-and-credits`, `layout-hud-objective-prompt-no-overlap-desktop`, `layout-hud-objective-prompt-no-overlap-compact`.
4. **Combat language and feedback.** Retires: primary attack obscurely named Toss. Files/assets: `src/game.ts` (state/event/upgrade fields), `src/App.tsx` (labels, `#shoot-button`, IDs), `test/scenarios.json` (action tokens and hook names). State/API: rename `toss`/`tossMax`/`tossCooldown`/`events.tosses`/action `'toss'`/`#toss-button` to `shoot` equivalents everywhere, no aliases. Add muzzle/trail/hit feedback and differentiate player/hostile projectile silhouettes without relying on color alone, while preserving deeper enemy, boss, route, upgrade, hazard, pointer/touch, and reduced-motion behavior. Canonical scenarios: `input-keyboard-shoot`, `input-pointer-touch-shoot-actions` (renamed from the current toss scenarios), `regression-weaver-projectile-hurts` (revised for visual differentiation assertion).
5. **Dash and deadline.** Retires: dash is an instant unanimated teleport; copy implies time pressure without a visible countdown. Files/assets: `src/game.ts` (dash phase/afterimage/clock state), `src/App.tsx` (dash rendering, clock HUD). State/API: `getDashState()` (phase, phase frame, start/current position, afterimage count, cooldown), `getClock()`, `setClockFrames(n)`; `dash` action becomes multi-frame (anticipation → travel → recovery) instead of an endpoint jump; add `clockFrames`/`clockRunning` to `Game`. Replace teleport with anticipation/travel/recovery simulation, directional movement from rest, afterimages/trail, invulnerability/cooldown feedback. Add visible frame-driven delivery clock with pause/visibility/choice freeze and deterministic expiry loss (`DELIVERY LATE`). Canonical scenarios: `input-keyboard-dash-phases-and-afterimages` (replaces `input-keyboard-dash-cooldown`), `states-clock-decrements-and-freezes`, `loss-delivery-clock-expiry`.
6. **Input ownership.** Retires: gameplay keys not reliably claimed before Vimium-like extension listeners. Files/assets: `src/App.tsx` (focus management, capture-phase listeners), `index.html`/build output (`tabindex="0"` play surface). State/API: `getFocusState()` (shared with slice 3). Focus the `tabindex=0` play surface after Start/click, install capture-phase key handlers gated to playing/non-editable contexts, claim mapped keys with both `preventDefault()` and `stopImmediatePropagation()`, clear held state on lifecycle/blur/visibility loss, and prove Vimium-like listener blocking plus non-hijacking of title/pause/choosing/editable targets. Canonical scenarios: `input-keyboard-capture-blocks-external-listener`, `input-keyboard-blur-clears-held-motion`, `input-keyboard-editable-target-not-hijacked`.
7. **Integration and evidence.** Retires no defect directly; proves all of the above together. Files/assets: `artifacts/`, `dist-test/`, `dist/`, review markdown. State/API: none. Build instrumented artifact and run the full browser suite separately after slices. Preserve reports/screenshots. Run independent desktop and compact-mobile visual/gameplay review, apply material fixes in bounded rounds, rebuild/replay, then independent final cohesion review and any worthwhile final fix.

## State and API migrations

- Replace internal `toss`, `tossCooldown`, `tossMax`, `events.tosses`, action `toss`, and `#toss-button` with SHOOT equivalents; update all callers together without deprecated aliases.
- Add parcel status, objective/prompt, explicit interactable/door state, delivery-clock frames/state, dash phase/phase-frame/travel origin/afterimages, and focus-visible mirrors required by production smoke.
- Keep game rules in `game.ts`; keep DOM/canvas/input/persistence in `App.tsx`; keep build-gated hooks absent from production.
- Update local assets and `THIRD_PARTY.md` only when provenance is exact. Preserve lockfile and package manager.

## Required scenarios and review evidence

Scenario groups must explicitly assert: title identity/credits/meta absence; focus and capture-phase blocking/non-hijacking; out-of-range pickup/door rejection and in-range prompt/progression; visible door locks in every room or data-driven exhaustive query plus representative screenshots; SHOOT discoverability/projectile/hit across keyboard/pointer/touch; multi-frame dash anticipation/movement/afterimages/cooldown; timer play/pause/visibility/choice/expiry; HUD-objective-prompt separation at desktop and compact mobile; goblin/parcel markers; safe/fast upgrades; hazards/runes; enemy and boss patterns; win/loss/restart; pointer/touch cancellation and multitouch; persistence, reduced motion, and embedding.

Review artifacts are contiguous `artifacts/reviews/round-N.md` for each fix round and `artifacts/reviews/final.md` with stop reason. Reviews must inspect rendered desktop and compact-mobile screenshots/gameplay, not source alone.

## Exact final gates

From the Goblin Courier project root, run as three separate `webgamedev`, no-egress deterministic calls and preserve combined output in the named log without changing command status:

```sh
rm -rf dist-test artifacts/gallery artifacts/playtest-report.json && mkdir -p artifacts/gallery artifacts/logs && npm run build:test
```

```sh
node test/playtest.cjs
```

```sh
rm -rf dist artifacts/production-validation-report.json && npm run build && node test/validate-production.cjs dist/index.html
```

Require exit 0, both exact HTML files, every declared PNG, `playtest-report.json` top-level and per-scenario pass, production report/static/smoke pass with matching SHA-256 and empty violations/network/page/console errors, and the three nonempty final logs. If dependencies require restoration, use exactly one lockfile-backed `npm ci` with package-manager egress. Follow the skill’s one retry for infrastructure failure and bounded three fix/retest rounds for product failures.

Then run the repository-native gates from `/workspace/repo` using their existing documented commands: widget validator, Goblin Courier render readiness, journey matrix, and theme/accessibility audit. Require other widgets unchanged except pre-authorized Goblin Courier central registration entries. Re-read `/in/playtest.md` before final validation.

## Delivery

Verify the full manifest: docs/README, package/one lockfile/source/tests, both artifacts, reports/gallery/reviews/logs, exact `THIRD_PARTY.md`, applicable `CONTENT-NOTES.md`, native evidence, and clean production isolation. Copy the complete repository to `/out/repo`, write concise `/out/SUMMARY.md` with commands/tool versions/results/review stop reason/backlog/risks, and report success only after every required gate passes.
