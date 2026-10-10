-- The text a free-text search runs over: the blazon, the plain-English gloss and the display name,
-- lowercased with punctuation removed and one space at each end, so a whole word or phrase is a
-- " word " substring. The Worker writes it on every register and edit; it never holds contact
-- details, email or field shape.
--
-- Rows that exist when this runs get an approximation of that text so they stay findable: the stored
-- name and blazon with only commas and hyphens turned into spaces (accents and other punctuation are
-- left as they are, and the gloss cannot be computed in SQL). The next edit of a row rewrites it exactly.
ALTER TABLE arms ADD COLUMN search_text TEXT NOT NULL DEFAULT '';

UPDATE arms
SET search_text = ' ' || trim(replace(replace(replace(lower(display_name || ' ' || blazon), ',', ' '), '-', ' '), '  ', ' ')) || ' ';
