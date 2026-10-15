-- Fieldless badges. The conflict key's partition is NULL for a badge (no field to partition), so
-- `partition_key` stops being NOT NULL. SQLite cannot relax a column in place, and the owner decided
-- the registry may be thrown away (as in 0007), so arms and the tables that hang off them are dropped
-- and recreated rather than migrated. `registries` (and its seed) stays.
--
-- A badge may be too close to armory with any field (it differs by one distinct change, SENA A5G1e), and
-- armory with a field to a badge, so the candidate lookup keeps the primary group as its selective key
-- and treats a NULL partition on either side as a wildcard (worker/index.ts loadCandidates):
--   registry_id = ? AND (partition_key IS NULL OR partition_key = ?) AND primary_key IN (?, '*')   -- a design with one primary type
--   registry_id = ? AND (partition_key IS NULL OR partition_key = ?) AND primary_key IS NOT NULL    -- two main pictures ('*'): any primary
--   registry_id = ? AND (partition_key IS NULL OR partition_key = ?) AND primary_key IS NULL        -- no primary group
--   registry_id = ? AND primary_key IN (?, '*')                                                     -- a badge (NULL partition): any partition
DROP TABLE IF EXISTS owner_tokens;
DROP TABLE IF EXISTS owner_emails;
DROP TABLE IF EXISTS arms_tags;
DROP TABLE IF EXISTS arms;

CREATE TABLE arms (
  id               TEXT PRIMARY KEY,                         -- random ~128-bit, base64url
  registry_id      TEXT NOT NULL REFERENCES registries(id),
  display_name     TEXT NOT NULL,                            -- public, 1-60 chars, plain text
  contact_discord  TEXT                                      -- public Discord username, NULL when blank
    CHECK (contact_discord IS NULL OR (
      length(contact_discord) BETWEEN 2 AND 32
      AND contact_discord NOT GLOB '*[^a-z0-9_.]*'
      AND instr(contact_discord, '..') = 0
    )),
  design           TEXT NOT NULL,                            -- canonical design JSON (computed by the Worker)
  field_shape      TEXT NOT NULL DEFAULT 'heater'            -- display only: not in the signature, blazon or tags
    CHECK (field_shape IN ('heater', 'banner', 'round', 'lozenge')),
  signature        TEXT NOT NULL,                            -- canonical signature (computed by the Worker)
  blazon           TEXT NOT NULL,                            -- generated blazon (computed by the Worker)
  readability      TEXT NOT NULL,                            -- 'bold' | 'fine' | 'busy'
  search_text      TEXT NOT NULL DEFAULT '',                 -- normalised name and blazon words for search
  partition_key    TEXT,                                     -- candidateKey(design).partition; NULL = fieldless badge
  primary_key      TEXT,                                     -- candidateKey(design).primary; NULL = field-primary
  edit_secret_hash TEXT NOT NULL,                            -- SHA-256 hex of the edit secret (never the secret)
  rev              INTEGER NOT NULL DEFAULT 1,               -- bumped on every successful edit (optimistic concurrency)
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

-- Exact duplicates are impossible: one signature per registry.
CREATE UNIQUE INDEX arms_registry_signature ON arms(registry_id, signature);
CREATE INDEX arms_registry_created ON arms(registry_id, created_at);
-- Candidates share the primary key with the new design (or are co-primary) and a partition or none.
-- The primary key leads because it is the selective one; the partition is tested within it.
CREATE INDEX arms_registry_primary_partition ON arms(registry_id, primary_key, partition_key);

-- Derived search tags, rewritten with the row on every edit. A search is an AND of tags.
CREATE TABLE arms_tags (
  arms_id     TEXT NOT NULL REFERENCES arms(id) ON DELETE CASCADE,
  registry_id TEXT NOT NULL,
  tag         TEXT NOT NULL,
  PRIMARY KEY (arms_id, tag)
);

CREATE INDEX arms_tags_lookup ON arms_tags(registry_id, tag);

-- The owner's email address, as an HMAC-SHA-256 of the normalised address keyed by a Worker secret
-- (never the address itself). key_version names the key that made it, so the key can be replaced.
-- One address per entry; recovery looks entries up by the HMAC.
CREATE TABLE owner_emails (
  arms_id     TEXT PRIMARY KEY REFERENCES arms(id) ON DELETE CASCADE,
  email_hmac  TEXT NOT NULL,       -- hex HMAC-SHA-256 of the normalised address
  key_version INTEGER NOT NULL,    -- which EMAIL_HMAC_KEY produced email_hmac
  created_at  TEXT NOT NULL
);

CREATE INDEX owner_emails_lookup ON owner_emails(email_hmac, key_version);

-- Single-use recovery tokens, emailed in a link's fragment. A token lets its holder either take a
-- new edit link for one entry or withdraw it, once, before it expires. Only the SHA-256 is stored.
CREATE TABLE owner_tokens (
  token_hash TEXT PRIMARY KEY,     -- SHA-256 hex of the token (never the token)
  arms_id    TEXT NOT NULL REFERENCES arms(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at    TEXT                  -- set atomically when the token is redeemed; NULL until then
);

CREATE INDEX owner_tokens_arms ON owner_tokens(arms_id);
CREATE INDEX owner_tokens_expiry ON owner_tokens(expires_at);
