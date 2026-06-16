// Conjugation engine — extended to accept the JMdict dictionary verb-class codes.
//
// Core morphology is UNCHANGED from the original 4-class spec; we add a
// normalisation layer (`makeVerb`) that maps the finer dictionary `cls` strings
// (godan-m, godan-iku, godan-r-i, godan-aru, suru-noun, suru-s, zuru, …) onto
// the four behavioural buckets plus a handful of well-bounded special cases.
//
// The recursion invariant is preserved: after any voice layer
// (causative/passive/potential) the working form is ICHIDAN, and every later
// layer uses ichidan rules.

export type VClass = 'godan' | 'ichidan' | 'suru' | 'kuru';

// A compacted dictionary record (schema of verbs.sample.json / verbs.full.json).
export interface DictEntry {
  k: string;       // canonical dictionary-form headword (kanji, or kana if kana-only; suru-noun has する appended)
  r: string;       // kana reading of the dictionary form (lookup join key; katakana preserved for kana-only)
  romaji: string;  // macron-free romaji of the reading
  cls: string;     // dictionary conjugation class (godan carries its column inside the name)
  common: boolean; // JMdict-common flag (for UI prioritisation)
  gloss: string;   // first English gloss
}

export interface Verb {
  kanji: string;        // display dictionary-form headword
  kana: string;         // display dictionary-form reading (the BASE tier)
  romaji: string;
  klass: VClass;        // behavioural bucket
  prefixLen: number;    // # leading kana of `kana` owned by `kanjiPrefix`
  kanjiPrefix: string;  // kanji headword with trailing okurigana removed
  gloss: string;
  // ── dictionary extensions (only set for the special classes) ───────────────
  stem?: string;        // conjugation stem when it differs from `kana`
                        //   suru-s: 愛する → あいす (godan-s);  zuru: 信ずる → しんじる (ichidan)
  euphony?: 'iku' | 'u-s'; // godan て/た euphony override (行って / 問うた)
  suruPrefix?: string;  // suru / suru-noun: kana before する (plain する = '')
  aruNeg?: boolean;     // godan-r-i (ある): plain negative is suppletive ない
  aruPolite?: boolean;  // godan-aru (いらっしゃる): polite i-stem is irregular い
  rawClass?: string;    // original dictionary cls (for teaching notes)
}

export interface Tier {
  layer: 'base' | 'causative' | 'passive' | 'potential' | 'polite' | 'negative' | 'past';
  kana: string;
  kanji: string;
  romaji: string;
  label: string;
  aux: string;   // the auxiliary (助動詞) added at this tier, e.g. 'せる／させる'
  gloss: string;
  hlKana: [number, number];
  hlKanji: [number, number];
}

// ── Dictionary record → Verb ─────────────────────────────────────────────────
// Okurigana split: count the trailing *kana* characters of the kanji headword;
// the kanji prefix is everything before them, and prefixLen is how many leading
// reading-kana that prefix "owns" (reading length − okurigana length).
// For kana-only headwords (no kanji) this naturally yields kanjiPrefix='' and
// prefixLen=0, so the surface is just the conjugated kana.

const KANA_RE = /[ぁ-ゖゝゞァ-ヺーヽヾ]/; // hiragana + katakana + ー

function trailingKanaLen(s: string): number {
  let n = 0;
  for (let i = s.length - 1; i >= 0 && KANA_RE.test(s[i]); i--) n++;
  return n;
}

