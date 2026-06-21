-- D1 schema for the Pennsic Planner "shareable calendars" feature.
--
-- There is no migration framework: this file is the single source of truth for the schema and is
-- applied once, by hand, against the production D1 database (see CHANGES.md). It is also applied to
-- the local D1 used by the offline Worker tests. The schema is free to change while nothing is live.
--
-- Data model is event-keyed: events are first-class, and every calendar row carries the id of the
-- event it belongs to. A future Pennsic is added by bundling its schedule in the SPA and inserting a
-- new events row with is_default = 1 (and clearing the old default) — existing calendars and their
-- capability URLs keep working because the event is never encoded in the URL.

CREATE TABLE IF NOT EXISTS events (
  id         TEXT PRIMARY KEY,            -- stable, not year-ambiguous, e.g. 'pennsic-53'
  name       TEXT NOT NULL,              -- human label, e.g. 'Pennsic 53 (2026)'
  year       INTEGER NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0, -- exactly one row should have is_default = 1
  created_at TEXT NOT NULL               -- ISO-8601 UTC
);

CREATE TABLE IF NOT EXISTS calendars (
  id               TEXT PRIMARY KEY,                      -- random ~128-bit, base64url
  event_id         TEXT NOT NULL REFERENCES events(id),   -- the event this calendar's picks belong to
  name             TEXT NOT NULL,
  session_ids      TEXT NOT NULL,                         -- JSON array of session ids, scoped to event
  edit_secret_hash TEXT NOT NULL,                         -- SHA-256 hex of the edit secret (never the secret)
  rev              INTEGER NOT NULL DEFAULT 1,            -- bumped on every successful edit (optimistic concurrency)
  created_at       TEXT NOT NULL,                         -- ISO-8601 UTC
  updated_at       TEXT NOT NULL                          -- ISO-8601 UTC
);

-- Seed the one event that ships today. Pennsic 53 is the default: new calendars attach to it.
INSERT OR IGNORE INTO events (id, name, year, is_default, created_at)
VALUES ('pennsic-53', 'Pennsic 53 (2026)', 2026, 1, '2026-06-20T00:00:00Z');
