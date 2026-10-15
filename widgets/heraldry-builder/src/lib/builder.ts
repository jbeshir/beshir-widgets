// Builder edits: pure Design → Design transitions used by the Design tab (DOM-free, unit tested).
// Lower-layer edits are always applied; the pictures are then refitted structurally (fitGroup) and any
// rule-of-tincture conflict is left in place for the violation panel to surface and offer a fix —
// never silently repaired. Every transition returns a canonical design. The layers on top of the band
// and the picture (pictures on the band, a top band, a border) are heraldry/layers.ts.

import {
  CHARGES, COLOURS, DEFAULT_FIELD_SHAPE, METALS, chargeOnBox, ORDINARY_KIND, ORDINARY_LABEL, PLACE_KEYS, PLACE_LABEL, PLAIN_LINES, TINCTURE_CLASS, TINCTURE_LABEL, addLayer, assembleParts, canonical,
  asParty, asVariation, fieldParts, variationPaint, firstAllowed, groundFailure, groundShares, groundTinctures, groupAt, groupTinctureChoices, groupTinctureIssues, groupTinctureOf, hostOf,
  isAllowed, isMetal, isSupported, layerPath, ordinaryGroup, partsOf, placeOfPath, refitLayers, removeLayer, replaceGroup, setLayerCharge, simpleParts, structuralIssues, tincturePaint,
  bodyTinctures, surfaceOf, tinctureIssues, tinctureSurface, withTincture, withLayout, chargeItem, newCharge,
  type ChargeId, type Companion, type Design, type Division, type Variation, type Group, type GroupPath, type GroupTincture, type Issue, type PicturesKey,
  type LayoutKey, type ModifierId, type OrdinaryType, type Paint, type Placement, type PlaceKey, type Posture, type Readability, type ShapedDesign, type Tincture,
} from './heraldry';
import { capitalise, numberWord } from './heraldry/words';

export const DEFAULT_DESIGN: Design = { v: 2, kind: 'arms', field: tincturePaint('azure'), groups: [] };

/** The builder's steps: the background, then the places (band or shape, picture, pictures on the band, top band, border). */
export type StepKey = 'field' | PlaceKey;

export const STEP_LABEL: Record<StepKey, string> = {
  field: 'Background',
  ...(Object.fromEntries(PLACE_KEYS.map((key) => [key, PLACE_LABEL[key].plain])) as Record<PlaceKey, string>),
};

// ── Where things are ────────────────────────────────────────────────────────

export const ordinaryPath = (d: Design): GroupPath | null => simpleParts(d).ordinary?.path ?? null;
export const picturePath = (d: Design): GroupPath | null => simpleParts(d).picture?.path ?? null;

// ── Field ───────────────────────────────────────────────────────────────────

function withField(d: Design, field: Paint): Design {
  return { v: 2, kind: 'arms', field, groups: d.groups };
}

/** A second tincture for a newly divided field: contrasting class, sharing none of the first's tinctures. */
function partner(first: Paint): Paint {
  if (first.k === 'tincture') return tincturePaint(!isMetal(first.t) ? 'or' : first.t === 'or' ? 'azure' : 'gules');
  const { cls, bases } = surfaceOf(first);
  return tincturePaint((cls === 'metal' ? COLOURS : METALS).find((t) => !bases.includes(t)) ?? 'gules');
}

/** The background as separate paints to build another from: a variation's two tinctures, or the parts of the field. */
function backgroundParts(d: Design): Paint[] {
  const varied = d.kind === 'arms' ? asVariation(d.field) : null;
  return varied ? varied.parts : fieldParts(d);
}

export function setPlainField(d: Design): Design {
  if (d.kind !== 'arms' || (d.field.k !== 'divided' && d.field.k !== 'variation')) return d;
  return refitLayers(canonical(withField(d, backgroundParts(d)[0])));
}

export function setDivision(d: Design, division: Division): Design {
  const [first, kept] = backgroundParts(d);
  const second = kept && !bodyTinctures(kept).some((t) => bodyTinctures(first).includes(t)) ? kept : partner(first);
  return refitLayers(canonical(withField(d, { k: 'divided', division, lines: { ...PLAIN_LINES }, pieces: null, parts: [first, second] })));
}

