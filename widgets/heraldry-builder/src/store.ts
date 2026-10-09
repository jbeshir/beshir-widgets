// Registry store — the single persistence seam for the Heraldry Builder.
//
// The community armorial lives in Cloudflare D1 behind the Worker's /api/* routes; this module is
// the ONLY place that calls `fetch`, and the only importer of the localStorage helpers
// (lib/deviceArms.ts for "Your arms on this device", lib/deviceDraft.ts for the unsaved builder
// design). Every call resolves to a typed result and never throws:
//   { ok: true, … } | { ok: false, kind: 'offline' | 'network' | 'http', status?, code?, message }
//
//   listRegistries()            GET  /api/registries
//   search(params)              GET  /api/arms?…           (public; no contact in results)
//   getEntry(id)                GET  /api/arms/:id         (includes the public contact)
//   check(registry, design)     POST /api/arms/check
//   register(input)             POST /api/arms             (remembers the new edit link on this device)
//   update(id, secret, rev, …)  PUT  /api/arms/:id         (Bearer secret + If-Match rev)
//   withdraw(id, secret)        DELETE /api/arms/:id
//
// *** Offline-safe networking ***
// The render + journey gates run under `file://` with zero network, and the journey harness treats
// any console error — including a failed `fetch()` — as a cell failure. So under `file://` the store
// never touches the network: reads (registries, search, entry, check) run locally against the
// bundled sample registry with the same tag/filter/uniqueness code as the Worker
// (lib/heraldry/search.ts, checkUnique), and writes return a friendly `kind: 'offline'` failure.
// In production a failed request is reported as `network`/`http` — the store never silently swaps
// in the sample; the UI offers "Show offline sample" (search/getEntry with `{ sample: true }`).

import {
  checkUnique, explainDifferences, parseSearchParams, normalise, readability, resolve, searchEntries,
  searchParamsToUrl, signature, blazon, type Issue, type NormDesign, type ReadabilityBand, type SearchParams,
} from './lib/heraldry';
import { forgetDeviceArms, listDeviceArms, rememberDeviceArms, type DeviceArms } from './lib/deviceArms';
import { clearDraft as clearStoredDraft, readDraft, writeDraft } from './lib/deviceDraft';
import sampleData from './data/sample-registry.json';

export type { DeviceArms } from './lib/deviceArms';
export type { SearchParams } from './lib/heraldry';

// ── types ────────────────────────────────────────────────────────────────────────────────────

export type FailureKind = 'offline' | 'network' | 'http';

export interface ConflictSummary {
  id: string;
  displayName: string;
  blazon: string;
  design: NormDesign | null;
}

export interface Failure {
  ok: false;
  kind: FailureKind;
  /** HTTP status (kind 'http'). */
  status?: number;
  /** Worker error code, e.g. 'duplicate', 'too_close', 'invalid_design', 'conflict', 'rate_limited'. */
  code?: string;
  message: string;
  /** invalid_design: the validation issues. */
  issues?: Issue[];
  /** duplicate / too_close (409): the conflicting entry. */
  conflictId?: string;
  conflict?: ConflictSummary;
  /** too_close: human descriptions of the (minor) differences. */
  differences?: string[];
  /** 400 on a text field: 'displayName' | 'contact'. */
  field?: string;
  /** 400 on a search parameter. */
  param?: string;
}

export type Result<T> = ({ ok: true } & T) | Failure;

export interface RegistryRef {
  id: string;
  name: string;
}

export interface RegistryInfo extends RegistryRef {
  isDefault: boolean;
}

/** A search result (never carries the contact). */
export interface ArmsSummary {
  id: string;
  displayName: string;
  design: NormDesign;
  blazon: string;
  signature: string;
  readability: ReadabilityBand;
  createdAt: string;
}

/** A single entry, including the public contact and the revision for edits. */
export interface ArmsEntry extends ArmsSummary {
  registry: RegistryRef;
  contact: string | null;
  rev: number;
  updatedAt: string;
}

export interface SearchPage {
  registry: RegistryRef;
  total: number;
  offset: number;
  limit: number;
  items: ArmsSummary[];
  /** True when the results come from the bundled offline sample. */
  sample: boolean;
}

