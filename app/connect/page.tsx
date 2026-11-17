import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";
import { getConnection } from "@/lib/strava/connection";

export const dynamic = "force-dynamic";

const ERROR_COPY: Record<string, string> = {
  denied: "You cancelled the Strava authorization.",
  already_linked: "That Strava account is already linked to another PIN.",
  exchange_failed: "Strava connection failed. Please try again.",
  invalid_callback: "Invalid callback. Please try again.",
};

type ConnectPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ConnectPage({ searchParams }: ConnectPageProps) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/unlock");

  const connection = await getConnection(userId);
  if (connection && connection.status === "active") redirect("/strava");

  const params = await searchParams;
  const message = params.error
    ? ERROR_COPY[params.error] ?? "Strava connection failed. Please try again."
    : null;

  const env = getEnv();
  const configured = Boolean(env.STRAVA_CLIENT_ID && env.STRAVA_CLIENT_SECRET);

  return (
    <main className="screen">
      <div className="pin-card">
        <p className="brand">Walk Log</p>
        <h1 className="heading">Connect Strava</h1>
        <p className="sub">
          Walk Log reads your Strava walks to build a calm daily dashboard.
        </p>

        {message ? (
          <p className="error" role="alert">
            {message}
          </p>
        ) : null}

        {configured ? (
          <a className="btn btn-primary" href="/api/strava/connect">
            Connect with Strava
          </a>
        ) : (
          <p className="banner banner-warn">
            Strava is not configured yet. Add <code>STRAVA_CLIENT_ID</code> and{" "}
            <code>STRAVA_CLIENT_SECRET</code> to <code>.env</code>, then restart the server.
          </p>
        )}

        <p className="hint">
          Read-only access to your activities. We never post, edit, or delete anything.
        </p>
        <p className="hint">
          <a href="/privacy">Privacy</a>
        </p>
      </div>
    </main>
  );
}
