import { listManualActivities, manualToWalk } from "@/lib/manual/activities";
import { buildDashboard } from "@/lib/strava/metrics";
import { ManualClient } from "./manual-client";

export async function ManualDashboard({ userId }: { userId: string }) {
  const rows = await listManualActivities(userId);
  const walks = rows.map(manualToWalk);
  const points = rows.reduce((total, row) => total + row.points, 0);
  const data = walks.length > 0 ? buildDashboard(walks, new Date()) : null;

  return (
    <ManualClient
      userId={userId}
      data={data}
      walkCount={rows.length}
      points={points}
    />
  );
}
