// Unified golden test — exits non-zero if ANY case fails.
// (a) 80 cases from test/golden.json — checks tier.kanji + tier.romaji
// (b) ~144 legacy TowerOpts cases (re-expressed via optsToOps) — checks tier.kana + tier.kanji
// Then: allowedOps unit checks.

import { makeVerb, buildTower, allowedOps, optsToOps, baseForm } from '../src/engine';
import type { DictEntry, TowerOpts, OpId } from '../src/engine';
import goldenJson from './golden.json' assert { type: 'json' };

// ── (a) JSON golden cases ────────────────────────────────────────────────────

// The golden.json "expectedKana" is the KANJI SURFACE (tier.kanji) despite the name.
// Derive kana reading for each headword from this map.
const KANA_MAP: Record<string, string> = {
  '飲む':'のむ', '食べる':'たべる', '書く':'かく', 'する':'する', '来る':'くる',
  '高い':'たかい', '見る':'みる', '勉強する':'べんきょうする', '行く':'いく',
};

let pass = 0;
const fails: string[] = [];

for (const c of goldenJson as Array<{verb:string;class:string;ops:string[];expectedKana:string;expectedRomaji:string}>) {
  const kana = KANA_MAP[c.verb];
  if (!kana) { fails.push(`NO KANA MAP for "${c.verb}"`); continue; }

  const entry: DictEntry = { k: c.verb, r: kana, romaji: '', cls: c.class, common: true, gloss: 'x' };
  const verb = makeVerb(entry);
  const tiers = buildTower(verb, c.ops as OpId[]);
  const top = tiers[tiers.length - 1];

  const label = `${c.verb} [${c.ops.join(',')}]`;
  if (top.kanji !== c.expectedKana) {
    fails.push(`JSON KANJI  ${label}: got「${top.kanji}」want「${c.expectedKana}」`);
  } else if (top.romaji !== c.expectedRomaji) {
    fails.push(`JSON ROMAJI ${label}: got「${top.romaji}」want「${c.expectedRomaji}」`);
  } else {
    pass++;
  }
}

// ── (b) Legacy TowerOpts cases ────────────────────────────────────────────────

type Opt = Partial<TowerOpts>;
const O = (o: Opt): TowerOpts => ({
  causative: !!o.causative, voice: o.voice ?? 'none',
  polite: !!o.polite, negative: !!o.negative, past: !!o.past,
});
interface Case {
  k: string; r: string; cls: string;
  o: Opt; kana: string; kanji?: string;
}
const C = (k:string, r:string, cls:string, o:Opt, kana:string, kanji?:string): Case =>
  ({ k, r, cls, o, kana, kanji });

