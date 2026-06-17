import {
  Verb, GODAN_A, GODAN_I, GODAN_E,
  godanStem, dropRu, godanTaForm, kanaToRomaji, highlightRange,
} from './morph';
import { Form, FormType, OpId, Tier, OpFamily, FORM_LABEL } from './types';

// ── Type classification helpers ───────────────────────────────────────────────

const VERB_TYPES = new Set<FormType>([
  'godan','godan-iku','godan-u-s','godan-r-i','godan-aru','ichidan','suru','kuru',
]);
const GODAN_TYPES = new Set<FormType>([
  'godan','godan-iku','godan-u-s','godan-r-i','godan-aru',
]);

function isVerb(t: FormType) { return VERB_TYPES.has(t); }
function isGodan(t: FormType) { return GODAN_TYPES.has(t); }

// O-row (volitional)
const GODAN_O: Record<string, string> = {
  'う':'お','く':'こ','ぐ':'ご','す':'そ',
  'つ':'と','ぬ':'の','ぶ':'ぼ','む':'も','る':'ろ',
};

// ── Base form from a Verb ─────────────────────────────────────────────────────

export function baseForm(verb: Verb): Form {
  if (verb.rawClass === 'i-adjective') {
    return {
      kana: verb.kana, type: 'i-adjective',
      iiAdj: verb.kana === 'いい' || verb.kana === 'よい',
    };
  }
  let type: FormType;
  switch (verb.rawClass) {
    case 'godan-iku':  type = 'godan-iku';  break;
    case 'godan-u-s':  type = 'godan-u-s';  break;
    case 'godan-r-i':  type = 'godan-r-i';  break;
    case 'godan-aru':  type = 'godan-aru';  break;
    case 'ichidan': case 'ichidan-kureru': case 'zuru': type = 'ichidan'; break;
    case 'suru': case 'vs-i': case 'suru-noun':        type = 'suru';    break;
    case 'suru-s':     type = 'godan';      break;
    case 'kuru':       type = 'kuru';       break;
    default:           type = 'godan';      break;
  }
  return {
    kana: verb.kana, type,
    conjStem: verb.stem,
    suruPrefix: verb.suruPrefix,
    euphony: verb.euphony,
    aruNeg: verb.aruNeg,
    aruPolite: verb.aruPolite,
  };
}

// ── Stem helpers on a Form ────────────────────────────────────────────────────

function base(form: Form): string { return form.conjStem ?? form.kana; }

// Adjective stem: drop final い (irregular よ for いい).
function adjStem(form: Form): string {
  if (form.iiAdj) return form.kana.slice(0, -2) + 'よ';
  return form.kana.slice(0, -1);
}

// Verb I-stem (連用形).
function iStem(form: Form): string {
  const b = base(form);
  switch (form.type) {
    case 'godan': case 'godan-iku': case 'godan-u-s':
    case 'godan-r-i': case 'godan-aru':
      return godanStem(b, GODAN_I);
    case 'ichidan': return dropRu(b);
    case 'suru':    return (form.suruPrefix ?? '') + 'し';
    case 'kuru':    return form.kana.slice(0, -2) + 'き';
    default: throw new Error(`iStem: unsupported type ${form.type}`);
  }
}

// Verb A-stem (未然形).
function aStem(form: Form): string {
  const b = base(form);
  switch (form.type) {
    case 'godan': case 'godan-iku': case 'godan-u-s':
    case 'godan-r-i': case 'godan-aru':
      return godanStem(b, GODAN_A);
    case 'ichidan': return dropRu(b);
    case 'suru':    return (form.suruPrefix ?? '') + 'さ';
    case 'kuru':    return form.kana.slice(0, -2) + 'こ';
    default: throw new Error(`aStem: unsupported type ${form.type}`);
  }
}

