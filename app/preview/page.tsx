import { notFound } from "next/navigation";
import { DashboardHeader } from "@/app/dashboard/header";
import { MonthHero } from "@/app/dashboard/month-hero";
import { RecentList } from "@/app/dashboard/recent-list";
import { RhythmStrip } from "@/app/dashboard/rhythm-strip";
import { RunnerMark } from "@/app/dashboard/runner-mark";
import { SessionsChart } from "@/app/dashboard/sessions-chart";
import type { DashboardData, RhythmDay } from "@/lib/strava/types";

export const dynamic = "force-static";

const walks: DashboardData["sessions"] = [
  {
    id: "1",
    name: "Easy 6k",
    startLocal: "2026-11-16T16:54:00Z",
    distanceM: 7070,
    movingTimeS: 4860,
    elapsedTimeS: 4920,
  },
  {
    id: "2",
    name: "3rd 5k",
    startLocal: "2026-11-12T16:45:00Z",
    distanceM: 5470,
    movingTimeS: 4140,
    elapsedTimeS: 4200,
  },
  {
    id: "3",
    name: "2nd 5k",
    startLocal: "2026-11-09T17:05:00Z",
    distanceM: 5250,
    movingTimeS: 3480,
    elapsedTimeS: 3480,
  },
  {
    id: "4",
    name: "5k?",
    startLocal: "2026-11-06T16:54:00Z",
    distanceM: 5550,
    movingTimeS: 3780,
    elapsedTimeS: 3780,
  },
  {
    id: "5",
    name: "Amjay 4k",
    startLocal: "2026-11-04T17:02:00Z",
    distanceM: 4700,
    movingTimeS: 3060,
    elapsedTimeS: 3120,
  },
  {
    id: "6",
    name: "Strava",
    startLocal: "2026-11-02T16:50:00Z",
    distanceM: 3850,
    movingTimeS: 2700,
    elapsedTimeS: 2760,
  },
];

const activeDates = new Set([2, 4, 6, 9, 12, 16]);
const days: RhythmDay[] = Array.from({ length: 21 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 9, 27 + index));
  const iso = date.toISOString().slice(0, 10);
  return { date: iso, active: activeDates.has(Number(iso.slice(8, 10))) };
});

const data: DashboardData = {
  month: {
    label: "November",
    distanceM: 31890,
    movingTimeS: 22020,
    walkCount: 6,
    avgPaceSecPerKm: 690.5,
    previous: { distanceM: 28400, throughDay: 16 },
  },
  last7: {
    distanceM: 12540,
    movingTimeS: 9000,
    walkCount: 2,
    avgPaceSecPerKm: 717.7,
    deltaM: -2960,
  },
  sessions: walks,
  recent: walks.slice(0, 4),
  rhythm: {
    days,
    activeDays: 6,
    avgGapDays: 2.8,
    usualStartMinute: 1016,
  },
  streak: { current: 1, best: 1, todayActive: true },
  records: { longestMonthM: 7070, fiveKStreak: 4 },
};

export default function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="screen dashboard">
      <DashboardHeader athleteName="Jakarta Walker" computedAt={new Date()} stale={false} />
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
