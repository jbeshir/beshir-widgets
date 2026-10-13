// Registry store — the single persistence seam for the Heraldry Builder.
//
// The community armorial lives in Cloudflare D1 behind the Worker's /api/* routes; this module is
// the ONLY place that calls `fetch`, and the only importer of the localStorage helpers
// (lib/deviceArms.ts for "Your arms on this device", lib/deviceDraft.ts for the unsaved builder
// design, lib/deviceWelcome.ts for the dismissed welcome strip, lib/deviceExamples.ts for the examples box). Every call resolves to a typed result and never throws:
//   { ok: true, … } | Failure   (see Failure for the ways a call can fail)
//
//   search(params)              GET  /api/arms?…           (public; no contact in results)
//   getEntry(id)                GET  /api/arms/:id         (includes the public contact)
//   check(registry, design)     POST /api/arms/check
//   register(input)             POST /api/arms             (remembers the new edit link on this device)
//   checkOwner(id, secret)      GET  /api/arms/:id/owner   (is this edit link right?)
//   update(id, secret, rev, …)  PUT  /api/arms/:id         (Bearer secret + If-Match rev)
//   withdraw(id, secret)        DELETE /api/arms/:id
//   requestRecovery(email)      POST /api/recover          (always accepted; emails recovery links)
//   lookupRecovery(token)       POST /api/recover/lookup   (the entry a recovery link is for)
//   redeemRecovery(token)       POST /api/recover/redeem   (new edit link, remembered on this device)
//   withdrawByRecovery(token)   POST /api/recover/withdraw
//
// *** Offline-safe networking ***
// The render + journey gates run under `file://` with zero network, and the journey harness treats
// any console error — including a failed `fetch()` — as a cell failure. So under `file://` the store
// never touches the network: reads (search, entry, check) run locally against the
// bundled sample registry with the same tag/filter/uniqueness code as the Worker
// (lib/heraldry/search.ts, check.ts), and writes return a friendly `kind: 'offline'` failure.
// In production a failed request is reported as `network`/`http` — the store never silently swaps
// in the sample; the UI offers "Show offline sample" (search/getEntry with `{ sample: true }`).


import {
  API_ERROR, DEFAULT_FIELD_SHAPE, NO_CONTACT, asObject, buildSearchText, checkResponse, isApiErrorCode, isChangeKind, isDiffAttr, isFieldShape, isMailOutcome, isSenaRule,
  isReadabilityBand, normalise, parseSearchParams, readability, registrationOrder, resolve, searchEntries, searchParamsToUrl,
  type ApiErrorCode, type CheckResponse, type ComparedEntry, type ConflictSummary, type Contact, type Design, type DifferenceNote, type FieldShape, type Issue,
  type MailOutcome, type ReadabilityBand, type RegistryRef, type SearchParams, type ShapedDesign, type UniquenessReport,
} from './lib/heraldry';
import { forgetDeviceArms, listDeviceArms, rememberDeviceArms, type DeviceArms } from './lib/deviceArms';
import { clearDraft as clearStoredDraft, readDraft, writeDraft } from './lib/deviceDraft';
import { readWelcomeDismissed, writeWelcomeDismissed } from './lib/deviceWelcome';
import { readExamplesSeen, writeExamplesSeen } from './lib/deviceExamples';
import sampleData from './data/sample-registry.json';

export type { DeviceArms } from './lib/deviceArms';

// ── types ────────────────────────────────────────────────────────────────────────────────────

/** What a 400 complains about: an entry field, a search parameter, or the request as a whole. */
type Culprit = { kind: 'field'; name: string } | { kind: 'param'; name: string } | { kind: 'body' };

/** The error codes that carry no detail beyond the message. */
type PlainCode = Exclude<ApiErrorCode, typeof API_ERROR.invalidDesign | typeof API_ERROR.duplicate | typeof API_ERROR.tooClose | typeof API_ERROR.badRequest | typeof API_ERROR.unknownParam>;

/** The Worker answered with an error; each code carries what that code is documented to carry. */
export type HttpFailure = { ok: false; kind: 'http'; status: number; message: string } & (
  | { code: PlainCode }
  | { code: typeof API_ERROR.invalidDesign; issues: Issue[] }
  | { code: typeof API_ERROR.duplicate; conflict: ConflictSummary }
  | { code: typeof API_ERROR.tooClose; conflict: ConflictSummary; differences: DifferenceNote[] }
  | { code: typeof API_ERROR.badRequest | typeof API_ERROR.unknownParam; culprit: Culprit }
);

