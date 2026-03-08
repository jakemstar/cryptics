import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY = 10;
const MIN_VOTES_FOR_BLEND = 1;
const AUTHOR_DIFFICULTY_WEIGHT = 0.4;
const COMMUNITY_DIFFICULTY_WEIGHT = 0.6;

const clueSpanTypeSchema = z.enum(["DEFINITION", "INDICATOR", "FODDER"]);

const clueSpanOutputSchema = z.object({
  id: z.string(),
  clueId: z.string(),
  type: clueSpanTypeSchema,
  startIndex: z.number().int(),
  endIndex: z.number().int(),
});

const userClueProgressOutputSchema = z.object({
  id: z.string(),
  userId: z.string(),
  clueId: z.string(),
  isSolved: z.boolean(),
  solvedAt: z.date().nullable(),
  hintsUsedCount: z.number().int(),
  lastAttemptAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const clueDifficultyVoteOutputSchema = z.object({
  id: z.string(),
  userId: z.string(),
  clueId: z.string(),
  difficulty: z.number().int().min(MIN_DIFFICULTY).max(MAX_DIFFICULTY),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const createdClueOutputSchema = z.object({
  id: z.string(),
  text: z.string(),
  answer: z.string(),
  answerEnumeration: z.array(z.number().int().positive()),
  authorDifficulty: z.number().int().min(MIN_DIFFICULTY).max(MAX_DIFFICULTY),
  createdAt: z.date(),
  updatedAt: z.date(),
  spans: z.array(clueSpanOutputSchema),
});

const nextClueOutputSchema = z.object({
  id: z.string(),
  text: z.string(),
  answerEnumeration: z.array(z.number().int().positive()),
  authorDifficulty: z.number().int().min(MIN_DIFFICULTY).max(MAX_DIFFICULTY),
  effectiveDifficulty: z.number(),
  voteCount: z.number().int(),
  spans: z.array(clueSpanOutputSchema),
});

const revealLetterOutputSchema = z.object({
  index: z.number().int().nullable(),
  letter: z.string().length(1).nullable(),
});

const submitGuessOutputSchema = z.object({
  correct: z.boolean(),
  progress: userClueProgressOutputSchema.nullable(),
});

const clueExistsSchema = z.object({ id: z.string() });
const solvedClueRowSchema = z.object({ clueId: z.string() });
const solvedClueRowsSchema = z.array(solvedClueRowSchema);
const difficultyVoteRowSchema = z.object({ difficulty: z.number().int() });
const candidateClueSchema = z.object({
  id: z.string(),
  text: z.string(),
  answerEnumeration: z.array(z.number().int().positive()),
  authorDifficulty: z.number().int(),
  spans: z.array(clueSpanOutputSchema),
  difficultyVotes: z.array(difficultyVoteRowSchema),
});
const candidateCluesSchema = z.array(candidateClueSchema);
const revealClueSchema = z.object({
  id: z.string(),
  answer: z.string(),
  answerEnumeration: z.array(z.number().int().positive()),
});
const guessClueSchema = z.object({
  id: z.string(),
  answer: z.string(),
});

const normalizeAnswer = (answer: string) =>
  answer.trim().replace(/\s+/g, " ").toUpperCase();

const answerEnumerationFromNormalizedAnswer = (answer: string) =>
  answer
    .split(" ")
    .map((segment) => segment.length)
    .filter((length) => length > 0);

const answerLetterCount = (enumeration: number[]) =>
  enumeration.reduce((sum, part) => sum + part, 0);

const computeEffectiveDifficulty = (
  authorDifficulty: number,
  votes: number[],
): number => {
  if (votes.length < MIN_VOTES_FOR_BLEND) {
    return authorDifficulty;
  }

  const averageVote =
    votes.reduce((sum, value) => sum + value, 0) / votes.length;

  return (
    authorDifficulty * AUTHOR_DIFFICULTY_WEIGHT +
    averageVote * COMMUNITY_DIFFICULTY_WEIGHT
  );
};

const nextClueInput = z
  .object({
    targetDifficulty: z
      .number()
      .int()
      .min(MIN_DIFFICULTY)
      .max(MAX_DIFFICULTY)
      .optional(),
    minDifficulty: z
      .number()
      .int()
      .min(MIN_DIFFICULTY)
      .max(MAX_DIFFICULTY)
      .optional(),
    maxDifficulty: z
      .number()
      .int()
      .min(MIN_DIFFICULTY)
      .max(MAX_DIFFICULTY)
      .optional(),
    excludeClueId: z.string().min(1).optional(),
  })
  .refine(
    (value) =>
      value.minDifficulty === undefined ||
      value.maxDifficulty === undefined ||
      value.minDifficulty <= value.maxDifficulty,
    {
      message: "minDifficulty must be less than or equal to maxDifficulty",
      path: ["minDifficulty"],
    },
  );

const createClueInput = z.object({
  text: z.string().min(1),
  answer: z.string().min(1),
  answerEnumeration: z.array(z.number().int().positive()).optional(),
  authorDifficulty: z.number().int().min(MIN_DIFFICULTY).max(MAX_DIFFICULTY),
  spans: z
    .array(
      z.object({
        type: clueSpanTypeSchema,
        startIndex: z.number().int().min(0),
        endIndex: z.number().int().min(0),
      }),
    )
    .default([]),
});

const userProgressSelect = {
  id: true,
  userId: true,
  clueId: true,
  isSolved: true,
  solvedAt: true,
  hintsUsedCount: true,
  lastAttemptAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const clueRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createClueInput)
    .mutation(async ({ ctx, input }) => {
      const textLength = input.text.length;
      for (const span of input.spans) {
        if (span.endIndex <= span.startIndex) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Each span must have endIndex > startIndex",
          });
        }

        if (span.endIndex > textLength) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Span indexes must be within clue text bounds",
          });
        }
      }

      const normalizedAnswer = normalizeAnswer(input.answer);
      const computedEnumeration =
        answerEnumerationFromNormalizedAnswer(normalizedAnswer);
      const answerEnumeration = input.answerEnumeration ?? computedEnumeration;

      if (
        answerLetterCount(answerEnumeration) !==
        answerLetterCount(computedEnumeration)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "answerEnumeration must match the normalized answer letter count",
        });
      }

      const createdRaw: unknown = await ctx.db.clue.create({
        data: {
          text: input.text,
          answer: normalizedAnswer,
          answerEnumeration,
          authorDifficulty: input.authorDifficulty,
          spans: {
            create: input.spans,
          },
        },
        select: {
          id: true,
          text: true,
          answer: true,
          answerEnumeration: true,
          authorDifficulty: true,
          createdAt: true,
          updatedAt: true,
          spans: {
            select: {
              id: true,
              clueId: true,
              type: true,
              startIndex: true,
              endIndex: true,
            },
          },
        },
      });

      return createdClueOutputSchema.parse(createdRaw);
    }),

  next: publicProcedure
    .input(nextClueInput.default({}))
    .query(async ({ ctx, input }) => {
      const solvedClueIds = ctx.session?.user
        ? solvedClueRowsSchema
            .parse(
              await ctx.db.userClueProgress.findMany({
                where: {
                  userId: ctx.session.user.id,
                  isSolved: true,
                },
                select: {
                  clueId: true,
                },
              }),
            )
            .map((progress) => progress.clueId)
        : [];
      const excludedClueIds = Array.from(
        new Set(
          [...solvedClueIds, input.excludeClueId].filter(
            (value): value is string => Boolean(value),
          ),
        ),
      );

      const candidatesRaw: unknown = await ctx.db.clue.findMany({
        where: excludedClueIds.length
          ? {
              id: {
                notIn: excludedClueIds,
              },
            }
          : undefined,
        select: {
          id: true,
          text: true,
          answerEnumeration: true,
          authorDifficulty: true,
          spans: {
            orderBy: {
              startIndex: "asc",
            },
            select: {
              id: true,
              clueId: true,
              type: true,
              startIndex: true,
              endIndex: true,
            },
          },
          difficultyVotes: {
            select: {
              difficulty: true,
            },
          },
        },
      });

      const candidates = candidateCluesSchema.parse(candidatesRaw);

      const cluesWithDifficulty = candidates.map((clue) => {
        const votes = clue.difficultyVotes.map((vote) => vote.difficulty);
        const effectiveDifficulty = computeEffectiveDifficulty(
          clue.authorDifficulty,
          votes,
        );

        return {
          id: clue.id,
          text: clue.text,
          answerEnumeration: clue.answerEnumeration,
          authorDifficulty: clue.authorDifficulty,
          effectiveDifficulty,
          voteCount: votes.length,
          spans: clue.spans,
        };
      });

      const filteredClues = cluesWithDifficulty.filter((clue) => {
        if (
          input.targetDifficulty !== undefined &&
          Math.round(clue.effectiveDifficulty) !== input.targetDifficulty
        ) {
          return false;
        }

        if (
          input.minDifficulty !== undefined &&
          clue.effectiveDifficulty < input.minDifficulty
        ) {
          return false;
        }

        if (
          input.maxDifficulty !== undefined &&
          clue.effectiveDifficulty > input.maxDifficulty
        ) {
          return false;
        }

        return true;
      });

      if (!filteredClues.length) {
        return null;
      }

      const selectedClue =
        filteredClues[Math.floor(Math.random() * filteredClues.length)]!;

      return nextClueOutputSchema.parse(selectedClue);
    }),

  submitSolve: protectedProcedure
    .input(z.object({ clueId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const clueRaw: unknown = await ctx.db.clue.findUnique({
        where: {
          id: input.clueId,
        },
        select: {
          id: true,
        },
      });

      if (!clueRaw) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clue not found",
        });
      }

      clueExistsSchema.parse(clueRaw);

      const now = new Date();

      const progressRaw: unknown = await ctx.db.userClueProgress.upsert({
        where: {
          userId_clueId: {
            userId: ctx.session.user.id,
            clueId: input.clueId,
          },
        },
        update: {
          isSolved: true,
          solvedAt: now,
          lastAttemptAt: now,
        },
        create: {
          userId: ctx.session.user.id,
          clueId: input.clueId,
          isSolved: true,
          solvedAt: now,
          lastAttemptAt: now,
        },
        select: userProgressSelect,
      });

      return userClueProgressOutputSchema.parse(progressRaw);
    }),

  submitGuess: publicProcedure
    .input(
      z.object({
        clueId: z.string().min(1),
        guess: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const clueRaw: unknown = await ctx.db.clue.findUnique({
        where: {
          id: input.clueId,
        },
        select: {
          id: true,
          answer: true,
        },
      });

      if (!clueRaw) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clue not found",
        });
      }

      const clue = guessClueSchema.parse(clueRaw);
      const normalizedGuess = normalizeAnswer(input.guess);
      const compactGuess = normalizedGuess.replace(/\s/g, "");
      const compactAnswer = clue.answer.replace(/\s/g, "");

      if (compactGuess !== compactAnswer) {
        return submitGuessOutputSchema.parse({
          correct: false,
          progress: null,
        });
      }

      if (!ctx.session?.user) {
        return submitGuessOutputSchema.parse({
          correct: true,
          progress: null,
        });
      }

      const now = new Date();

      const progressRaw: unknown = await ctx.db.userClueProgress.upsert({
        where: {
          userId_clueId: {
            userId: ctx.session.user.id,
            clueId: input.clueId,
          },
        },
        update: {
          isSolved: true,
          solvedAt: now,
          lastAttemptAt: now,
        },
        create: {
          userId: ctx.session.user.id,
          clueId: input.clueId,
          isSolved: true,
          solvedAt: now,
          lastAttemptAt: now,
        },
        select: userProgressSelect,
      });

      return submitGuessOutputSchema.parse({
        correct: true,
        progress: userClueProgressOutputSchema.parse(progressRaw),
      });
    }),

  useHint: protectedProcedure
    .input(z.object({ clueId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const clueRaw: unknown = await ctx.db.clue.findUnique({
        where: {
          id: input.clueId,
        },
        select: {
          id: true,
        },
      });

      if (!clueRaw) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clue not found",
        });
      }

      clueExistsSchema.parse(clueRaw);

      const now = new Date();

      const progressRaw: unknown = await ctx.db.userClueProgress.upsert({
        where: {
          userId_clueId: {
            userId: ctx.session.user.id,
            clueId: input.clueId,
          },
        },
        update: {
          hintsUsedCount: {
            increment: 1,
          },
          lastAttemptAt: now,
        },
        create: {
          userId: ctx.session.user.id,
          clueId: input.clueId,
          hintsUsedCount: 1,
          lastAttemptAt: now,
        },
        select: userProgressSelect,
      });

      return userClueProgressOutputSchema.parse(progressRaw);
    }),

  revealLetter: protectedProcedure
    .input(z.object({ clueId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const clueRaw: unknown = await ctx.db.clue.findUnique({
        where: {
          id: input.clueId,
        },
        select: {
          id: true,
          answer: true,
          answerEnumeration: true,
        },
      });

      if (!clueRaw) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clue not found",
        });
      }

      const clue = revealClueSchema.parse(clueRaw);

      const totalLetters = answerLetterCount(clue.answerEnumeration);
      if (totalLetters < 1) {
        return revealLetterOutputSchema.parse({
          index: null,
          letter: null,
        });
      }

      const randomIndex = Math.floor(Math.random() * totalLetters);
      const randomLetter =
        clue.answer.replace(/\s/g, "").charAt(randomIndex) || null;
      const now = new Date();

      await ctx.db.userClueProgress.upsert({
        where: {
          userId_clueId: {
            userId: ctx.session.user.id,
            clueId: input.clueId,
          },
        },
        update: {
          hintsUsedCount: {
            increment: 1,
          },
          lastAttemptAt: now,
        },
        create: {
          userId: ctx.session.user.id,
          clueId: input.clueId,
          hintsUsedCount: 1,
          lastAttemptAt: now,
        },
      });

      return revealLetterOutputSchema.parse({
        index: randomIndex,
        letter: randomLetter,
      });
    }),

  voteDifficulty: protectedProcedure
    .input(
      z.object({
        clueId: z.string().min(1),
        difficulty: z.number().int().min(MIN_DIFFICULTY).max(MAX_DIFFICULTY),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const clueRaw: unknown = await ctx.db.clue.findUnique({
        where: {
          id: input.clueId,
        },
        select: {
          id: true,
        },
      });

      if (!clueRaw) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clue not found",
        });
      }

      clueExistsSchema.parse(clueRaw);

      const voteRaw: unknown = await ctx.db.clueDifficultyVote.upsert({
        where: {
          userId_clueId: {
            userId: ctx.session.user.id,
            clueId: input.clueId,
          },
        },
        update: {
          difficulty: input.difficulty,
        },
        create: {
          userId: ctx.session.user.id,
          clueId: input.clueId,
          difficulty: input.difficulty,
        },
        select: {
          id: true,
          userId: true,
          clueId: true,
          difficulty: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return clueDifficultyVoteOutputSchema.parse(voteRaw);
    }),
});
