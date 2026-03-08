"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import { api } from "~/trpc/react";

type SpanType = "INDICATOR" | "DEFINITION" | "FODDER";

type ClueSpan = {
  id: string;
  clueId: string;
  type: SpanType;
  startIndex: number;
  endIndex: number;
};

type Props = {
  clueId: string;
  text: string;
  answerEnumeration: number[];
  spans: ClueSpan[];
};

type RevealedMap = Record<SpanType, boolean>;

type Segment = {
  text: string;
  type: SpanType | null;
};

const TYPE_STYLES: Record<SpanType, string> = {
  INDICATOR:
    "bg-amber-200/80 text-amber-950 dark:bg-amber-300/30 dark:text-amber-100",
  DEFINITION: "bg-sky-200/80 text-sky-950 dark:bg-sky-300/30 dark:text-sky-100",
  FODDER:
    "bg-emerald-200/80 text-emerald-950 dark:bg-emerald-300/30 dark:text-emerald-100",
};

const formatEnumeration = (enumeration: number[]) =>
  `(${enumeration.join(",")})`;

const getSpanTypeAtIndex = (
  index: number,
  spans: ClueSpan[],
): SpanType | null => {
  for (const span of spans) {
    if (index >= span.startIndex && index < span.endIndex) {
      return span.type;
    }
  }

  return null;
};

const buildSegments = (text: string, spans: ClueSpan[]): Segment[] => {
  if (!text.length) return [];

  const segments: Segment[] = [];
  let segmentStart = 0;
  let currentType = getSpanTypeAtIndex(0, spans);

  for (let i = 1; i < text.length; i += 1) {
    const nextType = getSpanTypeAtIndex(i, spans);
    if (nextType === currentType) continue;

    segments.push({
      text: text.slice(segmentStart, i),
      type: currentType,
    });

    segmentStart = i;
    currentType = nextType;
  }

  segments.push({
    text: text.slice(segmentStart),
    type: currentType,
  });

  return segments;
};

const isTextTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
};

