// The simple shapes (roundel, annulet, billet, lozenge, goutte, cross crosslet, estoile, spark): how they are drawn, worded and told
// apart, and the SCA names that stand for them.


import { describe, expect, it } from 'vitest';
import { CHARGES, NAMED_TINCTURE_CHARGES, blazon, buildSearchText, chargesInCategory, differences, matchesWords, queryWords, gloss, structuralIssues, tinctureIssues, unsupportedIssues, type Design } from '../src/lib/heraldry';
import { explainMatch } from './sca/match';
import { normaliseBlazon } from './sca/normalise';
import { arms, charge, group, nd } from './helpers';

const SHAPES = ['roundel', 'annulet', 'billet', 'lozenge', 'goutte', 'cross-crosslet', 'estoile', 'spark'] as const;
const on = (id: string, paint: string, count = 3) => nd(arms('azure', group(charge(id), paint, { count })));
const searchText = (design: Design) => buildSearchText({ displayName: '', blazon: blazon(design), design });
const between = (a: unknown, b: unknown) => differences(nd(a), nd(b)).map((d) => `${d.attr}:${d.kind}:${d.rule}`);


describe('the shapes', () => {
  it('are charges in the Shapes category that the builder draws without a gap', () => {
    const shapes = chargesInCategory('geometric').map((m) => m.id);
    for (const id of SHAPES) {
      expect(shapes).toContain(id);
      const d = on(id, 'or');
      expect(unsupportedIssues(d), id).toEqual([]);
      expect([...structuralIssues(d), ...tinctureIssues(d)], id).toEqual([]);
    }
  });

  it('are worded with their plain names, "crosses crosslet" in the plural', () => {
    expect(blazon(on('roundel', 'or'))).toBe('Azure, three roundels Or.');
    expect(blazon(on('cross-crosslet', 'or'))).toBe('Azure, three crosses crosslet Or.');
    expect(blazon(on('estoile', 'argent', 1))).toBe('Azure, an estoile argent.');
    expect(gloss(on('goutte', 'gules', 2))).toContain('drops');
  });

  it('are found by everyday words and by the SCA names for the roundels and gouttes', () => {
    const found = (d: Design, query: string) => matchesWords(searchText(d), queryWords(query));
    expect(found(on('roundel', 'or'), 'bezant')).toBe(true);
    expect(found(on('goutte', 'gules'), 'teardrop')).toBe(true);
    expect(found(on('goutte', 'gules'), 'bezant')).toBe(false);
  });

  it('keep the type classes: the roundel and the goutte differ from the rose, the estoile from the mullet only by a DC', () => {
    expect(between(arms('azure', group(charge('roundel'), 'or')), arms('azure', group(charge('rose'), 'or')))).toContain('type:sc:A5E2');
    expect(CHARGES.estoile.typeClass).toBe(CHARGES.mullet.typeClass);
  });
});


describe('the SCA names', () => {
  it('turn the named roundels and gouttes into the charge and its tincture', () => {
    expect(normaliseBlazon('Azure, three bezants.')).toBe('azure, three roundels or');
    expect(normaliseBlazon('Azure, three bezants Or.')).toBe('azure, three roundels or');
    expect(normaliseBlazon('Argent, a goutte de sang.')).toBe('argent, a goutte gules');
    expect(normaliseBlazon("Vert, two gouttes d'eau.")).toBe('vert, two gouttes argent');
    expect(normaliseBlazon('Sable, three torteaux.')).toBe('sable, three roundels gules');
  });

  it('put the tincture after the arrangement and leave it out when the next group states the same one', () => {
    expect(normaliseBlazon('Argent, six pellets in annulo.')).toBe('argent, six roundels in annulo sable');
    expect(normaliseBlazon('Sable, a bezant and in chief three mullets Or.')).toBe('sable, a roundel, in chief three mullets or');
    expect(normaliseBlazon('Azure, in pale a plate and a mullet argent.')).toBe('azure, in pale a roundel and a mullet argent');
    expect(normaliseBlazon('Per fess sable and argent, in pale a bezant and a torteau.')).toBe('per fess sable and argent, in pale a roundel or and a roundel gules');
    expect(normaliseBlazon('Or, three lock-plates gules.')).toBe('or, three lock-plates gules');
  });

  it('name each tincture once', () => {
    const tinctures = NAMED_TINCTURE_CHARGES.filter((n) => n.charge === 'roundel').map((n) => n.tincture);
    expect(new Set(tinctures)).toEqual(new Set(['or', 'argent', 'gules', 'azure', 'sable', 'vert', 'purpure']));
  });

  it('are matched to the design the widget words as the charge: three bezants are three roundels Or', () => {
    const m = explainMatch('Azure, three bezants.');
    expect(m.status).toBe('match');
    expect(blazon(m.match!.design!)).toBe('Azure, three roundels Or.');
    expect(explainMatch('Gules, a bend between two plates.').status).toBe('match');
  });

  it('read "estoille", "crosslet" and "cross crosslet" as the estoile and the cross crosslet', () => {
    expect(explainMatch('Vert, an estoille argent.').status).toBe('match');
    expect(explainMatch('Sable, three crosslets Or.').match!.design!.groups[0].item).toMatchObject({ k: 'charge', charge: 'cross-crosslet' });
    expect(explainMatch('Sable, a cross crosslet Or.').status).toBe('match');
  });
});
