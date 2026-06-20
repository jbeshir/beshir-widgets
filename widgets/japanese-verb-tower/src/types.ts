// Typed rewrite system — Form, FormType, OpId, Tier.

export type FormType =
  | 'godan' | 'godan-iku' | 'godan-u-s' | 'godan-r-i' | 'godan-aru'
  | 'ichidan' | 'suru' | 'kuru'
  | 'i-adjective' | 'na-adjective' | 'adverbial' | 'te-form'
  | 'volitional' | 'imperative' | 'conditional-ba' | 'conditional-tara'
  | 'plain-past' | 'i-adj-past'
  | 'polite' | 'polite-neg' | 'polite-past' | 'polite-neg-past' | 'polite-volitional'
  | 'must' | 'must-not' | 'must-polite';

export interface Form {
  kana: string;
  type: FormType;
  conjStem?: string;    // suru-s / zuru base conjugation stem
  suruPrefix?: string;  // '' for する; 'べんきょう' for 勉強する
  euphony?: 'iku' | 'u-s';
  aruNeg?: boolean;
  aruPolite?: boolean;
  iiAdj?: boolean;      // いい/良い irregular adjective
}

export type OpId =
  | 'causative' | 'passive' | 'potential' | 'causative-passive'
  | 'polite' | 'negative' | 'past' | 'negative-past' | 'te' | 'adverbial'
  | 'tai' | 'tagaru' | 'yasui' | 'nikui' | 'sugiru' | 'sou' | 'naru'
  | 'volitional' | 'imperative' | 'ba' | 'tara'
  | 'te-iru' | 'te-kuru' | 'te-iku' | 'te-shimau' | 'te-oku' | 'te-aru'
  | 'te-shimau-colloq'
  | 'naosu'
  | 'hajimeru' | 'owaru' | 'tsuzukeru' | 'dasu'
  | 'must' | 'must-not';

// Tier — keeps legacy `layer` field for App.tsx compat; adds `op` + `type`.
export interface Tier {
  op: 'base' | OpId;
  layer: 'base' | OpId;   // alias for op (backwards compat with App.tsx)
  type: FormType;
  kana: string;
  kanji: string;
  romaji: string;
  label: string;
  aux: string;
  gloss: string;
  hlKana: [number, number];
  hlKanji: [number, number];
}

// Short UI badge labels for each FormType.
export const FORM_LABEL: Record<FormType, string> = {
  'godan':              'godan',
  'godan-iku':          'godan',
  'godan-u-s':          'godan',
  'godan-r-i':          'godan',
  'godan-aru':          'godan',
  'ichidan':            'ichidan',
  'suru':               'suru',
  'kuru':               'kuru',
  'i-adjective':        'い-adj',
  'na-adjective':       'な-adj',
  'adverbial':          'adverb',
  'te-form':            'て-form',
  'volitional':         'volitional',
  'imperative':         'imperative',
  'conditional-ba':     '〜ば',
  'conditional-tara':   '〜たら',
  'plain-past':         'past',
  'i-adj-past':         'adj-past',
  'polite':             'polite',
  'polite-neg':         'polite-neg',
  'polite-past':        'polite-past',
  'polite-neg-past':    'polite-neg-past',
  'polite-volitional':  'polite-vol',
  'must':              'must',
  'must-not':          'must-not',
  'must-polite':       'polite',
};

export type OpFamily = 'core' | 'desire' | 'compound' | 'adjective' | 'aspect' | 'mood';
