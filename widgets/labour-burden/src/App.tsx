import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Chart } from './Chart';
import rawDataset from './data/dataset.json';
import { Bucket, Dataset, SEGMENT_LABEL, SEGMENT_ORDER, SegmentKey } from './types';

const dataset = rawDataset as unknown as Dataset;

function computeDomainMax(buckets: Bucket[]): number {
  let maxHigh = 0;
  for (const b of buckets) {
    const total = SEGMENT_ORDER.reduce((sum, k) => sum + b.segments[k].high, 0);
    if (total > maxHigh) maxHigh = total;
  }
  return Math.max(20, Math.ceil(maxHigh / 10) * 10);
}

const DOMAIN_MAX = computeDomainMax(dataset.buckets);

function fmt(n: number): string {
  return Number.isInteger(n) ? `${n}` : n.toFixed(1);
}

// ── Display-only text formatting ─────────────────────────────────────────
// dataset.json is research output and must stay byte-identical. These
// helpers only reshape how that text is *rendered* — sentence-casing
// ALL-CAPS lead-in labels and splitting the methodology prose into
// paragraphs — without touching the underlying strings.

function sentenceCase(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

const LABEL_OVERRIDES: Record<string, string> = {
  'COMPARABILITY TRAP': 'Note on comparability',
};

interface LeadIn {
  lead: string;
  punct: string;
  rest: string;
}

// Scans leading whitespace-separated tokens and collects a run of ALL-CAPS
// words (a "label"), stopping at the first token that contains a lowercase
// letter or has no letters at all (e.g. a bare "—" dash).
function splitLeadIn(text: string): LeadIn | null {
  const tokenRe = /\S+/g;
  const leadTokens: string[] = [];
  let punct = '';
  let cutIndex = -1;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(text))) {
    const token = match[0];
    const core = token.replace(/[:.]$/, '');
    const hasLetter = /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(core);
    const hasLower = /[a-zà-öø-ÿ]/.test(core);
    if (hasLetter && !hasLower) {
      leadTokens.push(core);
      cutIndex = match.index + token.length;
      if (token.length > core.length) {
        punct = token.slice(-1);
        break;
      }
      continue;
    }
    break;
  }
  if (!leadTokens.length || cutIndex <= 0) return null;
  const lead = leadTokens.join(' ');
  // Guard against a lone short capital (e.g. the article "A" opening a normal
  // sentence) being mistaken for a shouty label — real labels are either
  // multi-word or explicitly punctuated (e.g. "THIN.").
  if (leadTokens.length === 1 && !punct && lead.length < 3) return null;
  const rest = text.slice(cutIndex).replace(/^\s+/, '');
  if (!rest) return null;
  return { lead, punct, rest };
}

function displayLabel(lead: string): string {
  return LABEL_OVERRIDES[lead.toUpperCase()] ?? sentenceCase(lead);
}

// Renders free text that may open with an ALL-CAPS label (e.g. "COMPARABILITY
// TRAP: ..." or "THIN. ...") as a bold sentence-case lead-in followed by the
// unchanged remainder. Falls back to the plain text when no such label is found.
function renderLeadIn(text: string) {
  const split = splitLeadIn(text);
  if (!split) return text;
  const label = displayLabel(split.lead);
  const suffix = split.punct === ':' || split.punct === '.' ? split.punct : '';
  return (
    <>
      <strong>
        {label}
        {suffix}
      </strong>{' '}
      {split.rest}
    </>
  );
}

// Finds "LABEL:" inline (not necessarily at the start of the string) and
// renders it as a bold sentence-case label, leaving the rest of the text as-is.
function renderInlineLabel(text: string, label: string, display: string) {
  const marker = `${label}:`;
  const idx = text.indexOf(marker);
  if (idx === -1) return text;
  const before = text.slice(0, idx);
  const after = text.slice(idx + marker.length);
  return (
    <>
      {before}
      <strong>{display}:</strong>
      {after}
    </>
  );
}

