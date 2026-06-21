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

// ── must / must-not round-trip assertions ─────────────────────────────────────

// 飲まなければならない → 飲む[must]
const mustParses = deconjugate('のまなければならない', corpus);
const hasMust = mustParses.some(p => p.base.k === '飲む' && p.ops.join(',') === 'must');
if (!hasMust) {
  fails.push(`MUST: のまなければならない should parse as 飲む[must]; got [${mustParses.map(p => `${p.base.k}[${p.ops.join(',')}]`).join('|')}]`);
  console.error('  ✗ must: のまなければならない missing 飲む[must]');
} else {
  console.log('must assert (のまなければならない → 飲む[must]): OK');
}

// 飲んではいけない → 飲む[must-not]
const mustNotParses = deconjugate('のんではいけない', corpus);
const hasMustNot = mustNotParses.some(p => p.base.k === '飲む' && p.ops.join(',') === 'must-not');
if (!hasMustNot) {
  fails.push(`MUST-NOT: のんではいけない should parse as 飲む[must-not]; got [${mustNotParses.map(p => `${p.base.k}[${p.ops.join(',')}]`).join('|')}]`);
  console.error('  ✗ must-not: のんではいけない missing 飲む[must-not]');
} else {
  console.log('must-not assert (のんではいけない → 飲む[must-not]): OK');
}

// 飲まなければならなかった → 飲む[must,past]
const mustPastParses = deconjugate('のまなければならなかった', corpus);
const hasMustPast = mustPastParses.some(p => p.base.k === '飲む' && p.ops.join(',') === 'must,past');
if (!hasMustPast) {
  fails.push(`MUST-PAST: のまなければならなかった should parse as 飲む[must,past]; got [${mustPastParses.map(p => `${p.base.k}[${p.ops.join(',')}]`).join('|')}]`);
  console.error('  ✗ must-past: のまなければならなかった missing 飲む[must,past]');
} else {
  console.log('must-past assert (のまなければならなかった → 飲む[must,past]): OK');
}

// 飲まなければなりません → 飲む[must,polite]
const mustPoliteParses = deconjugate('のまなければなりません', corpus);
const hasMustPolite = mustPoliteParses.some(p => p.base.k === '飲む' && p.ops.join(',') === 'must,polite');
if (!hasMustPolite) {
  fails.push(`MUST-POLITE: のまなければなりません should parse as 飲む[must,polite]; got [${mustPoliteParses.map(p => `${p.base.k}[${p.ops.join(',')}]`).join('|')}]`);
  console.error('  ✗ must-polite: のまなければなりません missing 飲む[must,polite]');
} else {
  console.log('must-polite assert (のまなければなりません → 飲む[must,polite]): OK');
}

// 飲んではいけなかった → 飲む[must-not,past]
const mustNotPastParses = deconjugate('のんではいけなかった', corpus);
const hasMustNotPast = mustNotPastParses.some(p => p.base.k === '飲む' && p.ops.join(',') === 'must-not,past');
if (!hasMustNotPast) {
  fails.push(`MUST-NOT-PAST: のんではいけなかった should parse as 飲む[must-not,past]; got [${mustNotPastParses.map(p => `${p.base.k}[${p.ops.join(',')}]`).join('|')}]`);
  console.error('  ✗ must-not-past: のんではいけなかった missing 飲む[must-not,past]');
} else {
  console.log('must-not-past assert (のんではいけなかった → 飲む[must-not,past]): OK');
}

// 飲んではいけません → 飲む[must-not,polite]
const mustNotPoliteParses = deconjugate('のんではいけません', corpus);
const hasMustNotPolite = mustNotPoliteParses.some(p => p.base.k === '飲む' && p.ops.join(',') === 'must-not,polite');
if (!hasMustNotPolite) {
  fails.push(`MUST-NOT-POLITE: のんではいけません should parse as 飲む[must-not,polite]; got [${mustNotPoliteParses.map(p => `${p.base.k}[${p.ops.join(',')}]`).join('|')}]`);
  console.error('  ✗ must-not-polite: のんではいけません missing 飲む[must-not,polite]');
} else {
  console.log('must-not-polite assert (のんではいけません → 飲む[must-not,polite]): OK');
}

// ── kudasai (polite request) round-trip assertions ───────────────────────────

// のんでください → 飲む[kudasai]
const kudasaiNomuParses = deconjugate('のんでください', corpus);
const hasKudasaiNomu = kudasaiNomuParses.some(p => p.base.k === '飲む' && p.ops.join(',') === 'kudasai');
if (!hasKudasaiNomu) {
  fails.push(`KUDASAI: のんでください should parse as 飲む[kudasai]; got [${kudasaiNomuParses.map(p => `${p.base.k}[${p.ops.join(',')}]`).join('|')}]`);
  console.error('  ✗ kudasai: のんでください missing 飲む[kudasai]');
} else {
  console.log('kudasai assert (のんでください → 飲む[kudasai]): OK');
}

