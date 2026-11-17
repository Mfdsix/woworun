import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth/session";
import { getConnection } from "@/lib/strava/connection";
import { NeedsReauthError } from "@/lib/strava/errors";
import { getDashboard } from "@/lib/strava/sync";
import { DashboardHeader } from "@/app/dashboard/header";
import { MonthHero } from "@/app/dashboard/month-hero";
import { RecentList } from "@/app/dashboard/recent-list";
import { RhythmStrip } from "@/app/dashboard/rhythm-strip";
import { RunnerMark } from "@/app/dashboard/runner-mark";
import { SessionsChart } from "@/app/dashboard/sessions-chart";
import { SyncBanner } from "@/app/dashboard/sync-banner";

export const dynamic = "force-dynamic";

type StravaPageProps = {
  searchParams: Promise<{ sync?: string }>;
};

export default async function StravaPage({ searchParams }: StravaPageProps) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/unlock");

  const connection = await getConnection(userId);
  if (!connection || connection.status !== "active") redirect("/connect");

  const { sync } = await searchParams;

  let result;
  try {
    result = await getDashboard(userId);
  } catch (error) {
    if (error instanceof NeedsReauthError) redirect("/connect");

    return (
      <main className="screen">
        <div className="panel">
          <h1>Sync unavailable</h1>
          <p className="sub">
            We could not reach Strava just now. Your saved walks are untouched.
          </p>
          <a className="btn btn-ghost" href="/strava">
            Try again
          </a>
        </div>
      </main>
    );
  }

  const { data, computedAt, stale } = result;

  return (
    <main className="screen dashboard">
      <DashboardHeader
        athleteName={connection.athleteName ?? "Your Strava account"}
        computedAt={computedAt}
        stale={stale}
      />
      <SyncBanner status={sync} stale={stale} />
      <div className="dash-grid">
        <section className="panel overview-panel">
          <RunnerMark />
          <MonthHero
            month={data.month}
            last7={data.last7}
            fiveKStreak={data.records.fiveKStreak}
            longestMonthM={data.records.longestMonthM}
          />
          <div className="overview-detail">
            <SessionsChart sessions={data.sessions} />
            <RhythmStrip rhythm={data.rhythm} />
          </div>
        </section>
        <section className="panel recent-panel">
          <RecentList recent={data.recent} />
        </section>
      </div>
      <footer className="dash-footer">
        <span>Powered by Strava</span>
        <span>{data.last7.walkCount} walks in the last 7 days</span>
      </footer>
    </main>
  );
}
