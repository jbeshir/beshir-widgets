// Treatments as paints: a tincture with a pattern of lines in another ("argent masoned sable", "gules scaly Or"). SENA counts
// the treatment as part of the tincture it lies on (GoT "Field Treatment"), so only its words and its look are needed here.


import { TINCTURE_GLOSS, tinctureWord } from './tinctures';
import type { TreatedPaint } from './design';
import type { Treatment } from './divisions';


/** What a treatment draws, for the plain-words gloss. */
const TREATMENT_LOOK: Record<Treatment, string> = {
  masoned: 'brick-wall lines',
  scaly: 'fish-scale outlines',
  papellony: 'scale outlines, each with a smaller scale inside',
  fretty: 'a lattice',
  plumetty: 'feathers',
};


/** A treated tincture as a blazon words it: "argent masoned sable". */
export function treatedName(p: TreatedPaint): string {
  return `${tinctureWord(p.ground.t)} ${p.treatment} ${tinctureWord(p.ink)}`;
}


/** A treated tincture in plain words, its look in brackets: "argent masoned sable (white with black brick-wall lines)". */
export function treatedGloss(p: TreatedPaint): string {
  return `${treatedName(p)} (${TINCTURE_GLOSS[p.ground.t]} with ${TINCTURE_GLOSS[p.ink]} ${TREATMENT_LOOK[p.treatment]})`;
}
