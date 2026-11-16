import { describe, expect, it } from 'vitest';
import type { AstrolabeState } from '../store';
import { evaluateCheckpoint } from './checkpoints';
import { CONCEPTS, type ConceptId } from './concepts';
import { LESSONS } from './catalog';
import { describeFrameRef, describePartRef, frameBase, isValidFrameRef, partFace, partId, type PartId } from './parts';
import type { Lesson, LessonId, LessonStep, Predicate, Snapshot } from './types';

/*
 * Course integrity (VALIDATION-DESIGN §1 and §5): concept references,
 * prerequisites, the per-mode content contract, and copy rules. Each check
 * collects every violation so a failure lists them all.
 */

const hasRulePoint = (check: Predicate): boolean => check.kind === 'allOf'
  ? check.predicates.some(hasRulePoint) : check.kind === 'frontGeometry' && check.rulePoint !== undefined;

type Located = { lesson: Lesson; step: LessonStep; index: number };
const STEPS: Located[] = LESSONS.flatMap((lesson) => lesson.steps.map((step, index) => ({ lesson, step, index })));
const where = ({ lesson, step, index }: Located) => `${lesson.id}#${index + 1} ${step.id}`;
const lessonById = new Map<string, Lesson>(LESSONS.map((lesson) => [lesson.id, lesson]));
const conceptById = new Map(CONCEPTS.map((concept) => [concept.id, concept]));

function transitivePrereqs(id: LessonId): Set<LessonId> {
  const seen = new Set<LessonId>();
  const visit = (lessonId: LessonId) => {
    for (const prerequisite of lessonById.get(lessonId)?.prerequisites ?? []) {
      if (!seen.has(prerequisite)) { seen.add(prerequisite); visit(prerequisite); }
    }
  };
  visit(id);
  return seen;
}
/** Where each concept is introduced: lesson id and 0-based step index. */
const introductions = new Map<ConceptId, { lessonId: LessonId; index: number }[]>();
for (const { lesson, step, index } of STEPS) {
  for (const id of step.introduces) introductions.set(id, [...(introductions.get(id) ?? []), { lessonId: lesson.id, index }]);
}
/** True when concept `id` has been taught by (lesson, index): earlier in the lesson, here, or in a prerequisite. */
function taughtBy(id: ConceptId, lessonId: LessonId, index: number, includeHere: boolean): boolean {
  const prerequisites = transitivePrereqs(lessonId);
  return (introductions.get(id) ?? []).some((at) => prerequisites.has(at.lessonId)
    || (at.lessonId === lessonId && (includeHere ? at.index <= index : at.index < index)));
}

/** The state at the end of a step's demonstration (the snapshot for steps without one). */
function endState(step: LessonStep): AstrolabeState {
  const state: AstrolabeState = { ...step.snapshot, highlight: null, reducedMotion: false };
  const demo = step.demonstration;
  if (!demo) return state;
  if (demo.kind === 'face') return { ...state, face: demo.to };
  if (demo.kind === 'plate') return { ...state, plateSelection: 'pinned', plateLatitude: demo.to };
  return { ...state, [demo.field]: demo.to, ...(demo.companion ? { [demo.companion.field]: demo.companion.to } : {}) };
}
const stateOf = (snapshot: Snapshot, patch: Partial<Snapshot> = {}): AstrolabeState =>
  ({ ...snapshot, ...patch, highlight: null, reducedMotion: false });
const isPredicate = (check: LessonStep['check']): check is Predicate => Boolean(check) && check?.kind !== 'choice';