/** The tincture that stands for a paint in a variation: its own, or the first of the ones it is made of. */
const tinctureOf = (p: Paint): Tincture => (p.k === 'tincture' ? p.t : surfaceOf(p).bases[0]);

/** The two tinctures of a variation made of these: a metal and a colour, so the second keeps its place only when it is the other class. */
function contrastingPair(first: Tincture, second: Tincture | null): [Tincture, Tincture] {
  return [first, second !== null && TINCTURE_CLASS[second] !== TINCTURE_CLASS[first] ? second : tinctureOf(partner(tincturePaint(first)))];
}

/** The background covered in this variation of the tinctures it has, the stripe count kept when the variation is counted. */
export function setVariation(d: Design, variation: Variation): Design {
  if (d.kind !== 'arms') return d;
  const [first, kept] = backgroundParts(d);
  const [a, b] = contrastingPair(tinctureOf(first), kept ? tinctureOf(kept) : null);
  return refitLayers(canonical(withField(d, variationPaint(variation, a, b, d.field.k === 'variation' ? d.field.pieces : null))));
}

/** The stripes of the varied background cut into this many; unchanged when the background is not a variation. */
export function setVariationPieces(d: Design, pieces: number): Design {
  const varied = d.kind === 'arms' ? asVariation(d.field) : null;
  return varied ? refitLayers(canonical(withField(d, variationPaint(varied.variation, varied.parts[0].t, varied.parts[1].t, pieces)))) : d;
}

/** One tincture of the varied background; the other changes too only when it would no longer be a metal with a colour. */
export function setVariationTincture(d: Design, part: 0 | 1, t: Tincture): Design {
  const varied = d.kind === 'arms' ? asVariation(d.field) : null;
  if (!varied) return d;
  const [mine, theirs] = contrastingPair(t, varied.parts[part === 0 ? 1 : 0].t);
  return canonical(withField(d, variationPaint(varied.variation, part === 0 ? mine : theirs, part === 0 ? theirs : mine, varied.pieces)));
}

export function setFieldTincture(d: Design, part: 0 | 1, t: Tincture): Design {
  if (d.kind !== 'arms') return d;
  const f = d.field;
  if (f.k !== 'divided') return canonical(withField(d, tincturePaint(t)));
  const parts = f.parts.map((p, i) => (i === part ? tincturePaint(t) : p));
  return canonical(withField(d, { ...f, parts }));
}

// ── Ordinary ────────────────────────────────────────────────────────────────

/**
 * The ordinary replaced (null: removed), the pictures kept where they can be: a picture on a vanished
 * ordinary goes to the background, extra pictures are dropped. The top band and border, and the pictures in
 * chief, base or canton, stay when the builder still draws them beside the new ordinary; one of the new
 * ordinary's own kind gives way to it.
 */
function rebuilt(d: Design, ordinary: Group | null): Design {
  const parts = partsOf(d);
  const type = ordinary?.item.k === 'ordinary' ? ordinary.item.type : null;
  const assemble = (peripherals: readonly Group[], positioned: Group | null) => refitLayers(assembleParts(d, { ...parts, ordinary, peripherals, positioned }));
  const beside = parts.peripherals.filter((g) => g.item.k !== 'ordinary' || g.item.type !== type);
  // Dropped only when they are what the builder can't draw beside the new ordinary (the pictures beside it first); a design that is unsupported either way keeps them.
  let first: Design | null = null;
  for (const peripherals of parts.peripherals.length > 0 ? [beside, []] : [beside]) {
    for (const positioned of parts.positioned ? [parts.positioned, null] : [null]) {
      const tried = assemble(peripherals, positioned);
      if (isSupported(tried)) return tried;
      first ??= tried;
    }
  }
  return first!;
}