// たべてください → 食べる[kudasai]
const kudasaiTabeParses = deconjugate('たべてください', corpus);
const hasKudasaiTabe = kudasaiTabeParses.some(p => p.base.k === '食べる' && p.ops.join(',') === 'kudasai');
if (!hasKudasaiTabe) {
  fails.push(`KUDASAI-TABE: たべてください should parse as 食べる[kudasai]; got [${kudasaiTabeParses.map(p => `${p.base.k}[${p.ops.join(',')}]`).join('|')}]`);
  console.error('  ✗ kudasai-tabe: たべてください missing 食べる[kudasai]');
} else {
  console.log('kudasai-tabe assert (たべてください → 食べる[kudasai]): OK');
}

// してください → する[kudasai]
const kudasaiSuruParses = deconjugate('してください', corpus);
const hasKudasaiSuru = kudasaiSuruParses.some(p => p.base.k === 'する' && p.ops.join(',') === 'kudasai');
if (!hasKudasaiSuru) {
  fails.push(`KUDASAI-SURU: してください should parse as する[kudasai]; got [${kudasaiSuruParses.map(p => `${p.base.k}[${p.ops.join(',')}]`).join('|')}]`);
  console.error('  ✗ kudasai-suru: してください missing する[kudasai]');
} else {
  console.log('kudasai-suru assert (してください → する[kudasai]): OK');
}

// きてください → 来る[kudasai]
const kudasaiKuruParses = deconjugate('きてください', corpus);
const hasKudasaiKuru = kudasaiKuruParses.some(p => p.base.k === '来る' && p.ops.join(',') === 'kudasai');
if (!hasKudasaiKuru) {
  fails.push(`KUDASAI-KURU: きてください should parse as 来る[kudasai]; got [${kudasaiKuruParses.map(p => `${p.base.k}[${p.ops.join(',')}]`).join('|')}]`);
  console.error('  ✗ kudasai-kuru: きてください missing 来る[kudasai]');
} else {
  console.log('kudasai-kuru assert (きてください → 来る[kudasai]): OK');
}

// いってください → 行く[kudasai]
const kudasaiIkuParses = deconjugate('いってください', corpus);
const hasKudasaiIku = kudasaiIkuParses.some(p => p.base.k === '行く' && p.ops.join(',') === 'kudasai');
if (!hasKudasaiIku) {
  fails.push(`KUDASAI-IKU: いってください should parse as 行く[kudasai]; got [${kudasaiIkuParses.map(p => `${p.base.k}[${p.ops.join(',')}]`).join('|')}]`);
  console.error('  ✗ kudasai-iku: いってください missing 行く[kudasai]');
} else {
  console.log('kudasai-iku assert (いってください → 行く[kudasai]): OK');
}

// かいてください → 書く[kudasai]
const kudasaiKakuParses = deconjugate('かいてください', corpus);
const hasKudasaiKaku = kudasaiKakuParses.some(p => p.base.k === '書く' && p.ops.join(',') === 'kudasai');
if (!hasKudasaiKaku) {
  fails.push(`KUDASAI-KAKU: かいてください should parse as 書く[kudasai]; got [${kudasaiKakuParses.map(p => `${p.base.k}[${p.ops.join(',')}]`).join('|')}]`);
  console.error('  ✗ kudasai-kaku: かいてください missing 書く[kudasai]');
} else {
  console.log('kudasai-kaku assert (かいてください → 書く[kudasai]): OK');
}

// ── kudasai-not (negative polite request) round-trip assertions ──────────────

// のまないでください → 飲む[kudasai-not]
const kudasaiNotNomuParses = deconjugate('のまないでください', corpus);
const hasKudasaiNotNomu = kudasaiNotNomuParses.some(p => p.base.k === '飲む' && p.ops.join(',') === 'kudasai-not');
if (!hasKudasaiNotNomu) {
  fails.push(`KUDASAI-NOT: のまないでください should parse as 飲む[kudasai-not]; got [${kudasaiNotNomuParses.map(p => `${p.base.k}[${p.ops.join(',')}]`).join('|')}]`);
  console.error('  ✗ kudasai-not: のまないでください missing 飲む[kudasai-not]');
} else {
  console.log('kudasai-not assert (のまないでください → 飲む[kudasai-not]): OK');
}

