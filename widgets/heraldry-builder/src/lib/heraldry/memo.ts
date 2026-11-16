// One memo for the library's caches of what it draws, keyed by text and emptied when it holds `max` entries, so that a long builder
// session or the Worker's isolate can't grow one without end. Every result is a pure function of its key: emptying costs time only.

/** A memoised `make`, by key, holding at most `max` results. */
export function boundedMemo<V>(max: number): (key: string, make: () => V) => V {
  const cache = new Map<string, V>();
  return (key, make) => {
    let value = cache.get(key);
    if (value === undefined) {
      if (cache.size >= max) cache.clear();
      value = make();
      cache.set(key, value);
    }
    return value;
  };
}
