# Astrolabe Simulator

An interactive, procedural-SVG planispheric astrolabe. It includes northern latitude plates, a rotating rete and declination rule, a fully engraved back with a movable two-arm alidade and equation-of-time loop, location controls, and plain-language guidance.

## Use

Choose a city or enter a latitude and longitude, then select the nearest plate. The mismatch message explains the expected reading error. Drag the rete and rule on the front or the alidade on the back; arrow keys move a focused part by 1°, Shift+arrow by 10°, and Home returns it to 0°.

The current face, location, plate, rotations, and hidden layers are reflected
in the URL. Refreshing or sharing that URL restores the same configuration.

The stable `window.astrolabe` API exposes the serializable state and actions for tutorials and host pages.

### Reading unequal hours on the back

The upper half is a traditional double horary quadrant. Its semicircle is
divided every 15° and its six distinct curves are exact circles through the
pivot and the matching division point; mirrored labels make them readable as
hours I–XII.

Determine the Sun's noon altitude for the date. Rotate the alidade to that
altitude and note its intersection with curve VI. Preserve that distance from
the pivot, rotate to the observed altitude, and interpolate between the curves:
read I–VI before noon and the mirrored VI–XII after noon. For example, the
published July 14 exercise uses a 70° noon altitude and a later 27.5° altitude,
which reads approximately hour X.

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
