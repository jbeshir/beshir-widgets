// Builder edits: pure NormDesign → NormDesign transitions used by the Design tab (DOM-free, unit
// tested). Lower-layer edits are always applied; the charge group is then refitted structurally
// (fitCharges) and any rule-of-tincture conflict is left in place for the violation panel to
// surface and offer a fix — never silently repaired.

import {
  CHARGES, ORDINARY_NAME, chargeContext, chargeTinctureChoices, defaultArrangement, fieldTinctures, fitCharges,
  legalArrangements, ordinaryTinctureChoices, structuralIssues, tinctureIssues,
  type Arrangement, type ChargeId, type Choice, type Count, type Division, type Issue, type NormDesign,
  type OrdinaryType, type Placement, type Posture, type Tincture,
} from './heraldry';

export const DEFAULT_DESIGN: NormDesign = { v: 1, field: { kind: 'plain', tincture: 'azure' }, ordinary: null, charges: null };

function firstAllowed<T>(choices: Choice<T>[], fallback: T): T {
  return choices.find((c) => c.allowed)?.value ?? fallback;
}

function isAllowed<T>(choices: Choice<T>[], v: T): boolean {
  return choices.some((c) => c.value === v && c.allowed);
}

/** A second tincture for a newly divided field: contrasting class, never equal to the first. */
function partner(t: Tincture): Tincture {
  if (t === 'or') return 'azure';
  if (t === 'argent') return 'gules';
  return 'or';
}

export function setPlainField(nd: NormDesign): NormDesign {
  if (nd.field.kind === 'plain') return nd;
  return fitCharges({ ...nd, field: { kind: 'plain', tincture: nd.field.tinctures[0] } });
}

export function setDivision(nd: NormDesign, division: Division): NormDesign {
  const [t1, t2] = fieldTinctures(nd.field);
  const tinctures: [Tincture, Tincture] = [t1, t2 && t2 !== t1 ? t2 : partner(t1)];
  return fitCharges({ ...nd, field: { kind: 'divided', division, tinctures } });
}

export function setFieldTincture(nd: NormDesign, part: 0 | 1, t: Tincture): NormDesign {
  const f = nd.field;
  if (f.kind === 'plain') return { ...nd, field: { kind: 'plain', tincture: t } };
  const tinctures: [Tincture, Tincture] = part === 0 ? [t, f.tinctures[1]] : [f.tinctures[0], t];
  return { ...nd, field: { ...f, tinctures } };
}

export function setOrdinary(nd: NormDesign, type: OrdinaryType | null): NormDesign {
  if (!type) return fitCharges({ ...nd, ordinary: null });
  const choices = ordinaryTinctureChoices(nd, type);
  const keep = nd.ordinary && isAllowed(choices, nd.ordinary.tincture) ? nd.ordinary.tincture : null;
  const tincture = keep ?? firstAllowed(choices, nd.ordinary?.tincture ?? 'or');
  const next: NormDesign = { ...nd, ordinary: { type, tincture } };
  // Charges on a bordure aren't possible; on any other ordinary, keep them where they were.
  return fitCharges(next);
}

export function setOrdinaryTincture(nd: NormDesign, t: Tincture): NormDesign {
  if (!nd.ordinary) return nd;
  return { ...nd, ordinary: { ...nd.ordinary, tincture: t } };
}

export function setCharge(nd: NormDesign, id: ChargeId | null): NormDesign {
  if (!id) return { ...nd, charges: null };
  const meta = CHARGES[id];
  const g = nd.charges;
  if (g) {
    const posture = meta.postures ? (g.posture && meta.postures.includes(g.posture) ? g.posture : meta.defaultPosture) : null;
    return fitCharges({ ...nd, charges: { ...g, charge: id, posture } });
  }
  const placed = fitCharges({
    ...nd,
    charges: { charge: id, count: 1, placement: 'field', arrangement: 'single', posture: meta.defaultPosture, tincture: 'or' },
  });
  const tincture = firstAllowed(chargeTinctureChoices(placed), 'or');
  return { ...placed, charges: { ...placed.charges!, tincture } };
}

export function setCount(nd: NormDesign, count: Count): NormDesign {
  const g = nd.charges;
  if (!g) return nd;
  const legal = legalArrangements(nd.ordinary, g.placement, count);
  const arrangement: Arrangement = legal.includes(g.arrangement) ? g.arrangement : defaultArrangement(nd.ordinary, g.placement, count);
  return fitCharges({ ...nd, charges: { ...g, count, arrangement } });
}

export function setPlacement(nd: NormDesign, placement: Placement): NormDesign {
  const g = nd.charges;
  if (!g) return nd;
  return fitCharges({ ...nd, charges: { ...g, placement, arrangement: defaultArrangement(nd.ordinary, placement, g.count) } });
}

export function setArrangement(nd: NormDesign, arrangement: Arrangement): NormDesign {
  const g = nd.charges;
  if (!g) return nd;
  return { ...nd, charges: { ...g, arrangement } };
}

export function setPosture(nd: NormDesign, posture: Posture): NormDesign {
  const g = nd.charges;
  if (!g) return nd;
  return { ...nd, charges: { ...g, posture } };
}

export function setChargeTincture(nd: NormDesign, t: Tincture): NormDesign {
  const g = nd.charges;
  if (!g) return nd;
  return { ...nd, charges: { ...g, tincture: t } };
}

// ── Status ──────────────────────────────────────────────────────────────────

export type DesignStatus = 'incomplete' | 'valid' | 'violation';

export interface DesignReport {
  status: DesignStatus;
  /** Blocking problems (structure + rule of tincture), in layer order. */
  problems: Issue[];
  /** The gentle "add an ordinary or charge" hint, when that is all that's missing. */
  hint: string | null;
}

export function assess(nd: NormDesign): DesignReport {
  const issues = [...structuralIssues(nd), ...tinctureIssues(nd)];
  const problems = issues.filter((i) => i.code !== 'generic');
  const generic = issues.find((i) => i.code === 'generic');
  const status: DesignStatus = problems.length ? 'violation' : generic ? 'incomplete' : 'valid';
  return { status, problems, hint: generic ? 'Add an ordinary or charge — a plain field alone is too generic to register.' : null };
}

export const LAYER_LABEL: Record<Issue['layer'], string> = {
  design: 'Design', field: 'Field', ordinary: 'Ordinary', charges: 'Charges',
};

/** "On the field" / "On the bend" / "Around the bend" / "Below the chief" / "Within the bordure". */
export function placementLabel(nd: NormDesign, placement: Placement): string {
  const o = nd.ordinary;
  if (placement === 'ordinary') return o && o.type !== 'bordure' ? `On the ${ORDINARY_NAME[o.type]}` : 'On the ordinary';
  switch (chargeContext(o, 'field')) {
    case 'between': return `Around the ${ORDINARY_NAME[o!.type]}`;
    case 'chief': return 'Below the chief';
    case 'bordure': return 'Within the bordure';
    default: return 'On the field';
  }
}

export function sameDesign(a: NormDesign, b: NormDesign): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

