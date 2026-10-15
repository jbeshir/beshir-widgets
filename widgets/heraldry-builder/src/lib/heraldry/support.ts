// What phase A draws. Everything else is well-formed but "unsupported": `unsupportedIssues` names each
// construct the builder doesn't offer, with a gap the SCA test files the design under. The one "not yet
// drawable" guard, `notSupported`, lives in design.ts and is re-exported here.

import { FUR_NAME, FUR_SPEC, STAIN_NAME } from './tinctures';
import { capitalise } from './words';
import { CHARGES, isChargeId } from './charges';
import { chargeOnBox } from './charge-art';
import { DIVISION_NAME, DRAWN_DIVISIONS, DRAWN_TREATMENTS, VARIATION_PIECES } from './divisions';
import {
  asParty, asSemy, asTreated, walkGroups, type Design, type Gap, type GapCategory, type Group, type GroupPath, type IssueAt, type Item, type Paint, type UnsupportedIssue,
} from './design';
import { DRAWN_ORDINARIES, OVERALL_ORDINARIES, ORDINARY_ARTICLE, ORDINARY_KIND, ORDINARY_NAME, isOrdinaryType } from './ordinaries';
import {
  AROUND_COUNTS, MAX_CO_PRIMARY_TOTAL, ON_CHARGE_COUNTS, coPrimaries, aroundPrimaryLayouts, halfLayouts, hostCounts, isHalfPosition, isSecondaryPosition, layoutKey, overallLayouts, positionLayouts, primaryCharges, primaryOrdinary, ROW_PATTERNS, sameLayout,
} from './arrangement';

export { notSupported, UnsupportedConstructError } from './design';

/** The most charges in one group the builder lays out. Whether a count fits is a capacity question. */
export const MAX_DRAWN_COUNT = 12;

/** The rows that read as a pattern, as `2-1`. */
const ROW_PATTERN_KEYS: ReadonlySet<string> = new Set(ROW_PATTERNS.map((r) => r.join('-')));

const gap = (category: GapCategory, detail: string): Gap => ({ category, detail });

/** A variation is drawn over the whole field, or a band or picture, in two plain tinctures and a stripe count the builder offers; as a part of the field it is a gap (see `paintGaps`). */
function variationGaps(p: Extract<Paint, { k: 'variation' }>): Gap[] {
  const gaps: Gap[] = [];
  for (const l of [p.lines.a, p.lines.b]) if (l !== 'plain' && !gaps.some((g) => g.detail === l)) gaps.push(gap('line-of-partition', l));
  if (p.pieces !== null && !VARIATION_PIECES.includes(p.pieces)) gaps.push(gap('field-treatment', `${p.variation}-pieces`));
  for (const part of p.parts) if (part.k !== 'tincture') gaps.push(gap('field-treatment', `${p.variation}-${part.k}`));
  return gaps;
}


/** A treatment is drawn on a plain tincture, for the three that are patterns of lines; fretty is a charge and plumetty a fur-like pattern. */
function treatedGaps(p: Extract<Paint, { k: 'treated' }>): Gap[] {
  if (!DRAWN_TREATMENTS.includes(p.treatment)) return [gap('field-treatment', p.treatment)];
  return asTreated(p) ? [] : [gap('field-treatment', `${p.treatment}-${p.ground.k}`)];
}


/**
 * A semy is a plain tincture strewn with one plain charge in a plain tincture, on the field, a part of it, or a band; the charges of a
 * semy on a picture are too small to draw (a count gap, as many charges on a charge are).
 */
function semyGaps(p: Extract<Paint, { k: 'semy' }>, owner: string): Gap[] {
  if (!asSemy(p)) return [gap('field-treatment', `semy-${p.ground.k === 'tincture' ? p.ink.k : p.ground.k}`)];
  if (p.charge.form) return [gap('charge-modifier', p.charge.form)];
  return isChargeId(owner) ? [gap('count', 'semy')] : [];
}