export function makeVerb(e: DictEntry): Verb {
  const okLen = trailingKanaLen(e.k);
  const kanjiPrefix = e.k.slice(0, e.k.length - okLen);
  const prefixLen = Math.max(0, e.r.length - okLen);

  const v: Verb = {
    kanji: e.k,
    kana: e.r,
    romaji: e.romaji,
    klass: 'godan',
    prefixLen,
    kanjiPrefix,
    gloss: cleanGloss(e.gloss),
    rawClass: e.cls,
  };

  switch (e.cls) {
    case 'ichidan':
    case 'ichidan-kureru':
      v.klass = 'ichidan';
      break;

    case 'godan-u':
    case 'godan-k':
    case 'godan-g':
    case 'godan-s':
    case 'godan-t':
    case 'godan-n':
    case 'godan-b':
    case 'godan-m':
    case 'godan-r':
      v.klass = 'godan';
      break;

    case 'godan-iku':
      v.klass = 'godan';
      v.euphony = 'iku';
      break;

    case 'godan-u-s':
      v.klass = 'godan';
      v.euphony = 'u-s';
      break;

    case 'godan-r-i': // ある — suppletive negative ない
      v.klass = 'godan';
      v.aruNeg = true;
      break;

    case 'godan-aru': // いらっしゃる/なさる/下さる/仰る — polite i-stem い
      v.klass = 'godan';
      v.aruPolite = true;
      break;

    case 'suru':
    case 'vs-i':
      v.klass = 'suru';
      v.suruPrefix = '';
      break;

    case 'suru-noun': // noun + する — keep the noun prefix fixed, conjugate the する tail
      v.klass = 'suru';
      v.suruPrefix = e.r.replace(/する$/, '');
      break;

    case 'suru-s': // 愛する/察する — conjugates as the literary godan-s 愛す (stem 愛す)
      v.klass = 'godan';
      v.stem = e.r.replace(/る$/, '');
      break;

    case 'zuru': // 信ずる/論ずる — conjugates as the じ-stem ichidan 信じる
      v.klass = 'ichidan';
      v.stem = e.r.replace(/ずる$/, 'じる');
      break;

    case 'kuru':
      v.klass = 'kuru';
      break;

    default:
      // Unknown / archaic class that slipped through: treat as godan-r so the
      // widget degrades rather than throwing.
      v.klass = 'godan';
      break;
  }
  return v;
}

// Trim JMdict glosses to a short, tower-friendly phrase ("to drink" → "drink").
function cleanGloss(g: string): string {
  if (!g) return '';
  let s = g.trim();
  s = s.replace(/^to\s+/i, '');
  // Drop trailing parenthetical qualifiers for compactness.
  s = s.replace(/\s*\([^)]*\)\s*$/, '').trim();
  // Keep only the first clause if there are several.
  const cut = s.split(/[;,]/)[0].trim();
  return cut || s;
}

// ── Godan stem tables (column from final kana) ───────────────────────────────
// a-stem: う→わ (NOT あ — わ-stem gotcha), く→か, ぐ→が, す→さ, つ→た, ぬ→な, ぶ→ば, む→ま, る→ら
const GODAN_A: Record<string, string> = {
  'う': 'わ', 'く': 'か', 'ぐ': 'が', 'す': 'さ',
  'つ': 'た', 'ぬ': 'な', 'ぶ': 'ば', 'む': 'ま', 'る': 'ら',
};
// i-stem (masu-stem)
const GODAN_I: Record<string, string> = {
  'う': 'い', 'く': 'き', 'ぐ': 'ぎ', 'す': 'し',
  'つ': 'ち', 'ぬ': 'に', 'ぶ': 'び', 'む': 'み', 'る': 'り',
};
// e-stem (potential)
const GODAN_E: Record<string, string> = {
  'う': 'え', 'く': 'け', 'ぐ': 'げ', 'す': 'せ',
  'つ': 'て', 'ぬ': 'ね', 'ぶ': 'べ', 'む': 'め', 'る': 'れ',
};

function godanStem(kana: string, table: Record<string, string>): string {
  const last = kana.slice(-1);
  const s = table[last];
  if (s === undefined) throw new Error(`godanStem: no entry for '${last}' in '${kana}'`);
  return kana.slice(0, -1) + s;
}

function dropRu(kana: string): string {
  return kana.slice(0, -1); // ichidan: drop final る
}