// TE-form (te stem = euphonic て/で).
function teForm(form: Form): string {
  const b = base(form);
  switch (form.type) {
    case 'godan': case 'godan-iku': case 'godan-u-s':
    case 'godan-r-i': case 'godan-aru': {
      const ta = godanTaForm(b, form.euphony);
      return ta.slice(0, -1) + (ta.endsWith('だ') ? 'で' : 'て');
    }
    case 'ichidan': return dropRu(b) + 'て';
    case 'suru':    return (form.suruPrefix ?? '') + 'して';
    case 'kuru':    return form.kana.slice(0, -2) + 'きて';
    default: throw new Error(`teForm: unsupported type ${form.type}`);
  }
}

// ── Operator implementations (apply returns new Form.kana) ────────────────────

function applyVerb(form: Form, suffix: string): string {
  return iStem(form) + suffix;
}

// ── OP REGISTRY ───────────────────────────────────────────────────────────────

export interface Op {
  id: OpId;
  label: string;
  aux: string;
  family: OpFamily;
  tooltip: string;
  apply(form: Form): Form;
}

const OPS: Op[] = [];
const OPS_MAP = new Map<OpId, Op>();
function reg(op: Op) { OPS.push(op); OPS_MAP.set(op.id, op); }

// ── CORE: voice ───────────────────────────────────────────────────────────────

reg({ id:'causative', label:'Causative', aux:'せる／させる', family:'core',
  tooltip:'make/let someone do — a-stem + せる/させる; result conjugates as ichidan.',
  apply(f): Form {
    let kana: string;
    switch (f.type) {
      case 'suru': kana = (f.suruPrefix??'') + 'させる'; break;
      case 'kuru': kana = f.kana.slice(0,-2) + 'こさせる'; break;
      case 'ichidan': kana = dropRu(base(f)) + 'させる'; break;
      default: kana = godanStem(base(f), GODAN_A) + 'せる';
    }
    return { kana, type: 'ichidan' };
  },
});

reg({ id:'passive', label:'Passive', aux:'れる／られる', family:'core',
  tooltip:'passive/suffered — a-stem + れる/られる; result is ichidan.',
  apply(f): Form {
    let kana: string;
    switch (f.type) {
      case 'suru': kana = (f.suruPrefix??'') + 'される'; break;
      case 'kuru': kana = f.kana.slice(0,-2) + 'こられる'; break;
      case 'ichidan': kana = dropRu(base(f)) + 'られる'; break;
      default: kana = godanStem(base(f), GODAN_A) + 'れる';
    }
    return { kana, type: 'ichidan' };
  },
});

reg({ id:'potential', label:'Potential', aux:'える／られる', family:'core',
  tooltip:'can — godan e-stem+る; ichidan A+られる; する→できる; くる→こられる.',
  apply(f): Form {
    let kana: string;
    switch (f.type) {
      case 'suru': kana = (f.suruPrefix??'') + 'できる'; break;
      case 'kuru': kana = f.kana.slice(0,-2) + 'こられる'; break;
      case 'ichidan': kana = dropRu(base(f)) + 'られる'; break;
      default: kana = godanStem(base(f), GODAN_E) + 'る';
    }
    return { kana, type: 'ichidan' };
  },
});

reg({ id:'causative-passive', label:'Causative-passive', aux:'せられる／される', family:'core',
  tooltip:'be made to — godan A+される (except す-verbs A+せられる); ichidan/irr A+させられる.',
  apply(f): Form {
    const b = base(f);
    let kana: string;
    switch (f.type) {
      case 'suru': kana = (f.suruPrefix??'') + 'させられる'; break;
      case 'kuru': kana = f.kana.slice(0,-2) + 'こさせられる'; break;
      case 'ichidan': kana = dropRu(b) + 'させられる'; break;
      default:
        // godan-s (ends in す) → A+せられる; others → A+される
        kana = b.slice(-1) === 'す'
          ? godanStem(b, GODAN_A) + 'せられる'
          : godanStem(b, GODAN_A) + 'される';
    }
    return { kana, type: 'ichidan' };
  },
});

