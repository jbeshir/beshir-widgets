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

## Dictionary & romaji entry

A search box above the featured chips lets you find any verb in the corpus:

- **Inline sample (300 verbs)** — always available, offline, zero loading time. Bundled into the main chunk; drives first paint.
- **Full corpus (26,784 verbs)** — lazy-loaded after first paint as a separate code-split chunk. Once loaded, all JMdict verbs are instantly searchable. If loading fails (e.g. offline), the 300-verb sample remains silently.

**Romaji → kana:** Type romaji (e.g. `nomu`, `taberu`, `benkyou suru`) and it is converted to kana before matching. All JIS wāpuro variants are handled (`si→し`, `ti→ち`, `tu→つ`, `tchi→っち`). Existing kana/kanji pass through unchanged.

**Homophone disambiguation:** Homophones appear as separate rows so the right kanji can be chosen, e.g.:

```
かう → 買う (buy)  飼う (keep a pet)  交う (cross)
いく → 行く (go)   逝く (pass away)
```

Clicking a result selects that verb and drives the tower with current toggle settings.

## Auxiliary-verb (助動詞) framing

Each tier in the tower names the helper word (助動詞) that layer adds:

| Tier | Auxiliary | Attaches to |
|------|-----------|-------------|
| causative | せる／させる | 未然形 (a-stem) |
| passive / potential | れる／られる | 未然形 (a-stem) |
| polite | ます | 連用形 (i-stem) |
| negative | ない | 未然形 (a-stem) |
| past | た／だ | て／た euphonic stem |
| must | なければならない | 未然形 (a-stem) |
| must-not | てはいけない | 連用形-て (te-form) |
| may | てもいい | 連用形-て (te-form) → い-adjective |
| don't have to | なくてもいい | 未然形 (a-stem) → plain negative → い-adjective |
| please (request) | てください | 連用形-て (te-form) |
| please don't (neg request) | ないでください | 未然形 (a-stem) → plain negative |
| hajimeru | はじめる (begin to) | 連用形 (i-stem) → ichidan |
| owaru | おわる (finish) | 連用形 (i-stem) → godan |
| tsuzukeru | つづける (keep doing) | 連用形 (i-stem) → ichidan |
| dasu | だす (start doing) | 連用形 (i-stem) → godan |

Hover any tier label to see a one-line tooltip describing which stem the auxiliary attaches to and how it conjugates in its own right.

### Compound / phase verbs

始める・終わる・続ける・出す attach to the **連用形 (i-stem)** of any verb and express the start, end, continuation, or sudden onset of an action. The attached form is itself an ordinary ichidan or godan verb, so it conjugates further with the standard tense/polite/negative layers — e.g. 飲みはじめる → 飲みはじめた / 飲みはじめない / 飲みはじめます. Only one phase verb may be stacked at a time.

The add-layer dropdown shows a brief English meaning beside each entry (e.g. "begin to", "finish", "keep doing", "start doing") to help learners distinguish the options at a glance.

The "Composition order" legend carries the subtitle "each active slot adds a helper word (助動詞)" to surface the agglutination model: a Japanese conjugated form is the root verb plus a stack of auxiliaries, each attaching to a specific stem of the preceding form and conjugating independently.

Teaching notes:
- **Ichidan passive ≈ potential:** For ichidan verbs (食べる, 見る) the passive and potential are the same surface form (食べられる). Godan verbs use the dedicated e-row for potential (飲める) and れる for passive (飲まれる).
- **ない is an adjective:** Plain negative inflects as an い-adjective — negative-past stacks as なかった, not ×ないた.
- **ある's suppletive negative:** ある → ない (not あらない), shown as a contextual note when ある is selected with Negative on.
- **〜てください is a request:** Like 〜てはいけない, the polite request builds on the **連用形-て (te-form)** + ください (待ってください = "please wait"). It is terminal — nothing stacks on top. The casual request simply drops ください, leaving the bare て-form (待って!).
- **〜ないでください is the negative request:** The mirror of 〜てください — "please don't ~". It builds on the **plain negative** (未然形 + ない) + でください (飲まないでください = "please don't drink"). Verb-only and terminal, sharing the same `request` form type as the affirmative.
- **〜てもいい / 〜なくてもいい complete the obligation set:** Permission 〜てもいい ("may / it's OK to") builds on the **連用形-て (te-form)** + もいい (飲んでもいい = "you may drink"); exemption 〜なくてもいい ("don't have to") builds on the **plain negative** minus the final い + くてもいい (飲まなくてもいい = "you don't have to drink"). Both end in いい and **re-conjugate as an い-adjective** (the irregular よ-stem), so they stack further as past 〜てもよかった, polite 〜てもいいです, negative 〜てもよくない. Together with 〜なければならない (must) and 〜てはいけない (must not) they round out the four corners of the deontic square. Casually the も drops: 〜ていい / 〜なくていい.

## Natural-English translation

The top (final) conjugated form is rendered into natural English, shown directly below the compositional gloss line and marked with an "AI translation" label.

**How it works:** the widget calls `POST /api/translate` on the same origin. That endpoint is served by a small server-side Cloudflare Worker (`src/worker.ts`) scoped to `/api/*` via `assets.run_worker_first`; all other paths continue to serve the static SPA as before. The Worker calls **Cloudflare Workers AI**, model `@cf/qwen/qwen3-30b-a3b-fp8` (chosen for its stronger Japanese; the `/no_think` soft switch keeps it from emitting chain-of-thought, and `cleanTranslation` strips any `<think>…</think>` that leaks through), and returns the English phrase. The base meaning and ordered grammatical features the widget already computes are passed alongside the Japanese form to ground the translation.

**Graceful degradation:** the translation is best-effort. When the Worker isn't running — local `vite dev`, the offline render-check, a network failure, or a rate-limit response — the translation line simply renders nothing. The `#widget-ready` signal and all other widget functionality are never blocked.

**In-Worker abuse guard (no external WAF):**
- Input caps: form and base each ≤ 64 chars, ≤ 12 features.
- Cross-site requests rejected (`Sec-Fetch-Site: cross-site` check).
- Rate limiting: `ratelimits` binding — 20 req / 60 s per IP.
- Cache API memoization of deterministic translations — 7-day TTL.

## How the verb data was generated

`scripts/build-dict.mjs` produces the corpus files from JMdict:

1. Downloads the latest `jmdict-simplified` release from GitHub.
2. Maps JMdict part-of-speech tags to widget conjugation classes (`v1`→`ichidan`, `v5m`→`godan-m`, `vs`→`suru-noun`, etc.).
3. Writes compact `{ k, r, romaji, cls, common, gloss }` records to `src/data/`.

**This script is NOT run by CI** — the compiled data files are committed to the repo. Run it manually when a new JMdict release is needed.

## Data mode

`static` — the data files are committed assets. The 300-verb sample is bundled inline in the render chunk (instant, offline). The 26,784-verb full corpus is a separate lazy bundle chunk loaded after first paint; the `data.mode` in `widget.json` remains `static` since no runtime API is involved.

## Data sources

Verb data derived from **JMdict / EDICT**, © The Electronic Dictionary Research and Development Group (EDRDG). Used under the EDRDG Free Use Licence (Creative Commons Attribution-ShareAlike). See <https://www.edrdg.org/edrdg/licence.html>.

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

**Workers AI note:** the Cloudflare API token used by CI may need Workers AI permissions, and Workers AI must be enabled on the account.

```bash
npx wrangler deploy
```
