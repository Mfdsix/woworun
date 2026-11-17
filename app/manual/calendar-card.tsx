"use client";

import { formatDuration, formatKm } from "@/lib/format";
import { jakartaToday, monthKey } from "@/lib/strava/dates";
import type { WalkSession } from "@/lib/strava/types";
import {
  distanceByDay,
  monthGrid,
  monthLabel,
  rangeForView,
  rangeLabel,
  type CalendarView,
} from "./calendar-utils";

type CalendarCardProps = {
  walks: WalkSession[];
  view: CalendarView;
  anchorDate: string;
  streak: number;
  summary: { count: number; distanceM: number; movingTimeS: number };
  onSelectDate: (date: string) => void;
  onViewChange: (view: CalendarView) => void;
  onMonthNav: (delta: number) => void;
  onToday: () => void;
};

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function CalendarCard({
  walks,
  view,
  anchorDate,
  streak,
  summary,
  onSelectDate,
  onViewChange,
  onMonthNav,
  onToday,
}: CalendarCardProps) {
  const grid = monthGrid(anchorDate);
  const distances = distanceByDay(walks);
  const anchorMonth = monthKey(anchorDate);
  const monthMax = Math.max(
    0,
    ...grid
      .flat()
      .filter((date) => monthKey(date) === anchorMonth)
      .map((date) => distances[date] ?? 0),
  );
  const today = jakartaToday();
  const viewRange = rangeForView(view, anchorDate);

  return (
    <section className="wl-card wl-calendar">
      <div className="wl-cal-head">
        <div className="wl-cal-nav">
          <button
            className="wl-cal-btn"
            type="button"
            aria-label="Previous month"
            onClick={() => onMonthNav(-1)}
          >
            ‹
          </button>
          <span className="wl-cal-month">{monthLabel(anchorDate)}</span>
          <button
            className="wl-cal-btn"
            type="button"
            aria-label="Next month"
            onClick={() => onMonthNav(1)}
          >
            ›
          </button>
        </div>
        <div className="wl-actions">
          <div className="wl-tabs" role="tablist" aria-label="Calendar range">
            {(["day", "week", "month"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={view === option}
                className={view === option ? "is-active" : ""}
                onClick={() => onViewChange(option)}
              >
                {option === "day" ? "Day" : option === "week" ? "Week" : "Month"}
              </button>
            ))}
          </div>
          <button className="wl-btn wl-btn-ghost" type="button" onClick={onToday}>
            Today
          </button>
        </div>
      </div>

      <div className="wl-cal-weekdays">
        {WEEKDAYS.map((weekday, index) => (
          <span className="wl-cal-weekday" key={`${weekday}-${index}`}>
            {weekday}
          </span>
        ))}
      </div>

      <div className="wl-cal-grid">
        {grid.flat().map((date) => {
          const outside = monthKey(date) !== anchorMonth;
          const distance = distances[date] ?? 0;
          const inSelectedRange =
            date >= viewRange.start && date <= viewRange.end && !outside;
          const isSelected = date === anchorDate && !outside;
          const isTodayCell = date === today;
          const intensity = monthMax > 0 ? distance / monthMax : 0;

          let background: string | undefined;
          if (isSelected) {
            background = "rgba(255, 85, 0, 0.5)";
          } else if (distance > 0) {
            background = `rgba(255, 85, 0, ${(0.08 + 0.34 * intensity).toFixed(3)})`;
          } else if (inSelectedRange) {
            background = "rgba(255, 255, 255, 0.04)";
          }

          return (
            <button
              key={date}
              type="button"
              className={`wl-cal-cell${outside ? " is-outside" : ""}${
                isTodayCell ? " is-today" : ""
              }${inSelectedRange ? " is-in-range" : ""}${isSelected ? " is-selected" : ""}`}
              style={background ? { background } : undefined}
              onClick={() => onSelectDate(date)}
              disabled={outside}
              aria-label={`${date}${distance > 0 ? `, ${formatKm(distance)} km` : ", no walk"}`}
            >
              <span className="wl-cal-daynum">{Number(date.slice(8, 10))}</span>
              {distance > 0 && <span className="wl-cal-dot" />}
            </button>
          );
        })}
      </div>

      <div className="wl-cal-summary">
        <span className="wl-cal-summary-label">{rangeLabel(view, viewRange)}</span>
        <span className="wl-cal-summary-stats">
          {summary.count} walks · {formatKm(summary.distanceM)} km ·{" "}
          {formatDuration(summary.movingTimeS)}
        </span>
      </div>

      <div className="wl-streak-row">
        <span className="wl-streak">
          <span aria-hidden="true">▲</span>
          {streak >= 2 ? `${streak} walks ≥5k in a row` : "No 5k streak yet"}
        </span>
        <span className="wl-kicker">CONSISTENCY</span>
      </div>
    </section>
  );
}