// ── て/た euphony ─────────────────────────────────────────────────────────────
// euphony override: 'iku' → っ (行って/行った); 'u-s' → うた (問うた, literary).
function godanTaForm(kana: string, euphony?: 'iku' | 'u-s'): string {
  const base = kana.slice(0, -1);
  if (euphony === 'iku') return base + 'った';
  if (euphony === 'u-s') return base + 'うた';
  const last = kana.slice(-1);
  switch (last) {
    case 'う': case 'つ': case 'る': return base + 'った';
    case 'む': case 'ぶ': case 'ぬ': return base + 'んだ';
    case 'く': return base + 'いた';
    case 'ぐ': return base + 'いだ';
    case 'す': return base + 'した';
    default: throw new Error(`godanTaForm: unknown ending '${last}' in '${kana}'`);
  }
}

// ── Kana → Rōmaji (Hepburn-ish) ──────────────────────────────────────────────
const KANA_ROM: Record<string, string> = {
  'あ':'a',  'い':'i',  'う':'u',  'え':'e',  'お':'o',
  'か':'ka', 'き':'ki', 'く':'ku', 'け':'ke', 'こ':'ko',
  'さ':'sa', 'し':'shi','す':'su', 'せ':'se', 'そ':'so',
  'た':'ta', 'ち':'chi','つ':'tsu','て':'te', 'と':'to',
  'な':'na', 'に':'ni', 'ぬ':'nu', 'ね':'ne', 'の':'no',
  'は':'ha', 'ひ':'hi', 'ふ':'fu', 'へ':'he', 'ほ':'ho',
  'ま':'ma', 'み':'mi', 'む':'mu', 'め':'me', 'も':'mo',
  'や':'ya', 'ゆ':'yu', 'よ':'yo',
  'ら':'ra', 'り':'ri', 'る':'ru', 'れ':'re', 'ろ':'ro',
  'わ':'wa', 'を':'wo',
  'が':'ga', 'ぎ':'gi', 'ぐ':'gu', 'げ':'ge', 'ご':'go',
  'ざ':'za', 'じ':'ji', 'ず':'zu', 'ぜ':'ze', 'ぞ':'zo',
  'だ':'da', 'ぢ':'ji', 'づ':'zu', 'で':'de', 'ど':'do',
  'ば':'ba', 'び':'bi', 'ぶ':'bu', 'べ':'be', 'ぼ':'bo',
  'ぱ':'pa', 'ぴ':'pi', 'ぷ':'pu', 'ぺ':'pe', 'ぽ':'po',
  'ゔ':'vu',
  'きゃ':'kya','きゅ':'kyu','きょ':'kyo',
  'しゃ':'sha','しゅ':'shu','しょ':'sho',
  'ちゃ':'cha','ちゅ':'chu','ちょ':'cho',
  'にゃ':'nya','にゅ':'nyu','にょ':'nyo',
  'ひゃ':'hya','ひゅ':'hyu','ひょ':'hyo',
  'みゃ':'mya','みゅ':'myu','みょ':'myo',
  'りゃ':'rya','りゅ':'ryu','りょ':'ryo',
  'ぎゃ':'gya','ぎゅ':'gyu','ぎょ':'gyo',
  'じゃ':'ja', 'じゅ':'ju', 'じょ':'jo',
  'びゃ':'bya','びゅ':'byu','びょ':'byo',
  'ぴゃ':'pya','ぴゅ':'pyu','ぴょ':'pyo',
};

// Normalise katakana → hiragana so kana-only verbs (サボる, ググる) romanise
// cleanly through the hiragana table.
function kataToHira(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c >= 0x30A1 && c <= 0x30F6) out += String.fromCodePoint(c - 0x60);
    else out += ch;
  }
  return out;
}

