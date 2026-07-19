# Starfall Reliquary

A self-contained top-down roguelike shmup widget built with Preact, TypeScript, Canvas 2D, and generated WebAudio.

## Play offline

Run `npm ci && npm run build`, then open `dist/index.html` directly with a browser (`file://` is supported). Use WASD/arrow keys or drag on the arena; Escape pauses and M toggles sound.

## Edit and verify

Source lives in `src/`. Run `npm run dev` while editing, `npm run typecheck`, `npm run build:test && npm run playtest` for deterministic scenarios, and `npm run build && node test/validate-production.cjs dist/index.html` for the clean offline artifact.
