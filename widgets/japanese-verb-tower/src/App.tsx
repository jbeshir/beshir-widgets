import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import type { JSX } from 'preact';
import { makeVerb, buildTower, FEATURED_KANJI } from './engine';
import type { Verb, Tier, DictEntry } from './engine';
import { romajiToKana, hasJapanese } from './romaji';
import sampleDataJson from './data/verbs.sample.json';

// 助動詞 tooltip content per tier layer (condensed from research Part 4)
const AUX_TOOLTIP: Readonly<Record<string, string>> = {
  causative: 'make/let someone do — auxiliary せる／させる, attaches to the 未然形 (a-stem); conjugates as an ichidan verb.',
  passive:   'passive/potential/spontaneous/honorific — one auxiliary れる／られる, attaches to the 未然形 (a-stem); conjugates as an ichidan verb.',
  potential: 'potential — godan uses the dedicated e-row (飲める); ichidan shares れる／られる with the passive (homophony). Conjugates as ichidan.',
  polite:    'polite register — auxiliary ます on the 連用形 (i-stem); special paradigm ます／ません／ました／ませんでした.',
  negative:  'plain negative — auxiliary adjective ない on the 未然形 (a-stem); inflects as an い-adjective (なかった, なくて).',
  past:      'past/completed — auxiliary た (だ after voiced ん-onbin: 飲んだ, 遊んだ), on the て／た euphonic stem.',
};

// Static inline sample — 300 verbs, always available, no fetch required
const SAMPLE = sampleDataJson as unknown as DictEntry[];

// Featured verbs: the original 10 demo verbs, sourced from the sample
const FEATURED: Verb[] = FEATURED_KANJI.map(k => makeVerb(SAMPLE.find(e => e.k === k)!));

// Build reading index: Map<kana-reading, Verb[]>
function buildByReading(data: DictEntry[]): Map<string, Verb[]> {
  const m = new Map<string, Verb[]>();
  for (const e of data) {
    const v = makeVerb(e);
    const arr = m.get(e.r);
    if (arr) arr.push(v); else m.set(e.r, [v]);
  }
  return m;
}

// Search corpus: tiered ranking — (a) exact reading, (b) reading prefix, (c) kanji contains raw,
// (d) romaji prefix. Within each tier: data order (pre-sorted common-first). Cap at 30.
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
  // Only apply ruby when there's a kanji stem and the highlight doesn't overlap it
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

