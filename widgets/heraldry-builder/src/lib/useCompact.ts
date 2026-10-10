// Preact hooks over media queries: `useMedia` follows any query; `useCompact` is true on phone-width
// screens, where the builder collapses its steps and charge list.

import { useEffect, useState } from 'preact/hooks';

const COMPACT_QUERY = '(max-width: 599px)';

export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
}

export function useCompact(): boolean {
  return useMedia(COMPACT_QUERY);
}
