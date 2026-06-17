// Pure morphology helpers — moved verbatim from engine.ts.
// No imports from other src/ files (zero dependency leaf).

export type VClass = 'godan' | 'ichidan' | 'suru' | 'kuru';

export interface DictEntry {
  k: string;
  r: string;
  romaji: string;
  cls: string;
  common: boolean;
  gloss: string;
}

export interface Verb {
  kanji: string;
  kana: string;
  romaji: string;
  klass: VClass;
  prefixLen: number;
  kanjiPrefix: string;
  gloss: string;
  stem?: string;
  euphony?: 'iku' | 'u-s';
  suruPrefix?: string;
  aruNeg?: boolean;
  aruPolite?: boolean;
  rawClass?: string;
}

export const KANA_RE = /[ぁ-ゖゝゞァ-ヺーヽヾ]/;

export function trailingKanaLen(s: string): number {
  let n = 0;
  for (let i = s.length - 1; i >= 0 && KANA_RE.test(s[i]); i--) n++;
  return n;
}

export function cleanGloss(g: string): string {
  if (!g) return '';
  let s = g.trim();
  s = s.replace(/^to\s+/i, '');
  s = s.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const cut = s.split(/[;,]/)[0].trim();
  return cut || s;
}

export function makeVerb(e: DictEntry): Verb {
  const okLen = trailingKanaLen(e.k);
  const kanjiPrefix = e.k.slice(0, e.k.length - okLen);
  const prefixLen = Math.max(0, e.r.length - okLen);

  const v: Verb = {
    kanji: e.k, kana: e.r, romaji: e.romaji,
    klass: 'godan', prefixLen, kanjiPrefix,
    gloss: cleanGloss(e.gloss), rawClass: e.cls,
  };

  switch (e.cls) {
    case 'ichidan': case 'ichidan-kureru': v.klass = 'ichidan'; break;
    case 'godan-u': case 'godan-k': case 'godan-g': case 'godan-s':
    case 'godan-t': case 'godan-n': case 'godan-b': case 'godan-m':
    case 'godan-r': v.klass = 'godan'; break;
    case 'godan-iku': v.klass = 'godan'; v.euphony = 'iku'; break;
    case 'godan-u-s': v.klass = 'godan'; v.euphony = 'u-s'; break;
    case 'godan-r-i': v.klass = 'godan'; v.aruNeg = true; break;
    case 'godan-aru': v.klass = 'godan'; v.aruPolite = true; break;
    case 'suru': case 'vs-i': v.klass = 'suru'; v.suruPrefix = ''; break;
    case 'suru-noun': v.klass = 'suru'; v.suruPrefix = e.r.replace(/する$/, ''); break;
    case 'suru-s': v.klass = 'godan'; v.stem = e.r.replace(/る$/, ''); break;
    case 'zuru': v.klass = 'ichidan'; v.stem = e.r.replace(/ずる$/, 'じる'); break;
    case 'kuru': v.klass = 'kuru'; break;
    default: v.klass = 'godan'; break;
  }
  return v;
}

export const GODAN_A: Record<string, string> = {
  'う': 'わ', 'く': 'か', 'ぐ': 'が', 'す': 'さ',
  'つ': 'た', 'ぬ': 'な', 'ぶ': 'ば', 'む': 'ま', 'る': 'ら',
};
export const GODAN_I: Record<string, string> = {
  'う': 'い', 'く': 'き', 'ぐ': 'ぎ', 'す': 'し',
  'つ': 'ち', 'ぬ': 'に', 'ぶ': 'び', 'む': 'み', 'る': 'り',
};
export const GODAN_E: Record<string, string> = {
  'う': 'え', 'く': 'け', 'ぐ': 'げ', 'す': 'せ',
  'つ': 'て', 'ぬ': 'ね', 'ぶ': 'べ', 'む': 'め', 'る': 'れ',
};

export function godanStem(kana: string, table: Record<string, string>): string {
  const last = kana.slice(-1);
  const s = table[last];
  if (s === undefined) throw new Error(`godanStem: no entry for '${last}' in '${kana}'`);
  return kana.slice(0, -1) + s;
}

export function dropRu(kana: string): string { return kana.slice(0, -1); }

export function godanTaForm(kana: string, euphony?: 'iku' | 'u-s'): string {
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

export const KANA_ROM: Record<string, string> = {
  'あ':'a','い':'i','う':'u','え':'e','お':'o',
  'か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko',
  'さ':'sa','し':'shi','す':'su','せ':'se','そ':'so',
  'た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to',
  'な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no',
  'は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho',
  'ま':'ma','み':'mi','む':'mu','め':'me','も':'mo',
  'や':'ya','ゆ':'yu','よ':'yo',
  'ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro',
  'わ':'wa','を':'wo',
  'が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go',
  'ざ':'za','じ':'ji','ず':'zu','ぜ':'ze','ぞ':'zo',
  'だ':'da','ぢ':'ji','づ':'zu','で':'de','ど':'do',
  'ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo',
  'ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po',
  'ゔ':'vu',
  'きゃ':'kya','きゅ':'kyu','きょ':'kyo',
  'しゃ':'sha','しゅ':'shu','しょ':'sho',
  'ちゃ':'cha','ちゅ':'chu','ちょ':'cho',
  'にゃ':'nya','にゅ':'nyu','にょ':'nyo',
  'ひゃ':'hya','ひゅ':'hyu','ひょ':'hyo',
  'みゃ':'mya','みゅ':'myu','みょ':'myo',
  'りゃ':'rya','りゅ':'ryu','りょ':'ryo',
  'ぎゃ':'gya','ぎゅ':'gyu','ぎょ':'gyo',
  'じゃ':'ja','じゅ':'ju','じょ':'jo',
  'びゃ':'bya','びゅ':'byu','びょ':'byo',
  'ぴゃ':'pya','ぴゅ':'pyu','ぴょ':'pyo',
};

export function kataToHira(s: string): string {
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
  let out = ''; let i = 0;
  while (i < chars.length) {
    const c = chars[i];
    if (c === 'っ') {
      if (i + 1 < chars.length) {
        const two = chars[i+1] + (chars[i+2] ?? '');
        const r = KANA_ROM[two] ?? KANA_ROM[chars[i+1]] ?? '';
        if (r.length > 0) out += r[0];
      }
      i++;
    } else if (c === 'ん') {
      out += 'n'; i++;
    } else {
      const two = c + (chars[i+1] ?? '');
      if (KANA_ROM[two] !== undefined) { out += KANA_ROM[two]; i += 2; }
      else { out += KANA_ROM[c] ?? c; i++; }
    }
  }
  return out;
}

export function highlightRange(prev: string, curr: string): [number, number] {
  let i = 0;
  const min = Math.min(prev.length, curr.length);
  while (i < min && prev[i] === curr[i]) i++;
  return [i, curr.length];
}

export const FEATURED_KANJI = ['飲む','話す','行く','買う','待つ','泳ぐ','食べる','帰る','する','来る'];