export function App() {
  const [selectedVerb, setSelectedVerb] = useState<Verb>(FEATURED[0]);
  const [causative, setCausative]       = useState(true);
  const [voice, setVoice]               = useState<'none' | 'passive' | 'potential'>('passive');
  const [polite, setPolite]             = useState(false);
  const [negative, setNegative]         = useState(false);
  const [past, setPast]                 = useState(false);
  const [ready, setReady]               = useState(false);
  const [query, setQuery]               = useState('');
  const [allEntries, setAllEntries]     = useState<DictEntry[]>(SAMPLE);
  const [dictLoading, setDictLoading]   = useState(true);
  const [dictSize, setDictSize]         = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const byReadingRef = useRef(buildByReading(SAMPLE));

  // Lazy-load full corpus after first paint; never blocks #widget-ready
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

  // #widget-ready fires on first paint, not gated on dict load
  useEffect(() => { setReady(true); }, []);

  // ResizeObserver → postMessage to parent frame
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

  const tower: Tier[] = useMemo(
    () => buildTower(selectedVerb, { causative, voice, polite, negative, past }),
    [selectedVerb, causative, voice, polite, negative, past],
  );

  const trimmedQuery = query.trim();
  const searchResults = useMemo(
    () => (trimmedQuery ? searchEntries(trimmedQuery, allEntries) : []),
    [trimmedQuery, allEntries],
  );

  function selectVerb(v: Verb) {
    setSelectedVerb(v);
    setQuery('');
  }

  // Contextual teaching notes
  const notes: string[] = [];
  if (selectedVerb.klass === 'suru' && voice === 'potential') {
    notes.push('する + potential → できる (suppletive — completely different word, not derived)');
  }
  if (selectedVerb.klass === 'ichidan' && !causative && voice !== 'none') {
    notes.push(
      `${selectedVerb.kanji}られる: ichidan passive = potential surface (homophony). ` +
      `Godan verbs diverge: 飲める (potential) vs 飲まれる (passive).`,
    );
  }
  if (selectedVerb.klass === 'kuru' && voice === 'passive') {
    notes.push('来る passive/potential = こられる (same form; irregular reading shift こ/き)');
  }
  if (selectedVerb.rawClass === 'godan-r-i' && negative && !polite && !causative && voice === 'none') {
    notes.push("ある's plain negative is the suppletive adjective ない (not あらない).");
  }

  // Display reversed: top tier (final form) first, base last
  const displayTiers = [...tower].reverse();
  const isActive = (v: Verb) =>
    v.kanji === selectedVerb.kanji && v.kana === selectedVerb.kana;
  const isFeatured = FEATURED.some(v => v.kanji === selectedVerb.kanji && v.kana === selectedVerb.kana);

  return (
    <div class="container" ref={containerRef}>
      <div class="card">
        <header class="card-header">
          <h1>Japanese Verb Conjugation Tower</h1>
          <p class="hint">
            Pick a verb, toggle layers — watch the conjugated form build up morpheme by morpheme.
          </p>
        </header>

        {/* ── Search/entry — NEW, above the featured row ───────────────────── */}
        <div class="search-section">
          <div class="search-box-wrap">
            <input
              class="search-input"
              type="search"
              placeholder="Type a verb — romaji (nomu, taberu, benkyou suru) or kana/kanji"
              value={query}
              onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
              aria-label="Search verbs by romaji, kana, or kanji"
              aria-autocomplete="list"
              aria-controls={trimmedQuery ? 'search-results' : undefined}
              aria-expanded={!!trimmedQuery}
            />
            {dictLoading ? (
              <span class="dict-hint dict-hint--loading" aria-live="polite">loading full dictionary…</span>
            ) : dictSize > 0 && !trimmedQuery ? (
              <span class="dict-hint">{dictSize.toLocaleString()} verbs</span>
            ) : null}
          </div>
          {trimmedQuery && (
            <div id="search-results" class="search-results" role="listbox" aria-label="Search results">
              {searchResults.length === 0 ? (
                <div class="search-no-match">No matches</div>
              ) : (
                searchResults.map((e) => (
                  <button
                    key={e.k + '\0' + e.r}
                    class="search-result"
                    role="option"
                    aria-selected="false"
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

        {/* ── Featured quick-pick row ────────────────────────────────────────── */}
        <div class="verb-picker" role="group" aria-label="Select a featured verb">
          {FEATURED.map((v) => (
            <button
              key={v.kanji}
              class={`verb-chip${isActive(v) ? ' verb-chip--active' : ''}`}
              onClick={() => selectVerb(v)}
              aria-pressed={isActive(v)}
              title={`${v.kanji} (${v.romaji}) — ${v.gloss}`}
            >
              <span class="verb-chip-kanji jp">{v.kanji}</span>
              <span class="verb-chip-sub">{v.romaji}</span>
              <span class="verb-chip-gloss">{v.gloss}</span>
            </button>
          ))}
        </div>

        {/* ── Two-column body ──────────────────────────────────────────────── */}
        <div class="card-body">

          {/* Left column: conjugation controls */}
          <div class="card-controls">
            <div class="controls" aria-label="Conjugation layer toggles">

              <label class="toggle-row">
                <input
                  type="checkbox"
                  checked={causative}
                  onChange={(e) => setCausative((e.target as HTMLInputElement).checked)}
                />
                <span class="toggle-text">
                  Causative
                  <span class="morph-tag">-させる / -せる</span>
                </span>
              </label>

              <fieldset class="voice-group">
                <legend>
                  Voice
                  <span class="morph-tag">one slot — always innermost</span>
                </legend>
                {(['none', 'passive', 'potential'] as const).map((v) => (
                  <label key={v} class="radio-row">
                    <input
                      type="radio"
                      name="voice"
                      value={v}
                      checked={voice === v}
                      onChange={() => setVoice(v)}
                    />
                    {v === 'none' ? (
                      <span class="toggle-text">none</span>
                    ) : v === 'passive' ? (
                      <span class="toggle-text">
                        Passive
                        <span class="morph-tag">-られる / -れる</span>
                      </span>
                    ) : (
                      <span class="toggle-text">
                        Potential
                        <span class="morph-tag">-える / -られる</span>
                      </span>
                    )}
                  </label>
                ))}
                <p class="ordering-note">
                  Voice applies before polite/tense — the pipeline enforces this automatically.
                </p>
              </fieldset>

              <label class="toggle-row">
                <input
                  type="checkbox"
                  checked={polite}
                  onChange={(e) => setPolite((e.target as HTMLInputElement).checked)}
                />
                <span class="toggle-text">
                  Polite
                  <span class="morph-tag">-ます</span>
                </span>
              </label>

              <label class="toggle-row">
                <input
                  type="checkbox"
                  checked={negative}
                  onChange={(e) => setNegative((e.target as HTMLInputElement).checked)}
                />
                <span class="toggle-text">
                  Negative
                  <span class="morph-tag">-ない / -ません</span>
                </span>
              </label>

              <label class="toggle-row">
                <input
                  type="checkbox"
                  checked={past}
                  onChange={(e) => setPast((e.target as HTMLInputElement).checked)}
                />
                <span class="toggle-text">
                  Past
                  <span class="morph-tag">-た / -ました</span>
                </span>
              </label>
            </div>

            {/* Composition slot legend — enhanced with 助動詞 context */}
            <div class="slot-legend" aria-label="Morpheme slot order">
              <div class="slot-legend-title">
                Composition order
                <span class="slot-legend-sub">each active slot adds a helper word (助動詞)</span>
              </div>
              <div class="slot-chips">
                {([
                  { key: 'root',  label: 'root',    active: true },
                  { key: 'caus',  label: 'caus',    active: causative },
                  { key: 'voice', label: 'voice',   active: voice !== 'none' },
                  { key: 'pol',   label: 'polite',  active: polite },
                  { key: 'neg',   label: 'neg·tns', active: negative || past },
                ] as const).map((s, i) => (
                  <span key={s.key} class="slot-chips-group">
                    {i > 0 && <span class="slot-arrow" aria-hidden="true">→</span>}
                    <span class={`slot-chip${s.active ? ' slot-chip--active' : ''}`}>{s.label}</span>
                  </span>
                ))}
              </div>
            </div>

            {notes.length > 0 && (
              <div class="notes" role="note">
                {notes.map((n, i) => (
                  <p key={i} class="note">{n}</p>
                ))}
              </div>
            )}
          </div>

          {/* Right column: the tower */}
          <div class="card-tower">
            <div class="tower" aria-label="Conjugation tower — base at bottom, final at top">
              {displayTiers.map((tier, idx) => {
                const isTop  = idx === 0;
                const isBase = idx === displayTiers.length - 1;
                return (
                  <div
                    key={tier.layer}
                    class={`tier${isTop ? ' tier--top' : ''}${isBase ? ' tier--base' : ''}`}
                    aria-label={`${tier.label}: ${tier.kanji}`}
                  >
                    <div class="tier-body">
                      <div class="tier-row tier-row--main">
                        {isTop
                          ? renderTopKanji(tier.kanji, tier.kana, tier.hlKanji, selectedVerb)
                          : <span class="tier-kanji jp">{renderHighlighted(tier.kanji, tier.hlKanji)}</span>
                        }
                      </div>
                      <div class="tier-row tier-row--sub">
                        <span class="tier-kana jp">
                          {renderHighlighted(tier.kana, tier.hlKana)}
                        </span>
                        <span class="tier-romaji">{tier.romaji}</span>
                      </div>
                      <div class="tier-row tier-row--meta">
                        {tier.aux ? (
                          <span
                            class="tier-label tier-label--aux"
                            title={AUX_TOOLTIP[tier.layer] ?? ''}
                          >
                            {tier.label} · <span class="tier-aux jp">{tier.aux}</span>
                          </span>
                        ) : (
                          <span class="tier-label">{tier.label}</span>
                        )}
                        <span class="tier-gloss">{tier.gloss}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Attribution footer ────────────────────────────────────────────── */}
        <p class="credit">Verb data derived from JMdict / EDICT, © EDRDG — used under the EDRDG licence (CC BY-SA).</p>
      </div>

      {ready && <div id="widget-ready" hidden />}
    </div>
  );
}
