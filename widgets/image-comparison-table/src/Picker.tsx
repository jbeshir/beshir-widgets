import { previewThumbs, type Table } from './tables';

type Props = {
  tables: Table[];
};

// Landing view shown when no table is selected. Each card uses the supported
// `?table=<id>` query fixture, preserving the current document path. This works
// for both deployed deep links and the file:// journey harness's index document.
export function Picker({ tables }: Props) {
  return (
    <section class="picker card" aria-labelledby="picker-title">
      <header class="card-header">
        <span class="eyebrow">Comparisons</span>
        <h1 id="picker-title">Image Comparison Tables</h1>
        <p class="subtitle">
          Pick a comparison to explore — each opens a labelled grid of images with click-to-zoom and the prompts behind them.
        </p>
      </header>

      <ul class="pick-grid" role="list">
        {tables.map((t) => (
          <li key={t.id}>
            <a class="pick-card" data-testid="table-picker-card" href={`?table=${encodeURIComponent(t.id)}`}>
              <span class="pick-thumbs" aria-hidden="true">
                {previewThumbs(t).map((src) => (
                  <span class="pick-thumb" key={src}>
                    <img src={src} alt="" loading="lazy" decoding="async" draggable={false} />
                  </span>
                ))}
              </span>
              <span class="pick-meta">
                <span class="pick-title">{t.title}</span>
                {t.subtitle && <span class="pick-sub">{t.subtitle}</span>}
                <span class="pick-go" aria-hidden="true">
                  View
                  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 10h10M11 6l4 4-4 4" />
                  </svg>
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