// Splits the methodology prose into paragraphs at each "(a)"–"(d)" marker for
// display, and sentence-cases the ALL-CAPS lead-in phrase within each part.
function renderMethodology(text: string) {
  const parts = text.split(/(?=\([a-d]\)\s)/);
  return parts.map((part, idx) => {
    const markerMatch = part.match(/^\(([a-d])\)\s*/);
    if (!markerMatch) {
      return (
        <p className="methodology-body" key="intro">
          {renderInlineLabel(part, 'CLASSIFICATION', 'Classification')}
        </p>
      );
    }
    const marker = markerMatch[1];
    const body = part.slice(markerMatch[0].length);
    const split = splitLeadIn(body);
    if (!split) {
      return (
        <p className="methodology-body" key={marker}>
          ({marker}) {body}
        </p>
      );
    }
    const label = displayLabel(split.lead);
    const suffix = split.punct === ':' || split.punct === '.' ? split.punct : '';
    return (
      <p className="methodology-body" key={marker}>
        <strong>
          ({marker}) {label}
          {suffix}
        </strong>{' '}
        {split.rest}
      </p>
    );
  });
}

type Selection =
  | { type: 'segment'; bucket: Bucket; segmentKey: SegmentKey }
  | { type: 'caveat'; bucket: Bucket };