export function ClueWithHints({
  clueId,
  text,
  answerEnumeration,
  spans,
}: Props) {
  const router = useRouter();
  const totalLetters = useMemo(
    () => answerEnumeration.reduce((sum, part) => sum + part, 0),
    [answerEnumeration],
  );

  const [menuOpen, setMenuOpen] = useState(false);
  const [revealed, setRevealed] = useState<RevealedMap>({
    INDICATOR: false,
    DEFINITION: false,
    FODDER: false,
  });
  const [guessLetters, setGuessLetters] = useState<string[]>(
    Array.from({ length: totalLetters }, () => ""),
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSolved, setIsSolved] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isNextCluePending, startNextClueTransition] = useTransition();

  const submitGuess = api.clue.submitGuess.useMutation();

  const segments = useMemo(() => buildSegments(text, spans), [text, spans]);
  const hasEmptyBoxes = guessLetters.some((letter) => !letter);

  useEffect(() => {
    setGuessLetters(Array.from({ length: totalLetters }, () => ""));
    setActiveIndex(0);
    setIsSolved(false);
    setErrorMessage(null);
    setIsShaking(false);
  }, [clueId, totalLetters]);

  const setRevealOn = (type: SpanType) => {
    setRevealed((current) =>
      current[type] ? current : { ...current, [type]: true },
    );
  };

  const triggerShake = () => {
    setIsShaking(false);
    requestAnimationFrame(() => {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 360);
    });
  };

  const submitCurrentGuess = useCallback(async () => {
    if (hasEmptyBoxes) {
      setErrorMessage("Fill all letter boxes before checking.");
      return;
    }

    setErrorMessage(null);

    const result = await submitGuess.mutateAsync({
      clueId,
      guess: guessLetters.join(""),
    });

    if (result.correct) {
      setIsSolved(true);
      setErrorMessage(null);
      return;
    }

    setErrorMessage("Not quite right. Try again.");
    triggerShake();
  }, [clueId, guessLetters, hasEmptyBoxes, submitGuess]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitCurrentGuess();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isSolved || submitGuess.isPending) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTextTarget(event.target)) return;

      if (event.key === "Backspace") {
        event.preventDefault();
        setGuessLetters((current) => {
          const next = [...current];

          if (next[activeIndex]) {
            next[activeIndex] = "";
            return next;
          }

          if (activeIndex > 0) {
            const previous = activeIndex - 1;
            next[previous] = "";
            setActiveIndex(previous);
          }

          return next;
        });
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        void submitCurrentGuess();
        return;
      }

      if (!/^[a-zA-Z]$/.test(event.key)) return;

      event.preventDefault();
      const letter = event.key.toUpperCase();
      setGuessLetters((current) => {
        const next = [...current];
        next[activeIndex] = letter;
        const nextIndex = Math.min(activeIndex + 1, next.length - 1);
        setActiveIndex(nextIndex);
        return next;
      });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, isSolved, submitCurrentGuess, submitGuess.isPending]);

  return (
    <div className="relative min-h-28 rounded-xl border border-(--color-border) bg-(--color-surface) p-12 shadow-sm">
      <div className="absolute top-6 right-6">
        <button
          className="rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm font-semibold text-(--color-text) transition-colors duration-150 hover:bg-(--color-surface-hover)"
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          Hints
        </button>

        {menuOpen ? (
          <div className="absolute right-0 mt-2 w-56 rounded-lg border border-(--color-border) bg-(--color-surface) p-3 shadow-lg">
            <div className="flex flex-col gap-2">
              <button
                className="rounded-md bg-amber-200/80 px-3 py-2 text-left text-sm font-semibold text-amber-950 transition-opacity hover:opacity-90 dark:bg-amber-300/30 dark:text-amber-100"
                onClick={() => setRevealOn("INDICATOR")}
                type="button"
              >
                Reveal indicators
              </button>
              <button
                className="rounded-md bg-sky-200/80 px-3 py-2 text-left text-sm font-semibold text-sky-950 transition-opacity hover:opacity-90 dark:bg-sky-300/30 dark:text-sky-100"
                onClick={() => setRevealOn("DEFINITION")}
                type="button"
              >
                Reveal definition
              </button>
              <button
                className="rounded-md bg-emerald-200/80 px-3 py-2 text-left text-sm font-semibold text-emerald-950 transition-opacity hover:opacity-90 dark:bg-emerald-300/30 dark:text-emerald-100"
                onClick={() => setRevealOn("FODDER")}
                type="button"
              >
                Reveal fodder
              </button>
              <button
                className="rounded-md border border-(--color-border) px-3 py-2 text-left text-sm font-semibold text-(--color-muted)"
                disabled
                type="button"
              >
                Reveal a letter (soon)
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <p className="pr-28 text-2xl leading-relaxed">
        {segments.map((segment, index) => {
          if (!segment.type) {
            return <span key={`${index}-plain`}>{segment.text}</span>;
          }

          const isRevealed = revealed[segment.type];

          return (
            <span
              className={`rounded-sm ${isRevealed ? TYPE_STYLES[segment.type] : "bg-transparent"}`}
              key={`${index}-${segment.type}`}
            >
              {segment.text}
            </span>
          );
        })}{" "}
        <span className="font-semibold">
          {formatEnumeration(answerEnumeration)}
        </span>
      </p>

      <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
        <p className="text-sm font-semibold text-(--color-muted)">
          Type anywhere to enter your guess. Press Enter to check, Backspace to
          delete. You can also click any box to type from that position.
        </p>

        <div
          className={`flex flex-wrap items-center justify-center gap-4 ${isShaking ? "animate-[clue-shake_360ms_ease-in-out]" : ""}`}
        >
          {answerEnumeration.map((groupLength, groupIndex) => {
            const groupStart = answerEnumeration
              .slice(0, groupIndex)
              .reduce((sum, part) => sum + part, 0);

            return (
              <div
                className="flex items-center gap-1.5"
                key={`group-${groupIndex}`}
              >
                {Array.from({ length: groupLength }, (_, letterIndex) => {
                  const absoluteIndex = groupStart + letterIndex;
                  const letter = guessLetters[absoluteIndex] ?? "";
                  const isActive = absoluteIndex === activeIndex && !isSolved;

                  return (
                    <button
                      className={`flex h-10 w-10 items-center justify-center rounded-md border bg-(--color-bg) text-lg font-semibold uppercase transition outline-none focus:outline-none focus-visible:outline-none ${
                        isActive
                          ? "border-(--color-primary)"
                          : "border-(--color-border)"
                      }`}
                      key={`box-${absoluteIndex}`}
                      onClick={() => setActiveIndex(absoluteIndex)}
                      type="button"
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {submitGuess.isPending ? (
          <p className="text-sm text-(--color-muted)">Checking answer...</p>
        ) : null}

        {errorMessage ? (
          <p className="text-sm text-red-500">{errorMessage}</p>
        ) : null}

        {isSolved ? (
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              Correct! Nice solve.
            </p>
            <button
              className="rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm font-semibold transition-colors duration-150 hover:bg-(--color-surface-hover)"
              disabled={submitGuess.isPending || isNextCluePending}
              onClick={() => {
                setErrorMessage(null);
                setIsShaking(false);
                startNextClueTransition(() => {
                  router.push(`/play?exclude=${encodeURIComponent(clueId)}`);
                });
              }}
              type="button"
            >
              {isNextCluePending ? "Loading next clue..." : "Next clue"}
            </button>
          </div>
        ) : (
          <button
            className="w-fit rounded-md bg-(--color-primary) px-4 py-2 text-sm font-semibold text-(--color-primary-text) transition-opacity duration-150 hover:opacity-90 disabled:opacity-60"
            disabled={submitGuess.isPending || hasEmptyBoxes}
            type="submit"
          >
            {submitGuess.isPending ? "Checking..." : "Check answer"}
          </button>
        )}
      </form>
    </div>
  );
}
