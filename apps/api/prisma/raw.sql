-- Applied by `pnpm db:raw` after every migration. Idempotent.

-- 1. Full-text search over title + body.
--    'simple' rather than 'english': the corpus is multilingual, so stemming in
--    one language would degrade the others.
ALTER TABLE "suggestions" DROP COLUMN IF EXISTS "search_vector";
ALTER TABLE "suggestions"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("body", ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS "suggestions_search_vector_idx"
  ON "suggestions" USING GIN ("search_vector");

-- 2. One live suggestion per person per cycle. Partial, so withdrawing frees
--    the slot again without deleting the record.
CREATE UNIQUE INDEX IF NOT EXISTS "suggestions_one_per_cycle_idx"
  ON "suggestions" ("submitter_id", "cycle_id")
  WHERE "status" <> 'WITHDRAWN' AND "cycle_id" IS NOT NULL;

-- 3. Keep vote_count honest even if application code is bypassed.
CREATE OR REPLACE FUNCTION sync_vote_count() RETURNS trigger AS $$
BEGIN
  UPDATE "suggestions" s
     SET "vote_count" = (SELECT count(*) FROM "votes" v WHERE v."suggestion_id" = s."id")
   WHERE s."id" = COALESCE(NEW."suggestion_id", OLD."suggestion_id");
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS votes_sync_count ON "votes";
CREATE TRIGGER votes_sync_count
  AFTER INSERT OR DELETE ON "votes"
  FOR EACH ROW EXECUTE FUNCTION sync_vote_count();
