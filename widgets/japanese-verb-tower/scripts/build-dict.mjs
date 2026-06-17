#!/usr/bin/env node
// prebake.mjs — download jmdict-simplified, parse, emit compact verb dictionary JSON.
//
// Usage:
//   node prebake.mjs [--variant=common|full] [--out=verbs.json] [--src=path/to/jmdict-eng.json]
//
// With no --src it downloads the latest scriptin/jmdict-simplified English release
// asset (the chosen --variant) to a temp file, extracts it, parses it, and writes a
// compact verb dictionary. With --src it parses a local already-extracted JSON file
// (skips download — useful in CI when the asset is cached).
//
// Output record schema (array of):
//   { k, r, romaji, cls, common, gloss }
//     k       canonical dictionary-form headword (kanji, or kana if kana-only; suru-nouns get する appended)
//     r       kana reading of the dictionary form
//     romaji  Hepburn-ish romaji of the reading (macron-free: ou, not ō) for search/sort
//     cls     conjugation class (see CLASS map below); godan carries its consonant column e.g. "godan-m"
//     common  true if JMdict marks the headword or reading common (news/ichi/spec/gai/nf priority)
//     gloss   first English gloss of the first sense (one short definition)
//
// Exit non-zero on hard failure. Writes progress to stderr.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// adj-i extraction: extracts JMdict adj-i entries into an adjectives output.
//
// The SHIPPED src/data/adjectives.sample.json is a CURATED COMMON SUBSET and
// is not produced by this script (JMdict source is not fetched in normal builds).
// To regenerate a full adjective set from JMdict, call buildAdjectives(words)
// and write the result to adjectives.full.json using the same pipeline as verbs.
//
// Adjective record schema (same shape as verb records):
//   { k, r, romaji, cls:"i-adjective", common, gloss }
// ----------------------------------------------------------------------------

function buildAdjectives(words) {
  const out = [];
  const seen = new Map();
  for (const w of words) {
    // Only include entries with adj-i PoS (plain い-adjective)
    const isAdjI = w.sense.some(s => s.partOfSpeech.includes('adj-i'));
    if (!isAdjI) continue;
    const kj = pickKanji(w);
    const kn = pickKana(w, kj && kj.text);
    if (!kn) continue;
    const k = kj ? kj.text : kn.text;
    const r = kn.text;
    const common = !!((kj && kj.common) || kn.common);
    const rec = { k, r, romaji: kanaToRomaji(r), cls: 'i-adjective', common, gloss: firstGloss(w) };
    const key = k + '|i-adjective';
    if (seen.has(key)) {
      const ex = out[seen.get(key)];
      if (common && !ex.common) out[seen.get(key)] = rec;
      continue;
    }
    seen.set(key, out.length);
    out.push(rec);
  }
  out.sort((a, b) => (b.common - a.common) || a.romaji.localeCompare(b.romaji));
  return out;
}

// PoS tag -> conjugation class. Covers ALL JMdict verb PoS.
// godan classes carry the final-consonant column (u/k/g/s/t/n/b/m/r).
// ----------------------------------------------------------------------------
const CLASS = {
  // ichidan
  'v1': 'ichidan',
  'v1-s': 'ichidan-kureru',       // くれる: special imperative くれ
  // godan, regular (consonant column embedded in the class name)
  'v5u': 'godan-u',
  'v5k': 'godan-k',
  'v5g': 'godan-g',
  'v5s': 'godan-s',
  'v5t': 'godan-t',
  'v5n': 'godan-n',
  'v5b': 'godan-b',
  'v5m': 'godan-m',
  'v5r': 'godan-r',
  // godan, special sub-classes
  'v5k-s': 'godan-iku',           // 行く/逝く: て-form 行って (not 行いて)
  'v5u-s': 'godan-u-s',           // 問う/請う: colloquial て-form 問うて
  'v5r-i': 'godan-r-i',           // ある: negative is ない, not あらない
  'v5aru': 'godan-aru',           // いらっしゃる/下さる: ます-stem ～い (いらっしゃいます)
  // suru family
  'vs-i': 'suru',                 // する and 〜する "included" irregulars
  'vs-s': 'suru-s',               // 愛する/察する: special -する class (愛さ / 愛し)
  'vs': 'suru-noun',              // noun + する  (headword gets する appended)
  // kuru
  'vk': 'kuru',                   // 来る
  // zuru -> suru-like (信ずる ≈ 信じる)
  'vz': 'zuru',                   // 〜ずる, conjugates like ich /suru hybrid; mapped suru-like
};
// PoS we explicitly EXCLUDE from the widget (classical / archaic / unusable):
//   v2* (nidan), v4* (yodan), vn (irregular nu), vr (irregular ru -ri),
//   vs-c (su precursor), v-unspec (unspecified).
const EXCLUDE = /^(v2|v4|vn$|vr$|vs-c$|v-unspec$)/;