// ── CORE: polite/negative/past/te ─────────────────────────────────────────────

reg({ id:'polite', label:'Polite', aux:'ます／です', family:'core',
  tooltip:'polite register — verb I+ます; i-adj appends です.',
  apply(f): Form {
    if (f.type === 'i-adjective') return { kana: f.kana + 'です', type: 'polite' };
    if (f.type === 'na-adjective') return { kana: f.kana + 'です', type: 'polite' };
    const b = base(f);
    let kana: string;
    switch (f.type) {
      case 'suru': kana = (f.suruPrefix??'') + 'します'; break;
      case 'kuru': kana = f.kana.slice(0,-2) + 'きます'; break;
      case 'ichidan': kana = dropRu(b) + 'ます'; break;
      default:
        kana = f.aruPolite
          ? b.slice(0,-1) + 'います'
          : godanStem(b, GODAN_I) + 'ます';
    }
    return { kana, type: 'polite' };
  },
});

reg({ id:'negative', label:'Negative', aux:'ない', family:'core',
  tooltip:'plain negative — a-stem+ない; i-adj ADJ+くない; polite ます→ません.',
  apply(f): Form {
    if (f.type === 'i-adjective') return { kana: adjStem(f) + 'くない', type: 'i-adjective' };
    if (f.type === 'na-adjective') return { kana: f.kana + 'ではない', type: 'i-adjective' };
    if (f.type === 'polite') return { kana: f.kana.slice(0,-2) + 'ません', type: 'polite-neg' };
    const b = base(f);
    let kana: string;
    switch (f.type) {
      case 'suru': kana = (f.suruPrefix??'') + 'しない'; break;
      case 'kuru': kana = f.kana.slice(0,-2) + 'こない'; break;
      case 'ichidan': kana = dropRu(b) + 'ない'; break;
      default:
        kana = f.aruNeg ? 'ない' : godanStem(b, GODAN_A) + 'ない';
    }
    return { kana, type: 'i-adjective' };
  },
});

reg({ id:'past', label:'Past', aux:'た／だ', family:'core',
  tooltip:'past — verb euphonic た/だ; i-adj ADJ+かった; polite ます→ました.',
  apply(f): Form {
    if (f.type === 'i-adjective') return { kana: adjStem(f) + 'かった', type: 'i-adj-past' };
    if (f.type === 'na-adjective') return { kana: f.kana + 'だった', type: 'plain-past' };
    if (f.type === 'polite') return { kana: f.kana.slice(0,-2) + 'ました', type: 'polite-past' };
    if (f.type === 'polite-neg') return { kana: f.kana.slice(0,-3) + 'ませんでした', type: 'polite-neg-past' };
    const b = base(f);
    let kana: string;
    switch (f.type) {
      case 'suru': kana = (f.suruPrefix??'') + 'した'; break;
      case 'kuru': kana = f.kana.slice(0,-2) + 'きた'; break;
      case 'ichidan': kana = dropRu(b) + 'た'; break;
      default: kana = godanTaForm(b, f.euphony);
    }
    return { kana, type: 'plain-past' };
  },
});

reg({ id:'negative-past', label:'Neg-past', aux:'なかった', family:'core',
  tooltip:'negative past — single op shortcut (A+なかった; i-adj ADJ+くなかった).',
  apply(f): Form {
    if (f.type === 'i-adjective') return { kana: adjStem(f) + 'くなかった', type: 'plain-past' };
    const b = base(f);
    let kana: string;
    switch (f.type) {
      case 'suru': kana = (f.suruPrefix??'') + 'しなかった'; break;
      case 'kuru': kana = f.kana.slice(0,-2) + 'こなかった'; break;
      case 'ichidan': kana = dropRu(b) + 'なかった'; break;
      default:
        kana = f.aruNeg ? 'なかった' : godanStem(b, GODAN_A) + 'なかった';
    }
    return { kana, type: 'plain-past' };
  },
});

