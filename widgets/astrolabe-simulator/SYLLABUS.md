# Astrolabe Guide: course syllabus

*Companion to `widgets/astrolabe-simulator/LESSON_PLAN.md`, which holds the teaching contract. This file holds the detail: the concept ledger, the lesson-by-lesson specification, the feature gaps and the reasons for the order.*
*Audience: curious adults who want to pick up a physical planispheric astrolabe and use it.*
*Course state: 12 lessons, 107 steps (19 demonstrate, 23 your turn, 28 read, 37 explain). The concept ledger has 90 concepts and the `data-part` vocabulary has 39 parts.*

## 0. How to read this document

### 0.1 Fixed lesson setting

Unless a step says otherwise, every snapshot uses the following setting.

- Location `London`: `lat 51.5`, `lng −0.12`, `plateSelection: 'pinned'`, `plateLatitude: 51.5` (the "Exact 51.5°" plate).
- Visibility as in today's catalog, with `artificialAssists: false`. No calculated Sun marker is ever shown.
- `epochIso` is set to the example's date at `12:00:00Z`. The calendar ring is a fixed engraving and does not depend on the epoch. The equation-of-time loop is drawn for the epoch's year, and every date here is in 2026.

The course uses two dates throughout, plus one reference date:

| Date | Sun's ecliptic longitude λ | Sign | Sun RA / Dec | Equation of time (apparent − mean) |
|---|---|---|---|---|
| 20 April 2026 | **30.4°** (30.425) | 0° Taurus | 28.317° / +11.622° | **+1.0 min** (0.99) |
| 23 October 2026 | **210.1°** (210.090) | 0° Scorpio | 207.997° / −11.504° | **+15.8 min** (15.78) |
| 14 July 2026 | 112.1° (112.075) | 22° Cancer | 113.846° / +21.631° | −5.7 min (reference only) |

All numbers come from the simulator's own model (`solarLongitude`, `equationOfTime`, ε = 23.44°, `equatorialToHorizontal`, the J2000 star catalogue, φ = 51.5°). They were computed with node against `src/` (scripts in `/workspace/calc/`). The astrolabe horizon is geometric: it has no refraction and no solar semidiameter.

### 0.2 Simulator conventions the lessons rely on

- **Rete angle** = local sidereal angle θ. Turning the rete **clockwise** (drag clockwise, or press → / ↑) increases θ and moves the sky forward in time. A body's hour angle is H = θ − α.
- **Rule angle** ρ. When the rule's edge lies over a body, ρ = α − θ (mod 360). After FG-2, the hour read at the **Sun's end** of the rule is `12 − ρ/15` (mod 24).
- **Alidade angle** a. An edge crossing altitude *h* on a red altitude scale means a ≡ *h* or a ≡ 180 − *h* (mod 180); either end of the alidade may be used. An edge through the date tick at longitude λ means a ≡ 180 − λ (mod 180). The arm that carries the minute scale lies over the date when a = 180 − λ (mod 360).
- **Front geometry checks** use `frontGeometry`. `position` compares the altitude and azimuth of the body with `equatorialToHorizontal(ra, dec, 51.5, reteRotation)`. `rulePoint` compares the body with the rule line.

### 0.3 Step format

Every step lists the following fields:

- **Mode**:
  - `D` demonstrate: the guide animates the action, the snapshot is the end state, and the check passes when the demonstration finishes.
  - `T` your turn: no animation; the snapshot leaves the part away from the target and the learner must move it.
  - `R` read: a reading or prediction question (FG-3).
  - `E` explain: no check.
- **Purpose**, **Instruction**, **Demonstration**, **Stop cue** and **Meaning**, as required by the teaching contract.
- **Introduces** / **Uses**: concept ids from the ledger (§1). A concept is introduced at exactly one step. It may be used only at or after that step.
- **Face** and **Highlights**: `data-part` references (§1.2), written `part` or `part[key=value]`. For example, `almucantar[altitude=30]` resolves to `[data-part="almucantar"][data-altitude="30"]`.
- **Check**: the predicate and its tolerance, plus the engraved scale it is derived from. Predicates marked FG-3 or FG-4 do not exist yet (§3).

Checkpoint notation:

| Notation | Meaning | Status |
|---|---|---|
| `angleNear(field, v ±t)` | The circular distance of the rotation from v is at most t. | exists |
| `faceIs(back)` | The given face is showing. | exists, unused today |
| `frontGeometry(body; pos alt/az ±t; rule over body ±t)` | The existing predicate. | exists |
| `alidadeAltitude(h ±t)` | Either end of the alidade crosses *h* on a red altitude scale. | FG-4 |
| `alidadeLongitude(λ ±t)` | Either end of the alidade lies on the λ radial (the date line). | FG-4 |
| `plateIs(51.5)` | The plate latitude is within 0.01. | FG-4 |
| `allOf(p, q)` | Both predicates hold. | FG-4 |
| `choice(options; correct)` | Pick one of 2–4 options; each distractor is a named misconception. | FG-3 |

Bodies used in checks:

| Body | RA | Dec |
|---|---|---|
| `Sun@04-20` | 28.317° | +11.622° |
| `Sun@10-23` | 207.997° | −11.504° |
| `Nadir@04-20` | 208.317° | −11.622° |
| `Nadir@10-23` | 27.997° | +11.504° |

Stars use the catalogue values: Sirius 101.287 / −16.716, Arcturus 213.915 / +19.182, Capella 79.172 / +45.998, Vega 279.234 / +38.784, Regulus 152.093 / +11.967.

Fixture values must be recomputed in code from the same pure functions. The figures here are the expected results to three significant decimals, and tests should compare against them only loosely.

## 1. Concept ledger

### 1.1 Concepts

This table is the source for `src/tutorial/concepts.ts`. Each concept is introduced at exactly one step, written `lessonId#stepNumber` (1-based; the step id is in §2). "Made visible" says how the introducing step shows the element:

- **shown**: it is on screen and named in the copy;
- **highlighted**: the step lists it in `highlights` (FG-1);
- **animated**: a demonstration moves it.

Concept kinds are part / scale / idea / manipulation / reading. Element references use the `data-part` vocabulary in §1.2. 90 concepts.

| id | kind | learner-facing definition | introduced at | simulator element(s) | face | made visible |
|---|---|---|---|---|---|---|
| `mater` | part | The main body of the astrolabe: a thick disc whose hollow holds the plate and whose pin carries the moving parts. | `front.foundations.v1#1` | `mater` | both | highlighted |
| `limb` | part | The raised outer rim of the front, engraved with the degree and hour scales. | `front.foundations.v1#1` | `limb` | front | highlighted |
| `throne` | part | The bracket at the top that carries the ring, so the instrument can hang straight down. | `front.foundations.v1#1` | `throne` | both | highlighted |
| `plate` | part | The fixed engraved disc in the hollow, drawn for one latitude: it is you and your horizon. | `front.foundations.v1#2` | `plate` | front | highlighted |
| `rete` | part | The pierced star map that turns over the plate. | `front.foundations.v1#3` | `rete` | front | animated |
| `star-pointer` | part | A pointed tongue on the rete whose tip marks one named star. | `front.foundations.v1#3` | `star-pointer` | front | highlighted |
| `horizon` | part | The large off-centre circle on the plate where sky meets ground; points inside it are above the ground. | `front.foundations.v1#3` | `horizon` | front | highlighted |
| `rotate-rete` | manipulation | Turn the rete about the pin; clockwise moves the sky forward in time. | `front.foundations.v1#3` | `rete` | front | animated |
| `rule` | part | The straight pointer on top of the rete that carries a point out to the limb. | `front.foundations.v1#4` | `rule` | front | animated |
| `fiducial-edge` | part | The straight edge of the rule or alidade that passes exactly through the centre, along which every reading is taken. | `front.foundations.v1#4` | `rule-edge`, `alidade-edge` | both | highlighted |
| `lay-rule` | manipulation | Turn the rule until the edge of its numbered half, the Sun end, passes through a chosen point. | `front.foundations.v1#4` | `rule` | front | animated |
| `limb-degree-scale` | scale | The 360 one-degree ticks round the limb. | `front.foundations.v1#6` | `limb-degree-scale` | front | highlighted |
| `limb-hour-scale` | scale | The 24 hour numbers round the limb, one every 15°, with noon at the top. | `front.foundations.v1#6` | `limb-hour-scale` | front | highlighted |
| `turn-over` | manipulation | Turn the instrument over to use the other face. | `front.foundations.v1#7` | `face-toggle` | controls | animated |
| `back-degree-scale` | scale | The outer 0–360° ring on the back, read against the alidade. | `front.foundations.v1#8` | `back-degree-scale` | back | highlighted |
| `altitude-scale` | scale | The red 0–90° numbers on the back for heights above the horizon. | `front.foundations.v1#8` | `altitude-scale` | back | highlighted |
| `zodiac-scale` | scale | The ring of twelve 30° signs on the back, Aries to Pisces. | `front.foundations.v1#9` | `zodiac-scale` | back | highlighted |
| `calendar-scale` | scale | The ring of months and days on the back, lined up with the Sun's place. | `front.foundations.v1#9` | `calendar-scale` | back | highlighted |
| `shadow-square` | scale | The square on the back divided into twelve parts a side, for heights and distances. | `front.foundations.v1#10` | `shadow-square` | back | highlighted |
| `eot-curve` | scale | The loop on the back giving each day's difference between sundial time and even time. | `front.foundations.v1#10` | `eot-curve` | back | highlighted |
| `horary-quadrant` | scale | The arcs in the back's upper half for seasonal hours from a height measurement (named only). | `front.foundations.v1#10` | `horary-quadrant` | back | highlighted |
| `alidade` | part | The sighting bar on the back, pivoted at the centre. | `front.foundations.v1#11` | `alidade` | back | animated |
| `rotate-alidade` | manipulation | Turn the alidade about the pin until its edge meets a mark. | `front.foundations.v1#11` | `alidade` | back | animated |
| `back-axes` | part | The horizontal and vertical lines through the back's centre; the horizontal one is level when the instrument hangs freely. | `front.foundations.v1#11` | `back-axes` | back | highlighted |
| `old-part-names` | idea | In Chaucer the back bar is the "rule" and the front pointer the "label"; this course says alidade and rule. | `front.foundations.v1#12` | `alidade` | back | highlighted |
| `sighting` | idea | Measuring a height on a real astrolabe by hanging it and aligning the alidade's sights (never looking at the Sun); here the result is given. | `back.measure-altitude.v1#1` | `alidade` | back | highlighted |
| `altitude` | idea | How high something is above the horizon: 0° on the horizon, 90° overhead. | `back.measure-altitude.v1#2` | `altitude-scale` | back | highlighted |
| `set-altitude` | manipulation | Turn the alidade until its edge points at a given height on the red scale. | `back.measure-altitude.v1#3` | `alidade`, `altitude-scale` | back | animated |
| `read-altitude-scale` | reading | Read a height on the red scale, counting the 1° ticks past the nearest red number. | `back.measure-altitude.v1#4` | `altitude-scale` | back | highlighted |
| `zenith` | part | The point straight overhead, where the height circles close up. | `front.local-sky.v1#1` | `zenith` | front | highlighted |
| `almucantar` | part | A circle of equal height above the horizon, engraved every 10°. | `front.local-sky.v1#2` | `almucantar` | front | highlighted |
| `meridian-line` | part | The straight line through the centre and zenith; its top end points due south and it splits east from west. | `front.local-sky.v1#3` | `meridian-line` | front | highlighted |
| `azimuth-line` | part | A curve from the zenith to the horizon for one compass direction, every 30°, labelled at its foot. | `front.local-sky.v1#3` | `azimuth-line` | front | highlighted |
| `azimuth` | idea | Compass direction, counted clockwise from north: 90° east, 180° south, 270° west. | `front.local-sky.v1#3` | `azimuth-line` | front | highlighted |
| `east-west` | idea | On the front, east is the left half of the plate and west the right half. | `front.local-sky.v1#3` | `azimuth-line` | front | highlighted |
| `read-alt-az` | reading | Read a point's height from the almucantars and its direction from the azimuth lines. | `front.local-sky.v1#4` | `almucantar`, `azimuth-line` | front | highlighted |
| `interpolate` | reading | Estimate a value lying between two engraved lines. | `front.local-sky.v1#4` | `almucantar` | front | highlighted |
| `plate-latitude` | idea | Each plate is drawn for one latitude; the wrong plate gives wrong heights and times. | `front.local-sky.v1#6` | `plate`, `plate-mismatch` | front | animated |
| `choose-plate` | manipulation | Put in the plate made for your latitude. | `front.local-sky.v1#6` | `plate-selector` | controls | animated |
| `celestial-pole` | idea | The still point the sky turns about; on the front it is the central pin. | `front.read-star.v1#1` | `pin` | front | highlighted |
| `daily-rotation` | idea | The whole sky turns once a day about the pole, carrying the stars clockwise across the front. | `front.read-star.v1#1` | `rete` | front | highlighted |
| `rising` | idea | A body crossing the horizon upward on the east side. | `front.read-star.v1#3` | `horizon` | front | animated |
| `culmination` | idea | A body crossing the meridian at its highest point of the day. | `front.read-star.v1#4` | `meridian-line` | front | highlighted |
| `setting` | idea | A body crossing the horizon downward on the west side. | `front.read-star.v1#5` | `horizon` | front | highlighted |
| `circumpolar` | idea | A star close enough to the pole that it never sets. | `front.read-star.v1#7` | `star-pointer` | front | highlighted |
| `ecliptic` | idea | The Sun's yearly path among the stars, the off-centre ring on the rete. | `back.sun-place.v1#1` | `ecliptic-ring` | front | highlighted |
| `date-to-longitude` | manipulation | Lay the alidade across a date on the calendar ring to read the Sun's place on the outer scales. | `back.sun-place.v1#2` | `alidade`, `calendar-scale` | back | animated |
| `ecliptic-longitude` | idea | The Sun's place on the ecliptic in degrees, 0–360 from the start of Aries. | `back.sun-place.v1#3` | `back-degree-scale` | back | highlighted |
| `zodiac-sign` | idea | One of the twelve 30° parts of the ecliptic, named Aries to Pisces. | `back.sun-place.v1#3` | `zodiac-scale` | back | highlighted |
| `read-longitude` | reading | Read the Sun's degrees and sign where the alidade's date end crosses the outer scales. | `back.sun-place.v1#3` | `back-degree-scale`, `zodiac-scale` | back | highlighted |
| `ecliptic-scale` | scale | The half-degree graduations round the rete's ecliptic. | `back.sun-place.v1#4` | `ecliptic-scale` | front | highlighted |
| `sun-date-point` | idea | The point on the ecliptic at the date's longitude; it stands for the Sun all that day. | `back.sun-place.v1#4` | `ecliptic-scale` | front | highlighted |
| `find-sun-point` | manipulation | Find a longitude on the rete's ecliptic and lay the rule over it. | `back.sun-place.v1#4` | `ecliptic-scale`, `rule` | front | animated |
| `true-ecliptic-edge` | idea | The edge of the ecliptic band that touches the Tropic of Cancer; set the Sun on that edge. | `back.sun-place.v1#5` | `ecliptic-edge` | front | highlighted |
| `tropic-cancer` | part | The smallest plate circle centred on the pin, the Sun's path on the longest day. | `back.sun-place.v1#5` | `tropic-cancer` | front | highlighted |
| `equator` | part | The middle plate circle, the Sun's path at the equinoxes. | `back.sun-place.v1#5` | `equator` | front | highlighted |
| `tropic-capricorn` | part | The plate's outer circle, the Sun's path on the shortest day. | `back.sun-place.v1#5` | `tropic-capricorn` | front | highlighted |
| `opposite-points` | idea | Two points 180° apart on the ecliptic lie on one straight line through the pole. | `back.sun-place.v1#8` | `rule-edge` | front | shown |
| `side-of-sky` | idea | In a day the Sun's point crosses each height circle below its noon height twice; morning or rising means the east half, afternoon or setting the west half. | `solar.time-by-sun.v1#3` | `meridian-line` | front | highlighted |
| `set-on-almucantar` | manipulation | Turn the rete until a body's point sits on the height circle for its measured altitude, on the correct side. | `solar.time-by-sun.v1#4` | `rete`, `almucantar` | front | animated |
| `read-time` | reading | Lay the rule's Sun end over the Sun's date point and read the hour where that end meets the limb. | `solar.time-by-sun.v1#5` | `rule`, `limb-hour-scale` | front | animated |
| `local-apparent-time` | idea | Sundial time for your exact place: 12:00 is when the Sun crosses the meridian. | `solar.time-by-sun.v1#5` | `limb-hour-scale` | front | highlighted |
| `degrees-to-hours` | idea | The sky turns 15° an hour, so each hour mark on the limb is 15° and 1° is 4 minutes. | `solar.time-by-sun.v1#6` | `limb-degree-scale` | front | highlighted |
| `hour-angle` | idea | How far, in degrees, the Sun's rule stands from the noon line; ÷ 15 gives hours from noon. | `solar.time-by-sun.v1#6` | `rule-edge` | front | highlighted |
| `near-noon-accuracy` | idea | Near noon the Sun's height barely changes, so a small height error becomes a large time error. | `solar.time-by-sun.v1#11` | `meridian-line` | front | highlighted |
| `sunrise` | reading | The time when the Sun's date point reaches the eastern horizon. | `solar.events.v1#2` | `horizon`, `limb-hour-scale` | front | animated |
| `local-noon` | reading | The moment the Sun's point crosses the meridian: 12:00 sundial time. | `solar.events.v1#3` | `meridian-line` | front | highlighted |
| `noon-altitude` | reading | The Sun's height when it crosses the meridian, its greatest of the day. | `solar.events.v1#3` | `almucantar` | front | highlighted |
| `sunset` | reading | The time when the Sun's date point reaches the western horizon. | `solar.events.v1#4` | `horizon`, `limb-hour-scale` | front | highlighted |
| `day-length` | reading | Sunset time minus sunrise time; also the limb degrees swept ÷ 15. | `solar.events.v1#5` | `limb-degree-scale` | front | highlighted |
| `rising-azimuth` | reading | The compass direction where the Sun rises; north of east in summer, south of east in winter. | `solar.events.v1#8` | `azimuth-line` | front | highlighted |
| `geometric-horizon` | idea | The engraved horizon ignores the air's bending of light, so the real Sun rises a few minutes earlier and sets later. | `solar.events.v1#8` | `horizon` | front | shown |
| `time-from-sun-point` | idea | Whatever body you measured, the time is read with the rule over the Sun's date point, even below the horizon. | `night.time-by-star.v1#4` | `ecliptic-scale` | front | highlighted |
| `equation-of-time` | idea | Sundial time minus even (mean) time for a date; up to about +16 or −14 minutes. | `back.equation-time.v1#2` | `eot-curve` | back | highlighted |
| `alidade-minute-scale` | scale | The minute numbers on one arm of the alidade, against which the loop is read. | `back.equation-time.v1#2` | `alidade-minute-scale` | back | highlighted |
| `read-eot` | reading | Read the minutes where the loop crosses the minute arm laid over the date. | `back.equation-time.v1#4` | `alidade-minute-scale`, `eot-curve` | back | highlighted |
| `local-mean-time` | idea | Even time for your exact place: sundial time minus the equation of time. | `back.equation-time.v1#5` | `eot-curve` | back | highlighted |
| `longitude-correction` | idea | Your watch keeps the time of your zone's meridian (Greenwich in Britain, 15° E in central Europe); add 4 minutes per degree west of it, subtract per degree east. | `back.equation-time.v1#5` | `none`: a fact about where you stand, not engraved on any astrolabe | — | shown |
| `summer-time` | idea | The civil extra hour in summer (BST in Britain) added to zone time. | `back.equation-time.v1#5` | `none`: a civil convention with no astronomical engraving | — | shown |
| `unequal-hour` | idea | One twelfth of the daylight from sunrise to sunset, so its length changes with the season. | `front.unequal-hours.v1#1` | `unequal-hour-line` | front | shown |
| `unequal-hour-line` | part | The 11 numbered curves below the horizon dividing the night half of the sky into twelve. | `front.unequal-hours.v1#2` | `unequal-hour-line` | front | highlighted |
| `sun-nadir-point` | idea | The ecliptic point opposite the Sun's; by day it is set on the hour lines in the Sun's place. | `front.unequal-hours.v1#3` | `ecliptic-scale` | front | highlighted |
| `set-time` | manipulation | Turn the rule until its Sun end points to a given time on the limb. | `front.set-sky.v1#2` | `rule`, `limb-hour-scale` | front | animated |
| `set-sky-for-time` | manipulation | With the rule set to a time, turn the rete until the Sun's date point is under the rule. | `front.set-sky.v1#3` | `rete` | front | animated |
| `umbra-versa` | scale | The upright side of the shadow square, crossed by sightings below 45°: height ÷ distance = reading ÷ 12. | `back.shadow-square.v1#2` | `umbra-versa` | back | highlighted |
| `umbra-recta` | scale | The bottom side of the shadow square, crossed by sightings above 45°: height ÷ distance = 12 ÷ reading. | `back.shadow-square.v1#2` | `umbra-recta` | back | highlighted |
| `shadow-ratio` | idea | The shadow square turns a sighting angle into a ratio of height to distance. | `back.shadow-square.v1#2` | `shadow-square` | back | highlighted |
| `shadow-corner` | reading | At 45° the alidade hits the square's corner, and height above the eye equals distance. | `back.shadow-square.v1#3` | `shadow-square` | back | animated |
| `read-shadow-square` | reading | Read the number of twelfths where the alidade crosses a side of the shadow square. | `back.shadow-square.v1#5` | `umbra-recta`, `umbra-versa` | back | highlighted |
| `eye-height` | idea | The square measures from the pivot at your eye, so add your eye height for the full height. | `back.shadow-square.v1#9` | `back-axes` | back | highlighted |

