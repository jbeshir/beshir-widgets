/**
 * Finite curated latitude-plate set (FINDINGS §8, PLAN §11): the seven
 * classical climata (Ptolemy, Almagest 2.12) plus the equator and a few
 * modern round latitudes for coverage. Modern rounds that sit within ~1° of
 * an existing clima are dropped as near-duplicates (35→Rhodes 36.00,
 * 40→Rome 40.93) rather than shipping two near-identical plates.
 */

export interface Plate {
  id: string;
  label: string;
  latitude: number;
  place?: string;
}

export const PLATES: Plate[] = [
  { id: 'equator', label: 'Equator (φ=0°)', latitude: 0, place: 'Equator' },
  { id: 'clima-i-meroe', label: 'Clima I — 16.44°', latitude: 16.44, place: 'Meroë' },
  { id: 'clima-ii-syene', label: 'Clima II — 23.85°', latitude: 23.85, place: 'Syene' },
  { id: 'clima-iii-alexandria', label: 'Clima III — 30.37°', latitude: 30.37, place: 'Alexandria' },
  { id: 'clima-iv-rhodes', label: 'Clima IV — 36.00°', latitude: 36.0, place: 'Rhodes' },
  { id: 'clima-v-rome', label: 'Clima V — 40.93°', latitude: 40.93, place: 'Rome' },
  { id: 'clima-vi', label: 'Clima VI — 45.02°', latitude: 45.02, place: 'mid-Black-Sea' },
  { id: 'clima-vii-borysthenes', label: 'Clima VII — 48.53°', latitude: 48.53, place: 'Borysthenes' },
  { id: 'round-50', label: '50° N', latitude: 50 },
  { id: 'round-55', label: '55° N', latitude: 55 },
  { id: 'round-60', label: '60° N', latitude: 60 },
];

/**
 * Nearest plate by latitude magnitude (PLAN §4): southern-hemisphere
 * locations pick the nearest northern plate, since the set only carries
 * northern-astrolabe plates.
 */
export function nearestPlate(latDeg: number): Plate {
  const target = Math.abs(latDeg);
  let best = PLATES[0];
  let bestDiff = Math.abs(target - best.latitude);
  for (const plate of PLATES) {
    const diff = Math.abs(target - plate.latitude);
    if (diff < bestDiff) {
      best = plate;
      bestDiff = diff;
    }
  }
  return best;
}