reg({ id:'te', label:'て-form', aux:'て／で', family:'core',
  tooltip:'continuative — verb euphonic て/で; i-adj ADJ+くて.',
  apply(f): Form {
    if (f.type === 'i-adjective') return { kana: adjStem(f) + 'くて', type: 'te-form' };
    return { kana: teForm(f), type: 'te-form' };
  },
});

reg({ id:'adverbial', label:'Adverbial', aux:'く', family:'adjective',
  tooltip:'adverb form of i-adjective — ADJ+く.',
  apply(f): Form { return { kana: adjStem(f) + 'く', type: 'adverbial' }; },
});

// ── DESIRE & EASE ─────────────────────────────────────────────────────────────

reg({ id:'tai', label:'want to', aux:'たい', family:'desire',
  tooltip:'want to — i-stem+たい; result is i-adjective (polite = です, not ます).',
  apply(f): Form { return { kana: iStem(f) + 'たい', type: 'i-adjective' }; },
});

reg({ id:'tagaru', label:'shows wanting', aux:'たがる', family:'desire',
  tooltip:'shows signs of wanting (3rd person) — i-stem+たがる; result is godan-r.',
  apply(f): Form { return { kana: iStem(f) + 'たがる', type: 'godan' }; },
});

reg({ id:'yasui', label:'easy to', aux:'やすい', family:'desire',
  tooltip:'easy to — i-stem+やすい; result is i-adjective.',
  apply(f): Form { return { kana: iStem(f) + 'やすい', type: 'i-adjective' }; },
});

reg({ id:'nikui', label:'hard to', aux:'にくい', family:'desire',
  tooltip:'hard to — i-stem+にくい; result is i-adjective.',
  apply(f): Form { return { kana: iStem(f) + 'にくい', type: 'i-adjective' }; },
});

reg({ id:'naosu', label:'redo / do over', aux:'なおす', family:'desire',
  tooltip:'do over / fix — 連用形 (i-stem) + 補助動詞 なおす; result conjugates as a godan-s verb (直す), so it recurses (なおさない／なおして／なおした／なおします).',
  apply(f): Form { return { kana: iStem(f) + 'なおす', type: 'godan' }; },
});

// ── ADJECTIVE OPS ─────────────────────────────────────────────────────────────

reg({ id:'sugiru', label:'too much', aux:'すぎる', family:'adjective',
  tooltip:'too — i-adj ADJ+すぎる; verb i-stem+すぎる; result is ichidan.',
  apply(f): Form {
    if (f.type === 'i-adjective') return { kana: adjStem(f) + 'すぎる', type: 'ichidan' };
    return { kana: iStem(f) + 'すぎる', type: 'ichidan' };
  },
});

reg({ id:'sou', label:'looks', aux:'そう', family:'adjective',
  tooltip:'looks/seems — i-adj ADJ+そう (ない→なさそう; いい→よさそう); verb i-stem+そう.',
  apply(f): Form {
    if (f.type === 'i-adjective') {
      const kana = f.iiAdj
        ? adjStem(f) + 'さそう'
        : f.kana.endsWith('ない')
          ? f.kana.slice(0,-1) + 'さそう'
          : f.kana.slice(0,-1) + 'そう';
      return { kana, type: 'na-adjective' };
    }
    return { kana: iStem(f) + 'そう', type: 'na-adjective' };
  },
});

reg({ id:'naru', label:'become', aux:'なる', family:'adjective',
  tooltip:'become — i-adj ADJ+く+なる (composite); na-adj/adverbial +になる.',
  apply(f): Form {
    if (f.type === 'i-adjective') return { kana: adjStem(f) + 'くなる', type: 'godan' };
    if (f.type === 'na-adjective') return { kana: f.kana + 'になる', type: 'godan' };
    // adverbial (already ends in く)
    return { kana: f.kana + 'なる', type: 'godan' };
  },
});