export function kanaToRomaji(input: string): string {
  const chars = Array.from(kataToHira(input));
  let out = '';
  let i = 0;
  while (i < chars.length) {
    const c = chars[i];
    if (c === 'っ') {
      if (i + 1 < chars.length) {
        const two = chars[i + 1] + (chars[i + 2] ?? '');
        const r = KANA_ROM[two] ?? KANA_ROM[chars[i + 1]] ?? '';
        if (r.length > 0) out += r[0];
      }
      i++;
    } else if (c === 'ん') {
      out += 'n';
      i++;
    } else {
      const two = c + (chars[i + 1] ?? '');
      if (KANA_ROM[two] !== undefined) { out += KANA_ROM[two]; i += 2; }
      else { out += KANA_ROM[c] ?? c; i++; }
    }
  }
  return out;
}

// ── Highlight helper ──────────────────────────────────────────────────────────
function highlightRange(prev: string, curr: string): [number, number] {
  let i = 0;
  const min = Math.min(prev.length, curr.length);
  while (i < min && prev[i] === curr[i]) i++;
  return [i, curr.length];
}

// ── Gloss builder ─────────────────────────────────────────────────────────────
function buildGloss(core: string, isPolite: boolean, isNeg: boolean, isPast: boolean): string {
  let g = core;
  if (isNeg && isPast) {
    if (g.startsWith('be ')) g = 'was not ' + g.slice(3);
    else g = "didn't " + g;
  } else if (isNeg) {
    g = 'not ' + g;
  } else if (isPast) {
    g = g + ' (past)';
  }
  if (isPolite) g += ' (polite)';
  return g;
}

// Auxiliary (助動詞) names surfaced per tier.
const AUX = {
  causative: 'せる／させる',
  passive:   'れる／られる',
  potential: 'れる／られる',
  polite:    'ます',
  negative:  'ない',
  past:      'た／だ',
} as const;

export interface TowerOpts {
  causative: boolean;
  voice: 'none' | 'passive' | 'potential';
  polite: boolean;
  negative: boolean;
  past: boolean;
}

