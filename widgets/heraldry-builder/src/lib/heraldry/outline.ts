// The outline of a band or shape as the builder offers it: none, edged in a tincture (fimbriated), or with one, two or three
// narrow bands along each side (cotised). The design holds them as `fimbriated` and `cotised` on the ordinary; one outline is
// all the builder reaches, so the two never stand together here.

import { canonical, groupAt, replaceGroup, type Design, type GroupPath, type Ordinary, type Paint } from './design';

export const OUTLINES = ['none', 'fimbriated', 'cotised', 'doubly-cotised', 'triply-cotised'] as const;
export type Outline = (typeof OUTLINES)[number];

const COTISE_COUNT = { cotised: 1, 'doubly-cotised': 2, 'triply-cotised': 3 } as const;
const OUTLINE_OF_COUNT = { 1: 'cotised', 2: 'doubly-cotised', 3: 'triply-cotised' } as const;

/** The outline the band or shape has; a fimbriated and cotised one (which the builder can't reach) is read as fimbriated. */
export function outlineOf(item: Ordinary): Outline {
  return item.fimbriated ? 'fimbriated' : item.cotised ? OUTLINE_OF_COUNT[item.cotised.count] : 'none';
}

/** The paint of the outline's trim: the tincture it is edged or cotised in; null when there is none. */
export function outlinePaintOf(item: Ordinary): Paint | null {
  return item.fimbriated ?? item.cotised?.paint ?? null;
}

/** The band or shape with this outline in this paint; cotises keep the line they had, else follow the band's own. */
export function withOutline(item: Ordinary, outline: Outline, paint: Paint): Ordinary {
  if (outline === 'none') return { ...item, cotised: null, fimbriated: null };
  if (outline === 'fimbriated') return { ...item, cotised: null, fimbriated: paint };
  return { ...item, fimbriated: null, cotised: { count: COTISE_COUNT[outline], paint, line: item.cotised?.line ?? item.lines.a } };
}

/** The design with the outline of the band or shape at `path` in this paint (canonical). */
export function withOutlinePaint(d: Design, path: GroupPath, paint: Paint): Design {
  const group = groupAt(d, path);
  return group.item.k === 'ordinary' ? canonical(replaceGroup(d, path, { ...group, item: withOutline(group.item, outlineOf(group.item), paint) })) : d;
}
