-- Convert single numeric answer length to structured enumeration array
ALTER TABLE "Clue" ADD COLUMN "answerEnumeration" INTEGER[];

UPDATE "Clue"
SET "answerEnumeration" = ARRAY["answerLength"];

ALTER TABLE "Clue"
ALTER COLUMN "answerEnumeration" SET NOT NULL;

ALTER TABLE "Clue" DROP COLUMN "answerLength";
