import type { ReactNode } from "react";
import { formatRelativeSync } from "@/lib/format";

type DashboardHeaderProps = {
  athleteName: string;
  computedAt: Date;
  stale: boolean;
  actions?: "strava" | "lock" | "none";
  statusLabel?: ReactNode;
};

export function DashboardHeader({
  athleteName,
  computedAt,
  stale,
  actions = "strava",
  statusLabel,
}: DashboardHeaderProps) {
  return (
    <header className="dash-header">
      <div className="brand-block">
        <p className="brand">Walk Log</p>
        <p className="athlete">{athleteName || "Your Strava account"}</p>
      </div>
      <div className="header-actions">
        <span className="sync-label">
          {statusLabel ?? (
            <>
              Synced {formatRelativeSync(computedAt.toISOString())}
              {stale && <span className="sync-cached"> · cached</span>}
            </>
          )}
        </span>
        {actions === "strava" && (
          <>
            <form action="/api/strava/refresh" method="post">
              <button className="btn btn-sm btn-ghost" type="submit">
                Refresh
              </button>
            </form>
            <form action="/api/auth/logout" method="post">
              <button className="btn btn-sm" type="submit">
                Lock
              </button>
            </form>
            <a className="btn btn-sm btn-ghost" href="/settings">
              Settings
            </a>
          </>
        )}
        {actions === "lock" && (
          <form action="/api/auth/logout" method="post">
            <button className="btn btn-sm" type="submit">
              Lock
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