/** The gaps of a paint: `field` paints are the field and its parts, `owner` names the thing a group paint colours. */
export function paintGaps(p: Paint, inField: boolean, owner: string): Gap[] {
  switch (p.k) {
    case 'tincture': return [];
    case 'counterchanged': return inField ? [gap('tincture', 'counterchanged')] : [];
    case 'stain': return [gap('tincture', p.stain)];
    // Colours other than a fur's own are drawn for the plain layouts (argent ermined gules, vairy Or and gules); counter- and en pointe furs keep theirs.
    case 'fur': return p.colours && FUR_SPEC[p.fur].layout !== 'plain' ? [gap('fur', `${p.fur}-colours`)] : [];
    // Natural colours are drawn for the charges that have a palette; an ordinary or a charge without one keeps its gap.
    case 'proper': return isChargeId(owner) && CHARGES[owner].proper ? [] : [gap('proper', owner)];
    case 'variation': return variationGaps(p);
    case 'treated': return treatedGaps(p);
    case 'semy': return semyGaps(p, owner);
    case 'divided': {
      const gaps: Gap[] = [];
      if (!DRAWN_DIVISIONS.includes(p.division)) gaps.push(gap('division', p.division));
      for (const l of [p.lines.a, p.lines.b]) if (l !== 'plain' && !gaps.some((g) => g.detail === l)) gaps.push(gap('line-of-partition', l));
      if (p.pieces !== null) gaps.push(gap('division', `${p.division}-pieces`));
      for (const part of p.parts) {
        gaps.push(...(part.k === 'divided' ? [gap('division', 'nested')] : part.k === 'variation' ? [gap('field-treatment', part.variation)] : part.k === 'proper' ? [gap('proper', 'party')] : paintGaps(part, true, owner)));
      }
      // A band or picture is divided into plain tinctures only: a fur or a semy on a part of one is not drawn.
      if (!inField && gaps.length === 0 && !asParty(p)) gaps.push(p.parts.some((part) => part.k === 'semy') ? gap('field-treatment', 'semy-party') : gap('fur', 'party'));
      return gaps;
    }
  }
}

/** Words for what a gap is, for "<Thing> isn't available in this builder yet." */
function thing(g: Gap): string {
  const d = g.detail.replace(/-/g, ' ');
  switch (g.category) {
    case 'fieldless': return 'A fieldless badge';
    case 'fur':
      if (g.detail === 'party') return 'A fur on part of a divided band or picture';
      return g.detail.endsWith('-colours') ? `${FUR_NAME[g.detail.slice(0, -'-colours'.length) as keyof typeof FUR_NAME]} in colours of its own` : FUR_NAME[g.detail as keyof typeof FUR_NAME] ?? d;
    case 'tincture': return STAIN_NAME[g.detail as keyof typeof STAIN_NAME] ?? d;
    case 'proper': return g.detail === 'party' ? 'Natural colours on part of a divided band or picture' : `A ${d} in its natural colours`;
    case 'field-treatment': return g.detail === 'semy-party' ? 'A semy on part of a divided band or picture' : g.detail.startsWith('semy-') ? 'A semy that is not a plain colour strewn with a plain colour' : `The ${d} treatment`;
    case 'division': return g.detail === 'nested' ? 'A divided part of a divided field' : `A field divided ${DIVISION_NAME[g.detail as keyof typeof DIVISION_NAME] ?? d}`;
    case 'line-of-partition': return `A ${d} line`;
    case 'ordinary':
      if (g.detail === 'multiple') return 'More than one band or shape of the same kind';
      return isOrdinaryType(g.detail) ? `${ORDINARY_ARTICLE[g.detail]} ${ORDINARY_NAME[g.detail]}` : `A ${d}`;
    case 'ordinary-treatment': return `A ${d} band or shape`;
    case 'multiple-groups':
      if (g.detail === 'co-primary-ordinary') return 'A band and a picture as the main ones together';
      if (g.detail === 'co-primary-around') return 'Pictures set around two main pictures';
      if (g.detail === 'co-primary-overall') return 'Something across two main pictures';
      if (g.detail.startsWith('co-primary')) return 'That many main pictures together';
      return g.detail.startsWith('tertiary') ? 'Charges on that charge' : 'Two charge groups beside the main one';
    case 'placement': {
      if (g.detail.startsWith('overall-')) return 'That group overall';
      const host = g.detail.startsWith('on-') ? g.detail.slice('on-'.length) : '';
      return isChargeId(host) ? `Charges on a ${CHARGES[host].name}` : 'That placement of charges';
    }
    case 'count': return 'That many charges';
    case 'charge-modifier': return `A ${d} charge`;
    case 'posture': return `The ${d} posture`;
    case 'orientation': return 'That way of turning a charge';
    case 'arrangement': return 'That arrangement of charges';
  }
}

