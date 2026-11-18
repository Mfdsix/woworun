"use client";

import type { CSSProperties } from "react";
import { formatDuration, formatKm } from "@/lib/format";
import { jakartaToday, monthKey } from "@/lib/strava/dates";
import type { WalkSession } from "@/lib/strava/types";
import { daysInMonth, monthGrid, monthLabel, type CalendarView } from "./calendar-utils";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_SHORT = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type CalendarCardProps = {
  walks: WalkSession[];
  view: CalendarView;
  anchorDate: string;
  selectedDate: string | null;
  streak: number;
  onSelectDate: (date: string) => void;
  onViewChange: (view: CalendarView) => void;
  onMonthNav: (delta: number) => void;
  onToday: () => void;
  onAddForDate: (date: string) => void;
};

function pillStyle(totalKm: number, isSelected: boolean): CSSProperties {
  void totalKm;
  if (isSelected) {
    return {
      background: "#fc4c02",
      boxShadow: "0 1px 6px rgba(252, 76, 2, 0.3)",
      color: "#fff",
    };
  }
  return {};
}

export function CalendarCard({
  walks,
  view,
  anchorDate,
  selectedDate,
  streak,
  onSelectDate,
  onViewChange,
  onMonthNav,
  onToday,
  onAddForDate,
}: CalendarCardProps) {
  const anchorMonth = monthKey(anchorDate);
  const monthWalks = walks.filter((walk) => monthKey(walk.startLocal) === anchorMonth);
  const monthKm = monthWalks.reduce((sum, walk) => sum + walk.distanceM, 0);
  const monthSeconds = monthWalks.reduce((sum, walk) => sum + walk.movingTimeS, 0);
  const activeDays = new Set(monthWalks.map((walk) => walk.startLocal.slice(0, 10))).size;
  const totalDays = daysInMonth(anchorDate);
  const consistency = totalDays > 0 ? Math.min(100, Math.round((activeDays / totalDays) * 100)) : 0;
  const distances = new Map<string, number>();
  for (const walk of walks) {
    const date = walk.startLocal.slice(0, 10);
    distances.set(date, (distances.get(date) ?? 0) + walk.distanceM);
  }
  const grid = monthGrid(anchorDate);
  const today = jakartaToday();
  const viewIndex = view === "day" ? 0 : view === "week" ? 1 : 2;
  const viewRange = view === "day"
    ? { start: anchorDate, end: anchorDate }
    : null;

  let title = monthLabel(anchorDate);
  if (view === "day") {
    const month = Number(anchorDate.slice(5, 7));
    title = `${Number(anchorDate.slice(8, 10))} ${MONTH_NAMES[month - 1]} ${anchorDate.slice(0, 4)}`;
  } else if (view === "week") {
    const weekStart = grid.flat().find((date) => date === anchorDate);
    void weekStart;
    const flat = grid.flat();
    const anchorIndex = Math.max(0, flat.indexOf(anchorDate));
    const first = flat[anchorIndex - (anchorIndex % 7)] ?? anchorDate;
    const last = flat[anchorIndex - (anchorIndex % 7) + 6] ?? anchorDate;
    const month = Number(last.slice(5, 7));
    title = `${Number(first.slice(8, 10))} – ${Number(last.slice(8, 10))} ${MONTH_SHORT[month - 1]} ${last.slice(0, 4)}`;
  }

  function dayKm(date: string): number {
    return (distances.get(date) ?? 0) / 1000;
  }

  function daySeconds(date: string): number {
    const walksOfDay = walks.filter((walk) => walk.startLocal.slice(0, 10) === date);
    return walksOfDay.reduce((sum, walk) => sum + walk.movingTimeS, 0);
  }

  function dayTitle(date: string): string {
    const walksOfDay = walks.filter((walk) => walk.startLocal.slice(0, 10) === date);
    return walksOfDay.length > 0 ? walksOfDay[0].name : "";
  }

  function renderMonthGrid() {
    return (
      <div className="cal-viewport">
        <div className="cal-weekdays">
          {WEEKDAY_SHORT.map((weekday, index) => (
            <span className="cal-weekday" key={`${weekday}-${index}`}>
              {weekday}
            </span>
          ))}
        </div>
        <div className="cal-grid">
          {grid.flat().map((date) => {
            const dayKmValue = dayKm(date);
            const hasWalk = dayKmValue > 0;
            const outside = monthKey(date) !== anchorMonth;
            const isSelected = selectedDate === date;
            const isTodayCell = date === today;

            if (hasWalk) {
              return (
                <button
                  key={date}
                  type="button"
                  className={`cal-pill${isSelected ? " is-selected" : ""}`}
                  style={pillStyle(dayKmValue, isSelected)}
                  data-km={`${dayKmValue.toFixed(1)} km`}
                  onClick={() => onSelectDate(date)}
                  aria-label={`${date}, ${dayKmValue.toFixed(1)} km`}
                >
                  <span className="cal-pill-day">{Number(date.slice(8, 10))}</span>
                  <span className="cal-pill-dot" />
                </button>
              );
            }

            if (isTodayCell) {
              return (
                <button
                  key={date}
                  type="button"
                  className={`cal-ring-cell${isSelected ? " is-picked" : ""}`}
                  onClick={() => onSelectDate(date)}
                  aria-label={`${date}, today`}
                >
                  <span className="cal-ring-day">{Number(date.slice(8, 10))}</span>
                  <span className="cal-ring-dot" />
                </button>
              );
            }

            return (
              <button
                key={date}
                type="button"
                className={`cal-plain-cell${outside ? " is-outside" : ""}${isSelected ? " is-picked" : ""}`}
                onClick={() => onSelectDate(date)}
                disabled={outside}
                aria-label={`${date}${outside ? "" : ", no walk"}`}
              >
                {Number(date.slice(8, 10))}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderWeekStrip() {
    const flat = grid.flat();
    const anchorIndex = Math.max(0, flat.indexOf(anchorDate));
    const rowStart = anchorIndex - (anchorIndex % 7);
    const weekSlice = flat.slice(rowStart, rowStart + 7);

    return (
      <div className="cal-viewport">
        <div className="cal-week-strip">
          {weekSlice.map((date, index) => {
            const dayKmValue = dayKm(date);
            const hasWalk = dayKmValue > 0;
            const isSelected = selectedDate === date;
            const isTodayCell = date === today;

            if (hasWalk) {
              return (
                <button
                  key={date}
                  type="button"
                  className={`cal-pill cal-pill-tall${isSelected ? " is-selected" : ""}`}
                  style={pillStyle(dayKmValue, isSelected)}
                  data-km={`${dayKmValue.toFixed(1)} km`}
                  onClick={() => onSelectDate(date)}
                  aria-label={`${date}, ${dayKmValue.toFixed(1)} km`}
                >
                  <span className="cal-side-label">{WEEKDAY_LABELS[index]}</span>
                  <span className="cal-pill-day">{Number(date.slice(8, 10))}</span>
                  <span className="cal-side-label">{dayKmValue.toFixed(1)}k</span>
                </button>
              );
            }

            if (isTodayCell) {
              return (
                <button
                  key={date}
                  type="button"
                  className="cal-ring-cell cal-ring-tall"
                  onClick={() => onSelectDate(date)}
                  aria-label={`${date}, today`}
                >
                  <span className="cal-side-label is-accent">{WEEKDAY_LABELS[index]}</span>
                  <span className="cal-ring-day">{Number(date.slice(8, 10))}</span>
                  <span className="cal-side-label">today</span>
                </button>
              );
            }

            return (
              <button
                key={date}
                type="button"
                className="cal-week-empty"
                onClick={() => onSelectDate(date)}
                aria-label={`${date}, no walk`}
              >
                <span className="cal-side-label">{WEEKDAY_LABELS[index]}</span>
                <span className="cal-week-daynum">{Number(date.slice(8, 10))}</span>
                <span className="cal-side-label">—</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderDaySpotlight() {
    const dayKmValue = dayKm(anchorDate);
    const daySecondsValue = daySeconds(anchorDate);
    const hasWalk = dayKmValue > 0;
    const isTodayCell = anchorDate === today;

    if (hasWalk) {
      return (
        <div className="cal-viewport">
          <div
            className="cal-spotlight"
            style={{
              background: "rgba(252, 76, 2, 0.14)",
              border: "1px solid rgba(252, 76, 2, 0.3)",
            }}
          >
            <div>
              <div className="cal-spotlight-kicker">{dayTitle(anchorDate)}</div>
              <div className="cal-spotlight-km">{dayKmValue.toFixed(1)} km</div>
            </div>
            <div className="cal-spotlight-meta">
              <div>{formatDuration(daySecondsValue)}</div>
              <div className="cal-spotlight-pace">
                {(() => {
                  const total = Math.max(1, Math.round(daySecondsValue / dayKmValue));
                  const minutes = Math.floor(total / 60);
                  const seconds = total % 60;
                  return `${minutes}'${String(seconds).padStart(2, "0")}"`;
                })()}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="cal-viewport">
        <div className="cal-spotlight-ring">
          <div>
            <div className="cal-spotlight-kicker is-accent">
              {isTodayCell ? "Today · rest or pending" : "No walk logged"}
            </div>
            <div className="cal-spotlight-date">{anchorDate}</div>
          </div>
          <button className="wl-btn wl-btn-ghost" type="button" onClick={() => onAddForDate(anchorDate)}>
            + Log Day
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="wl-card wl-calendar2">
      <div className="cal-controls">
        <div className="wl-cal-nav">
          <button className="wl-cal-btn" type="button" aria-label="Previous period" onClick={() => onMonthNav(-1)}>
            ‹
          </button>
          <h2 className="wl-cal-month">{title}</h2>
          <button className="wl-cal-btn" type="button" aria-label="Next period" onClick={() => onMonthNav(1)}>
            ›
          </button>
        </div>

        <div className="wl-actions">
          <div className="cal-switch">
            <span
              className="cal-switch-thumb"
              style={{ left: `calc(${viewIndex * 33.333}% + 2px)`, width: "calc(33.333% - 4px)" }}
            />
            {(["day", "week", "month"] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={`cal-switch-tab${view === option ? " is-active" : ""}`}
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

      <div className="cal-body">
        {view === "month" ? renderMonthGrid() : view === "week" ? renderWeekStrip() : renderDaySpotlight()}
      </div>

      <div className="gradient-divider" />

      <div className="cal-summary">
        <div className="cal-summary-left">
          <span className="cal-summary-km">{formatKm(monthKm)} km</span>
          <span className="cal-summary-sub">
            {monthWalks.length} walks · {formatDuration(monthSeconds)}
          </span>
        </div>
        <div className="cal-consistency">
          <span className="wl-streak">
            <span aria-hidden="true">▲</span>
            {streak >= 2 ? `${streak} walks ≥5k in a row` : "No 5k streak yet"}
          </span>
          <div className="cal-consistency-inner">
            <div className="cal-consistency-track">
              <span style={{ width: `${consistency}%` }} />
            </div>
            <span className="cal-consistency-label">
              {activeDays}/{totalDays}d · {consistency}%
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
