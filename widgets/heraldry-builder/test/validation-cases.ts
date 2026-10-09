// The validation examples: designs with their expected blazon, gloss, verdict, signature and
// readability. Shared by the library tests and the field-shape verdict tests.

import type { Issue } from '../src/lib/heraldry';

const plain = (tincture: string) => ({ kind: 'plain', tincture });
const div = (division: string, t1: string, t2: string) => ({ kind: 'divided', division, tinctures: [t1, t2] });

export interface VCase {
  id: string;
  design: unknown;
  blazon?: string;
  gloss?: string;
  valid: boolean;
  /** Exact messages (in order) when invalid. */
  messages?: string[];
  codes?: Issue['code'][];
  signature?: string;
  score?: number;
  band?: 'bold' | 'fine' | 'busy';
}

export const V: VCase[] = [
  {
    id: 'V1', design: { v: 1, field: plain('azure'), ordinary: { type: 'bend', tincture: 'or' } },
    blazon: 'Azure, a bend Or', gloss: 'A blue shield with a gold diagonal band from top-left to bottom-right.',
    valid: true, signature: 'v1|F:plain:az|O:bend:or|C:-', score: 1, band: 'bold',
  },
  {
    id: 'V2',
    design: { v: 1, field: plain('azure'), ordinary: { type: 'bend', tincture: 'or' },
      charges: { charge: 'unicorn', count: 3, placement: 'ordinary', arrangement: 'forced', posture: 'rampant', tincture: 'vert' } },
    blazon: 'Azure, on a bend Or three unicorns rampant Vert',
    gloss: 'A blue shield with a gold diagonal band from top-left to bottom-right, carrying three green unicorns rearing up.',
    valid: true, signature: 'v1|F:plain:az|O:bend:or|C:unicorn:3:ordinary:forced:rampant:vt', score: 6, band: 'fine',
  },
  {
    id: 'V3', design: { v: 1, field: plain('gules'), charges: { charge: 'lion', count: 1, placement: 'field', posture: 'rampant', tincture: 'azure' } },
    blazon: 'Gules, a lion rampant Azure', gloss: 'A red shield with a blue lion rearing up.',
    valid: false, messages: ['Azure lion on Gules field: colour on colour'], codes: ['tincture'],
    signature: 'v1|F:plain:gu|O:-|C:lion:1:field:single:rampant:az', score: 2, band: 'bold',
  },
  {
    id: 'V4', design: { v: 1, field: plain('argent'), ordinary: { type: 'fess', tincture: 'or' } },
    blazon: 'Argent, a fess Or', gloss: 'A white shield with a gold horizontal band across the middle.',
    valid: false, messages: ['Or fess on Argent field: metal on metal'], codes: ['tincture'],
    signature: 'v1|F:plain:ar|O:fess:or|C:-', score: 1, band: 'bold',
  },
  {
    id: 'V5', design: { v: 1, field: plain('argent'), ordinary: { type: 'chief', tincture: 'or' } },
    blazon: 'Argent, a chief Or', gloss: 'A white shield with a gold band across the top.',
    valid: false, messages: ['Or chief on Argent field: metal on metal'], codes: ['tincture'],
    signature: 'v1|F:plain:ar|O:chief:or|C:-', score: 1, band: 'bold',
  },
  {
    id: 'V6', design: { v: 1, field: div('per-pale', 'azure', 'vert') },
    blazon: 'Per pale Azure and Vert', gloss: 'A shield split vertically, blue on the left and green on the right.',
    valid: true, signature: 'v1|F:per-pale:az:vt|O:-|C:-', score: 1, band: 'bold',
  },
  {
    id: 'V7', design: { v: 1, field: div('per-pale', 'azure', 'vert'), charges: { charge: 'wolf', count: 1, placement: 'field', posture: 'passant', tincture: 'argent' } },
    blazon: 'Per pale Azure and Vert, a wolf passant Argent',
    gloss: 'A shield split vertically, blue on the left and green on the right, with a white wolf walking.',
    valid: true, signature: 'v1|F:per-pale:az:vt|O:-|C:wolf:1:field:single:passant:ar', score: 4, band: 'fine',
  },
  {
    id: 'V8', design: { v: 1, field: div('per-pale', 'azure', 'vert'), charges: { charge: 'wolf', count: 1, placement: 'field', posture: 'passant', tincture: 'gules' } },
    blazon: 'Per pale Azure and Vert, a wolf passant Gules',
    gloss: 'A shield split vertically, blue on the left and green on the right, with a red wolf walking.',
    valid: false, messages: ['Gules wolf on Azure and Vert field: colour on colour (a two-colour field needs a metal charge)'], codes: ['tincture'],
    signature: 'v1|F:per-pale:az:vt|O:-|C:wolf:1:field:single:passant:gu', score: 4, band: 'fine',
  },
  {
    id: 'V9', design: { v: 1, field: div('per-fess', 'azure', 'or'), charges: { charge: 'mullet', count: 3, placement: 'field', arrangement: 'two-and-one', tincture: 'gules' } },
    blazon: 'Per fess Azure and Or, three mullets Gules',
    gloss: 'A shield split horizontally, blue on top and gold below, with three red five-pointed stars, two above one.',
    valid: false, messages: ['The two upper Gules mullets lie on Azure: colour on colour'], codes: ['tincture'],
    signature: 'v1|F:per-fess:az:or|O:-|C:mullet:3:field:two-and-one:-:gu', score: 4, band: 'fine',
  },
  {
    id: 'V10', design: { v: 1, field: plain('vert'), ordinary: { type: 'chevron', tincture: 'or' }, charges: { charge: 'rose', count: 3, placement: 'field', tincture: 'argent' } },
    blazon: 'Vert, a chevron Or between three roses Argent', gloss: 'A green shield with a gold upside-down V and three white roses, two above and one below.',
    valid: true, signature: 'v1|F:plain:vt|O:chevron:or|C:rose:3:field:forced:-:ar', score: 4, band: 'fine',
  },
  {
    id: 'V11', design: { v: 1, field: plain('gules'), ordinary: { type: 'chief', tincture: 'or' }, charges: { charge: 'mullet', count: 3, placement: 'field', arrangement: 'two-and-one', tincture: 'argent' } },
    blazon: 'Gules, three mullets Argent, a chief Or',
    gloss: 'A red shield with three white five-pointed stars, two above one, and a gold band across the top.',
    valid: true, signature: 'v1|F:plain:gu|O:chief:or|C:mullet:3:field:two-and-one:-:ar', score: 4, band: 'fine',
  },
  {
    id: 'V12', design: { v: 1, field: plain('sable'), ordinary: { type: 'bordure', tincture: 'argent' }, charges: { charge: 'wolf', count: 1, placement: 'field', posture: 'passant', tincture: 'or' } },
    blazon: 'Sable, a wolf passant Or within a bordure Argent', gloss: 'A black shield with a gold wolf walking and a white border around the edge.',
    valid: true, signature: 'v1|F:plain:sa|O:bordure:ar|C:wolf:1:field:single:passant:or', score: 4, band: 'fine',
  },
  {
    id: 'V13', design: { v: 1, field: div('per-bend-sinister', 'sable', 'gules'), charges: { charge: 'sun', count: 1, placement: 'field', tincture: 'or' } },
    blazon: 'Per bend sinister Sable and Gules, a sun Or',
    gloss: 'A shield split diagonally from top-right to bottom-left, black above and red below, with a gold sun.',
    valid: true, signature: 'v1|F:per-bend-sinister:sa:gu|O:-|C:sun:1:field:single:-:or', score: 3, band: 'bold',
  },
  {
    id: 'V14', design: { v: 1, field: plain('or'), ordinary: { type: 'pale', tincture: 'sable' }, charges: { charge: 'flame', count: 3, placement: 'ordinary', tincture: 'or' } },
    blazon: 'Or, on a pale Sable three flames Or', gloss: 'A gold shield with a black vertical band down the middle, carrying three gold flames.',
    valid: true, signature: 'v1|F:plain:or|O:pale:sa|C:flame:3:ordinary:forced:-:or', score: 4, band: 'fine',
  },
  {
    // FINDINGS words this "Or bend lies on an Or section: same tincture"; the generator says "part of the field".
    id: 'V15', design: { v: 1, field: div('per-pale', 'azure', 'or'), ordinary: { type: 'bend', tincture: 'or' } },
    blazon: 'Per pale Azure and Or, a bend Or',
    gloss: 'A shield split vertically, blue on the left and gold on the right, with a gold diagonal band from top-left to bottom-right.',
    valid: false, messages: ['Or bend lies on the Or part of the field: same tincture'], codes: ['tincture'],
    signature: 'v1|F:per-pale:az:or|O:bend:or|C:-', score: 2, band: 'bold',
  },
  {
    id: 'V16', design: { v: 1, field: div('quarterly', 'purpure', 'or') },
    blazon: 'Quarterly Purpure and Or',
    gloss: 'A shield divided into four quarters, purple top-left and bottom-right, gold top-right and bottom-left.',
    valid: true, signature: 'v1|F:quarterly:pu:or|O:-|C:-', score: 2, band: 'bold',
  },
  {
    id: 'V17', design: { v: 1, field: plain('gules'), ordinary: { type: 'saltire', tincture: 'or' }, charges: { charge: 'gear', count: 1, placement: 'ordinary', tincture: 'azure' } },
    blazon: 'Gules, on a saltire Or a gear Azure', gloss: 'A red shield with a gold X-shaped cross, carrying a blue gear.',
    valid: true, signature: 'v1|F:plain:gu|O:saltire:or|C:gear:1:ordinary:single:-:az', score: 4, band: 'fine',
  },
  {
    id: 'V18', design: { v: 1, field: div('per-pale', 'azure', 'vert'), ordinary: { type: 'chevron', tincture: 'argent' }, charges: { charge: 'wolf', count: 3, placement: 'field', posture: 'passant', tincture: 'or' } },
    blazon: 'Per pale Azure and Vert, a chevron Argent between three wolves passant Or',
    gloss: 'A shield split vertically, blue on the left and green on the right, with a white upside-down V and three gold wolves walking, two above and one below.',
    valid: true, signature: 'v1|F:per-pale:az:vt|O:chevron:ar|C:wolf:3:field:forced:passant:or', score: 7, band: 'busy',
  },
  {
    id: 'V19', design: { v: 1, field: plain('azure') },
    blazon: 'Azure', gloss: 'A blue shield.',
    valid: false, messages: ['A plain field on its own is too generic to register — add an ordinary or a charge.'], codes: ['generic'],
    signature: 'v1|F:plain:az|O:-|C:-', score: 0, band: 'bold',
  },
  {
    id: 'V20', design: { v: 1, field: div('per-pale', 'azure', 'azure') },
    valid: false, messages: ['A divided field needs two different tinctures — both parts are Azure.'], codes: ['structure'],
  },
  {
    id: 'V21', design: { v: 1, field: plain('or'), charges: { charge: 'dragon', count: 1, placement: 'field', tincture: 'gules' } },
    blazon: 'Or, a dragon segreant Gules', gloss: 'A gold shield with a red dragon rearing up.',
    valid: true, signature: 'v1|F:plain:or|O:-|C:dragon:1:field:single:rampant:gu', score: 2, band: 'bold',
  },
];
