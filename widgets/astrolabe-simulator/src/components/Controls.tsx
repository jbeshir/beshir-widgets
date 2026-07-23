import type { JSX } from 'preact';
import { CITIES } from '../data/cities';
import { PLATES } from '../data/plates';
import { reset, selectPlate, setAlidade, setFace, setLocation, setRete, setRule, toggleLayer, useStore, type Visibility } from '../store';

const FRONT_LAYERS: { key: keyof Visibility; label: string }[] = [
  { key: 'almucantars', label: 'Altitude circles' }, { key: 'azimuths', label: 'Azimuths' },
  { key: 'unequalHours', label: 'Unequal hours' }, { key: 'ecliptic', label: 'Ecliptic' },
  { key: 'stars', label: 'Stars' }, { key: 'rule', label: 'Rule' },
];
const BACK_LAYERS: { key: keyof Visibility; label: string }[] = [
  { key: 'calendar', label: 'Calendar' }, { key: 'zodiacScale', label: 'Zodiac' },
  { key: 'shadowSquare', label: 'Shadow square' }, { key: 'backUnequalHours', label: 'Unequal hours' },
  { key: 'equationOfTime', label: 'Equation of time' }, { key: 'alidade', label: 'Alidade' },
];
const number = (value: string, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function Controls(): JSX.Element {
  const state = useStore();
  const exactPlateLatitude = Math.abs(state.location.lat);
  const exactPlateValue = `exact:${exactPlateLatitude}`;
  const plateValue = state.plateLatitude === exactPlateLatitude ? exactPlateValue : String(state.plateLatitude);
  return <div className="controls" aria-label="Astrolabe controls">
    <div className="control-group control-actions">
      <button className="face-toggle" data-testid="face-toggle" aria-pressed={state.face === 'back'} onClick={() => setFace(state.face === 'front' ? 'back' : 'front')}>
        Show {state.face === 'front' ? 'back' : 'front'}
      </button>
      <button className="reset-button" data-testid="reset-button" onClick={reset}>Reset</button>
    </div>
    <div className="control-group location-controls">
      <label>City <select data-testid="city-select" value={state.location.manual ? '' : state.location.label} onChange={(event) => {
        const city = CITIES.find((entry) => entry.name === event.currentTarget.value); if (city) setLocation(city);
      }}><option value="">Custom</option>{CITIES.map((city) => <option key={city.name} value={city.name}>{city.name}</option>)}</select></label>
      <label>Latitude <input data-testid="lat-input" type="number" min="-90" max="90" step="0.01" value={state.location.lat} onInput={(event) => setLocation({ label: 'Custom', lat: number(event.currentTarget.value, state.location.lat), lng: state.location.lng, manual: true })} /></label>
      <label>Longitude <input data-testid="lng-input" type="number" min="-180" max="180" step="0.01" value={state.location.lng} onInput={(event) => setLocation({ label: 'Custom', lat: state.location.lat, lng: number(event.currentTarget.value, state.location.lng), manual: true })} /></label>
      <label>Plate <select data-testid="plate-select" value={plateValue} onChange={(event) => {
        selectPlate(event.currentTarget.value.startsWith('exact:') ? exactPlateLatitude : Number(event.currentTarget.value));
      }}>
        <option value={exactPlateValue}>Exact</option>
        {PLATES.map((plate) => <option key={plate.latitude} value={plate.latitude}>{plate.label}</option>)}
      </select></label>
    </div>
    <div className="control-group angle-controls">
      {state.face === 'front' ? <>
        <label>Rete <input data-testid="rete-angle" type="number" min="0" max="360" step="1" value={state.reteRotation} onInput={(event) => setRete(Number(event.currentTarget.value))} /></label>
        <label>Rule <input data-testid="rule-angle" type="number" min="0" max="360" step="1" value={state.ruleRotation} onInput={(event) => setRule(Number(event.currentTarget.value))} /></label>
      </> : <label>Alidade <input data-testid="alidade-angle" type="number" min="0" max="360" step="1" value={state.alidadeRotation} onInput={(event) => setAlidade(Number(event.currentTarget.value))} /></label>}
    </div>
    <fieldset className="layer-controls"><legend>Visible layers</legend>{(state.face === 'front' ? FRONT_LAYERS : BACK_LAYERS).map(({ key, label }) => <label key={key}>
      <input type="checkbox" data-testid={`layer-${key}`} checked={state.visibility[key]} onChange={() => toggleLayer(key)} /> {label}
    </label>)}</fieldset>
  </div>;
}
