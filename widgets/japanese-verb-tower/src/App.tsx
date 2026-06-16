import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import type { JSX } from 'preact';
import { VERBS, buildTower } from './engine';
import type { Tier } from './engine';

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
  const [verbIdx, setVerbIdx]     = useState(0);
  const [causative, setCausative] = useState(true);
  const [voice, setVoice]         = useState<'none' | 'passive' | 'potential'>('passive');
  const [polite, setPolite]       = useState(false);
  const [negative, setNegative]   = useState(false);
  const [past, setPast]           = useState(false);
  const [ready, setReady]         = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const verb = VERBS[verbIdx];

  const tower: Tier[] = useMemo(
    () => buildTower(verb, { causative, voice, polite, negative, past }),
    [verb, causative, voice, polite, negative, past],
  );

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

  useEffect(() => { setReady(true); }, []);

  const notes: string[] = [];
  if (verb.klass === 'suru' && voice === 'potential') {
    notes.push('する + potential → できる (suppletive — completely different word, not derived)');
  }
  if (verb.klass === 'ichidan' && !causative && voice !== 'none') {
    notes.push(
      `${verb.kanji}られる: ichidan passive = potential surface (homophony). ` +
      `Godan verbs diverge: 飲める (potential) vs 飲まれる (passive).`,
    );
  }
  if (verb.klass === 'kuru' && voice === 'passive') {
    notes.push('来る passive/potential = こられる (same form; irregular reading shift こ/き)');
  }

  // Display reversed: top tier (final form) first, base last
  const displayTiers = [...tower].reverse();

  return (
    <div class="container" ref={containerRef}>
      <div class="card">
        <header class="card-header">
          <h1>Japanese Verb Conjugation Tower</h1>
          <p class="hint">
            Pick a verb, toggle layers — watch the conjugated form build up morpheme by morpheme.
          </p>
        </header>

        {/* ── Verb picker — full width ─────────────────────────────────── */}
        <div class="verb-picker" role="group" aria-label="Select a verb">
          {VERBS.map((v, i) => (
            <button
              key={v.kanji}
              class={`verb-chip${i === verbIdx ? ' verb-chip--active' : ''}`}
              onClick={() => setVerbIdx(i)}
              aria-pressed={i === verbIdx}
              title={`${v.kanji} (${v.romaji}) — ${v.gloss}`}
            >
              <span class="verb-chip-kanji jp">{v.kanji}</span>
              <span class="verb-chip-sub">{v.romaji}</span>
              <span class="verb-chip-gloss">{v.gloss}</span>
            </button>
          ))}
        </div>

        {/* ── Two-column body ─────────────────────────────────────────── */}
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

            {/* Composition slot legend — fills left-column whitespace */}
            <div class="slot-legend" aria-label="Morpheme slot order">
              <div class="slot-legend-title">Composition order</div>
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
                          ? renderTopKanji(tier.kanji, tier.kana, tier.hlKanji, verb)
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
                        <span class="tier-label">{tier.label}</span>
                        <span class="tier-gloss">{tier.gloss}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {ready && <div id="widget-ready" hidden />}
    </div>
  );
}
