// Registry tab (PLAN §6/§7): search + filters + chips + result cards + entry sheet, with loading /
// populated / empty / error states reported through `onStatus` (App turns that into
// data-widget-state). Routes #/a/<id> and #/a/<id>/<secret> replace the browser with the public
// entry page and the owner view.

import { useEffect, useRef, useState } from 'preact/hooks';
import { SHIELD_PATH, SHIELD_VIEWBOX, TINCTURE_FILL, type NormDesign, type Tincture } from '../../lib/heraldry';
import { registryParam, type Route } from '../../lib/route';
import type { ListStatus } from '../../lib/widgetState';
import * as store from '../../store';
import { Shield } from '../Shield';
import { EntryPage } from './EntryPage';
import { EntrySheet } from './EntryDetail';
import { OwnerView } from './OwnerView';
import {
  EMPTY_FILTERS, FILTER_SPECS, PRIMARY_FILTERS, activeFilters, chipLabel, isTinctureFilter, toSearchParams, type FilterKey, type Filters,
} from './filters';

interface Props {
  route: Route;
  onStatus: (s: ListStatus) => void;
  hatching: boolean;
  onLoadDesign: (design: NormDesign) => void;
  onDeviceChange: () => void;
}

export function RegistryPanel(p: Props) {
  if (p.route.mode === 'owner') return <OwnerView id={p.route.id} secret={p.route.secret} onStatus={p.onStatus} hatching={p.hatching} onDeviceChange={p.onDeviceChange} />;
  if (p.route.mode === 'entry') return <EntryPage id={p.route.id} onStatus={p.onStatus} hatching={p.hatching} onLoad={p.onLoadDesign} />;
  return <RegistryBrowser {...p} />;
}

const Q_DEBOUNCE_MS = 250;

