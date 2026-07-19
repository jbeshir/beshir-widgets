# Goblin Courier

A compact top-down Canvas2D fantasy delivery run built with Preact and TypeScript.

## Play offline

Run `npm ci`, `npm run build`, then open the absolute `dist/index.html` path in a browser. The file is self-contained and requires no server or network. Keyboard: arrows/WASD move, Space DASH, F SHOOT, hold J to BRACE, E to USE a nearby parcel/door, Escape pause, M mute. Pointer and touch controls are overlaid on the game.

## Edit and verify

Source is under `src/`; deterministic room/enemy/boss simulation is in `src/game.ts`, UI/render/ID-aware input/persistence/embed sizing is in `src/App.tsx`, and the theme is imported once by `src/main.tsx`. Run `npm run typecheck`, `npm run build:test && npm run playtest`, and `npm run build && npm run validate:production`.
