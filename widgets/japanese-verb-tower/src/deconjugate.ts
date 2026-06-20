import { makeVerb, buildTower } from './engine';
import { romajiToKana, hasJapanese } from './romaji';
import type { DictEntry, Verb } from './morph';
import type { OpId } from './types';

export interface DeconjCorpus {
  byReading: Map<string, DictEntry[]>;
  byKanji: Map<string, DictEntry[]>;
}

export function buildCorpus(entries: DictEntry[]): DeconjCorpus {
  const byReading = new Map<string, DictEntry[]>();
  const byKanji = new Map<string, DictEntry[]>();
  for (const e of entries) {
    const rArr = byReading.get(e.r);
    if (rArr) rArr.push(e); else byReading.set(e.r, [e]);
    const kArr = byKanji.get(e.k);
    if (kArr) kArr.push(e); else byKanji.set(e.k, [e]);
  }
  return { byReading, byKanji };
}

export interface Parse {
  base: DictEntry;
  verb: Verb;
  ops: OpId[];
  kana: string;
  kanji: string;
  score: number;
}

// ── Stem inverse maps ────────────────────────────────────────────────────────
const GODAN_I_INV: Record<string, string> = {
  り: 'る', み: 'む', き: 'く', ぎ: 'ぐ', し: 'す',
  ち: 'つ', に: 'ぬ', び: 'ぶ', い: 'う',
};
const GODAN_A_INV: Record<string, string> = {
  わ: 'う', か: 'く', が: 'ぐ', さ: 'す', た: 'つ',
  な: 'ぬ', ば: 'ぶ', ま: 'む', ら: 'る',
};
const GODAN_E_INV: Record<string, string> = {
  え: 'う', け: 'く', げ: 'ぐ', せ: 'す', て: 'つ',
  ね: 'ぬ', べ: 'ぶ', め: 'む', れ: 'る',
};
const GODAN_O_INV: Record<string, string> = {
  お: 'う', こ: 'く', ご: 'ぐ', そ: 'す', と: 'つ',
  の: 'ぬ', ぼ: 'ぶ', も: 'む', ろ: 'る',
};

function fromIStem(stem: string): string[] {
  const res: string[] = [];
  const last = stem.slice(-1);
  if (GODAN_I_INV[last]) res.push(stem.slice(0, -1) + GODAN_I_INV[last]);
  res.push(stem + 'る');
  if (stem.endsWith('し')) {
    res.push(stem.slice(0, -1) + 'する');
  }
  if (stem === 'し') res.push('する');
  if (stem.endsWith('き')) {
    res.push(stem.slice(0, -1) + 'くる');
  }
  return res;
}

function fromAStem(astem: string): string[] {
  const res: string[] = [];
  const last = astem.slice(-1);
  if (GODAN_A_INV[last]) res.push(astem.slice(0, -1) + GODAN_A_INV[last]);
  res.push(astem + 'る');
  if (astem.endsWith('さ')) res.push(astem.slice(0, -1) + 'する');
  if (astem.endsWith('こ')) res.push(astem.slice(0, -1) + 'くる');
  if (astem === 'こ') res.push('くる');
  return res;
}

