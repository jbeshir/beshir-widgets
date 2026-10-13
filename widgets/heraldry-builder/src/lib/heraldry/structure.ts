// Structural rules: a legal combination of ids that still isn't a design (SENA A3B3a, A3E3, App I3, Table 7
// layouts), room for the charges (layout.ts) and the per-fess chief rule (A3D1c). Messages are phrased
// so they can double as the reason shown next to a blocked option.

import { TINCTURE_NAME } from './tinctures';
import { capitalise, numberWord } from './words';
import { CHARGES, chargePhrase } from './charges';
import { primaryGroup, walkGroups, type Design, type Group, type GroupPath, type Issue } from './design';
import { capacityIssue } from './layout';
import { groundContacts } from './tincture-rule';
import { ORDINARY_NAME, ORDINARY_KIND } from './ordinaries';
import { contextOf, layoutCandidates, layoutKey, layoutWords, type LayoutContext } from './arrangement';

/** "a rose" / "three roses": a group's charges in words. */
function chargesPhrase(g: Group): string {
  return g.item.k === 'charge' ? chargePhrase(g.item.charge, g.count) : ORDINARY_NAME[g.item.type];
}

/** What a group sits on, for "the fess", "the lion". */
function hostName(host: Group): string {
  return host.item.k === 'ordinary' ? ORDINARY_NAME[host.item.type] : CHARGES[host.item.charge].name;
}

/** Why a charge group's count, arrangement and position don't make a layout, or null when they do. */
function layoutIssue(d: Design, path: GroupPath, g: Group, ctx: LayoutContext): string | null {
  if (g.item.k !== 'charge') return null;
  const meta = CHARGES[g.item.charge];
  const a = g.arrangement;
  const layout = { arrangement: a, position: g.position };
  if (ctx.k !== 'field') {
    const where = ctx.k === 'on' ? 'on' : 'around';
    return a.k === 'host' && g.position === null
      ? null
      : `Charges ${where} the ${ORDINARY_NAME[ctx.ordinary]} are placed by it — they can't be arranged ${layoutWords(layout)}.`;
  }
  if (a.k === 'host') return `${capitalise(chargesPhrase(g))} on the field can't be placed by an ordinary — choose an arrangement.`;
  if ((g.position === 'chief' || g.position === 'base') && ctx.peripheral === 'chief') {
    return `There is no room to set charges in ${g.position} when the design has a chief.`;
  }
  if (a.k === 'crossed' && !meta.long) return 'Only long charges such as swords, keys and anchors can be crossed.';
  const candidates = layoutCandidates(d, path, g.count);
  if (candidates.some((c) => layoutKey(c) === layoutKey(layout))) return null;
  if (g.count === 1) return 'A single charge sits alone in the centre.';
  const noun = capitalise(`${numberWord(g.count)} ${meta.plural}`);
  return `${noun} can be arranged ${candidates.map(layoutWords).join(', ')} — not ${layoutWords(layout)}.`;
}

/** Whether the primary group lies on both field tinctures on the heater, or has no room to be judged (the capacity rule says so). */
function crossesTheLine(d: Design): boolean {
  const primary = primaryGroup(d);
  if (!primary) return false;
  const contacts = groundContacts(d, primary.path);
  return contacts.every((c) => c.length === 0) || new Set(contacts.flat()).size > 1;
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
      add({ code: 'structure', at: { k: 'field' }, message, slots: [] });
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
      const central = d.groups.some((g) => g.role === 'primary' && g.item.k === 'ordinary' && ORDINARY_KIND[g.item.type] === 'central');
      if (!central) add({ code: 'structure', at, message: 'Charges can only be set between a central band or shape.', slots: [] });
    }
    if (host?.role === 'tertiary') {
      add({ code: 'structure', at, message: "Charges can't sit on charges that are already on something (SENA App I3).", slots: [] });
    } else if (host) {
      if (hostsSeen.has(host)) add({ code: 'structure', at, message: `Only one group of charges can sit on the ${hostName(host)} (SENA App I3).`, slots: [] });
      hostsSeen.add(host);
    }
  }

  // 4. Count, arrangement and position make a layout where the group sits.
  const illegal = new Set<Group>();
  for (const { path, group, host } of walked) {
    const ctx = contextOf(d, group, host);
    const message = ctx && layoutIssue(d, path, group, ctx);
    if (message) {
      illegal.add(group);
      add({ code: 'structure', at: { k: 'group', path }, message, slots: [] });
    }
  }

  // 5. The charges fit where they sit, at a size that reads.
  for (const { path, group } of walked) {
    const message = illegal.has(group) ? null : capacityIssue(d, path);
    if (message) add({ code: 'structure', at: { k: 'group', path }, message, slots: [] });
  }

  // 6. A chief on a field divided per fess needs a primary charge across the line (SENA A3D1c).
  const chief = walked.find(({ group }) => group.role === 'peripheral' && group.item.k === 'ordinary' && group.item.type === 'chief');
  if (chief && d.kind === 'arms' && d.field.k === 'divided' && d.field.division === 'per-fess' && !crossesTheLine(d)) {
    add({ code: 'structure', at: { k: 'group', path: chief.path }, message: 'A chief on a field divided per fess needs a charge across the line (SENA A3D1c).', slots: [] });
  }
  return issues;
}
