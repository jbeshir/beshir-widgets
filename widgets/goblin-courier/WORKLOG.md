# Mounted worklog

- 2026-07-19: widget scaffolded from repository conventions; no existing widget copied or modified.
- Selected assets extracted from immutable assetsdb source archives with `npm run assets`; exact provenance is in `THIRD_PARTY.md`.
- Runtime implements nine room templates, safe/fast branch, switch/gate, chest upgrades, cracked hazards, three abilities, three enemy roles, three-phase Warden, delivery/loss/restart, instability arc, responsive input and accessibility controls.
- Validation command/results are appended after the final gate run.

## Final validation

- `npm run build:test` — pass; self-contained classic `dist-test/index.html`.
- `node test/playtest.cjs` — pass, `playtest-ok 12`; report and 12 unique screenshots retained.
- `npm run build && node test/validate-production.cjs dist/index.html` — pass; SHA-256 `afed962b6a0af00697dfc2f92992f839f8921231033f92ff548644bccc2c16d4`, static and offline smoke pass.
- `node scripts/validate-widgets.mjs` — pass, 7 widgets valid.
- `scripts/render.cjs` — pass (`#widget-ready`).
- `scripts/journey.cjs` — pass, 24 cells across four states, three viewports, two schemes.
- `scripts/audit-theme.cjs` — pass; light/dark, standalone/embedded, focus/contrast/overflow checks recorded.
- Toolchain: Node 24.13.0 in managed `webgamedev`; npm lockfile; Playwright 1.61.1 / Chromium 149.0.7827.55; TypeScript 5.9.3; Vite 7.2.4; vite-plugin-singlefile 2.3.0.

Product fix rounds: interaction lifecycle synchronization/chest ordering; production classic script relocation; touch-overlay layering and theme audit font/surface corrections. No known deterministic defects remain. Independent play-feel acceptance is deferred to later agents.

## 2026-07-19 — final cohesion after independent round 1

- Replaced the nine-entry prototype with 10 distinct authored templates / 11-room route, hard combat gates, safe/fast tradeoff, two chest opportunities, deterministic offers, six effective upgrades, cracked-floor/rune systems, frame cooldowns, and full persistence counters.
- Added moving/lunging Grunts, telegraphed harmful Weaver bolts, guarding/charging Sentinel, and HP-keyed Warden sweep/slam, volley, and rune-shelter surge patterns.
- Rebuilt input around independent pointer/touch IDs and exact cancellation; raw TouchEvent action and joystick paths now remain simultaneous.
- Rewrote the schema/token validator, manual scheduler harness, 19-scenario suite, and production static/offline replay validator. Production test selectors and instrumentation are build-time absent.
- Added ResizeObserver parent sizing, reduced-motion behavior/static alternatives, media-query updates, mobile HUD/control compaction, best-score and delivery persistence.
- Browser fix/retest sequence: initial suite exposed eight routing/timing assumptions; second run isolated pointer capture and scenario setup; third run left only rune recharge timing; final run passed 19/19. Production static false-positive for W3C namespace URLs was narrowed, then exact offline replay passed.
- Final clean gates: `npm run build:test` pass; `node test/playtest.cjs` pass (`playtest-ok 19`); `npm run build && node test/validate-production.cjs dist/index.html` pass with SHA-256 `00314fdc78b7fa3891677f06e23ca5cd1371eaf23b2a760f5a2259d5569d7e9b`; repository validator reports 7 widgets valid; `#widget-ready` render pass; 24/24 native journey cells pass; theme audit exits 0.
