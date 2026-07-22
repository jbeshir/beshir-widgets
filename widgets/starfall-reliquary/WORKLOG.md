# Worklog

- Input: `/in/beshir-widgets`, staged completely at `/workspace/repo` by the primary agent; baseline Git history retained.
- Concept: `DESIGN.md` specifies Starfall Reliquary, a procedural 7–9 minute arena roguelike shmup.
- Constraints: widget-local Preact/Vite project, offline self-contained production and instrumented files, no external assets/network, keyboard and direct-manipulation controls, deterministic tests, native widget metadata and journeys.
- Implementation: original Canvas 2D glyph art, seeded fixed-step simulation, WebAudio oscillator feedback, accessible HTML overlays/HUD, build-gated test API, canonical Playwright suite and offline production validator.
- Asset sources: none. Third-party package provenance is recorded in `THIRD_PARTY.md`.
- Unlock audit: repaired inert Magnet Core and Cryo Wake rank progression; made Aegis recharge independent of target presence; added ranked Orbit, Mortar, Prism, and defensive feedback; synchronized boss HUD damage across every weapon; and applied Overclock's hull cost through both player and deterministic setup paths.
- Regression coverage: deterministic browser scenarios now inspect every unlock family through observable damage, slowing fields, shard attraction/repair, ward recharge, and rendered weapon states rather than relying only on fire counters.
