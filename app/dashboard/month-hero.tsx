import { formatDuration, formatKm, formatPace } from "@/lib/format";
import type { DashboardData } from "@/lib/strava/types";

type MonthHeroProps = {
  month: DashboardData["month"];
  last7: DashboardData["last7"];
  fiveKStreak: number;
  longestMonthM: number;
};

function signedKm(deltaM: number): { text: string; negative: boolean } {
  const negative = deltaM < 0;
  return {
    text: `${negative ? "-" : "+"}${formatKm(Math.abs(deltaM))}`,
    negative,
  };
}

export function MonthHero({ month, last7, fiveKStreak, longestMonthM }: MonthHeroProps) {
  const compare = month.previous ? signedKm(month.distanceM - month.previous.distanceM) : null;
  const weekDelta = last7.deltaM !== null ? signedKm(last7.deltaM) : null;
  const avgPerWalk = month.walkCount > 0 ? month.distanceM / month.walkCount : 0;

  return (
    <div className="hero">
      <div className="hero-main">
        <p className="eyebrow">{month.label.toUpperCase()}</p>
        <p className="hero-line">
          <span className="hero-number">{formatKm(month.distanceM)}</span>
          <span className="hero-unit">km</span>
        </p>
        <p className="stat-line">
          {month.walkCount} walks · {formatDuration(month.movingTimeS)} ·{" "}
          {formatPace(month.avgPaceSecPerKm)}/km
        </p>
        {month.walkCount > 0 && (
          <p className="mini-stats">
            avg {formatKm(avgPerWalk)} km/walk · longest {formatKm(longestMonthM)} km
          </p>
        )}
        {month.previous && compare && (
          <p className={`delta${compare.negative ? " is-down" : ""}`}>
            {compare.text} km vs 1–{month.previous.throughDay} last month
          </p>
        )}
        {month.walkCount === 0 && (
          <p className="empty-note">
            No walks yet this month. Your last walk is still in Recent.
          </p>
        )}
      </div>

      <div className="last7">
        <p className="eyebrow">LAST 7 DAYS</p>
        <p className="last7-distance">{formatKm(last7.distanceM)} km</p>
        <p className="stat-line">
          {formatDuration(last7.movingTimeS)} · {last7.walkCount} walks
        </p>
        {weekDelta && (
          <p className={`delta${weekDelta.negative ? " is-down" : ""}`}>
            {weekDelta.text} km vs previous 7 days
          </p>
        )}
        {fiveKStreak >= 2 && <p className="badge">{fiveKStreak} walks ≥5k in a row</p>}
      </div>
    </div>
  );
}
