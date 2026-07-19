# Final cohesion plan

1. Replace the prototype with one deterministic simulation owning authored rooms, gates, enemies, hazards, upgrades, boss patterns, cooldowns, outcomes, and persistence events.
2. Normalize keyboard, pointer, and raw TouchEvent input around independent IDs; preserve cancellation and simultaneous movement/action holds.
3. Validate the closed scenario schema and token grammar, fresh/reload isolation, manual scheduler, usable readiness, real event routes, and explicit effect assertions.
4. Remove test surfaces at build time and replay every boot/core scenario against exact offline production bytes.
5. Run exact build/playtest/production gates and native validator/render/journey/theme gates, then record fixed/deferred findings and stop reason.