export function setOrdinary(d: Design, type: OrdinaryType | null): Design {
  if (!type) return rebuilt(d, null);
  const previous = simpleParts(d).ordinary?.group.paint;
  const kept = previous && groupTinctureOf(previous);
  const placed = rebuilt(d, ordinaryGroup(type, kept ?? 'or'));
  const path = ordinaryPath(placed)!;
  const choices = groupTinctureChoices(placed, path);
  const tincture = kept && isAllowed(choices, kept) ? kept : firstAllowed(choices, kept ?? 'or');
  return tincture === kept ? placed : setGroupTincture(placed, path, tincture);
}

export function setOrdinaryTincture(d: Design, t: GroupTincture): Design {
  const path = ordinaryPath(d);
  return path ? setGroupTincture(d, path, t) : d;
}

// ── Pictures ────────────────────────────────────────────────────────────────

/** The picture at `path` painted with the first tincture that works there, as a new picture should be. */
function withFirstTincture(d: Design, path: GroupPath): Design {
  return withTincture(d, path, firstAllowed(groupTinctureChoices(d, path), 'or'));
}

/**
 * The picture ('picture'), the pictures on the band ('on-ordinary') or the pictures on a top band or border ('on-chief', 'on-bordure') as this charge; null removes it. A new
 * picture starts as a single charge on the background in the first tincture that works; a swapped one
 * keeps its count, layout and tincture where they still work. Removing the picture promotes the
 * pictures on the band, else the pictures around it, to the picture.
 */
export function setCharge(d: Design, at: 'picture' | PicturesKey, id: ChargeId | null): Design {
  if (at !== 'picture') {
    if (!id) return removeLayer(d, at);
    return layerPath(d, at) ? setLayerCharge(d, at, id) : setLayerCharge(addLayer(d, at), at, id);
  }
  const parts = partsOf(d);
  if (!id) return refitLayers(assembleParts(d, { ...parts, picture: parts.extra ?? parts.around ?? parts.coPrimary, placement: parts.extra ? 'ordinary' : 'field', extra: null, around: null, coPrimary: null }));
  if (parts.picture) return swapPicture(d, id);
  // A new picture goes on the background, or onto the band when pictures already stand beside it in chief, base or canton (one secondary group).
  const onField = refitLayers(assembleParts(d, { ...parts, picture: newCharge(id, 'primary'), placement: 'field', extra: null }));
  const placed = isSupported(onField) || !parts.ordinary ? onField : refitLayers(assembleParts(d, { ...parts, picture: newCharge(id, 'primary'), placement: 'ordinary', extra: null }));
  return canonical(withFirstTincture(placed, picturePath(placed)!));
}

function swapPicture(d: Design, id: ChargeId): Design {
  const parts = partsOf(d);
  if (!parts.picture) return d;
  const item = chargeItem(id, parts.picture);
  // The pictures on the picture go with it unless the new one has no room for them.
  const carries = item.k === 'charge' && chargeOnBox(id, item.posture) !== null && item.mods.length === 0;
  return refitLayers(assembleParts(d, { ...parts, picture: { ...parts.picture, item }, onPicture: carries ? parts.onPicture : null }));
}

export function setLayout(d: Design, path: GroupPath, key: LayoutKey): Design {
  return withLayout(d, path, key);
}

function withItem(d: Design, path: GroupPath, change: (item: Extract<Group['item'], { k: 'charge' }>) => Extract<Group['item'], { k: 'charge' }>): Design {
  const g = groupAt(d, path);
  if (g.item.k !== 'charge') return d;
  const item = change(g.item);
  return canonical(replaceGroup(d, path, { ...g, item }));
}

/** The charge at `path` in a posture; the pictures on it are refitted to the room its new drawing leaves them. */
export function setPosture(d: Design, path: GroupPath, posture: Posture): Design {
  return refitLayers(withItem(d, path, (item) => ({ ...item, posture })));
}

export function setModifier(d: Design, path: GroupPath, id: ModifierId, on: boolean): Design {
  const changed = withItem(d, path, (item) => ({
    ...item, mods: on ? [...item.mods.filter((m) => m.id !== id), { id, count: null, paint: null }] : item.mods.filter((m) => m.id !== id),
  }));
  // A picture drawn with a modifier has no room for pictures on it (its drawing is changed): they are dropped.
  const parts = partsOf(changed);
  return parts.onPicture && parts.picture?.item.k === 'charge' && parts.picture.item.mods.length > 0
    ? refitLayers(assembleParts(changed, { ...parts, onPicture: null }))
    : changed;
}

