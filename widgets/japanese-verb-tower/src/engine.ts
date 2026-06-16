// Conjugation engine — transcribed from /workspace/ENGINE_SPEC.md.
// Do NOT re-derive morphology here; follow the spec tables exactly.

export type VClass = 'godan' | 'ichidan' | 'suru' | 'kuru';

export interface Verb {
  kanji: string;
  kana: string;
  romaji: string;
  klass: VClass;
  prefixLen: number;   // # leading kana owned by the leading kanji
  kanjiPrefix: string; // kanji with trailing okurigana removed
  gloss: string;
}

export interface Tier {
  layer: 'base' | 'causative' | 'passive' | 'potential' | 'polite' | 'negative' | 'past';
  kana: string;
  kanji: string;
  romaji: string;
  label: string;
  gloss: string;
  hlKana: [number, number];   // [start,end) after LCP with previous tier kana
  hlKanji: [number, number];  // [start,end) after LCP with previous tier kanji
}

// ── Verb table (ENGINE_SPEC §"The 8 demo verbs (+2)") ────────────────────────
// Stored in spec order; prefixLen / kanjiPrefix enable kanji-surface splicing.

export const VERBS: Verb[] = [
  { kanji: '飲む',   kana: 'のむ',   romaji: 'nomu',   klass: 'godan',   prefixLen: 1, kanjiPrefix: '飲', gloss: 'drink' },
  { kanji: '話す',   kana: 'はなす', romaji: 'hanasu', klass: 'godan',   prefixLen: 2, kanjiPrefix: '話', gloss: 'speak' },
  { kanji: '行く',   kana: 'いく',   romaji: 'iku',    klass: 'godan',   prefixLen: 1, kanjiPrefix: '行', gloss: 'go'    },
  { kanji: '買う',   kana: 'かう',   romaji: 'kau',    klass: 'godan',   prefixLen: 1, kanjiPrefix: '買', gloss: 'buy'   },
  { kanji: '待つ',   kana: 'まつ',   romaji: 'matsu',  klass: 'godan',   prefixLen: 1, kanjiPrefix: '待', gloss: 'wait'  },
  { kanji: '泳ぐ',   kana: 'およぐ', romaji: 'oyogu',  klass: 'godan',   prefixLen: 2, kanjiPrefix: '泳', gloss: 'swim'  },
  { kanji: '食べる', kana: 'たべる', romaji: 'taberu', klass: 'ichidan', prefixLen: 1, kanjiPrefix: '食', gloss: 'eat'   },
  { kanji: '見る',   kana: 'みる',   romaji: 'miru',   klass: 'ichidan', prefixLen: 1, kanjiPrefix: '見', gloss: 'see'   },
  { kanji: 'する',   kana: 'する',   romaji: 'suru',   klass: 'suru',    prefixLen: 0, kanjiPrefix: '',  gloss: 'do'    },
  { kanji: '来る',   kana: 'くる',   romaji: 'kuru',   klass: 'kuru',    prefixLen: 1, kanjiPrefix: '来', gloss: 'come'  },
];

// ── Godan stem tables (ENGINE_SPEC §"Godan stem tables") ──────────────────────
// a-stem: う→わ (NOT あ — わ-stem gotcha), く→か, ぐ→が, す→さ, つ→た, ぬ→な, ぶ→ば, む→ま, る→ら
const GODAN_A: Record<string, string> = {
  'う': 'わ', 'く': 'か', 'ぐ': 'が', 'す': 'さ',
  'つ': 'た', 'ぬ': 'な', 'ぶ': 'ば', 'む': 'ま', 'る': 'ら',
};

// i-stem (masu-stem): う→い, く→き, ぐ→ぎ, す→し, つ→ち, ぬ→に, ぶ→び, む→み, る→り
const GODAN_I: Record<string, string> = {
  'う': 'い', 'く': 'き', 'ぐ': 'ぎ', 'す': 'し',
  'つ': 'ち', 'ぬ': 'に', 'ぶ': 'び', 'む': 'み', 'る': 'り',
};

// e-stem (potential): う→え, く→け, ぐ→げ, す→せ, つ→て, ぬ→ね, ぶ→べ, む→め, る→れ
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

