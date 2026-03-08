import Link from "next/link";

export default function PlayPage() {
  return (
    <main className="min-h-screen bg-(--color-bg) px-6 py-16 text-(--color-text) sm:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <h1 className="text-4xl font-bold tracking-tight">Play</h1>
        <p className="text-base text-(--color-muted)">
          Crossword gameplay is coming soon. This page is ready for the next implementation step.
        </p>
        <div>
          <Link className="text-sm font-semibold text-(--color-primary) hover:underline" href="/">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}

