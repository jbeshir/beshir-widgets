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

### 1. Setting up and reading the front of an astrolabe

**Prerequisites:** none.

This combines the essential orientation material into one substantial lesson:

- choose the plate nearest the observation latitude and interpret plate
  mismatch;
- distinguish the mater, fixed plate, rotating rete, rule, limb, and pivot;
- see that the plate represents the local horizon and coordinate grid while
  the rete represents the moving celestial sphere;
- read the horizon, zenith, altitude circles, and azimuth curves;
- move the rete and rule independently and recognize what remains fixed.

**Demonstration:** select a city and its nearest plate; rotate the rete while
the plate stays fixed; rotate the rule independently; highlight several points
on the plate and read their coordinates.

**Checked outcome:** the learner selects the appropriate plate, moves each
front part independently, and reads the approximate altitude and azimuth of a
marked point.

### 2. Locating a star at a given date and time

**Prerequisite:** Setting up and reading the front of an astrolabe.

This teaches the complete operation rather than beginning with a prepared
instrument:

1. On the back, find the date on the calendar scale.
2. Follow the same radial line to the adjacent ecliptic-longitude scale.
   Explain that ecliptic longitude measures the Sun's position around the
   ecliptic from 0° to 360°. Zodiac signs are labels for twelve 30° sections of
   that longitude scale, not the quantity being sought.
3. Turn to the front and find that longitude on the rete's ecliptic ring.
4. Place the rule at the supplied local apparent solar time on the limb.
5. Rotate the rete—not the rule—until the Sun's ecliptic-longitude point lies
   under the rule. Explain that this alignment sets the whole star map for the
   selected place, date, and time.
6. Find the named star pointer and read its altitude and azimuth against the
   fixed plate.

The worked example may use Sirius, but neither the title nor the method is
specific to Sirius. The learner is never given a rete angle.

**Demonstration:** carry one date from the calendar to ecliptic longitude, set
the rule to a labelled solar time, rotate the rete to the Sun–rule alignment,
then locate and read Sirius.

**Checked outcome:** the learner repeats the operation with a second date,
time, and star; reports whether the star is above the horizon; and reads its
approximate altitude and azimuth.

### 3. Finding the time from an observed Sun or star altitude

**Prerequisites:** Locating a star at a given date and time.

State clearly that the altitude was measured outside the simulation. Briefly
explain the physical alidade sighting, then demonstrate placing the supplied
angle on the back degree scale.

For a star:

1. Set the named star pointer on the supplied altitude circle, choosing the
   eastern or western side from the observation context.
2. Find the Sun's ecliptic longitude for the date.
3. Place the rule through the Sun point and read local apparent solar time on
   the limb.

For the Sun, place the Sun's ecliptic-longitude point directly on the supplied
altitude circle, again resolving the morning/afternoon ambiguity from context.

**Checked outcome:** the learner derives local apparent solar time from a
second supplied observation without being given any front rotation angle.

### 4. Finding rise, culmination, set, and length of daylight

**Prerequisites:** Locating a star at a given date and time.

Use the same horizon and meridian geometry for two related tasks:

- move the Sun's ecliptic-longitude point to the eastern and western horizon
  to find sunrise, sunset, and day length;
- move a star pointer to the eastern horizon, meridian, and western horizon to
  find rise, culmination, and set.

Include a circumpolar example so the absence of a horizon crossing is
interpreted as a result rather than a failed interaction.

**Checked outcome:** the learner reads solar and stellar events for a supplied
date and distinguishes a setting star from a circumpolar one.

### 5. Converting between clock time and local apparent solar time

**Prerequisites:** Locating a star at a given date and time.

Combine the two corrections needed before a civil clock time can be used in
the earlier operations:

1. Read the equation of time for the date using the calendar scale, alidade
   arm, and equation-of-time loop.
2. Apply the engraved sign convention to convert between apparent and mean
   solar time.
3. Apply the longitude difference from the civil time zone's reference
   meridian.
4. Treat daylight-saving time as an explicit civil correction outside the
   astrolabe.

**Checked outcome:** the learner converts both directions for dates with
positive and negative equation-of-time values, then uses the result to set the
front.

### 6. Reading unequal hours

**Prerequisites:** Finding the time from an observed Sun or star altitude;
Locating a star at a given date and time.

Teach the common idea first: daylight and darkness are each divided into
twelve hours whose equal-clock duration changes with the season.

Then compare the two engraved methods:

- **Front:** use the Sun's ecliptic-longitude point by night and the point
  opposite it by day, reading against the unequal-hour curves.
- **Back:** start with supplied noon and observed solar altitudes; retain the
  center-to-curve-VI distance, set the observed altitude, and find the same
  distance along the new alidade edge.

The existing 70°/27.5° back construction becomes one worked example inside
this lesson, after the front method establishes what is being measured.

**Checked outcome:** the learner reads the same approximate unequal hour using
both faces and explains why the back interpolation is approximate between
sunrise, noon, and sunset.

### 7. Measuring a height with the shadow square

**Prerequisite:** experience setting a supplied alidade angle in lesson 3.

Explain that the physical observation is external to this simulation. Given an
observed angle and a measured horizontal distance:

1. set the alidade to the supplied angle;
2. read the shadow-square ratio;
3. choose *umbra recta* or *umbra versa* according to which gives the useful
   ratio;
4. calculate the object's height.

**Checked outcome:** the learner calculates a height from two worked
measurements and verifies that a 45° line meets the square's corner and
represents a 1:1 ratio.

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
