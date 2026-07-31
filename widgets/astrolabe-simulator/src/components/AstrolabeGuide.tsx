import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  applyTransaction, getState, setHighlight, subscribeChanges, useStore,
  type AstrolabeState,
} from '../store';
import { animateAngle } from '../tutorial/animation';
import { LESSONS, FUTURE_TOPICS } from '../tutorial/catalog';
import { evaluateCheckpoint } from '../tutorial/checkpoints';
import { composeTutorialSearch, parseTutorialSearch } from '../tutorial/url';
import type { Lesson, Snapshot } from '../tutorial/types';

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
  const [status, setStatus] = useState('');
  const [interrupted, setInterrupted] = useState(false);
  const [complete, setComplete] = useState(false);
  const [checkpointPassed, setCheckpointPassed] = useState(false);
  const restore = useRef<AstrolabeState | null>(null);
  const operationId = useRef(0);
  const animation = useRef<AbortController | null>(null);
  const launchButton = useRef<HTMLElement | null>(null);
  const step = lesson?.steps[stepIndex];

  const mismatch = useMemo(() => {
    const difference = Math.abs(Math.abs(simulator.location.lat) - simulator.plateLatitude);
    const message = difference < 0.5
      ? `This ${simulator.plateLatitude.toFixed(2)}° plate matches your latitude closely.`
      : `Your latitude and this plate differ by ${difference.toFixed(2)}°. Horizon and altitude readings can be wrong by about ${difference.toFixed(1)}°; near the horizon, timing may shift by a few minutes per degree. The star map and Sun position remain correct.`;
    return message + (simulator.location.lat < 0 ? ' This simulator uses northern plates and does not reverse the construction for the southern hemisphere.' : '');
  }, [simulator.location.lat, simulator.plateLatitude]);

  const runStep = (nextLesson: Lesson, index: number, push: boolean) => {
    animation.current?.abort();
    operationId.current += 1;
    const id = operationId.current;
    const nextStep = nextLesson.steps[index];
    setLesson(nextLesson); setStepIndex(index); setInterrupted(false); setComplete(false); setCheckpointPassed(false);
    setStatus(`Step ${index + 1}: ${nextStep.title}. ${nextStep.result}`);
    applySnapshot(nextStep.snapshot, id);
    writeLessonUrl(nextLesson, index, push);
    if (nextStep.demonstration) {
      const controller = new AbortController();
      animation.current = controller;
      const demo = nextStep.demonstration;
      applyTransaction({ [demo.field]: demo.from }, { source: 'tutorial', operationId: id, syncUrl: false });
      void animateAngle({
        ...demo, reducedMotion: simulator.reducedMotion, signal: controller.signal,
        update: (value) => applyTransaction({ [demo.field]: value }, { source: 'tutorial', operationId: id, syncUrl: false }),
      }).then((outcome) => {
        if (id !== operationId.current || outcome === 'aborted') return;
        animation.current = null;
        applyTransaction({ [demo.field]: demo.to }, { source: 'tutorial', operationId: id, syncUrl: true });
        setStatus(nextStep.result);
      });
    }
  };
  const start = (nextLesson: Lesson, button?: HTMLElement) => {
    if (!restore.current) restore.current = getState();
    if (button) launchButton.current = button;
    runStep(nextLesson, 0, true);
  };
  const exit = (restoreState: boolean) => {
    animation.current?.abort(); operationId.current += 1;
    if (restoreState && restore.current) applyTransaction(restore.current, { source: 'tutorial', operationId: operationId.current });
    setLesson(null); setStepIndex(0); setInterrupted(false); setComplete(false); setStatus('Returned to the lesson catalog.');
    restore.current = null; writeLessonUrl(null, 0, true);
    queueMicrotask(() => launchButton.current?.focus());
  };
  const closeFromHistory = () => {
    animation.current?.abort(); animation.current = null; operationId.current += 1;
    setLesson(null); setStepIndex(0); setInterrupted(false); setComplete(false);
    setCheckpointPassed(false); restore.current = null;
  };

  useEffect(() => subscribeChanges((change) => {
    if (!lesson || !animation.current || animation.current.signal.aborted) return;
    if (change.meta.source === 'tutorial' && change.meta.operationId === operationId.current) return;
    animation.current.abort(); operationId.current += 1; setInterrupted(true);
    setStatus('The instrument moved away from this step. Restart the step or keep the position you chose.');
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
      if (parsed.needsRepair) writeLessonUrl(linkedLesson, parsed.stepIndex, false);
    };
    openFromUrl();
    window.addEventListener('popstate', openFromUrl);
    return () => window.removeEventListener('popstate', openFromUrl);
  }, []);

  return <aside className="info-panel astrolabe-guide" aria-label="Astrolabe Guide">
    <p className="mismatch" data-testid="mismatch" data-tutorial-target="setup.plate-mismatch" role="status" aria-live="polite">{mismatch}</p>
    {!lesson ? <>
      <div className="guide-tabs" role="tablist" aria-label="Astrolabe Guide views">
        <button role="tab" id="learn-tab" aria-selected={tab === 'learn'} aria-controls="learn-panel" onClick={() => setTab('learn')}>Learn</button>
        <button role="tab" id="reference-tab" aria-selected={tab === 'reference'} aria-controls="reference-panel" onClick={() => setTab('reference')}>Reference</button>
      </div>
      {tab === 'learn' ? <section id="learn-panel" role="tabpanel" aria-labelledby="learn-tab">
        <h2>Astrolabe Guide</h2>
        <p className="guide-intro">Choose a guided lesson to learn the instrument step by step.</p>
        {[...new Set(LESSONS.map((item) => item.category))].map((category) => <section className="lesson-category" key={category}>
          <h3>{category}</h3>
          {LESSONS.filter((item) => item.category === category).map((item) => <article className="lesson-card" key={item.id}>
            <h4>{item.title}</h4><p>{item.summary}</p>
            <p className="lesson-meta">{item.steps.length} steps · {item.id.startsWith('back') ? 'Back' : 'Front'}</p>
            <button data-testid={`start-${item.id}`} onClick={(event) => start(item, event.currentTarget)}>Start lesson</button>
          </article>)}
        </section>)}
        <h2>Future operations</h2>
        {[...new Set(FUTURE_TOPICS.map((item) => item.category))].map((category) => <section className="lesson-category future-category" key={category}>
          <h3>{category}</h3>
          {FUTURE_TOPICS.filter((item) => item.category === category).map((item) => <article className="lesson-card future-card" key={item.title}>
            <h4>{item.title}</h4><p>{item.prerequisite}</p>
            <button disabled aria-disabled="true" title={item.prerequisite}>Planned lesson</button>
          </article>)}
        </section>)}
      </section> : <Reference simulator={simulator} />}
    </> : <section className="lesson-player" aria-labelledby="lesson-step-heading">
      <button className="text-button" onClick={() => exit(false)}>All lessons</button>
      <p className="lesson-breadcrumb">{lesson.category} · {lesson.title}</p>
      {!complete && step && <>
        <p className="lesson-progress">Step {stepIndex + 1} of {lesson.steps.length}</p>
        <h2 id="lesson-step-heading">{step.title}</h2>
        <p>{step.body}</p>
        <p className="lesson-result"><strong>Result:</strong> {step.result}</p>
        {interrupted && <div className="interruption" role="alert">
          <p>The instrument moved away from the position shown in this step. You can restart the step or continue with your own position.</p>
          <button onClick={() => runStep(lesson, stepIndex, false)}>Restart this step</button>
          <button onClick={() => exit(false)}>Keep this setup and exit</button>
          <button onClick={() => exit(true)}>Restore and exit</button>
        </div>}
        {!interrupted && <div className="lesson-actions">
          <button disabled={stepIndex === 0} onClick={() => runStep(lesson, stepIndex - 1, true)}>Back</button>
          <button onClick={() => runStep(lesson, stepIndex, false)}>Replay</button>
          {step.check && <button onClick={() => {
            const passed = evaluateCheckpoint(step.check!, getState()); setCheckpointPassed(passed);
            setStatus(passed ? `Checkpoint passed. ${step.result}` : 'Not yet. Adjust the named control to the requested value and check again.');
          }}>Check</button>}
          {stepIndex < lesson.steps.length - 1
            ? <button disabled={Boolean(step.check) && !checkpointPassed} onClick={() => runStep(lesson, stepIndex + 1, true)}>Next</button>
            : <button onClick={() => { setComplete(true); setStatus(`Lesson complete. ${step.result}`); }}>Finish</button>}
          <button onClick={() => exit(false)}>Exit</button>
        </div>}
      </>}
      {complete && step && <div className="completion">
        <h2 id="lesson-step-heading">Lesson complete</h2>
        <p>{step.result}</p>
        <button onClick={() => exit(true)}>Return and restore</button>
        <button onClick={() => exit(false)}>Practice with this setup</button>
      </div>}
    </section>}
    <p className="sr-status" role="status" aria-live="polite">{status}</p>
  </aside>;
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
