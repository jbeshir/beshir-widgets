import { makeVerb, kanaToRomaji, OP_META, baseForm, allowedOps } from './engine';
import type { Verb, OpId, DictEntry } from './engine';

const KNOWN_RAW_CLASSES = new Set<string>([
  'godan-u', 'godan-k', 'godan-g', 'godan-s', 'godan-t',
  'godan-n', 'godan-b', 'godan-m', 'godan-r',
  'godan-iku', 'godan-u-s', 'godan-r-i', 'godan-aru',
  'ichidan', 'ichidan-kureru',
  'zuru',
  'suru', 'vs-i', 'suru-noun', 'suru-s',
  'kuru',
  'i-adjective',
]);

export function serializeState(verb: Verb, ops: OpId[]): string {
  const params = new URLSearchParams();
  params.set('k', verb.kanji);
  params.set('r', verb.kana);
  params.set('c', verb.rawClass ?? '');
  if (ops.length > 0) {
    params.set('o', ops.join(','));
  }
  return params.toString();
}

export function parseState(search: string): { verb: Verb; ops: OpId[] } | null {
  try {
    const params = new URLSearchParams(search);
    const k = params.get('k');
    const r = params.get('r');
    const c = params.get('c');

    if (!k || !r || !c) return null;
    if (!KNOWN_RAW_CLASSES.has(c)) return null;

    const entry: DictEntry = {
      k, r,
      romaji: kanaToRomaji(r),
      cls: c,
      common: true,
      gloss: '',
    };
    const verb = makeVerb(entry);

    const oParam = params.get('o');
    const ops: OpId[] = [];

    if (oParam && oParam.trim() !== '') {
      for (const raw of oParam.split(',')) {
        const op = raw.trim() as OpId;
        if (!OP_META[op]) return null;
        ops.push(op);
      }
    }

    // Validate the full sequence is reachable
    let form = baseForm(verb);
    const stackSoFar: OpId[] = [];
    for (const op of ops) {
      if (!allowedOps(form, stackSoFar).includes(op)) return null;
      stackSoFar.push(op);
      form = OP_META[op].apply(form);
    }

    return { verb, ops };
  } catch {
    return null;
  }
}
