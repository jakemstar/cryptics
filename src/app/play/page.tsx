import Link from "next/link";
import { Suspense } from "react";

import { ClueWithHints } from "~/app/play/_components/clue-with-hints";
import { api } from "~/trpc/server";

type SearchParamsShape = {
  exclude?: string;
};

type PlayPageProps = {
  searchParams?: Promise<SearchParamsShape>;
};

function PlayClueFallback() {
  return (
    <div className="min-h-28 rounded-xl border border-(--color-border) bg-(--color-surface) p-12 shadow-sm">
      <p className="text-2xl text-(--color-muted)">Loading clue...</p>
    </div>
  );
}

async function PlayClueCard({ excludeClueId }: { excludeClueId?: string }) {
  const clue = await api.clue.next({
    excludeClueId,
  });

  return clue ? (
    <ClueWithHints
      clueId={clue.id}
      answerEnumeration={clue.answerEnumeration}
      spans={clue.spans}
      text={clue.text}
    />
  ) : (
    <div className="min-h-28 rounded-xl border border-(--color-border) bg-(--color-surface) p-12 shadow-sm">
      <p className="text-2xl text-(--color-muted)">
        No clues available right now.
      </p>
    </div>
  );
}

export default async function PlayPage({ searchParams }: PlayPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const excludeClueId = params?.exclude;

  return (
    <main className="min-h-screen bg-(--color-bg) px-6 py-16 text-(--color-text) sm:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <h1 className="text-4xl font-bold tracking-tight">Play</h1>

        <Suspense fallback={<PlayClueFallback />}>
          <PlayClueCard excludeClueId={excludeClueId} />
        </Suspense>

        <div>
          <Link
            className="text-sm font-semibold text-(--color-primary) hover:underline"
            href="/"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