// ── invertTe: te/de-form string → candidate dict forms ──────────────────────
function invertTe(teStr: string): string[] {
  const res: string[] = [];
  if (teStr.endsWith('って')) {
    const b = teStr.slice(0, -2);
    res.push(b + 'う', b + 'つ', b + 'る', b + 'く'); // く for godan-iku
  } else if (teStr.endsWith('んで')) {
    const b = teStr.slice(0, -2);
    res.push(b + 'む', b + 'ぶ', b + 'ぬ');
  } else if (teStr.endsWith('いて')) {
    const b = teStr.slice(0, -2);
    res.push(b + 'く');
    // Also ichidan: stem ends in い, te=stem+て
    // e.g. 居る(いる): te=いて → stem=い, dict=いる
    res.push(b + 'いる');
  } else if (teStr.endsWith('いで')) {
    const b = teStr.slice(0, -2);
    res.push(b + 'ぐ');
  } else if (teStr.endsWith('して')) {
    const prefix = teStr.slice(0, -2);
    res.push(prefix + 'す', prefix + 'する');
  } else if (teStr.endsWith('きて')) {
    const prefix = teStr.slice(0, -2);
    res.push(prefix + 'くる');
  } else if (teStr.endsWith('くて')) {
    const adjStem = teStr.slice(0, -2);
    res.push(adjStem + 'い');
  } else if (teStr.endsWith('うて')) {
    const b = teStr.slice(0, -2);
    res.push(b + 'う');
  } else if (teStr.endsWith('て')) {
    const stem = teStr.slice(0, -1);
    res.push(stem + 'る'); // ichidan
  } else if (teStr.endsWith('で')) {
    // residual de form (shouldn't normally appear standalone but handle gracefully)
    const stem = teStr.slice(0, -1);
    res.push(stem + 'る');
  }
  return res;
}

type Candidate = { innerForm: string; op: OpId };

