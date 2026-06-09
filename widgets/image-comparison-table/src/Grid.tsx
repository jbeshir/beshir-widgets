import type { Table } from './tables';
import { InfoPopover } from './InfoPopover';

type Props = {
  table: Table;
  compact: boolean;
  onCellClick: (rowIdx: number, colIdx: number) => void;
};

export function Grid({ table, compact, onCellClick }: Props) {
  const cols = table.columns.length;

  return (
    <div class={`grid-wrap${compact ? ' grid-wrap--compact' : ''}`}>
      <div
        class="grid"
        role="table"
        aria-label={table.title}
        style={{ '--cols': cols } as any}
      >
        <div class="grid-row grid-row--head" role="row">
          <div class="grid-cell grid-cell--corner" role="columnheader" aria-label="Theme" />
          {table.columns.map((col) => (
            <div class="grid-cell grid-cell--head" role="columnheader" key={col.id}>
              <span class="col-label">{col.label}</span>
              {col.reference
                ? <span class="col-tag" title="Reference image, not generated from the row prompt">reference</span>
                : <span class="col-tag">AI</span>}
            </div>
          ))}
        </div>

        {table.rows.map((row, rowIdx) => (
          <div class="grid-row" role="row" key={row.id}>
            <div class="grid-cell grid-cell--label" role="rowheader">
              <span class="row-label">{row.label}</span>
              {row.prompt && (
                <InfoPopover
                  prompt={row.prompt}
                  rowLabel={row.label}
                  note={table.promptNote}
                />
              )}
            </div>
            {table.columns.map((col, colIdx) => {
              const cell = row.cells[col.id];
              if (!cell) {
                return (
                  <div class="grid-cell grid-cell--missing" role="cell" key={col.id} aria-label="Missing image" />
                );
              }
              return (
                <div class="grid-cell" role="cell" key={col.id}>
                  <button
                    type="button"
                    class="grid-cell--img"
                    onClick={() => onCellClick(rowIdx, colIdx)}
                    aria-label={`Open full-size ${cell.alt}`}
                  >
                    <span class="thumb-frame">
                      <img
                        src={cell.thumb}
                        alt={cell.alt}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                      />
                    </span>
                    <span class="thumb-zoom" aria-hidden="true">
                      <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="9" cy="9" r="6" />
                        <path d="m17 17-3.5-3.5" />
                        <path d="M9 6v6" />
                        <path d="M6 9h6" />
                      </svg>
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
