# Astrolabe Guide lesson plan

## Teaching contract

Lessons teach complete operations, not isolated controls. Each lesson must:

1. Be named for a task someone might perform with an astrolabe.
2. Rely only on concepts and manipulations taught earlier in the course.
3. Introduce every value before asking the learner to use it.
4. Explain why each movement is made, not merely where a part should end up.
5. Demonstrate each new manipulation on the simulated instrument.
6. Give the learner the same manipulation, with a visible stopping condition
   and a checked result.
7. End by interpreting the reading in the language of the original task.

Computed rete, rule, or alidade angles may be test fixtures internally, but
must not appear as unexplained learner inputs. The learner should reach each
position through the engraved scales and the operations already taught.

Each instructional step needs:

- **Purpose:** what the step contributes to the operation.
- **Instruction:** the physical action and the part or scale to use.
- **Demonstration:** the same action shown on the instrument.
- **Stop cue:** the visible alignment or scale crossing that completes it.
- **Meaning:** what the resulting position tells the learner.

Lessons are published in course order. An advanced demonstration remains
unavailable until its prerequisite lessons are available; implementation order
does not determine teaching order.

## What the simulator can demonstrate

The front can demonstrate choosing a latitude plate, rotating the rete and
rule, aligning engraved positions, and reading the altitude and azimuth grid.
The back can demonstrate rotating the alidade to a known angle and reading its
edge against the engraved scales. Times are read where the rule's end over the
Sun's date point meets the limb's hour scale. This assumes the limb is engraved
with noon at the top, as on physical 24-hour limbs (SYLLABUS.md FG-2).

The simulator does **not** reproduce a physical sighting. On a physical
astrolabe, the instrument is suspended vertically and the observer aligns the
alidade's two sights with a star. For the Sun, the observer avoids looking at
it and aligns the sights by their shadow. This widget has no usable sight line
or camera view, and its alidade sights were intentionally omitted rather than
depicted misleadingly.

Consequently there is no standalone lesson claiming to measure an object's
altitude. When a later operation needs an observed altitude, the lesson starts
with an explicitly supplied external observation, demonstrates setting that
value on the alidade, and teaches how to use the reading from that point on.

## Course sequence

The full specification is in [SYLLABUS.md](SYLLABUS.md), kept next to this file. It has the concept ledger, the `data-part` vocabulary, each step with its checkpoint and worked values, the feature gaps and the reasons for the order. Where this summary and the syllabus disagree, the syllabus wins.

The guide presents one ordered list rather than dividing operations by face.
Many real operations move between the front and back, so a face-based taxonomy
would be misleading. The course reaches its keystone, telling the time from the
Sun's altitude, at lesson 6, and then branches into its variations. Every
calculation lesson works the same two dates in London (51.5° N): 20 April
(morning, Sun at 30.4°) and 23 October (afternoon, Sun at 210.1°). The first is
demonstrated; the learner performs the second.

1. **Meet the astrolabe: what stays fixed and what turns** (`front.foundations.v1`).
   Name the mater, limb, throne, plate, rete, star pointers, rule and limb
   scales, turn the instrument over, name the back scales and move the alidade.
   No date or time is set.
2. **Set a measured altitude on the alidade** (`back.measure-altitude.v1`).
   Explain the physical sighting, then set and read supplied altitudes (30°, 20°).
3. **Read height and direction on your latitude plate** (`front.local-sky.v1`).
   Horizon, zenith, almucantars, meridian, azimuth lines, east and west; read
   two stars; see why the plate must match your latitude.
4. **Follow a star from rising to setting** (`front.read-star.v1`). The sky
   turns about the pole; Arcturus rises, culminates and sets; Capella never
   sets.
5. **Find the Sun's place for any date** (`back.sun-place.v1`). Carry a
   calendar date across the back to ecliptic longitude, then find that point on
   the true edge of the rete's ecliptic.
6. **Tell the time from the Sun's height** (`solar.time-by-sun.v1`). Choose
   east or west, set the Sun's date point on its almucantar, lay the rule over it
   and read local apparent time (08:17 and 14:21).
7. **Find sunrise, noon, sunset and the length of the day** (`solar.events.v1`).
8. **Tell the time at night from a star** (`night.time-by-star.v1`). Set the
   star on its almucantar, then read the time at the Sun's hidden date point.
9. **Turn astrolabe time into the time on your watch**
   (`back.equation-time.v1`). Equation of time from the back loop, then
   longitude and summer time.
10. **Tell the seasonal (unequal) hour** (`front.unequal-hours.v1`). Day ÷ 12,
    then the Sun's opposite point on the lower hour lines.
11. **Set the sky for a date and clock time** (`front.set-sky.v1`). Undo the
    clock corrections, set the rule and rete, and read what is up.
12. **Measure a height with the shadow square** (`back.shadow-square.v1`). A side
    quest available after lesson 2.

The double-horary-quadrant lesson (`back.unequal-hours.v1`) is deferred until
the alidade can carry a marked distance (see SYLLABUS.md §3.2). Its id is kept
as an alias.

## Assessment and test requirements

Each implemented lesson needs:

- a unit test proving its prerequisites occur earlier in the course;
- a content test requiring every newly introduced manipulation to have a
  purpose, demonstration, stop cue, learner action, and checked outcome;
- geometry fixtures derived from the same pure functions that render the
  instrument;
- a journey completing the operation without entering an unexplained angle;
- a journey proving Back, Replay, interruption recovery, refresh, and shared
  lesson URLs preserve a coherent step;
- copy tests rejecting learner-visible implementation terms such as
  `fixture`, `deterministic`, `endpoint`, `API`, and `solver`;
- a second worked value for every calculation lesson so tests do not merely
  encode the displayed example;
- a concept ledger (`src/tutorial/concepts.ts`, transcribed from SYLLABUS.md
  §1) with tests that every concept is introduced at exactly one step, used
  only after it is introduced (in the same lesson or a prerequisite), and mapped
  to `data-part` ids that the instrument actually renders;
- a browser test that every step's highlighted parts resolve to rendered
  elements on that step's face;
- for each step the learner performs (`your-turn`), a check that fails at the
  step's starting snapshot, so that the learner must actually move the part.

## Sources informing the sequence

- [Whipple Museum: Parts of an Astrolabe](https://www.whipplemuseum.cam.ac.uk/explore-whipple-collections/astronomy/medieval-astrolabe/parts-astrolabe)
  distinguishes the fixed latitude plate, rotating rete, rule, and sighting
  alidade.
- [History of Science Museum: Using the Astrolabe](https://www.mhs.ox.ac.uk/students/03to04/Astrolabes/Starholder_astronomy.html)
  describes measuring altitude, transferring a calendar date to ecliptic
  longitude, and finding sunrise.
- [Epact: Scientific Instruments of Medieval and Renaissance Europe](https://www.mhs.ox.ac.uk/epact/article.php?ArticleID=2)
  gives the operational chain from observed altitude and date, through front
  alignment, to an equal- or unequal-hour reading.
