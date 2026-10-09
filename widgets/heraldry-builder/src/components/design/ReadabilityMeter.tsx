// Bold / Fine / Busy readability meter with a points breakdown (FINDINGS §4.8). Busy designs stay
// registrable; the meter only nudges.

import { BAND_LABEL, readability, type NormDesign, type ReadabilityBand } from '../../lib/heraldry';

const BANDS: ReadabilityBand[] = ['bold', 'fine', 'busy'];
const BAND_RANGE: Record<ReadabilityBand, string> = { bold: '0–3', fine: '4–6', busy: '7+' };

export function ReadabilityMeter({ design }: { design: NormDesign }) {
  const r = readability(design);
  const scored = r.breakdown.filter((b) => b.points > 0);
  return (
    <section class="meter" data-testid="readability-meter" data-band={r.band} aria-labelledby="meter-title">
      <div class="meter-head">
        <h2 id="meter-title" class="section-label">Readability</h2>
        <p class="meter-value"><strong>{BAND_LABEL[r.band]}</strong> · {r.score} {r.score === 1 ? 'point' : 'points'}</p>
      </div>
      <ol class="meter-steps" aria-label="Readability scale">
        {BANDS.map((b) => (
          <li key={b} class={`meter-step meter-step-${b}${b === r.band ? ' is-current' : ''}`} aria-current={b === r.band ? 'step' : undefined}>
            <span class="meter-bar" aria-hidden="true" />
            <span class="meter-step-label">{BAND_LABEL[b]}</span>
          </li>
        ))}
      </ol>
      {r.band === 'busy' && (
        <p class="meter-nudge" data-testid="readability-nudge">
          Busy arms are hard to read at a distance. Try fewer tinctures, a plain field, or fewer charges.
        </p>
      )}
      <details class="meter-details">
        <summary>How is this scored?</summary>
        <ul class="meter-breakdown">
          {scored.length ? scored.map((b) => (
            <li key={b.factor}><span>{b.label}</span><span>+{b.points}</span></li>
          )) : <li><span>Nothing adds complexity yet</span><span>0</span></li>}
        </ul>
        <p class="meter-bands">
          {BANDS.map((b) => `${BAND_LABEL[b]} ${BAND_RANGE[b]}`).join(' · ')} points. Simpler arms are easier to recognise.
        </p>
      </details>
    </section>
  );
}
