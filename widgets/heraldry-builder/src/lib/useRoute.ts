// Preact hook over route.ts: the current hash route, updated on hashchange.

import { useEffect, useState } from 'preact/hooks';
import { parseHash, type Route } from './route';

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