function RegistryBrowser({ onStatus, hatching, onLoadDesign }: Props) {
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [attempt, setAttempt] = useState(0);
  const [sampleMode, setSampleMode] = useState(false);
  const [moreFilters, setMoreFilters] = useState(false);

  const [status, setStatus] = useState<ListStatus>('loading');
  const [items, setItems] = useState<store.ArmsSummary[]>([]);
  const [meta, setMeta] = useState<{ registry: store.RegistryRef | null; total: number; sample: boolean }>({ registry: null, total: 0, sample: false });
  const [error, setError] = useState('');
  const [moreBusy, setMoreBusy] = useState(false);
  const [moreError, setMoreError] = useState('');
  const [open, setOpen] = useState<store.ArmsSummary | null>(null);
  const seq = useRef(0);

  // Debounce the free-text query.
  useEffect(() => {
    if (q === qInput) return;
    const t = setTimeout(() => setQ(qInput), Q_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [qInput]);

  // (Re)load the first page whenever the query, a filter, or a refresh/retry changes.
  useEffect(() => {
    const mine = ++seq.current;
    setStatus('loading');
    setMoreError('');
    store.search(toSearchParams(registryParam(), q, filters), { sample: sampleMode }).then((r) => {
      if (mine !== seq.current) return;
      if (r.ok) {
        setItems(r.page.items);
        setMeta({ registry: r.page.registry, total: r.page.total, sample: r.page.sample });
        setStatus(r.page.items.length ? 'populated' : 'empty');
      } else {
        setError(r.message);
        setStatus('error');
      }
    });
  }, [q, filters, attempt, sampleMode]);

  useEffect(() => onStatus(status), [status]);

  const showMore = async () => {
    const mine = seq.current;
    setMoreBusy(true);
    setMoreError('');
    const r = await store.search(toSearchParams(registryParam(), q, filters, items.length), { sample: meta.sample });
    if (mine !== seq.current) return;
    setMoreBusy(false);
    if (r.ok) {
      setItems((cur) => {
        const seen = new Set(cur.map((i) => i.id));
        return [...cur, ...r.page.items.filter((i) => !seen.has(i.id))];
      });
      setMeta((m) => ({ ...m, total: r.page.total }));
    } else {
      setMoreError(r.message);
    }
  };

  const setFilter = (k: FilterKey, v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const active = activeFilters(filters);
  const extraActive = active.filter((k) => !PRIMARY_FILTERS.includes(k)).length;
  const hasQuery = q !== '' || qInput !== '';
  const anyNarrowing = active.length > 0 || hasQuery;
  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setQInput('');
    setQ('');
  };
  const refresh = () => {
    setSampleMode(false);
    setAttempt((n) => n + 1);
  };

  const head = (
    <div class="registry-head">
      <h2 class="registry-title" data-testid="registry-name">{meta.registry?.name ?? 'Registry'}</h2>
      {status !== 'error' && status !== 'loading' && (
        <span class="registry-count" data-testid="registry-count">
          {meta.total} {anyNarrowing ? (meta.total === 1 ? 'matching arms' : 'matching arms') : meta.total === 1 ? 'entry' : 'entries'}
        </span>
      )}
      {meta.sample && status !== 'error' && <span class="badge" data-testid="offline-badge">Offline sample</span>}
      {status === 'error' && <span class="badge badge-error" data-testid="error-badge">Couldn't load</span>}
      <button type="button" class="button-secondary registry-refresh" data-testid="registry-refresh" onClick={refresh}>Refresh</button>
    </div>
  );

  return (
    <div class="registry" data-status={status}>
      {head}

      <div class="registry-filters">
        <div class="filter-search">
          <label class="field-label" for="registry-search">Search by name or blazon</label>
          <input
            id="registry-search"
            class="text-input"
            type="search"
            data-testid="registry-search"
            placeholder="e.g. wolf, bordure, Azure"
            value={qInput}
            maxLength={60}
            autoComplete="off"
            onInput={(e) => setQInput((e.currentTarget as HTMLInputElement).value)}
          />
        </div>
        <button
          type="button"
          class="button-secondary more-filters"
          data-testid="more-filters"
          aria-expanded={moreFilters ? 'true' : 'false'}
          aria-controls="filter-grid"
          onClick={() => setMoreFilters((v) => !v)}
        >
          {moreFilters ? 'Fewer filters' : `More filters${extraActive ? ` (${extraActive} active)` : ''}`}
        </button>
        <div class="filter-grid" id="filter-grid" data-open={moreFilters ? 'true' : 'false'}>
          {FILTER_SPECS.map((s) => {
            const id = `f-${s.key}`;
            const groups = Array.from(new Set(s.options.map((o) => o.group)));
            return (
              <div class={`filter${PRIMARY_FILTERS.includes(s.key) ? '' : ' filter-extra'}`} key={s.key}>
                <label class="filter-label" for={id}>
                  {s.label}
                  {isTinctureFilter(s.key) && filters[s.key] && (
                    <span class="filter-dot" aria-hidden="true" style={{ background: TINCTURE_FILL[filters[s.key] as Tincture] }} />
                  )}
                </label>
                <select
                  id={id}
                  class="select"
                  data-testid={s.testid}
                  value={filters[s.key]}
                  onChange={(e) => setFilter(s.key, (e.currentTarget as HTMLSelectElement).value)}
                >
                  <option value="">{s.any}</option>
                  {groups[0] === undefined
                    ? s.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)
                    : groups.map((g) => (
                        <optgroup key={g} label={g}>
                          {s.options.filter((o) => o.group === g).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </optgroup>
                      ))}
                </select>
              </div>
            );
          })}
        </div>
        {(active.length > 0 || hasQuery) && (
          <div class="filter-active">
            {active.length > 0 && (
              <ul class="chips" aria-label="Active filters" data-testid="filter-chips">
                {active.map((k) => {
                  const spec = FILTER_SPECS.find((s) => s.key === k)!;
                  const label = chipLabel(spec, filters[k]);
                  return (
                    <li class="chip" key={k} data-testid={`filter-chip-${spec.testid.replace('filter-', '')}`}>
                      <span>{label}</span>
                      <button type="button" class="chip-remove" aria-label={`Remove filter ${label}`} data-testid={`chip-remove-${spec.testid.replace('filter-', '')}`} onClick={() => setFilter(k, '')}>
                        <span aria-hidden="true">×</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {status !== 'empty' && <button type="button" class="button-tertiary" data-testid="clear-filters" onClick={clearAll}>Clear filters</button>}
          </div>
        )}
      </div>

      {status === 'loading' && (
        <div class="registry-loading" data-testid="registry-loading" aria-busy="true">
          <p class="loading-note" role="status">Loading the registry…</p>
          <ul class="card-grid" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <li key={i} class="arms-card skeleton-card">
                <svg class="skeleton-shield" viewBox={SHIELD_VIEWBOX} width="72" height="86.4" focusable="false"><path d={SHIELD_PATH} /></svg>
                <span class="skeleton skeleton-line" />
                <span class="skeleton skeleton-line skeleton-short" />
                <span class="skeleton skeleton-line skeleton-short" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {status === 'error' && (
        <div class="panel-message panel-error" data-testid="registry-error" role="alert">
          <p class="error-title">
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false"><path d="M10 2L19 18H1Z" fill="currentColor" /><path d="M10 8v4.5M10 14.6v.4" stroke="var(--error-bg)" stroke-width="2" stroke-linecap="round" /></svg>
            <strong>Couldn't load the registry</strong>
          </p>
          <p>{error}</p>
          <p class="error-help">"Show offline sample" browses the example arms bundled with this page instead.</p>
          <div class="action-row action-row-inline">
            <button type="button" class="button-primary" data-testid="registry-retry" onClick={() => setAttempt((n) => n + 1)}>Retry</button>
            <button type="button" class="button-secondary" data-testid="registry-show-sample" onClick={() => setSampleMode(true)}>Show offline sample</button>
          </div>
        </div>
      )}

      {status === 'empty' && (
        <div class="panel-message" data-testid="registry-empty" role="status">
          <p>
            <strong>{active.length + (hasQuery ? 1 : 0) > 1 ? `No arms match ${[...active.map((k) => chipLabel(FILTER_SPECS.find((s) => s.key === k)!, filters[k])), ...(hasQuery ? [`search “${q || qInput}”`] : [])].join(' + ')}.` : 'No arms match these components.'}</strong>{' '}
            Try removing one of them, or search for a different word.
          </p>
          {anyNarrowing && <button type="button" class="button-secondary" data-testid="empty-clear-filters" onClick={clearAll}>Clear filters</button>}
        </div>
      )}

      {status === 'populated' && (
        <>
          <ul class="card-grid" data-testid="registry-results">
            {items.map((a) => (
              <li key={a.id}>
                <button type="button" class="arms-card arms-card-link" data-testid="result-card" data-id={a.id} onClick={() => setOpen(a)}>
                  <Shield design={a.design} size={72} hatching={hatching} label={null} />
                  <span class="arms-card-name">{a.displayName}</span>
                  <span class="arms-card-blazon">{a.blazon}</span>
                </button>
              </li>
            ))}
          </ul>
          <div class="more-row">
            <p class="muted" data-testid="registry-showing">Showing {items.length} of {meta.total}</p>
            {items.length < meta.total && (
              <button type="button" class="button-secondary" data-testid="registry-more" disabled={moreBusy} onClick={showMore}>
                {moreBusy ? 'Loading…' : 'Show more'}
              </button>
            )}
            {moreError && <p class="form-error" role="alert">{moreError}</p>}
          </div>
        </>
      )}

      {open && <EntrySheet entry={open} sample={meta.sample} hatching={hatching} onLoad={onLoadDesign} onClose={() => setOpen(null)} />}
    </div>
  );
}