const legacyCases: Case[] = [
  // ── 飲む godan-m
  C('飲む','のむ','godan-m',{},'のむ','飲む'),
  C('飲む','のむ','godan-m',{causative:true},'のませる','飲ませる'),
  C('飲む','のむ','godan-m',{voice:'passive'},'のまれる','飲まれる'),
  C('飲む','のむ','godan-m',{voice:'potential'},'のめる','飲める'),
  C('飲む','のむ','godan-m',{polite:true},'のみます','飲みます'),
  C('飲む','のむ','godan-m',{negative:true},'のまない','飲まない'),
  C('飲む','のむ','godan-m',{past:true},'のんだ','飲んだ'),
  C('飲む','のむ','godan-m',{causative:true,voice:'passive'},'のませられる','飲ませられる'),
  C('飲む','のむ','godan-m',{causative:true,voice:'passive',negative:true,past:true},'のませられなかった','飲ませられなかった'),
  C('飲む','のむ','godan-m',{causative:true,voice:'passive',polite:true,negative:true,past:true},'のませられませんでした','飲ませられませんでした'),
  C('飲む','のむ','godan-m',{negative:true,past:true},'のまなかった','飲まなかった'),
  C('飲む','のむ','godan-m',{polite:true,past:true},'のみました','飲みました'),
  C('飲む','のむ','godan-m',{polite:true,negative:true},'のみません','飲みません'),
  C('飲む','のむ','godan-m',{voice:'passive',negative:true},'のまれない','飲まれない'),
  // ── 話す godan-s
  C('話す','はなす','godan-s',{},'はなす','話す'),
  C('話す','はなす','godan-s',{causative:true},'はなさせる','話させる'),
  C('話す','はなす','godan-s',{voice:'passive'},'はなされる'),
  C('話す','はなす','godan-s',{voice:'potential'},'はなせる','話せる'),
  C('話す','はなす','godan-s',{polite:true},'はなします','話します'),
  C('話す','はなす','godan-s',{negative:true},'はなさない','話さない'),
  C('話す','はなす','godan-s',{past:true},'はなした','話した'),
  C('話す','はなす','godan-s',{negative:true,past:true},'はなさなかった'),
  C('話す','はなす','godan-s',{polite:true,negative:true,past:true},'はなしませんでした'),
  // ── 行く godan-iku
  C('行く','いく','godan-iku',{},'いく','行く'),
  C('行く','いく','godan-iku',{past:true},'いった','行った'),
  C('行く','いく','godan-iku',{negative:true},'いかない','行かない'),
  C('行く','いく','godan-iku',{polite:true},'いきます','行きます'),
  C('行く','いく','godan-iku',{voice:'potential'},'いける','行ける'),
  C('行く','いく','godan-iku',{causative:true},'いかせる','行かせる'),
  C('行く','いく','godan-iku',{negative:true,past:true},'いかなかった','行かなかった'),
  C('行く','いく','godan-iku',{polite:true,past:true},'いきました','行きました'),
  C('逝く','いく','godan-iku',{past:true},'いった','逝った'),
  // ── 買う godan-u
  C('買う','かう','godan-u',{},'かう','買う'),
  C('買う','かう','godan-u',{negative:true},'かわない','買わない'),
  C('買う','かう','godan-u',{causative:true},'かわせる','買わせる'),
  C('買う','かう','godan-u',{voice:'passive'},'かわれる','買われる'),
  C('買う','かう','godan-u',{voice:'potential'},'かえる','買える'),
  C('買う','かう','godan-u',{polite:true},'かいます','買います'),
  C('買う','かう','godan-u',{past:true},'かった','買った'),
  C('買う','かう','godan-u',{negative:true,past:true},'かわなかった','買わなかった'),
  // ── 待つ godan-t
  C('待つ','まつ','godan-t',{negative:true},'またない','待たない'),
  C('待つ','まつ','godan-t',{past:true},'まった','待った'),
  C('待つ','まつ','godan-t',{polite:true},'まちます','待ちます'),
  C('待つ','まつ','godan-t',{voice:'potential'},'まてる','待てる'),
  C('待つ','まつ','godan-t',{causative:true},'またせる','待たせる'),
  // ── 泳ぐ godan-g
  C('泳ぐ','およぐ','godan-g',{past:true},'およいだ','泳いだ'),
  C('泳ぐ','およぐ','godan-g',{negative:true},'およがない','泳がない'),
  C('泳ぐ','およぐ','godan-g',{polite:true},'およぎます','泳ぎます'),
  C('泳ぐ','およぐ','godan-g',{voice:'potential'},'およげる','泳げる'),
  // ── 遊ぶ godan-b
  C('遊ぶ','あそぶ','godan-b',{past:true},'あそんだ','遊んだ'),
  C('遊ぶ','あそぶ','godan-b',{negative:true},'あそばない','遊ばない'),
  C('遊ぶ','あそぶ','godan-b',{voice:'potential'},'あそべる','遊べる'),
  // ── 死ぬ godan-n
  C('死ぬ','しぬ','godan-n',{past:true},'しんだ','死んだ'),
  C('死ぬ','しぬ','godan-n',{negative:true},'しなない','死なない'),
  C('死ぬ','しぬ','godan-n',{polite:true},'しにます','死にます'),
  // ── godan-r verbs
  C('帰る','かえる','godan-r',{negative:true},'かえらない','帰らない'),
  C('帰る','かえる','godan-r',{past:true},'かえった','帰った'),
  C('帰る','かえる','godan-r',{polite:true},'かえります','帰ります'),
  C('帰る','かえる','godan-r',{voice:'potential'},'かえれる','帰れる'),
  C('帰る','かえる','godan-r',{causative:true},'かえらせる','帰らせる'),
  C('入る','いる','godan-r',{negative:true},'いらない','入らない'),
  C('入る','いる','godan-r',{past:true},'いった','入った'),
  C('走る','はしる','godan-r',{negative:true},'はしらない','走らない'),
  C('走る','はしる','godan-r',{past:true},'はしった','走った'),
  C('切る','きる','godan-r',{past:true},'きった','切った'),
  // ── サボる kana-only
  C('サボる','サボる','godan-r',{},'サボる','サボる'),
  C('サボる','サボる','godan-r',{negative:true},'サボらない','サボらない'),
  C('サボる','サボる','godan-r',{past:true},'サボった','サボった'),
  C('サボる','サボる','godan-r',{polite:true},'サボります','サボります'),
  // ── 問う godan-u-s
  C('問う','とう','godan-u-s',{past:true},'とうた','問うた'),
  C('問う','とう','godan-u-s',{negative:true},'とわない','問わない'),
  C('問う','とう','godan-u-s',{polite:true},'といます','問います'),
  // ── ある godan-r-i
  C('ある','ある','godan-r-i',{},'ある','ある'),
  C('ある','ある','godan-r-i',{negative:true},'ない','ない'),
  C('ある','ある','godan-r-i',{past:true},'あった','あった'),
  C('ある','ある','godan-r-i',{negative:true,past:true},'なかった','なかった'),
  C('ある','ある','godan-r-i',{polite:true},'あります','あります'),
  C('ある','ある','godan-r-i',{polite:true,negative:true},'ありません','ありません'),
  C('ある','ある','godan-r-i',{causative:true},'あらせる','あらせる'),
  C('ある','ある','godan-r-i',{voice:'passive'},'あられる','あられる'),
  C('ある','ある','godan-r-i',{voice:'potential'},'あれる','あれる'),
  // ── いらっしゃる godan-aru
  C('いらっしゃる','いらっしゃる','godan-aru',{polite:true},'いらっしゃいます'),
  C('いらっしゃる','いらっしゃる','godan-aru',{negative:true},'いらっしゃらない'),
  C('いらっしゃる','いらっしゃる','godan-aru',{past:true},'いらっしゃった'),
  C('いらっしゃる','いらっしゃる','godan-aru',{polite:true,negative:true},'いらっしゃいません'),
  C('いらっしゃる','いらっしゃる','godan-aru',{polite:true,past:true},'いらっしゃいました'),
  C('下さる','くださる','godan-aru',{polite:true},'くださいます','下さいます'),
  // ── 食べる/見る ichidan
  C('食べる','たべる','ichidan',{causative:true},'たべさせる','食べさせる'),
  C('食べる','たべる','ichidan',{voice:'passive'},'たべられる','食べられる'),
  C('食べる','たべる','ichidan',{voice:'potential'},'たべられる','食べられる'),
  C('食べる','たべる','ichidan',{polite:true},'たべます','食べます'),
  C('食べる','たべる','ichidan',{negative:true},'たべない','食べない'),
  C('食べる','たべる','ichidan',{past:true},'たべた','食べた'),
  C('食べる','たべる','ichidan',{negative:true,past:true},'たべなかった','食べなかった'),
  C('食べる','たべる','ichidan',{causative:true,voice:'passive'},'たべさせられる','食べさせられる'),
  C('見る','みる','ichidan',{negative:true},'みない','見ない'),
  C('見る','みる','ichidan',{past:true},'みた','見た'),
  C('見る','みる','ichidan',{causative:true},'みさせる','見させる'),
  // ── する suru
  C('する','する','suru',{},'する','する'),
  C('する','する','suru',{causative:true},'させる','させる'),
  C('する','する','suru',{voice:'passive'},'される','される'),
  C('する','する','suru',{voice:'potential'},'できる','できる'),
  C('する','する','suru',{polite:true},'します','します'),
  C('する','する','suru',{negative:true},'しない','しない'),
  C('する','する','suru',{past:true},'した','した'),
  C('する','する','suru',{negative:true,past:true},'しなかった'),
  C('する','する','suru',{causative:true,voice:'passive'},'させられる'),
  C('する','する','suru',{causative:true,voice:'passive',polite:true,negative:true,past:true},'させられませんでした'),
  // ── 勉強する suru-noun
  C('勉強する','べんきょうする','suru-noun',{},'べんきょうする','勉強する'),
  C('勉強する','べんきょうする','suru-noun',{causative:true},'べんきょうさせる','勉強させる'),
  C('勉強する','べんきょうする','suru-noun',{voice:'passive'},'べんきょうされる','勉強される'),
  C('勉強する','べんきょうする','suru-noun',{voice:'potential'},'べんきょうできる','勉強できる'),
  C('勉強する','べんきょうする','suru-noun',{polite:true},'べんきょうします','勉強します'),
  C('勉強する','べんきょうする','suru-noun',{negative:true},'べんきょうしない','勉強しない'),
  C('勉強する','べんきょうする','suru-noun',{past:true},'べんきょうした','勉強した'),
  C('勉強する','べんきょうする','suru-noun',{causative:true,voice:'passive'},'べんきょうさせられる','勉強させられる'),
  C('勉強する','べんきょうする','suru-noun',{negative:true,past:true},'べんきょうしなかった','勉強しなかった'),
  C('勉強する','べんきょうする','suru-noun',{causative:true,voice:'passive',polite:true,negative:true,past:true},'べんきょうさせられませんでした','勉強させられませんでした'),
  // ── 愛する suru-s
  C('愛する','あいする','suru-s',{},'あいする','愛する'),
  C('愛する','あいする','suru-s',{negative:true},'あいさない','愛さない'),
  C('愛する','あいする','suru-s',{causative:true},'あいさせる','愛させる'),
  C('愛する','あいする','suru-s',{voice:'passive'},'あいされる','愛される'),
  C('愛する','あいする','suru-s',{voice:'potential'},'あいせる','愛せる'),
  C('愛する','あいする','suru-s',{polite:true},'あいします','愛します'),
  C('愛する','あいする','suru-s',{past:true},'あいした','愛した'),
  C('愛する','あいする','suru-s',{negative:true,past:true},'あいさなかった','愛さなかった'),
  // ── 信ずる zuru
  C('信ずる','しんずる','zuru',{},'しんずる','信ずる'),
  C('信ずる','しんずる','zuru',{negative:true},'しんじない','信じない'),
  C('信ずる','しんずる','zuru',{causative:true},'しんじさせる','信じさせる'),
  C('信ずる','しんずる','zuru',{voice:'passive'},'しんじられる','信じられる'),
  C('信ずる','しんずる','zuru',{polite:true},'しんじます','信じます'),
  C('信ずる','しんずる','zuru',{past:true},'しんじた','信じた'),
  C('信ずる','しんずる','zuru',{negative:true,past:true},'しんじなかった','信じなかった'),
  C('信ずる','しんずる','zuru',{voice:'potential'},'しんじられる','信じられる'),
  // ── 来る kuru
  C('来る','くる','kuru',{},'くる','来る'),
  C('来る','くる','kuru',{negative:true},'こない','来ない'),
  C('来る','くる','kuru',{causative:true},'こさせる','来させる'),
  C('来る','くる','kuru',{voice:'passive'},'こられる','来られる'),
  C('来る','くる','kuru',{voice:'potential'},'こられる','来られる'),
  C('来る','くる','kuru',{polite:true},'きます','来ます'),
  C('来る','くる','kuru',{past:true},'きた','来た'),
  C('来る','くる','kuru',{negative:true,past:true},'こなかった','来なかった'),
  C('来る','くる','kuru',{causative:true,voice:'passive'},'こさせられる','来させられる'),
  C('来る','くる','kuru',{causative:true,voice:'passive',polite:true,negative:true,past:true},'こさせられませんでした','来させられませんでした'),
];