export type Verdict = 'ok' | 'duplicate' | 'too-close';

export interface CheckResult {
  verdict: Verdict;
  registry: RegistryRef;
  conflict?: ConflictSummary;
  differences?: string[];
  blazon: string;
  signature: string;
  readability: ReadabilityBand;
  sample: boolean;
}

export interface Registered {
  id: string;
  editSecret: string;
  registry: RegistryRef;
  rev: number;
  blazon: string;
  signature: string;
}

export interface EntryInput {
  displayName: string;
  contact?: string | null;
  design: unknown;
}

export interface RegisterInput extends EntryInput {
  /** Registry id; null/blank → the default registry. */
  registry: string | null;
}

export interface OfflineSample {
  registry: RegistryRef;
  entries: ArmsEntry[];
}

// ── constants ────────────────────────────────────────────────────────────────────────────────

const API_BASE = '/api';
export const REQUEST_TIMEOUT_MS = 6000;
export const OFFLINE_WRITE_MESSAGE = "The registry can't be reached from this offline copy.";
const OFFLINE_READ_MESSAGE = 'This entry is not in the offline sample.';
const NETWORK_MESSAGE = "Couldn't reach the registry. Check your connection and try again.";
const TIMEOUT_MESSAGE = 'The registry took too long to respond. Try again.';

/**
 * NEVER fetch under `file://` — see the offline-safe networking note above — with ONE test-only seam:
 * the journey harness's `mockFetch` step (see TESTING.md) installs an in-page `window.fetch` interceptor
 * and sets `window.__journeyMockFetch`, opting a journey back into the network path so the registry
 * flows can be driven end-to-end offline. Every such request is intercepted inside the browser and
 * answered with a canned response — nothing ever leaves the page — so the offline guarantee is intact:
 * with no mock installed this still returns false under file://, and in production (https) it never
 * reads the flag at all. Evaluated on every call, so a journey can flip it at runtime.
 */
function remoteEnabled(): boolean {
  if (typeof location === 'undefined') return false;
  if (location.protocol !== 'file:') return true;
  return (globalThis as { __journeyMockFetch?: boolean }).__journeyMockFetch === true;
}

/** True when the store is running against the bundled sample (offline copy / file://). */
export function isOffline(): boolean {
  return !remoteEnabled();
}

// ── offline sample ───────────────────────────────────────────────────────────────────────────

let sampleCache: OfflineSample | null = null;

/** The bundled sample registry, normalised (designs resolved, readability computed). */
export function offlineSample(): OfflineSample {
  if (sampleCache) return sampleCache;
  const registry: RegistryRef = { id: sampleData.registry.id, name: sampleData.registry.name };
  const entries: ArmsEntry[] = [];
  for (const e of sampleData.entries) {
    const r = resolve(e.design);
    if (!r.ok) continue;
    entries.push({
      id: e.id,
      registry,
      displayName: e.displayName,
      contact: e.contact ?? null,
      design: r.design,
      blazon: e.blazon,
      signature: e.signature,
      readability: readability(r.design).band,
      rev: 1,
      createdAt: e.registeredAt,
      updatedAt: e.registeredAt,
    });
  }
  sampleCache = { registry, entries };
  return sampleCache;
}

function summary(e: ArmsEntry): ArmsSummary {
  return {
    id: e.id,
    displayName: e.displayName,
    design: e.design,
    blazon: e.blazon,
    signature: e.signature,
    readability: e.readability,
    createdAt: e.createdAt,
  };
}

function conflictOf(e: { id: string; displayName: string; blazon: string; design: NormDesign | null }): ConflictSummary {
  return { id: e.id, displayName: e.displayName, blazon: e.blazon, design: e.design };
}

function searchSample(params: SearchParams): Result<{ page: SearchPage }> {
  const parsed = parseSearchParams(params);
  if (!parsed.ok) {
    return { ok: false, kind: 'http', status: 400, code: 'bad_request', message: parsed.message, param: parsed.param };
  }
  const s = offlineSample();
  const { total, items } = searchEntries(s.entries, parsed.query);
  return {
    ok: true,
    page: {
      registry: s.registry,
      total,
      offset: parsed.query.offset,
      limit: parsed.query.limit,
      items: items.map(summary),
      sample: true,
    },
  };
}

