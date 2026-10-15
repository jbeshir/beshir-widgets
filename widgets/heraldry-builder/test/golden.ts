// What the render and slot goldens share: the short hash each entry is reduced to, how a golden differs from what is drawn now,
// and the report of that difference (the test's failure message, and what `npm run golden:write` prints).

/** FNV-1a, 32 bits, as 8 hex digits. */
export function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

export type Golden = Readonly<Record<string, string>>;

/** The keys whose value differs between a golden and now: changed, gone (in the golden only) and added (now only). */
export interface GoldenDiff { changed: string[]; gone: string[]; added: string[] }

export function goldenDiff(golden: Golden, now: Golden): GoldenDiff {
  return {
    changed: Object.keys(now).filter((k) => k in golden && golden[k] !== now[k]),
    gone: Object.keys(golden).filter((k) => !(k in now)),
    added: Object.keys(now).filter((k) => !(k in golden)),
  };
}

export const sameAsGolden = (diff: GoldenDiff): boolean => diff.changed.length + diff.gone.length + diff.added.length === 0;

/** How many entries of each kind (the key up to its first "-" or "|") a list of keys has: "level0 12, case 3". */
function byKind(keys: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const k of keys) counts.set(k.split(/[-|]/)[0], (counts.get(k.split(/[-|]/)[0]) ?? 0) + 1);
  return [...counts].map(([kind, n]) => `${kind} ${n}`).join(', ');
}

/** The difference in words: counts by kind, then the first few keys of each list with what `describe` says of them. */
export function goldenReport(diff: GoldenDiff, describe: (key: string) => string, shown = 8): string {
  const part = (title: string, keys: readonly string[]) => (keys.length === 0 ? [] : [
    `${keys.length} ${title} (${byKind(keys)}):`,
    ...keys.slice(0, shown).map((k) => `  ${k}: ${describe(k)}`),
    ...(keys.length > shown ? [`  … and ${keys.length - shown} more`] : []),
  ]);
  return [...part('changed', diff.changed), ...part('in the golden only', diff.gone), ...part('new', diff.added)].join('\n');
}

/**
 * The writers' gate: a golden is rewritten only with a reason (GOLDEN_REASON="…"), and the difference is printed so the commit can
 * say what changed and why.
 */
export function approveRewrite(name: string, diff: GoldenDiff, describe: (key: string) => string): void {
  const report = sameAsGolden(diff) ? 'no change' : goldenReport(diff, describe, 20);
  console.log(`${name}:\n${report}`);
  if (!sameAsGolden(diff) && !process.env.GOLDEN_REASON) {
    throw new Error(`${name} would change; rerun with GOLDEN_REASON="<why>" if the change is intended.\n${report}`);
  }
  if (process.env.GOLDEN_REASON) console.log(`reason: ${process.env.GOLDEN_REASON}`);
}
