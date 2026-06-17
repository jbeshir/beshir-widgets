// Unit tests for src/urlstate.ts — run with: npx tsx test/urlstate.ts
// Exits non-zero on any failure.

import { makeVerb, kanaToRomaji } from '../src/engine';
import type { DictEntry, OpId } from '../src/engine';
import { serializeState, parseState } from '../src/urlstate';

let pass = 0;
const fails: string[] = [];

function check(cond: boolean, label: string) {
  if (!cond) fails.push(label);
}

// ── Round-trip cases ──────────────────────────────────────────────────────────

interface RoundTripCase {
  label: string;
  k: string;
  r: string;
  c: string;
  ops: OpId[];
}

const roundTripCases: RoundTripCase[] = [
  {
    label: 'default 食べる stack',
    k: '食べる', r: 'たべる', c: 'ichidan',
    ops: ['tai', 'negative', 'naru', 'te-kuru', 'past'],
  },
  {
    label: '飲む 5-op stack',
    k: '飲む', r: 'のむ', c: 'godan-m',
    ops: ['causative', 'passive', 'polite', 'negative', 'past'],
  },
  {
    label: 'URL-only verb 走る (absent from dict)',
    k: '走る', r: 'はしる', c: 'godan-r',
    ops: ['past'],
  },
  {
    label: 'suru-noun 勉強する',
    k: '勉強する', r: 'べんきょうする', c: 'suru-noun',
    ops: ['polite', 'negative'],
  },
  {
    label: 'i-adjective 高い past',
    k: '高い', r: 'たかい', c: 'i-adjective',
    ops: ['past'],
  },
  {
    label: 'kuru causative-passive',
    k: '来る', r: 'くる', c: 'kuru',
    ops: ['causative-passive'],
  },
  {
    label: 'empty op stack',
    k: '食べる', r: 'たべる', c: 'ichidan',
    ops: [],
  },
];

for (const tc of roundTripCases) {
  const entry: DictEntry = {
    k: tc.k, r: tc.r,
    romaji: kanaToRomaji(tc.r),
    cls: tc.c, common: true, gloss: 'test',
  };
  const verb = makeVerb(entry);
  const serialized = serializeState(verb, tc.ops);
  const parsed = parseState(serialized);

  if (!parsed) {
    fails.push(`[round-trip] ${tc.label}: parseState returned null for "${serialized}"`);
    continue;
  }

  let ok = true;
  if (parsed.verb.kanji !== tc.k) {
    fails.push(`[round-trip] ${tc.label}: kanji got "${parsed.verb.kanji}" want "${tc.k}"`);
    ok = false;
  }
  if (parsed.verb.kana !== tc.r) {
    fails.push(`[round-trip] ${tc.label}: kana got "${parsed.verb.kana}" want "${tc.r}"`);
    ok = false;
  }
  if (parsed.verb.rawClass !== tc.c) {
    fails.push(`[round-trip] ${tc.label}: rawClass got "${parsed.verb.rawClass}" want "${tc.c}"`);
    ok = false;
  }
  if (JSON.stringify(parsed.ops) !== JSON.stringify(tc.ops)) {
    fails.push(`[round-trip] ${tc.label}: ops got ${JSON.stringify(parsed.ops)} want ${JSON.stringify(tc.ops)}`);
    ok = false;
  }
  if (ok) pass++;
}

// ── Negative cases (must return null) ─────────────────────────────────────────

const negCases: Array<{ label: string; input: string }> = [
  {
    label: 'missing k',
    input: new URLSearchParams({ r: 'たべる', c: 'ichidan' }).toString(),
  },
  {
    label: 'missing r',
    input: new URLSearchParams({ k: '食べる', c: 'ichidan' }).toString(),
  },
  {
    label: 'missing c',
    input: new URLSearchParams({ k: '食べる', r: 'たべる' }).toString(),
  },
  {
    label: 'unknown class godan-z',
    input: new URLSearchParams({ k: '食べる', r: 'たべる', c: 'godan-z' }).toString(),
  },
  {
    label: 'bad op id frobnicate',
    input: new URLSearchParams({ k: '食べる', r: 'たべる', c: 'ichidan', o: 'frobnicate' }).toString(),
  },
  {
    label: 'unreachable sequence past,causative',
    input: new URLSearchParams({ k: '食べる', r: 'たべる', c: 'ichidan', o: 'past,causative' }).toString(),
  },
  {
    label: 'empty string',
    input: '',
  },
];

for (const tc of negCases) {
  const result = parseState(tc.input);
  if (result !== null) {
    fails.push(`[negative] "${tc.label}": expected null, got ${JSON.stringify(result)}`);
  } else {
    pass++;
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

const total = roundTripCases.length + negCases.length;
console.log(`\nurlstate: ${pass}/${total} passing`);

if (fails.length > 0) {
  console.error(`${fails.length} failing:`);
  for (const f of fails) console.error('  ✕', f);
  process.exit(1);
} else {
  console.log('All urlstate tests passed ✓');
}
