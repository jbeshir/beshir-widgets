// Builder edits: pure Design → Design transitions used by the Design tab (DOM-free, unit tested).
// Lower-layer edits are always applied; the pictures are then refitted structurally (fitGroup) and any
// rule-of-tincture conflict is left in place for the violation panel to surface and offer a fix —
// never silently repaired. Every transition returns a canonical design.

import {
  CHARGES, DEFAULT_FIELD_SHAPE, ORDINARY_KIND, ORDINARY_LABEL, PLAIN_LINES, TINCTURE_CLASS, TINCTURE_LABEL, assembleParts, canonical, contrastFailure,
  countChoices, fieldTinctures, fitGroup, groundContacts, groupAt, groupTinctureChoices, groupTinctureIssues, groupTinctureOf, hostOf, isMetal, replaceGroup,
  layoutReason, placementChoices, simpleParts, structuralIssues, tincturePaint, tinctureIssues, withTincture, applyLayout,
  type ChargeId, type Choice, type Companion, type Design, type Division, type Group, type GroupPath, type GroupTincture, type Issue,
  type LayoutChoice, type LayoutKey, type ModifierId, type OrdinaryType, type Paint, type Placement, type Posture, type Readability, type ShapedDesign, type Tincture,
} from '../heraldry/next';
import { capitalise, numberWord } from '../heraldry/words';

export const DEFAULT_DESIGN: Design = { v: 2, kind: 'arms', field: tincturePaint('azure'), groups: [] };

/** The builder's steps: the background, the band or shape, the picture, and the extra pictures on the band. */
export type StepKey = 'field' | 'ordinary' | 'picture' | 'extra';

export const STEP_LABEL: Record<StepKey, string> = {
  field: 'Background', ordinary: 'Band or shape', picture: 'Picture', extra: 'Extra pictures',
};

// ── Where things are ────────────────────────────────────────────────────────

export const ordinaryPath = (d: Design): GroupPath | null => simpleParts(d).ordinary?.path ?? null;
export const picturePath = (d: Design): GroupPath | null => simpleParts(d).picture?.path ?? null;
export const extraPicturePath = (d: Design): GroupPath | null => simpleParts(d).extra?.path ?? null;

function firstAllowed<T>(choices: Choice<T>[], fallback: T): T {
  return choices.find((c) => c.allowed)?.value ?? fallback;
}

function isAllowed<T>(choices: Choice<T>[], v: T): boolean {
  return choices.some((c) => c.value === v && c.allowed);
}

// ── Field ───────────────────────────────────────────────────────────────────

/** The pictures refitted to the design they now sit in. */
function refit(d: Design): Design {
  return [picturePath, extraPicturePath].reduce((out, find) => {
    const path = find(out);
    return path ? fitGroup(out, path) : out;
  }, d);
}

function withField(d: Design, field: Paint): Design {
  return { v: 2, kind: 'arms', field, groups: d.groups };
}

/** A second tincture for a newly divided field: contrasting class, never equal to the first. */
function partner(t: Tincture): Tincture {
  if (!isMetal(t)) return 'or';
  return t === 'or' ? 'azure' : 'gules';
}

export function setPlainField(d: Design): Design {
  if (d.kind !== 'arms' || d.field.k !== 'divided') return d;
  return refit(canonical(withField(d, tincturePaint(fieldTinctures(d)[0]))));
}

export function setDivision(d: Design, division: Division): Design {
  const [t1, t2] = fieldTinctures(d);
  const second = t2 && t2 !== t1 ? t2 : partner(t1);
  return refit(canonical(withField(d, {
    k: 'divided', division, lines: { ...PLAIN_LINES }, pieces: null, parts: [tincturePaint(t1), tincturePaint(second)],
  })));
}

export function setFieldTincture(d: Design, part: 0 | 1, t: Tincture): Design {
  if (d.kind !== 'arms') return d;
  const f = d.field;
  if (f.k !== 'divided') return canonical(withField(d, tincturePaint(t)));
  const parts = f.parts.map((p, i) => (i === part ? tincturePaint(t) : p));
  return canonical(withField(d, { ...f, parts }));
}

// ── Ordinary ────────────────────────────────────────────────────────────────