// ── Main export ───────────────────────────────────────────────────────────────
export function buildTower(verb: Verb, opts: TowerOpts): Tier[] {
  const tiers: Tier[] = [];

  const suruPrefix = verb.suruPrefix ?? '';
  let klass: VClass = verb.klass;
  let coreGloss = verb.gloss;
  let politeApplied = false;
  let negApplied = false;
  let causApplied = false;

  // kanji surface: kanjiPrefix + conjugatedKana.slice(prefixLen)
  const splice = (k: string) => verb.kanjiPrefix + k.slice(verb.prefixLen);

  // ── flag-aware layer transforms (close over `verb`) ─────────────────────────
  const applyCausative = (kana: string, k: VClass): string => {
    switch (k) {
      case 'godan':   return godanStem(kana, GODAN_A) + 'せる';
      case 'ichidan': return dropRu(kana) + 'させる';
      case 'suru':    return suruPrefix + 'させる';
      case 'kuru':    return 'こさせる';
    }
  };
  const applyPassive = (kana: string, k: VClass): string => {
    switch (k) {
      case 'godan':   return godanStem(kana, GODAN_A) + 'れる';
      case 'ichidan': return dropRu(kana) + 'られる';
      case 'suru':    return suruPrefix + 'される';
      case 'kuru':    return 'こられる';
    }
  };
  const applyPotential = (kana: string, k: VClass): string => {
    switch (k) {
      case 'godan':   return godanStem(kana, GODAN_E) + 'る';
      case 'ichidan': return dropRu(kana) + 'られる';
      case 'suru':    return suruPrefix + 'できる';
      case 'kuru':    return 'こられる';
    }
  };
  const applyPolite = (kana: string, k: VClass): string => {
    switch (k) {
      case 'godan':
        if (verb.aruPolite) return kana.slice(0, -1) + 'います'; // いらっしゃ-います
        return godanStem(kana, GODAN_I) + 'ます';
      case 'ichidan': return dropRu(kana) + 'ます';
      case 'suru':    return suruPrefix + 'します';
      case 'kuru':    return 'きます';
    }
  };
  const applyNegative = (kana: string, k: VClass, isPolite: boolean): string => {
    if (isPolite) return kana.slice(0, -2) + 'ません'; // ます → ません
    switch (k) {
      case 'godan':
        if (verb.aruNeg) return 'ない'; // ある → ない (suppletive); only on the bare base
        return godanStem(kana, GODAN_A) + 'ない';
      case 'ichidan': return dropRu(kana) + 'ない';
      case 'suru':    return suruPrefix + 'しない';
      case 'kuru':    return 'こない';
    }
  };
  const applyPast = (kana: string, k: VClass, isPolite: boolean, isNeg: boolean): string => {
    if (isPolite && isNeg)  return kana.slice(0, -3) + 'ませんでした';
    if (isPolite && !isNeg) return kana.slice(0, -2) + 'ました';
    if (!isPolite && isNeg) return kana.slice(0, -2) + 'なかった'; // ない → なかった
    switch (k) {
      case 'godan':   return godanTaForm(kana, verb.euphony);
      case 'ichidan': return dropRu(kana) + 'た';
      case 'suru':    return suruPrefix + 'した';
      case 'kuru':    return 'きた';
    }
  };

  const push = (
    layer: Tier['layer'],
    newKana: string,
    label: string,
    aux: string,
    isPolite: boolean,
    isNeg: boolean,
    isPast: boolean,
  ) => {
    const prevKana  = tiers.length > 0 ? tiers[tiers.length - 1].kana  : '';
    const prevKanji = tiers.length > 0 ? tiers[tiers.length - 1].kanji : '';
    const newKanji  = splice(newKana);
    tiers.push({
      layer,
      kana:    newKana,
      kanji:   newKanji,
      romaji:  kanaToRomaji(newKana),
      label,
      aux,
      gloss:   buildGloss(coreGloss, isPolite, isNeg, isPast),
      hlKana:  layer === 'base' ? [0, 0] : highlightRange(prevKana, newKana),
      hlKanji: layer === 'base' ? [0, 0] : highlightRange(prevKanji, newKanji),
    });
  };

  // BASE — always the dictionary form (display).
  push('base', verb.kana, 'base', '', false, false, false);

  // From here the working form uses the conjugation stem (≠ display for suru-s / zuru).
  let kana = verb.stem ?? verb.kana;

  if (opts.causative) {
    kana = applyCausative(kana, klass);
    klass = 'ichidan';
    causApplied = true;
    coreGloss = 'make/let ' + verb.gloss;
    push('causative', kana, 'causative', AUX.causative, false, false, false);
  }

  if (opts.voice === 'passive') {
    kana = applyPassive(kana, klass);
    klass = 'ichidan';
    coreGloss = causApplied ? 'be made to ' + verb.gloss : 'be ' + verb.gloss;
    push('passive', kana, 'passive', AUX.passive, false, false, false);
  } else if (opts.voice === 'potential') {
    kana = applyPotential(kana, klass);
    klass = 'ichidan';
    coreGloss = 'can ' + verb.gloss;
    push('potential', kana, 'potential', AUX.potential, false, false, false);
  }

  if (opts.polite) {
    kana = applyPolite(kana, klass);
    politeApplied = true;
    push('polite', kana, 'polite', AUX.polite, true, false, false);
  }

  if (opts.negative) {
    kana = applyNegative(kana, klass, politeApplied);
    negApplied = true;
    push('negative', kana, 'negative', AUX.negative, politeApplied, true, false);
  }

  if (opts.past) {
    kana = applyPast(kana, klass, politeApplied, negApplied);
    push('past', kana, 'past', AUX.past, politeApplied, negApplied, true);
  }

  return tiers;
}

// ── Featured quick-pick verbs (the original 10 demo verbs) ───────────────────
// Identified by canonical kanji headword so the curated row stays exactly the
// original 10 (and the default state 飲ませられる) regardless of corpus order.
export const FEATURED_KANJI = ['飲む', '話す', '行く', '買う', '待つ', '泳ぐ', '食べる', '見る', 'する', '来る'];
