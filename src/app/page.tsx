import Link from "next/link";
import { Suspense } from "react";

import { HomeSessionActions } from "~/app/_components/home-session-actions";

function HomeSessionActionsFallback() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-(--color-muted)">Checking account...</p>
      <div className="w-full rounded-lg border border-(--color-border) bg-(--color-surface) px-5 py-3 text-sm font-semibold text-(--color-muted)">
        Loading...
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-(--color-bg) text-(--color-text)">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 py-6 sm:px-8">
        <section className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
          <div className="space-y-3">
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">Cryptics</h1>
            <p className="text-base text-(--color-muted) sm:text-lg">
              Crack clues, sharpen your wits, and play cryptic crosswords.
            </p>
          </div>

          <div className="flex w-full max-w-xs flex-col gap-3">
            <Link
              className="rounded-lg bg-(--color-primary) px-5 py-3 text-sm font-semibold text-(--color-primary-text) transition hover:opacity-90"
              href="/play"
            >
              Play
            </Link>

            <Suspense fallback={<HomeSessionActionsFallback />}>
              <HomeSessionActions />
            </Suspense>
          </div>
        </section>
      </div>
    </main>
  );
}

