// Structural rules: a legal combination of ids that still isn't a design (SENA A3B3a, A3E3, App I3, Table 7
// layouts), room for the charges (layout.ts) and the per-fess chief rule (A3D1c). Messages are phrased
// so they can double as the reason shown next to a blocked option.

import { TINCTURE_NAME } from './tinctures';
import { capitalise, numberWord } from './words';
import { CHARGES, chargePhrase } from './charges';
import { itemKey, itemName, primaryGroup, walkGroups, type Design, type Group, type GroupPath, type Issue } from './design';
import { capacityIssue } from './layout';
import { groundShares } from './tincture-rule';
import { ORDINARY_NAME, ORDINARY_KIND } from './ordinaries';
import { AROUND_COUNTS, contextOf, hasChief, layoutCandidates, layoutKey, layoutWords, primaryCharges, type HostCharges, type LayoutContext } from './arrangement';

/** "a rose" / "three roses": a group's charges in words. */
function chargesPhrase(g: Group): string {
  return g.item.k === 'charge' ? chargePhrase(g.item.charge, g.count) : ORDINARY_NAME[g.item.type];
}

/** What a group sits on, for "the fess", "the lion". */
/** "on the heart", "on each of the flames". */
function whereOnCharge(host: HostCharges): string {
  return host.count === 1 ? `on the ${CHARGES[host.charge].name}` : `on each of the ${CHARGES[host.charge].plural}`;
}

/** Why a charge group's count, arrangement and position don't make a layout, or null when they do. */
function layoutIssue(d: Design, path: GroupPath, g: Group, ctx: LayoutContext): string | null {
  if (g.item.k !== 'charge') return null;
  const meta = CHARGES[g.item.charge];
  const a = g.arrangement;
  const layout = { arrangement: a, position: g.position };
  if (ctx.k === 'position') {
    if (ctx.position !== 'base' && hasChief(ctx.peripheral)) return `There is no room to set charges in ${ctx.position} when the design has a chief.`;
    if (layoutCandidates(d, path, g.count).some((c) => layoutKey(c) === layoutKey(layout))) return null;
    return `${capitalise(chargesPhrase(g))} in ${ctx.position} can't be arranged ${layoutWords({ ...layout, position: null })}.`;
  }
  if (ctx.k === 'around') {
    // A count with no layout around the primary charges at all is a gap (support.ts).
    const candidates = layoutCandidates(d, path, g.count);
    if (candidates.some((c) => layoutKey(c) === layoutKey(layout)) || !AROUND_COUNTS.includes(g.count)) return null;
    return `${capitalise(chargesPhrase(g))} around the ${ctx.primary.count === 1 ? 'charge' : 'charges'} in the middle can be set ${candidates.map(layoutWords).join(' or ')} — not ${layoutWords(layout)}.`;
  }
  if (ctx.k === 'on-charge') {
    // Every count but one must be stated, and only some layouts are on offer for it.
    const candidates = layoutCandidates(d, path, g.count);
    if (candidates.length === 0 || candidates.some((c) => layoutKey(c) === layoutKey(layout))) return null;
    return `${capitalise(chargesPhrase(g))} ${whereOnCharge(ctx.host)} can be set ${candidates.map(layoutWords).join(' or ')} — not ${layoutWords(layout)}.`;
  }
  if (ctx.k !== 'field') {
    const where = ctx.k === 'on' ? 'on' : 'around';
    return a.k === 'host' && g.position === null
      ? null
      : `Charges ${where} the ${ORDINARY_NAME[ctx.ordinary]} are placed by it — they can't be arranged ${layoutWords(layout)}.`;
  }
  if (a.k === 'host') return `${capitalise(chargesPhrase(g))} on the field can't be placed by an ordinary — choose an arrangement.`;
  if ((g.position === 'chief' || g.position === 'base') && hasChief(ctx.peripheral)) {
    return `There is no room to set charges in ${g.position} when the design has a chief.`;
  }
  if (a.k === 'crossed' && !meta.long) return 'Only long charges such as swords, keys and anchors can be crossed.';
  const candidates = layoutCandidates(d, path, g.count);
  if (candidates.some((c) => layoutKey(c) === layoutKey(layout))) return null;
  if (g.count === 1) return 'A single charge sits alone in the centre.';
  const noun = capitalise(`${numberWord(g.count)} ${meta.plural}`);
  return `${noun} can be arranged ${candidates.map(layoutWords).join(', ')} — not ${layoutWords(layout)}.`;
}

/**
 * How much of the middle of a charge (its sampled ground) must lie on each side of the line for the charge to overlie
 * the line (A3D1c) rather than graze it: a tenth puts the line within a fifth of the charge's size of its centre, so
 * some three tenths of its height lie across. Herald question H7 (REVIEW.md).
 */
const OVERLIES_SHARE = 1 / 10;

