// Deep-chain round-trip gate for deconjugation — exits non-zero on any failure.
// Corpus is built from the real shipped data (verbs.sample.json + adjectives.sample.json).

import { makeVerb, buildTower } from '../src/engine';
import type { DictEntry, OpId } from '../src/engine';
import { buildCorpus, deconjugate } from '../src/deconjugate';
import type { Parse } from '../src/deconjugate';
import verbsJson from '../src/data/verbs.sample.json' assert { type: 'json' };
import adjectivesJson from '../src/data/adjectives.sample.json' assert { type: 'json' };

// Build corpus from both data files, deduped by k+r+cls
const allEntries = [...(verbsJson as DictEntry[]), ...(adjectivesJson as DictEntry[])];
const entriesMap = new Map<string, DictEntry>();
for (const e of allEntries) {
  const key = e.k + '\0' + e.r + '\0' + e.cls;
  if (!entriesMap.has(key)) entriesMap.set(key, e);
}
const corpus = buildCorpus(Array.from(entriesMap.values()));

interface BatteryCase {
  base: { k: string; r: string; cls: string };
  ops: OpId[];
}

// Required battery — all 10 cases must pass
const battery: BatteryCase[] = [
  // 1
  { base: { k: '見る',  r: 'みる',   cls: 'ichidan'     }, ops: ['tai','negative','naru','te-kuru','past'] },
  // 2
  { base: { k: '飲む',  r: 'のむ',   cls: 'godan-m'     }, ops: ['yasui','naru','polite','past'] },
  // 3 — causative-passive single-op variant may rank above canonical; still require canonical present & index<=3
  { base: { k: '食べる', r: 'たべる', cls: 'ichidan'     }, ops: ['causative','passive','tai','negative-past'] },
  // 4
  { base: { k: '飲む',  r: 'のむ',   cls: 'godan-m'     }, ops: ['naosu','negative-past'] },
  // 5 — deep (7 ops)
  { base: { k: '食べる', r: 'たべる', cls: 'ichidan'     }, ops: ['causative','passive','tai','negative','naru','te-kuru','past'] },
  // 6
  { base: { k: '飲む',  r: 'のむ',   cls: 'godan-m'     }, ops: ['causative','passive','negative-past'] },
  // 7
  { base: { k: '高い',  r: 'たかい', cls: 'i-adjective' }, ops: ['negative-past'] },
  // 8
  { base: { k: '高い',  r: 'たかい', cls: 'i-adjective' }, ops: ['naru','sugiru','te-shimau-colloq','past'] },
  // 9
  { base: { k: '高い',  r: 'たかい', cls: 'i-adjective' }, ops: ['naru','sugiru','te-shimau','past'] },
  // 10 — 飲んじゃった
  { base: { k: '飲む',  r: 'のむ',   cls: 'godan-m'     }, ops: ['te-shimau-colloq','past'] },
];

const fails: string[] = [];
let pass = 0;

function checkRun(
  label: string,
  parses: Parse[],
  surface: string,
  isKanji: boolean,
  base: { k: string; r: string },
  opsStr: string,
  requireTop0Forward = true,
): boolean {
  let ok = true;

  // (a) at least one parse forward-reproduces the surface
  const anyForward = parses.some(p => (isKanji ? p.kanji : p.kana) === surface);
  if (!anyForward) {
    fails.push(`(a) SURFACE NOT REPRODUCED: ${label} — parses: [${parses.slice(0,5).map(p => `${p.base.k}/${p.base.r}[${p.ops.join(',')}]`).join('|')}]`);
    console.error(`  ✗ (a) ${label}: surface "${surface}" not reproduced`);
    ok = false;
  }

  // (b) canonical parse present
  const canonIdx = parses.findIndex(
    p => p.base.k === base.k && p.base.r === base.r && p.ops.join(',') === opsStr
  );
  if (canonIdx === -1) {
    fails.push(`(b) CANONICAL MISSING: ${label} — parses: [${parses.slice(0,8).map(p => `${p.base.k}/${p.base.r}[${p.ops.join(',')}]`).join('|')}]`);
    console.error(`  ✗ (b) ${label}: canonical parse missing`);
    ok = false;
  }

  // (c) canonical ranks <= 3
  if (canonIdx !== -1 && canonIdx > 3) {
    fails.push(`(c) CANONICAL RANK ${canonIdx}: ${label}`);
    console.error(`  ✗ (c) ${label}: canonical rank ${canonIdx} > 3`);
    ok = false;
  }

  // (d) parses[0] forward-verifies
  if (requireTop0Forward && parses.length > 0) {
    const top0Surface = isKanji ? parses[0].kanji : parses[0].kana;
    if (top0Surface !== surface) {
      fails.push(`(d) TOP PARSE NOT FORWARD-VERIFIED: ${label} — top ${isKanji ? 'kanji' : 'kana'}="${top0Surface}"`);
      console.error(`  ✗ (d) ${label}: parses[0] surface "${top0Surface}" ≠ "${surface}"`);
      ok = false;
    }
  }

  return ok;
}

