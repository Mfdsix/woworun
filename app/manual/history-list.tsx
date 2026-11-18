"use client";

import type { WalkSession } from "@/lib/strava/types";
import { formatKm, formatPace } from "@/lib/format";
import { formatDuration } from "@/lib/format";

export type HistorySort = "recent" | "distance" | "duration" | "pace";

export function HistoryList({
  walks,
  selectedDate,
  walkCount,
  sortBy,
  onSort,
  onToggleDate,
  onShowAll,
  onRowSelect,
}: {
  walks: WalkSession[];
  selectedDate: string | null;
  walkCount: number;
  sortBy: HistorySort;
  onSort: (key: HistorySort) => void;
  onToggleDate: (date: string) => void;
  onShowAll: () => void;
  onRowSelect?: (date: string) => void;
}) {
  return (
    <>
      <div className="hist-head">
        <div className="hist-head-left">
          <span className="wl-kicker">History</span>
          <span className="wl-count">{walks.length}</span>
          {selectedDate && (
            <button
              className="wl-chip"
              type="button"
              onClick={() => onShowAll()}
            >
              {formatShortDate(selectedDate)} ×
            </button>
          )}
        </div>
        <div className="hist-sort">
          {(
            [
              ["distance", "Dist"],
              ["duration", "Time"],
              ["pace", "Pace"],
            ] as const
          ).map(([key, label], index) => (
            <span key={key} className="inline-flex items-center gap-1.5">
              {index > 0 && <span>·</span>}
              <button
                type="button"
                className={sortBy === key ? "is-active" : ""}
                onClick={() => onSort(key)}
              >
                {label}
              </button>
            </span>
          ))}
        </div>
      </div>
      <div className="hist-list">
        {walks.length === 0 ? (
          <div className="hist-empty">
            <p className="wl-empty-note">
              {selectedDate ? "No walk logged on this date." : "No walks yet."}
            </p>
            {selectedDate && (
              <button className="wl-btn wl-btn-ghost" type="button" onClick={onShowAll}>
                Show all {walkCount} walks
              </button>
            )}
          </div>
        ) : (
          walks.map((walk, index) => (
            <button
              className={`hist-row${selectedDate === walk.startLocal.slice(0, 10) ? " is-active" : ""}`}
              key={walk.id}
              type="button"
              onClick={() => {
                if (onRowSelect) onRowSelect(walk.startLocal.slice(0, 10));
                else onToggleDate(walk.startLocal.slice(0, 10));
              }}
            >
              <div className="hist-main">
                <span className={`hist-dot${index === 0 && !selectedDate ? " is-latest" : ""}`} />
                <span className="hist-name">{walk.name}</span>
                <span className="hist-date">{formatShortDate(walk.startLocal)}</span>
              </div>
              <div className="hist-stats">
                <span className="hist-km">{formatKm(walk.distanceM)} km</span>
                <span className="hist-sep">/</span>
                <span className="hist-duration">{formatDuration(walk.movingTimeS)}</span>
                <span className="hist-sep">·</span>
                <span>{formatPace(walk.movingTimeS / (walk.distanceM / 1000))}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </>
  );
}

function formatShortDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (!year || !month || !day) return iso.slice(0, 10);
  return `${day} ${months[month - 1]}`;
}
