import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  applyTransaction, getState, setHighlight, subscribeChanges, useStore,
  type AstrolabeState,
} from '../store';
import { runDemonstration } from '../tutorial/animation';
import { LESSONS, WATCH } from '../tutorial/catalog';
import { evaluateCheckpoint } from '../tutorial/checkpoints';
import { useHighlights } from '../tutorial/highlights';
import { NO_FRAME, setLessonUi } from '../lessonUi';
import { partId } from '../tutorial/parts';
import { composeTutorialSearch, parseTutorialSearch } from '../tutorial/url';
import type { Lesson, LessonCheck, Predicate, Snapshot } from '../tutorial/types';
import { ChoiceQuestion, type ChoiceFeedback } from './ChoiceQuestion';
import { PlateSelect } from './PlateSelect';

const PARTS = [
  ['mater', 'Mater', 'The body and graduated limb of the instrument.', 'both'],
  ['plate', 'Latitude plate', 'The fixed horizon, altitude and azimuth grid for one latitude.', 'front'],
  ['rete', 'Rete', 'The rotating star map and ecliptic zodiac ring.', 'front'],
  ['rule', 'Rule', 'A sighting and reading edge on the front.', 'front'],
  ['back', 'Back scales', 'Scales relate dates to the zodiac, correct apparent solar time, measure proportions from shadows, and read unequal hours.', 'back'],
  ['alidade', 'Alidade', 'The rotating sighting rule on the back.', 'back'],
] as const;

function applySnapshot(snapshot: Snapshot, operationId: number, syncUrl = true): void {
  applyTransaction({
    ...snapshot,
    location: { ...snapshot.location },
    visibility: { ...snapshot.visibility },
  }, { source: 'tutorial', operationId, syncUrl });
}
/**
 * Single column: scroll so the step heading sits just below the sticky instrument, leaving the
 * heading, instruction, cue and options on screen together (not the top of the page).
 */
function revealStepHeading(heading: HTMLElement): void {
  if (typeof window.matchMedia !== 'function' || !window.matchMedia('(max-width: 820px)').matches) return;
  const place = () => {
    const stage = document.querySelector('.lesson-active .instrument-stage');
    if (!stage || !heading.isConnected) return;
    const gap = 6;
    window.scrollTo(0, Math.max(0, window.scrollY + heading.getBoundingClientRect().top - stage.getBoundingClientRect().height - gap));
  };
  // The lesson layout (sticky instrument) is applied a frame after the step renders.
  requestAnimationFrame(() => requestAnimationFrame(place));
}
/** Scrolls `el` into view (the panel on a desktop, the page on a phone) so it ends above the pinned action row. */
function revealAbovePinnedRow(el: HTMLElement | null): void {
  const footer = document.querySelector('.lesson-footer');
  if (!el || !footer) return;
  el.style.scrollMarginBottom = `${Math.ceil(footer.getBoundingClientRect().height) + 8}px`;
  el.scrollIntoView({ block: 'nearest' });
}
function writeLessonUrl(lesson: Lesson | null, stepIndex: number, push: boolean): void {
  if (typeof window === 'undefined') return;
  const search = composeTutorialSearch(window.location.search, lesson?.id ?? null, lesson?.steps[stepIndex]?.id);
  const url = `${window.location.pathname}${search}${window.location.hash}`;
  window.history[push ? 'pushState' : 'replaceState'](window.history.state, '', url);
}

