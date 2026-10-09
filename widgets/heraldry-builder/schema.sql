-- D1 schema for the Heraldry Builder community armorial.
--
-- There is no migration framework: this file is the single source of truth. It is applied once by
-- hand against the production D1 database (see README.md, "One-time Cloudflare setup") and to the
-- local D1 used by the tests. Keep it safe for a naive split on semicolons: no semicolons inside
-- literals, and only double-dash line comments.
--
-- The data model is registry-keyed: every registered coat of arms belongs to one registry (one
-- community armorial), and uniqueness is enforced per registry. A registry id is chosen with a
-- query parameter, never stored in the client. Registries are added by the owner with SQL.

CREATE TABLE IF NOT EXISTS registries (
  id         TEXT PRIMARY KEY,            -- short slug, e.g. 'bayrat'
  name       TEXT NOT NULL,              -- human label, e.g. 'Bayrat house parties'
  is_default INTEGER NOT NULL DEFAULT 0, -- exactly one row should have is_default = 1
  created_at TEXT NOT NULL               -- ISO-8601 UTC
);

CREATE TABLE IF NOT EXISTS arms (
  id               TEXT PRIMARY KEY,                         -- random ~128-bit, base64url
  registry_id      TEXT NOT NULL REFERENCES registries(id),
  display_name     TEXT NOT NULL,                            -- public, 1-60 chars, plain text
  contact          TEXT,                                     -- public, 0-80 chars, plain text, NULL when blank
  design           TEXT NOT NULL,                            -- normalised design JSON (computed by the Worker)
  signature        TEXT NOT NULL,                            -- canonical signature (computed by the Worker)
  blazon           TEXT NOT NULL,                            -- generated blazon (computed by the Worker)
  field_division   TEXT NOT NULL,                            -- 'plain' or a division id
  ordinary         TEXT,                                     -- ordinary type or NULL
  charge           TEXT,                                     -- charge id or NULL
  readability      TEXT NOT NULL,                            -- 'bold' | 'fine' | 'busy'
  edit_secret_hash TEXT NOT NULL,                            -- SHA-256 hex of the edit secret (never the secret)
  rev              INTEGER NOT NULL DEFAULT 1,               -- bumped on every successful edit (optimistic concurrency)
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

-- Exact duplicates are impossible: one signature per registry. Withdrawal deletes the row, which
-- frees the signature.
CREATE UNIQUE INDEX IF NOT EXISTS arms_registry_signature ON arms(registry_id, signature);
CREATE INDEX IF NOT EXISTS arms_registry_created ON arms(registry_id, created_at);
CREATE INDEX IF NOT EXISTS arms_registry_division ON arms(registry_id, field_division);
CREATE INDEX IF NOT EXISTS arms_registry_ordinary ON arms(registry_id, ordinary);
CREATE INDEX IF NOT EXISTS arms_registry_charge ON arms(registry_id, charge);

-- Derived search tags (e.g. 'charge:wolf', 'ordinary:bordure', 'tincture:or'), rewritten with the
-- row on every edit. A search is an AND of tags.
CREATE TABLE IF NOT EXISTS arms_tags (
  arms_id     TEXT NOT NULL REFERENCES arms(id),
  registry_id TEXT NOT NULL,
  tag         TEXT NOT NULL,
  PRIMARY KEY (arms_id, tag)
);

CREATE INDEX IF NOT EXISTS arms_tags_lookup ON arms_tags(registry_id, tag);

-- Seed the one registry that ships today. It is the default: requests without a registry use it.
INSERT OR IGNORE INTO registries (id, name, is_default, created_at)
VALUES ('bayrat', 'Bayrat house parties', 1, '2026-10-01T00:00:00Z');
