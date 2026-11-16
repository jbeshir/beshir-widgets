import { STARS } from '../data/stars';

/**
 * The `data-part` vocabulary (SYLLABUS §1.2). Every rendered element that the
 * course talks about carries `data-part="<id>"`; repeated engravings add one
 * instance attribute (`data-<key>="<value>"`). A `PartRef` names a part, or
 * one instance of it, and `partSelector` turns it into a CSS selector.
 */
export type PartFace = 'front' | 'back' | 'both' | 'controls';

const range = (from: number, to: number, step: number): number[] => {
  const values: number[] = [];
  for (let value = from; value <= to + 1e-9; value += step) values.push(Math.round(value * 10) / 10);
  return values;
};
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
const pad = (value: number): string => String(value).padStart(2, '0');
/** `MM-DD` for every day of the (non-leap) calendar ring. */
export const CALENDAR_DATES: readonly string[] = DAYS_IN_MONTH.flatMap((days, month) =>
  Array.from({ length: days }, (_, day) => `${pad(month + 1)}-${pad(day + 1)}`));
/** Lower-case catalogue id of a star, as written on `data-star`. */
export const starId = (name: string): string => name.toLowerCase().replace(/\s+/g, '-');

export interface PartInstance { readonly key: string; readonly values: readonly (number | string)[] }
export interface PartInfo { readonly face: PartFace; readonly instance?: PartInstance }

const part = (face: PartFace, instance?: PartInstance): PartInfo => (instance ? { face, instance } : { face });

/** Instance attribute (key) and value type of each instanced part. */
export interface PartInstances {
  'limb-degree-scale': { degree: number };
  'limb-hour-scale': { hour: number };
  almucantar: { altitude: number };
  'azimuth-line': { azimuth: number };
  'unequal-hour-line': { hour: number };
  'ecliptic-scale': { longitude: number };
  'star-pointer': { star: string };
  'calendar-scale': { date: string };
  'back-degree-scale': { degree: number };
  'altitude-scale': { altitude: number };
}

export const PART_IDS = [
  'mater', 'throne', 'pin', 'limb', 'limb-degree-scale', 'limb-hour-scale', 'plate', 'horizon', 'zenith',
  'almucantar', 'meridian-line', 'azimuth-line', 'equator', 'tropic-cancer', 'tropic-capricorn',
  'unequal-hour-line', 'rete', 'ecliptic-ring', 'ecliptic-edge', 'ecliptic-scale', 'star-pointer', 'rule',
  'rule-edge', 'back-degree-scale', 'altitude-scale', 'zodiac-scale', 'calendar-scale', 'back-axes',
  'shadow-square', 'umbra-versa', 'umbra-recta', 'eot-curve', 'horary-quadrant', 'alidade', 'alidade-edge',
  'alidade-minute-scale', 'face-toggle', 'plate-selector', 'plate-mismatch',
] as const;
export type PartId = (typeof PART_IDS)[number];

/** Parts that sit physically underneath others by construction: visibility checks need only a few visible samples. */
export const PARTIAL_COVERAGE: ReadonlySet<PartId> = new Set<PartId>(['mater', 'plate']);