export function setGroupTincture(d: Design, path: GroupPath, t: GroupTincture): Design {
  return canonical(withTincture(d, path, t));
}

// ── Notes about count and placement changes ─────────────────────────────────

/** Whether the group's tinctures break the rule of tincture where it lies. */
export function chargesClash(d: Design, path: GroupPath): boolean {
  return groupTinctureIssues(d, path).length > 0;
}

const colourWord = (t: GroupTincture) => TINCTURE_LABEL[t].plain.toLowerCase();

/** What clashing charges lie on, in plain words: "red cross", "gold background", "gold part of the background". */
function clashGround(d: Design, path: GroupPath, t: Tincture): string {
  const host = hostOf(d, path);
  if (host?.item.k === 'ordinary') {
    const paint = groupTinctureOf(host.paint);
    return `${paint ? colourWord(paint) : asParty(host.paint) ? 'split-colour' : 'swapped-colour'} ${ORDINARY_LABEL[host.item.type].plain.toLowerCase()}`;
  }
  // The look-alike tinctures under the failing charges: the ones they don't stand out against.
  const alike = groundShares(d, path)
    .filter((ground) => groundFailure(tinctureSurface(t), ground))
    .flatMap((ground) => groundTinctures(ground).filter((c) => TINCTURE_CLASS[c] === TINCTURE_CLASS[t]));
  const words = [...new Set(alike)].map(colourWord);
  if (d.kind === 'arms' && d.field.k === 'tincture') return `${words[0]} background`;
  return words.length === 1 ? `${words[0]} part of the background` : `${words.join(' and ')} parts of the background`;
}

/** "On the background" / "On the vertical band" / "Around the vertical band" / "Below the top bar" / "Within the border". */
export function placementLabel(d: Design, placement: Placement): string {
  const o = simpleParts(d).ordinary?.group.item;
  const name = (type: OrdinaryType) => ORDINARY_LABEL[type].plain.toLowerCase();
  const ordinary = o?.k === 'ordinary' ? o.type : null;
  if (placement === 'ordinary') return ordinary ? `On the ${name(ordinary)}` : 'On the band or shape';
  if (!ordinary) return 'On the background';
  if (ordinary === 'chief') return 'Below the top bar';
  if (ordinary === 'bordure') return 'Within the border';
  return ORDINARY_KIND[ordinary] === 'central' ? `Around the ${name(ordinary)}` : 'On the background';
}

const countText = (n: number) => (n === 1 ? 'one' : numberWord(n));

/** The layout change itself: "Moves the lions around the cross" / "Changed to four lions". */
function companionChange(next: Design, companion: Companion, tense: 'offered' | 'done', noun: string, count: number): string {
  if (companion.kind === 'count') return `${tense === 'offered' ? 'Changes' : 'Changed'} to ${countText(count)} ${noun}`;
  // "On the cross" → "onto the cross"; "Around the cross" → "around the cross".
  const label = placementLabel(next, companion.placement);
  const where = companion.placement === 'ordinary' ? label.replace(/^On /, 'onto ') : `${label.charAt(0).toLowerCase()}${label.slice(1)}`;
  return `${tense === 'offered' ? 'Moves' : 'Moved'} the ${noun} ${where}`;
}

/**
 * What else a count or placement choice changes, in words, for the design it leads to: offered
 * ("Moves the lions around the cross", "Changes to four lions") or done ("Moved…", "Changed…").
 * Only the layout moves, never a colour, so when the picture's colour then breaks the rule the note
 * says so: "…; the gold lions would then need a new colour" / "… The gold lions don't stand out on
 * the gold background — pick a new colour below."
 */