for (const c of legacyCases) {
  const entry: DictEntry = { k:c.k, r:c.r, romaji:'', cls:c.cls, common:true, gloss:'x' };
  const verb = makeVerb(entry);
  const tiers = buildTower(verb, O(c.o));
  const top = tiers[tiers.length - 1];
  const label = `${c.k} ${JSON.stringify(c.o)}`;
  if (top.kana !== c.kana) {
    fails.push(`LEGACY KANA  ${label}: got「${top.kana}」want「${c.kana}」`);
  } else if (c.kanji !== undefined && top.kanji !== c.kanji) {
    fails.push(`LEGACY KANJI ${label}: got「${top.kanji}」want「${c.kanji}」`);
  } else {
    pass++;
  }
}

// ── (c) na-adjective (そう) copula-track recursion — UI-reachable, not in golden.json ──
const naCases: Array<{k:string;r:string;cls:string;ops:OpId[];kanji:string}> = [
  { k:'高い', r:'たかい', cls:'i-adjective', ops:['sou'],                  kanji:'高そう' },
  { k:'高い', r:'たかい', cls:'i-adjective', ops:['sou','negative'],       kanji:'高そうではない' },
  { k:'高い', r:'たかい', cls:'i-adjective', ops:['sou','past'],           kanji:'高そうだった' },
  { k:'高い', r:'たかい', cls:'i-adjective', ops:['sou','polite'],         kanji:'高そうです' },
  { k:'高い', r:'たかい', cls:'i-adjective', ops:['sou','naru'],           kanji:'高そうになる' },
  { k:'高い', r:'たかい', cls:'i-adjective', ops:['sou','negative','past'],kanji:'高そうではなかった' },
];
for (const c of naCases) {
  const verb = makeVerb({ k:c.k, r:c.r, romaji:'', cls:c.cls, common:true, gloss:'x' });
  const tiers = buildTower(verb, c.ops);
  const top = tiers[tiers.length - 1];
  const label = `${c.k} [${c.ops.join(',')}]`;
  if (top.kanji !== c.kanji) {
    fails.push(`NA-ADJ KANJI ${label}: got「${top.kanji}」want「${c.kanji}」`);
  } else {
    pass++;
  }
}

