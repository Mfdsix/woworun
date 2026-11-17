import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/app/dashboard/header";
import { MonthHero } from "@/app/dashboard/month-hero";
import { RecentList } from "@/app/dashboard/recent-list";
import { RhythmStrip } from "@/app/dashboard/rhythm-strip";
import { RunnerMark } from "@/app/dashboard/runner-mark";
import { SessionsChart } from "@/app/dashboard/sessions-chart";
import { parsePiActivities } from "@/lib/import/pi-activities";
import { buildDashboard } from "@/lib/strava/metrics";

export const dynamic = "force-dynamic";

const DATA_FILE = join(process.cwd(), "data", "pi-activities.json");

type LocalData =
  | { ok: true; walks: number; points: number; rejected: number }
  | { ok: false; message: string };

export default async function LocalPage() {
  if (process.env.NODE_ENV === "production") notFound();

  let raw: unknown;
  let parsed;
  try {
    raw = JSON.parse(await readFile(DATA_FILE, "utf8"));
    parsed = parsePiActivities(raw);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not read the local JSON file.";
    return <LocalError message={message} />;
  }

  const now = new Date();
  const data = buildDashboard(parsed.walks, now);
  const status: LocalData = {
    ok: true,
    walks: parsed.walks.length,
    points: parsed.points,
    rejected: parsed.rejected,
  };

  return (
    <main className="screen dashboard">
      <DashboardHeader
        athleteName="Individu Bugar - PI"
        computedAt={now}
        stale={false}
        showActions={false}
        statusLabel={
          <>
            Local JSON · {status.walks} walks · {status.points} pts
          </>
        }
      />

      <p className="banner banner-ok">
        Local preview from <code>data/pi-activities.json</code>. No Strava API, no database, no
        cookie.
      </p>

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
        <span>Individu Bugar · local import</span>
        <span>
          {data.last7.walkCount} walks in the last 7 days
          {status.rejected > 0 ? ` · ${status.rejected} excluded` : ""}
        </span>
      </footer>
    </main>
  );
}

function LocalError({ message }: { message: string }) {
  return (
    <main className="screen">
      <div className="pin-card">
        <p className="brand">Walk Log</p>
        <h1 className="heading">Local data not found</h1>
        <p className="sub">
          Put the API response at <code>data/pi-activities.json</code>, then reload this page.
        </p>
        <p className="hint">{message}</p>
      </div>
    </main>
  );
}
