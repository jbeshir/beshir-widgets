// The validation examples: designs with their expected blazon, gloss, verdict, signature and readability,
// and the worked blazons of the emitter. Shared by the library tests and the field-shape verdict tests.
//
// Rows 1–21 are the validation table. Their wording follows SCA house style:
//  - blazons are SCA house style (RULES §F): lower-case tinctures except Or, "cogwheel", a closing full stop,
//    and a posture left out where GoT Table 5 assumes it (row 21: "a dragon gules");
//  - rows 2, 14 and 17 name the tertiary group by its own rules: "on a bend Or three unicorns vert";
//  - messages for a group on an ordinary say "on the Or chief" rather than "on Or chief".
// Rows N1… are the worked examples of the emitter.

import type { Issue } from '../src/lib/heraldry';
import { arms, charge, div, group, ordinary } from './helpers';

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

const ord = (type: string, paint: string, extra: object = {}) => group(ordinary(type), paint, extra);
const chg = (id: string, paint: string, extra: object = {}, attrs: object = {}) => group(charge(id, attrs), paint, extra);

export const V: VCase[] = [
  {
    id: 'row 1', design: arms('azure', ord('bend', 'or')),
    blazon: 'Azure, a bend Or.', gloss: 'A blue shield with a gold diagonal band from top-left to bottom-right.',
    valid: true, signature: 'arms|az|P:o.bend:1:single:or', score: 1, band: 'bold',
  },
  {
    id: 'row 2', design: arms('azure', ord('bend', 'or', { charged: [chg('unicorn', 'vert', { count: 3 })] })),
    blazon: 'Azure, on a bend Or three unicorns vert.',
    gloss: 'A blue shield with a gold diagonal band from top-left to bottom-right, carrying three green unicorns rearing up.',
    valid: true, signature: 'arms|az|P:o.bend:1:single:or{T:c.unicorn.rampant:3:host:vt}', score: 7, band: 'busy',
  },
  {
    id: 'row 3', design: arms('gules', chg('lion', 'azure')),
    blazon: 'Gules, a lion azure.', gloss: 'A red shield with a blue lion rearing up.',
    valid: false, messages: ['Azure lion on Gules field: colour on colour'], codes: ['tincture'],
    signature: 'arms|gu|P:c.lion.rampant:1:single:az', score: 1, band: 'bold',
  },
  {
    id: 'row 4', design: arms('argent', ord('fess', 'or')),
    blazon: 'Argent, a fess Or.', gloss: 'A white shield with a gold horizontal band across the middle.',
    valid: false, messages: ['Or fess on Argent field: metal on metal'], codes: ['tincture'],
    signature: 'arms|ar|P:o.fess:1:single:or', score: 1, band: 'bold',
  },
  {
    id: 'row 5', design: arms('argent', ord('chief', 'or')),
    blazon: 'Argent, a chief Or.', gloss: 'A white shield with a gold band across the top.',
    valid: false, messages: ['Or chief on Argent field: metal on metal'], codes: ['tincture'],
    signature: 'arms|ar|R:o.chief:1:single:or', score: 1, band: 'bold',
  },
  {
    id: 'row 6', design: arms(div('per-pale', 'azure', 'vert')),
    blazon: 'Per pale azure and vert.', gloss: 'A shield split vertically, blue on the left and green on the right.',
    valid: true, signature: 'arms|per-pale(az,vt)', score: 3, band: 'fine',
  },
  {
    id: 'row 7', design: arms(div('per-pale', 'azure', 'vert'), chg('wolf', 'argent')),
    blazon: 'Per pale azure and vert, a wolf passant argent.',
    gloss: 'A shield split vertically, blue on the left and green on the right, with a white wolf walking.',
    valid: true, signature: 'arms|per-pale(az,vt)|P:c.wolf.passant:1:single:ar', score: 5, band: 'busy',
  },
  {
    id: 'row 8', design: arms(div('per-pale', 'azure', 'vert'), chg('wolf', 'gules')),
    blazon: 'Per pale azure and vert, a wolf passant gules.',
    gloss: 'A shield split vertically, blue on the left and green on the right, with a red wolf walking.',
    valid: false, messages: ['Gules wolf on Azure and Vert field: colour on colour (a two-colour field needs a metal charge)'], codes: ['tincture'],
    signature: 'arms|per-pale(az,vt)|P:c.wolf.passant:1:single:gu', score: 5, band: 'busy',
  },
  {
    id: 'row 9', design: arms(div('per-fess', 'azure', 'or'), chg('mullet', 'gules', { count: 3 })),
    blazon: 'Per fess azure and Or, three mullets gules.',
    gloss: 'A shield split horizontally, blue on top and gold below, with three red five-pointed stars, two above one.',
    valid: false, messages: ['The two upper Gules mullets lie on Azure: colour on colour'], codes: ['tincture'],
    signature: 'arms|per-fess(az,or)|P:c.mullet:3:rows-2-1:gu', score: 3, band: 'fine',
  },
  {
    id: 'row 10', design: arms('vert', ord('chevron', 'or'), chg('rose', 'argent', { count: 3 })),
    blazon: 'Vert, a chevron Or between three roses argent.',
    gloss: 'A green shield with a gold upside-down V and three white roses, two above and one below.',
    valid: true, signature: 'arms|vt|P:o.chevron:1:single:or|S>:c.rose:3:host:ar', score: 4, band: 'fine',
  },
  {
    id: 'row 11', design: arms('gules', chg('mullet', 'argent', { count: 3 }), ord('chief', 'or')),
    blazon: 'Gules, three mullets argent, a chief Or.',
    gloss: 'A red shield with three white five-pointed stars, two above one, and a gold band across the top.',
    valid: true, signature: 'arms|gu|P:c.mullet:3:rows-2-1:ar|R:o.chief:1:single:or', score: 3, band: 'fine',
  },
  {
    id: 'row 12', design: arms('sable', chg('wolf', 'or'), ord('bordure', 'argent')),
    blazon: 'Sable, a wolf passant Or, a bordure argent.', gloss: 'A black shield with a gold wolf walking and a white border around the edge.',
    valid: true, signature: 'arms|sa|P:c.wolf.passant:1:single:or|R:o.bordure:1:single:ar', score: 3, band: 'fine',
  },
  {
    id: 'row 13', design: arms(div('per-bend-sinister', 'sable', 'gules'), chg('sun', 'or')),
    blazon: 'Per bend sinister sable and gules, a sun Or.',
    gloss: 'A shield split diagonally from top-right to bottom-left, black above and red below, with a gold sun.',
    valid: true, signature: 'arms|per-bend-sinister(sa,gu)|P:c.sun:1:single:or', score: 4, band: 'fine',
  },
  {
    id: 'row 14', design: arms('or', ord('pale', 'sable', { charged: [chg('flame', 'or', { count: 3 })] })),
    blazon: 'Or, on a pale sable three flames Or.', gloss: 'A gold shield with a black vertical band down the middle, carrying three gold flames.',
    valid: true, signature: 'arms|or|P:o.pale:1:single:sa{T:c.flame:3:host:or}', score: 4, band: 'fine',
  },
  {
    // The message words an "Or bend on an Or section" as "part of the field".
    id: 'row 15', design: arms(div('per-pale', 'azure', 'or'), ord('bend', 'or')),
    blazon: 'Per pale azure and Or, a bend Or.',
    gloss: 'A shield split vertically, blue on the left and gold on the right, with a gold diagonal band from top-left to bottom-right.',
    valid: false, messages: ['Or bend lies on the Or part of the field: same tincture'], codes: ['tincture'],
    signature: 'arms|per-pale(az,or)|P:o.bend:1:single:or', score: 3, band: 'fine',
  },
  {
    id: 'row 16', design: arms(div('quarterly', 'purpure', 'or')),
    blazon: 'Quarterly purpure and Or.',
    gloss: 'A shield divided into four quarters, purple top-left and bottom-right, gold top-right and bottom-left.',
    valid: true, signature: 'arms|quarterly(pu,or)', score: 1, band: 'bold',
  },
  {
    id: 'row 17', design: arms('gules', ord('saltire', 'or', { charged: [chg('gear', 'azure')] })),
    blazon: 'Gules, on a saltire Or a cogwheel azure.', gloss: 'A red shield with a gold X-shaped cross, carrying a blue gear.',
    valid: true, signature: 'arms|gu|P:o.saltire:1:single:or{T:c.gear:1:host:az}', score: 4, band: 'fine',
  },
  {
    id: 'row 18', design: arms(div('per-pale', 'azure', 'vert'), ord('chevron', 'argent'), chg('wolf', 'or', { count: 3 })),
    blazon: 'Per pale azure and vert, a chevron argent between three wolves passant Or.',
    gloss: 'A shield split vertically, blue on the left and green on the right, with a white upside-down V and three gold wolves walking, two above and one below.',
    valid: true, signature: 'arms|per-pale(az,vt)|P:o.chevron:1:single:ar|S>:c.wolf.passant:3:host:or', score: 8, band: 'busy',
  },
  {
    id: 'row 19', design: arms('azure'),
    blazon: 'Azure.', gloss: 'A blue shield.',
    valid: false, messages: ['A plain field on its own is too generic to register — add an ordinary or a charge.'], codes: ['generic'],
    signature: 'arms|az', score: 0, band: 'bold',
  },
  {
    id: 'row 20', design: arms(div('per-pale', 'azure', 'azure')),
    valid: false, messages: ['A divided field needs two different tinctures — both parts are Azure.'], codes: ['structure'],
  },
  {
    id: 'row 21', design: arms('or', chg('dragon', 'gules')),
    blazon: 'Or, a dragon gules.', gloss: 'A gold shield with a red dragon rearing up.',
    valid: true, signature: 'arms|or|P:c.dragon.rampant:1:single:gu', score: 2, band: 'bold',
  },
];