export function App() {
  const [ready, setReady] = useState(false);
  const [modernOn, setModernOn] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const historicalBuckets = useMemo(() => dataset.buckets.filter((b) => !b.modern), []);
  const modernBucket = useMemo(() => dataset.buckets.find((b) => b.modern), []);
  const methodologyParagraphs = useMemo(() => renderMethodology(dataset.methodology), []);

  const handleReady = () => {
    setReady(true);
    document.documentElement.dataset.widgetState = 'ready';
  };

  const handleSelectSegment = (bucket: Bucket, segmentKey: SegmentKey) => {
    setSelection({ type: 'segment', bucket, segmentKey });
  };

  const handleCaveat = (bucket: Bucket) => {
    setSelection({ type: 'caveat', bucket });
  };

  const closeDetail = () => setSelection(null);

  // Report content height so a host page can auto-size the iframe to fit.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const send = () =>
      window.parent.postMessage({ type: 'resize', height: el.scrollHeight }, '*');
    const ro = new ResizeObserver(send);
    ro.observe(el);
    send();
    return () => ro.disconnect();
  }, []);

  // Close the detail card on Escape.
  useEffect(() => {
    if (!selection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDetail();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection]);

  useEffect(() => {
    if (selection && detailRef.current) {
      detailRef.current.focus();
      detailRef.current.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    }
  }, [selection]);

  const segmentSelectionKey =
    selection?.type === 'segment' ? { bucketId: selection.bucket.id, segmentKey: selection.segmentKey } : null;

  return (
    <div className="container" ref={rootRef}>
      <div className="card">
        <header className="card-header">
          <h1>The burden of the ordinary person</h1>
          <p className="intro">
            Direct tax, rent, and forced or unpaid labour service, expressed as an illustrative share of an
            ordinary person&rsquo;s output or income, compared across historical societies. Every figure is a
            contested, source-cited estimate — click any bar segment for the citation behind it.
          </p>
          <p className="methodology-note">
            Comparability across societies is itself contested: &ldquo;output&rdquo; meant different things in a
            subsistence agrarian economy than in a modern cash economy, and forced labour&rsquo;s opportunity cost
            is hard to monetise. These bars show orders of magnitude, not precise measurements — see{' '}
            <a href="#methodology">Methodology &amp; sources</a> below.
          </p>
        </header>

        <div className="controls">
          <label className="toggle-row">
            <input
              type="checkbox"
              data-testid="toggle-modern"
              checked={modernOn}
              onChange={(e) => setModernOn((e.target as HTMLInputElement).checked)}
            />
            <span className="toggle-text">Include a modern UK reference point</span>
          </label>
        </div>

        <div className="legend" aria-hidden="false">
          <div className="legend-item">
            <span className="legend-swatch legend-swatch-direct_tax" />
            <span>
              <strong>Direct tax</strong> — levy to a state or lord, incl. tithe
            </span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch legend-swatch-rent" />
            <span>
              <strong>Rent</strong> — payment to a landlord for land
            </span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch legend-swatch-corvee" />
            <span>
              <strong>Forced labour</strong> — corvée / week-work / robota, valued as a share of output
            </span>
          </div>
        </div>
        <p className="chart-caption">
          Bars use each segment&rsquo;s central estimate; the whisker marks the plausible low–high range for the
          total burden. Labour-rent (week-work, robota) is counted only under forced labour, never also under
          rent, to avoid double-counting.
        </p>

        <Chart
          buckets={historicalBuckets}
          domainMax={DOMAIN_MAX}
          selected={segmentSelectionKey}
          onSelect={handleSelectSegment}
          onCaveat={handleCaveat}
          onReady={handleReady}
        />

        {modernOn && modernBucket && (
          <div className="modern-section">
            <h2 className="modern-heading">Modern reference point</h2>
            <p className="modern-caveat" data-testid="modern-caveat">
              {renderLeadIn(modernBucket.caveat)}
            </p>
            <Chart
              buckets={[modernBucket]}
              domainMax={DOMAIN_MAX}
              selected={segmentSelectionKey}
              onSelect={handleSelectSegment}
              onCaveat={handleCaveat}
            />
          </div>
        )}

        {selection && (
          <div
            className="detail-card"
            data-testid="segment-detail"
            role="dialog"
            aria-label="Sourcing detail"
            tabIndex={-1}
            ref={detailRef}
          >
            <button type="button" className="detail-close" onClick={closeDetail} aria-label="Close detail">
              ×
            </button>

            {selection.type === 'segment' ? (
              <>
                <div className="detail-heading">
                  {selection.bucket.label} <span className="detail-era">({selection.bucket.era})</span>
                </div>
                <div className="detail-segment">
                  <span
                    className="detail-segment-swatch"
                    style={{ background: `var(--${selection.segmentKey})` }}
                  />
                  {SEGMENT_LABEL[selection.segmentKey]}
                </div>
                <div className="detail-values">
                  Low {fmt(selection.bucket.segments[selection.segmentKey].low)}% · Central{' '}
                  {fmt(selection.bucket.segments[selection.segmentKey].central)}% · High{' '}
                  {fmt(selection.bucket.segments[selection.segmentKey].high)}%
                </div>
                <p className="detail-citation">
                  <strong>Source:</strong> {selection.bucket.segments[selection.segmentKey].citation}
                </p>
                <p className="detail-note">{renderLeadIn(selection.bucket.segments[selection.segmentKey].note)}</p>
                <p className="detail-caveat">
                  <strong>Why this figure is contested:</strong> {renderLeadIn(selection.bucket.caveat)}
                </p>
              </>
            ) : (
              <>
                <div className="detail-heading">
                  {selection.bucket.label} <span className="detail-era">({selection.bucket.era})</span>
                </div>
                <p className="detail-caveat">
                  <strong>Why this figure is contested:</strong> {renderLeadIn(selection.bucket.caveat)}
                </p>
              </>
            )}
          </div>
        )}

        <div className="methodology-section" id="methodology">
          <button
            type="button"
            className="methodology-toggle"
            data-testid="methodology-toggle"
            aria-expanded={methodologyOpen}
            onClick={() => setMethodologyOpen((v) => !v)}
          >
            Methodology &amp; sources {methodologyOpen ? '▾' : '▸'}
          </button>
          <div className="methodology-panel" data-testid="methodology-panel" hidden={!methodologyOpen}>
            {methodologyParagraphs}
            <h3 className="sources-heading">Sources</h3>
            <ul className="sources-list">
              {dataset.sources.map((s) => (
                <li key={s.key}>
                  <div className="source-full">{s.full}</div>
                  <div className="source-claim">Cited for: {s.claim}</div>
                  <div className="source-caveat">Caveat: {s.caveat}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {ready && <div id="widget-ready" data-ready="true" hidden />}
    </div>
  );
}