/** Local mirror of POST /api/arms/check over the sample (same normalise + checkUnique + scan order). */
function checkSample(design: unknown): Result<{ result: CheckResult }> {
  const n = normalise(design);
  if (!n.ok) {
    // Same shape the Worker returns for an invalid design.
    return {
      ok: false,
      kind: 'http',
      status: 400,
      code: 'invalid_design',
      message: n.errors[0]?.message ?? 'The design is not valid.',
      issues: n.errors,
    };
  }
  const nd = n.design;
  const s = offlineSample();
  const sig = signature(nd);
  const ordered = s.entries.slice().sort((a, b) => (a.createdAt === b.createdAt ? (a.id < b.id ? -1 : 1) : a.createdAt < b.createdAt ? -1 : 1));
  const v = checkUnique(nd, sig, ordered);
  const base = { registry: s.registry, blazon: blazon(nd), signature: sig, readability: readability(nd).band, sample: true };
  if (v.kind === 'ok') return { ok: true, result: { verdict: 'ok', ...base } };
  const hit = ordered.find((e) => e.id === v.of)!;
  if (v.kind === 'duplicate') return { ok: true, result: { verdict: 'duplicate', conflict: conflictOf(hit), ...base } };
  return {
    ok: true,
    result: { verdict: 'too-close', conflict: conflictOf(hit), differences: explainDifferences(nd, hit.design), ...base },
  };
}

// ── network ──────────────────────────────────────────────────────────────────────────────────

type Fetched = { ok: true; data: unknown } | Failure;

async function request(path: string, init: RequestInit = {}): Promise<Fetched> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timedOut = false;
  const timer = controller
    ? setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, REQUEST_TIMEOUT_MS)
    : null;
  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      ...init,
      headers: { Accept: 'application/json', ...(init.headers as Record<string, string> | undefined) },
      signal: controller?.signal,
    });
  } catch {
    return { ok: false, kind: 'network', message: timedOut ? TIMEOUT_MESSAGE : NETWORK_MESSAGE };
  } finally {
    if (timer) clearTimeout(timer);
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) return httpFailure(res.status, data);
  if (data === null) return { ok: false, kind: 'http', status: res.status, code: 'bad_response', message: 'The registry sent an unreadable response.' };
  return { ok: true, data };
}

function httpFailure(status: number, data: unknown): Failure {
  const b = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  const f: Failure = {
    ok: false,
    kind: 'http',
    status,
    code: str(b.error),
    message: str(b.message) ?? `The registry returned an error (${status}).`,
  };
  if (Array.isArray(b.issues)) f.issues = b.issues as Issue[];
  if (str(b.conflictId)) f.conflictId = str(b.conflictId);
  const c = toConflict(b.conflict);
  if (c) f.conflict = c;
  if (Array.isArray(b.differences)) f.differences = b.differences.filter((d): d is string => typeof d === 'string');
  if (str(b.field)) f.field = str(b.field);
  if (str(b.param)) f.param = str(b.param);
  return f;
}

function badResponse(): Failure {
  return { ok: false, kind: 'http', code: 'bad_response', message: 'The registry sent an unreadable response.' };
}

// Server data is re-checked on arrival (FINDINGS §8): designs are re-resolved and malformed items dropped.

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function toDesign(v: unknown): NormDesign | null {
  if (v == null) return null;
  const r = resolve(v);
  return r.ok ? r.design : null;
}

function toRegistry(v: unknown): RegistryRef | null {
  const o = obj(v);
  return o && typeof o.id === 'string' && typeof o.name === 'string' ? { id: o.id, name: o.name } : null;
}

function toConflict(v: unknown): ConflictSummary | null {
  const o = obj(v);
  if (!o || typeof o.id !== 'string') return null;
  return {
    id: o.id,
    displayName: typeof o.displayName === 'string' ? o.displayName : '',
    blazon: typeof o.blazon === 'string' ? o.blazon : '',
    design: toDesign(o.design),
  };
}