export const PARTS: Readonly<Record<PartId, PartInfo>> = {
  mater: part('both'),
  throne: part('both'),
  pin: part('both'),
  limb: part('front'),
  'limb-degree-scale': part('front', { key: 'degree', values: range(0, 359, 1) }),
  'limb-hour-scale': part('front', { key: 'hour', values: range(0, 23, 1) }),
  plate: part('front'),
  horizon: part('front'),
  zenith: part('front'),
  almucantar: part('front', { key: 'altitude', values: range(10, 80, 10) }),
  'meridian-line': part('front'),
  'azimuth-line': part('front', { key: 'azimuth', values: range(0, 330, 30) }),
  equator: part('front'),
  'tropic-cancer': part('front'),
  'tropic-capricorn': part('front'),
  'unequal-hour-line': part('front', { key: 'hour', values: range(1, 11, 1) }),
  rete: part('front'),
  'ecliptic-ring': part('front'),
  'ecliptic-edge': part('front'),
  'ecliptic-scale': part('front', { key: 'longitude', values: range(0, 359.5, 0.5) }),
  'star-pointer': part('front', { key: 'star', values: STARS.filter((star) => star.onPlate).map((star) => starId(star.name)) }),
  rule: part('front'),
  'rule-edge': part('front'),
  'back-degree-scale': part('back', { key: 'degree', values: range(0, 359, 1) }),
  /** One instance per red numeral of the right-hand quadrant: where the alidade's minute arm reads a height set by turning up from 0. */
  'altitude-scale': part('back', { key: 'altitude', values: range(0, 90, 10) }),
  'zodiac-scale': part('back'),
  'calendar-scale': part('back', { key: 'date', values: CALENDAR_DATES }),
  'back-axes': part('back'),
  'shadow-square': part('back'),
  'umbra-versa': part('back'),
  'umbra-recta': part('back'),
  'eot-curve': part('back'),
  'horary-quadrant': part('back'),
  alidade: part('back'),
  'alidade-edge': part('back'),
  'alidade-minute-scale': part('back'),
  'face-toggle': part('controls'),
  'plate-selector': part('controls'),
  'plate-mismatch': part('controls'),
};

/** `{ part: 'almucantar', altitude: 30 }`: one instance of an instanced part. */
export type InstancePartRef = {
  [K in keyof PartInstances]: { readonly part: K } & Readonly<PartInstances[K]>;
}[keyof PartInstances];
/** A bare part id matches every instance; an object names a single instance. */
export type PartRef = PartId | InstancePartRef;

/** The one place an instance value becomes attribute text. Renderers and the resolver both use it. */
export function formatPartValue(value: number | string): string {
  return String(value);
}

function info(id: string): PartInfo | undefined {
  return Object.prototype.hasOwnProperty.call(PARTS, id) ? PARTS[id as PartId] : undefined;
}

export function partId(ref: PartRef): PartId {
  return typeof ref === 'string' ? ref : ref.part;
}

export function partInstance(ref: PartRef): { key: string; value: number | string } | null {
  if (typeof ref === 'string') return null;
  const key = PARTS[ref.part].instance?.key as string;
  return { key, value: (ref as unknown as Record<string, number | string>)[key] };
}

export function partFace(ref: PartRef): PartFace {
  return PARTS[partId(ref)].face;
}

/** True when the id is in the vocabulary and any instance value is one the part really has. */
export function isValidPartRef(ref: unknown): ref is PartRef {
  if (typeof ref === 'string') return info(ref) !== undefined;
  if (typeof ref !== 'object' || ref === null) return false;
  const record = ref as Record<string, unknown>;
  const spec = typeof record.part === 'string' ? info(record.part) : undefined;
  if (!spec?.instance) return false;
  const keys = Object.keys(record).filter((key) => key !== 'part');
  if (keys.length !== 1 || keys[0] !== spec.instance.key) return false;
  const value = record[spec.instance.key];
  return (typeof value === 'number' || typeof value === 'string') && spec.instance.values.includes(value);
}

/** `almucantar[altitude=30]` as CSS: `[data-part="almucantar"][data-altitude="30"]`. */
export function partSelector(ref: PartRef): string {
  const instance = partInstance(ref);
  const base = `[data-part="${partId(ref)}"]`;
  return instance ? `${base}[data-${instance.key}="${formatPartValue(instance.value)}"]` : base;
}

/** Human-readable `part[key=value]` form used in test and audit messages. */
export function describePartRef(ref: PartRef): string {
  const instance = partInstance(ref);
  return instance ? `${partId(ref)}[${instance.key}=${formatPartValue(instance.value)}]` : partId(ref);
}
