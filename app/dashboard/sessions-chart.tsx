import { formatKm, formatShortDate } from "@/lib/format";
import type { WalkSession } from "@/lib/strava/types";

type SessionsChartProps = {
  sessions: WalkSession[];
};

export function SessionsChart({ sessions }: SessionsChartProps) {
  const avg =
    sessions.length > 0
      ? sessions.reduce((sum, session) => sum + session.distanceM, 0) / sessions.length
      : 0;
  const max = sessions.reduce((top, session) => Math.max(top, session.distanceM), 0);

  return (
    <div className="chart">
      <div className="chart-head">
        <p className="eyebrow">LAST 6 WALKS</p>
        <p className="chart-sub">avg {formatKm(avg)} km</p>
      </div>

      {sessions.length === 0 ? (
        <p className="empty-note">No walks yet.</p>
      ) : (
        <div className="chart-body">
          <div className="bars">
            {sessions.map((session, index) => {
              const height = max > 0 ? Math.max(6, (session.distanceM / max) * 100) : 0;
              return (
                <div className="bar-col" key={session.id}>
                  <span className="bar-value">{formatKm(session.distanceM)}</span>
                  <div className="bar-track">
                    <div
                      className={`bar${index === 0 ? " is-latest" : ""}`}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <span className="bar-date">{formatShortDate(session.startLocal)}</span>
                </div>
              );
            })}
          </div>
          {max > 0 && (
            <div
              className="avg-line"
              style={{ bottom: `${(avg / max) * 100}%` }}
              aria-hidden="true"
            />
          )}
        </div>
      )}
    </div>
  );
}