// transitivity / non-class tags to ignore when picking a verb class
const NONCLASS = new Set(['vt', 'vi', 'aux-v', 'aux']);

// ----------------------------------------------------------------------------
// kana -> romaji (Hepburn-ish, macron-free). Handles hiragana + katakana.
// Used only to produce the `romaji` search field. Long vowels stay as written
// vowels (おう -> ou), sokuon doubles the next consonant, ん -> n.
// ----------------------------------------------------------------------------
const ROMA = {
  あ:'a',い:'i',う:'u',え:'e',お:'o',
  か:'ka',き:'ki',く:'ku',け:'ke',こ:'ko',
  が:'ga',ぎ:'gi',ぐ:'gu',げ:'ge',ご:'go',
  さ:'sa',し:'shi',す:'su',せ:'se',そ:'so',
  ざ:'za',じ:'ji',ず:'zu',ぜ:'ze',ぞ:'zo',
  た:'ta',ち:'chi',つ:'tsu',て:'te',と:'to',
  だ:'da',ぢ:'ji',づ:'zu',で:'de',ど:'do',
  な:'na',に:'ni',ぬ:'nu',ね:'ne',の:'no',
  は:'ha',ひ:'hi',ふ:'fu',へ:'he',ほ:'ho',
  ば:'ba',び:'bi',ぶ:'bu',べ:'be',ぼ:'bo',
  ぱ:'pa',ぴ:'pi',ぷ:'pu',ぺ:'pe',ぽ:'po',
  ま:'ma',み:'mi',む:'mu',め:'me',も:'mo',
  や:'ya',ゆ:'yu',よ:'yo',
  ら:'ra',り:'ri',る:'ru',れ:'re',ろ:'ro',
  わ:'wa',ゐ:'wi',ゑ:'we',を:'o',ん:'n',
  ぁ:'a',ぃ:'i',ぅ:'u',ぇ:'e',ぉ:'o',ゃ:'ya',ゅ:'yu',ょ:'yo',ゎ:'wa',
  ー:'',
};
const YOON = { // small-y digraphs (consonant + small ya/yu/yo)
  き:'ky',ぎ:'gy',し:'sh',じ:'j',ち:'ch',ぢ:'j',に:'ny',ひ:'hy',
  び:'by',ぴ:'py',み:'my',り:'ry',
};
function kataToHira(s){ return s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)); }
function kanaToRomaji(input){
  const s = kataToHira(input);
  let out = '';
  for (let i = 0; i < s.length; i++){
    const c = s[i], n = s[i+1];
    if (c === 'っ'){ // sokuon: double next consonant
      const nr = (YOON[n] || ROMA[n] || '');
      const first = nr[0];
      if (first) out += (first === 'c' ? 't' : first); // っち -> tchi
      continue;
    }
    if (n && /[ゃゅょ]/.test(n) && YOON[c]){
      const y = n === 'ゃ' ? 'a' : n === 'ゅ' ? 'u' : 'o';
      out += YOON[c] + y; i++; continue;
    }
    out += (ROMA[c] ?? c);
  }
  return out;
}

// ----------------------------------------------------------------------------
// download helpers
// ----------------------------------------------------------------------------
async function findLatestAsset(variant){
  const r = await (await fetch('https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest',
    { headers: { 'User-Agent': 'prebake', 'Accept': 'application/vnd.github+json' } })).json();
  const re = variant === 'common'
    ? /jmdict-eng-common-.*\.json\.tgz$/
    : /jmdict-eng-\d.*\.json\.tgz$/;            // full = no "-common"
  const asset = r.assets.find(a => re.test(a.name));
  if (!asset) throw new Error('no matching asset for variant=' + variant);
  return { url: asset.browser_download_url, name: asset.name, tag: r.tag_name };
}
async function downloadAndExtract(variant){
  const { url, name } = await findLatestAsset(variant);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jmdict-'));
  const tgz = path.join(tmp, name);
  process.stderr.write(`downloading ${url}\n`);
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  fs.writeFileSync(tgz, buf);
  execFileSync('tar', ['xzf', tgz, '-C', tmp]);
  const json = fs.readdirSync(tmp).find(f => f.endsWith('.json'));
  return path.join(tmp, json);
}

// ----------------------------------------------------------------------------
// core: jmdict words[] -> compact verb records
// ----------------------------------------------------------------------------
// A handful of ultra-frequent verbs are idiomatically written in kana even though
// JMdict marks their kanji form `common` (有る/居る/成る/出来る). The `common` flag
// can't distinguish these from 来る/言う/分かる (also common+uk) — it is an editorial
// call. We suppress by the specific KANJI FORM (not the reading, which would also
// catch homophones like 射る/鳴る). Keep this list SMALL and well-known.
const KANA_SUPPRESS = new Set(['有る', '在る', '居る', '成る', '出来る', '為る']);

