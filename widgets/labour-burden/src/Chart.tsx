import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { scaleLinear } from 'd3-scale';
import { Bucket, SEGMENT_LABEL, SEGMENT_ORDER, SegmentKey } from './types';

const ROW_HEIGHT = 48;
const BAR_HEIGHT = 22;
const BAR_Y = 5;
const BAR_CENTER_Y = BAR_Y + BAR_HEIGHT / 2;
const AXIS_HEIGHT = 22;

// Whisker lives in its own lane below the bar so the min-max range line never
// overlaps the segment fills.
const WHISKER_Y = BAR_Y + BAR_HEIGHT + 10;
const WHISKER_CAP_HALF = 4;

// Hit-area padding: segments render at their true (possibly sub-pixel) width,
// but each gets an enlarged transparent overlay for tap/click purposes,
// capped so neighbouring overlays don't swallow each other.
const HIT_PAD = 5;
const HIT_Y = Math.max(0, BAR_Y - 5);
const HIT_HEIGHT = BAR_Y + BAR_HEIGHT + 5 - HIT_Y;

interface TooltipState {
  x: number;
  y: number;
  title: string;
  range: string;
  citation: string;
}

export interface ChartSelection {
  bucketId: string;
  segmentKey: SegmentKey;
}

export interface ChartProps {
  buckets: Bucket[];
  domainMax: number;
  selected: ChartSelection | null;
  onSelect: (bucket: Bucket, segmentKey: SegmentKey) => void;
  onCaveat: (bucket: Bucket) => void;
  onReady?: () => void;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? `${n}` : n.toFixed(1);
}

