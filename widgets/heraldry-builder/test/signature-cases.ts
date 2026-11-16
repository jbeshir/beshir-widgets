// Designs phase B could draw, for pinning their signatures (signature.test.ts): stored rows keep their UNIQUE key.

import { arms, charge, div, group, ordinary, plain } from './helpers';

const chg = (id: string, paint: unknown, extra: object = {}, attrs: object = {}) => group(charge(id, attrs), paint, extra);
const ord = (type: string, paint: unknown, extra: object = {}) => group(ordinary(type), paint, extra);

export const PINNED: Array<[string, unknown]> = [
  ['a lion', arms('azure', chg('lion', 'or'))],
  ['per pale, a lion', arms(div('per-pale', 'argent', 'azure'), chg('lion', 'gules'))],
  ['barry of four, a mullet', arms({ k: 'variation', variation: 'barry', pieces: 4, parts: ['or', 'sable'] }, chg('mullet', 'argent'))],
  ['paly, a rose', arms({ k: 'variation', variation: 'paly', parts: ['argent', 'gules'] }, chg('rose', 'or'))],
  ['checky, a chief', arms({ k: 'variation', variation: 'checky', parts: ['or', 'azure'] }, ord('chief', 'gules'))],
  ['a fess', arms('or', ord('fess', 'gules'))],
  ['a fess between three mullets', arms('azure', ord('fess', 'or'), chg('mullet', 'argent', { count: 3, relation: 'between' }))],
  ['a chief and a bordure', arms('argent', chg('lion', 'sable'), ord('chief', 'gules'), ord('bordure', 'azure'))],
  ['on a pale three keys', arms('gules', ord('pale', 'argent', { charged: [chg('key', 'sable', { count: 3 })] }))],
  ['quarterly, roses counterchanged', arms(div('quarterly', 'or', 'gules'), chg('rose', 'counterchanged', { count: 4 }))],
  ['per chevron, three crescents', arms(div('per-chevron', 'argent', 'vert'), chg('crescent', 'or', { count: 3 }))],
  ['per saltire, a heart', arms(div('per-saltire', 'or', 'azure'), chg('heart', 'gules'))],
  ['ermine, a chief', arms({ k: 'fur', fur: 'ermine' }, ord('chief', 'gules'))],
  ['a bend per pale', arms('or', ord('bend', div('per-pale', 'azure', 'gules')))],
  ['a fieldless rose', { v: 2, kind: 'badge', groups: [chg('rose', 'gules')] }],
  ['plain field, two wolves', arms(plain('vert'), chg('wolf', 'argent', { count: 2 }))],
];
