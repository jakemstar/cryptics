/*
  Warnings:

  - You are about to drop the `Post` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ClueSpanType" AS ENUM ('DEFINITION', 'INDICATOR', 'FODDER');

-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_createdById_fkey";

-- DropTable
DROP TABLE "Post";

-- CreateTable
CREATE TABLE "Clue" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "answerLength" INTEGER NOT NULL,
    "authorDifficulty" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClueSpan" (
    "id" TEXT NOT NULL,
    "clueId" TEXT NOT NULL,
    "type" "ClueSpanType" NOT NULL,
    "startIndex" INTEGER NOT NULL,
    "endIndex" INTEGER NOT NULL,

    CONSTRAINT "ClueSpan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserClueProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clueId" TEXT NOT NULL,
    "isSolved" BOOLEAN NOT NULL DEFAULT false,
    "solvedAt" TIMESTAMP(3),
    "hintsUsedCount" INTEGER NOT NULL DEFAULT 0,
    "lettersRevealedCount" INTEGER NOT NULL DEFAULT 0,
    "revealedIndices" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserClueProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClueDifficultyVote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clueId" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClueDifficultyVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Clue_authorDifficulty_idx" ON "Clue"("authorDifficulty");

-- CreateIndex
CREATE INDEX "ClueSpan_clueId_idx" ON "ClueSpan"("clueId");

-- CreateIndex
CREATE INDEX "ClueSpan_clueId_type_idx" ON "ClueSpan"("clueId", "type");

-- CreateIndex
CREATE INDEX "UserClueProgress_userId_isSolved_idx" ON "UserClueProgress"("userId", "isSolved");

-- CreateIndex
CREATE INDEX "UserClueProgress_clueId_idx" ON "UserClueProgress"("clueId");

-- CreateIndex
CREATE UNIQUE INDEX "UserClueProgress_userId_clueId_key" ON "UserClueProgress"("userId", "clueId");

-- CreateIndex
CREATE INDEX "ClueDifficultyVote_clueId_idx" ON "ClueDifficultyVote"("clueId");

-- CreateIndex
CREATE UNIQUE INDEX "ClueDifficultyVote_userId_clueId_key" ON "ClueDifficultyVote"("userId", "clueId");

-- AddForeignKey
ALTER TABLE "ClueSpan" ADD CONSTRAINT "ClueSpan_clueId_fkey" FOREIGN KEY ("clueId") REFERENCES "Clue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserClueProgress" ADD CONSTRAINT "UserClueProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserClueProgress" ADD CONSTRAINT "UserClueProgress_clueId_fkey" FOREIGN KEY ("clueId") REFERENCES "Clue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClueDifficultyVote" ADD CONSTRAINT "ClueDifficultyVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClueDifficultyVote" ADD CONSTRAINT "ClueDifficultyVote_clueId_fkey" FOREIGN KEY ("clueId") REFERENCES "Clue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