// ── MOOD ─────────────────────────────────────────────────────────────────────

reg({ id:'volitional', label:'Volitional', aux:'う／よう', family:'mood',
  tooltip:'let\'s / intention — godan o-row+う; ichidan +よう; polite ましょう.',
  apply(f): Form {
    if (f.type === 'polite') return { kana: f.kana.slice(0,-2) + 'ましょう', type: 'polite-volitional' };
    const b = base(f);
    let kana: string;
    switch (f.type) {
      case 'suru': kana = (f.suruPrefix??'') + 'しよう'; break;
      case 'kuru': kana = f.kana.slice(0,-2) + 'こよう'; break;
      case 'ichidan': kana = dropRu(b) + 'よう'; break;
      default: kana = godanStem(b, GODAN_O) + 'う';
    }
    return { kana, type: 'volitional' };
  },
});

reg({ id:'imperative', label:'Imperative', aux:'ろ／え', family:'mood',
  tooltip:'command — godan e-stem; ichidan +ろ; する→しろ; くる→こい.',
  apply(f): Form {
    const b = base(f);
    let kana: string;
    switch (f.type) {
      case 'suru': kana = (f.suruPrefix??'') + 'しろ'; break;
      case 'kuru': kana = f.kana.slice(0,-2) + 'こい'; break;
      case 'ichidan': kana = dropRu(b) + 'ろ'; break;
      case 'godan-aru':
        kana = f.aruPolite ? b.slice(0,-1) + 'い' : godanStem(b, GODAN_E);
        break;
      default: kana = godanStem(b, GODAN_E);
    }
    return { kana, type: 'imperative' };
  },
});

reg({ id:'ba', label:'if (〜ば)', aux:'ば', family:'mood',
  tooltip:'provisional conditional — godan e+ば; ichidan +れば; i-adj +ければ.',
  apply(f): Form {
    if (f.type === 'i-adjective') return { kana: adjStem(f) + 'ければ', type: 'conditional-ba' };
    const b = base(f);
    let kana: string;
    switch (f.type) {
      case 'suru': kana = (f.suruPrefix??'') + 'すれば'; break;
      case 'kuru': kana = f.kana.slice(0,-2) + 'くれば'; break;
      case 'ichidan': kana = dropRu(b) + 'れば'; break;
      default: kana = godanStem(b, GODAN_E) + 'ば';
    }
    return { kana, type: 'conditional-ba' };
  },
});

reg({ id:'tara', label:'when/if (〜たら)', aux:'たら', family:'mood',
  tooltip:'conditional/when — past stem+ら; i-adj ADJ+かったら; polite ましたら.',
  apply(f): Form {
    if (f.type === 'i-adjective') return { kana: adjStem(f) + 'かったら', type: 'conditional-tara' };
    if (f.type === 'i-adj-past') return { kana: f.kana + 'ら', type: 'conditional-tara' };
    if (f.type === 'plain-past') return { kana: f.kana + 'ら', type: 'conditional-tara' };
    if (f.type === 'polite') return { kana: f.kana.slice(0,-2) + 'ましたら', type: 'conditional-tara' };
    const b = base(f);
    let kana: string;
    switch (f.type) {
      case 'suru': kana = (f.suruPrefix??'') + 'したら'; break;
      case 'kuru': kana = f.kana.slice(0,-2) + 'きたら'; break;
      case 'ichidan': kana = dropRu(b) + 'たら'; break;
      default: kana = godanTaForm(b, f.euphony) + 'ら';
    }
    return { kana, type: 'conditional-tara' };
  },
});

// ── ASPECT (て-form auxiliaries) ──────────────────────────────────────────────

reg({ id:'te-iru', label:'〜ている', aux:'いる', family:'aspect',
  tooltip:'progressive/resultant — te-form+いる; conjugates as ichidan.',
  apply(f): Form { return { kana: teForm(f) + 'いる', type: 'ichidan' }; },
});