function itemGaps(item: Item): Gap[] {
  if (item.k === 'ordinary') {
    const gaps: Gap[] = [];
    if (!DRAWN_ORDINARIES.includes(item.type)) gaps.push(gap('ordinary', item.type));
    for (const l of [item.lines.a, item.lines.b]) if (l !== 'plain' && !gaps.some((g) => g.detail === l)) gaps.push(gap('line-of-partition', l));
    for (const m of item.mods) gaps.push(gap('ordinary-treatment', m));
    if (item.cotised) gaps.push(gap('ordinary-treatment', 'cotised'));
    if (item.fimbriated) gaps.push(gap('ordinary-treatment', 'fimbriated'));
    return gaps;
  }
  const meta = CHARGES[item.charge];
  const gaps: Gap[] = [];
  if (item.form) gaps.push(gap('charge-modifier', item.form));
  if (item.posture && !meta.postures?.includes(item.posture)) gaps.push(gap('posture', item.posture));
  if (item.facing && item.facing !== meta.defaultFacing) gaps.push(gap('orientation', item.facing));
  if (item.orientation) gaps.push(gap('orientation', item.orientation));
  for (const m of item.mods) if (!meta.mods.includes(m.id) || m.count !== null || m.paint !== null) gaps.push(gap('charge-modifier', m.id));
  for (const p of item.parts) gaps.push(gap('charge-modifier', p.part));
  for (const h of item.holds) gaps.push(gap('charge-modifier', h.how));
  return gaps;
}

function layoutGaps(g: Group, hasChief: boolean): Gap[] {
  const gaps: Gap[] = [];
  const a = g.arrangement;
  if (g.item.k === 'ordinary') {
    if (g.count > 1) gaps.push(gap('ordinary', 'multiple'));
    if (a.k !== 'single') gaps.push(gap('arrangement', layoutKey({ arrangement: a, position: null })));
    if (g.position) gaps.push(gap('arrangement', `in-${g.position}`));
    return gaps;
  }
  if (g.count > MAX_DRAWN_COUNT) gaps.push(gap('count', String(g.count)));
  if (a.k === 'pair') gaps.push(gap('posture', a.pair));
  if (a.k === 'pattern' && a.pattern !== 'cross' && a.pattern !== 'saltire' && a.pattern !== 'orle' && a.pattern !== 'annulo') {
    gaps.push(gap('arrangement', `in-${a.pattern}`));
  }
  if (a.k === 'rows' && !ROW_PATTERN_KEYS.has(a.rows.join('-'))) gaps.push(gap('arrangement', `rows-${a.rows.join('-')}`));
  if (g.position) {
    const layout = { arrangement: a, position: g.position };
    // A primary group in chief or in base, or in a half or quarter (with no chief), or a secondary group set by position in a layout it takes there.
    const placed = g.role === 'primary'
      ? !hasChief && (isHalfPosition(g.position) ? halfLayouts(g.position, g.count).some((l) => sameLayout(l, layout)) : (g.position === 'chief' || g.position === 'base') && (a.k === 'single' || (a.k === 'line' && a.dir === 'fess')))
      : g.role === 'secondary' && g.relation === 'position' && isSecondaryPosition(g.position)
        && positionLayouts(g.position, g.count, CHARGES[g.item.charge].long).some((l) => sameLayout(l, layout));
    if (!placed) gaps.push(gap('arrangement', `in-${g.position}`));
  }
  return gaps;
}

/** Whether charges are set around the design's primary charges. */
const hasAround = (d: Design): boolean => primaryCharges(d) !== null && d.groups.some((g) => g.role === 'secondary' && g.relation === 'between');

