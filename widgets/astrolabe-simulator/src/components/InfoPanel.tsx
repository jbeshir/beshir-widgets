import type { JSX } from 'preact';
import { setHighlight, useStore } from '../store';

const PARTS = [
  ['mater', 'Mater', 'The body and graduated limb of the instrument.', 'both'],
  ['plate', 'Latitude plate', 'The fixed horizon, altitude and azimuth grid for one latitude.', 'front'],
  ['rete', 'Rete', 'The rotating star map and ecliptic zodiac ring.', 'front'],
  ['rule', 'Rule', 'A sighting and reading edge on the front.', 'front'],
  ['back', 'Back scales', 'Calendar, zodiac, equation-of-time, shadow-square and unequal-hour engravings.', 'back'],
  ['alidade', 'Alidade', 'The rotating sighting rule on the back.', 'back'],
] as const;

export function InfoPanel(): JSX.Element {
  const state = useStore();
  const difference = Math.abs(Math.abs(state.location.lat) - state.plateLatitude);
  const southern = state.location.lat < 0;
  const visibleParts = PARTS.filter(([, , , face]) => face === 'both' || face === state.face);
  const mismatch = difference < 0.5
    ? `This ${state.plateLatitude.toFixed(2)}° plate matches your latitude closely.`
    : `Your latitude and this plate differ by ${difference.toFixed(2)}°. Horizon and altitude readings can be wrong by about ${difference.toFixed(1)}°; near the horizon, timing may shift by a few minutes per degree. The star map and Sun position remain correct.`;
  return <aside className="info-panel" aria-label="How to use the astrolabe">
    <p className="mismatch" data-testid="mismatch" role="status" aria-live="polite">{mismatch}{southern && ' This simulator uses northern plates and does not reverse the construction for the southern hemisphere.'}</p>
    <details open><summary>Parts of the {state.face}</summary><ul className="parts-list">{visibleParts.map(([key, name, description]) => <li key={key}><button className={`part-button${state.highlight === key ? ' selected' : ''}`} onFocus={() => setHighlight(key)} onBlur={() => setHighlight(null)} onMouseEnter={() => setHighlight(key)} onMouseLeave={() => setHighlight(null)} onClick={() => setHighlight(state.highlight === key ? null : key)}><strong>{name}</strong><span>{description}</span></button></li>)}</ul></details>
    <details><summary>Five things to try</summary><ol>
      <li>Choose your city, then select the closest latitude plate and check the mismatch above.</li>
      <li>Drag the rete until the Sun or a known star is aligned for the date and time you want to explore.</li>
      <li>Turn the rule across a star pointer and read its position against the fixed plate grid.</li>
      <li>Flip to the back, rotate the alidade to align its pointer line with the desired angle, and read the degree and back scales.</li>
      <li>Use the calendar, zodiac and shadow-square engravings to compare civil dates, solar longitude and proportional shadows.</li>
    </ol></details>
    <details><summary>Accuracy and simplifications</summary><p>This is an educational geometric model, not an observational-precision instrument. Stars use J2000 positions without precession; refraction is omitted; obliquity is fixed; solar longitude and the equation of time use compact approximations. Plates are a finite northern set, and the unequal-hour curves and physical engraving are idealized.</p></details>
  </aside>;
}
