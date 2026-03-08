import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "~/server/better-auth";
import { getSession } from "~/server/better-auth/server";

export async function HomeSessionActions() {
  const session = await getSession();

  if (!session) {
    return (
      <form>
        <button
          className="w-full rounded-lg border border-(--color-border) bg-(--color-surface) px-5 py-3 text-sm font-semibold transition hover:bg-(--color-surface-hover)"
          formAction={async () => {
            "use server";
            const res = await auth.api.signInSocial({
              body: {
                provider: "github",
                callbackURL: "/",
              },
            });

            if (!res.url) {
              throw new Error("No URL returned from signInSocial");
            }

            redirect(res.url);
          }}
        >
          Login
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-(--color-muted)">
        Logged in as {session.user?.name ?? session.user?.email}
      </p>
      <form>
        <button
          className="w-full rounded-lg border border-(--color-border) bg-(--color-surface) px-5 py-3 text-sm font-semibold transition hover:bg-(--color-surface-hover)"
          formAction={async () => {
            "use server";
            await auth.api.signOut({
              headers: await headers(),
            });
            redirect("/");
          }}
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