Notes for transcription:
- Only two concepts map to `none` (`longitude-correction`, `summer-time`). Both are pieces of arithmetic about the observer's clock, and no astrolabe engraves them.
- A part may serve several concepts. For example, `ecliptic-scale` serves `ecliptic-scale`, `sun-date-point`, `sun-nadir-point` and `time-from-sun-point`. Instance attributes then distinguish the tick, e.g. `ecliptic-scale[longitude=30.5]`.
- Each rendered element should also carry `data-concept="<space-separated concept ids>"` for the concepts whose "simulator element(s)" cell names its part. For example, every `azimuth-line` carries `azimuth-line azimuth east-west read-alt-az rising-azimuth`. Generate this from the table; do not hand-maintain it.

### 1.2 `data-part` vocabulary

A rendered element carries `data-part="<id>"`. Repeated engravings carry the same id plus one instance attribute (column 4). A highlight reference `part[key=value]` resolves to `[data-part="part"][data-key="value"]` within the face that is showing. A bare `part` matches every instance. 39 parts.

| part id | face | what it is | instance attribute | existing component / status |
|---|---|---|---|---|
| `mater` | both | Instrument body disc | — | exists: `circle.astro-mater` (`Front.tsx`, `Back.tsx`) |
| `throne` | both | Bracket and ring at the top | — | **to be built** in the art redraw (FINDINGS-ART "Throne / kursi") |
| `pin` | both | Central pin (front: north celestial pole) | — | exists: `.astro-center-pin-decoration` |
| `limb` | front | Raised outer rim band | — | exists: `path.astro-limb-band` |
| `limb-degree-scale` | front | 360 limb ticks | `data-degree` (0–359) | exists: `line.astro-limb-tick` (`data-limb-degree`) |
| `limb-hour-scale` | front | 24 hour numerals | `data-hour` (0–23) | exists (`Front.tsx` `LIMB_HOURS`); **re-engrave with noon at the top (FG-2)** |
| `plate` | front | Latitude plate group | — | exists: `g[data-tutorial-target=front.plate]` |
| `horizon` | front | Horizon circle | — | exists: `.astro-horizon` |
| `zenith` | front | Zenith dot and label | — | exists: `.astro-zenith-dot` |
| `almucantar` | front | Equal-height circle and its label | `data-altitude` (10–80) | exists: `.astro-almucantar` and the altitude labels |
| `meridian-line` | front | Straight meridian line above the horizon | — | exists: the degenerate `azimuth()` line for 0°/180° in `Plate.tsx` (tag that element) |
| `azimuth-line` | front | Azimuth curve (its own half of the circle, from the zenith down its side to the horizon) and its foot label | `data-azimuth` (0–330, step 30) | exists: `.astro-azimuth` and the azimuth labels |
| `equator` | front | Celestial equator circle and label | — | exists: `.astro-equator` |
| `tropic-cancer` | front | Tropic of Cancer circle and label | — | exists: `.astro-tropic` |
| `tropic-capricorn` | front | Plate rim = Tropic of Capricorn, and label | — | exists: `.astro-rim` |
| `unequal-hour-line` | front | Lower unequal-hour curve | `data-hour` (1–11) | exists: `.astro-unequal-hour`; **numerals I–XI to add (FG-2)** |
| `rete` | front | Rotating star map | — | exists: `Rete.tsx` group (opaque, pierced in the art redraw) |
| `ecliptic-ring` | front | Whole ecliptic band | — | exists: `g[data-tutorial-target=front.ecliptic]` |
| `ecliptic-edge` | front | True ecliptic circle (outer edge, tangent to Cancer) | — | exists: `circle.astro-rete-ring` |
| `ecliptic-scale` | front | Ecliptic ticks and degree labels | `data-longitude` (0–359.5, step 0.5) | exists: `.astro-ecliptic-tick` (`data-ecliptic-longitude`) |
| `star-pointer` | front | One star's marker (a pointer tip after the redraw) | `data-star` (lower-case catalogue name, e.g. `sirius`) | exists as `circle.astro-star-dot`; pointer shape from the art redraw |
| `rule` | front | Front rule group | — | exists: `Rule.tsx` |
| `rule-edge` | front | Rule fiducial edge: one straight edge of each arm through the centre, a dark line on the metal beside the open side | — | exists: `FiducialEdge` in `moving.tsx` (`.astro-fiducial`) |
| `back-degree-scale` | back | Outer 0–360 ring | `data-degree` (0–359) on the ticks | exists: `g[data-tutorial-target=back.ecliptic-longitude]` |
| `altitude-scale` | back | Red 0–90 numbers (both upper quadrants) | `data-altitude` (0–90, step 10) on the right-hand quadrant's numerals and the 90: where the alidade's minute arm reads a height set by turning up from 0 | exists: `g[data-tutorial-target=back.altitude-scale]` |
| `zodiac-scale` | back | Zodiac band and labels | — | exists: `.astro-zodiac-band` and its labels |
| `calendar-scale` | back | Calendar ring | `data-date` (`MM-DD`) on day ticks | exists: `g[data-tutorial-target=back.calendar]`; add `data-date` to each tick |
| `back-axes` | back | Horizontal and vertical diameter lines | — | exists: `.astro-back-axis` |
| `shadow-square` | back | Shadow square group | — | exists: `g[data-tutorial-target=back.shadow-square]` |
| `umbra-versa` | back | Upright sides, numbers and label | — | exists inside the shadow-square group (tag it); **numbers on both sides (FG-2)** |
| `umbra-recta` | back | Bottom side, numbers and label | — | exists inside the shadow-square group (tag it); **numbers on both halves (FG-2)** |
| `eot-curve` | back | Equation-of-time loop and label | — | exists: `g[data-tutorial-target=back.equation-time]` |
| `horary-quadrant` | back | Double horary quadrant | — | exists: `g[data-tutorial-target=back.horary.vi]` |
| `alidade` | back | Alidade group | — | exists: `Alidade.tsx` (sights and vanes stay omitted, per LESSON_PLAN) |
| `alidade-edge` | back | Alidade fiducial edge (both arms, counterchanged) | — | exists: `FiducialEdge` in `moving.tsx` (`.astro-fiducial`) |
| `alidade-minute-scale` | back | Minute ticks and numbers on one arm | — | exists (−15…+15 every 5); **extend to ±20 with 1-minute ticks (FG-2)** |
| `face-toggle` | controls | "Show back / Show front" button | — | exists: `[data-testid=face-toggle]` |
| `plate-selector` | controls | Plate menu | — | exists: `[data-testid=plate-select]` (`setup.plate`) |
| `plate-mismatch` | controls | Plate/latitude warning banner | — | exists: `[data-testid=mismatch]` (`setup.plate-mismatch`) |

The `instrument` TargetId (whole face) is retired. Steps that frame the whole instrument list their specific parts or none.

#### Mapping from today's `TargetId`s

| Today's TargetId | New `data-part` |
|---|---|
| `front.plate` | `plate` |
| `front.altitude-grid` | `almucantar` |
| `front.rete` | `rete` |
| `front.star.sirius` | `star-pointer[star=sirius]` |
| `front.ecliptic` | `ecliptic-ring` |
| `front.unequal-hours` | `unequal-hour-line` |
| `front.rule` | `rule` |
| `back.altitude-scale` | `altitude-scale` |
| `back.calendar` | `calendar-scale` |
| `back.ecliptic-longitude` | `back-degree-scale` |
| `back.horary.vi` | `horary-quadrant` |
| `back.equation-time` | `eot-curve` |
| `back.shadow-square` | `shadow-square` |
| `back.alidade` | `alidade` |
| `setup.plate` | `plate-selector` |
| `setup.plate-mismatch` | `plate-mismatch` |
## 2. Ordered lessons

| # | Lesson id | Title | Steps | Prerequisites | Status vs today |
|---|---|---|---|---|---|
| 1 | `front.foundations.v1` | Meet the astrolabe: what stays fixed and what turns | 12 | — | revised (builds on b1e9e5f) |
| 2 | `back.measure-altitude.v1` | Set a measured altitude on the alidade | 6 | 1 | revised, moved earlier |
| 3 | `front.local-sky.v1` | Read height and direction on your latitude plate | 8 | 1, 2 | **new** (plate choice moved here from 1) |
| 4 | `front.read-star.v1` | Follow a star from rising to setting | 8 | 3 | revised (no longer needs a date) |
| 5 | `back.sun-place.v1` | Find the Sun's place for any date | 9 | 1, 4 | **new** (date steps from the old set-sky) |
| 6 | `solar.time-by-sun.v1` | Tell the time from the Sun's height | 11 | 2, 3, 5 | **new, keystone** |
| 7 | `solar.events.v1` | Find sunrise, noon, sunset and the length of the day | 8 | 6 | revised |
| 8 | `night.time-by-star.v1` | Tell the time at night from a star | 9 | 4, 6 | **new** |
| 9 | `back.equation-time.v1` | Turn astrolabe time into the time on your watch | 10 | 5, 6 | revised (adds longitude and summer time) |
| 10 | `front.unequal-hours.v1` | Tell the seasonal (unequal) hour | 8 | 5, 7 | revised |
| 11 | `front.set-sky.v1` | Set the sky for a date and clock time: what is up tonight? | 9 | 8, 9 | revised, now the capstone |
| 12 | `back.shadow-square.v1` | Measure a height with the shadow square | 9 | 1, 2 | revised (side quest; may be taken any time after 2) |

The retired lesson `back.unequal-hours.v1` (double horary quadrant) is moved to Deferred (§3.2). The reason is that its key step, carrying the curve-VI distance, cannot be shown or checked without an alidade cursor. Keep its id reserved, and add a `LESSON_ALIASES` entry pointing `back.unequal-hours.v1` to `front.unequal-hours.v1` so old links resolve.

---

### Lesson 1 — `front.foundations.v1` — Meet the astrolabe: what stays fixed and what turns

*Summary:* Name the parts on both faces, turn the rete and rule on the front, turn the instrument over, and move the alidade on the back.
*Prerequisites:* none.
*Epoch:* 2026-04-20.

This keeps b1e9e5f's shape: both faces are covered; step 1's result says no date or time has been set; at least one step is on the back; the alidade demonstration uses `alidadeRotation`; and the final result mentions no date or noon. The plate-comparison steps move to Lesson 3, where height lines are taught.

**1 · `meet-instrument` · Meet the instrument** — E · front
- Purpose: name the body before any procedure.
- Instruction: look at the whole front. The **mater** is the thick disc; its raised rim is the **limb**. The **throne** at the top carries the hanging ring.
- Demonstration: none (static view).
- Stop cue: —
- Meaning: everything else sits inside the mater, held on its central pin; some pieces stay fixed and some turn.
- Introduces: `mater`, `limb`, `throne`.
- Uses: —
- Highlights: `mater`, `limb`, `throne`.
- Check: none.
- Result: "The front shows London's 51.5° plate with the rete and rule at their starting positions; no date or time has been set."

**2 · `fixed-plate` · Find the fixed plate** — E · front
- Purpose: separate what is fixed (you, the observer) from what will turn (the sky).
- Instruction: find the **plate**, the engraved disc in the hollow of the mater. It is made for one latitude; this one is for London, 51.5° N.
- Demonstration: none.
- Stop cue: —
- Meaning: the plate never moves during a reading.
- Introduces: `plate`.
- Uses: `mater`.
- Highlights: `plate`.
- Check: none.

**3 · `moving-rete` · Turn the sky** — D · front
- Purpose: show that the star map turns over the fixed plate.
- Instruction: the pierced frame on top is the **rete**, a map of the sky. Each pointed tongue's tip is a star. Turn the rete clockwise until the tip of **Sirius** touches the **horizon**, the large off-centre circle on the plate, on its left side.
- Demonstration: `reteRotation` 0 → 33.5 (700 ms).
- Stop cue: Sirius's tip sits on the horizon circle, left of centre.
- Meaning: you have just made Sirius rise; the plate did not move.
- Introduces: `rete`, `star-pointer`, `horizon`, `rotate-rete`.
- Uses: `plate`.
- Highlights: `rete`, `star-pointer[star=sirius]`, `horizon`.
- Check: `frontGeometry(Sirius; pos alt 0.0 / az 117.5 ±1)`, derived from `horizon`.

**4 · `reading-rule` · Lay the rule across a star** — D · front
- Purpose: show the rule as the pointer that carries a point out to the edge.
- Instruction: the **rule** is the straight pointer on top. One straight edge of each arm runs exactly through the centre: that is the reading edge. Turn the rule until that edge passes through Sirius's tip.
- Demonstration: `ruleRotation` 0 → 67.8 (700 ms); the rete stays at 33.5.
- Stop cue: the rule's edge runs through Sirius's tip.
- Meaning: the rule's line now joins the centre, the star and a point on the limb.
- Introduces: `rule`, `fiducial-edge`, `lay-rule`.
- Uses: `star-pointer`, `rete`, `limb`.
- Highlights: `rule`, `rule-edge`, `star-pointer[star=sirius]`.
- Check: `frontGeometry(Sirius; rule over Sirius ±1)`, derived from `rule-edge`.

**5 · `your-turn-front` · Turn the sky and follow with the rule** — T · front
- Purpose: the learner performs both front manipulations.
- Instruction: the rule has been turned aside (snapshot rule 300, off Sirius and off the vertical line). Keep turning the rete clockwise until Sirius stands on the straight vertical line above the centre, at its highest. Then lay the rule over Sirius again.
- Demonstration: none (Replay shows step 3).
- Stop cue: Sirius's tip is on the vertical line, and the rule's edge runs through it.
- Meaning: a star climbs from the horizon to a highest point while the plate stays still.
- Introduces: —
- Uses: `rotate-rete`, `lay-rule`, `star-pointer`.
- Highlights: `rete`, `rule`, `star-pointer[star=sirius]`.
- Check: `frontGeometry(Sirius; pos alt 21.8 / az 180.0 ±1; rule over Sirius ±1)` (rete ≈ 101.3, rule ≈ 0), derived from `horizon` and `rule-edge`.

**6 · `limb-scales` · Read the limb** — E · front
- Purpose: preview the scale every timing lesson ends on.
- Instruction: follow the rule out to the limb. The limb is engraved with 360 one-degree ticks and with 24 hour numbers, one every 15°, with 12 at the top (FG-2).
- Demonstration: none.
- Stop cue: —
- Meaning: once the rule lies over the Sun, the limb gives the time. Here no Sun has been placed, so this is not yet a time.
- Introduces: `limb-degree-scale`, `limb-hour-scale`.
- Uses: `rule`, `limb`.
- Highlights: `limb-degree-scale`, `limb-hour-scale`.
- Check: none.

**7 · `turn-to-back` · Turn the instrument over** — D · front → back
- Purpose: many operations use both faces.
- Instruction: press **Show back** to turn the astrolabe over.
- Demonstration: the face changes from front to back (`face` demonstration, FG-4).
- Stop cue: the back, with its rings of scales, is showing.
- Meaning: the button now reads Show front; the back has its own fixed engravings and its own moving bar.
- Introduces: `turn-over`.
- Uses: `mater`.
- Highlights: `face-toggle`, `mater`.
- Check: `faceIs(back)`.

**8 · `read-back-scales` · The outer rings: degrees and heights** — E · back
- Purpose: pre-training; name the scales before they are used, one pair at a time so each name maps to its highlighted ring.
- Instruction: start at the edge. The outermost ring is the **degree scale**, 0–360, with black numbers. Just inside it, the red numbers of the **altitude scale** count heights: 0 at the horizontal line, 90 at the top.
- Demonstration: none.
- Stop cue: —
- Meaning: Lesson 2 uses the red scale for every measured height; the black numbers belong to the degree scale.
- Introduces: `back-degree-scale`, `altitude-scale`.
- Uses: `turn-over`.
- Highlights: `back-degree-scale`, `altitude-scale`.
- Check: none.

