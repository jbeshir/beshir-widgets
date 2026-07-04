import {
  ICON_FILL_LEGEND,
  TOWN_SQUARE_KEY,
  BUS_ROUTES,
  MAP_CREDIT,
  type KeyGlyph,
} from '../data/mapKey';

// The map's printed legend, hoisted into legible UI: the icon/fill legend, the Town Square area key,
// the bus routes, and the credit/source line — all as real components instead of raster print. Lives
// in a collapsible <details> so it never buries the map + pin workflow; open it to read the key.

// A single legend glyph. Icons are inline SVG (decorative — the row's text label carries the meaning,
// so every glyph is aria-hidden); fills are colour swatches; routes are sample line strokes. Colours
// approximate the printed map so the swatch reads as "the purple areas", "the tan areas", etc.
function KeyGlyphMark({ glyph }: { glyph: KeyGlyph }) {
  switch (glyph) {
    case 'ems':
      return (
        <svg class="key-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <rect x="1" y="1" width="18" height="18" rx="4" fill="#1f6fb2" />
          <path d="M10 4.5v11M4.5 10h11" stroke="#fff" stroke-width="2.6" stroke-linecap="round" />
        </svg>
      );
    case 'access-assist':
      return <WheelchairIcon bg="#1f6fb2" />;
    case 'access-camp':
      return <WheelchairIcon bg="#7a2231" />;
    case 'water-src':
      return (
        <svg class="key-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <path
            d="M10 2.5c3 3.6 5 6.2 5 8.6a5 5 0 0 1-10 0c0-2.4 2-5 5-8.6Z"
            fill="#12897a"
            stroke="#0c5d53"
            stroke-width="1"
          />
          <path d="M8 10.5a2.2 2.2 0 0 0 2.2 2.2" stroke="#dff5f0" stroke-width="1.4" fill="none" stroke-linecap="round" />
        </svg>
      );
    case 'transfer':
      return (
        <svg class="key-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <polygon
            points="10,1.8 12.1,6.4 17.1,6.9 13.3,10.3 14.4,15.2 10,12.7 5.6,15.2 6.7,10.3 2.9,6.9 7.9,6.4"
            fill="#e2a012"
            stroke="#a9760a"
            stroke-width="0.8"
            stroke-linejoin="round"
          />
        </svg>
      );
    case 'fill-noncamp':
      return <span class="key-swatch key-swatch--noncamp" aria-hidden="true" />;
    case 'fill-parking':
      return <span class="key-swatch key-swatch--parking" aria-hidden="true" />;
    case 'fill-royal':
      return <span class="key-swatch key-swatch--royal" aria-hidden="true" />;
    case 'fill-xblock':
      return <span class="key-swatch key-swatch--xblock" aria-hidden="true" />;
    case 'fill-water':
      return <span class="key-swatch key-swatch--water" aria-hidden="true" />;
    case 'line-oneway':
      return (
        <svg class="key-icon key-icon--line" viewBox="0 0 28 12" aria-hidden="true" focusable="false">
          <path d="M2 6h20" stroke="var(--fg-secondary)" stroke-width="2" stroke-linecap="round" />
          <path d="M17 2.5 22 6l-5 3.5" fill="none" stroke="var(--fg-secondary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      );
    case 'line-footpath':
      return (
        <svg class="key-icon key-icon--line" viewBox="0 0 28 12" aria-hidden="true" focusable="false">
          <path d="M2 6h24" stroke="var(--fg-secondary)" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 3" />
        </svg>
      );
    case 'line-mainloop':
      return (
        <svg class="key-icon key-icon--line" viewBox="0 0 28 12" aria-hidden="true" focusable="false">
          <path d="M2 6h24" stroke="#e5801b" stroke-width="3" stroke-linecap="round" stroke-dasharray="6 4" />
        </svg>
      );
    case 'line-westloop':
      return (
        <svg class="key-icon key-icon--line" viewBox="0 0 28 12" aria-hidden="true" focusable="false">
          <path d="M2 6h24" stroke="#c0392b" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 3" />
        </svg>
      );
    default:
      return null;
  }
}

function WheelchairIcon({ bg }: { bg: string }) {
  return (
    <svg class="key-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="18" height="18" rx="4" fill={bg} />
      <g fill="#fff">
        <circle cx="8" cy="4.4" r="1.5" />
        <path
          d="M7 6.6a1 1 0 0 1 2 0v2.2h3.1a1 1 0 0 1 0 2H9.4l-.2 1.1a4 4 0 1 1-3.5 1l1.2 1.2a2.3 2.3 0 1 0 2.4-.9Z"
          fill="none"
          stroke="#fff"
          stroke-width="1.3"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </g>
    </svg>
  );
}

function KeyRow({ glyph, label }: { glyph: KeyGlyph; label: string }) {
  return (
    <li class="key-row">
      <span class="key-row-mark">
        <KeyGlyphMark glyph={glyph} />
      </span>
      <span class="key-row-label">{label}</span>
    </li>
  );
}

// `open`/`onToggle` let the parent drive the disclosure state (for the dock's single-open mutual
// exclusion). Left uncontrolled — native <details> behaviour — when neither is supplied. The <details>
// element and its `.open` semantics are preserved either way so the journey evals keep working.
export function MapKey({ open, onToggle }: { open?: boolean; onToggle?: (isOpen: boolean) => void } = {}) {
  return (
    <details
      class="info-panel map-key"
      data-testid="map-legend"
      open={open}
      onToggle={(e) => onToggle?.((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary class="info-panel-summary" title="Map key">
        <span class="info-panel-heading">
          <h2 class="info-panel-title">Map key</h2>
          <span class="info-panel-hint">Icons, area fills, town square &amp; bus routes</span>
        </span>
      </summary>
      <div class="info-panel-body">
        <section class="key-group" aria-labelledby="key-group-icons">
          <h2 class="key-group-title" id="key-group-icons">Icons &amp; areas</h2>
          <ul class="key-list" role="list">
            {ICON_FILL_LEGEND.map((item) => (
              <KeyRow key={item.glyph} glyph={item.glyph} label={item.label} />
            ))}
          </ul>
        </section>

        <section class="key-group" aria-labelledby="key-group-town">
          <h2 class="key-group-title" id="key-group-town">Town Square area key</h2>
          <ol class="key-area-list" role="list">
            {TOWN_SQUARE_KEY.map((item) => (
              <li class="key-area-row" key={item.n}>
                <span class="key-area-num" aria-hidden="true">{item.n}</span>
                <span class="key-area-text">
                  <span class="key-area-label">{item.label}</span>
                  {item.detail && <span class="key-area-detail">{item.detail}</span>}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section class="key-group" aria-labelledby="key-group-bus">
          <h2 class="key-group-title" id="key-group-bus">Bus routes</h2>
          <ul class="key-list" role="list">
            {BUS_ROUTES.map((item) => (
              <KeyRow key={item.glyph} glyph={item.glyph} label={item.label} />
            ))}
          </ul>
        </section>

        <p class="key-credit">
          {MAP_CREDIT.createdBy} Last edit: {MAP_CREDIT.lastEdit}.{' '}
          <a class="key-credit-link" href={MAP_CREDIT.sourceUrl} target="_blank" rel="noopener noreferrer">
            {MAP_CREDIT.sourceLabel}
            <span class="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      </div>
    </details>
  );
}
