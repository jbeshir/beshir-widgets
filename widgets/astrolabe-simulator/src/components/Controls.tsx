import type { JSX } from 'preact';
import { CITIES } from '../data/cities';
import { PLATES } from '../data/plates';
import { reset, selectPlate, setAlidade, setFace, setLocation, setRete, setRule, toggleLayer, useStore, type Visibility } from '../store';

const LAYERS: { key: keyof Visibility; label: string }[] = [
  { key: 'almucantars', label: 'Altitude circles' }, { key: 'azimuths', label: 'Azimuths' },
  { key: 'unequalHours', label: 'Unequal hours' }, { key: 'ecliptic', label: 'Ecliptic' },
  { key: 'stars', label: 'Stars' }, { key: 'rule', label: 'Rule' },
];
const number = (value: string, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function Controls(): JSX.Element {
  const state = useStore();
  return <div className="controls" aria-label="Astrolabe controls">
    <div className="control-group control-actions">
      <button className="face-toggle" data-testid="face-toggle" aria-pressed={state.face === 'back'} onClick={() => setFace(state.face === 'front' ? 'back' : 'front')}>
        Show {state.face === 'front' ? 'back' : 'front'}
      </button>
    </div>
    <div className="control-group location-controls">
      <label>City <select data-testid="city-select" value={state.location.manual ? '' : state.location.label} onChange={(event) => {
        const city = CITIES.find((entry) => entry.name === event.currentTarget.value); if (city) setLocation(city);
      }}><option value="">Custom</option>{CITIES.map((city) => <option key={city.name} value={city.name}>{city.name}</option>)}</select></label>
      <label>Latitude <input data-testid="lat-input" type="number" min="-90" max="90" step="0.01" value={state.location.lat} onInput={(event) => setLocation({ label: 'Custom', lat: number(event.currentTarget.value, state.location.lat), lng: state.location.lng, manual: true })} /></label>
      <label>Longitude <input data-testid="lng-input" type="number" min="-180" max="180" step="0.01" value={state.location.lng} onInput={(event) => setLocation({ label: 'Custom', lat: state.location.lat, lng: number(event.currentTarget.value, state.location.lng), manual: true })} /></label>
      <label>Plate <select data-testid="plate-select" value={state.plateLatitude} onChange={(event) => selectPlate(Number(event.currentTarget.value))}>{PLATES.map((plate) => <option key={plate.latitude} value={plate.latitude}>{plate.label} ({plate.latitude.toFixed(2)}°)</option>)}</select></label>
    </div>
    <div className="control-group angle-controls">
      {state.face === 'front' ? <>
        <label>Rete angle <input data-testid="rete-angle" type="number" min="0" max="360" step="1" value={state.reteRotation} onInput={(event) => setRete(Number(event.currentTarget.value))} /></label>
        <label>Rule angle <input data-testid="rule-angle" type="number" min="0" max="360" step="1" value={state.ruleRotation} onInput={(event) => setRule(Number(event.currentTarget.value))} /></label>
      </> : <label>Alidade angle <input data-testid="alidade-angle" type="number" min="0" max="360" step="1" value={state.alidadeRotation} onInput={(event) => setAlidade(Number(event.currentTarget.value))} /></label>}
    </div>
    <button className="reset-button" data-testid="reset-button" onClick={reset}>Reset</button>
    {state.face === 'front' && <fieldset className="layer-controls"><legend>Visible layers</legend>{LAYERS.map(({ key, label }) => <label key={key}>
      <input type="checkbox" data-testid={`layer-${key}`} checked={state.visibility[key]} onChange={() => toggleLayer(key)} /> {label}
    </label>)}</fieldset>}
  </div>;
}
