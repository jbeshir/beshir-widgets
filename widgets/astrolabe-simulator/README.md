# Astrolabe Simulator

An interactive, procedural-SVG planispheric astrolabe. It includes northern latitude plates, a rotating rete and declination rule, a fully engraved back with a movable two-arm alidade and equation-of-time loop, location controls, and plain-language guidance.

## Use

Choose a city or enter a latitude and longitude, then select the nearest plate. The mismatch message explains the expected reading error. Drag the rete and rule on the front or the alidade on the back; arrow keys move a focused part by 1°, Shift+arrow by 10°, and Home returns it to 0°.

The current face, location, plate, rotations, and hidden layers are reflected
in the URL. Refreshing or sharing that URL restores the same configuration.

The stable `window.astrolabe` API exposes the serializable state and actions for tutorials and host pages.

## Accuracy

The plate geometry is an exact stereographic construction. Star positions are a compact J2000 catalogue without precession, atmospheric refraction is omitted, obliquity is fixed, and solar longitude and equation-of-time values are approximate. The finite plates are northern constructions; southern locations therefore carry an explicit limitation warning. This widget is educational and does not claim observational precision.

## Development

This widget uses Preact, Vite, TypeScript, bundled EB Garamond fonts, and no remote runtime data or assets.

Run `npm test` for the stereographic-projection geometry suite and `npm run build`
for the production bundle. CI runs the geometry suite only when this widget is
included in the changed-widget build matrix.