reg({ id:'te-kuru', label:'〜てくる', aux:'くる', family:'aspect',
  tooltip:'come to / start — te-form+くる; conjugates as kuru.',
  apply(f): Form { return { kana: teForm(f) + 'くる', type: 'kuru' }; },
});

reg({ id:'te-iku', label:'〜ていく', aux:'いく', family:'aspect',
  tooltip:'go on / continuing away — te-form+いく; conjugates as godan-iku.',
  apply(f): Form { return { kana: teForm(f) + 'いく', type: 'godan-iku', euphony: 'iku' }; },
});

reg({ id:'te-shimau', label:'〜てしまう', aux:'しまう', family:'aspect',
  tooltip:'completely / regrettably — te-form+しまう; conjugates as godan-u.',
  apply(f): Form { return { kana: teForm(f) + 'しまう', type: 'godan' }; },
});

reg({ id:'te-oku', label:'〜ておく', aux:'おく', family:'aspect',
  tooltip:'do in advance — te-form+おく; conjugates as godan-k.',
  apply(f): Form { return { kana: teForm(f) + 'おく', type: 'godan' }; },
});

reg({ id:'te-aru', label:'〜てある', aux:'ある', family:'aspect',
  tooltip:'done & left (resultant) — te-form+ある; conjugates as godan-r-i.',
  apply(f): Form { return { kana: teForm(f) + 'ある', type: 'godan-r-i', aruNeg: true }; },
});

reg({ id:'te-shimau-colloq', label:'〜ちゃう', aux:'ちゃう／じゃう', family:'aspect',
  tooltip:'colloquial しまう — te→ちゃう; de→じゃう (飲んじゃう / 書いちゃう).',
  apply(f): Form {
    const te = teForm(f);
    const kana = te.endsWith('で')
      ? te.slice(0,-1) + 'じゃう'
      : te.slice(0,-1) + 'ちゃう';
    return { kana, type: 'godan' };
  },
});

// ── buildTower ────────────────────────────────────────────────────────────────

// kuru verbs: these specific terminals are written all-kana by convention
const KURU_NO_KANJI = new Set<FormType>(['volitional','imperative','conditional-ba']);

export function buildTower(verb: Verb, arg: TowerOpts | OpId[]): Tier[] {
  const ops: OpId[] = Array.isArray(arg) ? arg : optsToOps(arg);
  const tiers: Tier[] = [];
  const splice = (k: string) => verb.kanjiPrefix + k.slice(verb.prefixLen);

  // Base tier (always shows dictionary form)
  tiers.push({
    op: 'base', layer: 'base', type: baseForm(verb).type,
    kana: verb.kana, kanji: verb.kanji, romaji: verb.romaji,
    label: 'base', aux: '', gloss: verb.gloss,
    hlKana: [0, 0], hlKanji: [0, 0],
  });

  let form = baseForm(verb);
  // First op uses conjStem (suru-s / zuru), after that kana is cumulative
  // baseForm already stores conjStem; apply() uses base(f) = conjStem ?? kana.

  for (const opId of ops) {
    const op = OPS_MAP.get(opId);
    if (!op) throw new Error(`Unknown op: ${opId}`);
    const newForm = op.apply(form);
    // After the first op, conjStem is consumed — new form is the full string
    const prevKana  = tiers[tiers.length - 1].kana;
    const prevKanji = tiers[tiers.length - 1].kanji;
    const newKana   = newForm.kana;
    // kuru terminal forms (volitional/imperative/ba) are conventionally written all-kana
    const newKanji  = (verb.klass === 'kuru' && KURU_NO_KANJI.has(newForm.type))
      ? newKana
      : splice(newKana);
    tiers.push({
      op: opId, layer: opId, type: newForm.type,
      kana: newKana, kanji: newKanji, romaji: kanaToRomaji(newKana),
      label: opId, aux: op.aux, gloss: '',
      hlKana:  highlightRange(prevKana,  newKana),
      hlKanji: highlightRange(prevKanji, newKanji),
    });
    form = newForm;
  }
  return tiers;
}

