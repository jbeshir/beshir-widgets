/**
 * 27-star J2000 rete catalog (FINDINGS §4). RA/Dec are in degrees; `onPlate`
 * mirrors the Tropic-of-Capricorn cutoff (`decDeg >= -23.44`) so Antares and
 * Fomalhaut — the two catalog stars south of the rim — are excluded from the
 * rete and can be footnoted in the info panel instead.
 */

export interface Star {
  bayer: string;
  name: string;
  traditional: string;
  raDeg: number;
  decDeg: number;
  onPlate: boolean;
  label?: boolean;
}

const OFF_PLATE_DEC_LIMIT = -23.44;

function star(
  bayer: string,
  name: string,
  traditional: string,
  raDeg: number,
  decDeg: number,
  label?: boolean,
): Star {
  return { bayer, name, traditional, raDeg, decDeg, onPlate: decDeg >= OFF_PLATE_DEC_LIMIT, label };
}

export const STARS: Star[] = [
  star('α Tau', 'Aldebaran', 'Aldebaran (Al Dabarān)', 68.98, 16.509, true),
  star('β Ori', 'Rigel', 'Rigel (Rijl)', 78.634, -8.202, true),
  star('α Aur', 'Capella', 'Alhaiot', 79.172, 45.998, true),
  star('γ Ori', 'Bellatrix', 'Bellatrix', 81.283, 6.35),
  star('α Ori', 'Betelgeuse', 'Yad al-Jauzā', 88.793, 7.407, true),
  star('α CMa', 'Sirius', 'Alhabor (Dog Star)', 101.287, -16.716, true),
  star('α CMi', 'Procyon', 'Algomeyla', 114.825, 5.225, true),
  star('α Gem', 'Castor', 'Rasalgeuze', 113.65, 31.888),
  star('β Gem', 'Pollux', 'Aldiran', 116.329, 28.026),
  star('α Leo', 'Regulus', 'Cor Leonis / Kalb', 152.093, 11.967, true),
  star('β Leo', 'Denebola', 'Denebola', 177.265, 14.572),
  star('α UMa', 'Dubhe', 'Dubhe', 165.932, 61.751),
  star('η UMa', 'Alkaid', 'Benetnasch', 206.885, 49.313),
  star('α Vir', 'Spica', 'Azimech / Alaraph', 201.298, -11.161, true),
  star('α Boo', 'Arcturus', 'Alramek', 213.915, 19.182, true),
  star('α CrB', 'Alphecca', 'Alfeta', 233.672, 26.715),
  star('α Sco', 'Antares', 'Alacrab (Calbalacrab)', 247.352, -26.432, true),
  star('α Oph', 'Rasalhague', 'Rasalhague', 263.734, 12.56),
  star('α Lyr', 'Vega', 'Wega', 279.234, 38.784, true),
  star('α Aql', 'Altair', 'Altair (Alkair)', 297.696, 8.868, true),
  star('α Cyg', 'Deneb', 'Deneb Adige', 310.358, 45.28, true),
  star('α PsA', 'Fomalhaut', 'Fomalhaut (Difda)', 344.413, -29.622, true),
  star('α And', 'Alpheratz', 'Sirrah / Mirac-adj.', 2.097, 29.09),
  star('α Ari', 'Hamal', 'Hamal (El Nath)', 31.793, 23.462),
  star('β Per', 'Algol', 'Algol (Ras al-Ghul)', 47.042, 40.956),
  star('α Per', 'Mirfak', 'Mirfak (Algenib)', 51.081, 49.861),
  star('β Cas', 'Caph', 'Caph', 2.294, 59.15),
];
