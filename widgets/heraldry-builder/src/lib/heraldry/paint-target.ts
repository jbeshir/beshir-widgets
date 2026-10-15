// A place in a design whose paint the builder changes one piece at a time (a fur, a treatment): a part of the field, or a band or
// picture, and what makes a paint there acceptable.


import { canonical, groupAt, replaceGroup, type Design, type GroupPath, type Paint } from './design';
import { paintIssues } from './structure';
import { groupTinctureIssues } from './tincture-rule';


/** The part of the design a paint is chosen for: a part of the field (the whole field when it is not divided is part 0), or a band or picture. */
export type PaintTarget = { k: 'field'; part: 0 | 1 } | { k: 'group'; path: GroupPath };


const samePath = (a: GroupPath, b: GroupPath) => a.length === b.length && a.every((x, i) => x === b[i]);


/** The paint at the target. */
export function paintAt(d: Design, target: PaintTarget): Paint {
  if (target.k === 'group') return groupAt(d, target.path).paint;
  if (d.kind !== 'arms') throw new RangeError('A fieldless design has no field to paint.');
  return d.field.k === 'divided' ? d.field.parts[target.part] : d.field;
}


/** The design with the target painted `paint`, in canonical form. */
export function painted(d: Design, target: PaintTarget, paint: Paint): Design {
  if (target.k === 'group') return canonical(replaceGroup(d, target.path, { ...groupAt(d, target.path), paint }));
  if (d.kind !== 'arms') return d;
  const f = d.field;
  return canonical({ ...d, field: f.k === 'divided' ? { ...f, parts: f.parts.map((p, i) => (i === target.part ? paint : p)) } : paint });
}


/** Why the target can't be painted as it is, or null: the rule on the field's parts, or the rule of tincture where the group lies. */
export function reasonAt(d: Design, target: PaintTarget): string | null {
  const issues = paintIssues(d);
  if (target.k === 'field') return issues.find((i) => i.at.k === 'field')?.message ?? null;
  const own = issues.find((i) => i.at.k === 'group' && samePath(i.at.path, target.path));
  return own?.message ?? groupTinctureIssues(d, target.path)[0]?.message ?? null;
}