export function AstrolabeGuide(): JSX.Element {
  const simulator = useStore();
  const [tab, setTab] = useState<'learn' | 'reference'>('learn');
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [status, setStatusText] = useState('');
  /** Check feedback the learner has to see (not only hear); every other announcement stays visually hidden. */
  const [statusVisible, setStatusVisible] = useState(false);
  const setStatus = (text: string, visible = false) => { setStatusText(text); setStatusVisible(visible); };
  const [interrupted, setInterrupted] = useState(false);
  const [complete, setComplete] = useState(false);
  const [checkpointPassed, setCheckpointPassed] = useState(false);
  const [demonstrating, setDemonstrating] = useState(false);
  const [choiceIndex, setChoiceIndex] = useState<number | null>(null);
  const [choiceFeedback, setChoiceFeedback] = useState<ChoiceFeedback | null>(null);
  const restore = useRef<AstrolabeState | null>(null);
  const operationId = useRef(0);
  const animation = useRef<AbortController | null>(null);
  const launchButton = useRef<HTMLElement | null>(null);
  const nextButton = useRef<HTMLButtonElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const alertRef = useRef<HTMLDivElement | null>(null);
  const catalogHeadingRef = useRef<HTMLHeadingElement | null>(null);
  /** Where keyboard focus goes after the next render, so it never falls to the page body. */
  const pendingFocus = useRef<'heading' | 'reveal' | 'catalog' | null>(null);
  const exitedFrom = useRef<string | null>(null);
  const step = lesson?.steps[stepIndex];
  useHighlights(lesson && !complete && step ? step.highlights : []);

  const wantsPlate = Boolean(lesson && !complete && step?.highlights.some((ref) => ['plate-selector', 'plate-mismatch'].includes(partId(ref))));
  const wantsMismatch = Boolean(lesson && !complete && step?.highlights.some((ref) => partId(ref) === 'plate-mismatch'));
  const mismatch = useMemo(() => {
    const difference = Math.abs(Math.abs(simulator.location.lat) - simulator.plateLatitude);
    const message = difference < 0.5
      ? `This ${simulator.plateLatitude.toFixed(2)}° plate matches your latitude closely.`
      : `Your latitude and this plate differ by ${difference.toFixed(2)}°. Horizon and altitude readings can be wrong by about ${difference.toFixed(1)}°; near the horizon, timing may shift by a few minutes per degree. The star map and Sun position remain correct.`;
    const text = message + (simulator.location.lat < 0 ? ' This simulator uses northern plates and does not reverse the construction for the southern hemisphere.' : '');
    return { text, matches: difference < 0.5 };
  }, [simulator.location.lat, simulator.plateLatitude]);

  const runStep = (nextLesson: Lesson, index: number, push: boolean) => {
    animation.current?.abort();
    operationId.current += 1;
    const id = operationId.current;
    const nextStep = nextLesson.steps[index];
    setLesson(nextLesson); setStepIndex(index); setInterrupted(false); setComplete(false); setCheckpointPassed(false);
    setChoiceIndex(null); setChoiceFeedback(null); setDemonstrating(false);
    setStatus(nextStep.check ? `Step ${index + 1}: ${nextStep.title}.` : `Step ${index + 1}: ${nextStep.title}. ${nextStep.result}`);
    const previousPlate = getState().plateLatitude;
    applySnapshot(nextStep.snapshot, id);
    writeLessonUrl(nextLesson, index, push);
    if (nextStep.demonstration) {
      const controller = new AbortController();
      animation.current = controller;
      setDemonstrating(true);
      void runDemonstration(nextStep.demonstration, {
        reducedMotion: getState().reducedMotion, signal: controller.signal, previousPlate,
        apply: (patch, final) => applyTransaction(patch, { source: 'tutorial', operationId: id, syncUrl: final }),
      }).then((outcome) => {
        if (id !== operationId.current || outcome === 'aborted') return;
        animation.current = null;
        setDemonstrating(false);
        // A demonstration passes its own check when it ends (SYLLABUS §0.3): nothing for the learner to press.
        const passed = Boolean(nextStep.check) && nextStep.check?.kind !== 'choice' && evaluateCheckpoint(nextStep.check as Predicate, getState());
        setCheckpointPassed(passed);
        const stopped = nextStep.stopCue ? `Stopped: ${nextStep.stopCue}` : nextStep.title;
        setStatus(passed ? `${stopped} ${nextStep.result}` : stopped);
      });
    }
  };
  const checkStep = (check: LessonCheck, result: string) => {
    if (check.kind === 'choice') {
      const option = choiceIndex === null ? undefined : check.options[choiceIndex];
      if (!option) { setStatus('Choose an answer first.', true); return; }
      const note = option.correct ? result : option.misconception ?? '';
      setCheckpointPassed(Boolean(option.correct));
      setChoiceFeedback({ correct: Boolean(option.correct), note });
      setStatus(`${option.correct ? 'Correct.' : 'Not quite.'} ${note}`);
      return;
    }
    const passed = evaluateCheckpoint(check, getState());
    setCheckpointPassed(passed);
    setStatus(passed ? `That is in place. ${result}` : 'Not yet. Make the alignment described under “Stop when” and check again.', !passed);
  };
  const start = (nextLesson: Lesson, button?: HTMLElement) => {
    if (!restore.current) restore.current = getState();
    if (button) launchButton.current = button;
    runStep(nextLesson, 0, true);
  };
  const exit = (restoreState: boolean) => {
    animation.current?.abort(); operationId.current += 1;
    if (restoreState && restore.current) applyTransaction(restore.current, { source: 'tutorial', operationId: operationId.current });
    setLesson(null); setStepIndex(0); setInterrupted(false); setComplete(false); setDemonstrating(false); setStatus('Returned to the lesson catalog.');
    restore.current = null; writeLessonUrl(null, 0, true);
    exitedFrom.current = lesson?.id ?? null;
    pendingFocus.current = 'catalog';
  };
  const closeFromHistory = () => {
    animation.current?.abort(); animation.current = null; operationId.current += 1;
    setLesson(null); setStepIndex(0); setInterrupted(false); setComplete(false); setDemonstrating(false);
    setCheckpointPassed(false); restore.current = null;
  };

  useEffect(() => {
    if (checkpointPassed && step?.check?.kind === 'choice') nextButton.current?.focus({ preventScroll: true });
  }, [checkpointPassed]);

  // Focus follows the learner's action: the new step heading, or the lesson they left; never the page body.
  useEffect(() => {
    if (pendingFocus.current === 'heading' && headingRef.current) {
      pendingFocus.current = null;
      headingRef.current.focus({ preventScroll: true });
      revealStepHeading(headingRef.current);
    } else if (pendingFocus.current === 'reveal' && headingRef.current) {
      // A step opened from a link or refresh: show it as Next and Back do, without moving focus.
      pendingFocus.current = null;
      revealStepHeading(headingRef.current);
    } else if (pendingFocus.current === 'catalog' && !lesson) {
      pendingFocus.current = null;
      const card = exitedFrom.current ? document.querySelector<HTMLElement>(`[data-testid="start-${CSS.escape(exitedFrom.current)}"]`) : null;
      (card ?? catalogHeadingRef.current)?.focus();
    }
  });
  useEffect(() => { if (interrupted) alertRef.current?.focus(); }, [interrupted]);
  // The result of Check is shown under the options, above the pinned actions: bring it into view clear of them.
  useEffect(() => { if (choiceFeedback) revealAbovePinnedRow(document.getElementById('choice-feedback')); }, [choiceFeedback]);

  useEffect(() => {
    setLessonUi({
      active: Boolean(lesson),
      stepKey: lesson && step ? `${lesson.id}/${step.id}/${complete}` : '',
      frame: (!complete && step?.frame) || NO_FRAME,
      hasHighlights: Boolean(step && !complete && step.highlights.length),
      settled: !demonstrating,
      solution: (!complete && step?.mode === 'your-turn' && step.solution) || null,
    });
  }, [lesson, stepIndex, complete, demonstrating]);
  useEffect(() => () => setLessonUi({ active: false, stepKey: '', frame: NO_FRAME, hasHighlights: false, settled: true, solution: null }), []);

  useEffect(() => subscribeChanges((change) => {
    if (!lesson || !animation.current || animation.current.signal.aborted) return;
    if (change.meta.source === 'tutorial' && change.meta.operationId === operationId.current) return;
    animation.current.abort(); operationId.current += 1; setInterrupted(true); setDemonstrating(false);
    setStatus('The instrument moved while this step was playing. Restart the step, continue from your position, or leave the lesson.');
  }), [lesson]);

  useEffect(() => {
    const openFromUrl = () => {
      const parsed = parseTutorialSearch(window.location.search);
      setStatus(parsed.unavailable);
      if (!parsed.lessonId) {
        closeFromHistory();
        if (parsed.needsRepair) writeLessonUrl(null, 0, false);
        return;
      }
      const linkedLesson = LESSONS.find((item) => item.id === parsed.lessonId);
      if (!linkedLesson) return;
      if (!restore.current) restore.current = getState();
      runStep(linkedLesson, parsed.stepIndex, false);
      pendingFocus.current = 'reveal';
      if (parsed.unavailable) setStatus(parsed.unavailable);
      if (parsed.needsRepair) writeLessonUrl(linkedLesson, parsed.stepIndex, false);
    };
    openFromUrl();
    window.addEventListener('popstate', openFromUrl);
    return () => window.removeEventListener('popstate', openFromUrl);
  }, []);

  const phase = !lesson ? undefined : complete ? 'complete' : interrupted ? 'interrupted'
    : demonstrating ? 'demonstrating' : checkpointPassed ? 'passed' : 'ready';

  return <aside className="info-panel astrolabe-guide" aria-label="Astrolabe Guide"
    data-lesson={lesson?.id} data-step={step?.id} data-step-phase={phase}>
    {(!lesson || !mismatch.matches || wantsMismatch) &&
      <p className="mismatch" data-testid="mismatch" data-part="plate-mismatch" role="status" aria-live="polite">{mismatch.text}</p>}
    {!lesson ? <>
      <div className="guide-tabs" role="tablist" aria-label="Astrolabe Guide views">
        <button role="tab" id="learn-tab" aria-selected={tab === 'learn'} aria-controls="learn-panel" onClick={() => setTab('learn')}>Learn</button>
        <button role="tab" id="reference-tab" aria-selected={tab === 'reference'} aria-controls="reference-panel" onClick={() => setTab('reference')}>Reference</button>
      </div>
      {tab === 'learn' ? <section id="learn-panel" role="tabpanel" aria-labelledby="learn-tab">
        <h2 tabIndex={-1} ref={catalogHeadingRef}>Astrolabe Guide</h2>
        <p className="guide-intro">Choose a guided lesson to learn the instrument step by step.</p>
        <div className="lesson-list" aria-label="Lessons in course order">
          {LESSONS.map((item, index) => <article className="lesson-card" key={item.id}>
            <h3>{index + 1}. {item.title}</h3><p>{item.summary}</p>
            <p className="lesson-meta">{item.steps.length} steps</p>
            <button data-testid={`start-${item.id}`} onClick={(event) => { pendingFocus.current = 'heading'; start(item, event.currentTarget); }}>Start lesson</button>
          </article>)}
        </div>
      </section> : <Reference simulator={simulator} />}
    </> : <section className="lesson-player" aria-labelledby="lesson-step-heading">
      <button className="text-button" onClick={() => exit(false)}>All lessons</button>
      <p className="lesson-breadcrumb">{lesson.title}</p>
      {!complete && step && <>
        <p className="lesson-progress">Step {stepIndex + 1} of {lesson.steps.length}</p>
        <h2 id="lesson-step-heading" tabIndex={-1} ref={headingRef}>{step.title}</h2>
        {wantsPlate && <div className="lesson-plate"><PlateSelect testId="lesson-plate-select" part /></div>}
        <p className="lesson-purpose">{step.purpose}</p>
        <p className="lesson-instruction">{step.body}</p>
        {step.stopCue && <p className="lesson-stop"><strong>{step.mode === 'read' ? 'Look for:' : 'Stop when:'}</strong> {step.stopCue}</p>}
        {(!step.check || (checkpointPassed && step.check.kind !== 'choice')) && <p className="lesson-result"><strong>Result:</strong> {step.result}</p>}
        {step.check?.kind === 'choice' && <ChoiceQuestion check={step.check} selected={choiceIndex} feedback={choiceFeedback}
          onSelect={(index) => { setChoiceIndex(index); setChoiceFeedback(null); setCheckpointPassed(false); }} />}
        {interrupted && <div className="interruption" role="alert" tabIndex={-1} ref={alertRef}>
          <p>The instrument was moved while this step was playing. Restart the step to see it again, continue from the position you chose, or leave the lesson, either keeping this setup or restoring the setup you had before the lesson.</p>
          <button onClick={() => { pendingFocus.current = 'heading'; runStep(lesson, stepIndex, false); }}>Restart this step</button>
          <button onClick={() => { pendingFocus.current = 'heading'; setInterrupted(false); setStatus('Continuing from your position. Make the alignment described under “Stop when”, then check.'); }}>Continue with my position</button>
          <button onClick={() => exit(false)}>Keep this setup and exit</button>
          <button onClick={() => exit(true)}>Restore pre-lesson setup and exit</button>
        </div>}
        <div className="lesson-footer">
          <p className={`sr-status${statusVisible ? '' : ' sr-only'}`} role="status" aria-live="polite">{status}</p>
          {!interrupted && <div className="lesson-actions">
            <button disabled={stepIndex === 0} onClick={() => { pendingFocus.current = 'heading'; runStep(lesson, stepIndex - 1, true); }}>Back</button>
            <button onClick={() => runStep(lesson, stepIndex, false)}>Replay</button>
            {step.check && (step.mode !== 'demonstrate' || (!demonstrating && !checkpointPassed)) && <button onClick={() => checkStep(step.check!, step.result)}>{step.check.kind === 'choice' ? 'Check answer' : 'Check'}</button>}
            {stepIndex < lesson.steps.length - 1
              ? <button ref={nextButton} disabled={Boolean(step.check) && !checkpointPassed}
                  aria-disabled={Boolean(step.check) && !checkpointPassed}
                  onClick={() => { pendingFocus.current = 'heading'; runStep(lesson, stepIndex + 1, true); }}>Next</button>
              : <button onClick={() => { pendingFocus.current = 'heading'; setComplete(true); setStatus(`Lesson complete. ${step.result}`); }}>Finish</button>}
          </div>}
        </div>
      </>}
      {complete && step && <div className="completion">
        <h2 id="lesson-step-heading" tabIndex={-1} ref={headingRef}>Lesson complete</h2>
        <p>{step.result}</p>
        <button onClick={() => exit(true)}>Return and restore</button>
        <button onClick={() => exit(false)}>Practice with this setup</button>
        <p className="sr-status sr-only" role="status" aria-live="polite">{status}</p>
      </div>}
    </section>}
    {!lesson && <p className="sr-status" role="status" aria-live="polite">{status}</p>}
  </aside>;
}

