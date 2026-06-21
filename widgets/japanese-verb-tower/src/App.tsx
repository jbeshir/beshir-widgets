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

const AUX_TOOLTIP: Readonly<Record<string, string>> = {
  causative: 'make/let someone do — auxiliary せる／させる, attaches to the 未然形 (a-stem); conjugates as an ichidan verb.',
  passive:   'passive/potential/spontaneous/honorific — one auxiliary れる／られる, attaches to the 未然形 (a-stem); conjugates as an ichidan verb.',
  potential: 'potential — godan uses the dedicated e-row (飲める); ichidan shares れる／られる with the passive (homophony). Conjugates as ichidan.',
  polite:    'polite register — auxiliary ます on the 連用形 (i-stem); special paradigm ます／ません／ました／ませんでした.',
  negative:  'plain negative — auxiliary adjective ない on the 未然形 (a-stem); inflects as an い-adjective (なかった, なくて).',
  past:      'past/completed — auxiliary た (だ after voiced ん-onbin: 飲んだ, 遊んだ), on the て／た euphonic stem.',
};

const SAMPLE = sampleDataJson as unknown as DictEntry[];

function readInitialState(): { verb: Verb; ops: OpId[] } | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseState(window.location.search);
  } catch {
    return null;
  }
}

function writeState(verb: Verb, ops: OpId[]): void {
  try {
    history.replaceState(history.state, '', '?' + serializeState(verb, ops));
  } catch {
    // sandboxed iframe / history restricted — no-op
  }
}

const INITIAL_STATE = readInitialState();
const FEATURED: Verb[] = FEATURED_KANJI.map(k => makeVerb(SAMPLE.find(e => e.k === k)!));

// A URL-restored verb carries no gloss (the URL encodes only kanji/kana/class),
// so re-derive it from the corpus by matching kanji+kana; leave it untouched if
// the gloss is already present or the verb isn't in the loaded data yet.
function withGloss(verb: Verb, entries: DictEntry[]): Verb {
  if (verb.gloss) return verb;
  const e = entries.find(x => x.k === verb.kanji && x.r === verb.kana);
  return e ? makeVerb(e) : verb;
}
const DEFAULT_VERB = FEATURED.find(v => v.kanji === '飲む') ?? FEATURED[0];

function buildByReading(data: DictEntry[]): Map<string, Verb[]> {
  const m = new Map<string, Verb[]>();
  for (const e of data) {
    const v = makeVerb(e);
    const arr = m.get(e.r);
    if (arr) arr.push(v); else m.set(e.r, [v]);
  }
  return m;
}

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
  const out: DictEntry[] = [];
  for (const tier of tiers) {
    for (const e of tier) {
      if (out.length >= 30) break;
      out.push(e);
    }
    if (out.length >= 30) break;
  }
  return out;
}

function renderHighlighted(text: string, hl: [number, number]): JSX.Element {
  const [start, end] = hl;
  if (start === end) return <>{text}</>;
  return (
    <>
      {text.slice(0, start)}
      <span class="hl">{text.slice(start, end)}</span>
      {text.slice(end)}
    </>
  );
}

function renderTopKanji(
  kanji: string,
  kana: string,
  hl: [number, number],
  verb: { kanjiPrefix: string; prefixLen: number },
): JSX.Element {
  const { kanjiPrefix, prefixLen } = verb;
  if (!kanjiPrefix || prefixLen === 0 || !kanji.startsWith(kanjiPrefix) || hl[0] < kanjiPrefix.length) {
    return <span class="tier-kanji jp">{renderHighlighted(kanji, hl)}</span>;
  }
  const kanaTail = kanji.slice(kanjiPrefix.length);
  const rubyText = kana.slice(0, prefixLen);
  const off = kanjiPrefix.length;
  const adjHl: [number, number] = [Math.max(0, hl[0] - off), Math.max(0, hl[1] - off)];
  return (
    <span class="tier-kanji jp">
      <ruby>{kanjiPrefix}<rt>{rubyText}</rt></ruby>
      {renderHighlighted(kanaTail, adjHl)}
    </span>
  );
}

