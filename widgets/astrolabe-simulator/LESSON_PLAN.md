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
edge against the engraved scales.

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

The guide presents one ordered list rather than dividing operations by face.
Many real operations move between the front and back, so a face-based taxonomy
would be misleading.

1. **Understand and configure the astrolabe front.** Identify the fixed plate,
   moving rete, and rule; compare a nearby plate with London's exact plate.
2. **Set the astrolabe for a date and time.** Carry July 14 from the back
   calendar to ecliptic longitude, set the rule, and orient the rete.
3. **Read a star and follow its daily path.** Read Sirius and follow it through
   rising, culmination, and setting.
4. **Find sunrise, noon, and sunset.** Carry the Sun's engraved date point
   across the eastern horizon, meridian, and western horizon.
5. **Read a daylight temporal hour.** Use the point opposite the Sun and the
   lower unequal-hour curves.
6. **Transfer a measured altitude to the alidade.** Explain the external
   physical sighting and set its supplied angle on the simulated back.
7. **Convert apparent solar time to mean solar time.** Read and apply the
   equation-of-time loop with its engraved sign convention.
8. **Measure a height with the shadow square.** Use an external angle and known
   distance to read a proportional height.
9. **Read a temporal hour on the double horary quadrant.** Transfer the
   curve-VI distance between noon and observed-altitude settings.

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
  encode the displayed example.

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
