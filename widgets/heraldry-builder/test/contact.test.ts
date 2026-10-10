// The owner's email address and the public Discord username: the one set of rules the Worker
// enforces and the SPA checks inline.
import { describe, it, expect } from 'vitest';
import { EMAIL_MAX, NO_CONTACT, cleanContact, cleanDiscord, cleanEmail } from '../src/lib/heraldry';

describe('cleanDiscord', () => {
  const valid: Array<[string, string]> = [
    ['@Name', 'name'],
    ['alex.smith', 'alex.smith'],
    ['ALEX_Smith99', 'alex_smith99'],
    ['  @kettle.keeper  ', 'kettle.keeper'],
    ['ab', 'ab'],
    ['a'.repeat(32), 'a'.repeat(32)],
    ['_.', '_.'],
    ['a.b.c', 'a.b.c'],
  ];
  for (const [raw, value] of valid) {
    it(`accepts ${JSON.stringify(raw)} as ${JSON.stringify(value)}`, () => {
      expect(cleanDiscord(raw)).toEqual({ ok: true, value });
    });
  }

  const invalid = ['a..b', 'a', '@a', 'a'.repeat(33), 'with space', 'émile', 'name#1234', 'dash-ed', '@@name', 'a...b', '..'];
  for (const raw of invalid) {
    it(`rejects ${JSON.stringify(raw)}`, () => {
      expect(cleanDiscord(raw).ok).toBe(false);
    });
  }

  it('treats missing, null, blank and a bare @ as no username', () => {
    for (const raw of [undefined, null, '', '   ', '@']) expect(cleanDiscord(raw)).toEqual({ ok: true, value: null });
  });

  it('rejects non-text', () => {
    expect(cleanDiscord(42).ok).toBe(false);
  });
});

describe('cleanContact', () => {
  it('reads the per-kind object, defaulting to no contact', () => {
    expect(cleanContact(undefined)).toEqual({ ok: true, value: NO_CONTACT });
    expect(cleanContact(null)).toEqual({ ok: true, value: NO_CONTACT });
    expect(cleanContact({})).toEqual({ ok: true, value: { discord: null } });
    expect(cleanContact({ discord: '@Rowan' })).toEqual({ ok: true, value: { discord: 'rowan' } });
  });

  it('names the field of a bad value, and refuses the old free-text form', () => {
    expect(cleanContact({ discord: 'a..b' })).toMatchObject({ ok: false, field: 'discord' });
    expect(cleanContact('by the fire pit')).toMatchObject({ ok: false, field: 'discord' });
    expect(cleanContact(['x'])).toMatchObject({ ok: false, field: 'discord' });
  });
});

describe('cleanEmail', () => {
  it('trims and lowercases the whole address, and nothing more', () => {
    expect(cleanEmail('  Alex.Smith+Party@Example.COM ')).toEqual({ ok: true, value: 'alex.smith+party@example.com' });
    expect(cleanEmail('a@b.co')).toEqual({ ok: true, value: 'a@b.co' });
  });

  it('is required', () => {
    for (const raw of [undefined, null, '', '   ', 7]) expect(cleanEmail(raw).ok).toBe(false);
  });

  it('rejects addresses that are not shaped like one', () => {
    for (const raw of ['alex', 'alex@', '@example.com', 'alex@example', 'a b@example.com', 'a@b@c.com', 'alex@example..com', 'alex@.example.com', 'a\u0000b@example.com']) {
      expect(cleanEmail(raw).ok, raw).toBe(false);
    }
  });

  it('rejects characters a mail API could read as a name, a quote or a second address', () => {
    for (const raw of ['x<victim@b.com>', '"x"@b.com', 'a,b@c.com', 'a(b)@c.com', 'a@b.com>', 'a@<b.com', 'a@b,c.com']) {
      expect(cleanEmail(raw).ok, raw).toBe(false);
    }
  });

  it('accepts the usual local-part punctuation', () => {
    for (const raw of ["o'brien@example.com", 'first.last+tag@example.co.uk', 'a_b-c@example.org', 'a/b=c@example.com']) {
      expect(cleanEmail(raw).ok, raw).toBe(true);
    }
  });

  it('caps the length', () => {
    const local = 'a'.repeat(64);
    const domain = `${'b'.repeat(60)}.${'c'.repeat(60)}.${'d'.repeat(60)}.com`;
    expect(cleanEmail(`${local}@${domain}`)).toMatchObject({ ok: true });
    expect(cleanEmail(`${'a'.repeat(65)}@example.com`).ok).toBe(false);
    expect(cleanEmail(`${local}@${'e'.repeat(EMAIL_MAX)}.com`).ok).toBe(false);
  });
});
