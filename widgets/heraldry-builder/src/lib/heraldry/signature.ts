// Canonical signature of a supported design: equal for equivalent inputs, so "you can't blazon your way
// out" of a duplicate, and different for any two different canonical designs.

import { TINCTURE_CODE } from './tinctures';
import { notSupported, type Design, type Group, type Item, type Paint, type Role } from './design';
import { layoutKey } from './arrangement';
import { paintGaps } from './support';

const ROLE_CODE: Record<Role, string> = { primary: 'P', secondary: 'S', peripheral: 'R', overall: 'O', tertiary: 'T' };

function paint(p: Paint): string {
  switch (p.k) {
    case 'tincture': return TINCTURE_CODE[p.t];
    case 'fur': return p.colours ? `${p.fur}(${p.colours.map((t) => TINCTURE_CODE[t]).join(',')})` : p.fur;
    case 'counterchanged': return 'cc';
    case 'proper': return 'proper';
    case 'treated': return `${p.treatment}(${paint(p.ground)},${TINCTURE_CODE[p.ink]})`;
    case 'divided': return `${p.division}(${p.parts.map(paint).join(',')})`;
    // Checky is the same with either tincture first (Prec #FIELDCheck).
    case 'variation': return `${p.variation}${p.pieces ?? ''}(${(p.variation === 'checky' ? p.parts.map(paint).sort() : p.parts.map(paint)).join(',')})`;
    default: return notSupported(paintGaps(p, true, 'field')[0]);
  }
}

function item(i: Item): string {
  return i.k === 'ordinary' ? `o.${i.type}` : `c.${i.charge}${i.posture ? `.${i.posture}` : ''}${i.mods.map((m) => `+${m.id}`).join('')}`;
}

function group(g: Group): string {
  const head = `${ROLE_CODE[g.role]}${g.relation === 'between' ? '>' : ''}:${item(g.item)}:${g.count}:${layoutKey({ arrangement: g.arrangement, position: g.position })}:${paint(g.paint)}`;
  return g.charged.length > 0 ? `${head}{${g.charged.map(group).join('|')}}` : head;
}

export function signature(d: Design): string {
  if (d.kind === 'badge') return notSupported({ category: 'fieldless', detail: 'badge' });
  return ['arms', paint(d.field), ...d.groups.map(group)].join('|');
}
