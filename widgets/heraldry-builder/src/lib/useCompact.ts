// Preact hook: true on phone-width screens, where the builder collapses its steps and charge list.

import { useEffect, useState } from 'preact/hooks';

const COMPACT_QUERY = '(max-width: 599px)';

export function useCompact(): boolean {
  const [compact, setCompact] = useState(() => window.matchMedia(COMPACT_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(COMPACT_QUERY);
    const on = () => setCompact(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return compact;
}