// たべないでください → 食べる[kudasai-not]
const kudasaiNotTabeParses = deconjugate('たべないでください', corpus);
const hasKudasaiNotTabe = kudasaiNotTabeParses.some(p => p.base.k === '食べる' && p.ops.join(',') === 'kudasai-not');
if (!hasKudasaiNotTabe) {
  fails.push(`KUDASAI-NOT-TABE: たべないでください should parse as 食べる[kudasai-not]; got [${kudasaiNotTabeParses.map(p => `${p.base.k}[${p.ops.join(',')}]`).join('|')}]`);
  console.error('  ✗ kudasai-not-tabe: たべないでください missing 食べる[kudasai-not]');
} else {
  console.log('kudasai-not-tabe assert (たべないでください → 食べる[kudasai-not]): OK');
}

// しないでください → する[kudasai-not]
const kudasaiNotSuruParses = deconjugate('しないでください', corpus);
const hasKudasaiNotSuru = kudasaiNotSuruParses.some(p => p.base.k === 'する' && p.ops.join(',') === 'kudasai-not');
if (!hasKudasaiNotSuru) {
  fails.push(`KUDASAI-NOT-SURU: しないでください should parse as する[kudasai-not]; got [${kudasaiNotSuruParses.map(p => `${p.base.k}[${p.ops.join(',')}]`).join('|')}]`);
  console.error('  ✗ kudasai-not-suru: しないでください missing する[kudasai-not]');
} else {
  console.log('kudasai-not-suru assert (しないでください → する[kudasai-not]): OK');
}

// こないでください → 来る[kudasai-not]
const kudasaiNotKuruParses = deconjugate('こないでください', corpus);
const hasKudasaiNotKuru = kudasaiNotKuruParses.some(p => p.base.k === '来る' && p.ops.join(',') === 'kudasai-not');
if (!hasKudasaiNotKuru) {
  fails.push(`KUDASAI-NOT-KURU: こないでください should parse as 来る[kudasai-not]; got [${kudasaiNotKuruParses.map(p => `${p.base.k}[${p.ops.join(',')}]`).join('|')}]`);
  console.error('  ✗ kudasai-not-kuru: こないでください missing 来る[kudasai-not]');
} else {
  console.log('kudasai-not-kuru assert (こないでください → 来る[kudasai-not]): OK');
}

// いかないでください → 行く[kudasai-not]
const kudasaiNotIkuParses = deconjugate('いかないでください', corpus);
const hasKudasaiNotIku = kudasaiNotIkuParses.some(p => p.base.k === '行く' && p.ops.join(',') === 'kudasai-not');
if (!hasKudasaiNotIku) {
  fails.push(`KUDASAI-NOT-IKU: いかないでください should parse as 行く[kudasai-not]; got [${kudasaiNotIkuParses.map(p => `${p.base.k}[${p.ops.join(',')}]`).join('|')}]`);
  console.error('  ✗ kudasai-not-iku: いかないでください missing 行く[kudasai-not]');
} else {
  console.log('kudasai-not-iku assert (いかないでください → 行く[kudasai-not]): OK');
}

// かかないでください → 書く[kudasai-not]
const kudasaiNotKakuParses = deconjugate('かかないでください', corpus);
const hasKudasaiNotKaku = kudasaiNotKakuParses.some(p => p.base.k === '書く' && p.ops.join(',') === 'kudasai-not');
if (!hasKudasaiNotKaku) {
  fails.push(`KUDASAI-NOT-KAKU: かかないでください should parse as 書く[kudasai-not]; got [${kudasaiNotKakuParses.map(p => `${p.base.k}[${p.ops.join(',')}]`).join('|')}]`);
  console.error('  ✗ kudasai-not-kaku: かかないでください missing 書く[kudasai-not]');
} else {
  console.log('kudasai-not-kaku assert (かかないでください → 書く[kudasai-not]): OK');
}

// ── may (〜てもいい) round-trip assertions ────────────────────────────────────

function assertParse(input: string, baseK: string, opsStr: string, tag: string): void {
  const parses = deconjugate(input, corpus);
  const hit = parses.some(p => p.base.k === baseK && p.ops.join(',') === opsStr);
  if (!hit) {
    fails.push(`${tag}: ${input} should parse as ${baseK}[${opsStr}]; got [${parses.map(p => `${p.base.k}[${p.ops.join(',')}]`).join('|')}]`);
    console.error(`  ✗ ${tag}: ${input} missing ${baseK}[${opsStr}]`);
  } else {
    console.log(`${tag} assert (${input} → ${baseK}[${opsStr}]): OK`);
  }
}