function toBand(v: unknown, nd: NormDesign): ReadabilityBand {
  return v === 'bold' || v === 'fine' || v === 'busy' ? v : readability(nd).band;
}

function toSummary(v: unknown): ArmsSummary | null {
  const o = obj(v);
  if (!o || typeof o.id !== 'string' || typeof o.displayName !== 'string' || typeof o.blazon !== 'string') return null;
  const design = toDesign(o.design);
  if (!design) return null;
  return {
    id: o.id,
    displayName: o.displayName,
    design,
    blazon: o.blazon,
    signature: typeof o.signature === 'string' ? o.signature : signature(design),
    readability: toBand(o.readability, design),
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : '',
  };
}

function toEntry(v: unknown): ArmsEntry | null {
  const s = toSummary(v);
  const o = obj(v);
  const registry = toRegistry(o?.registry);
  if (!s || !o || !registry || typeof o.rev !== 'number') return null;
  return {
    ...s,
    registry,
    contact: typeof o.contact === 'string' ? o.contact : null,
    rev: o.rev,
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : s.createdAt,
  };
}

function jsonInit(method: string, body: unknown, headers: Record<string, string> = {}): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) };
}

// ── public API ───────────────────────────────────────────────────────────────────────────────

export async function listRegistries(): Promise<Result<{ registries: RegistryInfo[]; sample: boolean }>> {
  if (!remoteEnabled()) {
    const r = offlineSample().registry;
    return { ok: true, registries: [{ ...r, isDefault: true }], sample: true };
  }
  const res = await request('/registries');
  if (!res.ok) return res;
  if (!Array.isArray(res.data)) return badResponse();
  const registries: RegistryInfo[] = [];
  for (const v of res.data) {
    const r = toRegistry(v);
    if (r) registries.push({ ...r, isDefault: obj(v)?.isDefault === true });
  }
  return { ok: true, registries, sample: false };
}

/**
 * Search a registry. `{ sample: true }` forces the bundled sample (the UI's "Show offline sample"
 * action after a production failure); offline copies always use it.
 */
export async function search(params: SearchParams, opts: { sample?: boolean } = {}): Promise<Result<{ page: SearchPage }>> {
  if (opts.sample || !remoteEnabled()) return searchSample(params);
  const qs = searchParamsToUrl(params).toString();
  const res = await request(`/arms${qs ? `?${qs}` : ''}`);
  if (!res.ok) return res;
  const o = obj(res.data);
  const registry = toRegistry(o?.registry);
  if (!o || !registry || !Array.isArray(o.items)) return badResponse();
  const items = o.items.map(toSummary).filter((x): x is ArmsSummary => x !== null);
  return {
    ok: true,
    page: {
      registry,
      total: typeof o.total === 'number' ? o.total : items.length,
      offset: typeof o.offset === 'number' ? o.offset : 0,
      limit: typeof o.limit === 'number' ? o.limit : items.length,
      items,
      sample: false,
    },
  };
}

export async function getEntry(id: string, opts: { sample?: boolean } = {}): Promise<Result<{ entry: ArmsEntry; sample: boolean }>> {
  if (opts.sample || !remoteEnabled()) {
    const entry = offlineSample().entries.find((e) => e.id === id);
    if (entry) return { ok: true, entry, sample: true };
    return { ok: false, kind: 'offline', message: OFFLINE_READ_MESSAGE };
  }
  const res = await request(`/arms/${encodeURIComponent(id)}`);
  if (!res.ok) return res;
  const entry = toEntry(res.data);
  return entry ? { ok: true, entry, sample: false } : badResponse();
}

