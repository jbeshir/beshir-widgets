-- The text a free-text search runs over: the blazon, the plain-English gloss and the display name,
-- lowercased with punctuation removed and one space at each end, so a whole word or phrase is a
-- " word " substring. The Worker writes it on every register and edit; it never holds contact
-- details, email or field shape.
--
-- Rows that exist when this runs get the words that are already stored (name and blazon) so they
-- stay findable; the gloss cannot be computed in SQL, and the next edit adds it.
ALTER TABLE arms ADD COLUMN search_text TEXT NOT NULL DEFAULT '';

UPDATE arms
SET search_text = ' ' || trim(replace(replace(replace(lower(display_name || ' ' || blazon), ',', ' '), '-', ' '), '  ', ' ')) || ' ';