describe('concept integrity', () => {
  it('C1: every concept and prerequisite id is known', () => {
    const errors: string[] = [];
    for (const located of STEPS) {
      for (const id of [...located.step.introduces, ...located.step.uses]) if (!conceptById.has(id)) errors.push(`${where(located)}: ${id}`);
    }
    for (const lesson of LESSONS) for (const id of lesson.prerequisites) if (!lessonById.has(id)) errors.push(`${lesson.id} needs ${id}`);
    expect(errors).toEqual([]);
  });

  it('C2: each concept is introduced exactly once, at the step the ledger names', () => {
    const errors: string[] = [];
    for (const concept of CONCEPTS) {
      const at = introductions.get(concept.id) ?? [];
      if (at.length !== 1) { errors.push(`${concept.id} introduced ${at.length} times`); continue; }
      const [{ lessonId, index }] = at;
      if (lessonId !== concept.introducedAt.lesson || index + 1 !== concept.introducedAt.step) {
        errors.push(`${concept.id} introduced at ${lessonId}#${index + 1}, ledger says ${concept.introducedAt.lesson}#${concept.introducedAt.step}`);
      }
    }
    expect(errors).toEqual([]);
  });

  it('C3: every use comes after its introduction, in this lesson or a prerequisite', () => {
    const errors: string[] = [];
    for (const located of STEPS) {
      const { lesson, step, index } = located;
      for (const id of step.uses) {
        if (step.introduces.includes(id)) errors.push(`${where(located)}: ${id} both introduced and used`);
        else if (!taughtBy(id, lesson.id, index, false)) errors.push(`${where(located)}: uses ${id} before it is taught`);
      }
    }
    expect(errors).toEqual([]);
  });

  it('C4: prerequisites come earlier in the course, so no lesson depends on a later one', () => {
    const order = LESSONS.map((lesson) => lesson.id);
    const errors: string[] = [];
    for (const [position, lesson] of LESSONS.entries()) {
      for (const prerequisite of lesson.prerequisites) {
        if (prerequisite === lesson.id) errors.push(`${lesson.id} names itself`);
        else if (order.indexOf(prerequisite) >= position) errors.push(`${lesson.id} depends on later ${prerequisite}`);
      }
      if (position > 0 && lesson.prerequisites.length === 0) errors.push(`${lesson.id} has no prerequisites`);
    }
    expect(errors).toEqual([]);
  });

  it('C5: every highlighted part belongs to a concept already taught', () => {
    const errors: string[] = [];
    for (const located of STEPS) {
      const { lesson, step, index } = located;
      for (const ref of step.highlights) {
        const part = partId(ref);
        const owners = CONCEPTS.filter((concept) => concept.parts.some((item) => partId(item) === part)).map((concept) => concept.id);
        if (!owners.some((id) => taughtBy(id, lesson.id, index, true))) errors.push(`${where(located)}: ${describePartRef(ref)} not yet taught`);
      }
    }
    expect(errors).toEqual([]);
  });

  it('C6: each concept is made visible at its introduction as the ledger says', () => {
    const moved = (step: LessonStep): PartId[] => {
      const demo = step.demonstration;
      if (!demo) return [];
      if (demo.kind === 'face') return ['face-toggle'];
      if (demo.kind === 'plate') return ['plate-selector', 'plate'];
      const fields = [demo.field, ...(demo.companion ? [demo.companion.field] : [])];
      return fields.map((field) => ({ reteRotation: 'rete', ruleRotation: 'rule', alidadeRotation: 'alidade' } as const)[field]);
    };
    const errors: string[] = [];
    for (const located of STEPS) {
      const { step } = located;
      const highlighted = step.highlights.map(partId);
      for (const id of step.introduces) {
        const concept = conceptById.get(id);
        if (!concept) continue;
        const parts = concept.parts.map(partId);
        if ((concept.face === 'front' || concept.face === 'back') && step.snapshot.face !== concept.face) errors.push(`${where(located)}: ${id} is a ${concept.face} concept`);
        if (concept.visibility === 'highlighted' && !parts.some((part) => highlighted.includes(part))) errors.push(`${where(located)}: ${id} should be highlighted`);
        if (concept.visibility === 'animated' && !(step.demonstration && parts.some((part) => moved(step).includes(part) || highlighted.includes(part)))) {
          errors.push(`${where(located)}: ${id} should be animated`);
        }
      }
    }
    expect(errors).toEqual([]);
  });

  it('P2: highlights sit on the face the step shows (or on both faces, or the page controls)', () => {
    const errors: string[] = [];
    for (const located of STEPS) {
      for (const ref of located.step.highlights) {
        const face = partFace(ref);
        if (face !== 'both' && face !== 'controls' && face !== located.step.snapshot.face) errors.push(`${where(located)}: ${describePartRef(ref)} is on the ${face}`);
      }
    }
    expect(errors).toEqual([]);
  });
});

