# Astrolabe Simulator

An interactive, procedural-SVG planispheric astrolabe drawn as an opaque brass instrument: a mater with a raised limb and recessed well, a throne and ring, an engraved latitude plate, a pierced rete with pointed metal star blades, and a bevelled rule and alidade read along their fiducial edges. Lighting and shadows are baked into static layers so the moving parts stay cheap to drag; the controls and guide around it stay flat. It includes northern latitude plates, a rotating rete and declination rule, a fully engraved back with a movable two-arm alidade and equation-of-time loop, location controls, and plain-language guidance.

## Use

Choose a city or enter a latitude and longitude, then select the nearest plate. The mismatch message explains the expected reading error. Drag the rete and rule on the front or the alidade on the back; arrow keys move a focused part by 1°, Shift+arrow by 10°, and Home returns it to 0°.

The current face, location, plate, rotations, and hidden layers are reflected
in the URL. Refreshing or sharing that URL restores the same configuration.

The stable `window.astrolabe` API exposes the serializable state and actions for tutorials and host pages.

### The Astrolabe Guide course

The Learn tab holds one ordered course of twelve lessons (107 steps), specified in [SYLLABUS.md](SYLLABUS.md) and governed by [LESSON_PLAN.md](LESSON_PLAN.md):

1. Meet the astrolabe: what stays fixed and what turns
2. Set a measured altitude on the alidade
3. Read height and direction on your latitude plate
4. Follow a star from rising to setting
5. Find the Sun’s place for any date
6. Tell the time from the Sun’s height (the keystone)
7. Find sunrise, noon, sunset and the length of the day
8. Tell the time at night from a star
9. Turn astrolabe time into the time on your watch
10. Tell the seasonal (unequal) hour
11. Set the sky for a date and clock time: what is up tonight?
12. Measure a height with the shadow square (available any time after lesson 2)

Every lesson works in London (51.5° N) on two dates, 20 April and 23 October 2026. Each step states its purpose, the action, a visible stop cue and what the result means, and highlights the parts it names. The guide demonstrates a movement first, then asks the learner to repeat it on a second example; reading questions are checked by multiple choice. Measured heights are always supplied, because the simulation cannot sight. Learners reach positions through engraved marks (dates, red altitude numbers, almucantars, the horizon, hour lines, limb hours), never by typing angles. All worked values are computed in `src/tutorial/catalog.ts` from the same functions that draw the instrument.

Lesson links (`?lesson=…&step=…&lv=1`) survive refresh. Links to the retired back-face lesson `back.unequal-hours.v1` open the seasonal-hours lesson.

### Unequal hours on the back

The upper half is a traditional double horary quadrant. Its semicircle is
divided every 15° and its six distinct curves are exact circles through the
pivot and the matching division point; mirrored labels make them readable as
hours I–XII. The method (set the alidade to the noon altitude, note the distance
to curve VI, then carry that distance to the observed altitude) needs a cursor
on the alidade to mark the distance, so the guided lesson for it is deferred
(SYLLABUS.md §3.2). The Reference tab summarises the method.

## Accuracy

The plate geometry is an exact stereographic construction. Star positions are a compact J2000 catalogue without precession, atmospheric refraction is omitted, obliquity is fixed, and solar longitude and equation-of-time values are approximate. The finite plates are northern constructions; southern locations therefore carry an explicit limitation warning. This widget is educational and does not claim observational precision.

The back's unequal-hour circles are an exact rendering of the traditional
construction, but that historical method is an approximation between sunrise,
noon, and sunset. Its result should be treated as an interpolated temporal hour,
not an observationally precise clock time.

## Development

This widget uses Preact, Vite, TypeScript, bundled EB Garamond fonts, and no remote runtime data or assets.

Run `npm test` for the stereographic-projection geometry suite and `npm run build`
for the production bundle. CI runs the geometry suite only when this widget is
included in the changed-widget build matrix.

### Validation tooling

The journey states in `journey.json` (run by CI through `scripts/journey.cjs`) include three
course checks that share the probes in `src/tutorial/inspect.ts`, exposed as `window.astrolabe.inspect`:

- `parts-rendered`: every part in `parts.ts`, with every instance value, is drawn on its face.
- `course-audit`: opens every step of every lesson and checks that each highlighted part (and the parts of the
  concepts the step introduces) exists on the step's face, has a box in the viewport, carries the highlight
  marker, is not hidden by an opaque part drawn over it (a single instance such as one tick needs half of its samples visible, a family a quarter; your-turn steps are audited again with their solution applied), and that no stale highlight or banned term is left.
  Occlusion sampling runs in the mobile-light and desktop-light cells only; the other cells run the cheap checks.
- `interruption-recovery`: interrupting a demonstration, then Restart, Keep and exit, Restore and exit, and a refresh.

The lesson gallery is for qualitative review and is not run in CI. It needs Playwright on `NODE_PATH`
and a built `dist`:

```sh
npm run build
NODE_PATH=$PWD/node_modules:$(npm root -g) node scripts/lesson-gallery.cjs $PWD/dist/index.html /tmp/gallery \
  [--lessons id|n,..] [--steps 1,4,..] [--viewports desktop:1280x800,phone:390x844] [--schemes light,dark] \
  [--scale 1] [--phone-scale 2] [--full-format jpeg|png] [--forced-colors] [--forced-steps 1,first-turn]
```

For every step of every lesson, per viewport and scheme, it writes `<lessonIndex>-<lessonId>__<stepIndex>-<stepId>__<viewport>__<scheme>`
as a full-page `.jpg` (`--full-format png` for lossless), an instrument close-up (`…__instrument.png`) for every viewport and scheme,
and for phone viewports a viewport-only shot (`…__viewport.png`: what is on screen at the top of the page). Phones are captured at
deviceScaleFactor 2. `--forced-colors` adds a desktop forced-colors pass (`…__desktop__forced-colors.jpg` and `…__instrument.png`) for
step 1 and the first your-turn step of each lesson. `--lessons` and `--steps` (1-based) filter the output. `index.json` holds lesson and step
ids, headings, the rendered panel text, highlights, and the in-page audit results (the snapshot, and the solution state of your-turn steps).
Audit failures are recorded, never fatal.