// ── invertAll: main reverse-rule table ──────────────────────────────────────
function invertAll(cur: string): Candidate[] {
  const out: Candidate[] = [];
  function add(innerForm: string, op: OpId) {
    if (innerForm) out.push({ innerForm, op });
  }
  function addMany(forms: string[], op: OpId) {
    for (const f of forms) add(f, op);
  }

  // ── Polite paradigm (check before generic past/negative to avoid shorter matches) ──

  if (cur.endsWith('ませんでした')) {
    const stem = cur.slice(0, -6);
    add(stem + 'ません', 'past');
  }
  if (cur.endsWith('ましょう')) {
    const stem = cur.slice(0, -4);
    add(stem + 'ます', 'volitional');
  }
  if (cur.endsWith('ましたら')) {
    const stem = cur.slice(0, -4);
    add(stem + 'ます', 'tara');
  }
  if (cur.endsWith('ました')) {
    const stem = cur.slice(0, -3);
    add(stem + 'ます', 'past');
  }
  if (cur.endsWith('ません')) {
    const stem = cur.slice(0, -3);
    add(stem + 'ます', 'negative');
  }

  // ── Causative-passive (before causative/passive to avoid shorter matches) ──

  if (cur.endsWith('こさせられる')) {
    add(cur.slice(0, -6) + 'くる', 'causative-passive');
  }
  if (cur.endsWith('させられる')) {
    const stem = cur.slice(0, -5);
    add(stem + 'る', 'causative-passive');
    if (stem.endsWith('し')) add(stem.slice(0, -1) + 'する', 'causative-passive');
  }
  if (cur.endsWith('せられる')) {
    const astem = cur.slice(0, -4);
    addMany(fromAStem(astem), 'causative-passive');
  }

  // ── Causative ────────────────────────────────────────────────────────────

  if (cur.endsWith('こさせる')) {
    add(cur.slice(0, -4) + 'くる', 'causative');
  }
  if (cur.endsWith('させる') && !cur.endsWith('こさせる')) {
    const stem = cur.slice(0, -3);
    add(stem + 'る', 'causative');
    if (stem.endsWith('し')) add(stem.slice(0, -1) + 'する', 'causative');
  }
  if (cur.endsWith('せる') && !cur.endsWith('させる')) {
    const astem = cur.slice(0, -2);
    addMany(fromAStem(astem), 'causative');
  }

  // ── Passive ──────────────────────────────────────────────────────────────

  if (cur.endsWith('こられる')) {
    const prefix = cur.slice(0, -4);
    add(prefix + 'くる', 'passive');
    add(prefix + 'くる', 'potential');
  }
  if (cur.endsWith('られる') && !cur.endsWith('こられる')) {
    const stem = cur.slice(0, -3);
    add(stem + 'る', 'passive');
    add(stem + 'る', 'potential');
  }
  if (cur.endsWith('される')) {
    const prefix = cur.slice(0, -3);
    add(prefix + 'する', 'passive');
    add(prefix + 'する', 'causative-passive');
    // also godan a-stem + される (causative-passive of godan non-す)
    const astem = cur.slice(0, -3);
    addMany(fromAStem(astem), 'causative-passive');
  }
  if (cur.endsWith('れる') && !cur.endsWith('られる') && !cur.endsWith('される')) {
    const astem = cur.slice(0, -2);
    addMany(fromAStem(astem), 'passive');
  }

  // ── Potential ────────────────────────────────────────────────────────────

  if (cur.endsWith('できる')) {
    add(cur.slice(0, -3) + 'する', 'potential');
  }
  // godan potential: e-stem + る
  if (cur.endsWith('る')) {
    const estem = cur.slice(0, -1);
    if (estem.length > 0) {
      const last = estem.slice(-1);
      if (GODAN_E_INV[last]) {
        add(estem.slice(0, -1) + GODAN_E_INV[last], 'potential');
      }
    }
  }

  // ── Negative-past (before negative to avoid shorter match) ───────────────

  if (cur.endsWith('しなかった')) {
    const prefix = cur.slice(0, -5);
    add(prefix + 'する', 'negative-past');
    add(prefix + 'す', 'negative-past');
  }
  if (cur.endsWith('こなかった')) {
    add(cur.slice(0, -5) + 'くる', 'negative-past');
  }
  if (cur.endsWith('くなかった')) {
    add(cur.slice(0, -5) + 'い', 'negative-past');
  }
  if (cur === 'なかった') {
    add('ある', 'negative-past');
  }
  if (cur.endsWith('なかった') && cur !== 'なかった') {
    const astem = cur.slice(0, -4);
    addMany(fromAStem(astem), 'negative-past');
    // also ichidan: strip ない+かった? No: aStems ichidan = dropRu+ない → strip なかった = astem=dropRu → add る
    add(astem + 'る', 'negative-past');
  }

  // ── Negative ─────────────────────────────────────────────────────────────

  if (cur.endsWith('しない')) {
    const prefix = cur.slice(0, -3);
    add(prefix + 'する', 'negative');
    add(prefix + 'す', 'negative');
  }
  if (cur.endsWith('こない')) {
    add(cur.slice(0, -3) + 'くる', 'negative');
  }
  if (cur.endsWith('くない')) {
    add(cur.slice(0, -3) + 'い', 'negative');
  }
  if (cur === 'ない') {
    add('ある', 'negative');
  }
  if (cur.endsWith('ない') && cur !== 'ない' && !cur.endsWith('しない') && !cur.endsWith('こない') && !cur.endsWith('くない')) {
    const astem = cur.slice(0, -2);
    addMany(fromAStem(astem), 'negative');
    add(astem + 'る', 'negative'); // ichidan
  }

  // ── Must / Must-not ──────────────────────────────────────────────────────

  if (cur.endsWith('なければならない')) {
    const astem = cur.slice(0, -8);
    addMany(fromAStem(astem), 'must');
    if (astem.endsWith('し')) add(astem.slice(0, -1) + 'する', 'must');
    if (astem.endsWith('く')) add(astem.slice(0, -1) + 'い', 'must');
  }
  if (cur.endsWith('はいけない')) {
    const teStr = cur.slice(0, -5);
    const last = teStr.slice(-1);
    if (last === 'て' || last === 'で') for (const d of invertTe(teStr)) add(d, 'must-not');
  }
  if (cur.endsWith('ならなかった')) add(cur.slice(0, -4) + 'ない', 'past');
  if (cur.endsWith('いけなかった')) add(cur.slice(0, -4) + 'ない', 'past');
  if (cur.endsWith('なりません')) add(cur.slice(0, -5) + 'ならない', 'polite');
  if (cur.endsWith('いけません')) add(cur.slice(0, -5) + 'いけない', 'polite');

  // ── Past ─────────────────────────────────────────────────────────────────

  if (cur.endsWith('した')) {
    const prefix = cur.slice(0, -2);
    add(prefix + 'する', 'past');
    add(prefix + 'す', 'past');
  }
  if (cur.endsWith('きた') && !cur.endsWith('かった') && !cur.endsWith('いきた')) {
    add(cur.slice(0, -2) + 'くる', 'past');
  }
  if (cur.endsWith('った')) {
    const b = cur.slice(0, -2);
    add(b + 'う', 'past');
    add(b + 'つ', 'past');
    add(b + 'る', 'past');
    add(b + 'く', 'past'); // godan-iku
  }
  if (cur.endsWith('んだ')) {
    const b = cur.slice(0, -2);
    add(b + 'む', 'past');
    add(b + 'ぶ', 'past');
    add(b + 'ぬ', 'past');
  }
  if (cur.endsWith('いた') && !cur.endsWith('かいた')) {
    const b = cur.slice(0, -2);
    add(b + 'く', 'past');
    // ichidan: stem=cur.slice(0,-1)=?い, dict=?いる
    add(cur.slice(0, -1) + 'る', 'past');
  }
  if (cur.endsWith('いだ')) {
    const b = cur.slice(0, -2);
    add(b + 'ぐ', 'past');
  }
  if (cur.endsWith('うた')) {
    const b = cur.slice(0, -2);
    add(b + 'う', 'past'); // godan-u-s
  }
  if (cur.endsWith('かった')) {
    // i-adjective past: adjStem + かった
    add(cur.slice(0, -3) + 'い', 'past');
  }
  // ichidan past: stem + た
  if (cur.endsWith('た') && !cur.endsWith('した') && !cur.endsWith('きた') &&
      !cur.endsWith('った') && !cur.endsWith('いた') && !cur.endsWith('うた') &&
      !cur.endsWith('かった')) {
    add(cur.slice(0, -1) + 'る', 'past');
  }

  // ── Te form ──────────────────────────────────────────────────────────────

  if (cur.endsWith('して') && !cur.endsWith('くして')) {
    const prefix = cur.slice(0, -2);
    add(prefix + 'する', 'te');
    add(prefix + 'す', 'te');
  }
  if (cur.endsWith('きて') && !cur.endsWith('いきて')) {
    add(cur.slice(0, -2) + 'くる', 'te');
  }
  if (cur.endsWith('って')) {
    const b = cur.slice(0, -2);
    add(b + 'う', 'te');
    add(b + 'つ', 'te');
    add(b + 'る', 'te');
    add(b + 'く', 'te'); // godan-iku
  }
  if (cur.endsWith('んで')) {
    const b = cur.slice(0, -2);
    add(b + 'む', 'te');
    add(b + 'ぶ', 'te');
    add(b + 'ぬ', 'te');
  }
  if (cur.endsWith('いて') && !cur.endsWith('して')) {
    const b = cur.slice(0, -2);
    add(b + 'く', 'te');
    add(cur.slice(0, -1) + 'る', 'te'); // ichidan with stem ending in い
  }
  if (cur.endsWith('いで')) {
    add(cur.slice(0, -2) + 'ぐ', 'te');
  }
  if (cur.endsWith('うて')) {
    add(cur.slice(0, -2) + 'う', 'te'); // godan-u-s
  }
  if (cur.endsWith('くて')) {
    add(cur.slice(0, -2) + 'い', 'te'); // i-adj adjStem+く+て
  }
  if (cur.endsWith('て') && !cur.endsWith('して') && !cur.endsWith('きて') &&
      !cur.endsWith('って') && !cur.endsWith('いて') && !cur.endsWith('うて') &&
      !cur.endsWith('くて')) {
    add(cur.slice(0, -1) + 'る', 'te'); // ichidan
  }

  // ── Polite ───────────────────────────────────────────────────────────────

  if (cur.endsWith('します')) {
    add(cur.slice(0, -3) + 'する', 'polite');
  }
  if (cur.endsWith('きます')) {
    add(cur.slice(0, -3) + 'くる', 'polite');
  }
  if (cur.endsWith('います')) {
    // godan-aru: b.slice(0,-1)+います; also fromIStem for regular godan
    const istem = cur.slice(0, -3) + 'い'; // this is the i-stem for godan-aru
    // The base would be: istem.slice(0,-1) + 'る' (treating い as part of stem)
    // Actually: aruPolite godan: kana=b, polite=b.slice(0,-1)+います
    // so b.slice(0,-1) = cur.slice(0,-3); b = cur.slice(0,-3)+'る'
    add(cur.slice(0, -3) + 'る', 'polite'); // godan-aru
    addMany(fromIStem(cur.slice(0, -2)), 'polite'); // regular: strip ます, get i-stem
  }
  if (cur.endsWith('ます') && !cur.endsWith('します') && !cur.endsWith('きます') && !cur.endsWith('います')) {
    const istem = cur.slice(0, -2);
    addMany(fromIStem(istem), 'polite');
  }
  if (cur.endsWith('です')) {
    // i-adj/na-adj polite: kana + です
    const kana = cur.slice(0, -2);
    add(kana, 'polite');
  }

  // ── Tai ──────────────────────────────────────────────────────────────────

  if (cur.endsWith('たい')) {
    addMany(fromIStem(cur.slice(0, -2)), 'tai');
  }

  // ── Tagaru ───────────────────────────────────────────────────────────────

  if (cur.endsWith('たがる')) {
    addMany(fromIStem(cur.slice(0, -3)), 'tagaru');
  }

  // ── Yasui ────────────────────────────────────────────────────────────────

  if (cur.endsWith('やすい')) {
    addMany(fromIStem(cur.slice(0, -3)), 'yasui');
  }

  // ── Nikui ────────────────────────────────────────────────────────────────

  if (cur.endsWith('にくい')) {
    addMany(fromIStem(cur.slice(0, -3)), 'nikui');
  }

  // ── Naosu ────────────────────────────────────────────────────────────────

  if (cur.endsWith('なおす')) {
    addMany(fromIStem(cur.slice(0, -3)), 'naosu');
  }

  // ── Compound (phase) ──────────────────────────────────────────────────────

  if (cur.endsWith('はじめる')) addMany(fromIStem(cur.slice(0, -4)), 'hajimeru');
  if (cur.endsWith('おわる'))   addMany(fromIStem(cur.slice(0, -3)), 'owaru');
  if (cur.endsWith('つづける')) addMany(fromIStem(cur.slice(0, -4)), 'tsuzukeru');
  if (cur.endsWith('だす'))     addMany(fromIStem(cur.slice(0, -2)), 'dasu');

  // ── Sugiru ───────────────────────────────────────────────────────────────

  if (cur.endsWith('すぎる')) {
    const stem = cur.slice(0, -3);
    addMany(fromIStem(stem), 'sugiru');
    add(stem + 'い', 'sugiru'); // i-adj: adjStem + すぎる
  }

  // ── Sou ──────────────────────────────────────────────────────────────────

  if (cur.endsWith('そう')) {
    const stem = cur.slice(0, -2);
    addMany(fromIStem(stem), 'sou');
    add(stem + 'い', 'sou'); // i-adj: kana.slice(0,-1)+そう
    // iiAdj special: よさそう → いい/よい
    if (stem.endsWith('よさ')) {
      add('いい', 'sou');
      add('よい', 'sou');
    }
    // ない special: なさそう → ない
    if (stem.endsWith('なさ')) {
      add(stem.slice(0, -2) + 'ない', 'sou');
    }
  }

  // ── Naru ─────────────────────────────────────────────────────────────────

  if (cur.endsWith('くなる')) {
    const adjStem = cur.slice(0, -3);
    add(adjStem + 'い', 'naru');
  }
  if (cur.endsWith('になる')) {
    add(cur.slice(0, -3), 'naru');
  }
  if (cur.endsWith('なる') && !cur.endsWith('くなる') && !cur.endsWith('になる')) {
    // adverbial (ends in く) + なる → strip なる → adverbial form
    add(cur.slice(0, -2), 'naru');
  }

  // ── Adverbial ─────────────────────────────────────────────────────────────

  if (cur.endsWith('く') && cur.length > 1) {
    add(cur.slice(0, -1) + 'い', 'adverbial');
  }

  // ── Volitional ────────────────────────────────────────────────────────────

  if (cur.endsWith('しよう')) {
    add(cur.slice(0, -3) + 'する', 'volitional');
  }
  if (cur.endsWith('こよう')) {
    add(cur.slice(0, -3) + 'くる', 'volitional');
  }
  if (cur.endsWith('よう') && !cur.endsWith('しよう') && !cur.endsWith('こよう')) {
    add(cur.slice(0, -2) + 'る', 'volitional'); // ichidan
  }
  // godan volitional: o-stem + う
  if (cur.endsWith('う') && cur.length > 1) {
    const ostem = cur.slice(0, -1);
    const last = ostem.slice(-1);
    if (GODAN_O_INV[last]) {
      add(ostem.slice(0, -1) + GODAN_O_INV[last], 'volitional');
    }
  }

  // ── Imperative ───────────────────────────────────────────────────────────

  if (cur.endsWith('しろ')) {
    add(cur.slice(0, -2) + 'する', 'imperative');
  }
  if (cur.endsWith('こい')) {
    add(cur.slice(0, -2) + 'くる', 'imperative');
  }
  if (cur.endsWith('ろ')) {
    add(cur.slice(0, -1) + 'る', 'imperative'); // ichidan
  }
  // godan: bare e-stem (last char is e-row)
  {
    const last = cur.slice(-1);
    if (GODAN_E_INV[last]) {
      add(cur.slice(0, -1) + GODAN_E_INV[last], 'imperative');
    }
  }

  // ── Ba ───────────────────────────────────────────────────────────────────

  if (cur.endsWith('ければ')) {
    add(cur.slice(0, -3) + 'い', 'ba'); // i-adj
  }
  if (cur.endsWith('すれば')) {
    add(cur.slice(0, -3) + 'する', 'ba');
  }
  if (cur.endsWith('くれば')) {
    add(cur.slice(0, -3) + 'くる', 'ba');
  }
  if (cur.endsWith('れば') && !cur.endsWith('すれば') && !cur.endsWith('くれば')) {
    const stem = cur.slice(0, -2);
    add(stem + 'る', 'ba'); // ichidan + godan-r (both give stem+'る')
  }
  if (cur.endsWith('ば') && !cur.endsWith('れば') && !cur.endsWith('ければ')) {
    const estem = cur.slice(0, -1);
    const last = estem.slice(-1);
    if (GODAN_E_INV[last]) {
      add(estem.slice(0, -1) + GODAN_E_INV[last], 'ba');
    }
  }

  // ── Tara (tara = ta-form + ら, strip full ta-form suffix plus ら) ────────

  if (cur.endsWith('かったら')) {
    add(cur.slice(0, -4) + 'い', 'tara'); // i-adj
  }
  if (cur.endsWith('したら')) {
    const prefix = cur.slice(0, -3);
    add(prefix + 'する', 'tara');
    add(prefix + 'す', 'tara');
  }
  if (cur.endsWith('きたら') && !cur.endsWith('いきたら')) {
    add(cur.slice(0, -3) + 'くる', 'tara');
  }
  if (cur.endsWith('ったら')) {
    const b = cur.slice(0, -3);
    add(b + 'う', 'tara');
    add(b + 'つ', 'tara');
    add(b + 'る', 'tara');
    add(b + 'く', 'tara'); // godan-iku: 行ったら
  }
  if (cur.endsWith('んだら')) {
    const b = cur.slice(0, -3);
    add(b + 'む', 'tara');
    add(b + 'ぶ', 'tara');
    add(b + 'ぬ', 'tara');
  }
  if (cur.endsWith('いたら')) {
    const b = cur.slice(0, -3);
    add(b + 'く', 'tara');
    add(cur.slice(0, -2) + 'る', 'tara'); // ichidan stem ending in い
  }
  if (cur.endsWith('いだら')) {
    add(cur.slice(0, -3) + 'ぐ', 'tara');
  }
  if (cur.endsWith('うたら')) {
    add(cur.slice(0, -3) + 'う', 'tara'); // godan-u-s
  }
  // ichidan: stem+たら → strip たら, add る
  if (cur.endsWith('たら') &&
      !cur.endsWith('かったら') && !cur.endsWith('したら') && !cur.endsWith('きたら') &&
      !cur.endsWith('ったら') && !cur.endsWith('いたら') && !cur.endsWith('うたら') &&
      !cur.endsWith('ましたら')) {
    add(cur.slice(0, -2) + 'る', 'tara'); // ichidan
  }

  // ── Te-aux ops ────────────────────────────────────────────────────────────

  function teAux(suffix: string, op: OpId, teOverride?: string) {
    if (!cur.endsWith(suffix)) return;
    const teStr = teOverride ?? (cur.slice(0, -suffix.length));
    if (!teStr) return;
    // Only process if te-form plausibly ends in て or で
    const lastTe = teStr.slice(-1);
    if (lastTe !== 'て' && lastTe !== 'で') return;
    const dicts = invertTe(teStr);
    for (const d of dicts) add(d, op);
  }

  teAux('いる', 'te-iru');
  // te-kuru and te-iku: strip suffix then check
  if (cur.endsWith('くる')) {
    const teStr = cur.slice(0, -2);
    const last = teStr.slice(-1);
    if (last === 'て' || last === 'で') {
      for (const d of invertTe(teStr)) add(d, 'te-kuru');
    }
  }
  if (cur.endsWith('いく')) {
    const teStr = cur.slice(0, -2);
    const last = teStr.slice(-1);
    if (last === 'て' || last === 'で') {
      for (const d of invertTe(teStr)) add(d, 'te-iku');
    }
  }
  teAux('しまう', 'te-shimau');
  // te-oku: おく guard
  if (cur.endsWith('おく')) {
    const teStr = cur.slice(0, -2);
    const last = teStr.slice(-1);
    if (last === 'て' || last === 'で') {
      for (const d of invertTe(teStr)) add(d, 'te-oku');
    }
  }
  // te-aru: ある guard
  if (cur.endsWith('ある')) {
    const teStr = cur.slice(0, -2);
    const last = teStr.slice(-1);
    if (last === 'て' || last === 'で') {
      for (const d of invertTe(teStr)) add(d, 'te-aru');
    }
  }
  // te-shimau-colloq: ちゃう → te-form ends in て; じゃう → ends in で
  if (cur.endsWith('ちゃう')) {
    const teStr = cur.slice(0, -3) + 'て';
    for (const d of invertTe(teStr)) add(d, 'te-shimau-colloq');
  }
  if (cur.endsWith('じゃう')) {
    const teStr = cur.slice(0, -3) + 'で';
    for (const d of invertTe(teStr)) add(d, 'te-shimau-colloq');
  }

  return out;
}

