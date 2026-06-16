# Japanese Verb Conjugation Tower

An interactive widget that makes **morpheme composition order** the visual object. Pick one of ten demo verbs, then toggle conjugation layers (causative → passive/potential → polite → negative → past). A vertical tower builds up in real time: the base form sits at the bottom, each active layer adds a slab showing the cumulative form with the newly-added morpheme highlighted, and the final fully-assembled form floats at the top in large type with furigana and rōmaji.

## Why it's novel

Every existing Japanese conjugation tool produces either a flat table of finished forms or a drill that asks you to recall one target form. None makes *the ordering of composition* manipulable. The differentiator here:

- **Illegal orderings are structurally impossible** — voice (passive/potential) lives in one mutually exclusive slot and is always applied before polite/tense, so you can't accidentally construct an out-of-order agglutination.
- **Each morpheme's contribution is visually isolated** — the highlighted suffix shows exactly what changed at each step.
- **The tower grows live** — removing a layer collapses that slab and re-derives everything downstream.

## The agglutination model

Japanese verb conjugation is **agglutinative**: each morpheme layer attaches to a specific *stem* of the preceding form, and the output of a voice layer (causative/passive/potential) is itself a fresh ichidan verb with its own stems, enabling recursive composition with a tiny rule set.

Pipeline order (innermost → outermost):

```
BASE → [causative?] → [passive? XOR potential?] → [polite?] → [negative?] → [past?]
```

After causative or any voice layer, the working class becomes **ichidan** for every downstream layer. This is why 飲ませる (godan causative) then takes the ichidan passive -られる to give 飲ませられる, then the ichidan negative -ない to give 飲ませられない.

## The 10 demo verbs

| Kanji | Kana | Rōmaji | Class | Gloss |
|-------|------|--------|-------|-------|
| 飲む | のむ | nomu | godan | drink |
| 話す | はなす | hanasu | godan | speak |
| 行く | いく | iku | godan | go |
| 買う | かう | kau | godan | buy |
| 待つ | まつ | matsu | godan | wait |
| 泳ぐ | およぐ | oyogu | godan | swim |
| 食べる | たべる | taberu | ichidan | eat |
| 見る | みる | miru | ichidan | see |
| する | する | suru | irregular | do |
| 来る | くる | kuru | irregular | come |

Notable edge cases covered: 行く→行った (irregular て-form), 買う→買わない (わ-stem, not あ-stem), する→できる (suppletive potential), 来る reading shift (こ/き).

## Enforced ordering rules

| Rule | Enforcement |
|------|-------------|
| Passive XOR potential (one voice slot) | Mutually exclusive radio button |
| Voice is innermost | `buildTower` applies voice before polite/tense regardless of toggle order |
| Causative before passive (never reverse) | Causative checkbox is first in the pipeline; no reverse path exists |

Contextual teaching notes appear for: する + potential (→ できる suppletive), ichidan passive = potential homophony (食べられる), 来る irregular reading shift.

## Data mode

`static` — fully self-contained. All conjugation logic is bundled; no network requests, no external dataset.

## Dev

```bash
npm install
npm run dev       # Vite dev server on localhost:5173
```

## Build

```bash
npm run build     # outputs to dist/
```

## Deploy

Deployed as a Cloudflare Worker serving static assets from `dist/`. Worker name: `widget-japanese-verb-tower`; custom domain: `japanese-verb-tower.widgets.beshir.org`. Config in `wrangler.jsonc` — do not edit invariant fields.

```bash
npx wrangler deploy
```
