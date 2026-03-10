ALTER TABLE "Clue"
  ADD COLUMN IF NOT EXISTS "definitionIndices" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN IF NOT EXISTS "indicatorIndices" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN IF NOT EXISTS "fodderIndices" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

UPDATE "Clue"
SET
  "definitionIndices" = COALESCE((
    SELECT ARRAY_AGG((value)::INTEGER ORDER BY ord)
    FROM JSONB_ARRAY_ELEMENTS_TEXT(COALESCE("spans"->'definition', '[]'::jsonb)) WITH ORDINALITY AS t(value, ord)
  ), ARRAY[]::INTEGER[]),
  "indicatorIndices" = COALESCE((
    SELECT ARRAY_AGG((value)::INTEGER ORDER BY ord)
    FROM JSONB_ARRAY_ELEMENTS_TEXT(COALESCE("spans"->'indicator', '[]'::jsonb)) WITH ORDINALITY AS t(value, ord)
  ), ARRAY[]::INTEGER[]),
  "fodderIndices" = COALESCE((
    SELECT ARRAY_AGG((value)::INTEGER ORDER BY ord)
    FROM JSONB_ARRAY_ELEMENTS_TEXT(COALESCE("spans"->'fodder', '[]'::jsonb)) WITH ORDINALITY AS t(value, ord)
  ), ARRAY[]::INTEGER[])
WHERE "spans" IS NOT NULL;

ALTER TABLE "Clue"
  DROP COLUMN IF EXISTS "spans";
