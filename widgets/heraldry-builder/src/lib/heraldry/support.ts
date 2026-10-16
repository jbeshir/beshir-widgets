// What phase A draws. Everything else is well-formed but "unsupported": `unsupportedIssues` names each
// construct the builder doesn't offer, with a gap the SCA test files the design under. The one "not yet
// drawable" guard, `notSupported`, lives in design.ts and is re-exported here.

import { FUR_NAME, FUR_SPEC, STAIN_NAME } from './tinctures';
import { capitalise } from './words';
import { CHARGES, isChargeId } from './charges';
import { chargeOnBox } from './charge-art';
import { liesAstride, specOf } from './ordinary-geometry';
import { DIVISION_NAME, DRAWN_DIVISIONS, VARIATION_PIECES, isDrawnTreatment, type Division, type Variation } from './divisions';
import {
  asParty, asSemy, asTreated, walkGroups, type CountLimit, type Design, type Lines, type Gap, type GapCategory, type Group, type GroupPath, type IssueAt, type Item, type Paint, type UnsupportedIssue,
} from './design';
import { DRAWN_ORDINARIES, OVERALL_ORDINARIES, ORDINARY_COUNTS, modDrawn, ORDINARY_KIND, isDiminutive, isOrdinaryType, ordinaryWithArticle } from './ordinaries';
import {
  AROUND_COUNTS, MAX_CO_PRIMARY_TOTAL, ON_CHARGE_COUNTS, coPrimaries, aroundPrimaryLayouts, halfLayouts, hostCounts, isHalfPosition, isSecondaryPosition, layoutKey, overallLayouts, positionLayouts, primaryCharges, primaryOrdinary, ROW_PATTERNS, sameLayout,
} from './arrangement';

export { notSupported, UnsupportedConstructError } from './design';

/** The most charges in one group the builder lays out. Whether a count fits is a capacity question. */
export const MAX_DRAWN_COUNT = 12;

/** The rows that read as a pattern, as `2-1`. */
const ROW_PATTERN_KEYS: ReadonlySet<string> = new Set(ROW_PATTERNS.map((r) => r.join('-')));

/** A gap with the words for what it is ("<What> isn't available in this builder yet.") and, for a count its place has no row for, which limit. */
interface Found { gap: Gap; what: string; limit: CountLimit | null }

/** The words for a gap whose detail is the construct's own id or word. */
function genericThing(category: GapCategory, detail: string): string {
  const d = detail.replace(/-/g, ' ');
  switch (category) {
    case 'tincture': return STAIN_NAME[detail as keyof typeof STAIN_NAME] ?? d;
    case 'proper': return `A ${d} in its natural colours`;
    case 'field-treatment': return `The ${d} treatment`;
    case 'division': return `A field divided ${DIVISION_NAME[detail as keyof typeof DIVISION_NAME] ?? d}`;
    case 'line-of-partition': return `A ${d} line`;
    case 'ordinary': return isOrdinaryType(detail) ? ordinaryWithArticle(detail) : `A ${d}`;
    case 'ordinary-treatment': return `A ${d} band or shape`;
    case 'multiple-groups': return 'Two charge groups beside the main one';
    case 'placement': return 'That placement of charges';
    case 'count': return 'That many charges';
    case 'charge-modifier': return `A ${d} charge`;
    case 'posture': return `The ${d} posture`;
    case 'orientation': return 'That way of turning a charge';
    case 'arrangement': return 'That arrangement of charges';
    case 'fieldless': return 'That fieldless badge';
    case 'fur': return 'That fur';
    default: return category satisfies never;
  }
}

const gap = (category: GapCategory, detail: string, what = genericThing(category, detail)): Found => ({ gap: { category, detail }, what, limit: null });

const ON_THAT_CHARGE = 'Charges on that charge';

/** A count its place has no Table 7 row for (`limit` says which place), filed as a placement gap. */
const countGap = (detail: string, limit: CountLimit): Found => ({ gap: { category: 'placement', detail }, what: 'That placement of charges', limit });

/**
 * The gaps of the lines of a division or variation: a line is drawn on the divisions and stripes of the field itself (the builder's
 * Background edge row builds them); on the parts of a divided band or picture it is not, chevronny's corners take none, and quarterly's
 * two lines are one line or a line each only when the second is plain or the same.
 */
