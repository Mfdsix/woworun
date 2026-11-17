import assert from "node:assert/strict";
import test from "node:test";
import { parsePiActivities } from "../lib/import/pi-activities";

const base = {
  activity_id: "a-1",
  platform_activity_id: "21007194669",
  activity_date: "2026-11-16",
  start_date: "2026-11-16T16:54:47+07:00",
  end_date: "2026-11-16T18:16:20+07:00",
  title: "Easy 6k",
  sport_name: "Walking",
  distance: 7067.4,
  duration: 4893,
  points: 3,
  points_status: "counted",
};

test("maps walking activities and sums points", () => {
  const result = parsePiActivities({
    data: [
      base,
      { ...base, activity_id: "a-2", platform_activity_id: 2, distance: 5000, points: 2 },
    ],
  });

  assert.equal(result.walks.length, 2);
  assert.equal(result.points, 5);
  assert.equal(result.rejected, 0);
  assert.equal(result.walks[0].id, "21007194669");
  assert.equal(result.walks[1].id, "2");
  assert.equal(result.walks[0].distanceM, 7067.4);
  assert.equal(result.walks[0].movingTimeS, 4893);
  assert.equal(result.walks[0].elapsedTimeS, 4893);
});

test("drops non-walking activities and rejected points", () => {
  const result = parsePiActivities({
    data: [
      base,
      { ...base, activity_id: "run", sport_name: "Running" },
      { ...base, activity_id: "rejected", points_status: "rejected" },
    ],
  });

  assert.equal(result.walks.length, 1);
  assert.equal(result.points, 3);
  assert.equal(result.rejected, 2);
});

test("falls back to activity_id when platform id is missing", () => {
  const { platform_activity_id: _ignored, ...withoutPlatform } = base;
  const result = parsePiActivities({ data: [withoutPlatform] });

  assert.equal(result.walks[0].id, "a-1");
});
