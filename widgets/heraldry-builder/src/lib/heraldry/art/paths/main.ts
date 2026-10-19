// The art of the main chunk: the path strings of core.ts (CORE_ART_IDS) and of the generated charges (art/procedural, traced when
// their modules load). Every other charge's are in its category's module.

import { PATHS_CORE } from './core';
import { PATHS_STARS } from '../procedural/stars';
import { PATHS_SHAPES } from '../procedural/shapes';
import { PATHS_FOILS } from '../procedural/foils';
import { PATHS_KNOTS } from '../procedural/knots';
import { PATHS_CROSSES } from '../procedural/crosses';

export const MAIN_ART = { ...PATHS_CORE, ...PATHS_STARS, ...PATHS_SHAPES, ...PATHS_FOILS, ...PATHS_KNOTS, ...PATHS_CROSSES };
