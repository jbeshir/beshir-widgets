// romaji.ts — offline wāpuro rōmaji → hiragana converter for verb entry.
// Ported verbatim from the tested /in/romaji.mjs (39/39 cases pass). Greedy
// longest-match over a static syllable table; handles gojūon, dakuten/handakuten,
// yōon (kya/sha/cho…), sokuon (kk/tt/tch → っ), ん (n / nn / n' / n+consonant),
// long vowels (ou stays おう), wāpuro variants (si/ti/tu/hu/zi/sya/tya…), wo → を.
// Existing kana/kanji and spaces/hyphens pass through, so pasted 飲む / のむ work.

const ROMAJI_TABLE: Record<string, string> = {
  // pure vowels
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
  // k / g
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
  ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
  kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ', kye: 'きぇ',
  gya: 'ぎゃ', gyu: 'ぎゅ', gyo: 'ぎょ',
  // s / z  (+ wāpuro si/zi/sya…)
  sa: 'さ', shi: 'し', si: 'し', su: 'す', se: 'せ', so: 'そ',
  za: 'ざ', ji: 'じ', zi: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
  sha: 'しゃ', shu: 'しゅ', sho: 'しょ', she: 'しぇ',
  sya: 'しゃ', syu: 'しゅ', syo: 'しょ',
  ja: 'じゃ', ju: 'じゅ', jo: 'じょ', je: 'じぇ',
  jya: 'じゃ', jyu: 'じゅ', jyo: 'じょ', zya: 'じゃ', zyu: 'じゅ', zyo: 'じょ',
  // t / d (+ wāpuro ti/tu/di/du/tsu)
  ta: 'た', chi: 'ち', ti: 'ち', tsu: 'つ', tu: 'つ', te: 'て', to: 'と',
  da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
  cha: 'ちゃ', chu: 'ちゅ', cho: 'ちょ', che: 'ちぇ',
  tya: 'ちゃ', tyu: 'ちゅ', tyo: 'ちょ',
  dya: 'ぢゃ', dyu: 'ぢゅ', dyo: 'ぢょ',
  tsa: 'つぁ', tsi: 'つぃ', tse: 'つぇ', tso: 'つぉ',
  // n-row
  na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
  nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ',
  // h / b / p (+ wāpuro hu/fa…)
  ha: 'は', hi: 'ひ', fu: 'ふ', hu: 'ふ', he: 'へ', ho: 'ほ',
  ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
  pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
  hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ',
  bya: 'びゃ', byu: 'びゅ', byo: 'びょ',
  pya: 'ぴゃ', pyu: 'ぴゅ', pyo: 'ぴょ',
  fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ', fyu: 'ふゅ',
  // m
  ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
  mya: 'みゃ', myu: 'みゅ', myo: 'みょ',
  // y
  ya: 'や', yu: 'ゆ', yo: 'よ', ye: 'いぇ',
  // r
  ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
  rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ',
  // w + particles
  wa: 'わ', wi: 'うぃ', we: 'うぇ', wo: 'を', vu: 'ゔ',
  // small kana fallbacks (explicit x/l prefix)
  xa: 'ぁ', xi: 'ぃ', xu: 'ぅ', xe: 'ぇ', xo: 'ぉ', xtsu: 'っ', xtu: 'っ', ltu: 'っ',
  xya: 'ゃ', xyu: 'ゅ', xyo: 'ょ', xwa: 'ゎ',
};

// consonants that, when doubled, become っ (sokuon). "tch" → っち handled below.
const SOKUON = new Set(['k', 's', 't', 'c', 'p', 'g', 'z', 'j', 'd', 'b', 'f', 'h', 'm', 'r', 'w', 'y', 'v']);

export function romajiToKana(input: string): string {
  const s = String(input).toLowerCase().replace(/　/g, ' ').trim();
  let out = '';
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === ' ' || ch === '-') { i++; continue; }
    // ー / existing kana / kanji pass through
    if (/[ぁ-んァ-ヶー一-龯]/.test(ch)) { out += ch; i++; continue; }

    // ん handling (before sokuon so 'nn'/'nb' aren't read as gemination)
    if (ch === 'n') {
      const n2 = s[i + 1];
      if (n2 === undefined || n2 === ' ' || n2 === '-') { out += 'ん'; i++; continue; }
      if (n2 === "'") { out += 'ん'; i += 2; continue; }
      if (n2 === 'n') {
        const n3 = s[i + 2];
        if (n3 && 'aiueoy'.includes(n3)) { out += 'ん'; i++; continue; } // nni → ん + に
        out += 'ん'; i += 2; continue;
      }
      if (!'aiueoy'.includes(n2)) { out += 'ん'; i++; continue; }
      // else n+vowel/ny → fall through to table (na/ni/…/nya)
    }

    // sokuon: same consonant doubled (kk, tt, ss, pp…), and tch → っち
    const next = s[i + 1];
    if (SOKUON.has(ch) && next === ch) { out += 'っ'; i++; continue; }
    else if (ch === 't' && next === 'c' && s[i + 2] === 'h') { out += 'っ'; i++; continue; }

    // greedy longest match: try 4,3,2,1 chars
    let matched = false;
    for (let len = 4; len >= 1; len--) {
      const frag = s.substr(i, len);
      if (ROMAJI_TABLE[frag]) { out += ROMAJI_TABLE[frag]; i += len; matched = true; break; }
    }
    if (!matched) { out += ch; i++; }
  }
  return out;
}

// True if the input contains any Japanese kana/kanji (so we skip romaji conversion).
export function hasJapanese(s: string): boolean {
  return /[ぁ-んァ-ヶー一-龯]/.test(s);
}