/** What the builder can't draw overall: ordinaries that don't cross the middle, and any number of charges but one, or two long charges crossed. */
function overallGaps(g: Group): Gap[] {
  if (g.item.k === 'ordinary') return OVERALL_ORDINARIES.includes(g.item.type) ? [] : [gap('placement', `overall-${g.item.type}`)];
  return overallLayouts(g.count, CHARGES[g.item.charge].long).length > 0 ? [] : [gap('placement', `overall-${g.count}`)];
}

/**
 * Counts that have no layout around or on the host (Table 7 secondary and tertiary rows), and primary charges that can't
 * have charges set around them (one charge, or two side by side, one above the other or crossed, can).
 */
function placementGaps(d: Design, g: Group, host: Group | null): Gap[] {
  if (g.role === 'overall' && host === null) return overallGaps(g);
  if (g.item.k !== 'charge' || g.count > MAX_DRAWN_COUNT) return [];
  if (host === null) {
    if (g.role === 'primary') {
      const layout = { arrangement: g.arrangement, position: g.position };
      const held = !hasAround(d) || aroundPrimaryLayouts(g.count, CHARGES[g.item.charge].long).some((l) => sameLayout(l, layout));
      return held ? [] : [gap('placement', `around-primary-${g.count}`)];
    }
    if (g.role !== 'secondary' || g.relation !== 'between') return [];
    const ordinary = primaryOrdinary(d);
    if (!ordinary) return primaryCharges(d) && !AROUND_COUNTS.includes(g.count) ? [gap('placement', `around-${g.count}`)] : [];
    if (!DRAWN_ORDINARIES.includes(ordinary)) return [];
    return hostCounts('between', ordinary).includes(g.count) ? [] : [gap('placement', `between-${ordinary}-${g.count}`)];
  }
  if (host.item.k === 'charge') return host.role === 'primary' && !ON_CHARGE_COUNTS.includes(g.count) ? [gap('placement', `on-charge-${g.count}`)] : [];
  if (!DRAWN_ORDINARIES.includes(host.item.type)) return [];
  const type = host.item.type;
  return hostCounts('on', type).includes(g.count) ? [] : [gap('placement', `on-${type}-${g.count}`)];
}

/**
 * The gaps of a group on a charge: only the primary charges carry charges, and only where their drawing has room for them
 * (and not with charges set around them, which would read as the tertiary's).
 */
function onChargeGaps(d: Design, host: Group): Gap[] {
  if (host.item.k !== 'charge' || host.role === 'tertiary') return [];
  if (host.role !== 'primary') return [gap('multiple-groups', `tertiary-on-${host.role}`)];
  if (coPrimaries(d)) return [gap('multiple-groups', 'tertiary-on-co-primary')];
  const gaps: Gap[] = [];
  if (chargeOnBox(host.item.charge, host.item.posture) === null) gaps.push(gap('placement', `on-${host.item.charge}`));
  if (host.item.mods.length > 0) gaps.push(gap('multiple-groups', 'tertiary-on-modifier'));
  if (hasAround(d)) gaps.push(gap('multiple-groups', 'tertiary-on-charge-around'));
  return gaps;
}

/**
 * What the builder can't draw of several primary groups: two groups of charges together ('a lion and a rose', three charges at most,
 * with no charges set around them, on them or overall) are drawn; a third group, a band among them, or more charges are not.
 */
function coPrimaryGaps(d: Design, primaries: ReadonlyArray<{ g: Group; i: number }>): Array<{ i: number; detail: string }> {
  if (primaries.length < 2) return [];
  const second = primaries[1].i;
  if (primaries.length > 2) return [{ i: second, detail: 'co-primary-3' }];
  if (primaries.some(({ g }) => g.item.k === 'ordinary')) return [{ i: second, detail: 'co-primary-ordinary' }];
  const out: Array<{ i: number; detail: string }> = [];
  if (primaries[0].g.count + primaries[1].g.count > MAX_CO_PRIMARY_TOTAL) out.push({ i: second, detail: 'co-primary-count' });
  const against = d.groups.flatMap((g, i) => (g.role === 'overall' ? [{ i, detail: 'co-primary-overall' }] : g.role === 'secondary' && g.relation === 'between' ? [{ i, detail: 'co-primary-around' }] : []));
  return [...out, ...against];
}