// ── て/た euphony (ENGINE_SPEC §"て / た euphony") ────────────────────────────
// HARD-CODE: 行く (いく) → いった, NOT いいた. Single godan exception.
function godanTaForm(kana: string): string {
  if (kana === 'いく') return 'いった'; // 行く hard-coded exception
  const last = kana.slice(-1);
  const base = kana.slice(0, -1);
  switch (last) {
    case 'う': case 'つ': case 'る': return base + 'った';
    case 'む': case 'ぶ': case 'ぬ': return base + 'んだ';
    case 'く': return base + 'いた';
    case 'ぐ': return base + 'いだ';
    case 'す': return base + 'した';
    default: throw new Error(`godanTaForm: unknown ending '${last}' in '${kana}'`);
  }
}

// ── Layer transforms ──────────────────────────────────────────────────────────
// All return the new kana; the caller sets klass='ichidan' after causative/passive/potential.

// Causative: godan→aStem+せる; ichidan→dropRu+させる; suru→させる; kuru→こさせる
function applyCausative(kana: string, klass: VClass): string {
  switch (klass) {
    case 'godan':   return godanStem(kana, GODAN_A) + 'せる';
    case 'ichidan': return dropRu(kana) + 'させる';
    case 'suru':    return 'させる';
    case 'kuru':    return 'こさせる';
  }
}

// Passive: godan→aStem+れる; ichidan→dropRu+られる; suru→される; kuru→こられる
function applyPassive(kana: string, klass: VClass): string {
  switch (klass) {
    case 'godan':   return godanStem(kana, GODAN_A) + 'れる';
    case 'ichidan': return dropRu(kana) + 'られる';
    case 'suru':    return 'される';
    case 'kuru':    return 'こられる';
  }
}

// Potential: godan→eStem+る; ichidan→dropRu+られる (formal ら-form); suru→できる; kuru→こられる
// Note: ichidan potential = ichidan passive surface (食べられる) — homophony.
// Godan diverges: potential 飲める vs passive 飲まれる.
function applyPotential(kana: string, klass: VClass): string {
  switch (klass) {
    case 'godan':   return godanStem(kana, GODAN_E) + 'る';
    case 'ichidan': return dropRu(kana) + 'られる';
    case 'suru':    return 'できる';
    case 'kuru':    return 'こられる';
  }
}

// Polite: godan→iStem+ます; ichidan→dropRu+ます; suru→します; kuru→きます
// After causative/voice, klass is already 'ichidan', so ichidan rule applies automatically.
function applyPolite(kana: string, klass: VClass): string {
  switch (klass) {
    case 'godan':   return godanStem(kana, GODAN_I) + 'ます';
    case 'ichidan': return dropRu(kana) + 'ます';
    case 'suru':    return 'します';
    case 'kuru':    return 'きます';
  }
}

// Negative: if polite → replace ます(2 chars) with ません; else godan/ichidan/suru/kuru rules.
function applyNegative(kana: string, klass: VClass, isPolite: boolean): string {
  if (isPolite) return kana.slice(0, -2) + 'ません'; // ます → ません
  switch (klass) {
    case 'godan':   return godanStem(kana, GODAN_A) + 'ない';
    case 'ichidan': return dropRu(kana) + 'ない';
    case 'suru':    return 'しない';
    case 'kuru':    return 'こない';
  }
}

// Past: four cells from the polite×negative grid (ENGINE_SPEC §"Past tier").
// plain aff = ta-form; plain neg = ない→なかった;
// polite aff = ます→ました; polite neg = ません→ませんでした.
function applyPast(kana: string, klass: VClass, isPolite: boolean, isNeg: boolean): string {
  if (isPolite && isNeg)  return kana.slice(0, -3) + 'ませんでした'; // ません(3) → ませんでした
  if (isPolite && !isNeg) return kana.slice(0, -2) + 'ました';       // ます(2) → ました
  if (!isPolite && isNeg) return kana.slice(0, -2) + 'なかった';     // ない(2) → なかった
  // plain affirmative: ta-form via euphony table
  switch (klass) {
    case 'godan':   return godanTaForm(kana);
    case 'ichidan': return dropRu(kana) + 'た';
    case 'suru':    return 'した';
    case 'kuru':    return 'きた';
  }
}

// ── Kana → Rōmaji (Hepburn-ish) ──────────────────────────────────────────────
// Handle っ (sokuon: double next consonant) and ん.
// Golden outputs: nomu, nomaserarenakatta, itta, kawanai, kosaseru, dekiru, kimasu, oyoida.

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
  // digraphs (for completeness; these verb forms don't produce them but spec says include)
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