function partitionLineGaps({ a, b }: Lines, inField: boolean, host: Division | Variation): Found[] {
  if (a === 'plain' && b === 'plain') return [];
  if (!inField) return [gap('line-of-partition', 'on-divided-charge', 'A line on the division of a band or picture')];
  if (host === 'chevronny') return [gap('line-of-partition', `${a === 'plain' ? b : a}-on-chevronny`)];
  if (host === 'quarterly' && a !== 'plain' && b !== 'plain' && a !== b) return [gap('line-of-partition', 'quarterly-two-lines', 'A different line on each of the two lines of a quartered field')];
  return [];
}

/** A variation is drawn over the whole field, or a band or picture, in two plain tinctures and a stripe count the builder offers; as a part of the field it is a gap (see `paintGaps`). */
function variationGaps(p: Extract<Paint, { k: 'variation' }>, inField: boolean): Found[] {
  const gaps: Found[] = [];
  gaps.push(...partitionLineGaps(p.lines, inField, p.variation));
  if (p.pieces !== null && !VARIATION_PIECES.includes(p.pieces)) gaps.push(gap('field-treatment', `${p.variation}-pieces`));
  for (const part of p.parts) if (part.k !== 'tincture') gaps.push(gap('field-treatment', `${p.variation}-${part.k}`));
  return gaps;
}

/** A treatment is drawn on a plain tincture, for the three that are patterns of lines; fretty is a charge and plumetty a fur-like pattern. */
function treatedGaps(p: Extract<Paint, { k: 'treated' }>): Found[] {
  if (!isDrawnTreatment(p.treatment)) return [gap('field-treatment', p.treatment)];
  return asTreated(p) ? [] : [gap('field-treatment', `${p.treatment}-${p.ground.k}`)];
}

/**
 * A semy is a plain tincture strewn with one plain charge in a plain tincture, on the field, a part of it, or a band; the charges of a
 * semy on a picture are too small to draw (a count gap, as many charges on a charge are).
 */
function semyGaps(p: Extract<Paint, { k: 'semy' }>, owner: string): Found[] {
  if (!asSemy(p)) return [gap('field-treatment', `semy-${p.ground.k === 'tincture' ? p.ink.k : p.ground.k}`, 'A semy that is not a plain colour strewn with a plain colour')];
  if (p.charge.form) return [gap('charge-modifier', p.charge.form)];
  return isChargeId(owner) ? [gap('count', 'semy')] : [];
}

/** The gaps of a paint: `field` paints are the field and its parts, `owner` names the thing a group paint colours. */
export function paintGaps(p: Paint, inField: boolean, owner: string): Gap[] {
  return paintFound(p, inField, owner).map((f) => f.gap);
}

function paintFound(p: Paint, inField: boolean, owner: string): Found[] {
  switch (p.k) {
    case 'tincture': return [];
    case 'counterchanged': return inField ? [gap('tincture', 'counterchanged')] : [];
    case 'stain': return [gap('tincture', p.stain)];
    // Colours other than a fur's own are drawn for the plain layouts (argent ermined gules, vairy Or and gules); counter- and en pointe furs keep theirs.
    case 'fur': return p.colours && FUR_SPEC[p.fur].layout !== 'plain' ? [gap('fur', `${p.fur}-colours`, `${FUR_NAME[p.fur]} in colours of its own`)] : [];
    // Natural colours are drawn for the charges that have a palette; an ordinary or a charge without one keeps its gap.
    case 'proper': return isChargeId(owner) && CHARGES[owner].proper ? [] : [gap('proper', owner)];
    case 'variation': return variationGaps(p, inField);
    case 'treated': return treatedGaps(p);
    case 'semy': return semyGaps(p, owner);
    case 'divided': {
      const gaps: Found[] = [];
      if (!DRAWN_DIVISIONS.includes(p.division)) gaps.push(gap('division', p.division));
      gaps.push(...partitionLineGaps(p.lines, inField, p.division));
      if (p.pieces !== null) gaps.push(gap('division', `${p.division}-pieces`));
      for (const part of p.parts) {
        gaps.push(...(part.k === 'divided' ? [gap('division', 'nested', 'A divided part of a divided field')] : part.k === 'variation' ? [gap('field-treatment', part.variation)] : part.k === 'proper' ? [gap('proper', 'party', 'Natural colours on part of a divided band or picture')] : paintFound(part, true, owner)));
      }
      // A band or picture is divided into plain tinctures only: a fur or a semy on a part of one is not drawn.
      if (!inField && gaps.length === 0 && !asParty(p)) gaps.push(p.parts.some((part) => part.k === 'semy') ? gap('field-treatment', 'semy-party', 'A semy on part of a divided band or picture') : gap('fur', 'party', 'A fur on part of a divided band or picture'));
      return gaps;
    }
  }
}