/** Whether some charge of the primary group overlies the line of division on the heater, or the group has no room to be judged (the capacity rule says so). */
function crossesTheLine(d: Design): boolean {
  const primary = primaryGroup(d);
  if (!primary) return false;
  const grounds = groundShares(d, primary.path);
  return grounds.every((g) => g.length === 0) || grounds.some((g) => g.length > 1 && g.every((s) => s.share >= OVERLIES_SHARE));
}

/** Structural problems of a design that resolves, in rule order. */
export function structuralIssues(d: Design): Issue[] {
  const issues: Issue[] = [];
  const add = (issue: Issue) => issues.push(issue);
  const walked = walkGroups(d);

  // 1. A divided field whose parts share a tincture (SENA A3B3a).
  if (d.kind === 'arms' && d.field.k === 'divided') {
    const ts = d.field.parts.flatMap((p) => (p.k === 'tincture' ? [p.t] : []));
    const repeated = ts.find((t, i) => ts.indexOf(t) !== i);
    if (repeated) {
      const message = d.field.parts.length === 2
        ? `A divided field needs two different tinctures — both parts are ${TINCTURE_NAME[repeated]}.`
        : `A divided field needs different tinctures — two parts are ${TINCTURE_NAME[repeated]}.`;
      add({ code: 'structure', rule: 'field', at: { k: 'field' }, message, slots: [] });
    }
  }

  // 2. A plain field alone (SENA A3E3).
  if (d.kind === 'arms' && d.field.k === 'tincture' && d.groups.length === 0) {
    add({ code: 'generic', at: { k: 'design' }, message: 'A plain field on its own is too generic to register — add an ordinary or a charge.', slots: [] });
  }

  // 3. How groups relate (SENA App I).
  const hostsSeen = new Set<Group>();
  for (const { path, group, host } of walked) {
    const at = { k: 'group', path } as const;
    if (group.role === 'secondary' && group.relation === 'between') {
      // Between a central ordinary, or around the one group of primary charges (SENA App I1: "a lion between three mullets").
      const central = d.groups.some((g) => g.role === 'primary' && g.item.k === 'ordinary' && ORDINARY_KIND[g.item.type] === 'central');
      if (!central && !primaryCharges(d)) add({ code: 'structure', rule: 'relation', at, message: 'Charges can only be set between a central band or shape, or around a picture in the middle.', slots: [] });
    }
    if (group.role === 'secondary' && group.relation === 'position' && !d.groups.some((g) => g.role === 'primary')) {
      // With nothing in the middle, charges in chief or in base are the primary group themselves (SENA App I1).
      add({ code: 'structure', rule: 'relation', at, message: `Charges in ${group.position ?? 'a corner'} stand beside a band, shape or picture in the middle — with none, they are the main picture.`, slots: [] });
    }
    if (host?.role === 'tertiary') {
      add({ code: 'structure', rule: 'relation', at, message: "Charges can't sit on charges that are already on something (SENA App I3).", slots: [] });
    } else if (host) {
      if (hostsSeen.has(host)) add({ code: 'structure', rule: 'relation', at, message: `Only one group of charges can sit on the ${itemName(host.item)} (SENA App I3).`, slots: [] });
      hostsSeen.add(host);
    }
  }

  // 3a. The same type of charge in two groups on the field (SENA A3D1a); a charge on a charge may repeat it.
  const fieldGroups = d.groups.filter((g) => g.role !== 'peripheral' && g.item.k === 'charge');
  fieldGroups.forEach((group, i) => {
    if (!fieldGroups.slice(0, i).some((g) => itemKey(g.item) === itemKey(group.item))) return;
    const path = [d.groups.indexOf(group)];
    add({ code: 'structure', rule: 'same-type', at: { k: 'group', path }, message: `${capitalise(chargesPhrase(group))} can't be used again in another group on the field (SENA A3D1a) — choose a different picture.`, slots: [] });
  });

  // 4. Count, arrangement and position make a layout where the group sits.
  const illegal = new Set<Group>();
  for (const { path, group, host } of walked) {
    const ctx = contextOf(d, group, host);
    const message = ctx && layoutIssue(d, path, group, ctx);
    if (message) {
      illegal.add(group);
      add({ code: 'structure', rule: 'layout', at: { k: 'group', path }, message, slots: [] });
    }
  }

  // 5. The charges fit where they sit, at a size that reads.
  for (const { path, group } of walked) {
    const capacity = illegal.has(group) ? null : capacityIssue(d, path);
    if (capacity) add({ code: 'structure', rule: 'capacity', at: { k: 'group', path }, message: capacity.message, slots: [] });
  }

  // 6. A chief on a field divided per fess needs a primary charge across the line (SENA A3D1c).
  const chief = walked.find(({ group }) => group.role === 'peripheral' && group.item.k === 'ordinary' && group.item.type === 'chief');
  if (chief && d.kind === 'arms' && d.field.k === 'divided' && d.field.division === 'per-fess' && !crossesTheLine(d)) {
    add({ code: 'structure', rule: 'crosses-line', at: { k: 'group', path: chief.path }, message: 'A chief on a field divided per fess needs a charge across the line (SENA A3D1c).', slots: [] });
  }
  return issues;
}
