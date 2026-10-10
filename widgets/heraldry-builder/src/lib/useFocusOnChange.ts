// Preact hook: move focus to the element carrying the returned ref each time `key` changes to a
// non-null value, so keyboard and screen-reader users land on a screen's heading or on the result
// that replaced the control they used. The element needs tabIndex={-1}.

import { useEffect, useRef } from 'preact/hooks';

export function useFocusOnChange<T extends HTMLElement>(key: string | null) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (key !== null) ref.current?.focus({ preventScroll: true });
  }, [key]);
  return ref;
}