/** Offline: this copy has no registry. Network: no answer. Bad response: an answer that isn't the protocol. */
export type Failure = { ok: false; kind: 'offline' | 'network' | 'bad_response'; message: string } | HttpFailure;

export type Result<T> = ({ ok: true } & T) | Failure;

/** The API error code of a failure that has one. */
export function failureCode(f: Failure): ApiErrorCode | null {
  return f.kind === 'http' ? f.code : null;
}

/** A search result (never carries the contact). */
export interface ArmsSummary {
  id: string;
  displayName: string;
  design: Design;
  /** The field shape the owner chose to display the arms in (not part of the arms). */
  shape: FieldShape;
  blazon: string;
  signature: string;
  readability: ReadabilityBand;
  createdAt: string;
}

/** A single entry, including the public contact and the revision for edits. */
export interface ArmsEntry extends ArmsSummary {
  registry: RegistryRef;
  contact: Contact;
  rev: number;
  updatedAt: string;
}

/** A bundled sample entry with the text free-text search runs over. */
export interface SampleEntry extends ArmsEntry {
  searchText: string;
}

interface SearchPage {
  total: number;
  offset: number;
  limit: number;
  items: ArmsSummary[];
  /** True when the results come from the bundled offline sample. */
  sample: boolean;
}

/** An availability check's answer; `sample` is true when it was made against the bundled offline sample. */
export type CheckResult = CheckResponse & { sample: boolean };

export interface Registered {
  id: string;
  editSecret: string;
  rev: number;
  blazon: string;
  signature: string;
  /** Whether the edit link was emailed to the owner. */
  editLinkEmail: MailOutcome;
}

export interface EntryInput {
  displayName: string;
  contact: Contact;
  design: unknown;
  shape: FieldShape;
}

interface RegisterInput extends EntryInput {
  /** Registry id; '' → the default registry. */
  registry: string;
  /** The owner's address: the edit link is emailed to it. Never shown or returned. */
  email: string;
}

/** The entry a recovery link is for, shown before the owner chooses what to do. */
export interface RecoveryEntry {
  id: string;
  displayName: string;
  design: Design;
  shape: FieldShape;
  blazon: string;
}

/** A redeemed recovery link: the entry's new edit secret (the old link no longer works). */
export interface Recovered {
  id: string;
  editSecret: string;
  displayName: string;
  blazon: string;
}

interface OfflineSample {
  registry: RegistryRef;
  entries: SampleEntry[];
}

// ── constants ────────────────────────────────────────────────────────────────────────────────

const API_BASE = '/api';
const REQUEST_TIMEOUT_MS = 6000;
export const OFFLINE_WRITE_MESSAGE = "The registry can't be reached from this offline copy.";
const OFFLINE_READ_MESSAGE = 'This entry is not in the offline sample.';
const NETWORK_MESSAGE = "Couldn't reach the registry. Check your connection and try again.";
const TIMEOUT_MESSAGE = 'The registry took too long to respond. Try again.';
const BAD_RESPONSE_MESSAGE = 'The registry sent an unreadable response.';

/**
 * NEVER fetch under `file://` — see the offline-safe networking note above — with ONE test-only seam:
 * the journey harness's `mockFetch` step (see TESTING.md) installs an in-page `window.fetch` interceptor
 * and sets `window.__journeyMockFetch`, opting a journey back into the network path so the registry
 * flows can be driven end-to-end offline. Every such request is intercepted inside the browser and
 * answered with a canned response — nothing ever leaves the page. The flag is only ever read under
 * `file://` (a copy opened from disk, which has no registry to reach): on the deployed site, served over
 * https, it is not consulted at all, so setting it there changes nothing. Evaluated on every call, so a
 * journey can flip it at runtime.
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

/** The bundled sample registry, normalised (designs resolved, readability computed). */
const OFFLINE_SAMPLE: OfflineSample = (() => {
  const registry: RegistryRef = { id: sampleData.registry.id, name: sampleData.registry.name };
  const entries = sampleData.entries.flatMap((e): SampleEntry[] => {
    const r = resolve(e.design);
    const shape = isFieldShape(e.shape) ? e.shape : DEFAULT_FIELD_SHAPE;
    if (!r.ok) return [];
    return [{
      id: e.id,
      registry,
      displayName: e.displayName,
      contact: e.contact,
      design: r.design,
      shape,
      blazon: e.blazon,
      searchText: buildSearchText({ displayName: e.displayName, blazon: e.blazon, design: r.design }),
      signature: e.signature,
      readability: readability(r.design).band,
      rev: 1,
      createdAt: e.registeredAt,
      updatedAt: e.registeredAt,
    }];
  });
  return { registry, entries };
})();