/** Availability check. Offline copies check against the sample registry locally. */
export async function check(registry: string | null, design: unknown): Promise<Result<{ result: CheckResult }>> {
  if (!remoteEnabled()) return checkSample(design);
  const res = await request('/arms/check', jsonInit('POST', { registry: registry || undefined, design }));
  if (!res.ok) return res;
  const o = obj(res.data);
  const reg = toRegistry(o?.registry);
  const verdict = o?.verdict;
  if (!o || !reg || (verdict !== 'ok' && verdict !== 'duplicate' && verdict !== 'too-close')) return badResponse();
  const result: CheckResult = {
    verdict,
    registry: reg,
    blazon: typeof o.blazon === 'string' ? o.blazon : '',
    signature: typeof o.signature === 'string' ? o.signature : '',
    readability: o.readability === 'bold' || o.readability === 'fine' || o.readability === 'busy' ? o.readability : 'fine',
    sample: false,
  };
  const c = toConflict(o.conflict);
  if (c) result.conflict = c;
  if (Array.isArray(o.differences)) result.differences = o.differences.filter((d): d is string => typeof d === 'string');
  return { ok: true, result };
}

/** Register a design. On success the edit link is remembered in "Your arms on this device". */
export async function register(input: RegisterInput): Promise<Result<{ created: Registered }>> {
  if (!remoteEnabled()) return { ok: false, kind: 'offline', message: OFFLINE_WRITE_MESSAGE };
  const res = await request(
    '/arms',
    jsonInit('POST', {
      registry: input.registry || undefined,
      displayName: input.displayName,
      contact: input.contact ?? null,
      design: input.design,
    })
  );
  if (!res.ok) return res;
  const o = obj(res.data);
  const registry = toRegistry(o?.registry);
  if (!o || !registry || typeof o.id !== 'string' || typeof o.editSecret !== 'string') return badResponse();
  const created: Registered = {
    id: o.id,
    editSecret: o.editSecret,
    registry,
    rev: typeof o.rev === 'number' ? o.rev : 1,
    blazon: typeof o.blazon === 'string' ? o.blazon : '',
    signature: typeof o.signature === 'string' ? o.signature : '',
  };
  rememberDeviceArms({
    id: created.id,
    registry: registry.id,
    displayName: input.displayName.trim(),
    blazon: created.blazon,
    secret: created.editSecret,
  });
  return { ok: true, created };
}

/** Full replacement edit (owner view). A 409 `conflict` means the entry changed elsewhere: reload. */
export async function update(id: string, secret: string, rev: number, input: EntryInput): Promise<Result<{ entry: ArmsEntry }>> {
  if (!remoteEnabled()) return { ok: false, kind: 'offline', message: OFFLINE_WRITE_MESSAGE };
  const res = await request(
    `/arms/${encodeURIComponent(id)}`,
    jsonInit(
      'PUT',
      { displayName: input.displayName, contact: input.contact ?? null, design: input.design },
      { Authorization: `Bearer ${secret}`, 'If-Match': String(rev) }
    )
  );
  if (!res.ok) return res;
  const entry = toEntry(res.data);
  if (!entry) return badResponse();
  rememberDeviceArms({ id, registry: entry.registry.id, displayName: entry.displayName, blazon: entry.blazon, secret });
  return { ok: true, entry };
}

/** Withdraw (delete) an entry; also drops its shortcut from this device. */
export async function withdraw(id: string, secret: string): Promise<Result<{ id: string }>> {
  if (!remoteEnabled()) return { ok: false, kind: 'offline', message: OFFLINE_WRITE_MESSAGE };
  const res = await request(`/arms/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!res.ok) return res;
  forgetDeviceArms(id);
  return { ok: true, id };
}

// ── device-local conveniences (localStorage, via lib/deviceArms + lib/deviceDraft) ──────────

/** "Your arms on this device", most recent first. */
export function deviceArms(): DeviceArms[] {
  return listDeviceArms();
}

/** Record a shortcut, e.g. when an owner link is opened on this device. */
export function rememberArms(entry: Omit<DeviceArms, 'savedAt'>): void {
  rememberDeviceArms(entry);
}

export function forgetArms(id: string): void {
  forgetDeviceArms(id);
}

/** The autosaved builder design, resolved (may still break the rules), or null. */
export function loadDraft(): NormDesign | null {
  const raw = readDraft();
  if (raw == null) return null;
  const r = resolve(raw);
  return r.ok ? r.design : null;
}

export function saveDraft(design: NormDesign): void {
  writeDraft(design);
}

export function clearDraft(): void {
  clearStoredDraft();
}
