-- Exactly one default registry: a second row with is_default = 1 is rejected.
CREATE UNIQUE INDEX IF NOT EXISTS registries_one_default ON registries(is_default) WHERE is_default = 1;

-- Candidates for the "too close" check share field division, ordinary and charge with the new
-- design (every other way two designs can differ is decided on the candidates themselves). Ending
-- in created_at lets the lookup return them in registration order without a sort.
CREATE INDEX IF NOT EXISTS arms_registry_similarity ON arms(registry_id, field_division, ordinary, charge, created_at);

-- Tags follow their entry: deleting an arms row deletes its tags. SQLite cannot alter a foreign
-- key, so the table is rebuilt and its rows copied across.
DROP TABLE IF EXISTS arms_tags_rebuild;

CREATE TABLE arms_tags_rebuild (
  arms_id     TEXT NOT NULL REFERENCES arms(id) ON DELETE CASCADE,
  registry_id TEXT NOT NULL,
  tag         TEXT NOT NULL,
  PRIMARY KEY (arms_id, tag)
);

INSERT INTO arms_tags_rebuild (arms_id, registry_id, tag)
SELECT arms_id, registry_id, tag FROM arms_tags;

DROP TABLE arms_tags;

ALTER TABLE arms_tags_rebuild RENAME TO arms_tags;

CREATE INDEX IF NOT EXISTS arms_tags_lookup ON arms_tags(registry_id, tag);
