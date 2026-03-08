import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "../generated/prisma/index.js";
import { z } from "zod";

const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY = 10;

const spanSchema = z.object({
  type: z.enum(["DEFINITION", "INDICATOR", "FODDER"]),
  startIndex: z.number().int().min(0),
  endIndex: z.number().int().min(0),
});

const clueSchema = z.object({
  text: z.string().min(1),
  answer: z.string().min(1),
  answerEnumeration: z.array(z.number().int().positive()).optional(),
  authorDifficulty: z.number().int().min(MIN_DIFFICULTY).max(MAX_DIFFICULTY),
  spans: z.array(spanSchema).default([]),
});

const cluesFileSchema = z.array(clueSchema);

const normalizeAnswer = (answer) => answer.trim().replace(/\s+/g, " ").toUpperCase();
const answerEnumerationFromNormalizedAnswer = (answer) =>
  answer
    .split(" ")
    .map((segment) => segment.length)
    .filter((length) => length > 0);
const answerLetterCount = (enumeration) => enumeration.reduce((sum, part) => sum + part, 0);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getFileArg = () => {
  const fileFlagIndex = process.argv.findIndex((arg) => arg === "--file");
  if (fileFlagIndex !== -1) {
    return process.argv[fileFlagIndex + 1];
  }

  return path.join(__dirname, "seed-data", "clues.json");
};

const validateSpans = (text, spans, clueIndex) => {
  for (const span of spans) {
    if (span.endIndex <= span.startIndex) {
      throw new Error(
        `Clue ${clueIndex + 1}: span endIndex must be greater than startIndex for ${span.type}.`,
      );
    }

    if (span.endIndex > text.length) {
      throw new Error(
        `Clue ${clueIndex + 1}: span range (${span.startIndex}-${span.endIndex}) exceeds clue text length ${text.length}.`,
      );
    }
  }
};

const resolveEnumeration = (clue, normalizedAnswer, clueIndex) => {
  const computedEnumeration = answerEnumerationFromNormalizedAnswer(normalizedAnswer);
  const configuredEnumeration = clue.answerEnumeration ?? computedEnumeration;

  if (answerLetterCount(configuredEnumeration) !== answerLetterCount(computedEnumeration)) {
    throw new Error(
      `Clue ${clueIndex + 1}: answerEnumeration does not match answer letter count.`,
    );
  }

  return configuredEnumeration;
};

const prisma = new PrismaClient();

const main = async () => {
  const fileArg = getFileArg();
  const filePath = path.isAbsolute(fileArg) ? fileArg : path.resolve(process.cwd(), fileArg);
  const raw = await readFile(filePath, "utf8");
  const json = JSON.parse(raw);
  const parsed = cluesFileSchema.parse(json);

  const existing = await prisma.clue.findMany({
    select: {
      id: true,
      text: true,
    },
  });

  const existingByText = new Map();
  for (const row of existing) {
    const rowsForText = existingByText.get(row.text) ?? [];
    rowsForText.push(row.id);
    existingByText.set(row.text, rowsForText);
  }

  let createdCount = 0;
  let updatedCount = 0;

  for (let index = 0; index < parsed.length; index += 1) {
    const clue = parsed[index];
    validateSpans(clue.text, clue.spans, index);

    const normalizedAnswer = normalizeAnswer(clue.answer);
    const answerEnumeration = resolveEnumeration(clue, normalizedAnswer, index);

    const matchingIds = existingByText.get(clue.text) ?? [];
    if (matchingIds.length > 1) {
      throw new Error(
        `Cannot seed clue with text "${clue.text}" because multiple existing clues share this text.`,
      );
    }

    if (matchingIds.length === 1) {
      const clueId = matchingIds[0];

      await prisma.$transaction([
        prisma.clue.update({
          where: { id: clueId },
          data: {
            text: clue.text,
            answer: normalizedAnswer,
            answerEnumeration,
            authorDifficulty: clue.authorDifficulty,
          },
        }),
        prisma.clueSpan.deleteMany({
          where: { clueId },
        }),
        prisma.clueSpan.createMany({
          data: clue.spans.map((span) => ({
            clueId,
            type: span.type,
            startIndex: span.startIndex,
            endIndex: span.endIndex,
          })),
        }),
      ]);

      updatedCount += 1;
      continue;
    }

    const created = await prisma.clue.create({
      data: {
        text: clue.text,
        answer: normalizedAnswer,
        answerEnumeration,
        authorDifficulty: clue.authorDifficulty,
        spans: {
          create: clue.spans.map((span) => ({
            type: span.type,
            startIndex: span.startIndex,
            endIndex: span.endIndex,
          })),
        },
      },
      select: {
        id: true,
      },
    });

    existingByText.set(clue.text, [created.id]);
    createdCount += 1;
  }

  console.log(`Clue seed complete. Created: ${createdCount}, Updated: ${updatedCount}`);
};

main()
  .catch((error) => {
    console.error("Failed to seed clues.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
