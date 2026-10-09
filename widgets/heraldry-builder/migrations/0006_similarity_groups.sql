-- Look-alike charges and mirror images now count only half a difference, so two entries can be too
-- close while their charge, ordinary or field division differ. The too-close lookup therefore keys
-- on groups instead:
--   division_group  the field division, with per bend sinister folded onto per bend ('plain' if plain)
--   ordinary_group  the ordinary type, with bend sinister folded onto bend (NULL when none)
--   charge_group    the charge's similarity group ('quadruped': lion, wolf, unicorn, goat;
--                   'round': rose, gear, sun), else the charge id (NULL when none)
-- The Worker writes them on every register and edit, computed by the heraldry library; rows that
-- exist when this runs are filled in here from the columns they already have (division_group's
-- default only lets SQLite add a NOT NULL column; the UPDATE sets the real value).
ALTER TABLE arms ADD COLUMN division_group TEXT NOT NULL DEFAULT 'plain';
ALTER TABLE arms ADD COLUMN ordinary_group TEXT;
ALTER TABLE arms ADD COLUMN charge_group TEXT;

UPDATE arms SET
  division_group = CASE field_division WHEN 'per-bend-sinister' THEN 'per-bend' ELSE field_division END,
  ordinary_group = CASE ordinary WHEN 'bend-sinister' THEN 'bend' ELSE ordinary END,
  charge_group = CASE
    WHEN charge IN ('lion', 'wolf', 'unicorn', 'goat') THEN 'quadruped'
    WHEN charge IN ('rose', 'gear', 'sun') THEN 'round'
    ELSE charge
  END;

-- Candidates share all three groups with the new design. Ending in (created_at, id) lets the lookup
-- return them in registration order without a sort. It replaces the index on the exact columns.
DROP INDEX IF EXISTS arms_registry_similarity;
CREATE INDEX IF NOT EXISTS arms_registry_similar_groups ON arms(registry_id, division_group, ordinary_group, charge_group, created_at, id);