// Choose the idiomatic dictionary headword kanji, or null to fall back to kana.
// Drop search-only(sK), rare(rK), irregular(iK), outdated(oK) kanji. If nothing is
// left (する=為る[rK], くれる=呉れる[rK], いらっしゃる/ダブる=[sK]) -> kana headword.
// Otherwise prefer a common kanji (来る/飲む/言う stay kanji); but if the chosen kanji
// is on KANA_SUPPRESS, fall back to kana so ある/いる/なる/できる show idiomatically.
function pickKanji(w){
  const cand = w.kanji.filter(k =>
    !k.tags.includes('sK') && !k.tags.includes('rK') &&
    !k.tags.includes('iK') && !k.tags.includes('oK'));
  if (!cand.length) return null;
  const chosen = cand.find(k => k.common) || cand[0];
  return KANA_SUPPRESS.has(chosen.text) ? null : chosen;
}
function pickKana(w, kanjiText){
  const matches = w.kana.filter(k => !k.tags.includes('sk') &&
    (!kanjiText || k.appliesToKanji.includes('*') || k.appliesToKanji.includes(kanjiText)));
  const pool = matches.length ? matches : w.kana;
  return pool.find(k => k.common) || pool[0] || null;
}
function verbClassOf(w){
  // return {cls, pos} for the first class-bearing verb PoS, scanning senses in order
  for (const s of w.sense){
    for (const p of s.partOfSpeech){
      if (!p.startsWith('v')) continue;
      if (NONCLASS.has(p)) continue;
      if (EXCLUDE.test(p)) return { excluded: p };
      if (CLASS[p]) return { cls: CLASS[p], pos: p };
    }
  }
  return null;
}
function firstGloss(w){
  for (const s of w.sense){
    if (s.gloss && s.gloss.length) return s.gloss[0].text;
  }
  return '';
}

function build(words){
  const out = [];
  const seen = new Map();             // dedup key k|cls -> index
  const stats = { excluded:{}, byClass:{}, total:0, kanaOnly:0, suruSynth:0 };
  for (const w of words){
    const vc = verbClassOf(w);
    if (!vc) continue;
    if (vc.excluded){ stats.excluded[vc.excluded] = (stats.excluded[vc.excluded]||0)+1; continue; }
    const kj = pickKanji(w);
    const kn = pickKana(w, kj && kj.text);
    if (!kn) continue;                // need at least a reading
    let k = kj ? kj.text : kn.text;   // kana-only verbs use the reading as headword
    let r = kn.text;
    if (!kj) stats.kanaOnly++;
    // suru-noun: synthesize the dictionary verb form noun+する
    if (vc.cls === 'suru-noun'){
      k = k + 'する';
      r = r + 'する';
      stats.suruSynth++;
    }
    const common = !!((kj && kj.common) || kn.common);
    const rec = { k, r, romaji: kanaToRomaji(r), cls: vc.cls, common, gloss: firstGloss(w) };
    const key = k + '|' + rec.cls;
    if (seen.has(key)){
      // keep the one marked common if the existing wasn't
      const ex = out[seen.get(key)];
      if (common && !ex.common) out[seen.get(key)] = rec;
      continue;
    }
    seen.set(key, out.length);
    out.push(rec);
    stats.byClass[rec.cls] = (stats.byClass[rec.cls]||0)+1;
    stats.total++;
  }
  // sort: common first, then by class, then romaji — stable, deterministic
  out.sort((a,b) => (b.common - a.common) || a.cls.localeCompare(b.cls) || a.romaji.localeCompare(b.romaji));
  return { records: out, stats };
}

// ----------------------------------------------------------------------------
// main
// ----------------------------------------------------------------------------
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2]] : [a, true];
}));
const variant = args.variant || 'full';
const outPath = args.out || `verbs.${variant}.json`;

let srcPath = args.src;
if (!srcPath) srcPath = await downloadAndExtract(variant);
process.stderr.write(`parsing ${srcPath}\n`);
const d = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
const { records, stats } = build(d.words);
fs.writeFileSync(outPath, JSON.stringify(records));
const raw = fs.statSync(outPath).size;
const gz = zlib.gzipSync(fs.readFileSync(outPath), { level: 9 }).length;
process.stderr.write(`wrote ${outPath}: ${records.length} verbs | raw ${(raw/1024).toFixed(1)}KB | gzip ${(gz/1024).toFixed(1)}KB\n`);
process.stderr.write('byClass: ' + JSON.stringify(stats.byClass) + '\n');
process.stderr.write('excluded: ' + JSON.stringify(stats.excluded) + '\n');
process.stderr.write(`kanaOnly:${stats.kanaOnly} suruSynth:${stats.suruSynth} dictDate:${d.dictDate} version:${d.version}\n`);

export { build, kanaToRomaji, CLASS, EXCLUDE };