/** The gaps of the paint of an ordinary's cotises or fimbriation: a plain tincture, and for cotises (counterchanged) the field's two tinctures swapped, are drawn and chosen in the builder. */
function trimGaps(p: Paint, cotises: boolean): Found[] {
  const other = (detail: string) => gap('ordinary-treatment', detail, 'A band or shape edged or cotised in more than a plain tincture');
  switch (p.k) {
    case 'tincture': return [];
    case 'counterchanged': return cotises ? [] : [gap('ordinary-treatment', 'fimbriated-counterchanged', 'A band or shape edged in swapped colours')];
    case 'stain': return [gap('tincture', p.stain)];
    case 'proper': return [gap('proper', 'trim')];
    case 'fur': case 'treated': case 'semy': case 'divided': case 'variation': return [other(`trim-${p.k}`)];
    default: return p satisfies never;
  }
}

function itemGaps(item: Item): Found[] {
  if (item.k === 'ordinary') {
    const gaps: Found[] = [];
    // several saltorels have their own gap (`layoutGaps`); one is a saltire couped
    if (!DRAWN_ORDINARIES.includes(item.type) && item.type !== 'saltorel') gaps.push(gap('ordinary', item.type));
    // A treatment drawn on another ordinary keeps its own gap ("inverted-on-fess"); voided has one for every ordinary but a cross or saltire.
    for (const m of item.mods) if (!modDrawn(item.type, m)) gaps.push(gap('ordinary-treatment', m === 'voided' ? m : `${m}-on-${item.type}`));
    // The builder's outline is one choice: fimbriated and cotised together can't be made (the hosts that can't take either are structure issues).
    if (item.cotised && item.fimbriated) gaps.push(gap('ordinary-treatment', 'fimbriated-and-cotised', 'A band or shape both fimbriated and cotised'));
    // Narrow bands are never outlined here (PLAN-C C11, the C7a hosts).
    else if (isDiminutive(item.type) && (item.cotised || item.fimbriated)) gaps.push(gap('ordinary-treatment', 'outline-on-diminutives', 'Narrow bands fimbriated or cotised'));
    if (item.cotised) gaps.push(...trimGaps(item.cotised.paint, true));
    if (item.fimbriated) gaps.push(...trimGaps(item.fimbriated, false));
    return gaps;
  }
  const meta = CHARGES[item.charge];
  const gaps: Found[] = [];
  if (item.form) gaps.push(gap('charge-modifier', item.form));
  if (item.posture && !meta.postures?.includes(item.posture)) gaps.push(gap('posture', item.posture));
  if (item.facing && item.facing !== meta.defaultFacing) gaps.push(gap('orientation', item.facing));
  if (item.orientation) gaps.push(gap('orientation', item.orientation));
  for (const m of item.mods) if (!meta.mods.includes(m.id) || m.count !== null || m.paint !== null) gaps.push(gap('charge-modifier', m.id));
  for (const p of item.parts) gaps.push(gap('charge-modifier', p.part));
  for (const h of item.holds) gaps.push(gap('charge-modifier', h.how));
  return gaps;
}

/** A single diminutive other than the main or overall band (which is its ordinary: `canonical`), "in canton a scarpe" (RULES-C §C.2); a baton is one by itself. */
const isSingleDiminutive = (g: Group): boolean =>
  g.item.k === 'ordinary' && g.count === 1 && isDiminutive(g.item.type) && g.item.type !== 'baton' && g.role !== 'primary' && g.role !== 'overall';

