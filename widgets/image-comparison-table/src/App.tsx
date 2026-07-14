import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
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
  const pageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Keep the compact-layout signal but never transform-scale the document:
  // scaling can render otherwise compliant text below the 14px floor.
  useEffect(() => {
    const recompute = () => setWidth((prev) => {
      const next = Math.max(280, Math.floor(window.innerWidth));
      return Math.abs(prev - next) > 4 ? next : prev;
    });
    recompute();
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
  }, []);

  // Mark widget ready after first paint.
  useEffect(() => {
    if (!ready) setReady(true);
  }, [ready]);

  // The picker/table is interactive after first paint. This is metadata for
  // the journey harness and does not alter either view's behaviour.
  useEffect(() => {
    document.documentElement.dataset.widgetState = ready ? 'ready' : 'loading';
  }, [ready]);

  // Reflect the resolved view in <title>.
  useEffect(() => {
    document.title = table ? `${table.title} — Image Comparison` : 'Image Comparison Tables';
  }, [table]);

  // Report content height so a host can auto-size the iframe instead of
  // shrinking typography to fit a fixed-height frame.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    let last = -1;
    let timer: ReturnType<typeof setTimeout>;
    const send = () => {
      const h = el.scrollHeight;
      if (h === last) return;
      last = h;
      window.parent.postMessage({ type: 'resize', height: h }, '*');
    };
    const ro = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(send, 100);
    });
    ro.observe(el);
    send();
    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, []);

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
