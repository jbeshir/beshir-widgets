// Easy to spot / OK / Hard to read meter with a breakdown of what costs points. Hard-to-read designs
// stay registrable; the meter only nudges, naming the one change that helps most — and holds the
// nudge back while the rule of tincture is broken, which has to be fixed first.

import { BAND_LABEL, BAND_RANGE, readability, type Design, type ReadabilityBand } from '../../lib/heraldry';
import { readabilityTip, type DesignReport } from '../../lib/builder';

const BANDS: ReadabilityBand[] = ['bold', 'fine', 'busy'];

export function ReadabilityMeter({ design, report }: { design: Design; report: DesignReport }) {
  const r = readability(design);
  const scored = r.breakdown.filter((b) => b.points > 0);
  const tip = readabilityTip(r, report);
  return (
    <section class="meter" data-testid="readability-meter" data-band={r.band} aria-labelledby="meter-title">
      <div class="meter-head">
        <h2 id="meter-title" class="section-label">Readability at a distance</h2>
        <p class="meter-value"><strong>{BAND_LABEL[r.band]}</strong></p>
      </div>
      <ol class="meter-steps" aria-label="Readability scale">
        {BANDS.map((b) => (
          <li key={b} class={`meter-step meter-step-${b}${b === r.band ? ' is-current' : ''}`} aria-current={b === r.band ? 'step' : undefined}>
            <span class="meter-bar" aria-hidden="true" />
            <span class="meter-step-label">{BAND_LABEL[b]}</span>
          </li>
        ))}
      </ol>
      {tip && <p class="meter-nudge" data-testid="readability-nudge">{tip}</p>}
      <details class="meter-details">
        <summary>What makes it harder to read?</summary>
        <ul class="meter-breakdown">
          {scored.length ? scored.map((b) => (
            <li key={b.factor}><span>{b.label}</span><span>+{b.points}</span></li>
          )) : <li><span>Nothing adds complexity yet</span><span>0</span></li>}
        </ul>
        <p class="meter-bands">
          {BANDS.map((b) => `${BAND_LABEL[b]}: ${BAND_RANGE[b]}`).join(' · ')} points in total. Simpler designs are easier to recognise.
        </p>
      </details>
    </section>
  );
}
