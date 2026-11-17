import assert from "node:assert/strict";
import test from "node:test";
import {
  activityKey,
  mergeActivities,
  parseStored,
  serializeStored,
  type StoredActivity,
} from "../lib/import/activity-store";
import type { WalkSession } from "../lib/strava/types";

const walk: WalkSession = {
  id: "manual-1",
  name: "Easy 6k",
  startLocal: "2026-11-16T16:54:00+07:00",
  distanceM: 7070,
  movingTimeS: 4860,
  elapsedTimeS: 4920,
};

test("activity key ignores the generated id and the title", () => {
  const a = activityKey(walk);
  const b = activityKey({ ...walk, id: "something-else", name: "  Renamed walk " });

  assert.equal(a, b);
  assert.notEqual(a, activityKey({ ...walk, distanceM: 7071 }));
});

test("merge skips existing rows and duplicates inside the same paste", () => {
  const existing = mergeActivities([], [{ walk, points: 3 }], new Date("2026-11-17T00:00:00Z"));
  assert.equal(existing.added, 1);

  const second = mergeActivities(
    existing.items,
    [
      { walk: { ...walk, id: "manual-2" }, points: 3 },
      { walk: { ...walk, id: "manual-3", startLocal: "2026-11-12T16:45:00+07:00" }, points: 3 },
    ],
    new Date("2026-11-17T00:00:00Z"),
  );

  assert.equal(second.added, 1);
  assert.equal(second.duplicates, 1);
  assert.equal(second.items.length, 2);
});

test("storage round-trip keeps valid items and rejects garbage", () => {
  const stored: StoredActivity[] = [
    {
      key: activityKey(walk),
      walk,
      points: 3,
      addedAt: "2026-11-17T00:00:00.000Z",
    },
  ];

  const parsed = parseStored(serializeStored(stored));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].points, 3);
  assert.equal(parsed[0].walk.name, "Easy 6k");

  assert.deepEqual(parseStored(null), []);
  assert.deepEqual(parseStored("not json"), []);
  assert.deepEqual(parseStored(JSON.stringify({ version: 2, items: stored })), []);
});