**9 · `read-date-rings` · The date rings** — E · back
- Purpose: name the two rings that turn a date into the Sun's place.
- Instruction: further in come the **zodiac band**, twelve signs ARI…PIS, and inside it the **calendar ring**, JAN…DEC, with a tick for every day.
- Demonstration: none.
- Stop cue: —
- Meaning: a straight edge laid across a date also crosses the zodiac band and the degree scale (Lesson 5).
- Introduces: `zodiac-scale`, `calendar-scale`.
- Uses: `back-degree-scale`.
- Highlights: `zodiac-scale`, `calendar-scale`.
- Check: none.

**10 · `read-back-centre` · The middle of the back** — E · back
- Purpose: know what the central engravings are for.
- Instruction: in the middle are the **shadow square** (lower half, heights; Lesson 12), the **equation-of-time loop** (sundial to clock time; Lesson 9), and the **double horary quadrant** (upper half), which the course only names.
- Demonstration: none.
- Stop cue: —
- Meaning: none of the back's engravings move; each is a table you read with a straight edge.
- Introduces: `shadow-square`, `eot-curve`, `horary-quadrant`.
- Uses: —
- Highlights: `shadow-square`, `eot-curve`, `horary-quadrant`.
- Check: none.

**11 · `move-alidade` · Move the alidade** — D · back
- Purpose: show the back's moving bar and its reading edge.
- Instruction: the **alidade** is the sighting bar pivoted at the centre. Turn it until it stands upright over the vertical engraved line, pointing at the red 90 at the top.
- Demonstration: `alidadeRotation` 0 → 90 (700 ms).
- Stop cue: the alidade stands upright over the vertical line, its tip at the red 90.
- Meaning: held up to the sky, an upright alidade would sight straight overhead. Its edge reads any back scale it crosses.
- Introduces: `alidade`, `rotate-alidade`, `back-axes`.
- Uses: `fiducial-edge`, `altitude-scale`.
- Highlights: `alidade`, `alidade-edge`, `back-axes`.
- Check: `angleNear(alidadeRotation, 90 ±1)`, derived from `back-axes`.

**12 · `foundations-result` · Two faces, three moving parts** — E · back
- Purpose: consolidate, and defuse the naming trap.
- Instruction: review. Front: plate (fixed), rete and rule (turn). Back: fixed scales, and the alidade (turns). Beware older books: Chaucer calls the back sighting bar the *rule* and the front pointer the *label*. This course uses the modern names *alidade* and *rule*.
- Demonstration: none.
- Stop cue: —
- Meaning: you can now find every part the later lessons name.
- Introduces: `old-part-names`.
- Uses: `alidade`, `rule`.
- Highlights: `alidade`.
- Check: none.
- Result: "Result: both faces and their independently moving parts have been identified; no observational date or time setting is implied."

---

### Lesson 2 — `back.measure-altitude.v1` — Set a measured altitude on the alidade

*Summary:* Understand how a real astrolabe measures height, then put supplied measurements on the alidade and read them back.
*Prerequisites:* `front.foundations.v1`.
*Epoch:* 2026-04-20 (steps 1–4), 2026-10-23 (steps 5–6).

**1 · `physical-sighting` · How a real astrolabe measures** — E · back
- Purpose: be honest about what the simulator cannot do.
- Instruction: on a real instrument, hang it from the ring at the throne so it hangs plumb. Turn the alidade until the target shows through both of its sights. For the Sun, never look at it: turn until the sunlight through the upper sight falls on the lower one. This flat simulation has no sights, so every measured height in the course is given to you.
- Demonstration: none. Snapshot `alidadeRotation` 90 (upright, as Lesson 1 left it, so the horizontal line and the red 0 stay visible).
- Stop cue: —
- Meaning: the course starts from the number your sighting would give.
- Introduces: `sighting`.
- Uses: `alidade`, `throne`.
- Highlights: `alidade`, `throne`.
- Check: none.

**2 · `given-altitude` · What altitude means** — E · back
- Purpose: define the quantity being carried.
- Instruction: **altitude** is the angle of a body above the horizon: 0° on the horizon, 90° overhead. On the back it is counted on the red scale from the horizontal line up to 90 at the top. Your first measurement: the Sun on the morning of 20 April, at **30°**.
- Demonstration: none. Snapshot `alidadeRotation` 90.
- Stop cue: —
- Meaning: the red scale and the horizontal line are the instrument's own "horizon to overhead".
- Introduces: `altitude`.
- Uses: `altitude-scale`, `back-axes`, `horizon`.
- Highlights: `altitude-scale`, `back-axes`.
- Check: none.

**3 · `set-alidade` · Set 30° on the alidade** — D · back
- Purpose: put the measured number on the instrument.
- Instruction: turn either end of the alidade up from the horizontal line until its edge crosses **30** on the red scale.
- Demonstration: `alidadeRotation` 0 → 30 (700 ms).
- Stop cue: the edge crosses the red 30.
- Meaning: the alidade now holds the Sun's measured height for later use.
- Introduces: `set-altitude`.
- Uses: `altitude`, `rotate-alidade`, `fiducial-edge`.
- Magnify frame: `altitude-scale[altitude=20]`, `altitude-scale[altitude=40]` (the red numerals round the mark the edge turns to).
- Highlights: `alidade-edge`, `altitude-scale`.
- Check: `alidadeAltitude(30 ±1)` (FG-4; until then `angleNear(alidadeRotation, 30 ±1)`), derived from `altitude-scale`.

**4 · `read-between` · Read a height between the numbers** — R · back
- Purpose: practise reading the scale, not only setting it, and avoid reading the wrong numbers.
- Instruction: the snapshot shows the alidade left after a star sighting. The red numbers come every 10°, and the outer ring's 1° ticks line up with them. What altitude is set?
- Demonstration: snapshot `alidadeRotation` 47.
- Stop cue: count the ticks past the red 40.
- Meaning: the black numbers belong to the degree scale, not to altitude.
- Introduces: `read-altitude-scale`.
- Uses: `altitude-scale`, `back-degree-scale`.
- Highlights: `altitude-scale` (only the red scale, so the black/red distinction stays visible).
- Check: `choice(["47°" ✓, "43° (adds the 3 ticks below the red 50 to 40: count from one red number, 40 + 7 or 50 − 3)", "133° (black degree numbers)"])`, derived from `altitude-scale`.

**5 · `second-altitude` · Your turn: an afternoon measurement** — T · back
- Purpose: the second worked value.
- Instruction: on the afternoon of 23 October the Sun was measured at **20°**. Set it.
- Demonstration: none. The snapshot starts at 47.
- Stop cue: the edge crosses the red 20.
- Magnify frame: `altitude-scale[altitude=10]`, `altitude-scale[altitude=50]` (from the alidade's start at 47 down to the target; Magnify adds the tool's tip itself).
- Meaning: the alidade holds 20°; it will be used in Lesson 6.
- Introduces: —
- Uses: `set-altitude`, `rotate-alidade`.
- Highlights: `altitude-scale`.
- Check: `alidadeAltitude(20 ±1)`, derived from `altitude-scale`.

**6 · `altitude-result` · Carry the number forward** — E · back
- Purpose: link to the front.
- Instruction: write the number down: 30° (20 April, morning) and 20° (23 October, afternoon). The front plate has circles for the same heights, which Lesson 3 introduces.
- Demonstration: none.
- Stop cue: —
- Meaning: the measurement is now a number on an engraved scale.
- Introduces: —
- Uses: `altitude`.
- Highlights: `alidade`.
- Check: none.
- Result: "Result: two supplied measurements, 30° and 20°, have been set and read on the altitude scale."

---

### Lesson 3 — `front.local-sky.v1` — Read height and direction on your latitude plate

*Summary:* Learn the horizon, zenith, height circles and direction lines, read where two stars are, and see why the plate must match your latitude.
*Prerequisites:* `front.foundations.v1`, `back.measure-altitude.v1`.
*Epoch:* 2026-04-20.
*Snapshot:* front, rete 101.3, rule 300 (moved clear of the readings).

**1 · `horizon-zenith` · Your horizon and your zenith** — E · front
- Purpose: the plate is your local sky frame.
- Instruction: the horizon circle separates the sky (inside) from the ground. The dot marked **Zenith** is the point straight above you.
- Demonstration: none.
- Stop cue: —
- Meaning: anything inside the horizon is above the ground.
- Introduces: `zenith`.
- Uses: `horizon`, `plate`.
- Highlights: `horizon`, `zenith`.
- Check: none.

**2 · `almucantars` · Circles of equal height** — E · front
- Purpose: connect back altitudes to front lines.
- Instruction: the off-centre circles between the horizon and the zenith are **almucantars**, circles of equal height, engraved every 10° and labelled 10°–80°. The horizon is 0°. The 30° circle holds every point 30° up, the same 30° you set on the alidade.
- Demonstration: none.
- Stop cue: —
- Meaning: an altitude from the back becomes a circle on the front.
- Introduces: `almucantar`.
- Uses: `altitude`, `horizon`, `zenith`.
- Highlights: `almucantar[altitude=30]` (the named circle only).
- Check: none.

**3 · `directions` · Directions on the plate** — E · front
- Purpose: east/west is the decision later lessons depend on.
- Instruction: the straight line up through the zenith is the **meridian**; its top end points due south. The curves running from the zenith to the horizon are **azimuth lines**: compass directions every 30°, labelled at their feet and counted clockwise from north. The 90° line (east) is on the **left**; the 270° line (west) is on the **right**.
- Demonstration: none.
- Stop cue: —
- Meaning: east is left and west is right on the front of a northern astrolabe.
- Introduces: `meridian-line`, `azimuth-line`, `azimuth`, `east-west`.
- Uses: `zenith`, `horizon`.
- Highlights: `meridian-line`, `azimuth-line[azimuth=90]`, `azimuth-line[azimuth=270]`. Each azimuth line is drawn as its own half of its circle (zenith down its own side), so the 90° and 270° highlights are two separate curves, left and right; the rete leaves enough of the 90° curve visible at the lesson setting.
- Check: none.

**4 · `read-sirius` · Worked reading: Sirius** — E · front
- Purpose: a fully worked example of reading a position.
- Instruction: Sirius's tip is on the meridian, between the 20° and 30° circles and about a fifth of the way from the 20° circle towards the 30° circle. So it is about **22° high, due south (azimuth 180°)**.
- Demonstration: none.
- Stop cue: —
- Meaning: you estimate between engraved lines, as with any scale.
- Introduces: `read-alt-az`, `interpolate`.
- Uses: `almucantar`, `azimuth-line`, `meridian-line`, `star-pointer`.
- Highlights: `star-pointer[star=sirius]`, `almucantar[altitude=20]`, `almucantar[altitude=30]`, `meridian-line`.
- Check: none (computed 21.8° / 180.0°).

**5 · `read-regulus` · Your turn: read Regulus** — R · front
- Purpose: a faded example (second worked value).
- Instruction: find Regulus. Read its height and direction.
- Demonstration: none.
- Magnify frame: `star-pointer[star=regulus]`, the numerals `label(almucantar[altitude=30])`, `label(almucantar[altitude=40])`, `label(azimuth-line[azimuth=120])` (what the reading uses; numerals only, so the frame fits at 2× and a phone opens magnified without a decoy 120).
- Stop cue: the two height circles either side of the tip, and the nearest azimuth line.
- Meaning: Regulus is about 33° up, in the east-south-east (azimuth about 115°, just short of the 120° line).
- Introduces: —
- Uses: `read-alt-az`, `interpolate`, `east-west`.
- Highlights: `star-pointer[star=regulus]`.
- Check: `choice(["about 33°, east-south-east" ✓, "about 33°, west-south-west (east and west swapped)", "about 27°, east-south-east (counted down from 40 the wrong way)"])`, derived from `almucantar` and `azimuth-line` (computed 33.2° / 115.1°).

**6 · `compare-plate` · Why the plate must match your latitude** — D · front
- Purpose: the plate is the observer; the rete is the sky.
- Instruction: watch the guide swap in the Clima V plate, made for Rome (40.93°). The rete has not moved. Sirius now sits about **32°** up (computed 32.35°), because the horizon and height circles are drawn for a different place.
- Demonstration: `plate` demonstration 51.5 → 40.93 (FG-4); `plateSelection: 'pinned'`.
- Stop cue: the horizon circle visibly changes; Sirius crosses the 30° circle (highlighted, with its label, as `almucantar[altitude=30]`).
- Meaning: the wrong plate gives wrong heights, and so wrong times.
- Introduces: `plate-latitude`, `choose-plate`.
- Uses: `plate`, `horizon`, `almucantar`, `read-alt-az`.
- Highlights: `plate`, `horizon`, `plate-selector`.
- Check: `plateIs(40.93)` (FG-4), which passes when the demonstration ends.

**7 · `restore-plate` · Your turn: choose London's plate** — T · front
- Purpose: the learner performs the plate choice.
- Instruction: in the plate menu, choose **Exact 51.5°**. A stock set of plates would give you 50° for London; the warning banner says how far off it is (1.5°).
- Demonstration: none.
- Stop cue: the warning banner disappears, and Sirius is back near 22° (the matching-plate banner is hidden during lessons, so the cue names the warning going away).
- Meaning: every later lesson uses London's exact plate.
- Introduces: —
- Uses: `choose-plate`, `plate-latitude`, `read-alt-az`.
- Highlights: `plate-selector`, `plate-mismatch`.
- Check: `plateIs(51.5)` (FG-4).

**8 · `local-sky-result` · What the plate tells you** — E · front
- Purpose: consolidate.
- Instruction: any point under the rete can be read as height (almucantars) and direction (azimuth lines) for your latitude.
- Demonstration: none.
- Stop cue: —
- Meaning: Sirius about 22° due south; Regulus about 33° east-south-east.
- Introduces: —
- Uses: `read-alt-az`.
- Highlights: `plate`.
- Check: none.
- Result: "Result: positions read as altitude and azimuth on London's 51.5° plate."

---

### Lesson 4 — `front.read-star.v1` — Follow a star from rising to setting

*Summary:* See the sky turn about the pole, follow Arcturus from rising through its highest point to setting, and meet a star that never sets.
*Prerequisites:* `front.local-sky.v1`.
*Epoch:* 2026-04-20.

**1 · `sky-turns` · The sky turns about the pole** — E · front
- Purpose: deal with "but the Earth turns" (§3.1.1).
- Instruction: the central pin is the **north celestial pole**, the still point of the sky. The astrolabe is drawn from where you stand: your plate stays put, and the sky (the rete) turns clockwise about the pole once a day, carrying every star with it. That is what the Earth's turning looks like from the ground.
- Demonstration: none (snapshot rete 80). Every Lesson 4 snapshot turns the rule aside to 330° (`STAR_PATH.rule`; Sun end at XIV), at least 30° (mod 180°) from Arcturus at the start (134°), rising (116°), culmination (0°) and setting (244°) and from Capella's lowest point (180°), with its upper half right of the zenith so the height-circle labels and "Zenith" stay clear at culmination; so the rule never covers the star or the meridian the step names, at the snapshot or at the solution.
- Stop cue: —
- Meaning: turning the rete clockwise is letting time run forward.
- Introduces: `celestial-pole`, `daily-rotation`.
- Uses: `rete`, `plate`.
- Highlights: `pin`, `rete`.
- Check: none.

**2 · `find-arcturus` · Find Arcturus** — E · front
- Purpose: pick the body to follow.
- Instruction: find Arcturus's pointer. At the moment it is below the horizon, on the left (east) side.
- Demonstration: none.
- Stop cue: —
- Meaning: it has not risen yet.
- Introduces: —
- Uses: `star-pointer`, `horizon`, `east-west`.
- Highlights: `star-pointer[star=arcturus]`, `horizon`.
- Check: none.

**3 · `follow-rising` · Rising** — D · front
- Purpose: show rising as crossing the eastern horizon.
- Instruction: turn the rete clockwise until Arcturus's tip touches the horizon on the east side. Read its direction.
- Demonstration: `reteRotation` 80 → 98.0 (900 ms).
- Stop cue: the tip is on the horizon, just short of the 60° azimuth line.
- Meaning: Arcturus rises in the north-east (azimuth about 58°, just short of the 60° line).
- Introduces: `rising`.
- Uses: `rotate-rete`, `horizon`, `azimuth-line`.
- Highlights: `star-pointer[star=arcturus]`, `horizon`, `azimuth-line[azimuth=60]`.
- Check: `frontGeometry(Arcturus; pos alt 0.0 / az 58.1 ±1)`, derived from `horizon`.

**4 · `follow-culmination` · Your turn: highest point** — T · front
- Purpose: the learner performs it; introduce culmination.
- Instruction: keep turning clockwise until Arcturus crosses the meridian. Read its height there.
- Demonstration: none.
- Stop cue: the tip is on the meridian line.
- Meaning: Arcturus **culminates** due south at about 58° (computed 57.7°). This is its greatest height of the day.
- Introduces: `culmination`.
- Uses: `rotate-rete`, `meridian-line`, `read-alt-az`.
- Highlights: `star-pointer[star=arcturus]`, `meridian-line`, `almucantar[altitude=60]` (UXM-18: the star the cue names).
- Check: `frontGeometry(Arcturus; pos alt 57.7 / az 180.0 ±1)`, derived from `meridian-line` and `almucantar`.

**5 · `follow-setting` · Your turn: setting** — T · front
- Purpose: complete the path.
- Instruction: continue clockwise until Arcturus touches the horizon on the west side.
- Demonstration: none.
- Stop cue: the tip is on the horizon, right of the meridian.
- Meaning: Arcturus sets in the north-west (azimuth about 302°), mirroring its rising.
- Introduces: `setting`.
- Uses: `rotate-rete`, `horizon`.
- Highlights: `star-pointer[star=arcturus]`, `horizon`.
- Check: `frontGeometry(Arcturus; pos alt 0.0 / az 301.9 ±1)`, derived from `horizon`.

**6 · `path-symmetry` · What the path shows** — R · front
- Purpose: predict before the next case.
- Instruction: where does any star stand highest?
- Demonstration: none. The snapshot keeps the rule turned aside (330°) so it does not lie on the highlighted meridian.
- Stop cue: —
- Meaning: on the meridian, halfway between its rising and setting points.
- Introduces: —
- Uses: `culmination`, `rising`, `setting`, `meridian-line`.
- Highlights: `meridian-line`.
- Check: `choice("Where does a star stand highest?", ["on the meridian" ✓ (not "due south": stars north of +51.5°, such as Dubhe, culminate north of the zenith), "always at the zenith", "on the east side, as it rises"])`.

**7 · `circumpolar` · Your turn: a star that never sets** — T · front
- Purpose: introduce circumpolar stars.
- Instruction: turn the rete (either way) until **Capella** is at its lowest, on the meridian below the pole.
- Demonstration: none.
- Stop cue: Capella's tip is on the meridian line below the pin, inside the horizon.
- Meaning: Capella's lowest point is still about 7½° above the northern horizon, so it never sets from London. Vega only just clears the horizon (0.3°).
- Introduces: `circumpolar`.
- Uses: `rotate-rete`, `celestial-pole`, `read-alt-az`, `meridian-line`.
- Highlights: `star-pointer[star=capella]`, `pin`, `horizon`, `meridian-line`.
- Check: `frontGeometry(Capella; pos alt 7.5 / az 0.0 ±1.5)` (rete ≈ 259.2), derived from `almucantar` and `meridian-line`.

