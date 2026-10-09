-- Ownership by email, and a Discord username in place of the free-text contact.
--
-- The free-text `contact` column goes; contacts are now one nullable column per kind, so a new kind
-- is one more ADD COLUMN. `contact` has no index or constraint, so SQLite can drop it in place and
-- every other column, index and foreign key stays as it is.
ALTER TABLE arms DROP COLUMN contact;

-- A Discord username (public, optional): 2-32 characters of a-z, 0-9, '_' and '.', no '..'. The
-- Worker normalises and validates it; the CHECK keeps anything else out of the table.
ALTER TABLE arms ADD COLUMN contact_discord TEXT
  CHECK (contact_discord IS NULL OR (
    length(contact_discord) BETWEEN 2 AND 32
    AND contact_discord NOT GLOB '*[^a-z0-9_.]*'
    AND instr(contact_discord, '..') = 0
  ));

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