// Module-level memoization for invertAll (pure function of input string).
// Persists across deconjugate() calls — safe because invertAll has no side effects.
const _invertAllCache = new Map<string, Candidate[]>();

function invertAllMemo(cur: string): Candidate[] {
  const cached = _invertAllCache.get(cur);
  if (cached !== undefined) return cached;
  const result = invertAll(cur);
  _invertAllCache.set(cur, result);
  return result;
}

// Expand colloquial て/でいる contraction at the end of a string.
// Matches only when て/で is not the first character (guards bare てる/でた/出る etc.).
// Examples: 食べてた→食べていた, 読んでた→読んでいた, 食べてます→食べています
function expandColloquialTeIru(s: string): string | null {
  const m = s.match(/([てで])(る|た|ます|ました|ません|ませんでした|なかった|ない)$/);
  if (!m) return null;
  const idx = s.length - m[0].length;
  if (idx <= 0) return null; // bare てる/でた/でる — untouched
  return s.slice(0, idx) + m[1] + 'い' + m[2];
}

function calcScore(base: DictEntry, ops: OpId[]): number {
  let s = 0;
  if (base.common) s += 4;
  s -= ops.length;
  if (ops.join(',') === 'negative-past') s += 1;
  if (ops.includes('te-shimau-colloq')) s -= 1;
  return s;
}