for (let i = 0; i < battery.length; i++) {
  const { base, ops } = battery[i];
  const entry: DictEntry = { k: base.k, r: base.r, romaji: '', cls: base.cls, common: true, gloss: '' };
  const verb = makeVerb(entry);
  const caseDesc = `case ${i + 1}: ${base.k}/${base.r}/${base.cls} [${ops.join(',')}]`;
  const opsStr = ops.join(',');

  let tiers;
  try {
    tiers = buildTower(verb, ops);
  } catch (err) {
    fails.push(`buildTower error in ${caseDesc}: ${err}`);
    console.error(`  ✗ ${caseDesc} — buildTower error: ${err}`);
    continue;
  }

  const top = tiers[tiers.length - 1];
  const surfaceKana = top.kana;
  const surfaceKanji = top.kanji;

  // kana surface run
  const kanaParses = deconjugate(surfaceKana, corpus);
  const kanaLabel = `${caseDesc} [kana="${surfaceKana}"]`;
  const kanaOk = checkRun(kanaLabel, kanaParses, surfaceKana, false, base, opsStr);

  // kanji surface run
  const kanjiParses = deconjugate(surfaceKanji, corpus);
  const kanjiLabel = `${caseDesc} [kanji="${surfaceKanji}"]`;
  const kanjiOk = checkRun(kanjiLabel, kanjiParses, surfaceKanji, true, base, opsStr);

  if (kanaOk && kanjiOk) {
    const canonKanaRank = kanaParses.findIndex(p => p.base.k === base.k && p.base.r === base.r && p.ops.join(',') === opsStr);
    const canonKanjiRank = kanjiParses.findIndex(p => p.base.k === base.k && p.base.r === base.r && p.ops.join(',') === opsStr);
    console.log(`  PASS ${caseDesc} (kana rank=${canonKanaRank}, kanji rank=${canonKanjiRank}, surface=${surfaceKana})`);
    pass++;
  }
}

console.log(`\nbattery: ${pass}/${battery.length} cases pass (all-clear = kana+kanji both ok), ${fails.length} issue(s)`);

// ── Colloquial て-いる contraction case ──────────────────────────────────────
// Input: 食べてた (kanji) and たべてた (kana)
// Expected parse: 食べる [te-iru, past], surface 食べていた / たべていた

const colloqTeIruOps = 'te-iru,past';

function checkColloq(input: string, isKanji: boolean): void {
  const parses = deconjugate(input, corpus);
  const teIruPast = parses.find(
    p => p.base.k === '食べる' && p.ops.join(',') === colloqTeIruOps
  );
  const expectedSurface = isKanji ? '食べていた' : 'たべていた';
  if (!teIruPast) {
    fails.push(`COLLOQ: "${input}" missing 食べる[te-iru,past]`);
    console.error(`  ✗ colloquial "${input}": 食べる[te-iru,past] not found`);
  } else if ((isKanji ? teIruPast.kanji : teIruPast.kana) !== expectedSurface) {
    fails.push(`COLLOQ: "${input}" 食べる[te-iru,past] surface mismatch: got "${isKanji ? teIruPast.kanji : teIruPast.kana}"`);
    console.error(`  ✗ colloquial "${input}": surface "${isKanji ? teIruPast.kanji : teIruPast.kana}" ≠ "${expectedSurface}"`);
  } else {
    console.log(`  PASS colloquial "${input}" → 食べる[te-iru,past] surface="${expectedSurface}" OK`);
  }
}

checkColloq('食べてた', true);
checkColloq('たべてた', false);

// ── Sanity asserts ────────────────────────────────────────────────────────────

// xyzzy → []
const noParses = deconjugate('xyzzy', corpus);
if (noParses.length !== 0) {
  fails.push(`NO-PARSE: expected [] for "xyzzy", got ${noParses.length} parses`);
  console.error(`  ✗ no-parse: "xyzzy" returned ${noParses.length} parses`);
} else {
  console.log('  PASS sanity: xyzzy → [] OK');
}

// たべられる → BOTH passive and potential
const ambiParses = deconjugate('たべられる', corpus);
const hasPassive  = ambiParses.some(p => p.base.k === '食べる' && p.ops.join(',') === 'passive');
const hasPotential = ambiParses.some(p => p.base.k === '食べる' && p.ops.join(',') === 'potential');
if (!hasPassive || !hasPotential) {
  fails.push(`AMBIGUITY: たべられる missing ${!hasPassive ? 'passive' : ''}${!hasPotential ? ' potential' : ''}`);
  console.error(`  ✗ ambiguity: たべられる — hasPassive=${hasPassive} hasPotential=${hasPotential}`);
} else {
  console.log('  PASS sanity: たべられる → passive + potential OK');
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('');
if (fails.length) {
  console.error(`FAILED: ${fails.length} issue(s):`);
  for (const f of fails) console.error('  ✗ ' + f);
  process.exit(1);
}

console.log('ALL DEEP DECONJUGATION CASES PASS');
