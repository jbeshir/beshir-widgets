# Starfall Reliquary implementation plan

1. Register the `starfall-reliquary` widget and establish its lockfile-backed Preact/Vite project, metadata, local theme, and offline single-file build modes.
2. Implement the deterministic simulation, keyboard/pointer/touch input, procedural renderer/audio, upgrade catalog/synergies, enemy waves, boss, endings, persistence, and accessible responsive shell.
3. Add build-gated instrumentation, canonical scenarios, manual-clock Playwright harness, production static/offline validator, and journey definitions.
4. Run typecheck, instrumented build/playtest, clean build/production validation, then record implementation evidence for independent review.

The game project root for delivery-manifest paths is `widgets/starfall-reliquary/`; build artefacts and test evidence remain self-contained there.