export function deconjugate(input: string, corpus: DeconjCorpus): Parse[] {
  const cur0 = hasJapanese(input) ? input : romajiToKana(input);

  const results: Parse[] = [];
  const seen = new Set<string>();

  // Node-count budget: abort expansion if exceeded to prevent runaway search.
  // Warning is emitted at most once per deconjugate() call.
  const NODE_BUDGET = 300_000;
  let nodeCount = 0;
  let budgetWarned = false;

  function lookup(cur: string): DictEntry[] {
    const arr: DictEntry[] = [];
    const seen2 = new Set<string>();
    const byR = corpus.byReading.get(cur) ?? [];
    for (const e of byR) {
      const k = e.k + '\0' + e.r + '\0' + e.cls;
      if (!seen2.has(k)) { seen2.add(k); arr.push(e); }
    }
    const byK = corpus.byKanji.get(cur) ?? [];
    for (const e of byK) {
      const k = e.k + '\0' + e.r + '\0' + e.cls;
      if (!seen2.has(k)) { seen2.add(k); arr.push(e); }
    }
    return arr;
  }

  // verifyTarget: the surface string this terminal parse must reproduce.
  // pathSet: strings currently on the DFS stack (per-path cycle guard).
  function recurse(
    cur: string,
    opsOuter: OpId[],
    depth: number,
    verifyTarget: string,
    pathSet: Set<string>,
    scoreAdjust: number,
  ): void {
    // Per-path cycle guard: skip if this string is already on the current DFS path.
    // Stack-scoped: add before expanding, delete after, so the same intermediate
    // string reached via a DIFFERENT op branch is still explored.
    if (pathSet.has(cur)) return;

    nodeCount++;
    if (nodeCount > NODE_BUDGET) {
      if (!budgetWarned) {
        console.warn(`deconjugate: node budget (${NODE_BUDGET}) exceeded on input "${cur0}"; stopping expansion`);
        budgetWarned = true;
      }
      return;
    }

    // (a) Terminate: try to match cur as a dictionary base form
    const kanjiGivenLocal = /[一-龯]/.test(verifyTarget);
    for (const base of lookup(cur)) {
      let tiers;
      try { tiers = buildTower(makeVerb(base), opsOuter); } catch { continue; }
      const top = tiers[tiers.length - 1];
      const ok = kanjiGivenLocal ? top.kanji === verifyTarget : top.kana === verifyTarget;
      if (!ok) continue;
      const key = base.k + '\0' + base.r + '\0' + opsOuter.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        base, verb: makeVerb(base), ops: opsOuter,
        kana: top.kana, kanji: top.kanji,
        score: calcScore(base, opsOuter) + scoreAdjust,
      });
    }

    // (b) Expand: try stripping one more layer
    if (depth >= 14) return;

    pathSet.add(cur);
    for (const { innerForm, op } of invertAllMemo(cur)) {
      recurse(innerForm, [op, ...opsOuter], depth + 1, verifyTarget, pathSet, scoreAdjust);
    }
    pathSet.delete(cur);
  }

  // Pass 1: exact match on the normalized input
  recurse(cur0, [], 0, cur0, new Set(), 0);

  // Pass 2: colloquial て/でいる contraction fallback.
  // Expands e.g. 食べてた→食べていた, then searches for parses whose forward-
  // verified surface equals the EXPANDED form. Results are penalised by -3 so
  // they never outrank an exact pass-1 parse, and deduped (pass-1 keys win).
  const expanded = expandColloquialTeIru(cur0);
  if (expanded !== null && expanded !== cur0) {
    recurse(expanded, [], 0, expanded, new Set(), -3);
  }

  return results.sort((a, b) => b.score - a.score);
}
