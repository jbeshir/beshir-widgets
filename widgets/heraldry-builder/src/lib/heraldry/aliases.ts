// Names the SCA gives to a charge of one fixed tincture: a bezant is a roundel Or, a goutte de sang a goutte gules
// (SENA Glossary of Terms; RULES-B §2.4). The widget draws the charge and states its tincture ("three roundels Or");
// the names are for reading and searching, not for blazoning. The names of a semy are different: the widget words a semy with them.

import { CHARGES, type ChargeId } from './charges';
import { tinctureWord, type Tincture } from './tinctures';

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


/** A name for a semy of one charge ("crusilly" strews cross crosslets); a name that fixes the tincture ("bezanty") is Or and states none. */
export interface SemyName {
  word: string;
  charge: ChargeId;
  tincture: Tincture | null;
}


const semyName = (word: string, charge: ChargeId, tincture: Tincture | null): SemyName => ({ word, charge, tincture });


/** The names the widget words a semy with (RULES-B §2.4); every other semy is "semy of <charges> <tincture>". */
export const SEMY_NAMES: readonly SemyName[] = [
  semyName('semy-de-lys', 'fleur-de-lis', null),
  semyName('crusilly', 'cross-crosslet', null),
  semyName('billety', 'billet', null),
  semyName('mullety', 'mullet', null),
  semyName('estencely', 'spark', null),
  semyName('bezanty', 'roundel', 'or'),
  semyName('platy', 'roundel', 'argent'),
  semyName('hurty', 'roundel', 'azure'),
  semyName('pellety', 'roundel', 'sable'),
  semyName('semy of torteaux', 'roundel', 'gules'),
  semyName("goutty d'Or", 'goutte', 'or'),
  semyName("goutty d'eau", 'goutte', 'argent'),
  semyName('goutty de sang', 'goutte', 'gules'),
  semyName('goutty de larmes', 'goutte', 'azure'),
  semyName('goutty de poix', 'goutte', 'sable'),
];


/** Other spellings and names of the same semys, as the College writes them (in lower case): each reads as what is on its right. */
export const SEMY_SPELLINGS: Readonly<Record<string, string>> = {
  'semy-de-lis': 'semy-de-lys', 'semi-de-lys': 'semy-de-lys', 'semee-de-lys': 'semy-de-lys', crusily: 'crusilly', billetty: 'billety', mulletty: 'mullety',
  pelletty: 'pellety', estencelly: 'estencely', estencele: 'estencely', 'estencelé': 'estencely',
  golpy: 'semy of roundels purpure', pommy: 'semy of roundels vert', gouty: 'semy of gouttes', goutty: 'semy of gouttes', gutty: 'semy of gouttes',
  crescenty: 'semy of crescents', estoily: 'semy of estoiles', estoilly: 'semy of estoiles', annuletty: 'semy of annulets', annulety: 'semy of annulets',
};


/** The semy of a charge in a tincture (or counterchanged, over a divided field) as the blazon words it: "crusilly argent", "bezanty", "semy of lions gules". */
export function semyPhrase(charge: ChargeId, ink: Tincture | 'counterchanged'): string {
  const inkWord = ink === 'counterchanged' ? ink : tinctureWord(ink);
  const named = SEMY_NAMES.find((n) => n.charge === charge && n.tincture === ink) ?? SEMY_NAMES.find((n) => n.charge === charge && n.tincture === null);
  if (!named) return `semy of ${CHARGES[charge].plural} ${inkWord}`;
  return named.tincture === null ? `${named.word} ${inkWord}` : named.word;
}
