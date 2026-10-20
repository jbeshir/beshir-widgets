-- Phase D charge types. Two values the Worker stores for every registered entry change meaning, and the Worker has no
-- path to recompute them:
--   * the annulet joins the roundel's type class (an annulet is a distinct change from a roundel, never a substantial one:
--     Halawa bint Tariq 05/2023), so the conflict key `primary_key` of a design whose primary is annulets changes from
--     `charge:annulet` to `charge:roundel`;
--   * the cross crosslet moves to the new Crosses category, so its `charge-category:` tag in `arms_tags` changes.
-- The owner decided the registry may be thrown away (as in 0007 and 0008), so every registered entry is discarded rather
-- than migrated, with its tags, owner emails and owner tokens. The schema and `registries` are unchanged.
DELETE FROM owner_tokens;
DELETE FROM owner_emails;
DELETE FROM arms_tags;
DELETE FROM arms;