const COLLOQ_ALT: Partial<Record<OpId, string>> = {
  'te-iru':    'てる／でる',
  'te-iku':    'てく／でく',
  'te-shimau': 'ちゃう／じゃう',
  'te-oku':    'とく／どく',
  'must':      'なきゃ',
  'must-not':  'ちゃ／じゃ',
};

const OP_SENSE: Record<OpId, string> = {
  causative:           'make/let',
  passive:             'be ~ed',
  potential:           'can',
  'causative-passive': 'be made to',
  polite:              'polite',
  negative:            'not',
  past:                'past',
  'negative-past':     "didn't",
  te:                  'and/-ing',
  adverbial:           '-ly',
  tai:                 'want to',
  tagaru:              'seems to want to',
  yasui:               'easy to',
  nikui:               'hard to',
  naosu:               'redo / do over',
  hajimeru:            'start ~ing',
  owaru:               'finish ~ing',
  tsuzukeru:           'keep ~ing',
  dasu:                'burst out ~ing',
  sugiru:              'too much',
  sou:                 'looks like',
  naru:                'become',
  volitional:          "let's/intend to",
  imperative:          'command',
  ba:                  'if',
  tara:                'when/if',
  'te-iru':            'be ~ing',
  'te-kuru':           'come to/start',
  'te-iku':            'go on ~ing',
  'te-shimau':         'end up/completely',
  'te-oku':            'in advance',
  'te-aru':            'is done',
  'te-shimau-colloq':  'end up (colloq)',
  'must':              'must',
  'must-not':          'must not',
  may:                 'may / OK to',
  'need-not':          "don't have to",
  kudasai:             'please',
  'kudasai-not':       "please don't",
  'must-nke-ikenai':       'must',
  'must-nakutewa-naranai': 'must',
  'must-nakutewa-ikenai':  'must',
  'must-nakya':            'gotta',
  'must-nakucha':          'gotta',
};

// Ops the picker is allowed to show. Anything in OP_FAMILIES but NOT here is
// "hidden but buildable": the engine builds it and deconjugate recognizes it,
// but the menu omits it. New obligation variants + standalone casual ops live here.
const HIDDEN_OPS = new Set<OpId>([
  'must-nke-ikenai', 'must-nakutewa-naranai', 'must-nakutewa-ikenai',
  'must-nakya', 'must-nakucha',
]);

const MENU_GROUPS: Array<{ label: string; ops: OpId[] }> = [
  { label: 'Core',                    ops: OP_FAMILIES.core },
  { label: 'Aspect & direction',      ops: OP_FAMILIES.aspect },
  { label: 'Desire & ease',           ops: OP_FAMILIES.desire },
  { label: 'Commands & intention',    ops: OP_FAMILIES.command },
  { label: 'Obligation & permission', ops: OP_FAMILIES.deontic },
  { label: 'Conditionals',            ops: OP_FAMILIES.conditional },
  { label: 'Compound (phase)',        ops: OP_FAMILIES.compound },
  { label: 'Adjective & なる',         ops: OP_FAMILIES.adjective },
].map(g => ({ ...g, ops: g.ops.filter(op => !HIDDEN_OPS.has(op)) }));