/** The worked blazons of the emitter (PLAN §5.6): the design as input and the blazon it must give. */
export const N: Array<{ id: string; design: unknown; blazon: string }> = [
  { id: 'N1', design: arms('azure', ord('bend', 'or')), blazon: 'Azure, a bend Or.' },
  { id: 'N2', design: arms('azure', ord('bend', 'or', { charged: [chg('unicorn', 'vert', { count: 3 })] })), blazon: 'Azure, on a bend Or three unicorns vert.' },
  { id: 'N3', design: arms(div('per-pale', 'azure', 'vert'), chg('wolf', 'argent')), blazon: 'Per pale azure and vert, a wolf passant argent.' },
  { id: 'N4', design: arms('vert', ord('chevron', 'or'), chg('rose', 'argent', { count: 3 })), blazon: 'Vert, a chevron Or between three roses argent.' },
  { id: 'N5', design: arms('gules', chg('mullet', 'argent', { count: 3 }), ord('chief', 'or')), blazon: 'Gules, three mullets argent, a chief Or.' },
  { id: 'N6', design: arms('gules', chg('mullet', 'or', { count: 3 }), ord('chief', 'or')), blazon: 'Gules, three mullets and a chief Or.' },
  { id: 'N7', design: arms('sable', chg('wolf', 'or'), ord('bordure', 'argent')), blazon: 'Sable, a wolf passant Or, a bordure argent.' },
  { id: 'N8', design: arms('or', ord('pale', 'sable', { charged: [chg('flame', 'or', { count: 3 })] })), blazon: 'Or, on a pale sable three flames Or.' },
  { id: 'N9', design: arms('or', chg('dragon', 'gules')), blazon: 'Or, a dragon gules.' },
  { id: 'N10', design: arms('or', chg('rose', 'gules', { count: 2 })), blazon: 'Or, in pale two roses gules.' },
  { id: 'N11', design: arms(div('per-pale', 'or', 'azure'), chg('rose', 'counterchanged', { count: 2 })), blazon: 'Per pale Or and azure, two roses counterchanged.' },
  { id: 'N12', design: arms('vert', chg('rose', 'argent', { count: 5 })), blazon: 'Vert, five roses argent.' },
  { id: 'N13', design: arms('vert', chg('rose', 'argent', { count: 5, arrangement: 'in-saltire' })), blazon: 'Vert, five roses in saltire argent.' },
  { id: 'N14', design: arms('sable', chg('sword', 'or', { count: 2, arrangement: 'crossed' })), blazon: 'Sable, two swords in saltire Or.' },
  { id: 'N15', design: arms('azure', ord('fess', 'argent'), chg('crescent', 'argent', { count: 6 })), blazon: 'Azure, a fess between six crescents argent.' },
  {
    id: 'N16',
    design: arms('azure', ord('fess', 'or', { charged: [chg('rose', 'gules', { count: 3 })] }), chg('mullet', 'or', { count: 3 })),
    blazon: 'Azure, on a fess between three mullets Or three roses gules.',
  },
  {
    id: 'N17',
    design: arms('gules', chg('mullet', 'argent', { count: 3 }), ord('chief', 'or', { charged: [chg('rose', 'gules', { count: 3 })] })),
    blazon: 'Gules, three mullets argent, on a chief Or three roses gules.',
  },
  { id: 'N18', design: arms(div('per-fess', 'or', 'vert'), chg('fleur-de-lis', 'vert', { count: 3 })), blazon: 'Per fess Or and vert, three fleurs-de-lys vert.' },
  { id: 'N19', design: arms(div('per-chevron', 'vert', 'or'), chg('sun', 'or', { count: 2 }, { mods: [{ id: 'in-splendour' }] })), blazon: 'Per chevron vert and Or, two suns in splendor Or.' },
  { id: 'N20', design: arms('argent', chg('hare', 'sable', {}, { posture: 'courant' })), blazon: 'Argent, a hare courant sable.' },
  { id: 'N21', design: arms('gules', chg('gear', 'or')), blazon: 'Gules, a cogwheel Or.' },
  { id: 'N22', design: arms('argent', chg('mullet', 'gules', { count: 8, arrangement: 'in-orle' })), blazon: 'Argent, eight mullets in orle gules.' },
  { id: 'N23', design: arms('or', chg('mullet', 'azure', { count: 3, arrangement: 'in-chief' })), blazon: 'Or, in chief three mullets azure.' },
  { id: 'N24', design: arms(div('per-pale', 'argent', 'gules'), ord('fess', 'counterchanged')), blazon: 'Per pale argent and gules, a fess counterchanged.' },
  { id: 'N25', design: arms(div('per-bend', 'argent', 'sable'), chg('rose', 'gules'), ord('chief', 'gules')), blazon: 'Per bend argent and sable, a rose and a chief gules.' },
  { id: 'N26', design: arms(div('quarterly', 'purpure', 'or')), blazon: 'Quarterly purpure and Or.' },
  { id: 'N27', design: arms('azure'), blazon: 'Azure.' },
];