const total = pass + fails.length;
console.log(`golden conjugation: ${pass}/${total} pass, ${fails.length} fail`);
for (const f of fails) console.error('  ✗ ' + f);
if (fails.length) process.exit(1);

// ── allowedOps unit checks ────────────────────────────────────────────────────

function assert(cond: boolean, msg: string) {
  if (!cond) { console.error('  ✗ allowedOps: ' + msg); process.exit(1); }
}

const nomuVerb = makeVerb({ k:'飲む', r:'のむ', romaji:'nomu', cls:'godan-m', common:true, gloss:'drink' });
const taberuVerb = makeVerb({ k:'食べる', r:'たべる', romaji:'taberu', cls:'ichidan', common:true, gloss:'eat' });
const takaiVerb = makeVerb({ k:'高い', r:'たかい', romaji:'takai', cls:'i-adjective', common:true, gloss:'expensive' });

// Terminals → empty
{
  const volForm = { kana:'のもう', type:'volitional' as const };
  assert(allowedOps(volForm,[]).length === 0, 'volitional must be terminal');
  const impForm = { kana:'のめ', type:'imperative' as const };
  assert(allowedOps(impForm,[]).length === 0, 'imperative must be terminal');
  const baForm = { kana:'のめば', type:'conditional-ba' as const };
  assert(allowedOps(baForm,[]).length === 0, 'conditional-ba must be terminal');
}