function layoutGaps(g: Group, hasChief: boolean): Found[] {
  const gaps: Found[] = [];
  const a = g.arrangement;
  if (g.item.k === 'ordinary') {
    // A tressure is drawn double or triple and bars, pallets, bendlets and chevronels two to four; two gores are one SFCP (SENA App G) the builder
    // has no control for; several saltorels are laid out like charges, not drawn here; any other count is a gap. A single diminutive the main
    // or overall band is its ordinary (`canonical`); a single one beside them ("in canton a scarpe", RULES-C §C.2) is not drawn.
    if (g.count > 1 && !ORDINARY_COUNTS[g.item.type]?.includes(g.count)) {
      gaps.push(g.item.type === 'gore' && g.count === 2 ? gap('multiple-groups', 'two-gores', 'Two gores')
        : g.item.type === 'saltorel' ? gap('ordinary', 'saltorel-multiple', 'Several saltorels')
          : gap('ordinary', 'multiple', 'More than one band or shape of the same kind'));
    }
    if (isSingleDiminutive(g)) gaps.push(gap('ordinary', 'single-diminutive', 'A single narrow band set beside the main ones'));
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
function overallGaps(g: Group): Found[] {
  if (g.item.k === 'ordinary') {
    if (!OVERALL_ORDINARIES.includes(g.item.type)) return [gap('placement', `overall-${g.item.type}`, 'That group overall')];
    // The builder's edge rows, shape toggles and outline are on the band, the top band and the border, not on what lies across everything.
    return [
      ...(g.item.lines.a !== 'plain' || g.item.lines.b !== 'plain' ? [gap('line-of-partition', 'on-overall', 'A line on a band or shape lying across everything')] : []),
      ...(g.item.mods.length > 0 || g.item.cotised || g.item.fimbriated ? [gap('ordinary-treatment', 'on-overall', 'A band or shape lying across everything turned, shortened, moved or outlined')] : []),
    ];
  }
  return overallLayouts(g.count, CHARGES[g.item.charge].long).length > 0 ? [] : [gap('placement', `overall-${g.count}`, 'That group overall')];
}

/**
 * Counts that have no layout around or on the host (Table 7 secondary and tertiary rows), and primary charges that can't
 * have charges set around them (one charge, or two side by side, one above the other or crossed, can).
 */
function placementGaps(d: Design, g: Group, host: Group | null): Found[] {
  if (g.role === 'overall' && host === null) return overallGaps(g);
  if (g.item.k !== 'charge' || g.count > MAX_DRAWN_COUNT) return [];
  if (host === null) {
    if (g.role === 'primary') {
      const layout = { arrangement: g.arrangement, position: g.position };
      const held = !hasAround(d) || aroundPrimaryLayouts(g.count, CHARGES[g.item.charge].long).some((l) => sameLayout(l, layout));
      return held ? [] : [countGap(`around-primary-${g.count}`, 'around-primary')];
    }
    if (g.role !== 'secondary' || g.relation !== 'between') return [];
    const ordinary = primaryOrdinary(d);
    if (!ordinary) return primaryCharges(d) && !AROUND_COUNTS.includes(g.count) ? [countGap(`around-${g.count}`, 'around')] : [];
    if (!DRAWN_ORDINARIES.includes(ordinary.type)) return [];
    return hostCounts('between', ordinary).includes(g.count) ? [] : [countGap(`between-${ordinary.type}-${g.count}`, 'host')];
  }
  if (host.item.k === 'charge') return host.role === 'primary' && !ON_CHARGE_COUNTS.includes(g.count) ? [countGap(`on-charge-${g.count}`, 'host')] : [];
  if (!DRAWN_ORDINARIES.includes(host.item.type)) return [];
  const type = host.item.type;
  // A charged canton or quarter breaks SENA A6C1 (a structure issue); charges on any other shape beside the field's edges have no layout here.
  if (ORDINARY_KIND[type] !== 'central' && type !== 'chief' && type !== 'bordure') {
    return type === 'canton' || type === 'quarter' ? [] : [gap('multiple-groups', `tertiary-on-${type}`, ON_THAT_CHARGE)];
  }
  if (isDiminutive(type)) return [gap('multiple-groups', 'tertiary-on-diminutives', ON_THAT_CHARGE)];
  return hostCounts('on', specOf(host)).includes(g.count) ? [] : [countGap(`on-${type}-${g.count}`, 'host')];
}

/**
 * Whether a charge group is set against a chevron drawn astride the field's line, between it, on it or in chief: its place is worked out
 * for the usual chevron, which lies lower. (In base, in canton and overall they stand clear of either.)
 */
function againstAstrideLine(d: Design, g: Group, host: Group | null): boolean {
  const primary = host ?? d.groups.find((x) => x.role === 'primary');
  if (d.kind !== 'arms' || g.item.k !== 'charge' || primary?.role !== 'primary' || primary.item.k !== 'ordinary' || !liesAstride(d.field, specOf(primary), primary.paint)) return false;
  return host !== null || (g.role === 'secondary' && (g.relation === 'between' || g.position === 'chief'));
}

/**
 * The gaps of a group on a charge: only the primary charges carry charges, and only where their drawing has room for them
 * (and not with charges set around them, which would read as the tertiary's).
 */
function onChargeGaps(d: Design, host: Group): Found[] {
  if (host.item.k !== 'charge' || host.role === 'tertiary') return [];
  if (host.role !== 'primary') return [gap('multiple-groups', `tertiary-on-${host.role}`, ON_THAT_CHARGE)];
  if (coPrimaries(d)) return [gap('multiple-groups', 'tertiary-on-co-primary', ON_THAT_CHARGE)];
  const gaps: Found[] = [];
  if (chargeOnBox(host.item.charge, host.item.posture) === null) gaps.push(gap('placement', `on-${host.item.charge}`, `Charges on a ${CHARGES[host.item.charge].name}`));
  if (host.item.mods.length > 0) gaps.push(gap('multiple-groups', 'tertiary-on-modifier', ON_THAT_CHARGE));
  if (hasAround(d)) gaps.push(gap('multiple-groups', 'tertiary-on-charge-around', ON_THAT_CHARGE));
  return gaps;
}

/**
 * What the builder can't draw of several primary groups: two groups of charges together ('a lion and a rose', three charges at most,
 * with no charges set around them, on them or overall) are drawn; a third group, a band among them, or more charges are not.
 */
function coPrimaryGaps(d: Design, primaries: ReadonlyArray<{ g: Group; i: number }>): Array<{ i: number; gap: Found }> {
  if (primaries.length < 2) return [];
  const second = primaries[1].i;
  const many = 'That many main pictures together';
  if (primaries.length > 2) return [{ i: second, gap: gap('multiple-groups', 'co-primary-3', many) }];
  if (primaries.some(({ g }) => g.item.k === 'ordinary')) return [{ i: second, gap: gap('multiple-groups', 'co-primary-ordinary', 'A band and a picture as the main ones together') }];
  const out: Array<{ i: number; gap: Found }> = [];
  if (primaries[0].g.count + primaries[1].g.count > MAX_CO_PRIMARY_TOTAL) out.push({ i: second, gap: gap('multiple-groups', 'co-primary-count', many) });
  const against = d.groups.flatMap((g, i) => (g.role === 'overall'
    ? [{ i, gap: gap('multiple-groups', 'co-primary-overall', 'Something across two main pictures') }]
    : g.role === 'secondary' && g.relation === 'between' ? [{ i, gap: gap('multiple-groups', 'co-primary-around', 'Pictures set around two main pictures') }] : []));
  return [...out, ...against];
}

/** Gaps in how the groups relate: roles beyond the supported combinations. */
function combinationGaps(d: Design): Array<{ at: IssueAt; gap: Found }> {
  const out: Array<{ at: IssueAt; gap: Found }> = [];
  const at = (path: GroupPath): IssueAt => ({ k: 'group', path });
  const byRole = (role: Group['role']) => d.groups.flatMap((g, i) => (g.role === role ? [{ g, i }] : []));
  const primaries = byRole('primary'), secondaries = byRole('secondary'), peripherals = byRole('peripheral');

  out.push(...coPrimaryGaps(d, primaries.map(({ g, i }) => ({ g, i }))).map(({ i, gap: g }) => ({ at: at([i]), gap: g })));
  if (secondaries.length > 1) out.push({ at: at([secondaries[1].i]), gap: gap('multiple-groups', 'secondary') });
  // Any number of peripheral ordinaries stand together, one of each type (the builder has no control for a second of a type: two cantons, an
  // orle and a tressure, which lie in one place).
  const seen = new Set<string>();
  for (const { g, i } of peripherals) {
    if (g.item.k !== 'ordinary') continue;
    const type = g.item.type === 'tressure' ? 'orle' : g.item.type;
    if (seen.has(type)) out.push({ at: at([i]), gap: type === 'gore' ? gap('multiple-groups', 'two-gores', 'Two gores') : gap('multiple-groups', 'peripherals', 'Two of the same corner or edge shape') });
    seen.add(type);
  }
  for (const { g, i } of secondaries) {
    // Set by position: in chief, in base or in canton (other positions, like in dexter chief, are not drawn yet).
    const drawn = g.relation === 'between' || (g.relation === 'position' && isSecondaryPosition(g.position));
    if (!drawn) out.push({ at: at([i]), gap: gap('multiple-groups', `secondary-${g.relation}`) });
    // (a single diminutive beside the main group has a gap of its own: `layoutGaps`)
    if (g.item.k === 'ordinary' && !isSingleDiminutive(g)) out.push({ at: at([i]), gap: gap('multiple-groups', 'secondary-ordinary') });
  }
  for (const { g, i } of primaries) {
    if (g.item.k === 'ordinary' && ORDINARY_KIND[g.item.type] !== 'central') out.push({ at: at([i]), gap: gap('placement', `primary-${g.item.type}`) });
  }
  for (const { g, i } of peripherals) if (g.item.k === 'charge') out.push({ at: at([i]), gap: gap('placement', 'peripheral-charge') });
  return out;
}

/** What a fieldless badge has beyond its one main group (the bands and borders it can't have are structure issues, not gaps). */
function badgeGaps(d: Design): Array<{ at: IssueAt; gap: Found }> {
  const found = (g: Group): Found | null =>
    g.role === 'secondary' ? gap('fieldless', 'conjoined', 'Charges set beside the main charge of a fieldless badge')
      : g.role === 'overall' ? gap('fieldless', 'overall', 'Something overall on a fieldless badge')
      : g.item.k === 'ordinary' && g.item.mods.includes('couped') ? gap('fieldless', 'couped-ordinary', 'A couped band or shape as a fieldless badge') : null;
  const primaries = d.groups.filter((g) => g.role === 'primary' && g.item.k === 'charge');
  const extra = d.groups.flatMap((g, i) => {
    const f = found(g);
    return f ? [{ at: { k: 'group', path: [i] } as IssueAt, gap: f }] : [];
  });
  if (primaries.length > 1) extra.push({ at: { k: 'group', path: [d.groups.indexOf(primaries[1])] }, gap: gap('fieldless', 'co-primary', 'Two main pictures on a fieldless badge') });
  return extra;
}

/** Everything in `d` the builder doesn't draw, one issue per construct: the design, the field, then the groups in canonical order. */
export function unsupportedIssues(d: Design): UnsupportedIssue[] {
  const out: UnsupportedIssue[] = [];
  const add = (at: IssueAt, f: Found) => out.push({ code: 'unsupported', at, gap: f.gap, limit: f.limit, message: `${capitalise(f.what)} isn't available in this builder yet.` });

  if (d.kind === 'badge') {
    // Charges that touch the main one ("within and conjoined to", "surmounted by") are not drawn: a badge is its one main charge and what is on it.
    const beside = badgeGaps(d);
    if (beside.length > 0) {
      for (const b of beside) add(b.at, b.gap);
      return out;
    }
  } else {
    for (const c of combinationGaps(d)) add(c.at, c.gap);
    for (const g of paintFound(d.field, true, 'field')) add({ k: 'field' }, g);
  }

  const hasChief = d.groups.some((g) => g.role === 'peripheral' && g.item.k === 'ordinary' && g.item.type === 'chief');
  for (const { path, group, host } of walkGroups(d)) {
    const at: IssueAt = { k: 'group', path };
    const owner = group.item.k === 'ordinary' ? group.item.type : group.item.charge;
    const gaps = [...itemGaps(group.item), ...paintFound(group.paint, false, owner), ...layoutGaps(group, hasChief), ...placementGaps(d, group, host)];
    if (host) gaps.push(...onChargeGaps(d, host));
    if (againstAstrideLine(d, group, host)) gaps.push(gap('placement', 'counterchanged-chevron'));
    if (host && group.item.k === 'ordinary') gaps.push(gap('placement', 'tertiary-ordinary'));
    if (host?.role === 'overall' && host.item.k === 'ordinary') gaps.push(gap('multiple-groups', 'tertiary-on-overall', ON_THAT_CHARGE));
    for (const g of gaps) add(at, g);
  }
  return out;
}

export function isSupported(d: Design): boolean {
  return unsupportedIssues(d).length === 0;
}

