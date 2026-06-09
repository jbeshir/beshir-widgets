import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { resolveTable, type Table } from './tables';
import { Grid } from './Grid';
import { Lightbox } from './Lightbox';

export type Selection = { rowIdx: number; colIdx: number };

function getInitialTableId(): string | null {
  try {
    return new URLSearchParams(window.location.search).get('table');
  } catch {
    return null;
  }
}

export function App() {
  const [table] = useState<Table>(() => resolveTable(getInitialTableId()));
  const [selection, setSelection] = useState<Selection | null>(null);
  const [ready, setReady] = useState(false);
  const [width, setWidth] = useState(960);
  const containerRef = useRef<HTMLDivElement>(null);

  // Observe container width so the grid can adapt for narrow embeds.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(280, Math.floor(entry.contentRect.width));
        setWidth((prev) => (Math.abs(prev - w) > 4 ? w : prev));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Mark widget ready after first paint.
  useEffect(() => {
    if (!ready) setReady(true);
  }, [ready]);

  // Reflect the resolved table id in <title> so it's clear when navigated to directly.
  useEffect(() => {
    document.title = `${table.title} — Image Comparison`;
  }, [table.title]);

  const compact = width < 560;

  const handleCellClick = useMemo(
    () => (rowIdx: number, colIdx: number) => setSelection({ rowIdx, colIdx }),
    [],
  );

  const closeLightbox = useMemo(() => () => setSelection(null), []);

  const navigateLightbox = useMemo(
    () => (dRow: number, dCol: number) => {
      setSelection((prev) => {
        if (!prev) return prev;
        const rowCount = table.rows.length;
        const colCount = table.columns.length;
        const nextRow = Math.min(rowCount - 1, Math.max(0, prev.rowIdx + dRow));
        const nextCol = Math.min(colCount - 1, Math.max(0, prev.colIdx + dCol));
        if (nextRow === prev.rowIdx && nextCol === prev.colIdx) return prev;
        return { rowIdx: nextRow, colIdx: nextCol };
      });
    },
    [table.rows.length, table.columns.length],
  );

  return (
    <div class="page">
      <div class="container" ref={containerRef}>
        <article class="card" aria-labelledby="ict-title">
          <header class="card-header">
            <span class="eyebrow">Comparison</span>
            <h1 id="ict-title">{table.title}</h1>
            {table.subtitle && <p class="subtitle">{table.subtitle}</p>}
          </header>

          <Grid table={table} compact={compact} onCellClick={handleCellClick} />
        </article>

        <div class="footnote" aria-label="Usage hints">
          <span class="footnote-hint">
            <svg aria-hidden="true" viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="9" cy="9" r="6" />
              <path d="m17 17-3.5-3.5" />
              <path d="M9 6v6M6 9h6" />
            </svg>
            Click any thumbnail to expand
          </span>
          <span class="footnote-hint">
            <span class="info-glyph" aria-hidden="true">ⓘ</span>
            Row label shows the generation prompt
          </span>
        </div>
      </div>

      {selection && (
        <Lightbox
          table={table}
          selection={selection}
          onClose={closeLightbox}
          onNavigate={navigateLightbox}
        />
      )}

      {ready && <div id="widget-ready" data-ready="true" hidden />}
    </div>
  );
}