export function offlineSample(): OfflineSample {
  return OFFLINE_SAMPLE;
}

function summary(e: ArmsEntry): ArmsSummary {
  return {
    id: e.id,
    displayName: e.displayName,
    design: e.design,
    shape: e.shape,
    blazon: e.blazon,
    signature: e.signature,
    readability: e.readability,
    createdAt: e.createdAt,
  };
}

function searchSample(params: SearchParams): Result<{ page: SearchPage }> {
  const parsed = parseSearchParams(params);
  if (!parsed.ok) {
    return { ok: false, kind: 'http', status: 400, code: parsed.code, message: parsed.message, culprit: { kind: 'param', name: parsed.param } };
  }
  const s = offlineSample();
  const { total, items } = searchEntries(s.entries, parsed.query);
  return {
    ok: true,
    page: {
      total,
      offset: parsed.query.offset,
      limit: parsed.query.limit,
      items: items.map(summary),
      sample: true,
    },
  };
}

/** Local mirror of POST /api/arms/check over the sample (the same normalise and check as the Worker, in registration order). */
function checkSample(design: unknown): Result<{ result: CheckResult }> {
  const n = normalise(design);
  if (!n.ok) {
    // Same shape the Worker returns for an invalid design.
    return {
      ok: false,
      kind: 'http',
      status: 400,
      code: API_ERROR.invalidDesign,
      message: n.errors[0]?.message ?? 'The design is not valid.',
      issues: n.errors,
    };
  }
  const s = offlineSample();
  const entries = s.entries.slice().sort(registrationOrder);
  return { ok: true, result: { ...checkResponse(n.design, s.registry, entries), sample: true } };
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
  if (data === null) return badResponse();
  return { ok: true, data };
}

/** The failure for an error answer; an answer that isn't a well-formed error of this API is a bad response. */
function httpFailure(status: number, data: unknown): Failure {
  const b = asObject(data);
  const code = b?.error;
  if (!b || !isApiErrorCode(code) || typeof b.message !== 'string') return badResponse(`The registry returned an error (${status}).`);
  const base = { ok: false, kind: 'http', status, message: b.message } as const;
  switch (code) {
    case API_ERROR.invalidDesign:
      return Array.isArray(b.issues) ? { ...base, code, issues: b.issues as Issue[] } : badResponse();
    case API_ERROR.duplicate: {
      const conflict = toConflict(b.conflict);
      return conflict ? { ...base, code, conflict } : badResponse();
    }
    case API_ERROR.tooClose: {
      const conflict = toConflict(b.conflict);
      const differences = toDifferenceNotes(b.differences);
      return conflict && differences ? { ...base, code, conflict, differences } : badResponse();
    }
    case API_ERROR.badRequest:
    case API_ERROR.unknownParam:
      return { ...base, code, culprit: toCulprit(b) };
    default:
      return { ...base, code };
  }
}

function badResponse(message: string = BAD_RESPONSE_MESSAGE): Failure {
  return { ok: false, kind: 'bad_response', message };
}

// Server data is re-checked on arrival: designs are re-resolved, anything malformed is a bad response
// (or, inside a list, dropped).

function toCulprit(b: Record<string, unknown>): Culprit {
  if (typeof b.field === 'string') return { kind: 'field', name: b.field };
  if (typeof b.param === 'string') return { kind: 'param', name: b.param };
  return { kind: 'body' };
}

function toDesign(v: unknown): Design | null {
  const r = resolve(v);
  return r.ok ? r.design : null;
}

function toShape(v: unknown): FieldShape | null {
  return isFieldShape(v) ? v : null;
}

function toRegistry(v: unknown): RegistryRef | null {
  const o = asObject(v);
  return o && typeof o.id === 'string' && typeof o.name === 'string' ? { id: o.id, name: o.name } : null;
}