// ── allowedOps ────────────────────────────────────────────────────────────────

const TE_AUX_OPS: Set<OpId> = new Set([
  'te-iru','te-kuru','te-iku','te-shimau','te-oku','te-aru','te-shimau-colloq',
]);
const DESIRE_OPS: Set<OpId> = new Set(['tai','yasui','nikui','tagaru']);
const VOICE_OPS: Set<OpId> = new Set(['causative','passive','potential','causative-passive']);

export function allowedOps(form: Form, stack: OpId[]): OpId[] {
  // Global depth cap
  if (stack.length >= 8) return [];

  const t = form.type;

  // Terminals
  if (t === 'volitional' || t === 'imperative' || t === 'conditional-ba'
      || t === 'te-form' || t === 'conditional-tara'
      || t === 'polite-past' || t === 'polite-neg-past' || t === 'polite-volitional') {
    return [];
  }

  let base: OpId[];

  if (t === 'plain-past' || t === 'i-adj-past') {
    base = ['tara'];
  } else if (t === 'polite-neg') {
    base = ['past', 'tara'];
  } else if (t === 'polite') {
    // des-polite (i-adj polite ends in です, not ます) → terminal
    if (!form.kana.endsWith('ます')) return [];
    base = ['past', 'negative', 'volitional', 'tara'];
  } else if (t === 'adverbial') {
    base = ['naru'];
  } else if (t === 'na-adjective') {
    base = ['naru', 'polite', 'past', 'negative'];
  } else if (t === 'i-adjective') {
    base = ['negative','past','negative-past','te','adverbial','ba','polite','sou','sugiru','naru','tara'];
  } else if (isVerb(t)) {
    base = [
      'causative','passive','potential','causative-passive',
      'tai','tagaru','yasui','nikui','naosu','sugiru',
      'te-iru','te-kuru','te-iku','te-shimau','te-shimau-colloq','te-oku','te-aru',
      'polite','negative','past','negative-past','te','volitional','imperative','ba','tara',
    ];
  } else {
    return [];
  }

  // ── Guards ────────────────────────────────────────────────────────────────
  const allowed = new Set(base);

  // Voice once
  const hasVoice = stack.some(id => VOICE_OPS.has(id));
  const hasCausative = stack.includes('causative');
  const hasPassive = stack.some(id => id === 'passive' || id === 'potential' || id === 'causative-passive');
  if (hasCausative) allowed.delete('causative');
  if (hasPassive)   { allowed.delete('passive'); allowed.delete('potential'); allowed.delete('causative-passive'); }
  if (hasVoice && !hasCausative) { allowed.delete('causative'); allowed.delete('causative-passive'); }
  if (hasVoice) { allowed.delete('causative-passive'); }

  // Desire once / not on adj (i-adjective already excluded above since verb-only ops)
  const hasDesire = stack.some(id => DESIRE_OPS.has(id));
  if (hasDesire) { DESIRE_OPS.forEach(id => allowed.delete(id)); }

  // Naosu once
  if (stack.includes('naosu')) allowed.delete('naosu');

  // sugiru guard: already ends in すぎ
  if (form.kana.endsWith('すぎ') || form.kana.endsWith('すぎる')) allowed.delete('sugiru');

  // Double-negation: disable negative directly after negative
  const lastOp = stack[stack.length - 1];
  if (lastOp === 'negative') { allowed.delete('negative'); allowed.delete('negative-past'); }

  // Aspect cap: at most 2 te-aux ops in stack
  const teAuxCount = stack.filter(id => TE_AUX_OPS.has(id)).length;
  if (teAuxCount >= 2) TE_AUX_OPS.forEach(id => allowed.delete(id));

  return [...allowed];
}