assertParse('のんでもいい', '飲む', 'may', 'MAY-NOMU');
assertParse('たべてもいい', '食べる', 'may', 'MAY-TABE');
assertParse('してもいい', 'する', 'may', 'MAY-SURU');
assertParse('きてもいい', '来る', 'may', 'MAY-KURU');
assertParse('いってもいい', '行く', 'may', 'MAY-IKU');
assertParse('かいてもいい', '書く', 'may', 'MAY-KAKU');

// ── need-not (〜なくてもいい) round-trip assertions ───────────────────────────

assertParse('のまなくてもいい', '飲む', 'need-not', 'NEEDNOT-NOMU');
assertParse('たべなくてもいい', '食べる', 'need-not', 'NEEDNOT-TABE');
assertParse('しなくてもいい', 'する', 'need-not', 'NEEDNOT-SURU');
assertParse('こなくてもいい', '来る', 'need-not', 'NEEDNOT-KURU');
assertParse('いかなくてもいい', '行く', 'need-not', 'NEEDNOT-IKU');
assertParse('かかなくてもいい', '書く', 'need-not', 'NEEDNOT-KAKU');

// ── inflected may/need-not (re-conjugate as い-adjective) ─────────────────────

assertParse('のんでもよかった', '飲む', 'may,past', 'MAY-PAST-NOMU');
assertParse('のまなくてもよかった', '飲む', 'need-not,past', 'NEEDNOT-PAST-NOMU');

// ── Compound-verb (phase) assertions ──────────────────────────────────────────

// のみはじめる → 飲む[hajimeru]
const compoundHajimeruParses = deconjugate('のみはじめる', corpus);
const hasCompoundHajimeru = compoundHajimeruParses.some(p => p.base.k === '飲む' && p.ops.join(',') === 'hajimeru');
if (!hasCompoundHajimeru) {
  fails.push(`COMPOUND-HAJIMERU: のみはじめる should parse as 飲む[hajimeru]; got [${compoundHajimeruParses.map(p => `${p.base.k}[${p.ops.join(',')}]`).join('|')}]`);
  console.error('  ✗ compound-hajimeru: のみはじめる missing 飲む[hajimeru]');
} else {
  console.log('compound-hajimeru assert (のみはじめる → 飲む[hajimeru]): OK');
}

// のみおわった → 飲む[owaru,past]
const compoundOwaruParses = deconjugate('のみおわった', corpus);
const hasCompoundOwaru = compoundOwaruParses.some(p => p.base.k === '飲む' && p.ops.join(',') === 'owaru,past');
if (!hasCompoundOwaru) {
  fails.push(`COMPOUND-OWARU-PAST: のみおわった should parse as 飲む[owaru,past]; got [${compoundOwaruParses.map(p => `${p.base.k}[${p.ops.join(',')}]`).join('|')}]`);
  console.error('  ✗ compound-owaru-past: のみおわった missing 飲む[owaru,past]');
} else {
  console.log('compound-owaru-past assert (のみおわった → 飲む[owaru,past]): OK');
}

// たべはじめる → 食べる[hajimeru]
const compoundTabeHajimeruParses = deconjugate('たべはじめる', corpus);
const hasCompoundTabeHajimeru = compoundTabeHajimeruParses.some(p => p.base.k === '食べる' && p.ops.join(',') === 'hajimeru');
if (!hasCompoundTabeHajimeru) {
  fails.push(`COMPOUND-TABE-HAJIMERU: たべはじめる should parse as 食べる[hajimeru]; got [${compoundTabeHajimeruParses.map(p => `${p.base.k}[${p.ops.join(',')}]`).join('|')}]`);
  console.error('  ✗ compound-tabe-hajimeru: たべはじめる missing 食べる[hajimeru]');
} else {
  console.log('compound-tabe-hajimeru assert (たべはじめる → 食べる[hajimeru]): OK');
}

// のみだす → 飲む[dasu]
const compoundDasuParses = deconjugate('のみだす', corpus);
const hasCompoundDasu = compoundDasuParses.some(p => p.base.k === '飲む' && p.ops.join(',') === 'dasu');
if (!hasCompoundDasu) {
  fails.push(`COMPOUND-DASU: のみだす should parse as 飲む[dasu]; got [${compoundDasuParses.map(p => `${p.base.k}[${p.ops.join(',')}]`).join('|')}]`);
  console.error('  ✗ compound-dasu: のみだす missing 飲む[dasu]');
} else {
  console.log('compound-dasu assert (のみだす → 飲む[dasu]): OK');
}