export function kanaToRomaji(kana: string): string {
  const chars = Array.from(kana); // proper Unicode split
  let out = '';
  let i = 0;
  while (i < chars.length) {
    const c = chars[i];
    if (c === 'っ') {
      // Sokuon: double the first consonant of the following mora's romaji
      if (i + 1 < chars.length) {
        // Try digraph first
        const two = chars[i + 1] + (chars[i + 2] ?? '');
        const r = KANA_ROM[two] ?? KANA_ROM[chars[i + 1]] ?? '';
        if (r.length > 0) out += r[0];
      }
      i++;
    } else if (c === 'ん') {
      out += 'n';
      i++;
    } else {
      // Try two-char digraph first
      const two = c + (chars[i + 1] ?? '');
      if (KANA_ROM[two] !== undefined) {
        out += KANA_ROM[two];
        i += 2;
      } else {
        out += KANA_ROM[c] ?? c;
        i++;
      }
    }
  }
  return out;
}

// ── Highlight helper ──────────────────────────────────────────────────────────
// Returns [lcpLen, str.length] — the range of str that differs from prev.
function highlightRange(prev: string, curr: string): [number, number] {
  let i = 0;
  const min = Math.min(prev.length, curr.length);
  while (i < min && prev[i] === curr[i]) i++;
  return [i, curr.length];
}

// ── Gloss builder ─────────────────────────────────────────────────────────────
function buildGloss(
  core: string,
  isPolite: boolean,
  isNeg: boolean,
  isPast: boolean,
): string {
  let g = core;
  if (isNeg && isPast) {
    // "be X" → "was not X"; otherwise "didn't X"
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

// ── Main export ───────────────────────────────────────────────────────────────

export function buildTower(
  verb: Verb,
  opts: {
    causative: boolean;
    voice: 'none' | 'passive' | 'potential';
    polite: boolean;
    negative: boolean;
    past: boolean;
  },
): Tier[] {
  const tiers: Tier[] = [];

  let kana = verb.kana;
  let klass: VClass = verb.klass;
  // coreGloss accumulates through causative/voice layers only
  let coreGloss = verb.gloss;
  let politeApplied = false;
  let negApplied = false;
  // Track whether causative preceded voice (for passive gloss)
  let causApplied = false;

  // kanji surface: kanjiPrefix + conjugatedKana.slice(prefixLen)
  const splice = (k: string) => verb.kanjiPrefix + k.slice(verb.prefixLen);

  const push = (
    layer: Tier['layer'],
    newKana: string,
    label: string,
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
      gloss:   buildGloss(coreGloss, isPolite, isNeg, isPast),
      hlKana:  layer === 'base' ? [0, 0] : highlightRange(prevKana, newKana),
      hlKanji: layer === 'base' ? [0, 0] : highlightRange(prevKanji, newKanji),
    });
  };

  // BASE
  push('base', kana, 'base', false, false, false);

  // CAUSATIVE
  if (opts.causative) {
    kana = applyCausative(kana, klass);
    klass = 'ichidan';
    causApplied = true;
    coreGloss = 'make/let ' + verb.gloss;
    push('causative', kana, 'causative (-させる/-せる)', false, false, false);
  }

  // VOICE (passive XOR potential — one slot)
  if (opts.voice === 'passive') {
    kana = applyPassive(kana, klass);
    klass = 'ichidan';
    coreGloss = causApplied ? 'be made to ' + verb.gloss : 'be ' + verb.gloss;
    push('passive', kana, 'passive (-られる/-れる)', false, false, false);
  } else if (opts.voice === 'potential') {
    kana = applyPotential(kana, klass);
    klass = 'ichidan';
    coreGloss = 'can ' + verb.gloss;
    push('potential', kana, 'potential (-える/-られる)', false, false, false);
  }

  // POLITE — after voice; klass is ichidan if any voice layer ran
  if (opts.polite) {
    kana = applyPolite(kana, klass);
    politeApplied = true;
    push('polite', kana, 'polite (-ます)', true, false, false);
  }

  // NEGATIVE — outer tense/polarity block
  if (opts.negative) {
    kana = applyNegative(kana, klass, politeApplied);
    negApplied = true;
    push('negative', kana, 'negative (-ない/-ません)', politeApplied, true, false);
  }

  // PAST
  if (opts.past) {
    kana = applyPast(kana, klass, politeApplied, negApplied);
    push('past', kana, 'past (-た/-ました)', politeApplied, negApplied, true);
  }

  return tiers;
}