/** Gaps in how the groups relate: roles beyond the supported combinations. */
function combinationGaps(d: Design): Array<{ at: IssueAt; gap: Gap }> {
  const out: Array<{ at: IssueAt; gap: Gap }> = [];
  const at = (path: GroupPath): IssueAt => ({ k: 'group', path });
  const byRole = (role: Group['role']) => d.groups.flatMap((g, i) => (g.role === role ? [{ g, i }] : []));
  const primaries = byRole('primary'), secondaries = byRole('secondary'), peripherals = byRole('peripheral');

  out.push(...coPrimaryGaps(d, primaries.map(({ g, i }) => ({ g, i }))).map(({ i, detail }) => ({ at: at([i]), gap: gap('multiple-groups', detail) })));
  if (secondaries.length > 1) out.push({ at: at([secondaries[1].i]), gap: gap('multiple-groups', 'secondary') });
  // One chief and one bordure may be set together; any other pair is a second of a kind.
  const peripheralTypes = peripherals.map(({ g }) => (g.item.k === 'ordinary' ? g.item.type : null));
  if (peripherals.length > 1 && !(peripherals.length === 2 && peripheralTypes.includes('chief') && peripheralTypes.includes('bordure'))) {
    out.push({ at: at([peripherals[1].i]), gap: gap('multiple-groups', 'peripherals') });
  }
  for (const { g, i } of secondaries) {
    // Set by position: in chief, in base or in canton (other positions, like in dexter chief, are not drawn yet).
    const drawn = g.relation === 'between' || (g.relation === 'position' && isSecondaryPosition(g.position));
    if (!drawn) out.push({ at: at([i]), gap: gap('multiple-groups', `secondary-${g.relation}`) });
    if (g.item.k === 'ordinary') out.push({ at: at([i]), gap: gap('multiple-groups', 'secondary-ordinary') });
  }
  for (const { g, i } of primaries) {
    if (g.item.k === 'ordinary' && ORDINARY_KIND[g.item.type] !== 'central') out.push({ at: at([i]), gap: gap('placement', `primary-${g.item.type}`) });
  }
  for (const { g, i } of peripherals) {
    if (g.item.k === 'charge') out.push({ at: at([i]), gap: gap('placement', 'peripheral-charge') });
    else if (DRAWN_ORDINARIES.includes(g.item.type) && g.item.type !== 'chief' && g.item.type !== 'bordure') {
      out.push({ at: at([i]), gap: gap('placement', `peripheral-${g.item.type}`) });
    }
  }
  return out;
}

/** Everything in `d` the builder doesn't draw, one issue per construct: the design, the field, then the groups in canonical order. */
export function unsupportedIssues(d: Design): UnsupportedIssue[] {
  const out: UnsupportedIssue[] = [];
  const add = (at: IssueAt, g: Gap) => out.push({ code: 'unsupported', at, gap: g, message: `${capitalise(thing(g))} isn't available in this builder yet.` });

  if (d.kind === 'badge') {
    add({ k: 'design' }, gap('fieldless', 'badge'));
    return out;
  }
  for (const c of combinationGaps(d)) add(c.at, c.gap);
  for (const g of paintGaps(d.field, true, 'field')) add({ k: 'field' }, g);

  const hasChief = d.groups.some((g) => g.role === 'peripheral' && g.item.k === 'ordinary' && g.item.type === 'chief');
  for (const { path, group, host } of walkGroups(d)) {
    const at: IssueAt = { k: 'group', path };
    const owner = group.item.k === 'ordinary' ? group.item.type : group.item.charge;
    const gaps = [...itemGaps(group.item), ...paintGaps(group.paint, false, owner), ...layoutGaps(group, hasChief), ...placementGaps(d, group, host)];
    if (host) gaps.push(...onChargeGaps(d, host));
    if (host && group.item.k === 'ordinary') gaps.push(gap('placement', 'tertiary-ordinary'));
    if (host?.role === 'overall' && host.item.k === 'ordinary') gaps.push(gap('multiple-groups', 'tertiary-on-overall'));
    for (const g of gaps) add(at, g);
  }
  return out;
}

export function isSupported(d: Design): boolean {
  return unsupportedIssues(d).length === 0;
}