export function companionNote(next: Design, companion: Companion, tense: 'offered' | 'done'): string {
  const path = picturePath(next);
  const g = path && groupAt(next, path);
  if (!path || !g || g.item.k !== 'charge') throw new RangeError('A companion note needs a picture.');
  const meta = CHARGES[g.item.charge];
  const noun = g.count === 1 ? meta.glossName : meta.glossPlural;
  const change = companionChange(next, companion, tense, noun, g.count);
  if (!chargesClash(next, path)) return tense === 'offered' ? change : `${change}.`;
  const paint = groupTinctureOf(g.paint);
  const plainPaint = paint && paint !== 'counterchanged' ? paint : null;
  const subject = plainPaint ? `the ${colourWord(plainPaint)} ${noun}` : `the ${noun}`;
  if (tense === 'offered') return `${change}; ${subject} would then need a new colour`;
  const why = plainPaint
    ? `${g.count === 1 ? "doesn't" : "don't"} stand out on the ${clashGround(next, path, plainPaint)}`
    : "can't take swapped colours there";
  return `${change}. ${capitalise(subject)} ${why} — pick a new colour below.`;
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

export function assess(d: Design): DesignReport {
  const issues = [...structuralIssues(d), ...tinctureIssues(d)];
  const problems = issues.filter((i) => i.code !== 'generic');
  const generic = issues.find((i) => i.code === 'generic');
  const status: DesignStatus = problems.length ? 'violation' : generic ? 'incomplete' : 'valid';
  return { status, problems, hint: generic ? 'Add a band or shape, or a picture — a plain background alone is too generic to register.' : null };
}

/** The step an issue belongs to: the background, or the place of the group it is about (the picture, when that is all the group is). */
export function issueStep(d: Design, issue: Issue): StepKey {
  if (issue.at.k === 'field') return 'field';
  if (issue.at.k === 'design') return 'picture';
  const place = placeOfPath(d, issue.at.path);
  // Pictures set only on the band are the picture step's own.
  return !place || (place === 'on-ordinary' && simpleParts(d).extra === null) ? 'picture' : place;
}

/**
 * The readability tip to show: none while the rule of tincture is broken. That has to be fixed
 * first, and a tip such as "Try a single lion instead of four" would point away from the fix —
 * often back to the layout just chosen.
 */
export function readabilityTip(r: Readability, report: DesignReport): string | null {
  return report.problems.some((p) => p.code === 'tincture') ? null : r.nudge;
}

/** A rule fix's button text: "Fix: switch the lions to Gules". */
export function fixText(label: string): string {
  return `Fix: ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
}

export const sameDesign = (a: Design, b: Design): boolean => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

export function sameShapedDesign(a: ShapedDesign, b: ShapedDesign): boolean {
  return a.shape === b.shape && sameDesign(a.design, b.design);
}

/** The starting point: nothing has been designed yet, so nothing is lost by replacing it. */
export function isUntouched(d: ShapedDesign): boolean {
  return d.shape === DEFAULT_FIELD_SHAPE && sameDesign(d.design, DEFAULT_DESIGN);
}

/**
 * A design swapped in for another, and the one to bring back on Undo: replaced wholesale (an
 * example, Surprise me, a registry entry) or adjusted — a choice that changed something else too,
 * which `note` says.
 */
export type Replacement =
  | { kind: 'replaced'; previous: ShapedDesign; replacement: ShapedDesign }
  | { kind: 'adjusted'; previous: ShapedDesign; replacement: ShapedDesign; note: string };

/** What replacing `current` with `next` would lose: null when current is untouched or identical to next. */
export function replaceDesign(current: ShapedDesign, next: ShapedDesign): Replacement | null {
  return isUntouched(current) || sameShapedDesign(current, next) ? null : { kind: 'replaced', previous: current, replacement: next };
}

/** A count or placement choice applied with its companion change, kept so it can be undone. */
export function adjustDesign(current: ShapedDesign, next: Design, companion: Companion): Replacement {
  return { kind: 'adjusted', previous: current, replacement: { shape: current.shape, design: next }, note: companionNote(next, companion, 'done') };
}

/** Undo stays on offer only until the replacement is edited; undoing then would throw that work away too. */
export function undoStillOffered(r: Replacement, now: ShapedDesign): boolean {
  return sameShapedDesign(r.replacement, now);
}