function toConflict(v: unknown): ConflictSummary | null {
  const o = asObject(v);
  const design = toDesign(o?.design);
  const shape = toShape(o?.shape);
  if (!o || !design || !shape || typeof o.id !== 'string' || typeof o.displayName !== 'string' || typeof o.blazon !== 'string') return null;
  return { id: o.id, displayName: o.displayName, blazon: o.blazon, design, shape };
}

/** The well-formed difference notes of a response (anything malformed is dropped), or null if it isn't a list. */
function toDifferenceNotes(vs: unknown): DifferenceNote[] | null {
  if (!Array.isArray(vs)) return null;
  return vs.flatMap((v): DifferenceNote[] => {
    const o = asObject(v);
    if (!o || !isDiffAttr(o.attr) || !isChangeKind(o.kind) || !isSenaRule(o.rule) || typeof o.text !== 'string' || typeof o.why !== 'string') return [];
    if (o.item !== null && o.item !== 'ordinary' && o.item !== 'charge') return [];
    return [{ attr: o.attr, kind: o.kind, rule: o.rule, text: o.text, why: o.why, item: o.item }];
  });
}

function toComparedEntry(v: unknown): ComparedEntry | null {
  const o = asObject(v);
  const conflict = toConflict(o?.conflict);
  const differences = toDifferenceNotes(o?.differences);
  return conflict && differences ? { conflict, differences } : null;
}

function toSummary(v: unknown): ArmsSummary | null {
  const o = asObject(v);
  const design = toDesign(o?.design);
  const shape = toShape(o?.shape);
  if (
    !o || !design || !shape || !isReadabilityBand(o.readability) ||
    typeof o.id !== 'string' || typeof o.displayName !== 'string' || typeof o.blazon !== 'string' ||
    typeof o.signature !== 'string' || typeof o.createdAt !== 'string'
  ) {
    return null;
  }
  return { id: o.id, displayName: o.displayName, design, shape, blazon: o.blazon, signature: o.signature, readability: o.readability, createdAt: o.createdAt };
}

function toContact(v: unknown): Contact | null {
  const o = asObject(v);
  if (!o) return null;
  if (o.discord === null) return NO_CONTACT;
  return typeof o.discord === 'string' ? { discord: o.discord } : null;
}

function toEntry(v: unknown): ArmsEntry | null {
  const s = toSummary(v);
  const o = asObject(v);
  const registry = toRegistry(o?.registry);
  const contact = toContact(o?.contact);
  if (!s || !o || !registry || !contact || typeof o.rev !== 'number' || typeof o.updatedAt !== 'string') return null;
  return { ...s, registry, contact, rev: o.rev, updatedAt: o.updatedAt };
}

/** What an availability check answered: the verdict with what goes with it, or null if malformed. */
function toReport(o: Record<string, unknown>): UniquenessReport | null {
  switch (o.verdict) {
    case 'ok': {
      if (o.closest === null) return { verdict: 'ok', closest: null };
      const closest = toComparedEntry(o.closest);
      return closest ? { verdict: 'ok', closest } : null;
    }
    case 'duplicate': {
      const conflict = toConflict(o.conflict);
      return conflict ? { verdict: 'duplicate', conflict } : null;
    }
    case 'too-close': {
      const conflict = toConflict(o.conflict);
      const differences = toDifferenceNotes(o.differences);
      return conflict && differences ? { verdict: 'too-close', conflict, differences } : null;
    }
    default:
      return null;
  }
}

function jsonInit(method: string, body: unknown, headers: Record<string, string> = {}): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) };
}

// ── public API ───────────────────────────────────────────────────────────────────────────────

/**
 * Search a registry. `{ sample: true }` forces the bundled sample (the UI's "Show offline sample"
 * action after a production failure); offline copies always use it.
 */
