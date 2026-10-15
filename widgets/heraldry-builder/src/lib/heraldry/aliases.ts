// Names the SCA gives to a charge of one fixed tincture: a bezant is a roundel Or, a goutte de sang a goutte gules
// (SENA Glossary of Terms; RULES-B §2.4). The widget draws the charge and states its tincture ("three roundels Or");
// the names are for reading and searching, not for blazoning.

import type { ChargeId } from './charges';
import type { Tincture } from './tinctures';

export interface NamedCharge {
  word: string;
  plural: string;
  charge: ChargeId;
  tincture: Tincture;
}

const named = (word: string, plural: string, charge: ChargeId, tincture: Tincture): NamedCharge => ({ word, plural, charge, tincture });

export const NAMED_TINCTURE_CHARGES: readonly NamedCharge[] = [
  named('bezant', 'bezants', 'roundel', 'or'),
  named('plate', 'plates', 'roundel', 'argent'),
  named('torteau', 'torteaux', 'roundel', 'gules'),
  named('hurt', 'hurts', 'roundel', 'azure'),
  named('pellet', 'pellets', 'roundel', 'sable'),
  named('ogress', 'ogresses', 'roundel', 'sable'),
  named('pomme', 'pommes', 'roundel', 'vert'),
  named('golpe', 'golpes', 'roundel', 'purpure'),
  named("goutte d'or", "gouttes d'or", 'goutte', 'or'),
  named("goutte d'eau", "gouttes d'eau", 'goutte', 'argent'),
  named('goutte de sang', 'gouttes de sang', 'goutte', 'gules'),
  named('goutte de larmes', 'gouttes de larmes', 'goutte', 'azure'),
  named('goutte de poix', 'gouttes de poix', 'goutte', 'sable'),
];
