// Reads the SCA Ordinary & Armorial dump (test/fixtures/sca/oanda.db) in place. The file is
// Latin-1, opens with a copyright notice ending at "END OF NOTICE.", then holds one `|`-separated
// record per line: name|date|type|text|notes|heading|heading… (see oanda.sca.org/data_format.html).
// Only the armory records are kept. Node-only: the SCA test runs outside the workers pool.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const OANDA_PATH = fileURLToPath(new URL('../fixtures/sca/oanda.db', import.meta.url));

/** sha256 of the committed dump, as downloaded (LoARs thru 202607, update 260915). */
export const OANDA_SHA256 = '964ceffe9ad3ef3d5d48a771b317ad94ceec35f1136506be758fb3aae3e5f707';

/** Device, name-and-device, branch-name-and-device, badge, name-and-badge, augmentation, seal, regalia. */
export const ARMORY_TYPES = ['d', 'D', 'BD', 'b', 'B', 'a', 's', 'g'] as const;
export type ArmoryType = (typeof ARMORY_TYPES)[number];

export interface ArmoryRecord {
  /** `regid:N` from the notes; `line:<12 hex>` (sha256 of the whole line) if a record ever lacks one. */
  key: string;
  type: ArmoryType;
  /** The LoAR date field verbatim; a '-' in it means the record is no longer current. */
  date: string;
  blazon: string;
  /** Index headings (fields 6 onwards), coded via oanda.sca.org/my.cat. */
  headings: string[];
}

export function isCurrent(record: ArmoryRecord): boolean {
  return !record.date.includes('-');
}

export function oandaSha256(): string {
  return createHash('sha256').update(readFileSync(OANDA_PATH)).digest('hex');
}

let cached: ArmoryRecord[] | undefined;

/** Every armory record, current and obsolete, in file order. Parsed once per process. */
export function readArmory(): ArmoryRecord[] {
  if (cached) return cached;
  const text = new TextDecoder('latin1').decode(readFileSync(OANDA_PATH));
  const marker = 'END OF NOTICE.';
  const body = text.slice(text.indexOf(marker) + marker.length);
  const armory = new Set<string>(ARMORY_TYPES);
  const records: ArmoryRecord[] = [];
  for (const line of body.split('\n')) {
    const [, date, type, blazon, notes, ...headings] = line.split('|');
    if (!armory.has(type)) continue;
    const regid = /\(regid:(\d+)\)/.exec(notes ?? '');
    const key = regid ? `regid:${regid[1]}` : `line:${createHash('sha256').update(line).digest('hex').slice(0, 12)}`;
    records.push({ key, type: type as ArmoryType, date, blazon, headings: headings.filter(Boolean) });
  }
  cached = records;
  return records;
}

/** The current (not released, reblazoned or transferred) armory records. */
export function readCurrentArmory(): ArmoryRecord[] {
  return readArmory().filter(isCurrent);
}
