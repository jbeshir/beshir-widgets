-- The shape each entry is displayed in: a heater shield, a square banner, a round or a lozenge.
-- Display only: it is not part of the design JSON, the signature, the blazon or the tags, so two
-- entries that differ only in shape are the same arms. Rows registered before this column existed
-- are heater shields.
ALTER TABLE arms ADD COLUMN field_shape TEXT NOT NULL DEFAULT 'heater'
  CHECK (field_shape IN ('heater', 'banner', 'round', 'lozenge'));
