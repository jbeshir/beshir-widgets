// The semy as a charge group (SENA App I1, I2b; GoT "Semy"): structure and conflict read the strewn charges as a group of their own.
// A semy on the field is the primary group when nothing stands in the middle and a secondary group when something does; a semy on a
// band is a tertiary group on it. `liftStrewn` states a design with its semys as such groups, and plain grounds beneath them.

import { capitalise } from './words';
import { CHARGES } from './charges';
import {
  asSemy, canonical, fieldParts, fieldSemys, groupAt, itemName, primaryGroups, walkGroups,
  type Charge, type Design, type Group, type GroupPath, type Issue, type Paint, type SemyPaint,
} from './design';

/** How many charges a semy counts as: "four or more" for the number of a primary group, "six or more" for a distinct change of number (A5E3, A5G5). */
export const STREWN_COUNT = 6;

export interface Strewn { role: 'primary' | 'secondary' | 'tertiary'; host: GroupPath | null; semy: SemyPaint }

/** The semys of a design as the groups they are: those of the field, then those on bands in canonical group order. */
export function strewnGroups(d: Design): Strewn[] {
  const role = primaryGroups(d).length > 0 ? 'secondary' : 'primary';
  const onBands = walkGroups(d).flatMap(({ path, group }) => {
    const semy = asSemy(group.paint);
    return semy ? [{ role: 'tertiary' as const, host: path, semy }] : [];
  });
  return [...fieldSemys(d).map((semy): Strewn => ({ role, host: null, semy })), ...onBands];
}

/** The charge a semy strews, in the posture it is drawn in. */
function strewnCharge({ charge, form }: SemyPaint['charge']): Charge {
  const meta = CHARGES[charge];
  return { k: 'charge', charge, form, posture: meta.defaultPosture, facing: meta.defaultFacing, orientation: null, mods: [], parts: [], holds: [] };
}

const strewnGroup = (role: Group['role'], semy: SemyPaint, paint: Paint = semy.ink): Group => ({
  role, relation: null, item: strewnCharge(semy.charge), count: STREWN_COUNT, arrangement: role === 'tertiary' ? { k: 'host' } : { k: 'single' },
  position: null, paint, charged: [],
});

/** A paint with its semy taken out: the plain tincture it was strewn on. */
const grounded = (p: Paint): Paint => asSemy(p)?.ground ?? p;

function liftedGroup(g: Group): Group {
  const semy = asSemy(g.paint);
  return { ...g, paint: grounded(g.paint), charged: [...g.charged.map(liftedGroup), ...(semy ? [strewnGroup('tertiary', semy)] : [])] };
}

/** The design with each semy as the charge group it is and its ground as the paint it lay on: what conflict compares. */
export function liftStrewn(d: Design): Design {
  const strewn = strewnGroups(d);
  if (strewn.length === 0) return d;
  // The same charge in the same tincture on two parts of the field is one group of charges, and so is one in each other's tincture: counterchanged.
  const alike = (s: Strewn, i: number, all: readonly Strewn[]) => all.findIndex((o) => o.semy.charge.charge === s.semy.charge.charge && o.semy.ink.t === s.semy.ink.t) === i;
  const onField = strewn.filter((s) => s.host === null);
  const [first, second] = onField;
  const swapped = onField.length === 2 && first.semy.charge.charge === second.semy.charge.charge && first.semy.ink.t === second.semy.ground.t && second.semy.ink.t === first.semy.ground.t;
  const own = swapped ? [strewnGroup(first.role, first.semy, { k: 'counterchanged' })] : onField.filter(alike).map((s) => strewnGroup(s.role, s.semy));
  const groups = [...d.groups.map(liftedGroup), ...own];
  if (d.kind === 'badge') return canonical({ ...d, groups });
  const field = d.field.k === 'divided' ? { ...d.field, parts: fieldParts(d).map(grounded) } : grounded(d.field);
  return canonical({ ...d, field, groups });
}

/**
 * The structural problems of the semys: the charge of a semy on the field can't be used again in another group on it (SENA A3D1a),
 * and a band carries one group of charges, a semy or something else (App I3).
 */
export function strewnIssues(d: Design): Issue[] {
  return strewnGroups(d).flatMap(({ role, host, semy }): Issue[] => {
    const plural = capitalise(CHARGES[semy.charge.charge].plural);
    if (role === 'tertiary' && host) {
      const band = groupAt(d, host);
      return band.charged.length === 0 ? [] : [{
        code: 'structure', rule: 'relation', at: { k: 'group', path: host }, slots: [],
        message: `Only one group of charges can sit on the ${itemName(band.item)} (SENA App I3) — ${plural.toLowerCase()} strewn on it are one.`,
      }];
    }
    const again = d.groups.findIndex((g) => g.role !== 'peripheral' && g.item.k === 'charge' && g.item.charge === semy.charge.charge);
    return again < 0 ? [] : [{
      code: 'structure', rule: 'same-type', at: { k: 'group', path: [again] }, slots: [],
      message: `${plural} are strewn on the field, so they can't be used again in another group on it (SENA A3D1a) — choose a different picture.`,
    }];
  });
}