// ── OP_FAMILIES ───────────────────────────────────────────────────────────────

export const OP_FAMILIES: Record<OpFamily, OpId[]> = {
  core:      ['causative','passive','potential','causative-passive','polite','negative','past','negative-past','te'],
  desire:    ['tai','tagaru','yasui','nikui','naosu'],
  adjective: ['adverbial','sugiru','sou','naru'],
  aspect:    ['te-iru','te-kuru','te-iku','te-shimau','te-shimau-colloq','te-oku','te-aru'],
  mood:      ['volitional','imperative','ba','tara'],
};

export { OPS };

// ── Back-compat TowerOpts + optsToOps ─────────────────────────────────────────

export interface TowerOpts {
  causative: boolean;
  voice: 'none' | 'passive' | 'potential';
  polite: boolean;
  negative: boolean;
  past: boolean;
}

export function optsToOps(o: TowerOpts): OpId[] {
  const ops: OpId[] = [];
  if (o.causative)           ops.push('causative');
  if (o.voice === 'passive')  ops.push('passive');
  if (o.voice === 'potential') ops.push('potential');
  if (o.polite)              ops.push('polite');
  if (o.negative)            ops.push('negative');
  if (o.past)                ops.push('past');
  return ops;
}

// ── UI support exports (additive — do not change golden behaviour) ────────────

// Reduce the op stack to the final Form (what allowedOps needs). Mirrors the
// form progression inside buildTower without producing tiers.
export function finalForm(verb: Verb, ops: OpId[]): Form {
  let form = baseForm(verb);
  for (const opId of ops) {
    const op = OPS_MAP.get(opId);
    if (!op) throw new Error(`Unknown op: ${opId}`);
    form = op.apply(form);
  }
  return form;
}

// Per-op metadata (label / aux / family / tooltip) keyed by id, for the menu.
export const OP_META: Record<OpId, Op> = Object.fromEntries(
  OPS.map(o => [o.id, o]),
) as Record<OpId, Op>;

// Short human reason an op is currently disabled (for the grayed-menu tooltip).
// Returns null when the op IS allowed.
export function disabledReason(form: Form, stack: OpId[], op: OpId): string | null {
  if (allowedOps(form, stack).includes(op)) return null;
  const t = form.type;
  if (t === 'volitional' || t === 'imperative' || t === 'conditional-ba'
      || t === 'conditional-tara' || t === 'te-form'
      || t === 'polite-past' || t === 'polite-neg-past' || t === 'polite-volitional') {
    return 'terminal form — nothing more attaches';
  }
  if (stack.length >= 8) return 'tower depth limit reached';
  if (DESIRE_OPS.has(op) && t === 'i-adjective') return 'already an い-adjective — can’t re-want';
  if (DESIRE_OPS.has(op) && stack.some(id => DESIRE_OPS.has(id))) return 'a desire/ease layer is already applied';
  if (op === 'naosu' && stack.includes('naosu')) return '〜直す already applied';
  if (op === 'causative' && stack.includes('causative')) return 'causative can apply only once';
  if ((op === 'passive' || op === 'potential' || op === 'causative-passive')
      && stack.some(id => id === 'passive' || id === 'potential' || id === 'causative-passive')) {
    return 'voice can apply only once';
  }
  if (op === 'causative-passive' && stack.some(id => VOICE_OPS.has(id))) return 'voice can apply only once';
  if (op === 'sugiru' && (form.kana.endsWith('すぎ') || form.kana.endsWith('すぎる'))) return 'already ends in すぎ';
  if ((op === 'negative' || op === 'negative-past') && stack[stack.length - 1] === 'negative') {
    return 'double-negation is off by default';
  }
  if (TE_AUX_OPS.has(op) && stack.filter(id => TE_AUX_OPS.has(id)).length >= 2) {
    return 'aspect nesting limit reached';
  }
  return `not valid on a ${FORM_LABEL[t]} form`;
}
