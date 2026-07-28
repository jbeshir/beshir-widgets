# Astrolabe Guide lesson plan

## Teaching contract

Every lesson must:

1. Be named for a task someone can perform with an astrolabe.
2. List the earlier lessons it relies on.
3. Introduce every value before asking the learner to use it.
4. Explain why each movement is made, not merely where a part should end up.
5. Demonstrate each new physical manipulation on the simulated instrument.
6. Give the learner the same manipulation to perform, with a visible stopping
   condition and a checked result.
7. End by interpreting the reading in the language of the original task.

A lesson must not expose computed rete, rule, or alidade angles as unexplained
inputs. Those angles may be test fixtures internally, but the learner should
arrive at them through the engraved scales and the operations already taught.

Lessons are published strictly in the order below. An implemented advanced
demonstration does not move ahead of a missing prerequisite: it remains a
planned, unavailable lesson until every prerequisite is available. In
particular, the existing Sirius and back unequal-hour demonstrations move down
the course rather than asking a new learner to begin with a prepared
instrument.

Each lesson step therefore needs five content fields:

- **Purpose:** what this step contributes to the operation.
- **Instruction:** the physical action and the part or scale to use.
- **Demonstration:** the same action animated on the instrument.
- **Stop cue:** the visible alignment or scale crossing that completes it.
- **Meaning:** what the resulting position tells the learner.

## Course sequence

### 1. Preparing an astrolabe for your latitude

**Prerequisites:** none.

Choose the plate nearest the observation latitude, distinguish the mater from
the removable plate, and interpret the latitude-mismatch warning. Demonstrate
changing from one plate to another and show which plate engraving changes.

**Checked outcome:** the learner selects the correct available plate for a
given city and can state why a mismatched plate changes horizon and altitude
readings.

### 2. Identifying the fixed and moving parts

**Prerequisite:** Preparing an astrolabe for your latitude.

Identify the fixed plate, rotating rete, front rule, back alidade, limb, and
pivot. Demonstrate the rete moving while the horizon and altitude circles stay
fixed, then the rule moving independently of both.

**Checked outcome:** the learner moves each part separately and identifies
which markings represent the local sky and which represent the celestial
sphere.

### 3. Reading altitude and azimuth on the plate

**Prerequisite:** Identifying the fixed and moving parts.

Introduce the horizon, zenith, altitude circles, and azimuth curves in that
order. Demonstrate reading several marked points, including one on the horizon
and one between labelled curves.

**Checked outcome:** the learner reads the approximate altitude and azimuth of
a highlighted point without moving the rete.

### 4. Measuring the altitude of the Sun or a star

**Prerequisite:** Identifying the fixed and moving parts.

Turn to the back, suspend the instrument conceptually, and use the alidade's
reading edge to represent a sighting. Explain that a physical astrolabe uses
sights and that direct viewing of the Sun is unsafe; sunlight is aligned by
its shadow. Demonstrate a sighting angle and read it on the degree scale.

**Checked outcome:** the learner sets the alidade to a supplied observation and
reads its altitude.

### 5. Finding the Sun's zodiac position for a date

**Prerequisites:** Identifying the fixed and moving parts.

On the back, find a date on the calendar scale and follow the same radial line
to the zodiac scale. Define solar longitude as the Sun's position around the
ecliptic, then turn to the front and locate the same degree on the ecliptic
ring.

**Checked outcome:** the learner transfers a date from the back calendar scale
to the corresponding point on the front ecliptic.

### 6. Setting the sky for a given date and time

**Prerequisites:** Finding the Sun's zodiac position for a date; reading the
front limb; Identifying the fixed and moving parts.

Place the rule at the requested local apparent solar time on the limb. Rotate
the rete—not the rule—until the Sun's ecliptic position for the date lies under
the rule. Explain that this single alignment fixes the orientation of the whole
star map for that place, date, and solar time.

If the input is mean clock time, first apply the equation-of-time correction
and longitude correction in lessons 12 and 13; otherwise label the supplied
time explicitly as local apparent solar time.

**Checked outcome:** the learner sets an independently chosen date and local
apparent solar time without being given a rete angle.

### 7. Locating a star at a given date and time

**Prerequisites:** Setting the sky for a given date and time; Reading altitude
and azimuth on the plate.

Set the plate, date, and local apparent solar time using the earlier
operations. Find the named star pointer on the rete. Read the pointer's
altitude and azimuth against the fixed plate; do not rotate the rete merely to
place the star at a desired position.

The demonstration uses Sirius as one worked example, but the operation and
lesson title remain star-independent.

**Checked outcome:** the learner locates a named star and reports whether it is
above the horizon, with its approximate altitude and azimuth.

The current “prepared astrolabe” Sirius exercise is implementation material for
this lesson, not a separate course shortcut. Its geometry fixture and animation
can be reused here only after lessons 1–6 are available.

### 8. Finding the time from an observed star

**Prerequisites:** Measuring the altitude of the Sun or a star; Finding the
Sun's zodiac position for a date; Reading altitude and azimuth on the plate.

Measure a known star's altitude on the back. On the front, rotate the rete
until that star pointer meets the measured altitude circle on the correct
azimuth side. Place the rule through the Sun's ecliptic position for the date
and read local apparent solar time on the limb.

