# Astrolabe Simulator

An interactive, procedural-SVG planispheric astrolabe. It includes northern latitude plates, a rotating rete and rule, a fully engraved back with a movable alidade, location controls, and plain-language guidance.

## Use

Choose a city or enter a latitude and longitude, then select the nearest plate. The mismatch message explains the expected reading error. Drag the rete and rule on the front or the alidade on the back; arrow keys move a focused part by 1°, Shift+arrow by 10°, and Home returns it to 0°.

The stable `window.astrolabe` API exposes the serializable state and actions for tutorials and host pages.

## Accuracy

The plate geometry is an exact stereographic construction. Star positions are a compact J2000 catalogue without precession, atmospheric refraction is omitted, obliquity is fixed, and solar longitude is approximate. The finite plates are northern constructions; southern locations therefore carry an explicit limitation warning. This widget is educational and does not claim observational precision.

## Development

This widget uses Preact, Vite, TypeScript, bundled EB Garamond fonts, and no remote runtime data or assets.
