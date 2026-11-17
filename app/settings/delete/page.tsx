import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function DeleteAccountPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/unlock");

  return (
    <main className="screen">
      <div className="settings">
        <div className="settings-head">
          <p className="brand">Walk Log</p>
          <Link className="btn btn-sm btn-ghost" href="/settings">
            Cancel
          </Link>
        </div>

        <section className="panel danger-zone">
          <h1 className="heading">Delete everything?</h1>
          <p className="sub">
            This permanently removes your PIN space, encrypted Strava tokens, and cached activity
            summaries. Your Strava account and activities are not touched.
          </p>
          <p className="hint">
            You will need to create a new PIN space and connect Strava again. Strava access will be
            revoked first when possible.
          </p>
          <form action="/api/account/delete" method="post">
            <button className="btn btn-danger" type="submit">
              Yes, delete everything
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