**Checked outcome:** the learner derives time from a supplied star observation
without being given either rotation angle.

### 9. Finding the time from the Sun's altitude

**Prerequisites:** Measuring the altitude of the Sun or a star; Finding the
Sun's zodiac position for a date.

Measure the Sun's altitude, find the Sun's date position on the ecliptic, and
rotate the rete until that point meets the observed altitude circle on the
morning or afternoon side. Place the rule over the Sun point and read local
apparent solar time.

**Checked outcome:** the learner obtains the two possible times and chooses
morning or afternoon from the observation context.

### 10. Finding sunrise, sunset, and day length

**Prerequisites:** Finding the Sun's zodiac position for a date; Setting the
sky for a given date and time.

Rotate the rete until the Sun's date position meets the eastern horizon for
sunrise and the western horizon for sunset. Use the rule and limb to read both
times, then find the interval between them.

**Checked outcome:** the learner reads sunrise, sunset, and approximate day
length for the selected plate and date.

### 11. Finding when a star rises, culminates, and sets

**Prerequisites:** Locating a star at a given date and time; Reading altitude
and azimuth on the plate.

Rotate the rete until a chosen star meets the eastern horizon, the meridian,
and the western horizon. At each position, place the rule through the Sun's
date position and read the time.

**Checked outcome:** the learner identifies the three events and recognizes a
circumpolar star when no horizon crossing exists.

### 12. Reading the equation of time for a date

**Prerequisite:** Finding the Sun's zodiac position for a date.

Use the back calendar/zodiac correspondence and the equation-of-time arm to
find the date's crossing with the equation-of-time loop. Read the signed
difference between apparent solar time and mean solar time, using the sign
convention engraved by this simulator.

**Checked outcome:** the learner reads and applies a positive and a negative
correction.

### 13. Converting clock time to local apparent solar time

**Prerequisite:** Reading the equation of time for a date.

Combine the equation-of-time correction with the longitude difference from
the clock time zone's reference meridian. Keep civil daylight-saving rules
outside the instrument and state them as a separate preliminary correction.

**Checked outcome:** the learner converts a supplied civil time into the solar
time used to set the astrolabe.

### 14. Reading unequal hours on the front

**Prerequisites:** Finding the Sun's zodiac position for a date; Setting the
sky for a given date and time.

Use the Sun's ecliptic point by night and the point opposite it by day, then
read its position against the unequal-hour curves below the horizon. Explain
why daylight and darkness are each divided into twelve seasonally varying
hours.

**Checked outcome:** the learner identifies the correct solar point and
interpolates an unequal-hour reading.

### 15. Reading unequal hours on the back

**Prerequisites:** Measuring the altitude of the Sun or a star; Reading
altitude on the back.

Set the alidade to the Sun's noon altitude, retain the center-to-curve-VI
distance, set the observed altitude, and find the same distance along the new
reading edge. Read the morning or afternoon sequence and compare the result
with the front construction.

**Checked outcome:** the learner completes the geometric transfer and explains
why the engraved result is approximate between sunrise, noon, and sunset.

The current worked 70°/27.5° construction supplies the demonstration and test
fixture for this lesson, but is not published ahead of lessons 1–5 and the
front unequal-hours lesson.

### 16. Measuring a height with the shadow square

**Prerequisite:** Measuring the altitude of the Sun or a star.

Set the alidade to the observed top of an object, read the shadow-square ratio,
and combine it with a measured horizontal distance. Cover both *umbra recta*
and *umbra versa* and explain when each scale gives the more convenient ratio.

**Checked outcome:** the learner calculates a height from two supplied
measurements and verifies the 45° corner case.

## Assessment and test requirements

Each implemented lesson needs:

- a unit test proving every step's prerequisites occur earlier in the course;
- a unit test proving each newly introduced control has a demonstration,
  learner action, stop cue, and checked outcome;
- geometry fixtures for the worked example, derived from the same pure
  functions that render the instrument;
- a journey that starts from the preceding lesson's final knowledge state and
  completes the operation without entering an unexplained angle;
- a journey proving Back, Replay, interruption recovery, refresh, and a shared
  lesson URL preserve a coherent step;
- copy tests rejecting learner-visible implementation terms such as
  `fixture`, `deterministic`, `endpoint`, `API`, and `solver`;
- a second worked value for every calculation lesson so tests do not merely
  encode the displayed example.

## Sources informing the sequence

- [Whipple Museum: Parts of an Astrolabe](https://www.whipplemuseum.cam.ac.uk/explore-whipple-collections/astronomy/medieval-astrolabe/parts-astrolabe)
  distinguishes the fixed latitude plate, rotating rete, rule, and sighting
  alidade.
- [History of Science Museum: Using the Astrolabe](https://www.mhs.ox.ac.uk/students/03to04/Astrolabes/Starholder_astronomy.html)
  describes measuring altitude, transferring a calendar date to the ecliptic,
  and finding sunrise.
- [Epact: Scientific Instruments of Medieval and Renaissance Europe](https://www.mhs.ox.ac.uk/epact/article.php?ArticleID=2)
  gives the operational chain from observed altitude and date, through front
  alignment, to an equal- or unequal-hour reading.
