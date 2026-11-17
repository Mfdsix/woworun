import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth/session";
import { getConnection } from "@/lib/strava/connection";

export const dynamic = "force-dynamic";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export default async function SettingsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/unlock");

  const connection = await getConnection(userId);
  if (!connection) redirect("/connect");

  const status = connection.status === "active" ? "Connected" : "Needs reconnect";

  return (
    <main className="screen">
      <div className="settings">
        <div className="settings-head">
          <p className="brand">Walk Log</p>
          <Link className="btn btn-sm btn-ghost" href="/">
            Back to dashboard
          </Link>
        </div>

        <section className="panel">
          <h1 className="heading">Account</h1>
          <dl className="settings-rows">
            <div className="settings-row">
              <dt>Athlete</dt>
              <dd>{connection.athleteName ?? "Your Strava account"}</dd>
            </div>
            <div className="settings-row">
              <dt>Connection</dt>
              <dd>{status}</dd>
            </div>
            <div className="settings-row">
              <dt>Connected</dt>
              <dd>{DATE_FORMAT.format(connection.connectedAt)}</dd>
            </div>
          </dl>
          <div className="settings-actions">
            <form action="/api/strava/refresh" method="post">
              <button className="btn btn-sm btn-ghost" type="submit">
                Refresh now
              </button>
            </form>
            <form action="/api/auth/logout" method="post">
              <button className="btn btn-sm btn-ghost" type="submit">
                Lock
              </button>
            </form>
            <a className="btn btn-sm btn-ghost" href="/api/export" download>
              Download my data
            </a>
          </div>
        </section>

        <section className="panel">
          <h2 className="heading">Data</h2>
          <p className="sub">
            Activity summaries are cached for up to 1 hour. Strava access tokens are encrypted at
            rest.
          </p>
        </section>

        <section className="panel danger-zone">
          <h2 className="heading">Danger zone</h2>
          <p className="hint">
            Disconnecting revokes Walk Log&apos;s access. Deleting removes your PIN space, cached
            data, and encrypted tokens permanently.
          </p>
          <div className="settings-actions">
            <form action="/api/strava/disconnect" method="post">
              <button className="btn btn-sm" type="submit">
                Disconnect Strava
              </button>
            </form>
            <Link className="btn btn-sm btn-danger" href="/settings/delete">
              Delete everything
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
