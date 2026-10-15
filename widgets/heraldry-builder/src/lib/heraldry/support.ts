// What phase A draws. Everything else is well-formed but "unsupported": `unsupportedIssues` names each
// construct the builder doesn't offer, with a gap the SCA test files the design under. The one "not yet
// drawable" guard, `notSupported`, lives in design.ts and is re-exported here.

import { FUR_NAME, STAIN_NAME } from './tinctures';
import { capitalise } from './words';
import { CHARGES, isChargeId } from './charges';
import { chargeOnBox } from './charge-art';
import { DIVISION_NAME, DRAWN_DIVISIONS } from './divisions';
import {
  walkGroups, type Design, type Gap, type GapCategory, type Group, type GroupPath, type IssueAt, type Item, type Paint, type UnsupportedIssue,
} from './design';
import { DRAWN_ORDINARIES, OVERALL_ORDINARIES, ORDINARY_ARTICLE, ORDINARY_KIND, ORDINARY_NAME, isOrdinaryType } from './ordinaries';
import {
  AROUND_COUNTS, ON_CHARGE_COUNTS, aroundPrimaryLayouts, hostCounts, isSecondaryPosition, layoutKey, overallLayouts, positionLayouts, primaryCharges, primaryOrdinary, ROW_PATTERNS, sameLayout,
} from './arrangement';

export { notSupported, UnsupportedConstructError } from './design';

/** The most charges in one group the builder lays out. Whether a count fits is a capacity question. */
export const MAX_DRAWN_COUNT = 12;

/** The rows that read as a pattern, as `2-1`. */
const ROW_PATTERN_KEYS: ReadonlySet<string> = new Set(ROW_PATTERNS.map((r) => r.join('-')));

const gap = (category: GapCategory, detail: string): Gap => ({ category, detail });

/** The gaps of a paint: `field` paints are the field and its parts, `owner` names the thing a group paint colours. */
export function paintGaps(p: Paint, inField: boolean, owner: string): Gap[] {
  switch (p.k) {
    case 'tincture': return [];
    case 'counterchanged': return inField ? [gap('tincture', 'counterchanged')] : [];
    case 'stain': return [gap('tincture', p.stain)];
    case 'fur': return [gap('fur', p.fur)];
    case 'proper': return [gap('proper', owner)];
    case 'variation': return [gap('field-treatment', p.variation)];
    case 'treated': return [gap('field-treatment', p.treatment)];
    case 'semy': return [gap('field-treatment', 'semy')];
    case 'divided': {
      if (!inField) return [gap('tincture', 'party')];
      const gaps: Gap[] = [];
      if (!DRAWN_DIVISIONS.includes(p.division)) gaps.push(gap('division', p.division));
      for (const l of [p.lines.a, p.lines.b]) if (l !== 'plain' && !gaps.some((g) => g.detail === l)) gaps.push(gap('line-of-partition', l));
      if (p.pieces !== null) gaps.push(gap('division', `${p.division}-pieces`));
      for (const part of p.parts) {
        gaps.push(...(part.k === 'divided' ? [gap('division', 'nested')] : paintGaps(part, true, owner)));
      }
      return gaps;
    }
  }
}

/** Words for what a gap is, for "<Thing> isn't available in this builder yet." */
function thing(g: Gap): string {
  const d = g.detail.replace(/-/g, ' ');
  switch (g.category) {
    case 'fieldless': return 'A fieldless badge';
    case 'fur': return FUR_NAME[g.detail as keyof typeof FUR_NAME] ?? d;
    case 'tincture': return g.detail === 'party' ? 'A band or picture divided into two tinctures' : (STAIN_NAME[g.detail as keyof typeof STAIN_NAME] ?? d);
    case 'proper': return `A ${d} in its natural colours`;
    case 'field-treatment': return `The ${d} treatment`;
    case 'division': return g.detail === 'nested' ? 'A divided part of a divided field' : `A field divided ${DIVISION_NAME[g.detail as keyof typeof DIVISION_NAME] ?? d}`;
    case 'line-of-partition': return `A ${d} line`;
    case 'ordinary':
      if (g.detail === 'multiple') return 'More than one band or shape of the same kind';
      return isOrdinaryType(g.detail) ? `${ORDINARY_ARTICLE[g.detail]} ${ORDINARY_NAME[g.detail]}` : `A ${d}`;
    case 'ordinary-treatment': return `A ${d} band or shape`;
    case 'multiple-groups':
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
    // A primary group in chief or in base (with no chief), or a secondary group set by position in a layout it takes there.
    const placed = g.role === 'primary'
      ? (g.position === 'chief' || g.position === 'base') && !hasChief && (a.k === 'single' || (a.k === 'line' && a.dir === 'fess'))
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
  const gaps: Gap[] = [];
  if (chargeOnBox(host.item.charge, host.item.posture) === null) gaps.push(gap('placement', `on-${host.item.charge}`));
  if (host.item.mods.length > 0) gaps.push(gap('multiple-groups', 'tertiary-on-modifier'));
  if (hasAround(d)) gaps.push(gap('multiple-groups', 'tertiary-on-charge-around'));
  return gaps;
}

/** Gaps in how the groups relate: roles beyond the supported combinations. */
function combinationGaps(d: Design): Array<{ at: IssueAt; gap: Gap }> {
  const out: Array<{ at: IssueAt; gap: Gap }> = [];
  const at = (path: GroupPath): IssueAt => ({ k: 'group', path });
  const byRole = (role: Group['role']) => d.groups.flatMap((g, i) => (g.role === role ? [{ g, i }] : []));
  const primaries = byRole('primary'), secondaries = byRole('secondary'), peripherals = byRole('peripheral');

  if (primaries.length > 1) out.push({ at: at([primaries[1].i]), gap: gap('multiple-groups', 'co-primary') });
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