function newOrdinary(type: OrdinaryType, t: GroupTincture): Group {
  const central = ORDINARY_KIND[type] === 'central';
  return {
    role: central ? 'primary' : 'peripheral', relation: null,
    item: { k: 'ordinary', type, lines: { ...PLAIN_LINES }, mods: [], cotised: null, fimbriated: null },
    count: 1, arrangement: { k: 'single' }, position: null,
    paint: t === 'counterchanged' ? { k: 'counterchanged' } : tincturePaint(t), charged: [],
  };
}

/** The ordinary replaced (null: removed), the pictures kept where they can be: a picture on a vanished ordinary goes to the background, extra pictures are dropped. */
function rebuilt(d: Design, ordinary: Group | null): Design {
  const parts = simpleParts(d);
  return refit(assembleParts(d, {
    ordinary, picture: parts.picture?.group ?? null, placement: parts.picture?.placement ?? 'field', extra: parts.extra?.group ?? null,
  }));
}

export function setOrdinary(d: Design, type: OrdinaryType | null): Design {
  if (!type) return rebuilt(d, null);
  const previous = simpleParts(d).ordinary?.group.paint;
  const kept = previous && groupTinctureOf(previous);
  const placed = rebuilt(d, newOrdinary(type, kept ?? 'or'));
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

function chargeItem(id: ChargeId, previous: Group | null): Group['item'] {
  const meta = CHARGES[id];
  const was = previous?.item.k === 'charge' ? previous.item : null;
  const posture = meta.postures ? (was?.posture && meta.postures.includes(was.posture) ? was.posture : meta.defaultPosture) : null;
  return {
    k: 'charge', charge: id, form: null, posture, facing: meta.defaultFacing, orientation: null,
    mods: was ? was.mods.filter((m) => meta.mods.includes(m.id)) : [], parts: [], holds: [],
  };
}

function newPicture(id: ChargeId, role: Group['role']): Group {
  return {
    role, relation: null, item: chargeItem(id, null), count: 1, arrangement: { k: 'single' }, position: null, paint: tincturePaint('or'), charged: [],
  };
}

/** The picture at `path` painted with the first tincture that works there, as a new picture should be. */
function withFirstTincture(d: Design, path: GroupPath): Design {
  return withTincture(d, path, firstAllowed(groupTinctureChoices(d, path), 'or'));
}

/**
 * The picture (`which` 'picture') or extra picture ('extra') as this charge; null removes it. A new
 * picture starts as a single charge on the background in the first tincture that works; a swapped one
 * keeps its count, layout and tincture where they still work. Removing the picture promotes the
 * extra pictures to the picture.
 */
export function setCharge(d: Design, which: 'picture' | 'extra', id: ChargeId | null): Design {
  if (which === 'extra') return id ? (extraPicturePath(d) ? swapCharge(d, 'extra', id) : addExtraPicture(d, id)) : removeExtraPicture(d);
  const parts = simpleParts(d);
  if (!id) {
    const promoted = parts.extra?.group ?? null;
    return refit(assembleParts(d, { ordinary: parts.ordinary?.group ?? null, picture: promoted, placement: 'ordinary', extra: null }));
  }
  if (parts.picture) return swapCharge(d, 'picture', id);
  const placed = refit(assembleParts(d, { ordinary: parts.ordinary?.group ?? null, picture: newPicture(id, 'primary'), placement: 'field', extra: null }));
  return canonical(withFirstTincture(placed, picturePath(placed)!));
}

function swapCharge(d: Design, which: 'picture' | 'extra', id: ChargeId): Design {
  const parts = simpleParts(d);
  const target = which === 'picture' ? parts.picture : parts.extra;
  if (!target || !parts.picture) return d;
  const swapped: Group = { ...target.group, item: chargeItem(id, target.group) };
  const placed = assembleParts(d, {
    ordinary: parts.ordinary?.group ?? null,
    picture: which === 'picture' ? swapped : parts.picture.group,
    placement: parts.picture.placement,
    extra: which === 'extra' ? swapped : parts.extra?.group ?? null,
  });
  return refit(placed);
}

/** The design with an extra picture of this charge on the band, or null when the band can't carry one that works. */
function withExtraPicture(d: Design, id: ChargeId): Design | null {
  const parts = simpleParts(d);
  if (!parts.picture || parts.picture.placement !== 'field' || parts.extra || !parts.ordinary) return null;
  const placed = assembleParts(d, {
    ordinary: parts.ordinary.group, picture: parts.picture.group, placement: 'field', extra: newPicture(id, 'tertiary'),
  });
  const path = extraPicturePath(placed);
  if (!path) return null;
  const fitted = fitGroup(placed, path);
  return layoutReason(fitted, path, true) === null ? canonical(withFirstTincture(fitted, path)) : null;
}

/** Whether the band or top bar can carry extra pictures: the picture is on the background and some count and tincture works for them. */
export function canAddExtraPicture(d: Design): boolean {
  // Which charge it is doesn't change what fits: the one layout only some charges have (crossed) has plain alternatives.
  return withExtraPicture(d, 'mullet') !== null;
}

export function addExtraPicture(d: Design, id: ChargeId): Design {
  return withExtraPicture(d, id) ?? d;
}

export function removeExtraPicture(d: Design): Design {
  const parts = simpleParts(d);
  if (!parts.extra || !parts.picture) return d;
  return assembleParts(d, { ordinary: parts.ordinary?.group ?? null, picture: parts.picture.group, placement: parts.picture.placement, extra: null });
}

/** The design a count or placement choice leads to; a blocked (or unknown) one changes nothing. */
function chosenDesign<T>(d: Design, choices: LayoutChoice<T>[], value: T): Design {
  const c = choices.find((x) => x.value === value);
  return c?.allowed ? c.design : d;
}

/** A new count, bringing the placement along when only the other placement takes it (see countChoices). */
export function setCount(d: Design, path: GroupPath, count: number): Design {
  return chosenDesign(d, countChoices(d, path), count);
}

/** A new placement, bringing the nearest count it takes along when the current one doesn't fit (see placementChoices). */
export function setPlacement(d: Design, path: GroupPath, placement: Placement): Design {
  return chosenDesign(d, placementChoices(d, path), placement);
}

export function setLayout(d: Design, path: GroupPath, key: LayoutKey): Design {
  return applyLayout(d, path, key);
}

function withItem(d: Design, path: GroupPath, change: (item: Extract<Group['item'], { k: 'charge' }>) => Extract<Group['item'], { k: 'charge' }>): Design {
  const g = groupAt(d, path);
  if (g.item.k !== 'charge') return d;
  const item = change(g.item);
  return canonical(replaceGroup(d, path, { ...g, item }));
}

export function setPosture(d: Design, path: GroupPath, posture: Posture): Design {
  return withItem(d, path, (item) => ({ ...item, posture }));
}

export function setModifier(d: Design, path: GroupPath, id: ModifierId, on: boolean): Design {
  return withItem(d, path, (item) => ({
    ...item, mods: on ? [...item.mods.filter((m) => m.id !== id), { id, count: null, paint: null }] : item.mods.filter((m) => m.id !== id),
  }));
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
    return `${paint ? colourWord(paint) : 'swapped-colour'} ${ORDINARY_LABEL[host.item.type].plain.toLowerCase()}`;
  }
  // The look-alike tinctures under the failing charges: the ones they don't stand out against.
  const alike = groundContacts(d, path)
    .filter((cs) => contrastFailure(t, cs))
    .flatMap((cs) => cs.filter((c) => TINCTURE_CLASS[c] === TINCTURE_CLASS[t]));
  const words = [...new Set(alike)].map(colourWord);
  if (d.kind === 'arms' && d.field.k === 'tincture') return `${words[0]} background`;
  return words.length === 1 ? `${words[0]} part of the background` : `${words.join(' and ')} parts of the background`;
}

/** "On the background" / "On the vertical band" / "Around the vertical band" / "Below the top bar" / "Within the border". */
export function placementLabel(d: Design, placement: Placement): string {
  const o = simpleParts(d).ordinary?.group.item;
  const name = (type: OrdinaryType) => ORDINARY_LABEL[type].plain.toLowerCase();
  const ordinary = o?.k === 'ordinary' ? o.type : null;
  if (placement === 'ordinary') return ordinary && ordinary !== 'bordure' ? `On the ${name(ordinary)}` : 'On the band or shape';
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

/** The step an issue belongs to: the background, the band or shape, the picture or the extra pictures. */
export function issueStep(d: Design, issue: Issue): StepKey {
  if (issue.at.k !== 'group') return 'field';
  const { path } = issue.at;
  if (groupAt(d, path).item.k === 'ordinary') return 'ordinary';
  const extra = extraPicturePath(d);
  return extra && extra.join() === path.join() ? 'extra' : 'picture';
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