**8 · `path-result` · Daily path complete** — E · front
- Purpose: consolidate.
- Instruction: rising (east), culmination (meridian), setting (west); stars near the pole never set.
- Demonstration: none.
- Stop cue: —
- Meaning: the star pointers never move on the rete; turning the rete is the passing of the night.
- Introduces: —
- Uses: `daily-rotation`.
- Highlights: `rete`.
- Check: none.
- Result: "Result: Arcturus followed from rising (az 58°) to culmination (58° high) to setting (az 302°); Capella never sets."

---

### Lesson 5 — `back.sun-place.v1` — Find the Sun's place for any date

*Summary:* Carry a calendar date across the back scales to the Sun's ecliptic longitude, then find that point on the rete's ecliptic.
*Prerequisites:* `front.foundations.v1`, `front.read-star.v1`.
*Epoch:* 2026-04-20 (steps 1–5), 2026-10-23 (steps 6–9).
*Worked values:* 20 April → 30.4° (0° Taurus); 23 October → 210.1° (0° Scorpio).

**1 · `suns-path` · The Sun has no pointer** — E · front
- Purpose: motivate the date step.
- Instruction: the off-centre ring on the rete is the **ecliptic**, the Sun's yearly path among the stars. The stars have fixed pointers, but the Sun creeps round the ecliptic about 1° a day, so its place depends on the date.
- Demonstration: none (snapshot rete 0).
- Stop cue: —
- Meaning: to use the Sun, first find where it is on the ecliptic today.
- Introduces: `ecliptic`.
- Uses: `rete`, `star-pointer`.
- Highlights: `ecliptic-ring`.
- Check: none.

**2 · `date-to-longitude` · Lay the alidade across the date** — D · back
- Purpose: the back calendar is a ready-made table from date to Sun's place.
- Instruction: turn the alidade until its edge passes through **20 April** on the calendar ring. 20 is one of the longer ticks, which come every 5 days within each month.
- Demonstration: `alidadeRotation` 0 → 149.6 (700 ms).
- Stop cue: the edge runs through the 20 April tick.
- Meaning: the same straight edge now also crosses the zodiac band and the degree scale at this date's value.
- Introduces: `date-to-longitude`.
- Uses: `alidade`, `calendar-scale`, `fiducial-edge`.
- Highlights: `calendar-scale[date=04-20]`, `alidade-edge`.
- Check: `alidadeLongitude(30.4 ±1)` (FG-4; until then `angleNear(alidadeRotation, 149.6 ±1)`), derived from `calendar-scale`.

**3 · `read-longitude` · Read the Sun's longitude** — R · back
- Purpose: get the number.
- Instruction: follow the **same end** of the alidade outwards across the zodiac band to the outer degree scale. Read the sign and the degrees.
- Demonstration: none.
- Stop cue: the edge crosses the zodiac band right at the boundary, with TAU on the far side; on the degree scale it is a little under halfway from 30° to 31° (the division line itself lies under the edge).
- Meaning: on 20 April the Sun's **ecliptic longitude** is about 30.4°, the very start of Taurus. Longitude is counted 0–360° from the start of Aries.
- Introduces: `ecliptic-longitude`, `zodiac-sign`, `read-longitude`.
- Uses: `back-degree-scale`, `zodiac-scale`.
- Highlights: `zodiac-scale`, `back-degree-scale`.
- Check: `choice(["about 30.4°, start of Taurus" ✓, "about 210.4° (read at the other end of the alidade)", "about 29.6° (counted the ticks backwards)"])`, derived from `back-degree-scale`.

**4 · `find-sun-point` · Find 30.4° on the rete** — D · front
- Purpose: carry the number to the front.
- Instruction: on the rete, the ecliptic carries a degree scale with half-degree ticks. Find 30.4°, a little short of the 30½ tick, and lay the rule over it.
- Demonstration: `ruleRotation` 0 → 28.3 (700 ms); rete stays at 0.
- Stop cue: the edge of the rule's Sun end (its numbered half) crosses the ecliptic at the 30.4° point.
- Meaning: this point *is* the Sun for the whole of 20 April. Call it the Sun's **date point**.
- Introduces: `ecliptic-scale`, `sun-date-point`, `find-sun-point`.
- Uses: `ecliptic`, `ecliptic-longitude`, `lay-rule`.
- Highlights: `ecliptic-scale[longitude=30.5]`, `rule-edge`.
- Check: `frontGeometry(Sun@04-20; rule over Sun ±1)`, derived from `ecliptic-scale`.

