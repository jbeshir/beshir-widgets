import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { useLessonUi } from '../lessonUi';
import { CITIES } from '../data/cities';
import { PlateSelect } from './PlateSelect';
import { reset, setAlidade, setFace, setLocation, setRete, setRule, toggleLayer, useStore, type Visibility } from '../store';

type LayerControl = { key: keyof Visibility; label: string; description?: string };
const FRONT_LAYERS: LayerControl[] = [
  { key: 'almucantars', label: 'Altitude circles' }, { key: 'azimuths', label: 'Azimuths' },
  { key: 'unequalHours', label: 'Unequal hours' }, { key: 'ecliptic', label: 'Ecliptic' },
  { key: 'artificialAssists', label: 'Artificial assists', description: 'Shows calculated markers that are not part of a historical astrolabe.' },
  { key: 'stars', label: 'Stars' }, { key: 'rule', label: 'Rule' },
];
const BACK_LAYERS: LayerControl[] = [
  { key: 'calendar', label: 'Calendar' }, { key: 'zodiacScale', label: 'Zodiac' },
  { key: 'shadowSquare', label: 'Shadow square' }, { key: 'backUnequalHours', label: 'Unequal hours' },
  { key: 'equationOfTime', label: 'Equation of time', description: 'Shows the correction between apparent solar time and mean clock time.' }, { key: 'alidade', label: 'Alidade' },
];
const number = (value: string, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function Controls(): JSX.Element {
  const state = useStore();
  const lesson = useLessonUi();
  // While a lesson is open the settings fold away (closed) so the instrument, the step and its actions share the screen;
  // a step that needs the plate menu shows its own copy in the guide.
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [lesson.active]);
  const settings = <>
    <div className="control-group location-controls">
      <label>City <select data-testid="city-select" value={state.location.manual ? '' : state.location.label} onChange={(event) => {
        const city = CITIES.find((entry) => entry.name === event.currentTarget.value); if (city) setLocation(city);
      }}><option value="">Custom</option>{CITIES.map((city) => <option key={city.name} value={city.name}>{city.name}</option>)}</select></label>
      <label>Latitude <input data-testid="lat-input" type="number" min="-90" max="90" step="0.01" value={state.location.lat} onInput={(event) => setLocation({ label: 'Custom', lat: number(event.currentTarget.value, state.location.lat), lng: state.location.lng, manual: true })} /></label>
      <label>Longitude <input data-testid="lng-input" type="number" min="-180" max="180" step="0.01" value={state.location.lng} onInput={(event) => setLocation({ label: 'Custom', lat: state.location.lat, lng: number(event.currentTarget.value, state.location.lng), manual: true })} /></label>
      <PlateSelect testId="plate-select" part={!lesson.active} />
    </div>
    {!lesson.active && <div className="control-group angle-controls">
      {state.face === 'front' ? <>
        <label>Rete <input data-testid="rete-angle" type="number" min="0" max="360" step="1" value={state.reteRotation} onInput={(event) => setRete(Number(event.currentTarget.value))} /></label>
        <label>Rule <input data-testid="rule-angle" type="number" min="0" max="360" step="1" value={state.ruleRotation} onInput={(event) => setRule(Number(event.currentTarget.value))} /></label>
      </> : <label>Alidade <input data-testid="alidade-angle" type="number" min="0" max="360" step="1" value={state.alidadeRotation} onInput={(event) => setAlidade(Number(event.currentTarget.value))} /></label>}
    </div>}
    <fieldset className="layer-controls"><legend>Visible layers</legend>{(state.face === 'front' ? FRONT_LAYERS : BACK_LAYERS).map(({ key, label, description }) => <label key={key} title={description}>
      <input type="checkbox" data-testid={`layer-${key}`} aria-description={description} checked={state.visibility[key]} onChange={() => toggleLayer(key)} /> {label}
    </label>)}</fieldset>
  </>;
  return <div className={`controls${lesson.active ? ' controls-lesson' : ''}`} aria-label="Astrolabe controls">
    <div className="control-group control-actions">
      <button className="face-toggle" data-testid="face-toggle" data-part="face-toggle" aria-pressed={state.face === 'back'} onClick={() => setFace(state.face === 'front' ? 'back' : 'front')}>
        Show {state.face === 'front' ? 'back' : 'front'}
      </button>
      <button className="reset-button" data-testid="reset-button" onClick={reset}>Reset</button>
    </div>
    {lesson.active
      ? <details className="settings-disclosure" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary>Instrument settings</summary>
        <div className="settings-body">{settings}</div>
      </details>
      : settings}
  </div>;
}
