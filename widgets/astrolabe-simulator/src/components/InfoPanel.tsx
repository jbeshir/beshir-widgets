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
      <li>Turn the rule across a star and read its position against the fixed plate grid.</li>
      <li>Flip to the back, rotate the alidade to align its pointer line with the desired angle, and read the degree and back scales.</li>
      <li>On the back, set the alidade to the Sun’s noon altitude and mark its crossing with curve VI. Keep that distance from the pivot, turn to the observed altitude, then read I–VI before noon or the mirrored VI–XII after noon.</li>
    </ol></details>
    <details><summary>Unequal-hour scale</summary>{state.face === 'front'
      ? <p>The curves below the horizon divide each star’s nightly path into twelve equal parts. At night, read the Sun’s ecliptic position against them; in daylight, read the point exactly opposite the Sun. The horizon marks sunset and sunrise, and the middle curve marks the sixth hour. Interpolate between curves.</p>
      : <p>The upper semicircle is the traditional double horary quadrant: six exact circular constructions serve the mirrored labels I–XII. Find the Sun’s noon altitude for the date, set the alidade there and note where it meets VI; transfer that pivot distance to the current-altitude line and interpolate between the hour curves. Use the left/morning I–VI sequence before noon and the mirrored VI–XII sequence afterward.</p>}
    </details>
    <details><summary>Accuracy and simplifications</summary><p>This is an educational geometric model, not an observational-precision instrument. Stars use J2000 positions without precession; refraction is omitted; obliquity is fixed; solar longitude and the equation of time use compact approximations. Plates are a finite northern set. The front unequal-hour lines exactly divide the model’s below-horizon diurnal arcs. The back engraving is an exact traditional geometric construction, but its historical altitude read-off is approximate away from sunrise, noon and sunset.</p></details>
  </aside>;
}
