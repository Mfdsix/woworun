import { formatClock, formatShortDate } from "@/lib/format";
import type { DashboardData } from "@/lib/strava/types";

type RhythmStripProps = {
  rhythm: DashboardData["rhythm"];
};

export function RhythmStrip({ rhythm }: RhythmStripProps) {
  const { days, activeDays, avgGapDays, usualStartMinute } = rhythm;
  const first = days[0];
  const last = days[days.length - 1];

  const caption: string[] = [];
  if (avgGapDays !== null) caption.push(`every ~${avgGapDays} days`);
  if (usualStartMinute !== null) caption.push(`usual start ${formatClock(usualStartMinute)}`);
  if (last && !last.active) caption.push("today pending");

  return (
    <div className="rhythm">
      <div className="chart-head">
        <p className="eyebrow">RHYTHM</p>
        <p className="chart-sub">
          {activeDays} of {days.length} days
        </p>
      </div>

      <div className="rhythm-grid">
        {days.map((day, index) => {
          const classes = ["rhythm-dot"];
          if (day.active) classes.push("is-active");
          if (index === days.length - 1) classes.push("is-today");
          return <span className={classes.join(" ")} key={day.date} title={day.date} />;
        })}
      </div>

      <div className="rhythm-range">
        <span>{first ? formatShortDate(first.date) : ""}</span>
        <span>{last ? formatShortDate(last.date) : ""}</span>
      </div>

      {caption.length > 0 && <p className="rhythm-caption">{caption.join(" · ")}</p>}
    </div>
  );
}