/** Whole minutes with a true minus sign, as the lesson prints them. */
function formatEquation(minutes: number): string {
  const whole = Math.round(minutes);
  return whole === 0 ? '0' : `${whole < 0 ? '−' : '+'}${Math.abs(whole)}`;
}

function Reference({ simulator }: { simulator: AstrolabeState }): JSX.Element {
  const visibleParts = PARTS.filter(([, , , face]) => face === 'both' || face === simulator.face);
  return <section id="reference-panel" role="tabpanel" aria-labelledby="reference-tab">
    <h2>Reference</h2>
    <details open><summary>Parts of the {simulator.face}</summary><ul className="parts-list">{visibleParts.map(([key, name, description]) =>
      <li key={key}><button className={`part-button${simulator.highlight === key ? ' selected' : ''}`}
        onFocus={() => setHighlight(key)} onBlur={() => setHighlight(null)}
        onMouseEnter={() => setHighlight(key)} onMouseLeave={() => setHighlight(null)}
        onClick={() => setHighlight(simulator.highlight === key ? null : key)}>
        <strong>{name}</strong><span>{description}</span></button></li>)}</ul></details>
    <details><summary>Unequal-hour scale</summary>{simulator.face === 'front'
      ? <p>The curves below the horizon divide a path across the sky into twelve unequal hours. To use them for solar time, treat the Sun’s position on the ecliptic as the marker for night; during daylight, use the point directly opposite the Sun. The horizon marks sunset and sunrise, and the middle curve marks the sixth hour. Interpolate between curves.</p>
      : <p>The upper semicircle is the double horary quadrant used to read unequal, or temporal, hours. First set the alidade to the Sun’s noon altitude and note where its reading edge crosses curve VI. Remember that crossing’s distance from the center. Set the alidade to the Sun’s current altitude, find the same distance along its reading edge, and read the hour curve at that point: I–VI before noon or the mirrored VI–XII afterward.</p>}</details>
    <details><summary>Equation of time by month</summary>
      <p>For an instrument without an equation-of-time loop (Lesson 9). Approximate mid-month values, sundial minus mean time: subtract from sundial time to get local mean time.</p>
      <table className="eot-table" data-testid="reference-eot-table">
        <thead><tr><th scope="col">Month</th><th scope="col">Minutes</th></tr></thead>
        <tbody>{WATCH.table.map((row) => <tr key={row.month}><th scope="row">{row.month}</th><td>{formatEquation(row.minutes)}</td></tr>)}</tbody>
      </table></details>
    <details><summary>Accuracy and simplifications</summary><ul>
      <li>This is an educational geometric model, not an observational-precision instrument.</li>
      <li>Star positions use the standard J2000 catalogue coordinates and do not include their slow shift over centuries.</li>
      <li>Atmospheric refraction—the apparent lifting of objects near the horizon—is omitted.</li>
      <li>Earth’s axial tilt is held fixed, and the Sun and equation-of-time calculations use compact approximations.</li>
      <li>The available plates cover a finite set of northern latitudes.</li>
      <li>The front unequal-hour curves exactly divide the modelled paths. Readings from the historical back construction are approximate between sunrise, noon, and sunset.</li>
    </ul></details>
  </section>;
}
