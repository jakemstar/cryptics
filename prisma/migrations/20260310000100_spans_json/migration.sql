ALTER TABLE "Clue"
ADD COLUMN IF NOT EXISTS "spans" JSONB NOT NULL DEFAULT '{"indicator":[],"fodder":[],"definition":[]}';

DROP TABLE IF EXISTS "ClueSpan";
DROP TYPE IF EXISTS "ClueSpanType";
