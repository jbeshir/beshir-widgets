import { useState, useRef, useEffect } from 'preact/hooks';

interface Props {
  tracks: string[];
  trackFilter: string[];
  onTrackFilter: (tracks: string[]) => void;
  locations: string[];
  locationFilter: string;
  onLocationFilter: (loc: string) => void;
  textFilter: string;
  onTextFilter: (t: string) => void;
  resultCount: number;
  trackColors: Record<string, { l: string; d: string }>;
}

export function Filters({
  tracks,
  trackFilter,
  onTrackFilter,
  locations,
  locationFilter,
  onLocationFilter,
  textFilter,
  onTextFilter,
  resultCount,
  trackColors,
}: Props) {
  const [trackSearch, setTrackSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filteredTracks = tracks.filter(
    (t) =>
      !trackFilter.includes(t) &&
      t.toLowerCase().includes(trackSearch.toLowerCase())
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  function addTrack(t: string) {
    onTrackFilter([...trackFilter, t]);
    setTrackSearch('');
    searchRef.current?.focus();
  }

  function removeTrack(t: string) {
    onTrackFilter(trackFilter.filter((x) => x !== t));
  }

  const sessionWord = resultCount === 1 ? 'session' : 'sessions';

  return (
    <div class="filters">
      {/* Track filter */}
      <div class="filter-row">
        <span class="filter-label">Track</span>
        <div class="track-chips">
          {trackFilter.map((t) => {
            const color = trackColors[t] ?? { l: 'hsl(220,55%,37%)', d: 'hsl(220,51%,49%)' };
            return (
              <span
                key={t}
                class="track-chip"
                style={{ '--tc-l': color.l, '--tc-d': color.d } as Record<string, unknown>}
              >
                {t}
                <button
                  class="track-chip-remove"
                  onClick={() => removeTrack(t)}
                  aria-label={`Remove track filter: ${t}`}
                >
                  ×
                </button>
              </span>
            );
          })}
          <div class="track-dropdown-wrap" ref={dropdownRef}>
            <input
              ref={searchRef}
              class="filter-input"
              type="text"
              placeholder="Add track…"
              value={trackSearch}
              onInput={(e) => {
                setTrackSearch((e.target as HTMLInputElement).value);
                setDropdownOpen(true);
              }}
              onFocus={() => setDropdownOpen(true)}
              aria-label="Search tracks to filter"
              style={{ minWidth: '140px', maxWidth: '200px' }}
            />
            {dropdownOpen && filteredTracks.length > 0 && (
              <div class="track-dropdown">
                {filteredTracks.map((t) => {
                  const color = trackColors[t] ?? { l: 'hsl(220,55%,37%)', d: 'hsl(220,51%,49%)' };
                  return (
                    <div
                      key={t}
                      class="track-dropdown-item"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addTrack(t);
                        setDropdownOpen(false);
                      }}
                    >
                      <span
                        class="track-dot"
                        style={{ '--tc-l': color.l, '--tc-d': color.d } as Record<string, unknown>}
                      />
                      {t}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {trackFilter.length > 0 && (
            <button
              class="filter-clear-btn"
              onClick={() => onTrackFilter([])}
              aria-label="Clear all track filters"
            >
              Clear
            </button>
          )}
        </div>
        <span class="filter-result-count">{resultCount} {sessionWord}</span>
      </div>

      {/* Location + text filters */}
      <div class="filter-row">
        <span class="filter-label">Location</span>
        <select
          class="filter-select"
          value={locationFilter}
          onChange={(e) => onLocationFilter((e.target as HTMLSelectElement).value)}
          aria-label="Filter by location"
        >
          <option value="">All locations</option>
          {locations.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <span class="filter-label" style={{ marginLeft: '8px' }}>Search</span>
        <input
          class="filter-input"
          type="text"
          placeholder="Title, instructor…"
          value={textFilter}
          onInput={(e) => onTextFilter((e.target as HTMLInputElement).value)}
          aria-label="Search sessions by title, instructor, or description"
        />
        {(locationFilter || textFilter) && (
          <button
            class="filter-clear-btn"
            onClick={() => { onLocationFilter(''); onTextFilter(''); }}
            aria-label="Clear location and text filters"
          >
            Clear
          </button>
        )}
      </div>

      {/* Collapsible track color legend */}
      <details class="track-legend-details">
        <summary class="track-legend-summary">
          Track color key <span class="track-legend-count">({tracks.length})</span>
        </summary>
        <div class="track-legend-grid">
          {tracks.map((t) => {
            const color = trackColors[t] ?? { l: 'hsl(220,55%,37%)', d: 'hsl(220,51%,49%)' };
            const filterByTrack = () => {
              if (!trackFilter.includes(t)) addTrack(t);
            };
            return (
              <span
                key={t}
                class="legend-chip"
                role="button"
                tabIndex={0}
                style={{ '--tc-l': color.l, '--tc-d': color.d } as Record<string, unknown>}
                onClick={filterByTrack}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    filterByTrack();
                  }
                }}
                aria-label={`Filter by ${t}`}
                title={`Filter by ${t}`}
              >
                <span class="legend-swatch" />
                {t}
              </span>
            );
          })}
        </div>
      </details>
    </div>
  );
}