describe('teaching contract per mode', () => {
  it('M1: every step carries the fields its mode needs', () => {
    const errors: string[] = [];
    for (const located of STEPS) {
      const { step } = located;
      const problem = (text: string) => errors.push(`${where(located)} (${step.mode}): ${text}`);
      if (!step.title.trim() || !step.purpose.trim() || !step.body.trim() || !step.result.trim()) problem('missing title, purpose, instruction or meaning');
      switch (step.mode) {
        case 'demonstrate':
          if (!step.demonstration) problem('no demonstration');
          if (!isPredicate(step.check)) problem('no instrument check');
          if (!step.stopCue) problem('no stop cue');
          else if (isPredicate(step.check) && !evaluateCheckpoint(step.check, endState(step))) problem('check fails at the end of the demonstration');
          if (step.solution) problem('a demonstration needs no solution');
          break;
        case 'your-turn':
          if (step.demonstration) problem('the learner moves the part, so no demonstration');
          if (!step.stopCue) problem('no stop cue');
          if (!isPredicate(step.check) || !step.solution) { problem('needs an instrument check and a solution'); break; }
          if (evaluateCheckpoint(step.check, stateOf(step.snapshot))) problem('check already passes at the starting position');
          if (!evaluateCheckpoint(step.check, stateOf(step.snapshot, step.solution))) problem('check fails at the solution');
          else if (hasRulePoint(step.check) && step.solution.ruleRotation !== undefined
            && evaluateCheckpoint(step.check, stateOf(step.snapshot, { ...step.solution, ruleRotation: step.solution.ruleRotation + 180 }))) problem('check also passes with the rule turned end for end');
          break;
        case 'read':
          if (step.check?.kind !== 'choice') problem('needs a choice question');
          if (step.demonstration || step.solution) problem('a reading moves nothing');
          break;
        case 'explain':
          if (step.check || step.demonstration || step.solution) problem('an explanation has no check or motion');
          break;
      }
    }
    expect(errors).toEqual([]);
  });

  it('starts each demonstration where its snapshot leaves the part', () => {
    const errors: string[] = [];
    for (const located of STEPS) {
      const demo = located.step.demonstration;
      if (!demo) continue;
      const snapshot = located.step.snapshot;
      if (demo.kind === 'face') { if (snapshot.face === demo.to) errors.push(`${where(located)}: already on the ${demo.to}`); continue; }
      if (demo.kind === 'plate') { if (demo.from !== snapshot.plateLatitude) errors.push(`${where(located)}: plate swap should start from the snapshot plate`); continue; }
      for (const motion of [demo, ...(demo.companion ? [demo.companion] : [])]) {
        if (Math.abs(motion.from - snapshot[motion.field]) > 1e-9) errors.push(`${where(located)}: ${motion.field} starts at ${motion.from}, snapshot ${snapshot[motion.field]}`);
      }
      if (isPredicate(located.step.check) && evaluateCheckpoint(located.step.check, stateOf(snapshot))) errors.push(`${where(located)}: check passes before the demonstration`);
    }
    expect(errors).toEqual([]);
  });

  it('M2: every manipulation is demonstrated, then performed by the learner', () => {
    const errors: string[] = [];
    const manipulations = CONCEPTS.filter((concept) => concept.kind === 'manipulation');
    /** Manipulations the learner never repeats as a separate your-turn step, with the reason. */
    const EXEMPT: Partial<Record<ConceptId, string>> = {
      'turn-over': 'A single button press; every later two-face lesson opens on the face it needs.',
    };
    for (const concept of manipulations) {
      const [intro] = introductions.get(concept.id) ?? [];
      const introStep = intro && lessonById.get(intro.lessonId)?.steps[intro.index];
      if (!introStep || introStep.mode !== 'demonstrate' || !introStep.stopCue) errors.push(`${concept.id}: not introduced by a demonstration with a stop cue`);
      if (EXEMPT[concept.id]) continue;
      const practised = STEPS.some(({ lesson, step, index }) => step.mode === 'your-turn' && step.stopCue && isPredicate(step.check)
        && step.uses.includes(concept.id) && taughtBy(concept.id, lesson.id, index, false));
      if (!practised) errors.push(`${concept.id}: no later your-turn step uses it`);
    }
    expect(errors).toEqual([]);
  });

  it('M3: every calculation lesson checks a second worked value with different inputs', () => {
    // Lessons 6–12. (Lesson 5's two dates lie on one line through the centre by design, see `opposite-points`.)
    const calculation = LESSONS.slice(5);
    const errors: string[] = [];
    for (const lesson of calculation) {
      const demonstrated = lesson.steps.filter((step) => step.mode === 'demonstrate' && isPredicate(step.check));
      const performed = lesson.steps.filter((step) => step.mode === 'your-turn' && isPredicate(step.check));
      const transfer = performed.some((mine) => demonstrated.some((shown) =>
        JSON.stringify(mine.check) !== JSON.stringify(shown.check)
        && !evaluateCheckpoint(mine.check as Predicate, endState(shown))));
      if (!transfer) errors.push(`${lesson.id}: no your-turn check that differs from, and fails at, a demonstrated example`);
      const epochs = new Set(lesson.steps.filter((step) => isPredicate(step.check)).map((step) => step.snapshot.epochIso));
      if (lesson.id !== 'back.shadow-square.v1' && epochs.size < 2) errors.push(`${lesson.id}: both worked values use one date`);
    }
    expect(errors).toEqual([]);
  });

  it('gives every your-turn step a different target from the step before it', () => {
    // The your-turn snapshot is the previous position, so the learner always has something to do.
    const errors: string[] = [];
    for (const located of STEPS) {
      const { lesson, step, index } = located;
      if (step.mode !== 'your-turn' || index === 0) continue;
      const previous = lesson.steps[index - 1];
      if (isPredicate(step.check) && evaluateCheckpoint(step.check, endState(previous)) && previous.mode !== 'explain' && previous.mode !== 'read') {
        errors.push(`${where(located)}: already satisfied where the previous step ends`);
      }
    }
    expect(errors).toEqual([]);
  });

  it('never starts a rule-only your-turn step with the rule almost on the answer, either way round', () => {
    // With the rete already set, a rule within 30° of its solution (or of the solution turned 180°) looks solved.
    const errors: string[] = [];
    for (const located of STEPS) {
      const { step } = located;
      if (step.mode !== 'your-turn' || step.solution?.ruleRotation === undefined || step.solution.reteRotation !== undefined) continue;
      const turn = Math.abs(step.snapshot.ruleRotation - step.solution.ruleRotation) % 180;
      const apart = Math.min(turn, 180 - turn);
      if (apart < 30) errors.push(`${where(located)}: the rule starts ${apart.toFixed(1)}° from its answer (mod 180°)`);
    }
    expect(errors).toEqual([]);
  });
});