export function Chart({ buckets, domainMax, selected, onSelect, onCaveat, onReady }: ChartProps) {
  const barCellRef = useRef<HTMLDivElement>(null);
  const [barWidth, setBarWidth] = useState(320);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const readyFired = useRef(false);

  useEffect(() => {
    const el = barCellRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(120, Math.floor(entry.contentRect.width));
        setBarWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (readyFired.current) return;
    readyFired.current = true;
    onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const xScale = useMemo(
    () => scaleLinear().domain([0, domainMax]).range([0, barWidth]).clamp(true),
    [domainMax, barWidth],
  );

  const tickCount = Math.min(6, Math.max(3, Math.round(barWidth / 90)));
  const ticks = useMemo(() => xScale.ticks(tickCount), [xScale, tickCount]);

  function showTooltip(target: Element, title: string, range: string, citation: string) {
    const rect = target.getBoundingClientRect();
    setTooltip({ x: rect.left + rect.width / 2, y: rect.top, title, range, citation });
  }

  function hideTooltip() {
    setTooltip(null);
  }

  const rows = buckets.flatMap((bucket) => {
    let cum = 0;
    const positioned = SEGMENT_ORDER.map((key) => {
      const seg = bucket.segments[key];
      const x0 = cum;
      cum += seg.central;
      return { key, seg, x0, x1: cum };
    });
    const segs = SEGMENT_ORDER.map((key) => bucket.segments[key]);
    const sumLow = segs.reduce((a, s) => a + s.low, 0);
    const sumCentral = segs.reduce((a, s) => a + s.central, 0);
    const sumHigh = segs.reduce((a, s) => a + s.high, 0);

    const screenWidths = positioned.map((p) => Math.max(xScale(p.x1) - xScale(p.x0), 1.5));

    const labelCell = (
      <div className="grid-cell label-cell" key={`${bucket.id}-label`}>
        <div className="bucket-label">{bucket.label}</div>
        <div className="bucket-meta">
          {bucket.era} · {bucket.region}
        </div>
        <button
          type="button"
          className="caveat-trigger"
          data-testid={`caveat-${bucket.id}`}
          onClick={() => onCaveat(bucket)}
        >
          Why contested?
        </button>
      </div>
    );

    const barCell = (
      <div className="grid-cell bar-cell" key={`${bucket.id}-bar`} data-testid={`bar-${bucket.id}`}>
        <svg
          width={barWidth}
          height={ROW_HEIGHT}
          role="img"
          aria-label={`${bucket.label}: total burden central estimate ${fmt(sumCentral)}%, plausible range ${fmt(sumLow)} to ${fmt(sumHigh)} percent`}
        >
          {ticks.map((t) => (
            <line
              key={t}
              className="row-gridline"
              x1={xScale(t)}
              x2={xScale(t)}
              y1={0}
              y2={ROW_HEIGHT}
            />
          ))}

          {positioned.map(({ key, seg, x0, x1 }, idx) => {
            const testId = `segment-${bucket.id}-${key}`;
            const isZero = seg.central <= 0;
            const isSelected = selected?.bucketId === bucket.id && selected?.segmentKey === key;
            const label = `${SEGMENT_LABEL[key]}, ${bucket.label}: ${fmt(seg.central)} percent, range ${fmt(seg.low)} to ${fmt(seg.high)} percent`;
            const segClassName = `segment segment-${key}${isZero ? ' segment-zero' : ''}${isSelected ? ' segment-selected' : ''}`;
            const rangeText = `${fmt(seg.central)}% (${fmt(seg.low)}–${fmt(seg.high)}%)`;

            const activate = (target: Element) => {
              onSelect(bucket, key);
              showTooltip(target, SEGMENT_LABEL[key], rangeText, seg.citation);
            };

            // Purely visual: fill colour + selected-state stroke. Never receives
            // pointer events (see .segment { pointer-events: none } in styles.css)
            // so it never contests the hit target below for clicks, and so a
            // single unambiguous element — the hit target — is both the visible
            // shape's larger tappable area and the sole accessible/testable control.
            const visualProps = {
              className: segClassName,
            } as Record<string, unknown>;

            // The actual interactive control: keyboard focus, accessible name,
            // data-testid, and all pointer/keyboard handlers live here. It renders
            // enlarged relative to the visible shape so thin (sub-3px) segments
            // stay comfortably tappable on mobile without changing the rendered
            // fill geometry, and — critically — it is the ONLY element carrying
            // the segment's data-testid, so both real users and the deterministic
            // journey harness click exactly one unambiguous target.
            const hitProps = {
              tabIndex: 0,
              role: 'button',
              'aria-label': label,
              'data-testid': testId,
              className: 'segment-hit',
              onClick: (e: MouseEvent) => activate(e.currentTarget as Element),
              onKeyDown: (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(bucket, key);
                }
              },
              onMouseEnter: (e: MouseEvent) =>
                showTooltip(e.currentTarget as Element, SEGMENT_LABEL[key], rangeText, seg.citation),
              onMouseLeave: hideTooltip,
              onFocus: (e: FocusEvent) =>
                showTooltip(e.currentTarget as Element, SEGMENT_LABEL[key], rangeText, seg.citation),
              onBlur: hideTooltip,
            } as Record<string, unknown>;

            if (isZero) {
              const cx = xScale(x0);
              const hitR = 7;
              return (
                <g className="segment-group" key={key}>
                  <circle cx={cx} cy={BAR_CENTER_Y} r={4.5} {...visualProps} />
                  <circle cx={cx} cy={BAR_CENTER_Y} r={hitR} {...hitProps} />
                </g>
              );
            }

            const x0s = xScale(x0);
            const x1s = xScale(x1);
            const visualWidth = screenWidths[idx];
            const prevWidth = idx > 0 ? screenWidths[idx - 1] : Infinity;
            const nextWidth = idx < screenWidths.length - 1 ? screenWidths[idx + 1] : Infinity;
            const leftPad = Math.min(HIT_PAD, prevWidth / 2, x0s);
            const rightPad = Math.min(HIT_PAD, nextWidth / 2, barWidth - x1s);
            const hitX0 = x0s - leftPad;
            const hitX1 = x1s + rightPad;

            return (
              <g className="segment-group" key={key}>
                <rect x={x0s} y={BAR_Y} width={visualWidth} height={BAR_HEIGHT} rx={2} {...visualProps} />
                <line
                  className="segment-affordance"
                  aria-hidden="true"
                  x1={x0s}
                  x2={x1s}
                  y1={BAR_Y + BAR_HEIGHT}
                  y2={BAR_Y + BAR_HEIGHT}
                />
                <rect
                  x={hitX0}
                  y={HIT_Y}
                  width={Math.max(hitX1 - hitX0, visualWidth)}
                  height={HIT_HEIGHT}
                  {...hitProps}
                />
              </g>
            );
          })}

          <g className="whisker" aria-hidden="true">
            <line
              className="whisker-line"
              x1={xScale(sumLow)}
              x2={xScale(sumHigh)}
              y1={WHISKER_Y}
              y2={WHISKER_Y}
            />
            <line
              className="whisker-cap"
              x1={xScale(sumLow)}
              x2={xScale(sumLow)}
              y1={WHISKER_Y - WHISKER_CAP_HALF}
              y2={WHISKER_Y + WHISKER_CAP_HALF}
            />
            <line
              className="whisker-cap"
              x1={xScale(sumHigh)}
              x2={xScale(sumHigh)}
              y1={WHISKER_Y - WHISKER_CAP_HALF}
              y2={WHISKER_Y + WHISKER_CAP_HALF}
            />
            <circle className="whisker-mark" cx={xScale(sumCentral)} cy={WHISKER_Y} r={2.5} />
          </g>
        </svg>
      </div>
    );

    return [labelCell, barCell];
  });

  return (
    <div className="chart">
      <div className="chart-grid">
        <div className="grid-cell label-cell axis-corner" aria-hidden="true" />
        <div className="grid-cell bar-cell axis-cell" ref={barCellRef}>
          <svg width={barWidth} height={AXIS_HEIGHT} className="axis-svg" aria-hidden="true">
            {ticks.map((t) => (
              <g key={t} transform={`translate(${xScale(t)}, 0)`}>
                <line className="axis-tick" x1={0} x2={0} y1={AXIS_HEIGHT - 6} y2={AXIS_HEIGHT} />
                <text className="axis-label" x={0} y={12} text-anchor="middle">
                  {t}%
                </text>
              </g>
            ))}
          </svg>
        </div>

        {rows}
      </div>

      {tooltip && (
        <div className="chart-tooltip" role="tooltip" style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}>
          <div className="tooltip-title">{tooltip.title}</div>
          <div className="tooltip-range">{tooltip.range}</div>
          <div className="tooltip-citation">{tooltip.citation}</div>
        </div>
      )}
    </div>
  );
}
