# Building the Japanese Verb Tower

The finished widget lives at [**japanese-verb-tower.widgets.beshir.org**](https://japanese-verb-tower.widgets.beshir.org) — pick a verb, toggle conjugation layers, and a vertical tower grows in real time with the morpheme contribution of each layer highlighted. For the visual design — slab layout, colour, and animation — see the [design track](../design/03-japanese-verb-tower.md). This tutorial assumes you have completed [01](./01-function-plotter.md) and [02](./02-image-comparison-table.md) and builds directly on the patterns introduced there. The headline new ground: a pure algorithmic conjugation engine (no framework, no DOM, golden-tested in Node) and a Cloudflare Worker that serves both the static SPA and a live AI translation endpoint from a single deploy.

## What you'll build

The [Japanese Verb Tower](https://japanese-verb-tower.widgets.beshir.org) makes **morpheme composition order** the visual object. Pick one of ten demo verbs, then toggle conjugation layers — causative → passive/potential → polite → negative → past — and a vertical tower builds in real time: the base form sits at the bottom, each active layer adds a slab with the newly-added morpheme highlighted, and the final assembled form floats at the top with furigana and rōmaji. Illegal orderings are structurally impossible — the widget enforces grammatical sequencing in the data model itself, not at validation time. For the visual design and animation of the tower slabs, see the [design track](../design/03-japanese-verb-tower.md).

By the end of this tutorial you'll have built all six layers of the stack: a pure rule-based conjugation engine, a Cloudflare Worker that serves both the static SPA and a live AI translation endpoint from a single deploy, debounced-abortable fetch with a two-tier client cache and graceful degradation, a lazy verb corpus that loads post-first-paint, bidirectional URL state that survives a full page reload, and a romaji input pipeline that maps ASCII keystrokes to kana before search.

### The 10 demo verbs

| Kanji | Kana | Rōmaji | Class | Gloss |
|-------|------|--------|-------|-------|
| 飲む | のむ | nomu | godan | drink |
| 話す | はなす | hanasu | godan | speak |
| 行く | いく | iku | godan | go |
| 買う | かう | kau | godan | buy |
| 待つ | まつ | matsu | godan | wait |
| 泳ぐ | およぐ | oyogu | godan | swim |
| 食べる | たべる | taberu | ichidan | eat |
| 帰る | かえる | kaeru | godan | return |
| する | する | suru | irregular | do |
| 来る | くる | kuru | irregular | come |

Notable edge cases covered: 行く→行った (irregular て-form), 買う→買わない (わ-stem, not あ-stem), 帰る (looks ichidan but conjugates godan: 帰らない／帰った), する→できる (suppletive potential), 来る reading shift (こ/き).

With the widget's scope clear, the next section explains why a single Cloudflare Worker serves both the static files and the live translation endpoint.

## The stack and why

This widget runs the Preact core + Vite stack from [01](./01-function-plotter.md) — same `@preact/preset-vite`, same `vite.config.ts`. What is new is a real server: the SPA and a live `/api/translate` endpoint are served from a single Cloudflare Worker, and the TypeScript toolchain is split so Worker types never pollute the frontend compile.

### One Worker, both jobs

Every widget in this repo deploys automatically to its own Cloudflare Workers subdomain:

> each is an independent, iframe-embeddable Vite SPA, deployed automatically to its own subdomain on Cloudflare Workers via GitHub Actions
> <!-- README.md:3 -->

For earlier widgets the Worker only served static files from `dist/`. This widget extends the same deployment unit with a live backend route — no new infrastructure, just an additional section of the existing Worker. Everything flows from `wrangler.jsonc`:

```jsonc
<!-- widgets/japanese-verb-tower/wrangler.jsonc:1-9 -->
{
  "name": "widget-japanese-verb-tower",
  "compatibility_date": "2026-06-01",
  "main": "./src/worker.ts",
  "assets": {
    "directory": "./dist/",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },
```

`"main"` is the Worker entry point — `src/worker.ts` contains the `fetch` handler and is covered in full in [§ The Cloudflare Worker backend](#the-cloudflare-worker-backend). The `assets` block is what makes one Worker serve both jobs.

### `run_worker_first` and `not_found_handling`

By default, Cloudflare's static asset layer intercepts every request before Worker code runs. The two fields in `assets` reconfigure this for specific cases.

**`run_worker_first: ["/api/*"]`** — for any request whose URL matches a glob in the array, the Worker's `fetch` handler runs first and owns the response. Every other path bypasses the Worker entirely and goes straight to static asset serving. No proxy wiring is needed: the Worker receives exactly the `/api/*` requests and nothing else.

**`not_found_handling: "single-page-application"`** — when a URL has no matching file in `./dist/`, Cloudflare returns `index.html` with 200 instead of 404. Direct navigation to any deep URL gets the SPA shell; Preact handles client-side routing from there.

| Path | Handled by |
|---|---|
| `/api/translate` | Worker `fetch` handler |
| `/index.html`, compiled JS/CSS | Static asset serving |
| Any unrecognised path | `not_found_handling` → `index.html` |

One Worker, one `npx wrangler deploy`, both jobs.

The bindings the Worker uses at runtime sit below the assets block:

```jsonc
<!-- widgets/japanese-verb-tower/wrangler.jsonc:16-23 -->
  "ai": { "binding": "AI" },
  "ratelimits": [
    {
      "name": "TRANSLATE_RL",
      "namespace_id": "1001",
      "simple": { "limit": 20, "period": 60 }
    }
  ]
```

`env.AI` and `env.TRANSLATE_RL` are the handles `worker.ts` uses for AI inference and rate limiting. Their types, call shapes, and defence-in-depth layering are all covered in [§ The Cloudflare Worker backend](#the-cloudflare-worker-backend).

### Isolating Worker types

`vite.config.ts` is unchanged from [01](./01-function-plotter.md): Vite compiles only the frontend. Wrangler compiles the Worker separately under its own TypeScript configuration.

The isolation is necessary because `@cloudflare/workers-types` injects Worker-specific globals — Cloudflare's overloads of `Request`, `Response`, `caches`, and `ExecutionContext` — that conflict with the browser DOM types the frontend needs. `tsconfig.worker.json` confines those types to the Worker files:

```json
// widgets/japanese-verb-tower/tsconfig.worker.json:9
    "types": ["@cloudflare/workers-types"],
```

```json
// widgets/japanese-verb-tower/tsconfig.worker.json:12
  "include": ["src/worker.ts", "src/translate-shared.ts"]
```

`"types"` loads the Worker runtime types in place of browser lib types. `"include"` restricts the compilation to exactly those two files — nothing from the Preact component tree appears here. The frontend's `tsconfig.json` does the opposite: browser types, no Worker types, all of `src/` except `worker.ts`.

Two scripts expose the split clearly:

```json
// widgets/japanese-verb-tower/package.json:15-16
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "typecheck:worker": "tsc -p tsconfig.worker.json --noEmit"
```

Neither compile sees the other's ambient types, so a Worker-only API like `env.AI.run(...)` will correctly error in the frontend context if accidentally imported there.

With the deployment model established, the next section covers how the app starts up — specifically why URL state is parsed at module scope rather than inside a hook.

## Initialisation and the ready signal

The `index.html` → `main.tsx` → `render(<App />, root)` entry chain and the `#widget-ready` marker convention were introduced in [tutorial 01](./01-function-plotter.md). This widget uses the same skeleton:

```html
<!-- widgets/japanese-verb-tower/index.html:10 -->
<script type="module" src="/src/main.tsx"></script>
```

```tsx
// widgets/japanese-verb-tower/src/main.tsx:1-6
import { render } from 'preact';
import { App } from './App';
import './styles.css';

const root = document.getElementById('root');
if (root) render(<App />, root);
```

What is new here is *when* URL state is parsed and *why* the ready signal fires independently of any async work.

### Module-level URL hydration

In [tutorial 02](./02-image-comparison-table.md), initial state was read inside a lazy `useState` initialiser — the function passed to `useState(() => resolveTable(...))` runs once on first render, inside the component. Here the parse is pulled one level earlier: it runs at **module scope**, before `App` is ever defined or called.

`readInitialState` is a small wrapper:

```tsx
// widgets/japanese-verb-tower/src/App.tsx:27-34
function readInitialState(): { verb: Verb; ops: OpId[] } | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseState(window.location.search);
  } catch {
    return null;
  }
}
```

And immediately below the function definition, at module scope:

```tsx
// widgets/japanese-verb-tower/src/App.tsx:44
const INITIAL_STATE = readInitialState();
```

`INITIAL_STATE` is a module constant. It is evaluated once — when the ES module first loads, before any component renders. By the time `useState` inside `App` executes, the value is already sitting in memory.

The `useState` calls that seed from it:

```tsx
// widgets/japanese-verb-tower/src/App.tsx:205-208
const [selectedVerb, setSelectedVerb] = useState<Verb>(
  INITIAL_STATE ? withGloss(INITIAL_STATE.verb, SAMPLE) : DEFAULT_VERB,
);
const [stack, setStack]               = useState<OpId[]>(INITIAL_STATE?.ops ?? []);
```

Both seeds are plain expressions (not functions passed to `useState`), which is fine because `INITIAL_STATE` is already a constant — the work of parsing the URL has already been done. Preact evaluates these expressions exactly once at mount; there is no re-parse on subsequent renders.

**Tradeoff vs. tutorial 02's approach.** The lazy initialiser form — `useState(() => parseState(...))` — was the right call in tutorial 02 because the initialiser ensures the parse runs exactly once even if Preact were to speculatively call the component more than once. The module-constant approach is equally safe here because `window.location.search` is read-once-at-startup data: the URL does not change under the app's feet (navigation is handled via `history.replaceState`, covered in [§ Effects and async integration](#effects-and-async-integration)). Computing it at module load is simpler to read and makes it explicit that this value is a startup snapshot, not live reactive state.

`parseState` itself validates the op sequence against the conjugation engine's rule set — the full round-trip including op re-validation is covered in [§ Effects and async integration](#effects-and-async-integration). The role here is read-only: extract, validate, and hand off to `useState`.

### The ready signal

The `#widget-ready` marker appears in one place in the JSX:

```tsx
// widgets/japanese-verb-tower/src/App.tsx:798
      {ready && <div id="widget-ready" hidden />}
```

`ready` becomes `true` via its own independent effect:

```tsx
// widgets/japanese-verb-tower/src/App.tsx:242
  useEffect(() => { setReady(true); }, []);
```

The empty dependency array means this effect fires once, after the first paint — unconditionally. It does not depend on `selectedVerb`, `stack`, `translation`, or any corpus data.

This is a deliberate choice. The widget has two async operations that start after mount: a dynamic import of the full verb corpus (∼26,000 entries, split into its own chunk), and a debounced fetch to the translation Worker. Either or both may be slow, may be offline, or may never complete at all. Gating `#widget-ready` on either would mean the marker sometimes never appears.

The first paint produces a fully functional widget: the sample verb list is bundled in the initial chunk, `selectedVerb` and `stack` are already seeded from the URL or defaults, and the conjugation tower renders synchronously from that state. The corpus and translation are progressive enhancements layered on top. `setReady(true)` fires to say "first meaningful render has happened" — the same intent as in [tutorial 01](./01-function-plotter.md), but here the signal is decoupled from async work rather than deferred until it completes.

With the entry chain clear, the next section maps out the state model that drives every downstream derivation.

## State and data flow

`useState`/`useMemo` mechanics and the "derive, don't store" argument were established in [tutorial 01](./01-function-plotter.md). Typed Props contracts and unidirectional data flow were established in [tutorial 02](./02-image-comparison-table.md). This section focuses on what is new: two writeable sources of truth that drive the entire conjugation pipeline.

### The state inventory

`App` owns thirteen `useState` declarations:

```tsx
// widgets/japanese-verb-tower/src/App.tsx:205-219
  const [selectedVerb, setSelectedVerb] = useState<Verb>(
    INITIAL_STATE ? withGloss(INITIAL_STATE.verb, SAMPLE) : DEFAULT_VERB,
  );
  const [stack, setStack]               = useState<OpId[]>(INITIAL_STATE?.ops ?? []);
  const [addLayerOpen, setAddLayerOpen] = useState(false);
  const [ready, setReady]               = useState(false);
  const [query, setQuery]               = useState('');
  const [allEntries, setAllEntries]     = useState<DictEntry[]>(SAMPLE);
  const [dictLoading, setDictLoading]   = useState(true);
  const [dictSize, setDictSize]         = useState(0);
  const [mode, setMode]                 = useState<'build' | 'breakdown'>('build');
  const [bdInput, setBdInput]           = useState('');
  const [bdParses, setBdParses]         = useState<Parse[] | null>(null);
  const [translation, setTranslation]   = useState<string | null>(null);
  const [translating, setTranslating]   = useState(false);
```

`selectedVerb` and `stack` are the only writeable inputs to the conjugation system. Every conjugation-related value downstream — the tower of morpheme slabs, the current form at the top of the stack, the set of legal next operations — is derived synchronously in the same render. `ready` gates the `#widget-ready` marker (§[Initialisation](#initialisation-and-the-ready-signal)). `query`, `allEntries`, and `translation` belong to search and the async AI translation pipeline (§[Effects and async integration](#effects-and-async-integration)).

### The data types

`Form` is the threading type that flows through the conjugation pipeline: every operation takes a `Form` and returns a new one.

```ts
// widgets/japanese-verb-tower/src/types.ts:12-21
export interface Form {
  kana: string;
  type: FormType;
  conjStem?: string;    // suru-s / zuru base conjugation stem
  suruPrefix?: string;  // '' for する; 'べんきょう' for 勉強する
  euphony?: 'iku' | 'u-s';
  aruNeg?: boolean;
  aruPolite?: boolean;
  iiAdj?: boolean;      // いい/良い irregular adjective
}
```

The `type` discriminant is what stem-helper functions branch on, and what voice operations rewrite to unlock the ichidan rule set downstream — covered in detail in [§ The conjugation engine](#the-conjugation-engine).

`Tier` is the output record: one slab in the rendered tower, carrying the display strings and the suffix highlight offsets that the tower animation uses.

```ts
// widgets/japanese-verb-tower/src/types.ts:36-48
export interface Tier {
  op: 'base' | OpId;
  layer: 'base' | OpId;   // alias for op (backwards compat with App.tsx)
  type: FormType;
  kana: string;
  kanji: string;
  romaji: string;
  label: string;
  aux: string;
  gloss: string;
  hlKana: [number, number];
  hlKanji: [number, number];
}
```

For the visual treatment of each `Tier` slab — height, colour, and the animated suffix highlight — see the [design tutorial](../design/03-japanese-verb-tower.md).

### The derivation chain

Three `useMemo` calls transform `selectedVerb` and `stack` into everything the UI needs:

```tsx
// widgets/japanese-verb-tower/src/App.tsx:275-278
  const tower: Tier[] = useMemo(
    () => buildTower(selectedVerb, stack),
    [selectedVerb, stack],
  );
```

```tsx
// widgets/japanese-verb-tower/src/App.tsx:300-303
  const currentForm: Form = useMemo(
    () => finalForm(selectedVerb, stack),
    [selectedVerb, stack],
  );
```

```tsx
// widgets/japanese-verb-tower/src/App.tsx:305-308
  const nextOps: OpId[] = useMemo(
    () => allowedOps(currentForm, stack),
    [currentForm, stack],
  );
```

The dependency graph:

```
selectedVerb, stack  →  tower       (buildTower)
                     →  currentForm (finalForm)  →  nextOps (allowedOps)
```

`tower` and `currentForm` are both keyed on `[selectedVerb, stack]` and recompute together whenever either source changes. `nextOps` is keyed on `[currentForm, stack]`; because `currentForm` already depends on the two sources, any change propagates through. The URL sync effect is also keyed on the same pair and runs after the render (§[Effects and async integration](#effects-and-async-integration)).

The component treats `buildTower`, `finalForm`, and `allowedOps` as pure functions — no DOM access, no Preact hooks, no side effects. From the component's perspective they are a black box: same inputs always produce the same outputs, making the `useMemo` caching semantically correct rather than just a performance hint.

### Toggling a layer re-derives everything in one render

Adding and removing layers are handled by two small functions:

```tsx
// widgets/japanese-verb-tower/src/App.tsx:328-335
  function toggleOn(op: OpId) {
    if (nextOps.includes(op)) setStack([...stack, op]);
  }

  function toggleOff(op: OpId) {
    const idx = stack.indexOf(op);
    if (idx >= 0) setStack(stack.slice(0, idx));
  }
```

`toggleOn` appends only if `op` is in `nextOps`. Because `nextOps` is produced by `allowedOps` — which enforces grammatical legality including depth caps, terminal-form detection, and once-each constraints on voice and desire ops — clicking an unavailable op is a no-op even if the caller bypasses the disabled UI.

`toggleOff` does not splice a single element. It calls `stack.slice(0, idx)`, truncating at the first occurrence of `op` and discarding every op above it. The reason is that `stack` is an ordered pipeline: each op receives the `Form` produced by the op before it as input. Remove layer *k* and every layer above *k* was computed from a form that no longer exists. Truncation enforces the ordering invariant structurally — after `setStack(stack.slice(0, idx))`, there is no way to leave orphaned entries in the stack that depend on a removed intermediate form.

A single `setStack(...)` call schedules one re-render. In that render all three memos execute synchronously: `tower` rebuilds every slab, `currentForm` re-walks the new stack, `nextOps` re-evaluates legality. The tower, the menu, and the URL all update in the same pass — no secondary state update, no async step, no inconsistency window between them.

The next section opens the engine itself and shows how `buildTower`, `finalForm`, and `allowedOps` are implemented.

## The conjugation engine

The entire conjugation logic lives in `widgets/japanese-verb-tower/src/` as a set of TypeScript modules that import nothing from Preact or the DOM. The same pattern appeared in [tutorial 01's expression evaluator](./01-function-plotter.md) — a framework-free domain module with a clean public boundary — but that was a pipeline of three sequential phases operating on a string. This engine is deeper: a full agglutination rule set with a typed rewrite system, a self-registering operator catalogue, and a recursive composition trick that collapses the combinatorial explosion of Japanese morpheme ordering into about 200 lines of rule code. [Tutorial 02's typed data registry](./02-image-comparison-table.md) also lived outside the component, but it was a lookup table — static data with selector functions. The engine here derives new forms algorithmically at every step.

The reason to keep it outside the component is the same: pure functions with no DOM dependency can be run directly with `node` (via `tsx`) and golden-tested against a committed fixture. The [Testing section](#testing-the-domain-engine) covers that payoff.

### The barrel: engine.ts

`App.tsx` imports everything from `./engine`, but `engine.ts` is just a thin re-export:

```ts
// widgets/japanese-verb-tower/src/engine.ts:1-5
// Thin barrel — re-exports everything from the three implementation modules.
// App.tsx imports: makeVerb, buildTower, FEATURED_KANJI, Verb, Tier, DictEntry.
export * from './morph';
export * from './types';
export * from './ops';
```

The real code is in `morph.ts` (morphology primitives), `types.ts` (the type system), and `ops.ts` (operator implementations and the public pipeline API). The barrel keeps the import path stable while letting the three modules stay focused.

### Threading types: Form, FormType, and OpId

The engine is a *typed rewrite system*. At each conjugation step, a `Form` value is consumed and a new `Form` is produced. `FormType` is the discriminant that tells every operator which stem rules to apply:

```ts
// widgets/japanese-verb-tower/src/types.ts:3-10
export type FormType =
  | 'godan' | 'godan-iku' | 'godan-u-s' | 'godan-r-i' | 'godan-aru'
  | 'ichidan' | 'suru' | 'kuru'
  | 'i-adjective' | 'na-adjective' | 'adverbial' | 'te-form'
  | 'volitional' | 'imperative' | 'conditional-ba' | 'conditional-tara'
  | 'plain-past' | 'i-adj-past'
  | 'polite' | 'polite-neg' | 'polite-past' | 'polite-neg-past' | 'polite-volitional'
  | 'must' | 'must-not' | 'must-polite' | 'request' | 'must-casual';
```

The verb classes (`godan`, `ichidan`, `suru`, `kuru`) coexist with terminal forms (`volitional`, `polite-neg-past`, …) in a single union because `Form` carries both the current surface string *and* a label that determines what transformations remain possible.

`Form` itself is the threading type that flows through every `apply` call — its full definition is shown in [§ State and data flow](#state-and-data-flow). The optional fields capture irregularities: `suruPrefix` distinguishes bare する from compound-suru verbs like 勉強する, and `euphony` flags the two godan sub-classes (行く and 問う) that deviate from the standard sound-change tables.

`OpId` is the exhaustive union of operation names — what a user can toggle in the menu:

```ts
// widgets/japanese-verb-tower/src/types.ts:23-33
export type OpId =
  | 'causative' | 'passive' | 'potential' | 'causative-passive'
  | 'polite' | 'negative' | 'past' | 'negative-past' | 'te' | 'adverbial'
  | 'tai' | 'tagaru' | 'yasui' | 'nikui' | 'sugiru' | 'sou' | 'naru'
  | 'volitional' | 'imperative' | 'ba' | 'tara'
  | 'te-iru' | 'te-kuru' | 'te-iku' | 'te-shimau' | 'te-oku' | 'te-aru'
  | 'te-shimau-colloq'
  | 'naosu'
  | 'hajimeru' | 'owaru' | 'tsuzukeru' | 'dasu'
  | 'must' | 'must-not' | 'may' | 'need-not' | 'kudasai' | 'kudasai-not'
  | 'must-nke-ikenai' | 'must-nakutewa-naranai' | 'must-nakutewa-ikenai' | 'must-nakya' | 'must-nakucha';
```

Using a discriminated union rather than `string` means the TypeScript compiler catches any op name typo or missing `switch` branch throughout the codebase.

### The Op interface and self-registration

Each conjugation rule is an object implementing `Op`:

```ts
// widgets/japanese-verb-tower/src/ops.ts:134-141
export interface Op {
  id: OpId;
  label: string;
  aux: string;
  family: OpFamily;
  tooltip: string;
  apply(form: Form): Form;
}
```

`apply` is the rule: it receives the current `Form` and returns the transformed `Form`. `aux` is the short morpheme string shown in the UI badge (e.g. `'せる／させる'`). `family` groups ops into UI sections (`'core'`, `'desire'`, `'compound'`, `'aspect'`, …).

Ops register themselves at module load time via a three-line pattern:

```ts
// widgets/japanese-verb-tower/src/ops.ts:143-145
const OPS: Op[] = [];
const OPS_MAP = new Map<OpId, Op>();
function reg(op: Op) { OPS.push(op); OPS_MAP.set(op.id, op); }
```

Every `reg(...)` call below these three lines pushes the op into the ordered array and indexes it by id. `OPS` preserves declaration order for the menu; `OPS_MAP` gives O(1) lookup during pipeline execution. The pattern avoids any external registry file: add a new `reg({…})` block and it is automatically available everywhere.

### Stem helpers

Japanese conjugation attaches suffixes not to the dictionary form but to a *stem* — a derived base that depends on the verb class. Three helpers dispatch on `form.type`:

```ts
// widgets/japanese-verb-tower/src/ops.ts:66-78
// Verb I-stem (連用形).
function iStem(form: Form): string {
  const b = base(form);
  switch (form.type) {
    case 'godan': case 'godan-iku': case 'godan-u-s':
    case 'godan-r-i': case 'godan-aru':
      return godanStem(b, GODAN_I);
    case 'ichidan': return dropRu(b);
    case 'suru':    return (form.suruPrefix ?? '') + 'し';
    case 'kuru':    return form.kana.slice(0, -2) + 'き';
    default: throw new Error(`iStem: unsupported type ${form.type}`);
  }
}
```

The I-stem (連用形) is what polite, negative, and desire operators attach to. `aStem` (未然形) uses the same skeleton but routes godan endings through `GODAN_A` and is the basis for voice operators:

```ts
// widgets/japanese-verb-tower/src/ops.ts:80-92
// Verb A-stem (未然形).
function aStem(form: Form): string {
  const b = base(form);
  switch (form.type) {
    case 'godan': case 'godan-iku': case 'godan-u-s':
    case 'godan-r-i': case 'godan-aru':
      return godanStem(b, GODAN_A);
    case 'ichidan': return dropRu(b);
    case 'suru':    return (form.suruPrefix ?? '') + 'さ';
    case 'kuru':    return form.kana.slice(0, -2) + 'こ';
    default: throw new Error(`aStem: unsupported type ${form.type}`);
  }
}
```

`teForm` handles the additional euphonic mutation (う/つ/る → った, む/ぶ/ぬ → んで, …):

```ts
// widgets/japanese-verb-tower/src/ops.ts:94-108
// TE-form (te stem = euphonic て/で).
function teForm(form: Form): string {
  const b = base(form);
  switch (form.type) {
    case 'godan': case 'godan-iku': case 'godan-u-s':
    case 'godan-r-i': case 'godan-aru': {
      const ta = godanTaForm(b, form.euphony);
      return ta.slice(0, -1) + (ta.endsWith('だ') ? 'で' : 'て');
    }
    case 'ichidan': return dropRu(b) + 'て';
    case 'suru':    return (form.suruPrefix ?? '') + 'して';
    case 'kuru':    return form.kana.slice(0, -2) + 'きて';
    default: throw new Error(`teForm: unsupported type ${form.type}`);
  }
}
```

The godan branch delegates the ta-form mutation to `godanTaForm` (which encodes the full sound-change table), then swaps the trailing `た/だ` for `て/で`.

All three helpers call `godanStem(kana, table)` from `morph.ts`, which performs the core final-character table lookup:

```ts
// widgets/japanese-verb-tower/src/morph.ts:91-96
export function godanStem(kana: string, table: Record<string, string>): string {
  const last = kana.slice(-1);
  const s = table[last];
  if (s === undefined) throw new Error(`godanStem: no entry for '${last}' in '${kana}'`);
  return kana.slice(0, -1) + s;
}
```

The three tables it accepts are constant maps keyed on the nine possible godan endings:

```ts
// widgets/japanese-verb-tower/src/morph.ts:78-89
export const GODAN_A: Record<string, string> = {
  'う': 'わ', 'く': 'か', 'ぐ': 'が', 'す': 'さ',
  'つ': 'た', 'ぬ': 'な', 'ぶ': 'ば', 'む': 'ま', 'る': 'ら',
};
export const GODAN_I: Record<string, string> = {
  'う': 'い', 'く': 'き', 'ぐ': 'ぎ', 'す': 'し',
  'つ': 'ち', 'ぬ': 'に', 'ぶ': 'び', 'む': 'み', 'る': 'り',
};
export const GODAN_E: Record<string, string> = {
  'う': 'え', 'く': 'け', 'ぐ': 'げ', 'す': 'せ',
  'つ': 'て', 'ぬ': 'ね', 'ぶ': 'べ', 'む': 'め', 'る': 'れ',
};
```

`GODAN_A` is the negative/causative stem row, `GODAN_I` the polite/desire row, `GODAN_E` the potential row. Swapping the table argument is the only difference between three otherwise-identical stem computations.

### Recursive form composition

The most important design decision in the engine is how voice operators (causative, passive, potential) return their result. Japanese verb conjugation is agglutinative: each morpheme layer attaches to a specific stem of the preceding form, and the output of a voice layer is itself a fresh ichidan verb with its own stems, enabling recursive composition with a tiny rule set. The pipeline order:

```
// widgets/japanese-verb-tower/README.md:19-21
BASE → [causative?] → [passive? XOR potential?] → [polite?] → [negative?] → [past?]
```

After any voice layer, the working class becomes **ichidan** for every downstream operator. This is why 飲ませる (godan causative) then takes the ichidan passive -られる to give 飲ませられる, then the ichidan negative -ない to give 飲ませられない — the entire downstream rule set reuses without special cases.

The implementation encodes this exactly: every voice op's `apply` returns `{ kana, type: 'ichidan' }` regardless of the input class.

```ts
// widgets/japanese-verb-tower/src/ops.ts:149-161
reg({ id:'causative', label:'Causative', aux:'せる／させる', family:'core',
  tooltip:'make/let someone do — a-stem + せる/させる; result conjugates as ichidan.',
  apply(f): Form {
    let kana: string;
    switch (f.type) {
      case 'suru': kana = (f.suruPrefix??'') + 'させる'; break;
      case 'kuru': kana = f.kana.slice(0,-2) + 'こさせる'; break;
      case 'ichidan': kana = dropRu(base(f)) + 'させる'; break;
      default: kana = godanStem(base(f), GODAN_A) + 'せる';
    }
    return { kana, type: 'ichidan' };
  },
});
```

```ts
// widgets/japanese-verb-tower/src/ops.ts:163-175
reg({ id:'passive', label:'Passive', aux:'れる／られる', family:'core',
  tooltip:'passive/suffered — a-stem + れる/られる; result is ichidan.',
  apply(f): Form {
    let kana: string;
    switch (f.type) {
      case 'suru': kana = (f.suruPrefix??'') + 'される'; break;
      case 'kuru': kana = f.kana.slice(0,-2) + 'こられる'; break;
      case 'ichidan': kana = dropRu(base(f)) + 'られる'; break;
      default: kana = godanStem(base(f), GODAN_A) + 'れる';
    }
    return { kana, type: 'ichidan' };
  },
});
```

```ts
// widgets/japanese-verb-tower/src/ops.ts:177-189
reg({ id:'potential', label:'Potential', aux:'える／られる', family:'core',
  tooltip:'can — godan e-stem+る; ichidan A+られる; する→できる; くる→こられる.',
  apply(f): Form {
    let kana: string;
    switch (f.type) {
      case 'suru': kana = (f.suruPrefix??'') + 'できる'; break;
      case 'kuru': kana = f.kana.slice(0,-2) + 'こられる'; break;
      case 'ichidan': kana = dropRu(base(f)) + 'られる'; break;
      default: kana = godanStem(base(f), GODAN_E) + 'る';
    }
    return { kana, type: 'ichidan' };
  },
});
```

Because `apply` returns `{ type: 'ichidan' }`, *every operator downstream sees an ichidan verb and applies ichidan rules* — no special-casing for "what was the original class?" Each operator knows only what `form.type` says right now; the history is irrelevant.

### buildTower: a left-fold

`buildTower` is the public entry point for the component. It takes a `Verb` and an array of `OpId` values, runs each op in order, and emits one `Tier` record per layer:

```ts
// widgets/japanese-verb-tower/src/ops.ts:568-579
export function buildTower(verb: Verb, arg: TowerOpts | OpId[]): Tier[] {
  const ops: OpId[] = Array.isArray(arg) ? arg : optsToOps(arg);
  const tiers: Tier[] = [];
  const splice = (k: string) => verb.kanjiPrefix + k.slice(verb.prefixLen);

  // Base tier (always shows dictionary form)
  tiers.push({
    op: 'base', layer: 'base', type: baseForm(verb).type,
    kana: verb.kana, kanji: verb.kanji, romaji: verb.romaji,
    label: 'base', aux: '', gloss: verb.gloss,
    hlKana: [0, 0], hlKanji: [0, 0],
  });
```

The base tier pushes the dictionary form unconditionally. `splice` is a closure over `verb.kanjiPrefix` that reconstructs the kanji surface by grafting the kana tail onto the unchanging kanji prefix (e.g. 飲 + む→ます). After the base tier, `form` is initialised from `baseForm(verb)` and the threading loop begins:

```ts
// widgets/japanese-verb-tower/src/ops.ts:585-605
  for (const opId of ops) {
    const op = OPS_MAP.get(opId);
    if (!op) throw new Error(`Unknown op: ${opId}`);
    const newForm = op.apply(form);
    // After the first op, conjStem is consumed — new form is the full string
    const prevKana  = tiers[tiers.length - 1].kana;
    const prevKanji = tiers[tiers.length - 1].kanji;
    const newKana   = newForm.kana;
    // kuru terminal forms (volitional/imperative/ba) are conventionally written all-kana
    const newKanji  = (verb.klass === 'kuru' && KURU_NO_KANJI.has(newForm.type))
      ? newKana
      : splice(newKana);
    tiers.push({
      op: opId, layer: opId, type: newForm.type,
      kana: newKana, kanji: newKanji, romaji: kanaToRomaji(newKana),
      label: opId, aux: op.aux, gloss: '',
      hlKana:  highlightRange(prevKana,  newKana),
      hlKanji: highlightRange(prevKanji, newKanji),
    });
    form = newForm;
  }
```

This is a left-fold: `form` is the accumulator, each iteration replaces it with `op.apply(form)`. The `Tier` pushed per iteration carries both the cumulative surface string (`kana`, `kanji`) and the highlight range — the byte offsets of what changed relative to the previous tier's string. That range is what the visual tower uses to show the morpheme contribution of each layer. (Visual treatment of the slabs is in the [design track](../design/03-japanese-verb-tower.md).)

### allowedOps: the legal-move guard

`allowedOps(form, stack)` returns the set of `OpId` values that are grammatically legal to add next, given the current `Form` and the ops already in the stack:

```ts
// widgets/japanese-verb-tower/src/ops.ts:618-631
export function allowedOps(form: Form, stack: OpId[]): OpId[] {
  // Global depth cap
  if (stack.length >= 8) return [];

  const t = form.type;

  // Terminals
  if (t === 'volitional' || t === 'imperative' || t === 'conditional-ba'
      || t === 'te-form' || t === 'conditional-tara'
      || t === 'polite-past' || t === 'polite-neg-past' || t === 'polite-volitional'
      || t === 'request' || t === 'must-casual') {
    return [];
  }
```

Two structural guards fire before any per-op logic: the depth cap (`stack.length >= 8` → empty set) and the terminal-type check (forms that can accept no further morphemes → empty set). Neither is a runtime error — illegal states simply produce an empty menu.

After those two, the function builds a base set of allowed ops for the current `form.type`, then prunes it with a series of "once-each" guards:

```ts
// widgets/japanese-verb-tower/src/ops.ts:667-684
  // Voice once
  const hasVoice = stack.some(id => VOICE_OPS.has(id));
  const hasCausative = stack.includes('causative');
  const hasPassive = stack.some(id => id === 'passive' || id === 'potential' || id === 'causative-passive');
  if (hasCausative) allowed.delete('causative');
  if (hasPassive)   { allowed.delete('passive'); allowed.delete('potential'); allowed.delete('causative-passive'); }
  if (hasVoice && !hasCausative) { allowed.delete('causative'); allowed.delete('causative-passive'); }
  if (hasVoice) { allowed.delete('causative-passive'); }

  // Desire once / not on adj (i-adjective already excluded above since verb-only ops)
  const hasDesire = stack.some(id => DESIRE_OPS.has(id));
  if (hasDesire) { DESIRE_OPS.forEach(id => allowed.delete(id)); }

  // Naosu once
  if (stack.includes('naosu')) allowed.delete('naosu');

  // Compound (phase) once
  if (stack.some(id => COMPOUND_OPS.has(id))) { COMPOUND_OPS.forEach(id => allowed.delete(id)); }
```

Voice is enforced once-per-stack and mutually exclusive for passive/potential (you can add causative *and then* passive, but not two passives). Desire ops (`tai`, `yasui`, `nikui`, `tagaru`) are once-per-stack as a group. Compound aspect verbs (`hajimeru`, `owaru`, `tsuzukeru`, `dasu`) are likewise once-per-stack. Further guards later in the function prevent double-negation and cap te-auxiliary stacking at two.

The consequence is that **grammatically illegal orderings are never presented to the user**. The UI doesn't validate after the fact and show an error — the option simply isn't in the menu. `allowedOps` is called inside a `useMemo` on every render, making the menu state a pure function of `(currentForm, stack)`.

### finalForm: pipeline replay

`finalForm` is a lightweight companion to `buildTower`. It runs the same `Op.apply` chain but discards intermediate tiers, returning only the terminal `Form`:

```ts
// widgets/japanese-verb-tower/src/ops.ts:740-748
export function finalForm(verb: Verb, ops: OpId[]): Form {
  let form = baseForm(verb);
  for (const opId of ops) {
    const op = OPS_MAP.get(opId);
    if (!op) throw new Error(`Unknown op: ${opId}`);
    form = op.apply(form);
  }
  return form;
}
```

The component calls `finalForm` (via `useMemo`) to get the `Form` that `allowedOps` needs — the current conjugated state without the overhead of building the full `Tier[]`. `buildTower` and `finalForm` are intentionally kept separate: `buildTower` is golden-tested against committed fixtures (covered in [§ Testing the domain engine](#testing-the-domain-engine)), and splitting the two functions means the test can verify tier-level output without coupling it to the menu-logic path.

With the engine fully mapped, the next section shows how raw user input — including romaji — is normalised and ranked before it reaches the verb list.

## Input transformation and search

The search box is a [controlled input](./01-function-plotter.md) — the same pattern from tutorial 01. What is new here is the pipeline between the raw keystroke and the entries that surface: romaji characters are converted to kana before matching, results are ranked by match quality across four tiers, and conjugated forms can be typed directly and resolved back to their base verbs.

### `romajiToKana`: wāpuro romaji → hiragana

The lookup table maps romaji fragments to hiragana strings. A small slice of its shape:

```ts
// widgets/japanese-verb-tower/src/romaji.ts:8-13
const ROMAJI_TABLE: Record<string, string> = {
  // pure vowels
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
  // k / g
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
  ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
```

The full table covers gojūon, dakuten/handakuten, yōon compounds (`sha`, `kya`, `cho`…), and wāpuro variants (`si→し`, `ti→ち`, `tu→つ`). Understanding the *shape* — a flat `Record<string, string>` keyed on 1–4-char romaji fragments — is what matters.

`romajiToKana` opens by lowercasing and trimming, then walks the string character by character. The first check passes existing kana and kanji straight through:

```ts
// widgets/japanese-verb-tower/src/romaji.ts:59-67
export function romajiToKana(input: string): string {
  const s = String(input).toLowerCase().replace(/　/g, ' ').trim();
  let out = '';
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === ' ' || ch === '-') { i++; continue; }
    // ー / existing kana / kanji pass through
    if (/[ぁ-んァ-ヶー一-龯]/.test(ch)) { out += ch; i++; continue; }
```

This is why pasting `飲む` or `のむ` directly into the search field works without special-casing — the function is idempotent on already-converted input.

#### Greedy longest-match

After the pass-through check, the table lookup is greedy: it tries a 4-character fragment first, then 3, 2, 1, taking the first hit:

```ts
// widgets/japanese-verb-tower/src/romaji.ts:88-95
    // greedy longest match: try 4,3,2,1 chars
    let matched = false;
    for (let len = 4; len >= 1; len--) {
      const frag = s.substr(i, len);
      if (ROMAJI_TABLE[frag]) { out += ROMAJI_TABLE[frag]; i += len; matched = true; break; }
    }
    if (!matched) { out += ch; i++; }
```

Longest-match is essential for compound syllables. `sha` must win over `s` + `ha` (producing `し` rather than `す` + `は`). `tchi` must win at three characters for the sokuon prefix, then hand off the `chi` match — more on that below. Without greedy longest-match, these sequences would silently produce wrong kana.

#### ん before sokuon

Two special branches run *before* the table lookup, in this order intentionally. First, ん:

```ts
// widgets/japanese-verb-tower/src/romaji.ts:69-81
    // ん handling (before sokuon so 'nn'/'nb' aren't read as gemination)
    if (ch === 'n') {
      const n2 = s[i + 1];
      if (n2 === undefined || n2 === ' ' || n2 === '-') { out += 'ん'; i++; continue; }
      if (n2 === "'") { out += 'ん'; i += 2; continue; }
      if (n2 === 'n') {
        const n3 = s[i + 2];
        if (n3 && 'aiueoy'.includes(n3)) { out += 'ん'; i++; continue; } // nni → ん + に
        out += 'ん'; i += 2; continue;
      }
      if (!'aiueoy'.includes(n2)) { out += 'ん'; i++; continue; }
      // else n+vowel/ny → fall through to table (na/ni/…/nya)
    }
```

The rule: `n` followed by end-of-string, space, `-`, or `'` emits ん. `n` followed by a non-`aiueoy` consonant (like `b` in `shinbun`) also emits ん and re-examines the consonant. `nn` before a vowel emits ん once and leaves the second `n` for the table (`nni → ん + に`). `nn` before anything else collapses the double-n into a single ん.

This must run *before* the sokuon check. If the order were reversed, `nn` would be read as gemination — the doubled `n` would emit っ — which is wrong. ん disambiguation takes priority.

Then sokuon (っ gemination):

```ts
// widgets/japanese-verb-tower/src/romaji.ts:83-86
    // sokuon: same consonant doubled (kk, tt, ss, pp…), and tch → っち
    const next = s[i + 1];
    if (SOKUON.has(ch) && next === ch) { out += 'っ'; i++; continue; }
    else if (ch === 't' && next === 'c' && s[i + 2] === 'h') { out += 'っ'; i++; continue; }
```

`SOKUON` is the set of consonants that double into っ:

```ts
// widgets/japanese-verb-tower/src/romaji.ts:57
const SOKUON = new Set(['k', 's', 't', 'c', 'p', 'g', 'z', 'j', 'd', 'b', 'f', 'h', 'm', 'r', 'w', 'y', 'v']);
```

When the doubled-consonant check fires, it emits っ and advances `i` by one — leaving the repeated character in place for the next iteration, which then matches it normally against the table. The `tch` branch is a special case: `t` + `c` + `h` emits っ and advances by one, then the remaining `ch` falls through to match `chi → ち`, giving the full `tchi → っち`.

### `hasJapanese`: the gate

Before conversion, the caller checks whether the input already contains kana or kanji:

```ts
// widgets/japanese-verb-tower/src/romaji.ts:99-102
// True if the input contains any Japanese kana/kanji (so we skip romaji conversion).
export function hasJapanese(s: string): boolean {
  return /[ぁ-んァ-ヶー一-龯]/.test(s);
}
```

`hasJapanese` is the caller-level gate: if the raw input is already Japanese, conversion is skipped entirely and the string is used as-is for matching.

### `searchEntries`: four-tier ranking

The search function applies both functions and then ranks matches by specificity:

```ts
// widgets/japanese-verb-tower/src/App.tsx:67-83
function searchEntries(raw: string, data: DictEntry[]): DictEntry[] {
  const lo   = raw.toLowerCase();
  const kana = hasJapanese(raw) ? raw : romajiToKana(lo);
  const tiers: [DictEntry[], DictEntry[], DictEntry[], DictEntry[]] = [[], [], [], []];
  const seen = new Set<string>();
  for (const e of data) {
    const key = e.k + '\0' + e.r;
    if (seen.has(key)) continue;
    let t: number;
    if      (e.r === kana)            t = 0;
    else if (e.r.startsWith(kana))    t = 1;
    else if (e.k.includes(raw))       t = 2;
    else if (e.romaji.startsWith(lo)) t = 3;
    else continue;
    seen.add(key);
    tiers[t].push(e);
  }
```

Line 69 is the pivot: if the raw string contains Japanese characters, use it verbatim as `kana`; otherwise run it through `romajiToKana`. The four tiers, in priority order:

| Tier | Condition | Meaning |
|------|-----------|---------|
| 0 | `e.r === kana` | Exact reading match |
| 1 | `e.r.startsWith(kana)` | Reading prefix |
| 2 | `e.k.includes(raw)` | Kanji substring |
| 3 | `e.romaji.startsWith(lo)` | Romaji prefix on the stored field |

Tier 3 exists so that typing `tab` still surfaces 食べる while the kana `た` (from `romajiToKana("tab")`) would only partially match. Results are flattened in tier order and capped at 30 entries.

**Homophone disambiguation.** The `seen` set deduplicates on `kanji + '\0' + reading`, not on reading alone. Homophones — entries that share a reading but differ in kanji — appear as separate rows, each with its own meaning. Typing `かう` surfaces 買う (buy), 飼う (keep a pet), and 交う (cross) as distinct selectable results.

### `deconjugate`: the reverse direction

The search box also accepts conjugated forms. Type `食べられませんでした` and the widget recovers 食べる plus the op stack that produced that form. `deconjugate` is the entry point:

```ts
// widgets/japanese-verb-tower/src/deconjugate.ts:761-771
export function deconjugate(input: string, corpus: DeconjCorpus): Parse[] {
  const cur0 = hasJapanese(input) ? input : romajiToKana(input);

  const results: Parse[] = [];
  const seen = new Set<string>();

  // Node-count budget: abort expansion if exceeded to prevent runaway search.
  // Warning is emitted at most once per deconjugate() call.
  const NODE_BUDGET = 300_000;
  let nodeCount = 0;
  let budgetWarned = false;
```

The function applies `hasJapanese`/`romajiToKana` to the input first — the same gate as `searchEntries` — then searches backwards through conjugation patterns. Each candidate is forward-verified by re-running `buildTower` on the recovered base verb and op stack; only candidates whose forward form matches the original input survive. The node-budget guard caps the search expansion at 300,000 nodes per call to prevent runaway search on ambiguous inputs.

The results are typed as `Parse[]`:

```ts
// widgets/japanese-verb-tower/src/deconjugate.ts:23-30
export interface Parse {
  base: DictEntry;
  verb: Verb;
  ops: OpId[];
  kana: string;
  kanji: string;
  score: number;
}
```

`base` is the dictionary entry for the identified root verb. `ops` is the recovered op stack — the same `OpId[]` type that drives `buildTower` ([§ The conjugation engine](#the-conjugation-engine)). `score` is a heuristic used to rank candidates when multiple parses are plausible. Given a conjugated form as a string and a `DeconjCorpus` (built from the same `DictEntry[]` that drives search), it returns a ranked list of plausible base verb + op stack pairs, each forward-verified by the engine.

With search and input normalisation in place, the next section covers the four `useEffect` patterns that wire everything together asynchronously.

## Effects and async integration

For `useEffect` mechanics — dep arrays, cleanup timing, and the guarantee that effects run after the browser paints — see [tutorial 01](./01-function-plotter.md). For reading the URL at mount with `URLSearchParams`, see [tutorial 02](./02-image-comparison-table.md). This section covers four `useEffect` patterns that `App.tsx` adds on top of those foundations: a lazy code-split corpus load, a bidirectional URL write, a gloss re-derivation fixup, and a debounced abortable fetch.

### Lazy code-split corpus import

The verb dictionary ships in two sizes. A 300-entry sample is bundled inline and seeds the search box before any network activity:

```ts
// widgets/japanese-verb-tower/src/App.tsx:25
const SAMPLE = sampleDataJson as unknown as DictEntry[];
```

```ts
// widgets/japanese-verb-tower/src/App.tsx:212
const [allEntries, setAllEntries] = useState<DictEntry[]>(SAMPLE);
```

The full 26,784-entry corpus is loaded after the first paint:

```ts
// widgets/japanese-verb-tower/src/App.tsx:230-240
useEffect(() => {
  import('./data/verbs.full.json')
    .then((m) => {
      const full = (m.default as unknown) as DictEntry[];
      byReadingRef.current = buildByReading(full);
      setAllEntries(full);
      setDictSize(full.length);
      setDictLoading(false);
    })
    .catch(() => { setDictLoading(false); });
}, []);
```

The empty dep array fires this effect once, after the first paint. The mechanism that keeps the corpus separate is Vite's static analysis of the `import()` call: because the specifier is a bare string literal with a relative path and file extension, Vite extracts the JSON file into a separate JS chunk at build time, content-hashed and emitted as its own file. At runtime the browser fetches that chunk only when execution reaches the `import()` call — not a byte sooner. The JSON becomes the module's default export, hence `m.default`.

The `.catch` is the silent-fallback contract: if the chunk fails to load because the user is offline or because a new deploy rotated the content-hash URL, the rejection is swallowed and only `setDictLoading(false)` is called. `allEntries` remains the 300-entry `SAMPLE`. The widget keeps running, `#widget-ready` has already fired, and no error state is shown.

### Bidirectional URL state — the write side

Tutorial 02 read the URL once at mount and never touched it again. This widget round-trips: every state change writes back to the URL, and restore validates what was written. The read side (parsing and seeding `INITIAL_STATE`) is covered in [§ Initialisation and the ready signal](#initialisation-and-the-ready-signal). This section covers the write side and the tamper guard on restore.

`serializeState` encodes what goes into the query string:

```ts
// widgets/japanese-verb-tower/src/urlstate.ts:15-24
export function serializeState(verb: Verb, ops: OpId[]): string {
  const params = new URLSearchParams();
  params.set('k', verb.kanji);
  params.set('r', verb.kana);
  params.set('c', verb.rawClass ?? '');
  if (ops.length > 0) {
    params.set('o', ops.join(','));
  }
  return params.toString();
}
```

`k`, `r`, `c` encode the kanji form, kana reading, and verb class. `o` is the comma-joined op sequence. The gloss is deliberately absent — it would add length to every URL and is re-derivable from the corpus (see the next section).

`writeState` calls `replaceState` and wraps it in `try/catch`:

```ts
// widgets/japanese-verb-tower/src/App.tsx:36-42
function writeState(verb: Verb, ops: OpId[]): void {
  try {
    history.replaceState(history.state, '', '?' + serializeState(verb, ops));
  } catch {
    // sandboxed iframe / history restricted — no-op
  }
}
```

`replaceState` rather than `pushState`: conjugation layers are toggled continuously, and each toggle updates the URL. `pushState` would flood the back stack with dozens of entries — one per toggle. `replaceState` modifies the current history entry in place, so the back button still takes the user to wherever they came from. The `try/catch` exists because the widget embeds in arbitrary host pages — a sandboxed iframe without `allow-same-origin` throws `SecurityError` on any `history` call. URL state is best-effort.

The effect that drives every write is a single dependency pair:

```ts
// widgets/japanese-verb-tower/src/App.tsx:249-251
useEffect(() => {
  writeState(selectedVerb, stack);
}, [selectedVerb, stack]);
```

No async work, no cleanup needed. Every time `selectedVerb` or `stack` changes, `writeState` runs synchronously.

**Tamper guard on restore.** When `parseState` reconstructs the op sequence from a URL, it does not trust that the sequence is legal — a user could hand-craft a URL with an impossible ordering. The guard is a replay loop:

```ts
// widgets/japanese-verb-tower/src/urlstate.ts:56-63
    // Validate the full sequence is reachable
    let form = baseForm(verb);
    const stackSoFar: OpId[] = [];
    for (const op of ops) {
      if (!allowedOps(form, stackSoFar).includes(op)) return null;
      stackSoFar.push(op);
      form = OP_META[op].apply(form);
    }
```

Each op is fed through `allowedOps(form, stackSoFar)` before being accepted. If any op is not reachable from the current form and accumulated stack, `parseState` returns `null` and the widget loads with its default state. The outer `parseState` body is inside its own `try/catch`, so any unexpected throw also collapses to a clean `null`. A tampered URL is silently rejected rather than crashing the component.

### Gloss re-derivation on corpus load

The URL encodes `k`, `r`, and `c` — not the gloss. When a shared URL is opened, the restored `Verb` has `gloss: ''`. The widget handles this with a pure helper and a targeted effect:

```ts
// widgets/japanese-verb-tower/src/App.tsx:50-54
function withGloss(verb: Verb, entries: DictEntry[]): Verb {
  if (verb.gloss) return verb;
  const e = entries.find(x => x.k === verb.kanji && x.r === verb.kana);
  return e ? makeVerb(e) : verb;
}
```

`withGloss` returns the verb unchanged if it already has a gloss. Otherwise it matches kanji+kana against the loaded entries and constructs a full `Verb` from the matching `DictEntry`. If no match is found yet — the full corpus hasn't arrived — it returns the original verb unchanged.

The effect keys on `allEntries`:

```ts
// widgets/japanese-verb-tower/src/App.tsx:245-247
useEffect(() => {
  setSelectedVerb(v => (v.gloss ? v : withGloss(v, allEntries)));
}, [allEntries]);
```

This fires twice: once on mount (with the 300-entry `SAMPLE`) and again when the full corpus lands and `allEntries` changes. The functional updater form reads the current `selectedVerb` at call time — safe under batching — and short-circuits immediately on the inner `v.gloss` check, producing no re-render when the gloss is already present.

Why `allEntries` in the dep array and not `selectedVerb`? The gloss is only missing for URL-restored verbs. A verb picked from the search box always has a gloss. Keying on `allEntries` means this effect fires exactly when new data is available to fill the gap, not on every verb selection.

### Debounced, abortable translation fetch

The fourth effect is the most involved. It fetches an AI-generated translation of the current conjugated form, but the user may be toggling layers while it runs. Three problems need simultaneous solutions: avoiding stale state from races, avoiding wasteful network calls for intermediate forms, and failing silently so translation never blocks the rest of the UI.

```ts
// widgets/japanese-verb-tower/src/App.tsx:283-298
useEffect(() => {
  if (stack.length === 0 || !topForm) { setTranslation(null); setTranslating(false); return; }
  const base = selectedVerb.gloss;
  const cached = peekTranslation({ base, form: topForm });
  if (cached !== null) { setTranslation(cached.length > 0 ? cached : null); setTranslating(false); return; }
  let active = true;
  setTranslation(null);
  setTranslating(true);
  const controller = new AbortController();
  const timer = setTimeout(() => {
    fetchTranslation({ base, features, form: topForm }, controller.signal)
      .then(result => { if (!active) return; setTranslating(false); setTranslation(result && result.length > 0 ? result : null); })
      .catch(() => { if (!active) return; setTranslating(false); setTranslation(null); });
  }, 250);
  return () => { active = false; clearTimeout(timer); controller.abort(); };
}, [selectedVerb.gloss, topForm, stack]);
```

**Synchronous cache short-circuit (lines 286–287).** Before any timer or network work, `peekTranslation` checks both cache tiers synchronously:

```ts
// widgets/japanese-verb-tower/src/translate-client.ts:46-52
export function peekTranslation(req: { base: string; form: string }): string | null {
  const key = `${req.base} ${req.form}`;
  if (memCache.has(key)) return memCache.get(key)!;
  const stored = lsGet(key);
  if (stored !== null) { memCache.set(key, stored); return stored; }
  return null;
}
```

If the answer is in the in-memory Map or in `localStorage`, the effect returns immediately with no debounce, no timer, no network. After a page reload the translation for a previously seen form appears instantly.

**Two-tier cache (lines 5–14).** The cache is declared at module level so it persists across re-renders:

```ts
// widgets/japanese-verb-tower/src/translate-client.ts:5-14
const memCache = new Map<string, string>();
const LS_PREFIX = 'vt-translate:';

function lsGet(key: string): string | null {
  try { return localStorage.getItem(LS_PREFIX + key); } catch { return null; }
}

function lsSet(key: string, val: string): void {
  try { localStorage.setItem(LS_PREFIX + key, val); } catch { /* sandboxed iframe */ }
}
```

`memCache` is a `Map` that lives in module scope and survives re-renders; it is cleared only when the page unloads. `localStorage` survives reloads. Both `lsGet` and `lsSet` are wrapped in `try/catch`: `localStorage` throws `SecurityError` in sandboxed iframes and in some incognito contexts. The catch returns `null` on read (a miss) and silently swallows on write (a no-op), so the two-tier cache degrades to in-memory only when `localStorage` is unavailable — without any error surfacing to the component.

**Why both `AbortController` and the `active` flag (lines 288 and 297).** Each guard solves a different problem; neither is sufficient alone.

`AbortController` cancels the in-flight HTTP request. When the cleanup function runs — because `selectedVerb.gloss`, `topForm`, or `stack` changed — `controller.abort()` fires, causing the pending `fetch('/api/translate', { signal })` to reject with an `AbortError`. This stops the network request and frees server resources for a form the user has already moved past.

But abort is not synchronous with the Promise resolution chain. If the response body was already received and the Promise was already resolved in the microtask queue before `controller.abort()` executed, the `.then` callback still fires. The `active` flag closes that window: `if (!active) return` discards the result and never calls `setTranslating` or `setTranslation`. Without the flag, a stale translation from an intermediate form could overwrite whatever the new effect has set.

The flag alone, without abort, would prevent the stale `setState` — but the network request and the server's AI inference would still run to completion, consuming bandwidth, server compute, and rate-limit quota. Both guards are required: abort cancels work at the network layer; the flag discards anything that slips through.

**`fetchTranslation` — the full cache waterfall:**

```ts
// widgets/japanese-verb-tower/src/translate-client.ts:16-44
export async function fetchTranslation(req: TranslateRequest, signal?: AbortSignal): Promise<string | null> {
  const key = `${req.base} ${req.form}`;

  if (memCache.has(key)) return memCache.get(key)!;

  const stored = lsGet(key);
  if (stored !== null) { memCache.set(key, stored); return stored; }

  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ form: req.form, base: req.base, features: req.features }),
      signal,
    });

    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('application/json')) {
      return null;
    }

    const data = await res.json() as { translation?: unknown };
    const t = cleanTranslation(typeof data.translation === 'string' ? data.translation : '');
    memCache.set(key, t);
    lsSet(key, t);
    return t;
  } catch {
    return null;
  }
}
```

The waterfall is memCache → localStorage → network. A hit at either cache tier returns immediately. On a network request, every failure path returns `null`: non-200 status, wrong content-type, JSON parse error, `AbortError` from the signal, any other thrown exception. The effect's `.catch` mirrors this: `setTranslation(null)` with no further propagation.

**250 ms debounce (lines 292–296).** The `setTimeout` delays the fetch until the user has stopped toggling for a quarter-second. Without it, rapidly building a six-op stack would fire six separate network requests for intermediate forms — burning the rate-limit budget (`TRANSLATE_RL` allows 20 requests per 60-second window per IP). The timer handle is local to the effect closure, so the cleanup's `clearTimeout(timer)` cancels exactly the timer this particular run started.

For what happens at the `/api/translate` endpoint once the fetch arrives, the next section covers the Worker from the inside out.

## The Cloudflare Worker backend

The static SPA and its `/api/translate` endpoint are served from a single Cloudflare Worker. [§ The stack and why](#the-stack-and-why) introduced the `wrangler.jsonc` shape — `run_worker_first: ["/api/*"]`, the `tsconfig.worker.json` split, and the binding declarations. Here the focus is `worker.ts` itself: a single file that layers five cheap guards before reaching the AI call. Every request walks the same chain — route → CSRF check → rate limit → input caps → cache → AI — and each guard eliminates a class of problem before the expensive step downstream.

### The Worker module shape

A Cloudflare Worker exports a default object with an `async fetch` handler. The runtime injects platform bindings through an `Env` interface you declare:

```ts
// widgets/japanese-verb-tower/src/worker.ts:3-6
interface Env {
  AI: Ai;
  TRANSLATE_RL: RateLimit;
}
```

`AI` and `TRANSLATE_RL` are not imported — the platform constructs them and passes them into every invocation. `Ai` and `RateLimit` are ambient types from `@cloudflare/workers-types`, which is why `tsconfig.worker.json` keeps a separate `types` entry.

The handler signature exposes all three platform arguments:

```ts
// widgets/japanese-verb-tower/src/worker.ts:15-16
export default {
  async fetch(request, env, ctx) {
```

`request` is the incoming `Request`. `env` carries both bindings — `env.AI` wired by `wrangler.jsonc:16`, `env.TRANSLATE_RL` wired by `wrangler.jsonc:17-23`. `ctx` provides `ctx.waitUntil()`, which appears at the cache-write step.

### Route guard

The first check is the cheapest: reject anything that isn't a POST to the one path this Worker handles.

```ts
// widgets/japanese-verb-tower/src/worker.ts:20-22
if (request.method !== 'POST' || url.pathname !== '/api/translate') {
  return json({ error: 'not found' }, 404);
}
```

Every other method and every other path returns 404 immediately, before any other logic runs.

### `Sec-Fetch-Site` as a CSRF guard

```ts
// widgets/japanese-verb-tower/src/worker.ts:24-26
if (request.headers.get('Sec-Fetch-Site') === 'cross-site') {
  return json({ error: 'forbidden' }, 403);
}
```

`Sec-Fetch-Site` is a fetch-metadata header the browser attaches to every request automatically. Its critical property: JavaScript on another origin **cannot forge it**. When the widget's own page calls `/api/translate`, the browser sets `Sec-Fetch-Site: same-origin`; when a script on a different site attempts the same POST, the browser sets `cross-site` and the Worker refuses. That is the entire CSRF defence — no tokens, no session cookies needed. OWASP endorses this check as a complete CSRF mitigation for modern browsers. The caveat: very old browsers (pre-Chrome 76, pre-Safari 16.4) omit the header entirely, so absence alone is not a rejection signal.

### Rate-limit binding

```ts
// widgets/japanese-verb-tower/src/worker.ts:28-33
const { success } = await env.TRANSLATE_RL.limit({
  key: request.headers.get('CF-Connecting-IP') ?? 'anon',
});
if (!success) {
  return json({ error: 'rate limited' }, 429);
}
```

`env.TRANSLATE_RL` is a Workers rate-limit binding. One `await` call both increments the per-IP counter and tells you whether to proceed. The binding is declared in `wrangler.jsonc:17-23`:

```jsonc
// widgets/japanese-verb-tower/wrangler.jsonc:17-23
"ratelimits": [
  {
    "name": "TRANSLATE_RL",
    "namespace_id": "1001",
    "simple": { "limit": 20, "period": 60 }
  }
]
```

`period` must be exactly `10` or `60` — the platform accepts no other values. At 20 requests per 60 seconds per IP, the Worker stops abusive traffic before it reaches the AI call. Rate-limit counters are per-datacenter (edge-local), so this is a best-effort guard, not an exact accounting system.

### Input caps

After rate-limiting, the Worker parses the JSON body and applies size limits:

```ts
// widgets/japanese-verb-tower/src/worker.ts:46-53
if (
  typeof form !== 'string' || form.length === 0 || form.length > 512 ||
  typeof base !== 'string' || base.length > 256 ||
  !Array.isArray(features) || features.length > 50 ||
  !features.every((f): f is string => typeof f === 'string' && f.length <= 64)
) {
  return json({ error: 'invalid' }, 400);
}
```

`form` is the conjugated surface string (≤512 chars). `base` is the JMdict English gloss (≤256 chars). `features` is the ordered list of applied operations — the tower can stack ~50 layers, and each operation label is short (≤64 chars). These limits match real data while rejecting inflated payloads before they reach the AI model.

### Cache API memoization

Translation for a given `(base, form)` pair is deterministic, so the Worker caches it in the Cloudflare Cache API:

```ts
// widgets/japanese-verb-tower/src/worker.ts:55-58
const cacheKey = `https://verb-tower.internal/translate?b=${encodeURIComponent(base)}&f=${encodeURIComponent(form)}`;
const cache = caches.default;
const cached = await cache.match(cacheKey);
if (cached) return cached;
```

The Cache API requires a URL as the key — `verb-tower.internal` is a synthetic hostname that will never resolve to a real host. On a cache hit, the Worker returns immediately and the AI model is never called.

On a cache miss, after the AI call the result is stored:

```ts
// widgets/japanese-verb-tower/src/worker.ts:69-78
const res = json({ translation });
const responseToCache = new Response(JSON.stringify({ translation }), {
  status: 200,
  headers: {
    'content-type': 'application/json',
    'cache-control': 'public, max-age=604800',
  },
});
ctx.waitUntil(cache.put(cacheKey, responseToCache.clone()));
return res;
```

`max-age=604800` is seven days. The key line is `ctx.waitUntil(cache.put(...))`: `waitUntil` extends the Worker's lifetime so the cache write can complete after `res` is already returned to the client. The cache write is entirely off the critical path — the user never waits for it. One platform restriction: the Cache API requires a custom domain; `*.workers.dev` URLs bypass it. The widget is served from `japanese-verb-tower.widgets.beshir.org`, so the cache is active.

### The Workers AI call

```ts
// widgets/japanese-verb-tower/src/worker.ts:60-67
let translation = '';
try {
  const messages = buildTranslateMessages(base, features, form);
  const out = await env.AI.run('@cf/qwen/qwen3-30b-a3b-fp8', { messages, max_tokens: 512 }) as { response?: string };
  translation = cleanTranslation(out.response ?? '');
} catch {
  return json({ translation: '' });
}
```

`env.AI` is the Workers AI binding from `wrangler.jsonc:16` (`"ai": { "binding": "AI" }`). No API key is needed — auth is handled by the Cloudflare account. `env.AI.run` takes the model ID and an options object; the binding returns `{ response: string }` directly, already unwrapped from the REST envelope. If the call throws for any reason — quota, upstream error — the Worker returns `{ translation: '' }` rather than an error status, and the client treats an empty translation as a graceful no-op.

### The prompt and cleanup module

`buildTranslateMessages` and `cleanTranslation` live in `translate-shared.ts`, imported by both `worker.ts` and the client-side unit tests in `test/translate.ts`. Sharing the module ensures the same cleanup logic runs in tests as on the server.

`buildTranslateMessages` builds the two-message array:

```ts
// widgets/japanese-verb-tower/src/translate-shared.ts:6-17
export function buildTranslateMessages(
  base: string,
  features: string[],
  form: string,
): ChatMessage[] {
  const joined = features.join(' · ');
  return [
    {
      role: 'system',
      content:
        // Qwen3 soft switch: answer directly, no chain-of-thought.
        '/no_think\n' +
```

The system message opens with `/no_think\n`. This is a Qwen3-specific soft switch: a prompt-level instruction to skip internal chain-of-thought reasoning and answer directly. It reduces token usage and latency. It is not an API parameter — the model may still emit reasoning regardless.

`cleanTranslation` handles that defensively:

```ts
// widgets/japanese-verb-tower/src/translate-shared.ts:35-49
export function cleanTranslation(raw: string): string {
  if (typeof raw !== 'string' || raw.length === 0) return '';

  let s = raw.trim();
  if (s.length === 0) return '';

  // Drop any reasoning a model emits despite /no_think: remove complete
  // <think>…</think> blocks, then anything from an unclosed <think> onward.
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '');
  const thinkAt = s.indexOf('<think>');
  if (thinkAt !== -1) s = s.slice(0, thinkAt);
  s = s.replace(/<\/think>/gi, '').trim();
  if (s.length === 0) return '';

  s = s.split(/\r?\n/)[0].trim();
```

The function strips complete `<think>…</think>` blocks with a regex, then truncates at any remaining unclosed `<think>` tag — covering the case where the model begins a reasoning block but the response is cut short. Taking only the first line discards any model preamble. The unquote and de-period steps (`:53-68`) handle common model formatting habits: stripping one surrounding matched quote pair and a trailing period or `。`. The response arriving at the client is always a clean, short English phrase regardless of what the model emitted.

The layered design — route → CSRF check → rate limit → input caps → cache → AI call — adds a real AI backend to the static SPA at the cost of one Worker file and two binding declarations in `wrangler.jsonc`. For the client side of this pipeline — debouncing, aborting stale requests, and the two-tier client cache — see [§ Effects and async integration](#effects-and-async-integration).

Because the engine and `cleanTranslation` are pure TypeScript modules, the next section shows how to drive them in Node with zero framework overhead.

## Testing the domain engine

Because the engine (`types.ts`, `morph.ts`, `ops.ts`, `engine.ts`) is a pure TypeScript module — no Preact import, no DOM access — you can run it in Node without a browser. That is the payoff of the [framework-free domain module](./01-function-plotter.md) pattern from tutorial 01: when a module carries no runtime dependencies beyond plain TypeScript, a test runner only needs to execute TypeScript.

### The `tsx` runner

`tsx` ("TypeScript execute") runs `.ts` files directly in Node — no tsconfig negotiation, no compilation step, no test framework to configure. Each script is a file that drives the engine and calls `process.exit(1)` on any mismatch. The full set:

```json
// widgets/japanese-verb-tower/package.json:10-16
"test":             "tsx test/golden.ts",
"test:url":         "tsx test/urlstate.ts",
"test:deconj":      "tsx test/deconjugate.ts",
"test:deep":        "tsx test/deep.ts",
"test:translate":   "tsx test/translate.ts",
"typecheck":        "tsc -p tsconfig.json --noEmit",
"typecheck:worker": "tsc -p tsconfig.worker.json --noEmit"
```

No Jest, no Vitest — five scripts, each a direct `tsx test/*.ts` invocation. `typecheck` and `typecheck:worker` cover the two separate TypeScript projects; neither runs the engine, they just verify types.

### The golden pattern

`test/golden.json` is the committed expected-output contract: 80 `{verb, class, ops, expectedKana, expectedRomaji}` records covering every verb class and most op combinations. `test/golden.ts` loads it and re-runs `buildTower` over each entry:

```typescript
// widgets/japanese-verb-tower/test/golden.ts:22-39
for (const c of goldenJson as Array<{verb:string;class:string;ops:string[];expectedKana:string;expectedRomaji:string}>) {
  const kana = KANA_MAP[c.verb];
  if (!kana) { fails.push(`NO KANA MAP for "${c.verb}"`); continue; }

  const entry: DictEntry = { k: c.verb, r: kana, romaji: '', cls: c.class, common: true, gloss: 'x' };
  const verb = makeVerb(entry);
  const tiers = buildTower(verb, c.ops as OpId[]);
  const top = tiers[tiers.length - 1];

  const label = `${c.verb} [${c.ops.join(',')}]`;
  if (top.kanji !== c.expectedKana) {
    fails.push(`JSON KANJI  ${label}: got「${top.kanji}」want「${c.expectedKana}」`);
  } else if (top.romaji !== c.expectedRomaji) {
    fails.push(`JSON ROMAJI ${label}: got「${top.romaji}」want「${c.expectedRomaji}」`);
  } else {
    pass++;
  }
}
```

The pattern: store expected output as a committed JSON file, re-run the algorithm, diff. Adding a new op or fixing an edge case means regenerating the fixture and committing it — the committed diff is the review artifact, showing every surface form that changed and making regressions immediately visible.

The other test files stay narrow: `test/urlstate.ts` round-trips `serializeState` → `parseState` to verify URL encode/decode; `test/translate.ts` drives `cleanTranslation` unit cases against think-block stripping and de-period rules. `test/deep.ts` is a broader pipeline exercise for readers who want to go further.

With the engine tested in isolation, the final section shows the order in which to build everything from scratch.

## Putting it together

If you were building this from scratch, file creation order matters. Start with `package.json` — single runtime dependency (`preact`), dev stack of `vite`, `@preact/preset-vite`, `wrangler`, `tsx`, and `@cloudflare/workers-types`. Write `wrangler.jsonc` next (the `assets` block with `not_found_handling: "single-page-application"` and `run_worker_first: ["/api/*"]`) and `tsconfig.worker.json` alongside it, so the compiler picks up `@cloudflare/workers-types` in isolation before any worker code exists. Then build the pure engine in order — `types.ts`, `morph.ts`, `ops.ts`, the `engine.ts` barrel — and run `npm test` against `test/golden.json` immediately, while there is still no browser to spin up. Add `romaji.ts` and `deconjugate.ts`, then `urlstate.ts`, then the translation layer (`translate-shared.ts` + `worker.ts` + `translate-client.ts`). Write `index.html` and `main.tsx` last before `App.tsx`, which imports everything; its opening lines make the full dependency graph visible at a glance:

```tsx
// widgets/japanese-verb-tower/src/App.tsx:1-14
import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import type { JSX } from 'preact';
import {
  makeVerb, buildTower, FEATURED_KANJI, finalForm, allowedOps, disabledReason,
  OP_FAMILIES, OP_META, FORM_LABEL,
} from './engine';
import type { Verb, Tier, DictEntry, Form, OpId } from './engine';
import { romajiToKana, hasJapanese } from './romaji';
import { parseState, serializeState } from './urlstate';
import { fetchTranslation, peekTranslation } from './translate-client';
import { buildCorpus, deconjugate } from './deconjugate';
import type { Parse } from './deconjugate';
import sampleDataJson from './data/verbs.sample.json';
import adjDataJson from './data/adjectives.sample.json';
```

Five decisions carry the design. **(1)** The engine lives in a standalone module with no framework imports, so `npm test` can drive `buildTower` in Node via `tsx` with no browser (`ops.ts:568`). **(2)** Voice ops return `{type: 'ichidan'}` — `causative`, `passive`, and `potential` all produce the same output type, so the entire ichidan conjugation rule set reuses downstream with no branching per voice (`ops.ts:149`). **(3)** `allowedOps` enforces legal orderings structurally: depth cap, terminal-type early return, and once-each constraints reject illegal sequences in data before a user can build them, not in a runtime validator (`ops.ts:618`). **(4)** Translation is best-effort and never gates `#widget-ready` — `setReady(true)` fires in a `useEffect` with an empty dep array on first paint, independent of whether translation or the full corpus has loaded (`App.tsx:242`). **(5)** One Cloudflare Worker serves the SPA and `/api/*`: `run_worker_first: ["/api/*"]` intercepts translate requests; all other paths fall through to the static asset handler (`wrangler.jsonc:5-9`).

For the visual treatment — tower slab layout, suffix highlighting, and type-badge colours — see the design track at [`../design/03-japanese-verb-tower.md`](../design/03-japanese-verb-tower.md).

## Concepts introduced

| Concept | First taught (section) |
|---------|------------------------|
| Cloudflare Workers Static Assets SPA+API model (`run_worker_first`, `not_found_handling`) | The stack and why |
| Isolated `tsconfig.worker.json` with `@cloudflare/workers-types` | The stack and why |
| Module-level constant computed before component mount | Initialisation and the ready signal |
| `Op` interface + `reg()` self-registration | The conjugation engine |
| `buildTower()` threading loop (left-fold over `Op.apply`) | The conjugation engine |
| Recursive form composition (voice ops return `{type:'ichidan'}`) | The conjugation engine |
| Stem helper dispatch on `form.type` (`iStem`, `aStem`, `teForm`, `godanStem`) | The conjugation engine |
| `allowedOps()` pure legal-move guard | The conjugation engine |
| `finalForm()` pipeline replay | The conjugation engine |
| `romajiToKana()` greedy longest-match + sokuon + ん disambiguation | Input transformation and search |
| `hasJapanese()` kana/kanji gate | Input transformation and search |
| Tiered 4-priority search | Input transformation and search |
| `deconjugate()` reverse conjugation entry + node budget | Input transformation and search |
| Dynamic `import()` code-split chunk post-first-paint with silent `.catch` | Effects and async integration |
| Bidirectional URL state (write + `parseState` re-validation) | Effects and async integration |
| Gloss re-derivation on corpus load (`withGloss`) | Effects and async integration |
| `AbortController` + `active` flag double-guard | Effects and async integration |
| 250 ms debounce via `setTimeout` inside `useEffect` | Effects and async integration |
| `peekTranslation()` synchronous cache short-circuit | Effects and async integration |
| Two-tier client cache (`memCache` Map + `localStorage` try/catch) | Effects and async integration |
| Workers AI binding — `env.AI.run(model, {messages})` | The Cloudflare Worker backend |
| `Sec-Fetch-Site: cross-site` browser-enforced CSRF guard | The Cloudflare Worker backend |
| Workers rate-limit binding (`TRANSLATE_RL.limit`) | The Cloudflare Worker backend |
| Cache API + `ctx.waitUntil()` non-blocking cache write | The Cloudflare Worker backend |
| `/no_think` Qwen3 soft switch | The Cloudflare Worker backend |
| `cleanTranslation()` — think-block strip, first-line, unquote, de-period | The Cloudflare Worker backend |
| Golden test pattern — `tsx` runner + `golden.json` fixture | Testing the domain engine |