export async function search(params: SearchParams, opts: { sample?: boolean } = {}): Promise<Result<{ page: SearchPage }>> {
  if (opts.sample || !remoteEnabled()) return searchSample(params);
  const qs = searchParamsToUrl(params).toString();
  const res = await request(`/arms${qs ? `?${qs}` : ''}`);
  if (!res.ok) return res;
  const o = asObject(res.data);
  if (!o || !Array.isArray(o.items) || typeof o.total !== 'number' || typeof o.offset !== 'number' || typeof o.limit !== 'number') {
    return badResponse();
  }
  const items = o.items.map(toSummary).filter((x): x is ArmsSummary => x !== null);
  return { ok: true, page: { total: o.total, offset: o.offset, limit: o.limit, items, sample: false } };
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
export async function check(registry: string, design: unknown): Promise<Result<{ result: CheckResult }>> {
  if (!remoteEnabled()) return checkSample(design);
  const res = await request('/arms/check', jsonInit('POST', { registry: registry || undefined, design }));
  if (!res.ok) return res;
  const o = asObject(res.data);
  const reg = toRegistry(o?.registry);
  const report = o && toReport(o);
  if (!o || !reg || !report || typeof o.blazon !== 'string' || typeof o.signature !== 'string' || !isReadabilityBand(o.readability)) return badResponse();
  return { ok: true, result: { ...report, registry: reg, blazon: o.blazon, signature: o.signature, readability: o.readability, sample: false } };
}

/** Register a design. On success the edit link is remembered in "Your arms on this device". */
export async function register(input: RegisterInput): Promise<Result<{ created: Registered }>> {
  if (!remoteEnabled()) return { ok: false, kind: 'offline', message: OFFLINE_WRITE_MESSAGE };
  const res = await request(
    '/arms',
    jsonInit('POST', {
      registry: input.registry || undefined,
      displayName: input.displayName,
      email: input.email,
      contact: input.contact,
      design: input.design,
      shape: input.shape,
    })
  );
  if (!res.ok) return res;
  const o = asObject(res.data);
  const registry = toRegistry(o?.registry);
  if (
    !o || !registry || !isMailOutcome(o.editLinkEmail) ||
    typeof o.id !== 'string' || typeof o.editSecret !== 'string' || typeof o.rev !== 'number' ||
    typeof o.blazon !== 'string' || typeof o.signature !== 'string'
  ) {
    return badResponse();
  }
  const created: Registered = {
    id: o.id, editSecret: o.editSecret, rev: o.rev, blazon: o.blazon, signature: o.signature, editLinkEmail: o.editLinkEmail,
  };
  rememberDeviceArms({
    id: created.id,
    registry: registry.id,
    displayName: input.displayName.trim(),
    blazon: created.blazon,
    shield: shieldOf(input.design, input.shape),
    secret: created.editSecret,
  });
  return { ok: true, created };
}

/** The design as a shield, or null if it isn't a readable design. */
function shieldOf(design: unknown, shape: FieldShape): ShapedDesign | null {
  const d = toDesign(design);
  return d && { design: d, shape };
}

/** Full replacement edit (owner view). A `conflict` failure means the entry changed elsewhere: reload. */
export async function update(id: string, secret: string, rev: number, input: EntryInput): Promise<Result<{ entry: ArmsEntry }>> {
  if (!remoteEnabled()) return { ok: false, kind: 'offline', message: OFFLINE_WRITE_MESSAGE };
  const res = await request(
    `/arms/${encodeURIComponent(id)}`,
    jsonInit(
      'PUT',
      { displayName: input.displayName, contact: input.contact, design: input.design, shape: input.shape },
      { Authorization: `Bearer ${secret}`, 'If-Match': String(rev) }
    )
  );
  if (!res.ok) return res;
  const entry = toEntry(res.data);
  if (!entry) return badResponse();
  rememberDeviceArms({
    id, registry: entry.registry.id, displayName: entry.displayName, blazon: entry.blazon, shield: { design: entry.design, shape: entry.shape }, secret,
  });
  return { ok: true, entry };
}

/** Whether `secret` is this entry's edit secret: ok, or an unauthorized / forbidden / not-found failure. */
export async function checkOwner(id: string, secret: string): Promise<Result<{ id: string }>> {
  if (!remoteEnabled()) return { ok: false, kind: 'offline', message: OFFLINE_WRITE_MESSAGE };
  const res = await request(`/arms/${encodeURIComponent(id)}/owner`, { headers: { Authorization: `Bearer ${secret}` } });
  if (!res.ok) return res;
  return { ok: true, id };
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

// ── device-local conveniences (localStorage, via lib/deviceArms, deviceDraft, deviceWelcome + deviceExamples) ──

/** "Your arms on this device", most recent first. */
export function deviceArms(): DeviceArms[] {
  return listDeviceArms();
}

/** Record a shortcut, e.g. when an owner link is opened on this device. */
export function rememberArms(entry: Omit<DeviceArms, 'savedAt'>): void {
  rememberDeviceArms(entry);
}

/** The autosaved builder draft (design and preview shape), its design resolved (may still break the rules), or null. */
export function loadDraft(): ShapedDesign | null {
  const raw = readDraft();
  if (raw == null) return null;
  const r = resolve(raw.design);
  // A draft saved before field shapes existed has no shape: it shows in the default one.
  return r.ok ? { design: r.design, shape: isFieldShape(raw.shape) ? raw.shape : DEFAULT_FIELD_SHAPE } : null;
}

export function saveDraft(draft: ShapedDesign): void {
  writeDraft(draft.design, draft.shape);
}

export function clearDraft(): void {
  clearStoredDraft();
}

/** Whether the Design tab's welcome strip was dismissed on this device. */
export function welcomeDismissed(): boolean {
  return readWelcomeDismissed();
}

export function dismissWelcome(): void {
  writeWelcomeDismissed();
}

/** Whether the Design tab's examples box has been shown on this device (true when storage is unavailable). */
export function examplesSeen(): boolean {
  return readExamplesSeen();
}

export function markExamplesSeen(): void {
  writeExamplesSeen();
}

// ── recovery ("Lost your link? / Withdraw my registration") ─────────────────────────────────

/** Ask for recovery links. Accepted whether or not the address owns anything (the reply never says). */
export async function requestRecovery(email: string): Promise<Result<{ message: string }>> {
  if (!remoteEnabled()) return { ok: false, kind: 'offline', message: OFFLINE_WRITE_MESSAGE };
  const res = await request('/recover', jsonInit('POST', { email }));
  if (!res.ok) return res;
  const o = asObject(res.data);
  return typeof o?.message === 'string' ? { ok: true, message: o.message } : badResponse();
}

/** The entry a recovery token is for; the token stays unused. Fails with a token_invalid / token_used / token_expired code. */
export async function lookupRecovery(token: string): Promise<Result<{ entry: RecoveryEntry }>> {
  if (!remoteEnabled()) return { ok: false, kind: 'offline', message: OFFLINE_WRITE_MESSAGE };
  const res = await request('/recover/lookup', jsonInit('POST', { token }));
  if (!res.ok) return res;
  const o = asObject(asObject(res.data)?.entry);
  const design = toDesign(o?.design);
  const shape = toShape(o?.shape);
  if (!o || !design || !shape || typeof o.id !== 'string' || typeof o.displayName !== 'string' || typeof o.blazon !== 'string') {
    return badResponse();
  }
  return { ok: true, entry: { id: o.id, displayName: o.displayName, design, shape, blazon: o.blazon } };
}

/** Use a recovery token for a new edit link; the new link is remembered on this device. */
export async function redeemRecovery(token: string, shield: ShapedDesign): Promise<Result<{ recovered: Recovered }>> {
  if (!remoteEnabled()) return { ok: false, kind: 'offline', message: OFFLINE_WRITE_MESSAGE };
  const res = await request('/recover/redeem', jsonInit('POST', { token }));
  if (!res.ok) return res;
  const o = asObject(res.data);
  const registry = toRegistry(o?.registry);
  if (!o || !registry || typeof o.id !== 'string' || typeof o.editSecret !== 'string' || typeof o.displayName !== 'string' || typeof o.blazon !== 'string') {
    return badResponse();
  }
  const recovered: Recovered = { id: o.id, editSecret: o.editSecret, displayName: o.displayName, blazon: o.blazon };
  rememberDeviceArms({
    id: recovered.id, registry: registry.id, displayName: recovered.displayName, blazon: recovered.blazon, shield, secret: recovered.editSecret,
  });
  return { ok: true, recovered };
}

/** Use a recovery token to withdraw its entry; also drops its shortcut from this device. */
export async function withdrawByRecovery(token: string): Promise<Result<{ id: string }>> {
  if (!remoteEnabled()) return { ok: false, kind: 'offline', message: OFFLINE_WRITE_MESSAGE };
  const res = await request('/recover/withdraw', jsonInit('POST', { token }));
  if (!res.ok) return res;
  const o = asObject(res.data);
  if (!o || typeof o.id !== 'string') return badResponse();
  forgetDeviceArms(o.id);
  return { ok: true, id: o.id };
}