describe('learner-visible copy', () => {
  const copyOf = (located: Located): { field: string; text: string }[] => {
    const { lesson, step } = located;
    const texts = [
      { field: 'lesson title', text: lesson.title }, { field: 'lesson summary', text: lesson.summary },
      { field: 'title', text: step.title }, { field: 'purpose', text: step.purpose }, { field: 'body', text: step.body },
      { field: 'stop cue', text: step.stopCue ?? '' }, { field: 'result', text: step.result },
    ];
    if (step.check?.kind === 'choice') {
      texts.push({ field: 'prompt', text: step.check.prompt });
      for (const option of step.check.options) texts.push({ field: 'option', text: `${option.label} ${option.misconception ?? ''}` });
    }
    return texts;
  };
  const BANNED = /\b(fixture|deterministic|endpoint|API|solver|snapshot|predicate|checkpoint|rotation|undefined|NaN|null)\b/i;
  const IDENTIFIER = /\b[a-z]+[A-Z]\w*\b|data-|\$\{|=>/;

  it('M4: contains no implementation terms or code identifiers', () => {
    const errors: string[] = [];
    for (const located of STEPS) {
      for (const { field, text } of copyOf(located)) {
        const hit = text.match(BANNED) ?? text.match(IDENTIFIER);
        if (hit) errors.push(`${where(located)} ${field}: “${hit[0]}”`);
      }
    }
    for (const concept of CONCEPTS) {
      const hit = concept.definition.match(BANNED) ?? concept.definition.match(IDENTIFIER);
      if (hit) errors.push(`concept ${concept.id}: “${hit[0]}”`);
    }
    expect(errors).toEqual([]);
  });

  it('M5: never asks for a rete or rule angle; learners reach positions through engraved marks', () => {
    const errors: string[] = [];
    for (const located of STEPS) {
      const { step } = located;
      const targets: number[] = [];
      const demo = step.demonstration;
      if (demo && demo.kind !== 'face' && demo.kind !== 'plate') {
        for (const motion of [demo, ...(demo.companion ? [demo.companion] : [])]) if (motion.field !== 'alidadeRotation') targets.push(motion.to);
      }
      if (step.solution?.reteRotation !== undefined) targets.push(step.solution.reteRotation);
      if (step.solution?.ruleRotation !== undefined) targets.push(step.solution.ruleRotation);
      const collect = (check: LessonStep['check']) => {
        if (!check || check.kind === 'choice') return;
        if (check.kind === 'angleNear' && check.field !== 'alidadeRotation') targets.push(check.value);
        if (check.kind === 'allOf') check.predicates.forEach(collect);
      };
      collect(step.check);
      const copy = copyOf(located).map((item) => item.text).join(' ');
      for (const value of targets.filter((target) => Math.abs(target) > 0.5 && Math.abs(target - 360) > 0.5)) {
        for (const text of [`${value.toFixed(0)}°`, `${value.toFixed(1)}°`]) {
          if (new RegExp(`(^|[^\\d.])${text.replace('.', '\\.')}`).test(copy)) errors.push(`${where(located)}: mentions the angle ${text}`);
        }
      }
    }
    expect(errors).toEqual([]);
  });

  it('M5: never asks the learner to type a number', () => {
    const errors = STEPS.filter((located) => /\b(type|enter|input)\b/i.test(located.step.body)).map(where);
    expect(errors).toEqual([]);
  });

  it('FG-3: every choice has 2–4 distinct options, one correct, a note on each distractor', () => {
    const errors: string[] = [];
    for (const located of STEPS) {
      const check = located.step.check;
      if (check?.kind !== 'choice') continue;
      if (!check.prompt.trim()) errors.push(`${where(located)}: no prompt`);
      if (check.options.length < 2 || check.options.length > 4) errors.push(`${where(located)}: ${check.options.length} options`);
      if (check.options.filter((option) => option.correct).length !== 1) errors.push(`${where(located)}: not exactly one correct option`);
      if (new Set(check.options.map((option) => option.label)).size !== check.options.length) errors.push(`${where(located)}: duplicate options`);
      for (const option of check.options) if (!option.correct && !option.misconception?.trim()) errors.push(`${where(located)}: “${option.label}” has no note`);
    }
    expect(errors).toEqual([]);
  });

  it('P3: a Magnify frame names real parts of the face the step shows', () => {
    const errors: string[] = [];
    for (const located of STEPS) {
      for (const ref of located.step.frame ?? []) {
        if (!isValidFrameRef(ref)) { errors.push(`${where(located)}: frame has an invalid part`); continue; }
        const face = partFace(frameBase(ref));
        if (face !== 'both' && face !== located.step.snapshot.face) errors.push(`${where(located)}: frame ${describeFrameRef(ref)} is not on the ${located.step.snapshot.face}`);
      }
    }
    expect(errors).toEqual([]);
  });
});