// のみつづける → 飲む[tsuzukeru]
const compoundTsuzukeruParses = deconjugate('のみつづける', corpus);
const hasCompoundTsuzukeru = compoundTsuzukeruParses.some(p => p.base.k === '飲む' && p.ops.join(',') === 'tsuzukeru');
if (!hasCompoundTsuzukeru) {
  fails.push(`COMPOUND-TSUZUKERU: のみつづける should parse as 飲む[tsuzukeru]; got [${compoundTsuzukeruParses.map(p => `${p.base.k}[${p.ops.join(',')}]`).join('|')}]`);
  console.error('  ✗ compound-tsuzukeru: のみつづける missing 飲む[tsuzukeru]');
} else {
  console.log('compound-tsuzukeru assert (のみつづける → 飲む[tsuzukeru]): OK');
}

// ── new obligation variant ops (formal) — exact, single canonical ─────────────

assertParse('のまなければいけない', '飲む', 'must-nke-ikenai', 'MUST-NKE-NOMU');
assertParse('たべなければいけない', '食べる', 'must-nke-ikenai', 'MUST-NKE-TABE');
assertParse('しなければいけない', 'する', 'must-nke-ikenai', 'MUST-NKE-SURU');
assertParse('こなければいけない', '来る', 'must-nke-ikenai', 'MUST-NKE-KURU');
assertParse('いかなければいけない', '行く', 'must-nke-ikenai', 'MUST-NKE-IKU');
assertParse('のまなくてはならない', '飲む', 'must-nakutewa-naranai', 'MUST-NTN-NOMU');
assertParse('のまなくてはいけない', '飲む', 'must-nakutewa-ikenai', 'MUST-NTI-NOMU');

// composition with past / polite (compose for free via the must branches)
assertParse('のまなければいけなかった', '飲む', 'must-nke-ikenai,past', 'MUST-NKE-PAST');
assertParse('のまなければいけません', '飲む', 'must-nke-ikenai,polite', 'MUST-NKE-POL');
assertParse('のまなければいけませんでした', '飲む', 'must-nke-ikenai,polite,past', 'MUST-NKE-POLPAST');
assertParse('のまなくてはなりません', '飲む', 'must-nakutewa-naranai,polite', 'MUST-NTN-POL');

// ── standalone casual obligation ops ─────────────────────────────────────────

assertParse('のまなきゃ', '飲む', 'must-nakya', 'NAKYA-NOMU');
assertParse('しなきゃ', 'する', 'must-nakya', 'NAKYA-SURU');
assertParse('のまなくちゃ', '飲む', 'must-nakucha', 'NAKUCHA-NOMU');
assertParse('たべなくちゃ', '食べる', 'must-nakucha', 'NAKUCHA-TABE');

// casual-with-consequence breaks down to the formal op (penalised expansion pass)
assertParse('のまなきゃいけない', '飲む', 'must-nke-ikenai', 'NAKYA-CONS-NOMU');
assertParse('のまなくちゃならない', '飲む', 'must-nakutewa-naranai', 'NAKUCHA-CONS-NOMU');

// ── single-parse / no-spurious asserts (the point of the ambiguity work) ──────

function assertTop(input: string, baseK: string, opsStr: string, tag: string): void {
  const ps = deconjugate(input, corpus);
  const top = ps[0];
  if (!top || top.base.k !== baseK || top.ops.join(',') !== opsStr) {
    fails.push(`${tag}: top parse of ${input} != ${baseK}[${opsStr}] (got ${ps.map(p => p.base.k + '[' + p.ops.join(',') + ']').join('|')})`);
    console.error(`  ✗ ${tag}: top parse of ${input} != ${baseK}[${opsStr}]`);
  } else {
    console.log(`${tag} assert (${input} top → ${baseK}[${opsStr}]): OK`);
  }
}

assertTop('しなければならない', 'する', 'must', 'AMBIG-MUST-SURU');
assertTop('のまなければならない', '飲む', 'must', 'AMBIG-MUST-NOMU');
assertTop('しなければならなかった', 'する', 'must,past', 'AMBIG-MUSTPAST');

// naru trailing-く guard collapses しなければならない to a single parse
{
  const n = deconjugate('しなければならない', corpus).length;
  if (n !== 1) {
    fails.push(`AMBIG-LEN: しなければならない should have exactly 1 parse; got ${n}`);
    console.error(`  ✗ AMBIG-LEN: しなければならない has ${n} parses (want 1)`);
  } else {
    console.log('AMBIG-LEN assert (しなければならない → 1 parse): OK');
  }
}

if (fails.length) {
  console.error(`\nFAILED: ${fails.length} issue(s)`);
  process.exit(1);
}

console.log('ALL DECONJUGATION CASES PASS');
