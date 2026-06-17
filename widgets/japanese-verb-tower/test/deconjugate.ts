// Round-trip gate for deconjugation — exits non-zero on any failure.
// Corpus is built from the golden data itself (self-contained, covers 高い).

import { makeVerb, buildTower } from '../src/engine';
import type { DictEntry, OpId } from '../src/engine';
import { buildCorpus, deconjugate } from '../src/deconjugate';
import goldenJson from './golden.json' assert { type: 'json' };

const KANA_MAP: Record<string, string> = {
  '飲む':   'のむ',
  '食べる': 'たべる',
  '書く':   'かく',
  'する':   'する',
  '来る':   'くる',
  '高い':   'たかい',
  '見る':   'みる',
  '勉強する': 'べんきょうする',
  '行く':   'いく',
};

// Build corpus from golden data (guarantees 高い is present)
const goldenCases = goldenJson as Array<{ verb: string; class: string; ops: string[]; expectedKana: string; expectedRomaji: string }>;

const entriesMap = new Map<string, DictEntry>();
for (const c of goldenCases) {
  const key = c.verb + '\0' + c.class;
  if (!entriesMap.has(key)) {
    const r = KANA_MAP[c.verb];
    if (!r) { console.error(`NO KANA_MAP for ${c.verb}`); process.exit(1); }
    entriesMap.set(key, { k: c.verb, r, romaji: '', cls: c.class, common: true, gloss: '' });
  }
}
const corpus = buildCorpus(Array.from(entriesMap.values()));

const fails: string[] = [];
let pass = 0;

for (const c of goldenCases) {
  const r = KANA_MAP[c.verb];
  if (!r) { fails.push(`NO KANA_MAP for ${c.verb}`); continue; }
  const entry: DictEntry = { k: c.verb, r, romaji: '', cls: c.class, common: true, gloss: '' };
  const verb = makeVerb(entry);
  const ops = c.ops as OpId[];

  let surface: string;
  try {
    const tiers = buildTower(verb, ops);
    surface = tiers[tiers.length - 1].kana;
  } catch (err) {
    fails.push(`buildTower failed for ${c.verb} [${ops.join(',')}]: ${err}`);
    continue;
  }

  const parses = deconjugate(surface, corpus);

  // (a) at least one parse forward-generates surface
  const anyForward = parses.some(p => p.kana === surface);
  if (!anyForward) {
    fails.push(`SURFACE NOT REPRODUCED: ${c.verb} [${ops.join(',')}] surface="${surface}" — parses: [${parses.map(p => `${p.base.k}/${p.base.r}[${p.ops.join(',')}]`).join('|')}]`);
    continue;
  }

  // (b) canonical parse present: base.k===verb && base.r===KANA_MAP[verb] && ops match
  const opsStr = ops.join(',');
  const canonical = parses.find(
    p => p.base.k === c.verb && p.base.r === r && p.ops.join(',') === opsStr
  );
  if (!canonical) {
    fails.push(`CANONICAL MISSING: ${c.verb} [${ops.join(',')}] surface="${surface}" — parses: [${parses.map(p => `${p.base.k}/${p.base.r}[${p.ops.join(',')}]`).join('|')}]`);
    continue;
  }

  pass++;
}

console.log(`round-trip: ${pass}/${goldenCases.length} pass, ${fails.length} fail`);
for (const f of fails) console.error('  ✗ ' + f);

// ── Ambiguity assertions ─────────────────────────────────────────────────────

// 食べられる → both [passive] and [potential] present
const ambiParses = deconjugate('たべられる', corpus);
const hasPassive = ambiParses.some(p => p.base.k === '食べる' && p.ops.join(',') === 'passive');
const hasPotential = ambiParses.some(p => p.base.k === '食べる' && p.ops.join(',') === 'potential');
if (!hasPassive || !hasPotential) {
  fails.push(`AMBIGUITY: たべられる should have both passive and potential; got [${ambiParses.map(p => `${p.base.k}[${p.ops.join(',')}]`).join('|')}]`);
  console.error('  ✗ ambiguity: たべられる missing passive or potential');
} else {
  console.log('ambiguity assert (たべられる passive+potential): OK');
}

// xyzzy → []
const noParses = deconjugate('xyzzy', corpus);
if (noParses.length !== 0) {
  fails.push(`NO-PARSE: expected [] for "xyzzy", got ${noParses.length} parses`);
  console.error('  ✗ no-parse: "xyzzy" returned non-empty');
} else {
  console.log('no-parse assert (xyzzy → []): OK');
}

if (fails.length) {
  console.error(`\nFAILED: ${fails.length} issue(s)`);
  process.exit(1);
}

console.log('ALL DECONJUGATION CASES PASS');