// After tai (i-adjective): negative + naru offered; tai/yasui/nikui/tagaru NOT
{
  const tiers = buildTower(nomuVerb, ['tai']);
  const taiForm = { kana: tiers[tiers.length-1].kana, type: 'i-adjective' as const };
  const ao = allowedOps(taiForm, ['tai']);
  assert(ao.includes('negative'), 'negative offered after tai');
  assert(ao.includes('naru'),     'naru offered after tai');
  assert(!ao.includes('tai'),     'tai NOT offered after tai (desire once)');
  assert(!ao.includes('yasui'),   'yasui NOT offered after tai');
  assert(!ao.includes('nikui'),   'nikui NOT offered after tai');
  assert(!ao.includes('tagaru'),  'tagaru NOT offered after tai');
}

// Voice once: no causative after causative
{
  const tiers = buildTower(nomuVerb, ['causative']);
  const causForm = { kana: tiers[tiers.length-1].kana, type: 'ichidan' as const };
  const ao = allowedOps(causForm, ['causative']);
  assert(!ao.includes('causative'),         'no causative after causative');
  assert(!ao.includes('causative-passive'), 'no causative-passive after causative');
}

// No passive after causative-passive
{
  const tiers = buildTower(nomuVerb, ['causative-passive']);
  const cpForm = { kana: tiers[tiers.length-1].kana, type: 'ichidan' as const };
  const ao = allowedOps(cpForm, ['causative-passive']);
  assert(!ao.includes('passive'),  'no passive after causative-passive');
  assert(!ao.includes('potential'),'no potential after causative-passive');
}

// sugiru not offered when form ends in すぎ
{
  const tiers = buildTower(takaiVerb, ['sugiru']);
  const sugiForm = { kana: tiers[tiers.length-1].kana, type: 'ichidan' as const };
  const ao = allowedOps(sugiForm, ['sugiru']);
  assert(!ao.includes('sugiru'), 'sugiru blocked after sugiru result');
}

// Depth cap: 8 ops → empty
{
  const deepStack: OpId[] = ['causative','passive','tai','negative','naru','te-kuru','te-iru','te-shimau'];
  const deepForm = { kana:'dummy', type:'godan' as const };
  assert(allowedOps(deepForm, deepStack).length === 0, 'depth cap 8 empties allowed ops');
}

console.log('ALL GOLDEN CASES PASS');
