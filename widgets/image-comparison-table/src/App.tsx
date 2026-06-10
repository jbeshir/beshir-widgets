import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { resolveTable, TABLE_LIST, type Table } from './tables';
import { Grid } from './Grid';
import { Lightbox } from './Lightbox';
import { Picker } from './Picker';

export type Selection = { rowIdx: number; colIdx: number };

// Table id comes from `?table=<id>` (explicit) or the first path segment
// (e.g. `/imitating-classic-ai-art`). When absent or unknown, the app shows the
// table picker instead of a table.
function getInitialTableId(): string | null {
  try {
    const q = new URLSearchParams(window.location.search).get('table');
    if (q) return q;
    const seg = window.location.pathname.split('/').filter(Boolean)[0];
    return seg ? decodeURIComponent(seg) : null;
  } catch {
    return null;
  }
}

export function App() {
  const [table] = useState<Table | null>(() => resolveTable(getInitialTableId()));
  const [selection, setSelection] = useState<Selection | null>(null);
  const [ready, setReady] = useState(false);
  const [width, setWidth] = useState(960);
  const [fitStyle, setFitStyle] = useState<{ transform: string; marginBottom: string } | undefined>(
    undefined,
  );
  const pageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Fit the widget to the viewport: bound by available width (the grid reflows
  // to a compact layout when narrow) AND by available height (the whole thing
  // scales down so it fits without scrolling).
  useLayoutEffect(() => {
    const page = pageRef.current;
    const content = contentRef.current;
    if (!page || !content) return;

    const recompute = () => {
      const cs = getComputedStyle(page);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      // Use the viewport, not page.clientHeight — `.page` has min-height:100vh and
      // grows with tall content, so it would report the full content height.
      const availW = Math.max(0, window.innerWidth - padX);
      const availH = Math.max(0, window.innerHeight - padY);
      // Natural (untransformed) content size — transforms don't affect layout box.
      const naturalW = content.offsetWidth;
      const naturalH = content.offsetHeight;
      if (naturalW <= 0 || naturalH <= 0) return;

      const w = Math.max(280, Math.floor(availW));
      setWidth((prev) => (Math.abs(prev - w) > 4 ? w : prev));

      // Shrink to fit available height (and width); compensate the layout with a
      // negative margin so the page reclaims the space the scale visually removes,
      // avoiding scrollbars while keeping overflow visible for popovers.
      const s = Math.min(1, availW / naturalW, availH / naturalH);
      if (s < 0.999) {
        const next = {
          transform: `scale(${s})`,
          marginBottom: `-${Math.ceil(naturalH * (1 - s))}px`,
        };
        setFitStyle((prev) =>
          prev && prev.transform === next.transform && prev.marginBottom === next.marginBottom
            ? prev
            : next,
        );
      } else {
        setFitStyle((prev) => (prev === undefined ? prev : undefined));
      }
    };

    recompute();
    // Content size changes (reflow, table swap) — observe the layout box.
    const ro = new ResizeObserver(recompute);
    ro.observe(content);
    // Viewport size changes (window / iframe resize).
    window.addEventListener('resize', recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recompute);
    };
  }, []);

  // Mark widget ready after first paint.
  useEffect(() => {
    if (!ready) setReady(true);
  }, [ready]);

  // Reflect the resolved view in <title>.
  useEffect(() => {
    document.title = table ? `${table.title} — Image Comparison` : 'Image Comparison Tables';
  }, [table]);

  const compact = width < 560;

  const handleCellClick = useMemo(
    () => (rowIdx: number, colIdx: number) => setSelection({ rowIdx, colIdx }),
    [],
  );

  const closeLightbox = useMemo(() => () => setSelection(null), []);

  const navigateLightbox = useMemo(
    () => (dRow: number, dCol: number) => {
      if (!table) return;
      const rowCount = table.rows.length;
      const colCount = table.columns.length;
      setSelection((prev) => {
        if (!prev) return prev;
        const nextRow = Math.min(rowCount - 1, Math.max(0, prev.rowIdx + dRow));
        const nextCol = Math.min(colCount - 1, Math.max(0, prev.colIdx + dCol));
        if (nextRow === prev.rowIdx && nextCol === prev.colIdx) return prev;
        return { rowIdx: nextRow, colIdx: nextCol };
      });
    },
    [table],
  );

  return (
    <div class="page" ref={pageRef}>
      <div class="fit-scale" style={fitStyle}>
        <div class="container" ref={contentRef}>
          {table ? (
            <>
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
            </>
          ) : (
            <Picker tables={TABLE_LIST} />
          )}
        </div>
      </div>

      {table && selection && (
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