export function App() {
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
  const [searchActive, setSearchActive] = useState(-1);
  const containerRef    = useRef<HTMLDivElement>(null);
  const menuRef         = useRef<HTMLDivElement>(null);
  const addLayerBtnRef  = useRef<HTMLButtonElement>(null);
  const buildTabRef     = useRef<HTMLButtonElement>(null);
  const breakdownTabRef = useRef<HTMLButtonElement>(null);
  const resultsRef      = useRef<HTMLDivElement>(null);
  const candidateRefs   = useRef<(HTMLButtonElement | null)[]>([]);
  const byReadingRef    = useRef(buildByReading(SAMPLE));

  // Adjectives are included in the breakdown corpus only — not in build-mode search.
  const corpus = useMemo(
    () => buildCorpus([...allEntries, ...(adjDataJson as unknown as DictEntry[])]),
    [allEntries],
  );

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

  useEffect(() => { setReady(true); }, []);

  // Once the full corpus loads, fill a URL-restored verb's missing gloss.
  useEffect(() => {
    setSelectedVerb(v => (v.gloss ? v : withGloss(v, allEntries)));
  }, [allEntries]);

  useEffect(() => {
    writeState(selectedVerb, stack);
  }, [selectedVerb, stack]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const send = () =>
      window.parent.postMessage({ type: 'widget-size', height: el.scrollHeight }, '*');
    const ro = new ResizeObserver(send);
    ro.observe(el);
    send();
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!addLayerOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAddLayerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [addLayerOpen]);

  useEffect(() => {
    if (!addLayerOpen || !menuRef.current) return;
    const first = menuRef.current.querySelector<HTMLButtonElement>('.layer-menu-item:not(:disabled)');
    first?.focus();
  }, [addLayerOpen]);

  function handleMenuKeyDown(e: KeyboardEvent) {
    if (!menuRef.current) return;
    const items = Array.from(
      menuRef.current.querySelectorAll<HTMLButtonElement>('.layer-menu-item:not(:disabled)')
    );
    const idx = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      setAddLayerOpen(false);
      addLayerBtnRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    }
  }

  const tower: Tier[] = useMemo(
    () => buildTower(selectedVerb, stack),
    [selectedVerb, stack],
  );

  const topForm = tower.length > 0 ? tower[tower.length - 1].kana : '';
  const features = useMemo(() => stack.map(o => OP_SENSE[o]), [stack]);

  useEffect(() => {
    if (typeof location !== 'undefined' && location.protocol === 'file:') {
      setTranslation(null); setTranslating(false); return;
    }
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

  const currentForm: Form = useMemo(
    () => finalForm(selectedVerb, stack),
    [selectedVerb, stack],
  );

  const nextOps: OpId[] = useMemo(
    () => allowedOps(currentForm, stack),
    [currentForm, stack],
  );

  const trimmedQuery = query.trim();
  const searchResults = useMemo(
    () => (trimmedQuery ? searchEntries(trimmedQuery, allEntries) : []),
    [trimmedQuery, allEntries],
  );

  // The highlighted option is virtual-focus only — the input keeps DOM focus
  // (aria-activedescendant combobox pattern). Any change to the result set
  // resets the highlight so it can never point past the rendered options.
  useEffect(() => { setSearchActive(-1); }, [searchResults]);

  useEffect(() => {
    if (searchActive < 0) return;
    const el = resultsRef.current?.children[searchActive] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [searchActive]);

  function onSearchKeyDown(e: JSX.TargetedKeyboardEvent<HTMLInputElement>) {
    if (searchResults.length === 0) return;
    const last = searchResults.length - 1;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSearchActive(i => (i >= last ? 0 : i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSearchActive(i => (i <= 0 ? last : i - 1));
        break;
      case 'Home':
        e.preventDefault();
        setSearchActive(0);
        break;
      case 'End':
        e.preventDefault();
        setSearchActive(last);
        break;
      case 'Enter':
        if (searchActive >= 0) {
          e.preventDefault();
          selectVerb(makeVerb(searchResults[searchActive]));
        }
        break;
      case 'Escape':
        if (query) { e.preventDefault(); setQuery(''); }
        break;
    }
  }

  // Move keyboard focus onto the first "did you mean" candidate as soon as a
  // breakdown produces an ambiguous result, so it's reachable without tabbing.
  useEffect(() => {
    if (bdParses && bdParses.length > 0) candidateRefs.current[0]?.focus();
  }, [bdParses]);

  function onCandidateKeyDown(e: JSX.TargetedKeyboardEvent<HTMLButtonElement>, i: number) {
    const n = bdParses?.length ?? 0;
    if (n === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      candidateRefs.current[(i + 1) % n]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      candidateRefs.current[(i - 1 + n) % n]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      candidateRefs.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      candidateRefs.current[n - 1]?.focus();
    }
  }

  useEffect(() => {
    const el = document.documentElement;
    let s: string;
    if (dictLoading) {
      s = 'loading';
    } else if (mode === 'breakdown') {
      if (bdParses !== null) s = bdParses.length > 0 ? 'populated' : 'empty';
      else if (stack.length > 0) s = 'populated';
      else s = 'ready';
    } else {
      if (trimmedQuery) s = searchResults.length > 0 ? 'populated' : 'empty';
      else if (stack.length > 0) s = 'populated';
      else s = 'ready';
    }
    el.dataset.widgetState = s;
  }, [dictLoading, mode, bdParses, stack.length, trimmedQuery, searchResults.length]);

  const cChecked      = stack.includes('causative');
  const politeChecked = stack.includes('polite');
  const negChecked    = stack.includes('negative');
  const pastChecked   = stack.includes('past');
  const currentVoice: 'none' | 'passive' | 'potential' =
    stack.includes('passive') ? 'passive' :
    stack.includes('potential') ? 'potential' : 'none';

  function opDisabled(op: OpId): boolean {
    return !stack.includes(op) && !nextOps.includes(op);
  }

  function toggleOn(op: OpId) {
    if (nextOps.includes(op)) setStack([...stack, op]);
  }

  function toggleOff(op: OpId) {
    const idx = stack.indexOf(op);
    if (idx >= 0) setStack(stack.slice(0, idx));
  }

  function handleVoiceChange(v: 'none' | 'passive' | 'potential') {
    const voiceOps: OpId[] = ['passive', 'potential'];
    let newStack = stack;
    for (const vo of voiceOps) {
      const idx = newStack.indexOf(vo);
      if (idx >= 0) { newStack = newStack.slice(0, idx); break; }
    }
    if (v !== 'none') {
      const tempForm = finalForm(selectedVerb, newStack);
      const tempNext = allowedOps(tempForm, newStack);
      if (tempNext.includes(v)) newStack = [...newStack, v];
    }
    setStack(newStack);
  }

  function selectVerb(v: Verb) {
    setSelectedVerb(v);
    setStack([]);
    setQuery('');
    setAddLayerOpen(false);
  }

  function removeTier(towerIdx: number) {
    // tower[i] corresponds to stack[i-1]; truncate stack to keep everything before tower[towerIdx]
    setStack(stack.slice(0, towerIdx - 1));
  }

  function applyParse(p: Parse) {
    setSelectedVerb(p.verb);
    setStack(p.ops);
    setBdParses(null);
    setMode('build');
  }

  function runBreakdown() {
    const input = bdInput.trim();
    if (!input) return;
    const parses = deconjugate(input, corpus);
    if (parses.length === 1) {
      applyParse(parses[0]);
    } else {
      setBdParses(parses);
    }
  }

  const notes: string[] = [];
  if (selectedVerb.klass === 'suru' && stack.includes('potential')) {
    notes.push('する + potential → できる (suppletive — completely different word, not derived)');
  }
  if (selectedVerb.klass === 'ichidan' && !cChecked && currentVoice !== 'none') {
    notes.push(
      `${selectedVerb.kanji}られる: ichidan passive = potential surface (homophony). ` +
      `Godan verbs diverge: 飲める (potential) vs 飲まれる (passive).`,
    );
  }
  if (selectedVerb.klass === 'kuru' && stack.includes('passive')) {
    notes.push('来る passive/potential = こられる (same form; irregular reading shift こ/き)');
  }
  if (selectedVerb.rawClass === 'godan-r-i' && negChecked && !politeChecked && !cChecked && currentVoice === 'none') {
    notes.push("ある's plain negative is the suppletive adjective ない (not あらない).");
  }
  if (stack.includes('tai')) {
    notes.push('たい is an い-adjective: its polite form uses です (見たいです), never ます.');
  }
  if (stack.includes('te-shimau-colloq')) {
    notes.push('ちゃう (て→ちゃう) / じゃう (で→じゃう) is colloquial; formal is てしまう.');
  }
  if (stack.includes('must')) {
    notes.push('なきゃ is the casual contraction of なければ (〜なきゃ(ならない／いけない), or just 〜なきゃ). The polite form is 〜なければなりません.');
  }
  if (stack.includes('must-not')) {
    notes.push('ちゃ (ては→ちゃ) / じゃ (では→じゃ) is the casual contraction; the formal form is 〜てはいけない and the polite is 〜てはいけません.');
  }
  if (stack.includes('kudasai')) {
    notes.push('The casual request drops ください — the bare て-form is itself a request (待って! = "wait!"). 〜てください is the polite form.');
  }
  if (stack.includes('kudasai-not')) {
    notes.push('〜ないでください is the negative request ("please don’t ~"): the plain negative + でください.');
  }
  if (stack.includes('may') || stack.includes('need-not')) {
    notes.push('〜てもいい (may) and 〜なくてもいい (don\'t have to) complete the obligation set with 〜なければならない (must) and 〜てはいけない (must not). Casually も drops: 〜ていい / 〜なくていい.');
  }
  if (selectedVerb.kanji === '帰る') {
    notes.push('帰る looks ichidan (ends in 〜る after an e-vowel) but is actually godan-r: its forms are 帰らない／帰った／帰ります, not 帰ない／帰た.');
  }

  const approxGloss = stack.length > 0
    ? selectedVerb.gloss + ' · ' + stack.map(o => OP_SENSE[o]).join(' · ')
    : '';

  const displayTiers = [...tower].reverse();
  const isActive = (v: Verb) => v.kanji === selectedVerb.kanji && v.kana === selectedVerb.kana;
  const isFeatured = FEATURED.some(isActive);
  const isTerminal = nextOps.length === 0;

  return (
    <div class="container" ref={containerRef}>
      <div class="card">
        <header class="card-header">
          <h1>Japanese Verb Conjugation Tower</h1>
          <p class="hint">Pick a verb, build up layers — watch the form type change with each step.</p>
        </header>

        <div
          class="mode-toggle"
          role="tablist"
          aria-label="Widget mode"
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault();
              if (mode === 'build') {
                setMode('breakdown');
                breakdownTabRef.current?.focus();
              } else {
                setMode('build');
                buildTabRef.current?.focus();
              }
            }
          }}
        >
          <button
            id="tab-build"
            ref={buildTabRef}
            class={`mode-btn${mode === 'build' ? ' mode-btn--active' : ''}`}
            role="tab"
            aria-selected={mode === 'build'}
            aria-controls="panel-build"
            tabIndex={mode === 'build' ? 0 : -1}
            onClick={() => setMode('build')}
            data-testid="mode-build"
          >Build</button>
          <button
            id="tab-breakdown"
            ref={breakdownTabRef}
            class={`mode-btn${mode === 'breakdown' ? ' mode-btn--active' : ''}`}
            role="tab"
            aria-selected={mode === 'breakdown'}
            aria-controls="panel-breakdown"
            tabIndex={mode === 'breakdown' ? 0 : -1}
            title="Paste a conjugated form — we'll reverse-engineer the base verb and each step"
            onClick={() => setMode('breakdown')}
            data-testid="mode-breakdown"
          >Break down</button>
        </div>

        {mode === 'build' ? (
          <div id="panel-build" role="tabpanel" aria-labelledby="tab-build" tabIndex={0}>
            <div class="search-section">
              <div class="search-box-wrap">
                <input
                  class="search-input"
                  type="search"
                  role="combobox"
                  placeholder="Type a verb — romaji (nomu, taberu, benkyou suru) or kana/kanji"
                  value={query}
                  onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
                  onKeyDown={onSearchKeyDown}
                  aria-label="Search verbs by romaji, kana, or kanji"
                  aria-autocomplete="list"
                  aria-controls={trimmedQuery ? 'search-results' : undefined}
                  aria-expanded={!!trimmedQuery}
                  aria-activedescendant={searchActive >= 0 ? `search-opt-${searchActive}` : undefined}
                  data-testid="search-input"
                />
                {dictLoading ? (
                  <span class="dict-hint dict-hint--loading" aria-live="polite">loading full dictionary…</span>
                ) : dictSize > 0 && !trimmedQuery ? (
                  <span class="dict-hint">{dictSize.toLocaleString()} verbs</span>
                ) : null}
              </div>
              {trimmedQuery && (
                <div id="search-results" ref={resultsRef} class="search-results" role="listbox" aria-label="Search results" data-testid="search-results">
                  {searchResults.length === 0 ? (
                    <div class="search-no-match" data-testid="search-no-match">No matches — try romaji (taberu, nomu) or kana/kanji</div>
                  ) : (
                    searchResults.map((e, i) => (
                      <button
                        key={e.k + '\0' + e.r}
                        id={`search-opt-${i}`}
                        class={`search-result${i === searchActive ? ' search-result--active' : ''}`}
                        role="option"
                        tabIndex={-1}
                        aria-selected={i === searchActive}
                        onClick={() => selectVerb(makeVerb(e))}
                      >
                        <span class="search-result-kanji jp">{e.k}</span>
                        <span class="search-result-reading jp">{e.r}</span>
                        <span class="search-result-gloss">{e.gloss}</span>
                        <span class="search-result-cls">{e.cls}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
              {!trimmedQuery && !isFeatured && (
                <div class="active-verb-chip">
                  showing{' '}<span class="jp">{selectedVerb.kanji}</span>{' · '}<span class="jp">{selectedVerb.kana}</span>
                </div>
              )}
            </div>

            <div class="verb-picker" role="group" aria-label="Select a featured verb">
              {FEATURED.map((v) => (
                <button
                  key={v.kanji}
                  class={`verb-chip${isActive(v) ? ' verb-chip--active' : ''}`}
                  onClick={() => selectVerb(v)}
                  aria-pressed={isActive(v)}
                  title={`${v.kanji} (${v.romaji}) — ${v.gloss}`}
                  data-testid={`verb-${v.romaji}`}
                >
                  <span class="verb-chip-kanji jp">{v.kanji}</span>
                  <span class="verb-chip-sub">{v.romaji}</span>
                  <span class="verb-chip-gloss">{v.gloss}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div id="panel-breakdown" role="tabpanel" aria-labelledby="tab-breakdown" tabIndex={0} class="breakdown-section">
            <p class="hint">Enter a conjugated form (romaji, kana, or kanji) to identify the base verb and conjugation.</p>
            <div class="breakdown-input-row">
              <input
                class="breakdown-input"
                type="text"
                placeholder="e.g. tabetakunakatta, 食べたくなかった"
                value={bdInput}
                onInput={(e) => { setBdInput((e.target as HTMLInputElement).value); setBdParses(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') runBreakdown(); }}
                aria-label="Enter a conjugated verb form to analyze"
                data-testid="breakdown-input"
              />
              <button
                class="breakdown-btn"
                onClick={runBreakdown}
                disabled={!bdInput.trim()}
                data-testid="breakdown-run"
              >Analyse</button>
            </div>
            {dictLoading && (
              <span class="dict-hint dict-hint--loading" aria-live="polite">loading full dictionary…</span>
            )}
            {bdParses !== null && (
              <div class="breakdown-results" aria-live="polite">
                {bdParses.length === 0 ? (
                  <p class="breakdown-no-parse">Couldn't analyze <span class="jp">{bdInput.trim()}</span> as a conjugation of a known verb.</p>
                ) : (
                  <>
                    <p class="breakdown-hint">Did you mean…?</p>
                    <div class="candidate-picker" role="listbox" aria-label="Matching verbs" data-testid="candidate-picker">
                      {bdParses.map((p, i) => (
                        <button
                          key={i}
                          ref={(el) => { candidateRefs.current[i] = el; }}
                          class="candidate-row"
                          role="option"
                          aria-selected="false"
                          onClick={() => applyParse(p)}
                          onKeyDown={(e) => onCandidateKeyDown(e, i)}
                        >
                          <span class="candidate-base">
                            <span class="jp">{p.base.k}</span>
                            <span class="candidate-reading jp">【{p.base.r}】</span>
                            {p.base.gloss && <span class="candidate-gloss">{p.base.gloss}</span>}
                          </span>
                          <span class="candidate-ops">
                            {p.ops.length === 0
                              ? <span class="op-chip">base form</span>
                              : p.ops.map((op, j) => (
                                  <span key={j} class="op-chip">{OP_META[op]?.label ?? op}</span>
                                ))
                            }
                          </span>
                          <span class="candidate-surface jp">→ {p.kana}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div class="card-body">
          <div class="card-controls">
            <div class="controls" role="group" aria-label="Conjugation layer toggles">

              <label class={`toggle-row${opDisabled('causative') ? ' toggle-row--disabled' : ''}`}>
                <input
                  type="checkbox"
                  checked={cChecked}
                  disabled={opDisabled('causative')}
                  onChange={(e) => {
                    (e.target as HTMLInputElement).checked ? toggleOn('causative') : toggleOff('causative');
                  }}
                  data-testid="toggle-causative"
                />
                <span class="toggle-text">
                  Causative <span class="morph-tag">-させる / -せる</span>
                </span>
              </label>

              <fieldset class="voice-group">
                <legend>Voice <span class="morph-tag">one slot — always innermost</span></legend>
                {(['none', 'passive', 'potential'] as const).map((v) => (
                  <label key={v} class="radio-row">
                    <input
                      type="radio"
                      name="voice"
                      value={v}
                      checked={currentVoice === v}
                      disabled={v !== 'none' && v !== currentVoice && opDisabled(v)}
                      onChange={() => handleVoiceChange(v)}
                    />
                    {v === 'none' ? (
                      <span class="toggle-text">none</span>
                    ) : v === 'passive' ? (
                      <span class="toggle-text">Passive <span class="morph-tag">-られる / -れる</span></span>
                    ) : (
                      <span class="toggle-text">Potential <span class="morph-tag">-える / -られる</span></span>
                    )}
                  </label>
                ))}
                <p class="ordering-note">Voice applies before polite/tense — the pipeline enforces this automatically.</p>
              </fieldset>

              <label class={`toggle-row${opDisabled('polite') ? ' toggle-row--disabled' : ''}`}>
                <input
                  type="checkbox"
                  checked={politeChecked}
                  disabled={opDisabled('polite')}
                  onChange={(e) => {
                    (e.target as HTMLInputElement).checked ? toggleOn('polite') : toggleOff('polite');
                  }}
                  data-testid="toggle-polite"
                />
                <span class="toggle-text">Polite <span class="morph-tag">-ます</span></span>
              </label>

              <label class={`toggle-row${opDisabled('negative') ? ' toggle-row--disabled' : ''}`}>
                <input
                  type="checkbox"
                  checked={negChecked}
                  disabled={opDisabled('negative')}
                  onChange={(e) => {
                    (e.target as HTMLInputElement).checked ? toggleOn('negative') : toggleOff('negative');
                  }}
                  data-testid="toggle-negative"
                />
                <span class="toggle-text">Negative <span class="morph-tag">-ない / -ません</span></span>
              </label>

              <label class={`toggle-row${opDisabled('past') ? ' toggle-row--disabled' : ''}`}>
                <input
                  type="checkbox"
                  checked={pastChecked}
                  disabled={opDisabled('past')}
                  onChange={(e) => {
                    (e.target as HTMLInputElement).checked ? toggleOn('past') : toggleOff('past');
                  }}
                  data-testid="toggle-past"
                />
                <span class="toggle-text">Past <span class="morph-tag">-た / -ました</span></span>
              </label>
            </div>

            <div class="slot-legend" role="status" aria-live="polite" aria-label="Current op stack">
              <div class="slot-legend-title">
                Op stack
                <span class="slot-legend-sub">active layers (innermost → outermost)</span>
              </div>
              <div class="slot-chips">
                {stack.length === 0 ? (
                  <span class="slot-chip">base only</span>
                ) : stack.map((op, i) => (
                  <span key={i} class="slot-chips-group">
                    {i > 0 && <span class="slot-arrow" aria-hidden="true">→</span>}
                    <span class="slot-chip slot-chip--active">{OP_META[op]?.label ?? op}</span>
                  </span>
                ))}
              </div>
            </div>

            {notes.length > 0 && (
              <div class="notes" role="note">
                {notes.map((n, i) => <p key={i} class="note">{n}</p>)}
              </div>
            )}
          </div>

          <div class="card-tower">
            <div class="add-layer-wrap" ref={menuRef}>
              {isTerminal ? (
                <div class="add-layer-terminal" aria-live="polite">terminal form — nothing more attaches</div>
              ) : (
                <>
                  <button
                    ref={addLayerBtnRef}
                    class={`add-layer-btn${addLayerOpen ? ' add-layer-btn--open' : ''}`}
                    onClick={() => setAddLayerOpen(o => !o)}
                    aria-expanded={addLayerOpen}
                    aria-haspopup="menu"
                    aria-label="Add conjugation layer"
                  >＋ add layer</button>
                  {addLayerOpen && (
                    <div class="layer-menu" role="menu" aria-label="Conjugation layers" onKeyDown={handleMenuKeyDown}>
                      {MENU_GROUPS.map(group => (
                        <div key={group.label} class="layer-menu-group">
                          <div class="layer-menu-group-label">{group.label}</div>
                          {group.ops.map(op => {
                            const meta = OP_META[op];
                            const enabled = nextOps.includes(op);
                            const reason = enabled ? undefined : disabledReason(currentForm, stack, op) ?? undefined;
                            return (
                              <button
                                key={op}
                                class={`layer-menu-item${enabled ? '' : ' layer-menu-item--disabled'}`}
                                disabled={!enabled}
                                title={reason ?? meta.tooltip}
                                onClick={() => { if (enabled) { setStack([...stack, op]); setAddLayerOpen(false); } }}
                                role="menuitem"
                                aria-disabled={!enabled}
                              >
                                <span class="layer-menu-label">{meta.label}</span>
                                <span class="layer-menu-sense">{OP_SENSE[op]}</span>
                                <span class="layer-menu-aux jp">{meta.aux}</span>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div class="tower" aria-label="Conjugation tower — base at bottom, final at top" data-testid="tower">
              {displayTiers.map((tier, idx) => {
                const isTop  = idx === 0;
                const isBase = tier.op === 'base';
                const towerIdx = tower.length - 1 - idx;
                const opMeta = tier.op !== 'base' ? OP_META[tier.op] : undefined;
                const colloq = tier.op !== 'base' ? COLLOQ_ALT[tier.op] : undefined;
                return (
                  <div
                    key={towerIdx}
                    class={`tier${isTop ? ' tier--top' : ''}${isBase ? ' tier--base' : ''}`}
                    aria-label={`${tier.label}: ${tier.kanji}`}
                  >
                    <div class="tier-body">
                      {!isBase && (
                        <button
                          class="tier-remove"
                          onClick={() => removeTier(towerIdx)}
                          aria-label={`Remove ${tier.label} layer and everything above`}
                          title="Remove this layer (and all above)"
                        >✕</button>
                      )}
                      <div class="tier-row tier-row--main">
                        {isTop
                          ? renderTopKanji(tier.kanji, tier.kana, tier.hlKanji, selectedVerb)
                          : <span class="tier-kanji jp">{renderHighlighted(tier.kanji, tier.hlKanji)}</span>
                        }
                        <span class="type-badge" title={`form type: ${tier.type}`}>
                          {FORM_LABEL[tier.type]}
                        </span>
                      </div>
                      <div class="tier-row tier-row--sub">
                        <span class="tier-kana jp">{renderHighlighted(tier.kana, tier.hlKana)}</span>
                        <span class="tier-romaji">{tier.romaji}</span>
                      </div>
                      {colloq && (
                        <div class="tier-row">
                          <span class="tier-colloq jp" title="colloquial contraction">{colloq} (colloq)</span>
                        </div>
                      )}
                      <div class="tier-row tier-row--meta">
                        {tier.aux ? (
                          <span
                            class="tier-label tier-label--aux"
                            title={AUX_TOOLTIP[tier.op] ?? opMeta?.tooltip ?? ''}
                          >
                            {tier.label} · <span class="tier-aux jp">{tier.aux}</span>
                          </span>
                        ) : (
                          <span class="tier-label">{tier.label}</span>
                        )}
                        <span class="tier-gloss">
                          {isTop && stack.length > 0 ? approxGloss : tier.gloss}
                        </span>
                      </div>
                      {isTop && stack.length > 0 && (translating || translation) && (
                        <div class="tier-row tier-row--translation">
                          <span class="tier-translation-label">AI translation</span>
                          <span class="tier-translation">{translation ?? '…'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <p class="credit">Verb data derived from JMdict / EDICT, © EDRDG — used under the EDRDG licence (CC BY-SA).</p>
      </div>

      {ready && <div id="widget-ready" hidden />}
    </div>
  );
}




