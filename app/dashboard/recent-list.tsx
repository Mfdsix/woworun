import { formatDuration, formatKm, formatPace, formatShortDate } from "@/lib/format";
import type { WalkSession } from "@/lib/strava/types";

type RecentListProps = {
  recent: WalkSession[];
  linkToStrava?: boolean;
};

function stravaUrl(id: string): string {
  return `https://www.strava.com/activities/${id}`;
}

export function RecentList({ recent, linkToStrava = true }: RecentListProps) {
  return (
    <div className="recent">
      <p className="eyebrow">RECENT</p>

      {recent.length === 0 ? (
        <p className="empty-note">No walks yet.</p>
      ) : (
        <ul className="recent-list">
          {recent.map((walk) => {
            const href = stravaUrl(walk.id);
            return (
              <li className="recent-row" key={walk.id}>
                <div>
                  {linkToStrava ? (
                    <a className="recent-name" href={href} target="_blank" rel="noreferrer">
                      {walk.name}
                    </a>
                  ) : (
                    <span className="recent-name">{walk.name}</span>
                  )}
                  <p className="recent-meta">
                    {formatShortDate(walk.startLocal)}
                    {linkToStrava && (
                      <>
                        {" · "}
                        <a className="strava-link" href={href} target="_blank" rel="noreferrer">
                          View on Strava
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <div className="recent-stats">
                  <p>{formatKm(walk.distanceM)} km</p>
                  <p className="recent-meta">
                    {formatDuration(walk.movingTimeS)} ·{" "}
                    {formatPace(walk.movingTimeS / (walk.distanceM / 1000))}/km
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