**5 · `true-edge` · Use the right edge of the band** — E · front
- Purpose: deal with reading the wrong edge (§3.1.3).
- Instruction: the ecliptic band has two edges. The true ecliptic is the edge that just touches the **Tropic of Cancer** (the smallest circle centred on the pin) at 90° and reaches the **Tropic of Capricorn** (the plate's rim) at 270°. It crosses the **celestial equator** at 0° and 180°. Set the Sun's point on that edge.
- Demonstration: none.
- Stop cue: —
- Meaning: the degree numbers are crowded on one side of the band and spread on the other (the front ring has no sign divisions); that is correct, trust the engraved numbers.
- Introduces: `true-ecliptic-edge`, `tropic-cancer`, `equator`, `tropic-capricorn`.
- Uses: `ecliptic`, `ecliptic-scale`.
- Highlights: `ecliptic-edge`, `tropic-cancer`, `equator`, `tropic-capricorn`.
- Snapshot: rete 310, rule 90 (aside): the band and the rete's equator half-ring clear all three circles' labels. The copy adds that a narrow half-ring on the rete runs along half of the equator.
- Check: none.

**6 · `second-date` · Your turn: 23 October** — T · back
- Purpose: the second worked value.
- Instruction: lay the alidade across **23 October**: three short ticks past the long 20 October tick.
- Demonstration: none. The snapshot starts at 118: 32° from the date line, so a phone's Magnify shows the edge's tip with the tick.
- Stop cue: the edge runs through 23 October.
- Magnify frame: `calendar-scale[date=10-23]` (plus the edge's tip, added by Magnify).
- Meaning: the Sun's place for 23 October is on this line.
- Introduces: —
- Uses: `date-to-longitude`.
- Highlights: `calendar-scale[date=10-23]`.
- Check: `alidadeLongitude(210.1 ±1)` (until FG-4: `angleNear(alidadeRotation, 329.9 ±1)`, with the instruction "use the arm carrying the minute numbers"), derived from `calendar-scale`.

**7 · `read-second` · Read it** — R · back
- Purpose: the second reading.
- Instruction: read the zodiac band and the degree scale at the date end.
- Demonstration: none.
- Stop cue: the edge crosses the zodiac band right at the boundary, with SCO on the far side; on the degree scale it is just past 210°.
- Meaning: about **210.1°**, the start of Scorpio. That is almost exactly opposite 20 April.
- Introduces: —
- Uses: `read-longitude`, `zodiac-sign`.
- Highlights: `back-degree-scale`.
- Check: `choice(["about 210.1°, start of Scorpio" ✓, "about 30.1° (other end)", "about 209.1° (counted one tick short)"])`.

**8 · `find-second-point` · Your turn: find 210.1° on the rete** — T · front
- Purpose: practise; discover opposite points.
- Instruction: lay the rule over the 210.1° point.
- Demonstration: none. The snapshot is rete 0, rule 0.
- Stop cue: the rule's edge crosses the ecliptic just past 210°.
- Meaning: look along the rule: its other half crosses the ecliptic near 30°. Opposite points of the ecliptic always lie on one straight line through the pole.
- Introduces: `opposite-points`.
- Uses: `find-sun-point`, `true-ecliptic-edge`.
- Highlights: `ecliptic-scale[longitude=210]`, `ecliptic-scale[longitude=30.5]`.
- Check: `frontGeometry(Sun@10-23; rule over Sun ±1)` (rule ≈ 208.0), derived from `ecliptic-scale`.

**9 · `sun-place-result` · The Sun's place is the date** — E · front
- Purpose: consolidate and bound the method.
- Instruction:
  - 20 April → 30.4° (Taurus begins);
  - 23 October → 210.1° (Scorpio begins);
  - mid-July → about 112°, near the Cancer edge, where the days are long.

  The engraved calendar is a fixed 365-day year. Old instruments often carry the Julian calendar, which is days out today. Real-instrument note (CO-03): many real retes number the ecliptic sign by sign (0–30 within each sign) rather than 0–360, so 30.4° is 0.4° into Taurus and 210.1° is 0.1° into Scorpio.
- Demonstration: none.
- Stop cue: —
- Meaning: every timing lesson begins here.
- Introduces: —
- Uses: `sun-date-point`.
- Highlights: `ecliptic-ring`.
- Check: none.
- Result: "Result: the Sun's date point is 30.4° on 20 April and 210.1° on 23 October."

---

### Lesson 6 — `solar.time-by-sun.v1` — Tell the time from the Sun's height (keystone)

*Summary:* From a date and a measured Sun height, set the Sun on its height circle on the correct side and read the time on the limb.
*Prerequisites:* `back.measure-altitude.v1`, `front.local-sky.v1`, `back.sun-place.v1`.
*Epoch:* 2026-04-20 (steps 1–6 and 10), 2026-10-23 (steps 7–9 and 11).

| | Worked example 1 | Worked example 2 (transfer) |
|---|---|---|
| Date | 20 Apr 2026 | 23 Oct 2026 |
| Sun's place | 30.4° | 210.1° |
| Given altitude | 30°, morning | 20°, afternoon |
| Side | east (left) | west (right) |
| Rete θ | 332.5 | 243.3 |
| Rule ρ | 55.8 | 324.7 |
| Hour angle | 55.8° before noon | 35.3° after noon |
| **Local apparent time** | **08:17** | **14:21** |
| Sun's azimuth | 110.6° | 217.0° |

**1 · `the-task` · The question and the given data** — E · front
- Purpose: frame the operation (Chaucer, Conclusion 3).
- Instruction: London, 20 April, morning. The Sun was measured at **30°** (Lesson 2) and its date point is **30.4°** (Lesson 5). The method: put the Sun's point on its height circle on the correct side, lay the rule over it, and read the limb.
- Demonstration: none.
- Stop cue: —
- Meaning: two inputs (date, height) give one output (time).
- Introduces: —
- Uses: `sun-date-point`, `altitude`.
- Highlights: `ecliptic-scale[longitude=30.5]`.
- Check: none.

**2 · `set-altitude` · Read the measurement off the alidade** — R · back
- Purpose: start from the measured number, as on a real instrument, and practise reading the alidade (CO-02).
- Instruction: the alidade is where your sighting of the Sun left it. Read the height where its edge crosses the red scale.
- Demonstration: none. Snapshot `alidadeRotation` 30.
- Stop cue: the red number under the alidade's edge.
- Meaning: the reading you will carry to the front is 30°.
- Introduces: —
- Uses: `read-altitude-scale`, `altitude-scale`.
- Highlights: `alidade-edge`, `altitude-scale`.
- Check: `choice("What height does the alidade show?", ["30°" ✓, "150° (black outer degree number)", "60° (distance from the vertical line)"])`.

**3 · `choose-side` · Morning or afternoon?** — R · front
- Purpose: the side-of-sky gate (§3.1.5). In a day the Sun's point crosses each height circle below its noon height twice.
- Instruction: it is morning, so the Sun is still climbing. Which half of the plate does its point go on?
- Demonstration: none. The snapshot turns the rule aside (300°) so it does not lie on the highlighted meridian.
- Stop cue: —
- Meaning: east, the left half. A rising body is east of the meridian; a sinking one is west. The highlighted line runs from the zenith to the due-east point of the horizon.
- Introduces: `side-of-sky`.
- Uses: `east-west`, `meridian-line`, `rising`.
- Highlights: `meridian-line`, `azimuth-line[azimuth=90]`.
- Check: `choice(["east, the left half" ✓, "west, the right half", "on the meridian"])`.

**4 · `set-sun` · Put the Sun on its height circle** — D · front
- Purpose: the central alignment.
- Instruction: turn the rete until the 30.4° point sits on the **30° almucantar**, left of the meridian.
- Demonstration: `reteRotation` 283.3 → 332.5 (900 ms). The Sun's point climbs from the eastern horizon to 30°. The snapshot rule stays aside (300), so the meridian the copy names is not hidden.
- Stop cue: the 30.4° tick touches the 30° circle on the east side.
- Meaning: the whole sky is now set as it stood at the moment of the measurement.
- Introduces: `set-on-almucantar`.
- Uses: `rotate-rete`, `almucantar`, `side-of-sky`, `sun-date-point`.
- Highlights: `ecliptic-scale[longitude=30.5]`, `almucantar[altitude=30]`.
- Check: `frontGeometry(Sun@04-20; pos alt 30.0 / az 110.6 ±1)`, derived from `almucantar`.

**5 · `read-time` · Lay the rule and read the time** — D · front
- Purpose: turn the setting into a time.
- Instruction: lay the rule over the Sun's point. Read the hour where the rule's end on the Sun's side crosses the limb. (The numbers along the rule are a declination scale, which this course uses only to tell the Sun end. On a real rule, which may be numbered on both halves or on neither, the Sun end is simply the half you lay over the Sun.) (CO-15)
- Demonstration: `ruleRotation` 300 → 55.8 (700 ms).
- Stop cue: the rule's Sun end is just past the 8 on the limb's hour scale.
- Meaning: the time is about **08:17 local apparent time**, sundial time, in which 12:00 is when the Sun crosses the meridian.
- Introduces: `read-time`, `local-apparent-time`.
- Uses: `lay-rule`, `limb-hour-scale`.
- Highlights: `rule-edge`, `limb-hour-scale[hour=8]` (the edge only, so the rule's declination numbers are not emphasised).
- Check: `allOf(frontGeometry(Sun@04-20; pos alt 30.0 / az 110.6 ±1), frontGeometry(Sun@04-20; rule over Sun ±1))`, derived from `ecliptic-scale` and `almucantar`.

**6 · `degrees-to-hours` · Check it with the degree ticks** — R · front
- Purpose: degrees and hours (§2.2, Module 5). This is also how to read a limb with no hour numbers.
- Instruction: the sky turns 15° an hour, so 1° of limb is 4 minutes. The rule stands about 56° east of the noon line at the top. How long before noon is that?
- Demonstration: none.
- Stop cue: three hour marks (45°) from 12 back to 9, then about 11 more ticks to the rule: 56°.
- Magnify frame: `limb-hour-scale[hour=12]`, `limb-hour-scale[hour=8]` (the whole count, from the top to the rule).
- Meaning: 55.8° ÷ 15 = 3 h 43 min before noon, which is 08:17. The rule's distance from noon is the Sun's **hour angle**. Real-instrument note (CO-03): if your limb is numbered I–XII twice, the upper XII is noon; if it has only degrees, count from the top as here.
- Introduces: `degrees-to-hours`, `hour-angle`.
- Uses: `limb-degree-scale`, `read-time`.
- Highlights: `limb-degree-scale`, `rule-edge`.
- Check: `choice(["08:17" ✓, "15:43 (counted after noon)", "07:48 (3.72 h taken as 3 h 72 min)"])`.

**7 · `second-altitude` · Your turn, example 2: the measurement** — R · back
- Purpose: transfer; change every surface feature (§4.3).
- Instruction: London, 23 October, afternoon. The Sun's date point is 210.1°. Your sighting has left the alidade in place: read the height it shows.
- Demonstration: none. Snapshot `alidadeRotation` 20.
- Stop cue: the red number under the alidade's edge.
- Meaning: the Sun was 20° high; the same procedure, a different day and side.
- Introduces: —
- Uses: `read-altitude-scale`, `altitude-scale`.
- Highlights: `alidade-edge`, `altitude-scale`.
- Check: `choice(["20°" ✓, "160°", "70°"])`.

**8 · `second-set-sun` · Your turn: set the Sun** — T · front
- Purpose: the learner makes the side decision and the alignment.
- Instruction: it is afternoon. Turn the rete until the 210.1° point sits on the 20° almucantar on the correct side.
- Demonstration: none. The snapshot is rete 208.0 (Sun on the meridian), rule 90 (level, turned aside so it does not cover the Sun's point and the 210 numeral on the meridian; at the solution the Sun's point is 55° from the rule).
- Stop cue: the 210.1° tick touches the 20° circle, right of the meridian.
- Meaning: afternoon Sun is west.
- Introduces: —
- Uses: `set-on-almucantar`, `side-of-sky`.
- Highlights: `ecliptic-scale[longitude=210]`, `almucantar[altitude=20]`.
- Check: `frontGeometry(Sun@10-23; pos alt 20.0 / az 217.0 ±1)`. If the point is put on the east side the check fails; the feedback names the side.

**9 · `second-read-time` · Your turn: read the time** — T · front
- Purpose: complete the transfer.
- Instruction: lay the rule's Sun end over the Sun's point and read the limb.
- Demonstration: none. The snapshot rule is 0 (on the meridian), 35° from the answer, so Magnify can show the tool and the answer together.
- Magnify frame: `ecliptic-scale[longitude=210]`, `limb-hour-scale[hour=14]`, `limb-hour-scale[hour=15]` (the next mark; plus the rule's tip, added by Magnify).
- Stop cue: the Sun end is about a third of the way from 14 to 15.
- Meaning: about **14:21 local apparent time** (35.3° west of noon is 2 h 21 min after noon).
- Introduces: —
- Uses: `read-time`, `degrees-to-hours`.
- Highlights: `ecliptic-scale[longitude=210]`, `limb-hour-scale[hour=14]`.
- Check: `allOf(frontGeometry(Sun@10-23; pos alt 20.0 / az 217.0 ±1), frontGeometry(Sun@10-23; rule over Sun ±1))`.

**10 · `between-circles` · Your turn: a height between the circles** — T · front
- Purpose: set a measurement that falls between two engraved height circles, as most real sightings do (CO-01; uses `interpolate` from Lesson 3).
- Instruction: back to 20 April. A later sighting gave **35°**, halfway between the 30° and 40° circles. Turn the rete until the 30.4° point sits halfway between them, on the east side. Then lay the rule's Sun end over it and read the limb (CO-09).
- Demonstration: none. Snapshot rete 332.5 (Sun on the 30° circle), rule 80 (33° from the answer, clear of the Sun's point).
- Magnify frame: the 30.4° tick, both circles and the limb hours 8 and 9. This does not fit at 2×, so a phone keeps the whole instrument.
- Stop cue: the 30.4° tick sits midway between the 30° and 40° circles, left of the meridian, and the rule's Sun end runs over it, between 8 and 9.
- Meaning: the Sun stands at 35°, and the limb shows about **08:52** (rete 341.3, rule 47.0, azimuth 119.0°).
- Introduces: —
- Uses: `set-on-almucantar`, `interpolate`, `side-of-sky`, `read-time`.
- Highlights: `ecliptic-scale[longitude=30.5]`, `almucantar[altitude=30]`, `almucantar[altitude=40]`.
- Check: `allOf(frontGeometry(Sun@04-20; pos alt 35.0 / az 119.0 ±1), frontGeometry(Sun@04-20; rule over Sun ±1))`; solution rete 341.3, rule 47.0.

**11 · `time-result` · What you have, and how good it is** — E · front
- Purpose: interpret, and give the accuracy warnings.
- Instruction: 08:17 and 14:21 are **sundial times**, not your watch's; Lesson 9 converts them. Avoid measuring within about 1½ hours of noon. On 20 April a 1° error in height is about 7 minutes at 30°, but the Sun rises less than 2° in the whole last hour before noon (48.3° at 11:00, 50.1° at noon), so near noon a small error becomes a large one.
- Demonstration: none.
- Stop cue: —
- Meaning: this is Chaucer's Conclusion 3, the use the instrument was built for.
- Introduces: `near-noon-accuracy`.
- Uses: `local-apparent-time`, `almucantar`.
- Highlights: `meridian-line`.
- Check: none.
- Result: "Result: 20 April, 30° morning Sun → 08:17; 23 October, 20° afternoon Sun → 14:21 local apparent time."

---

### Lesson 7 — `solar.events.v1` — Find sunrise, noon, sunset and the length of the day

*Summary:* Carry the Sun's date point to the eastern horizon, the meridian and the western horizon, and read the times, the noon height and the day length.
*Prerequisites:* `solar.time-by-sun.v1`.
*Epoch:* 2026-04-20 (steps 1–5), 2026-10-23 (steps 6–8).

| | 20 April | 23 October |
|---|---|---|
| Sunrise (rete / rule / azimuth) | **05:00** (283.3 / 105.0 / 71.1°) | **06:59** (132.8 / 75.2 / 108.7°) |
| Noon (rete / rule / altitude) | 12:00 (28.3 / 0 / **50.1°**) | 12:00 (208.0 / 0 / 27.0°) |
| Sunset (rete / rule / azimuth) | **19:00** (133.3 / 255.0 / 288.9°) | **17:01** (283.2 / 284.8 / 251.3°) |
| Day length | **14 h 00 min** | **10 h 01 min** |

**1 · `horizon-is-zero` · Sunrise is altitude 0°** — E · front
- Purpose: reuse the keystone with a new height.
- Instruction: sunrise is the moment the Sun's point reaches the horizon (the 0° height circle) on the east side, and sunset is the same on the west. Use 30.4° for 20 April.
- Demonstration: none (snapshot rete 332.5, the end of Lesson 6's first example; rule 300, turned aside so it does not cover the 30.4° tick).
- Stop cue: —
- Meaning: no new parts are needed.
- Introduces: —
- Uses: `horizon`, `sun-date-point`, `side-of-sky`.
- Highlights: `horizon`, `ecliptic-scale[longitude=30.5]`.
- Check: none.

**2 · `find-sunrise` · Sunrise** — D · front
- Purpose: demonstrate the horizon setting.
- Instruction: turn the rete back (anticlockwise) until the Sun's point sits on the eastern horizon. Lay the rule over it and read the limb.
- Demonstration: `reteRotation` 332.5 → 283.3, with companion `ruleRotation` 55.8 → 105.0 (900 ms).
- Stop cue: the 30.4° tick is on the horizon, left side; the Sun end of the rule is at 5.
- Meaning: sunrise is at **05:00** local apparent time, in the east-north-east (azimuth about 71°).
- Introduces: `sunrise`.
- Uses: `set-on-almucantar`, `read-time`.
- Highlights: `horizon`, `limb-hour-scale[hour=5]`.
- Check: `allOf(frontGeometry(Sun@04-20; pos alt 0.0 / az 71.1 ±1), frontGeometry(Sun@04-20; rule over Sun ±1))`, derived from `horizon` and `ecliptic-scale`.

**3 · `find-noon` · Your turn: noon and the noon height** — T · front
- Purpose: the meridian crossing.
- Instruction: turn the rete clockwise until the Sun's point crosses the meridian. Lay the rule over it. Read the time and the Sun's height.
- Demonstration: none.
- Stop cue: the point is on the meridian line; the rule points straight up at 12.
- Meaning: local apparent **noon is 12:00** by definition. The Sun's point sits on the 50° circle, so the noon height is about **50°** (computed 50.1°), read from the instrument; no declination is quoted, since the course never introduces it.
- Introduces: `local-noon`, `noon-altitude`.
- Uses: `meridian-line`, `read-alt-az`, `read-time`.
- Demonstration: none. The snapshot rule is 320 (it lay over the Sun's tick at sunrise), 40° from the answer.
- Highlights: `ecliptic-scale[longitude=30.5]`, `meridian-line`, `almucantar[altitude=50]`.
- Check: `allOf(frontGeometry(Sun@04-20; pos alt 50.1 / az 180.0 ±1), frontGeometry(Sun@04-20; rule over Sun ±1))`.

**4 · `find-sunset` · Your turn: sunset** — T · front
- Purpose: complete the day.
- Instruction: continue clockwise to the western horizon; lay the rule and read it.
- Demonstration: none.
- Stop cue: the point is on the horizon, right side; the Sun end is at 19.
- Meaning: sunset is at **19:00**, in the west-north-west (azimuth about 289°).
- Introduces: `sunset`.
- Uses: `read-time`, `horizon`.
- Demonstration: none. The snapshot rule is 300 (it lay on the Sun's tick on the meridian), 45° from the answer.
- Highlights: `ecliptic-scale[longitude=30.5]`, `horizon`, `limb-hour-scale[hour=19]`.
- Check: `allOf(frontGeometry(Sun@04-20; pos alt 0.0 / az 288.9 ±1), frontGeometry(Sun@04-20; rule over Sun ±1))`.

**5 · `day-length` · How long is the day?** — R · front
- Purpose: day length is a difference of two readings (Chaucer, Conclusion 7).
- Instruction: how long is the Sun above the horizon on 20 April?
- Demonstration: none.
- Stop cue: —
- Meaning: 19:00 − 05:00 = **14 h 00 min**. The rule swept 14 hour-spaces of 15° each round the limb, 210° in all (phrased as derived, not read off the unnumbered ticks).
- Introduces: `day-length`.
- Uses: `sunrise`, `sunset`, `degrees-to-hours`.
- Highlights: `limb-degree-scale`.
- Check: `choice(["14 h 00 min" ✓, "10 h 00 min", "7 h 00 min (from noon only)"])`.

**6 · `second-sunrise` · Your turn: sunrise on 23 October** — T · front
- Purpose: the second worked value.
- Instruction: use the 210.1° point, on the meridian at the moment: note its height there, just under the 30° circle. Find sunrise.
- Demonstration: none. The snapshot is rete 208.0, rule 300 (aside, so the Sun's point on the meridian is visible), epoch 2026-10-23.
- Stop cue: the 210.1° tick is on the eastern horizon.
- Meaning: sunrise is at about **06:59**, in the east-south-east (azimuth about 109°).
- Introduces: —
- Uses: `sunrise`, `read-time`, `noon-altitude`.
- Highlights: `horizon`, `ecliptic-scale[longitude=210]`.
- Check: `allOf(frontGeometry(Sun@10-23; pos alt 0.0 / az 108.7 ±1), frontGeometry(Sun@10-23; rule over Sun ±1))`.

**7 · `second-sunset` · Your turn: sunset and day length** — T · front
- Purpose: complete the second value.
- Instruction: find sunset and work out the day length.
- Demonstration: none.
- Stop cue: the 210.1° tick is on the western horizon.
- Meaning: sunset is at about **17:01**; the day is about **10 h 01 min**, and the noon height only 27°.
- Introduces: —
- Uses: `sunset`, `day-length`, `noon-altitude`.
- Demonstration: none. The snapshot rule is 0 (it lay on the Sun's tick at sunrise), 75° from the answer.
- Highlights: `ecliptic-scale[longitude=210]`, `horizon`, `limb-hour-scale[hour=17]`.
- Check: `allOf(frontGeometry(Sun@10-23; pos alt 0.0 / az 251.3 ±1), frontGeometry(Sun@10-23; rule over Sun ±1))`.

**8 · `interpret-day` · Compare the two days** — E · front
- Purpose: interpret, and give the real-sky caveat.
- Instruction: in April the Sun rises north of east (71°) and the day is 14 h. In October it rises south of east (109°) and the day is 10 h. The astrolabe's horizon is a perfect geometric line: the real Sun's upper edge, lifted by the air, appears a few minutes before the 05:00 and 06:59 found here, and lingers a few minutes after sunset.
- Demonstration: none. Snapshot: the October sunrise (rete 132.8), rule 330 (aside), so the Sun's point visibly sits just south of east, between the highlighted 90° and 120° lines.
- Stop cue: —
- Meaning: the rising direction and the day length both follow from the Sun's place.
- Introduces: `rising-azimuth`, `geometric-horizon`.
- Uses: `sunrise`, `azimuth-line`, `day-length`.
- Highlights: `horizon`, `azimuth-line[azimuth=90]`, `azimuth-line[azimuth=120]`.
- Check: none.
- Result: "Result: 20 April: 05:00–19:00, 14 h; 23 October: 06:59–17:01, 10 h 01 min (local apparent time, geometric horizon)."

---

### Lesson 8 — `night.time-by-star.v1` — Tell the time at night from a star

*Summary:* Set a measured star on its height circle, then read the time at the Sun's hidden date point.
*Prerequisites:* `front.read-star.v1`, `solar.time-by-sun.v1`.
*Epoch:* 2026-04-20 (steps 1–5), 2026-10-23 (steps 6–9).

| | Worked example 1 | Worked example 2 |
|---|---|---|
| Date and star | 20 April, **Arcturus** | 23 October, **Vega** |
| Given altitude and side | **40°**, east (rising) | **50°**, west (after culmination) |
| Star azimuth | 111.5° | 273.9° |
| Rete θ / rule ρ (over the Sun) | 164.9 / 223.4 | 334.6 / 233.4 |
| Sun's altitude at that moment | −16.6° | −31.3° |
| **Local apparent time** | **21:06** | **20:26** |

**1 · `night-problem` · No Sun to measure** — E · front
- Purpose: frame the variation (Chaucer, Conclusion 3, night part).
- Instruction: at night you measure a bright star you can recognise. The given data: 20 April, evening, Arcturus just measured (its height is read off the alidade in step 2), still in the east and climbing.
- Demonstration: none.
- Stop cue: —
- Meaning: the star sets the sky; the Sun still gives the time.
- Introduces: —
- Uses: `star-pointer`, `side-of-sky`.
- Highlights: `star-pointer[star=arcturus]`.
- Check: none.

**2 · `star-altitude` · Read the measurement off the alidade** — R · back
- Purpose: the given measurement, read off the alidade as a sighting leaves it (CO-02).
- Instruction: the alidade is where your sighting of Arcturus left it. Read the height on the red scale.
- Demonstration: none. Snapshot `alidadeRotation` 40.
- Stop cue: the red number under the alidade's edge.
- Meaning: Arcturus's height is 40°.
- Introduces: —
- Uses: `read-altitude-scale`, `altitude-scale`.
- Highlights: `alidade-edge`, `altitude-scale`.
- Check: `choice(["40°" ✓, "140° (black outer degree number)", "50° (distance from the vertical line)"])`.

**3 · `set-star` · Put the star on its height circle** — D · front
- Purpose: the same alignment as with the Sun, but with a star pointer.
- Instruction: turn the rete until Arcturus's tip sits on the **40°** almucantar on the east side.
- Demonstration: `reteRotation` 120 → 164.9 (900 ms).
- Stop cue: the tip touches the 40° circle, left of the meridian.
- Meaning: the sky is set for the moment of the measurement.
- Introduces: —
- Uses: `set-on-almucantar`, `side-of-sky`.
- Highlights: `star-pointer[star=arcturus]`, `almucantar[altitude=40]`.
- Check: `frontGeometry(Arcturus; pos alt 40.0 / az 111.5 ±1)`, derived from `almucantar`.

**4 · `where-to-read` · Where do you read the time?** — R · front
- Purpose: deal with the star-versus-Sun reference (§3.1.8).
- Instruction: you could now lay the rule over Arcturus, over the 40° circle, or over the Sun's date point (30.4°, now below the horizon). Which gives the time?
- Demonstration: none.
- Stop cue: —
- Meaning: always the Sun's point. Clock hours count the Sun's turning, not a star's.
- Introduces: `time-from-sun-point`.
- Uses: `sun-date-point`, `local-apparent-time`.
- Highlights: `ecliptic-scale[longitude=30.5]`, `star-pointer[star=arcturus]`.
- Check: `choice(["over the Sun's date point, even below the horizon" ✓, "over Arcturus", "where the 40° circle meets the meridian"])`.

**5 · `read-at-sun` · Read the time at the Sun's point** — D · front
- Purpose: complete example 1.
- Instruction: without moving the rete, lay the rule's Sun end over the 30.4° point and read it on the limb. The rule starts level (90), as in L8#1–4, so the meridian and its crossing with the 40° circle stay visible.
- Demonstration: `ruleRotation` 0 → 223.4 (700 ms).
- Stop cue: the Sun end is just past 21.
- Meaning: the time is about **21:06** local apparent time. The Sun is well below the north-western horizon (about 17°, deeper than the plate's height circles go), so it is getting dark.
- Introduces: —
- Uses: `read-time`, `time-from-sun-point`.
- Highlights: `ecliptic-scale[longitude=30.5]`, `limb-hour-scale[hour=21]`.
- Check: `allOf(frontGeometry(Arcturus; pos alt 40.0 / az 111.5 ±1), frontGeometry(Sun@04-20; rule over Sun ±1))`.

**6 · `second-star-altitude` · Your turn, example 2: Vega** — R · back
- Purpose: transfer: a different star, season and side.
- Instruction: 23 October, evening. Vega has been measured in the west, past its highest point. Read the height your sighting left on the alidade.
- Demonstration: none. Snapshot `alidadeRotation` 50.
- Stop cue: the red number under the alidade's edge.
- Meaning: Vega's height is 50°.
- Introduces: —
- Uses: `read-altitude-scale`, `altitude-scale`.
- Highlights: `alidade-edge`, `altitude-scale`.
- Check: `choice(["50°" ✓, "130°", "40°"])`.

**7 · `second-set-star` · Your turn: set Vega** — T · front
- Purpose: the learner's alignment.
- Instruction: put Vega's tip on the 50° almucantar on the west side.
- Demonstration: none. The snapshot is rete 279.2 (Vega on the meridian), rule 60 (turned aside, off Vega and off its western target).
- Stop cue: the tip touches the 50° circle, right of the meridian.
- Meaning: Vega is circumpolar (Lesson 4), so "west" here means after it has culminated.
- Introduces: —
- Uses: `set-on-almucantar`, `circumpolar`.
- Highlights: `star-pointer[star=vega]`, `almucantar[altitude=50]`.
- Check: `frontGeometry(Vega; pos alt 50.0 / az 273.9 ±1)`.

**8 · `second-read` · Your turn: read the time** — T · front
- Purpose: complete the transfer.
- Instruction: lay the rule's Sun end over the Sun's 210.1° point and read the limb.
- Demonstration: none. The snapshot rule is 282: 49° (mod 180°) from the answer 233.4, clear of Vega, so the step does not look solved either way round and Magnify can show the tool and the answer together.
- Magnify frame: `ecliptic-scale[longitude=210]`, `limb-hour-scale[hour=20]`, `limb-hour-scale[hour=21]` (the next mark; plus the rule's tip).
- Stop cue: the Sun end is a little under halfway from 20 to 21.
- Meaning: the time is about **20:26** local apparent time.
- Introduces: —
- Uses: `read-time`, `time-from-sun-point`.
- Highlights: `ecliptic-scale[longitude=210]`, `limb-hour-scale[hour=20]`.
- Check: `allOf(frontGeometry(Vega; pos alt 50.0 / az 273.9 ±1), frontGeometry(Sun@10-23; rule over Sun ±1))`.

**9 · `night-result` · Night readings and the real sky** — E · front
- Purpose: interpret, and set homework.
- Instruction: 21:06 and 20:26 are again sundial times. In the real sky the hard part is recognising the star; start with one or two unmistakable stars. Avoid stars near the meridian, for the same reason as the noon Sun.
- Demonstration: none.
- Stop cue: —
- Meaning: any star on the rete is a night clock.
- Introduces: —
- Uses: `near-noon-accuracy`, `local-apparent-time`.
- Highlights: `rete`.
- Check: none.
- Result: "Result: Arcturus 40° east on 20 April → 21:06; Vega 50° west on 23 October → 20:26 local apparent time."

---

### Lesson 9 — `back.equation-time.v1` — Turn astrolabe time into the time on your watch

*Summary:* Read the equation of time for the date on the back, then apply it, the longitude correction and summer time to turn sundial time into clock time.
*Prerequisites:* `back.sun-place.v1`, `solar.time-by-sun.v1`.
*Epoch:* 2026-04-20 (steps 1–5), 2026-10-23 (steps 6–10).

| | Example 1 (20 April) | Example 2 (23 October) |
|---|---|---|
| Astrolabe reading (Lesson 6) | 08:17 local apparent time (LAT) | 14:21 LAT |
| Equation of time (apparent − mean), read on the loop | **+1 min** (0.99) | **+16 min** (15.78) |
| Local mean time = LAT − equation | 08:16 | 14:05 |
| London 0.12° W: + 4 min per degree west = +0.5 min (does not change the minute) | 08:16 GMT | 14:05 GMT |
| British Summer Time (+1 h; in force 29 Mar–25 Oct 2026) | **09:16** | **15:05** |
| Longitude drill: same reading in Bristol (2.6° W, +10.4 min ≈ 10 min) | — | 14:15 GMT → **15:15 BST** |

The copy works the chain in whole minutes from the sundial time read to the minute (`WATCH` in catalog.ts), so every sum shown gives the answer shown (L09-05-a, L09-09-a). Carrying the fractions instead (`CLOCK_TIME`: 14:05.74 GMT, 14:15.66 in Bristol) gives 15:06 and 15:16, within a minute; the lesson quotes the whole-minute values.

**1 · `three-differences` · Why your watch disagrees** — E · back
- Purpose: deal with "the astrolabe tells clock time" (§3.1.4).
- Instruction: the astrolabe gives sundial time for your exact place. Your watch keeps one even time for a whole zone, set by the zone's meridian (Greenwich for Britain, 15° E for central Europe), plus an hour in summer. There are three corrections: the equation of time, your longitude, and summer time.
- Demonstration: none.
- Stop cue: —
- Meaning: they can work against each other. In late October the sundial is a quarter of an hour fast but summer time puts the watch an hour ahead, so the watch is only about three quarters of an hour ahead (14:21 → 15:05). In late July (equation −6.6 min on 26 July) the watch is over an hour ahead.
- Introduces: —
- Uses: `local-apparent-time`.
- Highlights: `eot-curve`.
- Check: none.

**2 · `eot-loop` · The equation-of-time loop** — E · back
- Purpose: introduce the quantity and how it is engraved.
- Instruction: the Sun's noon runs up to about 16 minutes early or 14 minutes late during the year. The **equation of time** is sundial time minus even (mean) time. On this back it is the loop; read it against the **minute scale** on the alidade's arm. The zero mark is the minute scale's 0; points outside the zero mark are positive (sundial ahead).
- Demonstration: none.
- Stop cue: —
- Meaning: each date's point on the loop gives that day's correction. Real-instrument note (CO-03): most real astrolabes have no loop; use a printed table. Approximate mid-month values 2026, sundial minus mean time, minutes (also in the Reference tab): Jan −9, Feb −14, Mar −10, Apr 0, May +4, Jun 0, Jul −6, Aug −5, Sep +5, Oct +14, Nov +15, Dec +5.
- Introduces: `equation-of-time`, `alidade-minute-scale`.
- Uses: `eot-curve`, `alidade`.
- Highlights: `eot-curve`, `alidade-minute-scale`.
- Check: none.

**3 · `lay-minute-arm` · Lay the minute arm over the date** — D · back
- Purpose: the arm carrying the minute scale must lie on the date's side.
- Instruction: turn the alidade so that the **arm carrying the minute numbers** runs through 20 April on the calendar ring.
- Demonstration: `alidadeRotation` 0 → 149.6 (700 ms).
- Stop cue: the minute arm's edge passes through the 20 April tick and crosses the loop.
- Meaning: where the loop crosses the minute scale is today's equation.
- Introduces: —
- Uses: `date-to-longitude`, `alidade-minute-scale`.
- Highlights: `calendar-scale[date=04-20]`, `alidade-minute-scale`.
- Check: `angleNear(alidadeRotation, 149.6 ±1)` (exact orientation; the other arm has no minute scale), derived from `calendar-scale`.

**4 · `read-eot` · Read the equation** — R · back
- Purpose: get the number.
- Instruction: read the minute scale where the loop crosses it. The numbers are upside down here: outward from 0 is plus.
- Demonstration: none.
- Stop cue: the loop crosses just outside the 0 mark, at the first minute tick (FG-2 adds 1-minute ticks).
- Meaning: about **+1 minute**: the sundial is 1 minute ahead of even time.
- Introduces: `read-eot`.
- Uses: `alidade-minute-scale`, `equation-of-time`.
- Highlights: `eot-curve`, `alidade-minute-scale`.
- Check: `choice(["+1 min" ✓, "−1 min (sign read the wrong way)", "+15 min (read on the far side of the loop)"])`, derived from `alidade-minute-scale`.

**5 · `apply-corrections` · From 08:17 to your watch** — R · back
- Purpose: apply all three corrections to worked example 1.
- Instruction:
  1. Subtract the equation: 08:17 − 1 min = 08:16 local mean time.
  2. Longitude: London is 0.12° west of Greenwich; each degree is 4 minutes, and west means add, so +0.5 min, which does not change the minute: still 08:16 GMT.
  3. Summer time is in force on 20 April: +1 h.

  What does your phone say?
- Demonstration: none.
- Stop cue: —
- Meaning: **09:16 BST**.
- Introduces: `local-mean-time`, `longitude-correction`, `summer-time`.
- Uses: `read-eot`, `degrees-to-hours`.
- Highlights: `eot-curve`.
- Check: `choice(["09:16" ✓, "08:16 (forgot summer time)", "09:18 (added the equation instead of subtracting it)"])`.

**6 · `second-minute-arm` · Your turn: 23 October** — T · back
- Purpose: the second worked value, with a large correction.
- Instruction: lay the minute arm over 23 October. It will point into the lower right, across the shadow square, almost opposite where it pointed for 20 April.
- Demonstration: none. The snapshot starts at 0 (level). Left at the 20 April setting (149.6), the other arm would lie over the 23 October tick and hide it.
- Stop cue: the minute arm's edge passes through 23 October.
- Meaning: 23 October is almost opposite 20 April on the ring, which is why the arm has swung round.
- Introduces: —
- Uses: `date-to-longitude`, `alidade-minute-scale`.
- Highlights: `calendar-scale[date=10-23]`.
- Check: `angleNear(alidadeRotation, 329.9 ±1)`.

**7 · `second-read-eot` · Your turn: read the equation** — R · back
- Purpose: the second reading.
- Instruction: read the loop against the minute scale.
- Demonstration: none.
- Stop cue: the loop crosses just beyond the +15 mark (FG-2 extends the scale to +20).
- Meaning: about **+16 minutes**; the sundial is a quarter of an hour fast.
- Introduces: —
- Uses: `read-eot`.
- Highlights: `alidade-minute-scale`.
- Check: `choice(["+16 min" ✓, "−16 min", "+1 min"])`.

**8 · `second-apply` · Your turn: from 14:21 to your watch** — R · back
- Purpose: complete the transfer.
- Instruction: start from Lesson 6's 14:21 and apply the three corrections. BST is still in force on 23 October 2026; it ends on 25 October.
- Demonstration: none.
- Stop cue: —
- Meaning: 14:21 − 16 = 14:05; + 0.5 min does not change the minute, so 14:05 GMT; + 1 h = **15:05 BST**.
- Introduces: —
- Uses: `local-mean-time`, `longitude-correction`, `summer-time`.
- Highlights: `eot-curve`.
- Check: `choice(["15:05" ✓, "15:37 (added the equation)", "14:05 (forgot summer time)"])`.

**9 · `longitude-drill` · Same reading, another town** — R · back
- Purpose: make the longitude correction visible; it is small in London.
- Instruction: Bristol is at almost the same latitude (51.45° N, so the same plate) but 2.6° W. If the 23 October reading of 14:21 had been made there, what would the phone say?
- Demonstration: none.
- Stop cue: —
- Meaning: 2.6 × 4 = 10.4 min, about 10 min, so 14:05 + 10 min = 14:15 GMT, which is **15:15 BST**.
- Introduces: —
- Uses: `longitude-correction`.
- Highlights: none.
- Check: `choice(["15:15" ✓, "14:55 (subtracted for west)", "15:05 (London's answer)"])`.

**10 · `eot-result` · The full chain** — E · back
- Purpose: consolidate, and give the first real-sky homework.
- Instruction: astrolabe time − equation → local mean time; + 4 min per degree west (− per degree east) → zone time; + summer hour → watch.

  For a first real session: on a clear morning at least 1½ h from noon, measure the Sun three times and average, work out the time, convert it, and compare with your phone. Within about ±10 min is a good result for a hand-held instrument.
- Demonstration: none.
- Stop cue: —
- Meaning: the astrolabe has become a watch.
- Introduces: —
- Uses: `local-mean-time`, `near-noon-accuracy`.
- Highlights: `eot-curve`.
- Check: none.
- Result: "Result: 08:17 → 09:16 BST on 20 April; 14:21 → 15:05 BST on 23 October (15:15 in Bristol)."

---

### Lesson 10 — `front.unequal-hours.v1` — Tell the seasonal (unequal) hour

*Summary:* Divide the day into twelve seasonal hours, then use the Sun's opposite point and the hour lines under the horizon to find when an hour ends.
*Prerequisites:* `back.sun-place.v1`, `solar.events.v1`.
*Epoch:* 2026-04-20 (steps 1–5), 2026-10-23 (steps 6–8).

| | 20 April | 23 October |
|---|---|---|
| Day length (Lesson 7) | 14 h 00 min | 10 h 01 min |
| One seasonal hour = day ÷ 12 | **70 min** | **50 min** |
| Example | end of hour III | end of hour IX |
| Sun's opposite point | 210.4° | 30.1° |
| Rete / rule | 335.8 / 52.5 | 245.6 / 322.4 |
| Opposite point: altitude / azimuth | −31.9° / 293.7° | −19.1° / 39.2° |
| **Local apparent time** | **08:30** (= 05:00 + 3 × 70 min) | **14:30** (= 06:59 + 9 × 50 min) |

**1 · `temporal-hours` · Hours that stretch with the season** — R · front
- Purpose: derive the hour before showing the lines (§3.1.6).
- Instruction: medieval "hours of the day" split sunrise to sunset into 12 equal parts. On 20 April the day is 14 h, so each hour is 70 min. How long is one on 23 October?
- Demonstration: none.
- Stop cue: —
- Meaning: 10 h ÷ 12 = **50 min**. The 6th hour always ends at noon (sundial time).
- Introduces: `unequal-hour`.
- Uses: `day-length`, `sunrise`, `sunset`.
- Highlights: none.
- Check: `choice(["about 50 min" ✓, "60 min", "about 70 min"])`.

**2 · `hour-lines` · The hour lines under the horizon** — E · front
- Purpose: name the engraving.
- Instruction: below the horizon the plate carries 11 curved **unequal-hour lines**, numbered I–XI (FG-2). They run from the western horizon (0) round to the eastern horizon (XII); line VI lies on the meridian below the pole.
- Demonstration: none. Snapshot rete 245.6 (the end-of-hour-nine angle, which leaves the western starts of lines I–III clear of the ecliptic ring), rule 330 (aside, off line VI), epoch 2026-04-20.
- Stop cue: —
- Meaning: they divide the hidden half of the sky into twelve parts.
- Introduces: `unequal-hour-line`.
- Uses: `horizon`, `meridian-line`.
- Highlights: `unequal-hour-line`, `unequal-hour-line[hour=6]`.
- Check: none.

**3 · `opposite-point` · Use the Sun's opposite point** — E · front
- Purpose: the trick that makes the lines usable by day.
- Instruction: by day the Sun is above the horizon, where there are no hour lines. Use the point exactly opposite it on the ecliptic, its **nadir**. For 30.4° that is 210.4°. As in Lesson 5, the rule laid over the Sun also crosses it.
- Demonstration: none (snapshot rete 283.3, sunrise; rule 330, turned aside so the 210.4° tick and its numeral are visible; the copy says a rule laid over the Sun would cross it, as in Lesson 5).
- Stop cue: —
- Meaning: when the Sun has done three hours of its day arc, its nadir has done three hours of the night arc.
- Introduces: `sun-nadir-point`.
- Uses: `opposite-points`, `sun-date-point`, `rule`.
- Highlights: `ecliptic-scale[longitude=210.5]`.
- Check: none.

**4 · `end-of-hour-three` · Turn to the end of hour III** — D · front
- Purpose: demonstrate the setting.
- Instruction: turn the rete clockwise, moving the rule with it, until the opposite point (210.4°) sits on line **III**: the third line counting from the western horizon.
- Demonstration: `reteRotation` 283.3 → 335.8, with companion `ruleRotation` 105.0 → 52.5 (900 ms).
- Stop cue: the 210.4° tick is on line III.
- Magnify frame: `ecliptic-scale[longitude=208.5]`, `ecliptic-scale[longitude=212.5]` (the opposite point, where line III and the rule cross it).
- Meaning: the third seasonal hour of 20 April is ending, and the rule's Sun end still runs through the Sun's 30.4° point.
- Introduces: —
- Uses: `unequal-hour-line`, `sun-nadir-point`, `rotate-rete`, `lay-rule`.
- Highlights: `unequal-hour-line[hour=3]`, `ecliptic-scale[longitude=210.5]`.
- Check: `allOf(frontGeometry(Nadir@04-20; pos alt −31.9 / az 293.7 ±1), frontGeometry(Sun@04-20; rule over Sun ±1))`, derived from `unequal-hour-line` and `ecliptic-scale`.

**5 · `read-hour-three` · Read the equal time** — R · front
- Purpose: convert to ordinary hours.
- Instruction: read the rule's Sun end on the limb.
- Demonstration: none.
- Stop cue: the Sun end is at 8½.
- Meaning: **08:30**, which matches 05:00 + 3 × 70 min. Lesson 6's 08:17 was just before the end of hour III.
- Introduces: —
- Uses: `read-time`, `unequal-hour`.
- Highlights: `limb-hour-scale[hour=8]`.
- Check: `choice(["08:30" ✓, "20:30 (read at the nadir's end of the rule)", "09:30"])`.

**6 · `end-of-hour-nine` · Your turn: hour IX on 23 October** — T · front
- Purpose: the second worked value, in the afternoon.
- Instruction: the Sun is at 210.1°, so its opposite point is 30.1°. Set the opposite point on line **IX**: the third line after VI, toward the eastern horizon. Keep the rule over the Sun.
- Demonstration: none. The snapshot is rete 208.0, rule 0, epoch 2026-10-23.
- Stop cue: the 30.1° tick is on line IX; the rule runs through 210.1°.
- Meaning: the ninth seasonal hour of 23 October is ending.
- Introduces: —
- Uses: `unequal-hour-line`, `sun-nadir-point`, `rotate-rete`, `lay-rule`.
- Highlights: `unequal-hour-line[hour=9]`.
- Check: `allOf(frontGeometry(Nadir@10-23; pos alt −19.1 / az 39.2 ±1), frontGeometry(Sun@10-23; rule over Sun ±1))`.

**7 · `read-hour-nine` · Your turn: read it** — R · front
- Purpose: complete the transfer.
- Instruction: read the limb at the Sun end.
- Demonstration: none.
- Stop cue: —
- Meaning: **14:30**, which matches 06:59 + 9 × 50 min.
- Introduces: —
- Uses: `read-time`.
- Highlights: `limb-hour-scale[hour=14]`.
- Check: `choice(["14:30" ✓, "15:59 (assumed 60-min hours from sunrise)", "02:30"])`.

**8 · `unequal-result` · Same hour, different clock** — E · front
- Purpose: interpret.
- Instruction: "the end of the third hour" was 08:30 in April. In October it would be about half past nine: sunrise at 06:59 plus three hours of about 50 minutes (09:30 unrounded; the copy says "about half past nine" so the rounded sum, 09:29, also fits). The church and the market kept these hours. The back's horary quadrant does the same job from a height measurement alone (not covered in this course).
- Demonstration: none.
- Stop cue: —
- Meaning: seasonal hours are fractions of daylight, not fixed lengths.
- Introduces: —
- Uses: `unequal-hour`, `horary-quadrant`.
- Highlights: `unequal-hour-line`.
- Check: none.
- Result: "Result: 20 April hour III ends at 08:30; 23 October hour IX ends at 14:30 local apparent time."

---

### Lesson 11 — `front.set-sky.v1` — Set the sky for a date and clock time: what is up tonight?

*Summary:* Undo the clock corrections, set the rule to the sundial time, turn the Sun's date point under it, and read which stars are up.
*Prerequisites:* `night.time-by-star.v1`, `back.equation-time.v1`.
*Epoch:* 2026-10-23 (steps 1–4), 2026-04-20 (steps 5–9).

| | Example 1 | Example 2 |
|---|---|---|
| Question | 23 Oct, 21:00 BST | 20 Apr, 22:00 BST |
| − summer hour → GMT | 20:00 | 21:00 |
| London's 0.5 min (whole minutes, as in L9: no change) → local mean time | 20:00 | 21:00 |
| + equation → LAT | + 16 → **20:16** | + 1 → **21:01** |
| Rule ρ / rete θ | 236.0 / 332.0 | 224.75 / 163.6 |
| What is up (altitude, azimuth) | Vega 52° W (272°); Deneb 74° (255°); Altair 39° SW (226°); Capella 26° NE (47°) | Arcturus 39° ESE (110°); Regulus 49° S (197°); Vega 16° NE (47°) |

**1 · `reverse-problem` · From the watch back to the astrolabe** — R · front
- Purpose: run Lesson 9 backwards.
- Instruction: what will be up at 21:00 BST tonight, 23 October? Undo each correction in reverse order, in whole minutes: take off the summer hour; London's half minute of longitude does not change the minute; then add the equation (+16).
- Demonstration: none.
- Stop cue: —
- Meaning: 20:00 GMT + 16 min: about **20:16** local apparent time.
- Introduces: —
- Uses: `summer-time`, `longitude-correction`, `local-mean-time`, `equation-of-time`.
- Highlights: none.
- Check: `choice(["20:16" ✓, "19:44 (subtracted the equation)", "21:16 (kept summer time)"])`.

**2 · `set-time` · Set the rule to the time** — D · front
- Purpose: the rule can stand for a time before the sky is set.
- Instruction: 20:16 is 8 h 16 min after noon, so the Sun's hour angle is about 124° west of the noon line (reusing `hour-angle` from Lesson 6, CO-06). Turn the rule until its Sun end points to 20:16 on the limb: a quarter of the way from 20 to 21.
- Demonstration: `ruleRotation` 0 → 236.0 (700 ms).
- Stop cue: the Sun end is at 20¼.
- Meaning: the rule now marks the moment you asked about.
- Introduces: `set-time`.
- Uses: `lay-rule`, `limb-hour-scale`, `degrees-to-hours`, `hour-angle`.
- Highlights: `rule`, `limb-hour-scale[hour=20]`.
- Check: `angleNear(ruleRotation, 236.0 ±1)`, derived from `limb-hour-scale`.

**3 · `set-sky` · Bring the Sun under the rule** — D · front
- Purpose: orient the whole sky.
- Instruction: without moving the rule, turn the rete until the Sun's 210.1° point lies under the rule.
- Demonstration: `reteRotation` 208.0 → 332.0 (900 ms).
- Stop cue: the 210.1° tick is on the edge of the rule's Sun end, below the western horizon.
- Meaning: every star pointer now stands where that star will be at 21:00 BST.
- Introduces: `set-sky-for-time`.
- Uses: `rotate-rete`, `sun-date-point`, `time-from-sun-point`.
- Highlights: `ecliptic-scale[longitude=210]`, `rule-edge`.
- Check: `allOf(angleNear(ruleRotation, 236.0 ±1), frontGeometry(Sun@10-23; rule over Sun ±1))`.

**4 · `read-sky` · What is up?** — R · front
- Purpose: use the setting.
- Instruction: read Vega's height and direction; then find Deneb, Altair and Capella, also marked.
- Demonstration: none.
- Stop cue: —
- Meaning: Vega is about 52° up in the west. Deneb is nearly overhead, Altair is low in the south-west, and Capella is rising in the north-east. Lesson 8 found Vega at 50° at 20:26; it is sinking, so that fits.
- Introduces: —
- Uses: `read-alt-az`.
- Highlights: `star-pointer[star=vega]`, `star-pointer[star=deneb]`, `star-pointer[star=altair]`, `star-pointer[star=capella]`.
- Check: `choice(["about 52°, west" ✓, "about 52°, east", "below the horizon"])`.

**5 · `second-reverse` · Your turn: 20 April, 22:00 BST** — R · front
- Purpose: the second worked value.
- Instruction: convert 22:00 BST on 20 April to local apparent time.
- Demonstration: none.
- Stop cue: —
- Meaning: 21:00 GMT; the half minute does not change the minute; + 1 → about **21:01**, just past 21.
- Introduces: —
- Uses: `summer-time`, `longitude-correction`, `equation-of-time`.
- Highlights: none.
- Check: `choice(["about 21:01" ✓, "about 22:01 (kept summer time)", "about 20:59 (subtracted the equation)" (whole minutes, as in L9)])`.

**6 · `second-set-time` · Your turn: set the rule** — T · front
- Purpose: the learner's manipulation.
- Instruction: put the rule's Sun end at 21:01, just past the 21.
- Demonstration: none. The snapshot is rule 262.5 (Sun end at 18:30, 37.5° short of the answer), rete 0, epoch 2026-04-20.
- Magnify frame: `limb-hour-scale[hour=18]`, `limb-hour-scale[hour=21]` (the end to turn and the target).
- Stop cue: the Sun end is just past 21.
- Meaning: the rule marks the question's moment.
- Introduces: —
- Uses: `set-time`.
- Highlights: `limb-hour-scale[hour=21]`.
- Check: `angleNear(ruleRotation, 224.9 ±1)`.

**7 · `second-set-sky` · Your turn: set the sky** — T · front
- Purpose: complete the setting.
- Instruction: turn the rete until 30.4° lies under the rule. Do not move the rule.
- Demonstration: none.
- Stop cue: the 30.4° tick is under the rule's edge.
- Meaning: the sky is set for 22:00 BST, 20 April.
- Introduces: —
- Uses: `set-sky-for-time`.
- Highlights: `ecliptic-scale[longitude=30.5]`.
- Check: `allOf(angleNear(ruleRotation, 224.9 ±1), frontGeometry(Sun@04-20; rule over Sun ±1))`.

**8 · `second-read-sky` · Your turn: read Arcturus** — R · front
- Purpose: close the loop with Lesson 8.
- Instruction: where is Arcturus?
- Demonstration: none.
- Stop cue: —
- Meaning: about 39° up in the east-south-east. Lesson 8 had it at 40° at 21:06, five minutes later and still climbing, so the two lessons agree.
- Introduces: —
- Uses: `read-alt-az`.
- Highlights: `star-pointer[star=arcturus]`.
- Check: `choice(["about 39°, east-south-east" ✓, "about 39°, west-south-west", "about 58°, south"])`.

**9 · `setting-result` · A map of tonight's sky** — E · front
- Purpose: sum up the timekeeping thread (Lesson 12 follows as a side quest).
- Instruction: you can now go either way between the sky and the watch: from a measurement to the clock (Lessons 6–9), and from the clock to the sky (this lesson).
- Demonstration: none.
- Stop cue: —
- Meaning: the astrolabe is a clock and a star map in one.
- Introduces: —
- Uses: `set-sky-for-time`.
- Highlights: `rete`.
- Check: none.
- Result: "Result: 21:00 BST on 23 October shows Vega 52° in the west; 22:00 BST on 20 April shows Arcturus 39° in the east-south-east."

---

### Lesson 12 — `back.shadow-square.v1` — Measure a height with the shadow square

*Summary:* Use the shadow square's twelve-part sides to turn a sighting angle and a paced distance into a height. Two readings from different distances should agree.
*Prerequisites:* `front.foundations.v1`, `back.measure-altitude.v1`. It is listed last so the timekeeping thread is not interrupted, but it can be taken any time after Lesson 2.
*Epoch:* 2026-04-20.

| Sighting (given) | Distance | Side crossed | Reading | Height above the eye |
|---|---|---|---|---|
| 45° | 20.8 m | corner | 12 : 12 | = distance, 20.8 m |
| 60° | 12 m | UMBRA RECTA (bottom) | 6.9 (6.93) | 12 × 12 ÷ 6.9 ≈ **20.9 m** (20.78 from 6.93) |
| 30° | 36 m | UMBRA VERSA (side) | 6.9 (6.93) | 36 × 6.9 ÷ 12 = **20.7 m** (20.78 from 6.93) |

The copy works from the reading as shown (6.9): 20.9 m and 20.7 m, average 20.8 m. With an eye height of 1.6 m the tower is **22.4 m** tall.

**1 · `the-problem` · Measuring a tower without climbing it** — E · back
- Purpose: frame a land-surveying use.
- Instruction: you pace your distance from a tower on level ground and sight its top through the alidade (outside the simulation). The angle is given to you.
- Demonstration: none.
- Stop cue: —
- Meaning: an angle and a distance give a height.
- Introduces: —
- Uses: `sighting`, `alidade`.
- Highlights: `shadow-square`.
- Check: none.

**2 · `the-square` · The two shadow scales** — E · back
- Purpose: name the scales and the rule for choosing between them.
- Instruction: the square is two halves side by side, each divided into 12 along each side; the end that crosses the square is the alidade's other end, below the pivot. Sightings below 45° cross the upright side, **UMBRA VERSA**: height ÷ distance = reading ÷ 12. Sightings above 45° cross the bottom, **UMBRA RECTA**: height ÷ distance = 12 ÷ reading.
- Demonstration: none.
- Stop cue: —
- Meaning: the square is a ready-made table of the ratio of height to distance.
- Introduces: `umbra-versa`, `umbra-recta`, `shadow-ratio`.
- Uses: `shadow-square`.
- Highlights: `shadow-square`, `umbra-versa`, `umbra-recta`.
- Check: none.

**3 · `corner` · The 45° corner** — D · back
- Purpose: start from the easiest case (§3.2.6).
- Instruction: set a sighting of 45°. The alidade passes through the square's corner.
- Demonstration: `alidadeRotation` 0 → 45 (700 ms).
- Stop cue: the edge runs exactly through the corner.
- Meaning: at 45° the height above your eye equals your distance. Walk back until the top is at 45°, then pace the distance.
- Introduces: `shadow-corner`.
- Uses: `set-altitude`, `shadow-ratio`.
- Highlights: `shadow-square`.
- Check: `angleNear(alidadeRotation, 45 ±1)`, derived from `altitude-scale`.

**4 · `steep` · Your turn: 12 m away, top at 60°** — T · back
- Purpose: a steep sighting.
- Instruction: set the given 60° sighting.
- Demonstration: none.
- Stop cue: the edge crosses the red 60.
- Meaning: the alidade's other end now crosses the bottom of the square: steep, so read UMBRA RECTA.
- Introduces: —
- Uses: `set-altitude`.
- Highlights: `altitude-scale[altitude=60]` (the square it then crosses is highlighted in L12#5).
- Magnify frame: `altitude-scale[altitude=40]`, `altitude-scale[altitude=60]` (the tip, at 45°, and the mark to reach).
- Check: `alidadeAltitude(60 ±1)` (needs FG-2 numbers on both halves; until then `angleNear(alidadeRotation, 120 ±1)` so the labelled half is crossed).

**5 · `read-recta` · Read the bottom scale** — R · back
- Purpose: read the square.
- Instruction: where does the edge cross the bottom scale?
- Demonstration: none.
- Stop cue: —
- Meaning: just under 7 (6.9). UMBRA RECTA is numbered outwards from below the pivot to 12 at the corner; UMBRA VERSA downwards from the horizontal line to 12 at the corner.
- Introduces: `read-shadow-square`.
- Uses: `umbra-recta`.
- Highlights: `umbra-recta`.
- Check: `choice(["about 6.9" ✓, "12", "about 5.1 (counted from the corner)"])`.

**6 · `calculate-recta` · Work out the height** — R · back
- Purpose: apply the ratio without inverting it.
- Instruction: for UMBRA RECTA, height = distance × 12 ÷ reading.
- Demonstration: none.
- Stop cue: —
- Meaning: 12 × 12 ÷ 6.9 ≈ **20.9 m** above your eye (worked from the reading as shown; the model value from 6.93 is 20.78).
- Introduces: —
- Uses: `shadow-ratio`, `read-shadow-square`.
- Highlights: `umbra-recta`.
- Check: `choice(["about 20.9 m" ✓, "about 6.9 m (ratio inverted)", "12 m"])`.

**7 · `low` · Your turn: 36 m away, top at 30°** — T · back
- Purpose: the second worked value, on the other scale.
- Instruction: set the given 30° sighting.
- Demonstration: none.
- Stop cue: the edge crosses the red 30.
- Meaning: the alidade's other end now crosses an upright side of the square: low, so read UMBRA VERSA.
- Introduces: —
- Uses: `set-altitude`.
- Highlights: `altitude-scale[altitude=30]` (UMBRA VERSA is highlighted in L12#8).
- Magnify frame: `altitude-scale[altitude=30]`, `altitude-scale[altitude=60]`.
- Check: `alidadeAltitude(30 ±1)` (until FG-2: `angleNear(alidadeRotation, 30 ±1)`).

**8 · `read-versa` · Read and calculate** — R · back
- Purpose: complete the transfer.
- Instruction: read UMBRA VERSA, then height = distance × reading ÷ 12.
- Demonstration: none.
- Stop cue: —
- Meaning: reading 6.9, so 36 × 6.9 ÷ 12 = **20.7 m**. The first measurement gave 20.9 m: the same tower, within the reading error.
- Introduces: —
- Uses: `read-shadow-square`, `umbra-versa`.
- Highlights: `umbra-versa`.
- Check: `choice(["about 20.7 m" ✓, "about 62.6 m (ratio inverted; 36 × 12 ÷ 6.9)", "about 6.9 m"])`.

**9 · `account-eye-level` · Add your own height** — E · back
- Purpose: the common last-step error.
- Instruction: the square measures from the pivot, which is at your eye. Add your eye height, 1.6 m.
- Demonstration: none.
- Stop cue: —
- Meaning: the tower is about **22.4 m** tall. Two readings that agree build trust; if they disagree, one ratio was turned upside down.
- Introduces: `eye-height`.
- Uses: `shadow-ratio`, `back-axes`.
- Highlights: `back-axes`.
- Check: none.
- Result: "Result: 60° at 12 m gave 20.9 m and 30° at 36 m gave 20.7 m above the eye: on average 20.8 m. With 1.6 m eye height the tower is about 22.4 m tall."

---

## 3. Feature gaps

Five gaps, kept deliberately small; everything else is either reworded around or deferred. The **art redraw** (FINDINGS-ART) is assumed to supply `throne`, pierced-rete `star-pointer` tips and an opaque rete. Those are not counted as gaps here. Until they land:
- `throne` highlights resolve to nothing;
- star "tips" are the current dots.

Tests must tolerate the first (§3.1, FG-1 criterion 4).

### 3.1 Gaps

#### FG-1 — Step highlights and the `data-part` vocabulary (M)

- **Description.** Today a step has one unused `target` string, and nothing in the SVG reacts to `data-tutorial-target` or `state.highlight` (EXPLORE §2). The change:
  - Replace `LessonStep.target` with `highlights: readonly PartRef[]`, where a `PartRef` is `'almucantar'` or `{ part: 'almucantar', altitude: 30 }`.
  - Tag every element in §1.2 with `data-part`, its instance attribute and a generated `data-concept`.
  - Render the active step's highlights; Reference-tab hover uses the same mechanism.
- **Acceptance criteria.**
  1. `src/tutorial/parts.ts` exports the 39 part ids and their instance keys; `PartRef` is type-checked against them.
  2. A highlighted element shows a visible, non-colour-only emphasis: an outline or glow plus a heavier stroke. It meets 3:1 contrast against the brass in both schemes, has a `forced-colors` fallback, and does not animate under reduced motion.
  3. Highlights live outside the rotating groups' filters, or on static layers, so they add no per-frame filter cost (FINDINGS-ART §5).
  4. Unit test: every step's `highlights` use known part ids and valid instance values. Browser (journey) test: for every step of every lesson, each `PartRef` resolves to at least one rendered element on the step's face. The only exception is `throne` until the art redraw lands.
  5. `data-tutorial-target` and `TargetId` are removed, or aliased for one release.

#### FG-2 — Four engraving corrections (S)

- **Description.** These are small fixes to engraved scales that would otherwise teach habits that fail on a real instrument:
  - (a) **Limb hours: put 12 (noon) at the top and 0/24 at the bottom**, increasing clockwise. Today 0 is at the top, so a time can only be read at the rule's end *opposite* the Sun (§0.2). Physical 24-hour limbs put noon on the upper meridian and are read at the Sun's end.
  - (b) **Roman numerals I–XI on the front unequal-hour lines**. Today they are unlabelled, so "line IX" can only be found by counting.
  - (c) **Shadow-square numbers on both halves**. Today versa is numbered only on the left side and recta only on the right half of the bottom, so either end of the alidade cannot be read.
  - (d) **Alidade minute scale: −20…+20 with 1-minute ticks**. Today it runs −15…+15 at 5-minute steps, so +1 min is unreadable and the late-October and early-November values (+15.8 to +16.5) fall off the end.
  - Also drop the "ALTITUDE" caption on the left arm. Either end reads altitude, and the caption points the wrong way when the bar is raised on the right.
- **Acceptance criteria.**
  1. With the rule over `Sun@04-20` at rete 332.5, the Sun end of the rule is within 0.5° of the limb position for 08:17. A unit test runs over `limbHourLabels()` and the rule geometry.
  2. Each lower unequal-hour line carries its numeral near the horizon end; VI sits on the lower meridian.
  3. `shadowSquareIntersection(a)` for a ∈ {30, 60} and for 180 − a lands on a numbered edge.
  4. The minute scale has ticks at every integer from −20 to +20 and labels every 5. The EoT loop point for 23 October lies on it.
  5. Journey screenshots are re-baselined, and the theme audit's `manualSurfaces` note is updated.
- **Fallback if (a) is not done.** Every "read at the Sun's end" instruction becomes "read at the plain end opposite the Sun's point". The checks do not change, because they compare rule *lines*, not ends.

#### FG-3 — Reading and prediction questions (M)

- **Description.** A step may carry `check: { kind: 'choice', prompt, options: [{ label, correct, misconception? }] }`. It is rendered as a short radio group in the lesson panel. Next is enabled after a correct pick, and a wrong pick shows that option's misconception note.
- **Why it is needed.** The research's central move is predict → act → check (FINDINGS-PEDAGOGY §3) on east versus west, which end of the rule, star versus Sun, the sign of the equation of time and ratio inversion. The contract requires a checked outcome, and 28 of the 107 steps are readings or predictions that cannot be checked by part angles.
- **Acceptance criteria.**
  1. Keyboard- and screen-reader-operable (fieldset/legend, focus management after the answer), within the theme audit's text and contrast rules.
  2. Answers are not encoded in the URL; Back/Replay resets the choice.
  3. Unit test: every `choice` has exactly one correct option and 2–4 options, and every distractor has a misconception note.
  4. A journey state answers one question wrongly, then rightly.
- **Fallback.** Shipping R steps as E steps whose result reveals the answer is acceptable for a first release, but the contract item "checked result" is then met only by the manipulation steps.

#### FG-4 — Checkpoint and demonstration kinds (S)

- **Description.** Pure additions to `Predicate`, `evaluateCheckpoint` and `runStep`:
  - `alidadeAltitude { value, tolerance }`: passes when `alidadeRotation mod 180` is within tolerance of `value` or of `180 − value`. Either end of the alidade may be used, as on a real instrument.
  - `alidadeLongitude { value, tolerance }`: passes when `alidadeRotation mod 180` is within tolerance of `(180 − λ) mod 180`.
  - `plateIs { latitude, tolerance }`.
  - `allOf { predicates }`.
  - Demonstration kinds `{ kind: 'face', to }` and `{ kind: 'plate', to }`. The guide performs the face flip or plate swap visibly, with the same interruption handling as angle demonstrations.
- **Acceptance criteria.** Unit tests for each predicate at its boundary (tolerance ± 0.01°) and for both alidade ends. Catalog tests extend the existing "check passes at the demonstration's end" rule to the new kinds.

#### FG-5 — Lesson metadata and the concept ledger in code (S)

- **Description.**
  - Add `prerequisites: readonly LessonId[]` to `Lesson`.
  - Add `mode: 'demonstrate' | 'your-turn' | 'read' | 'explain'`, `introduces: ConceptId[]` and `uses: ConceptId[]` to `LessonStep`.
  - Add `src/tutorial/concepts.ts`, transcribed from §1.1: id, kind, definition, introducedAt, parts, face, visibility.
  - Allow per-step `epochIso` (already in the snapshot) and drop the "every step is 14 July" test.
- **Acceptance criteria.** All unit tests:
  1. Every prerequisite appears earlier in `LESSONS`.
  2. Every concept is introduced at exactly the step the ledger says.
  3. Every `uses` id was introduced earlier in the same lesson or in a transitive prerequisite.
  4. Every ledger concept's parts are in the vocabulary.
  5. A `demonstrate` step has a demonstration and a check that passes at its end.
  6. A `your-turn` step has a check and no demonstration, and its snapshot fails the check.
  7. Every calculation lesson (6–12) has at least two checked worked values with different inputs.
  8. Learner-visible copy contains none of `fixture|deterministic|endpoint|API|solver`.

### 3.2 Deferred (nice to have; not required by this syllabus)

- **Double horary quadrant lesson** (retired `back.unequal-hours.v1`). It needs an alidade cursor or bead (M) so the curve-VI distance can be marked and checked. It should be rewritten with real values: noon height 50.1° on 20 April from Lesson 7, instead of today's unexplained 70°.
- **Twilight** (Chaucer, Conclusion 6). It needs a −18° line, or almucantars every 2° to 18°. At London in summer there is no astronomical night, which makes a nice discovery lesson.
- Cardinal letters (N/E/S/W) at the horizon. The azimuth labels already carry this.
- "Hand back" after a demonstration: animate the part back to its start so the learner repeats Example 1, not only Example 2.
- A sky-dome split view (FINDINGS-PEDAGOGY §3.1.1) and a stereographic-projection animation (§3.1.2).
- Error bars: show how ±1° of altitude changes the time at the current setting.
- Ascendant and houses, latitude from the noon Sun or the pole star, star coordinates, precession and the Julian calendar (one Reference note would do).
- Per-step journey screenshots for a lesson gallery.

---

## 4. Why this order

### 4.1 Order against the research

| Course lesson | FINDINGS-PEDAGOGY module | Reason |
|---|---|---|
| 1 Foundations | §2.2 Module 0; §1.1 (Chaucer Part I names the parts first); §3.4 pre-training | Naming the parts before any procedure lowers the load during procedures. b1e9e5f's both-faces scope is kept. Plate comparison moved to Lesson 3, where it has meaning. |
| 2 Measure altitude | §2.2 Module 1; §1.1 (Chaucer, Conclusion 2) | The only concept tied to the learner's own body; an immediate concrete success. Honest framing per §5. |
| 3 Local sky | §2.2 Modules 1 and 3 | Horizon, zenith, almucantar, azimuth, east/west; then plate = latitude ("what if you used Rome's plate", §3.2.3). |
| 4 Star path | §2.2 Module 2 | The sky turns about the pole; rising, culmination, setting; circumpolar stars. It now needs no date, so it is taught before the Sun. |
| 5 Sun's place | §2.2 Module 4; §1.1 (Chaucer, Conclusion 1) | The ecliptic sits on the rete, so it comes after the rete (Module 2). Date → longitude, and the true edge. |
| 6 **Time by the Sun** | §0 item 1 and §2.2 Module 5 (keystone); §4.2/§4.3 worked examples | Reached at Lesson 6 with the minimum concept set of §0 item 2. Two mirror-image worked examples (spring morning / autumn afternoon) for schema transfer (Gick & Holyoak). Degrees ↔ hours is introduced here. |
| 7 Sunrise/sunset | §2.2 Module 6; §1.1 (Chaucer, Conclusions 7 and 13) | No new parts, only new heights (0°, the meridian): fluent practice. |
| 8 Time by a star | §2.2 Module 7 | One new idea: read at the Sun's point. |
| 9 Clock time | §2.2 Module 8; §3.1.4 | Comes after the learner has a number that disagrees with their watch, and before any real-sky homework. Example 2's +16 min makes the correction impossible to ignore. Adds longitude and summer time, which today's lesson omits. |
| 10 Unequal hours | §2.2 Module 9; §3.1.6 | The hour is derived (day ÷ 12) before the curves are shown. Twilight is deferred (no −18° line). |
| 11 Set the sky for a time | §4.3 "optional third check (reverse problem)"; §2.2 Module 7 ("which stars are up now") | Runs the whole chain backwards and confirms Lessons 8 and 9 numerically. Arcturus is 39° at 21:01 and 40° at 21:06; Vega is 52° at 20:16 and 50° at 20:26. |
| 12 Shadow square | §2.2 Module 10 ("side quest at any point after Module 1"); §3.2.6; §4.5 | Prerequisites are only Lessons 1–2. It is placed last so the timekeeping thread runs unbroken; the 45° corner comes first. |

Further design choices:
- **Worked example, then faded practice, within every calculation lesson** (§3.4, Atkinson; Renkl & Atkinson). Example 1 is demonstrated (`D`), and the learner does Example 2 (`T`/`R`).
- **The same two dates throughout.** 20 April and 23 October are chosen so that λ falls at 0° of a sign (§4.1), the seasons and sides mirror, and the equations of time differ (+1 vs +16 min). Learners meet one consistent world rather than a new fixture per lesson.
- **The dates are opposite.** 20 April and 23 October lie on one line through the centre, on both the back and the rete. This makes it easy to spot reading the wrong end of the alidade. It also prepares the nadir trick of Lesson 10 (Lesson 5, step 8).

### 4.2 How the known misconceptions are addressed

| Misconception (FINDINGS-PEDAGOGY) | Where | Teaching move |
|---|---|---|
| §3.1.1 "The Earth turns, so why does the rete turn?" | L4#1 | The observer's-frame explanation, then the learner turns the sky themselves (L4#4–5). |
| §3.1.2 Uneven circles and signs look wrong | L3#2, L5#5 | "Trust the engraved numbers"; height circles are named by their labels, not their spacing. Projection theory deferred. |
| §3.1.3 Reading the wrong edge of the ecliptic band | L5#5 | The operational test: the edge that touches the Tropic of Cancer; highlight on `ecliptic-edge`. Highlights always point at the edge tick. |
| §3.1.4 "The astrolabe tells clock time" | L6#5, L6#11, L9 (whole) | Every result says "local apparent time". L9 runs the full chain, and its choice distractors are the sign error and the forgotten summer hour. |
| §3.1.5 Two positions for one altitude; the near-noon error | L6#3 (east/west gate), L6#8 (learner decides; check fails on the wrong side), L6#11, L8#9 | An explicit side question before the alignment; Chaucer's near-noon warning with this course's own numbers (7 min/° at 30°; under 2° of change in the last hour). |
| §3.1.6 Unequal hours | L10#1, L10#7 | Derived first (70 vs 50 min); a "60-minute hours" distractor. |
| §3.1.7 Direction of time; reading the wrong end of the rule | L1#3, L4#1 (clockwise = forward), L1#4 (the numbered half is the Sun end), L6#5–6, L10#5 | FG-2 puts noon at the top so readings are taken at the Sun's end; every rule cue names the Sun end, and the rule check passes only with the point on that end; distractors name "the other end of the rule". |
| §3.1.8 Star instead of Sun as the time reference | L8#4 | A prediction question before the reading; the Sun's point is highlighted below the horizon. |
| §3.2.1 Alidade versus rule | L1#4, L1#11, L1#12 | Introduced on different faces with different jobs (measure / read). |
| §3.2.2 Chaucer's terminology | L1#12 | `old-part-names`. |
| §3.2.3 Wrong plate | L3#6–7 | A visible swap to Rome's plate: Sirius moves from 22° to 32°; the 50° stock-plate warning. |
| §3.2.4 Reading altitude from the wrong scale or zero | L2#2, L2#4 | Counted from the horizontal line; the black-numbers distractor. |
| §3.2.5 Looking at the Sun | L2#1 | The safety instruction stated in the sighting step. |
| §3.2.6 Shadow-square inversion; eye height | L12#3, L12#6, L12#8, L12#9 | Start at the 45° corner; inverted-ratio distractors; two distances that must agree; add the eye height. |
| §3.2.7 Calendar drift and precession | L5#9 | A one-sentence caveat; the full treatment is deferred. |

---

## 5. Constraints honoured

- **No lesson claims to sight a real object.**
  - Every observed height is introduced as given data: L2#2 and L2#5, L6#2 and L6#7, L8#2 and L8#6, L12#1, #4 and #7.
  - It is given as an alidade the sighting left in place, read on the red scale (L6#2/#7, L8#2/#6), or set on the red scale (`alidadeAltitude`; L2, L12). L2#1 states that the simulation cannot sight.
  - The alidade keeps no sights, as before.
  - Real-sky work appears only as explicit homework (L8#9, L9#10).
- **Learners never type unexplained angles.**
  - No step asks for a number to be typed. Every manipulation's stop cue is an engraved feature: a calendar tick, a red altitude number, an almucantar, the horizon, the meridian, an hour line, a limb hour, or the shadow-square corner.
  - Rotation values appear only inside checks and demonstrations (§0.2).
  - Today's "rotate the rete to 45°" and "the rule to 90°" are replaced by star and horizon stop cues (L1#3–5). The alidade's 90° is "along the vertical line" (L1#11).
- **Every value is introduced before use.**
  - The Sun's places come from L5. The measured heights are supplied in the step that first uses them.
  - The sundial times come from L6, the day lengths from L7 (used in L10), and the equations of time from L9 (used in L11).
  - Longitude (−0.12°, Bristol 2.6° W) and the BST dates are stated where applied.
  - No step uses a number that is neither given in that step nor produced by an earlier one. FG-5's `uses` test enforces this for concepts; the copy review must enforce it for numbers.
- **Every value is checked against the model.** Every check value in §2 was computed with `solarLongitude`, `equationOfTime`, `equatorialToHorizontal`, `orientRetePoint`, `alidadeRotationForLongitude`, `shadowSquareIntersection` and `unequalHourPoint` (`/workspace/calc/calc.ts`). Each `frontGeometry` target also reproduces its almucantar or horizon value (for example, 30.000° at rete 332.473). The nadir points coincide with `unequalHourPoint` to within 1e-12.
- **Second worked values.** Every calculation lesson (5–12) has two: 20 April and 23 October, Arcturus and Vega, 60° at 12 m and 30° at 36 m, plus Bristol in Lesson 9.
- **Size.** 12 lessons of 6–12 steps (107 steps in all), against 9 lessons and 69 steps today. The increase is mostly the three core operations that were missing: time by the Sun, time by a star, and clock time with longitude and summer time.

---

## 6. Migration notes for the implementer

- **Lesson ids.**
  - Kept: `front.foundations.v1`, `back.measure-altitude.v1`, `front.read-star.v1`, `solar.events.v1`, `back.equation-time.v1`, `front.unequal-hours.v1`, `front.set-sky.v1`, `back.shadow-square.v1`.
  - New: `front.local-sky.v1`, `back.sun-place.v1`, `solar.time-by-sun.v1`, `night.time-by-star.v1`.
  - Retired: `back.unequal-hours.v1`; alias it to `front.unequal-hours.v1`.
  - Content changes keep `version: 1`. Add `STEP_ALIASES` for removed step ids where the meaning survives (e.g. `front.set-sky.v1:choose-observation` → `reverse-problem`, `front.set-sky.v1:set-time` → `set-time`). Today's date-finding steps (`find-date`, `read-sun-longitude`, `find-sun-point`) now live in `back.sun-place.v1`, so links to them should open that lesson.
- **Tests to rewrite** (`catalog.test.ts`):
  - the exact id order (the 12 ids above);
  - the step counts `[12,7,8]` → `[10,6,8]` for the first three;
  - the plate steps 51.5/50/51.5 move to `front.local-sky.v1` as 51.5 → 40.93 → 51.5;
  - "every step is 14 July" → per-lesson epochs;
  - the horary copy test is retired with its lesson;
  - "frontGeometry steps pair a rete demo with a rule companion (≥7)" → only Lessons 7 and 10 use companions; others demonstrate the rete and rule in separate steps.
  - The b1e9e5f foundations tests stay valid as written, except the `move-alidade` demonstration end is now 90, not 35.
- **Journey.**
  - `set-sky-before-reading-star` is renamed `time-by-sun-walk`, because `front.set-sky.v1` is now Lesson 11. It asserts the 20 April calendar tick under the alidade (`calendar-scale[date=04-20]`) instead of `calendar-july-14`.
  - `all-completed-lessons-launch` asserts 12 cards.
  - Add one state per FG-1 criterion 4 (all highlights resolve).

---

## 7. Implementation notes (Phase 03)

The course in `src/tutorial/catalog.ts` follows §2 step for step (12 lessons, 107 steps: 19 demonstrate, 23 your turn, 28 read, 37 explain), and `concepts.ts` matches every `introducedAt`. Every number in the copy and every check is computed in the catalog from `solarLongitude`, `equationOfTime`, `equatorialToHorizontal`, `orientRetePoint`/`project`, `limbHourAtAngle`/`ruleSunEndAngle`, `alidadeRotationForLongitude`, `shadowSquareIntersection`/`shadowSquareReading`; snapshots and solutions use the exact computed angles, not the rounded figures above.

Deviations from the text above (already applied in §2):

- **Step fields.** Each step carries a learner-facing `purpose` and, for demonstrate, your-turn and most read steps, a `stopCue`; the guide shows them as an italic lead line and “Stop when:” / “Look for:”. The design-note purposes in §2 were rewritten as learner copy. The meaning (result) is shown only once a step’s check has passed, so reading answers are not visible in advance.
- **Choice order.** Options are authored correct-first but rotated by a fixed amount derived from the prompt, so the correct answer is not always first.
- **L2#5** also uses `rotate-alidade`, so the manipulation is practised in a your-turn step (M2).
- **L12#2** also highlights `shadow-square`, so `shadow-ratio` is made visible as the ledger says (C6).
- **L3#7 copy.** The plate menu option is labelled “Exact” (not “Exact 51.5°”); the copy says so.
- **Lesson links.** `back.unequal-hours.v1` is a `LESSON_ALIASES` entry to `front.unequal-hours.v1`; removed step ids that survive (e.g. `front.set-sky.v1:find-date`) redirect, across lessons where needed.

Number corrections (model value vs. the earlier text):

| Where | Was | Now | Why |
|---|---|---|---|
| L10#8 October end of hour III | 09:29 | 09:30 | 06:58.6 + 3 × 50.12 min = 09:29.7; 09:29 came from rounding sunrise first |
| L10#7 distractor | 15:00 | 15:59 | “60-minute hours” counted from the 06:59 sunrise |
| L9#9 distractor | 14:56 | 14:55 | 14:05.3 − 10.4 min = 13:54.9 GMT → 14:55 BST |
| L12#8 distractor | 62.6 m | 62.4 m | 36 × 12 ÷ 6.928 |
| L11#5 | 21:00½ | 21:01 | whole minutes, as Lesson 9 works (phase 12; L11#1 is now 20:16) |
| L8#5 | 16½° | 16.6° | shown to one decimal |
| L12#5 note | — | — | recta is numbered from the middle outwards, versa from the top downwards |

### 7.1 Phase 08 rework (review round 1)

- Lesson 1 step 8 is split into three steps (outer rings; date rings; centre), so each name maps to its own highlight. Lesson 1 now has 12 steps.
- Lesson 6 gains `between-circles` (step 10, a 35° Sun set between the 30° and 40° circles by interpolation; CO-01). Its two "hold the measurement" steps, and Lesson 8's two, are now readings of an alidade a sighting left in place (CO-02). Lesson 6 now has 11 steps.
- Real-instrument notes (CO-03): sign-by-sign ecliptic numbering (L5#9), I–XII limbs (L6#6), and a mid-month equation-of-time table for instruments with no loop (L9#2).
- Snapshots turn the rule aside wherever it would lie over the star, point or numeral a step names, at the snapshot and at the solution: L1#5 (300), L4 all (30; 330 since phase 12), L6#8–10 (90, 90, 300), L7#1, #6 (300), L7#8 (330), L8#7–8 (60; L8#8 is 345 since phase 12), L10#2–3 (330).
- Lesson 9 copy works in whole minutes (`WATCH`), so the October answer shown is 15:05 BST and Bristol 15:15 BST; Lesson 12 works from the reading as shown (6.9).

### 7.2 Phase 12 rework (review round 2)

- **Sun end named.** The rule predicate passes only with the point on the rule's Sun end (phase 11). L1#4 now says the Sun end is the rule's numbered half, and every cue that lays the rule over a point names the Sun end (L1#4–5, L5#4, L5#8, L6#5, L6#9–10, L7#3–4, L7#6–7, L8#5, L8#8, L10#4, L10#6, L11#3, L11#7).
- **Snapshots.** L4 rule 330 (upper half right of the zenith; clear of the culmination labels). L5#5 rete 310, rule 90 (all three circle labels visible). L5#8 rule 90 (was 0, 28° from the answer). L8#1 and #3 rule 60 since phase 14 (a level rule lay across Arcturus's blade), L8#4–5 rule 90 (meridian and the 40° crossing visible; L8#5 demonstrates from 90). L8#8 rule 345 (was 60, 6.6° from the flipped answer). L11#6 rule 262.5 (Sun end at 18:30). A course test now requires every rule-only your-turn step to start at least 30° (mod 180°) from its answer.
- **Highlights.** L3#6 adds `almucantar[altitude=30]`; L4#4 adds `almucantar[altitude=60]`; L7#6 adds `almucantar[altitude=30]`; L12#4 and #7 highlight the red mark the cue names (`altitude-scale[altitude=60]`, `[altitude=30]`) instead of the square scale, which the next read step highlights; Magnify then shows the mark and the alidade tip together.
- **Magnify frames** (`frame`; phone auto-Magnify and the manual toggle frame the reading spot with the tool beside it; `.magnify-frame` now clips with `overflow: clip`, so focus or `scrollIntoView` can no longer scroll the magnified view off its frame): L2#4 red 40–60; L5#3 and L5#7 the date tick and the degree ticks 5° either side of the reading; L6#2, L6#7, L8#2, L8#6 the red numerals either side of the reading; L6#6 the limb from 12 to 8; L9#4 the minute scale; L10#4 the ecliptic ticks either side of the opposite point; L11#6 hours 18–21; L11#7 the 30.4° tick with the rule (too large to auto-zoom, so a phone keeps the whole instrument while the rete turns 163°); L12#4 red 40–60; L12#7 red 30–60 (plus the phase-11 frames on L9#6, L10#6, L12#8).
- **Copy.** L2#3/#5 the edge "points at" the red number (the numerals sit beside their ticks). L3#6 "the Clima V plate, made for Rome"; L3#7 how to use the nearest plate on a real instrument (CO-11). L4#8 separates the 58° rising azimuth from the 58° culmination. L6#3 "each height circle below its noon height". L6#6 counts hour marks, then ticks. L6#10 the learner lays the rule and reads 08:52 (CO-09). L9#1 and L9#10 use the zone's meridian, with central Europe and US Eastern examples (CO-08); L9#2's table is "approximate … sundial minus mean time" and is also in the Reference tab (CO-10). L11 works in whole minutes as L9 does: 20:16 and 21:01 (L11-01). L11#4 names the other three marked stars.

### 7.3 Phase 14 rework (review round 3)

- **L3#7 (CO-13).** The stop cue names the warning banner disappearing, not the matching-plate banner, which lessons hide.
- **Highlights (UXM-18).** The star or tick the cue names is highlighted in L4#4 and #5 (Arcturus), L7#3 and #4 (30.4° tick) and L7#7 (210.1° tick). L7#3, #4 and #7 start with the rule turned off that tick (320, 300, 0), because the audit needs a highlighted tick to be visible at the start.
- **Frames for fine-reading steps (L02-05-r3-a, lessons-05-06-18, L07-08-17).** Frames on L2#3 and #5 (red numerals), L5#6 (the date tick; the alidade now starts at 118), L6#9 (the 210.1° tick and the 14; the rule starts on the meridian) and L6#10 (tick, both circles and hours 8 and 9), and L8#8 (210.1° tick and the 20; the rule starts at 282). Magnify adds the tool's tip itself. On a phone L2#5, L5#6, L6#9 and L8#8 now auto-magnify with the tool in view; L6#10 and L10#6 do not fit at 2× and keep the whole instrument (manual Magnify still works).
- **Copy.** CO-15: on a real rule the Sun end is the half you lay over the Sun (L6#5, `lay-rule`). CO-17: §0.1 and §4.1 numbers. L12#4 and #7: the "other end crosses the square" clause moved from the stop cue to the result. L1#4 uses `limb`; L2#2 uses `horizon`. L6#3 says what the highlighted line is; L6#4 and #5 keep the rule aside; L5#3 and #7 stop cues name the zodiac boundary; L9#4 says the numbers are upside down.

### 7.4 Phase 15 rework (review round 4)

- **L3#5 (lessons-03-04-23).** The frame now covers Regulus's tip, the 30° and 40° circles and the 120° line. They do not fit at 2×, so a phone shows the whole instrument.
- **L6#9, L8#8 (UXM-22).** Frames add the next limb hour mark (15, 21); they still fit at 2× with the rule tip at the start and at the solution (audit, gallery).
- **Cheap copy.** L10#4 stop cue no longer mentions the Sun end (outside its frame); the clause moved to the result. L10#6 uses `rotate-rete`, `lay-rule`.

### 7.5 Phase 16 rework (UXM-23)

- **Frame label entries.** A frame may hold `{ label: <instance ref> }` (written `label(almucantar[altitude=30])`): it frames only the engraved numeral of that instance (`data-label` on the numeral), not its circle or line. Plate numerals for almucantars and azimuth lines carry `data-label`.
- **L3#5 (UXM-23).** Frame is the Regulus tip plus the 30° and 40° numerals and the 120° foot numeral, so it fits at 2× and the phone opens magnified.
