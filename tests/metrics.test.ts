import test from "node:test";
import assert from "node:assert/strict";
import { buildDashboard } from "../lib/strava/metrics";
import type { WalkSession } from "../lib/strava/types";

function walk(
  id: string,
  startLocal: string,
  distanceM: number,
  minutes: number,
): WalkSession {
  const movingTimeS = minutes * 60;
  return {
    id,
    name: id,
    startLocal,
    distanceM,
    movingTimeS,
    elapsedTimeS: movingTimeS,
  };
}

const NOW = new Date("2026-11-16T12:00:00+07:00");

const FIXTURE: WalkSession[] = [
  walk("easy-6k", "2026-11-16T16:54:00Z", 7070, 81),
  walk("third-5k", "2026-11-12T16:45:00Z", 5470, 69),
  walk("second-5k", "2026-11-09T17:05:00Z", 5250, 58),
  walk("5k", "2026-11-06T16:54:00Z", 5550, 63),
  walk("amjay-4k", "2026-11-04T17:02:00Z", 4700, 51),
  walk("strava", "2026-11-02T16:50:00Z", 3850, 45),
];

test("month aggregates match the November fixture", () => {
  const data = buildDashboard(FIXTURE, NOW);

  assert.equal(data.month.distanceM, 31890);
  assert.equal(data.month.movingTimeS, 22020);
  assert.equal(data.month.walkCount, 6);
  assert.ok(Math.abs(data.month.avgPaceSecPerKm - 690.5) <= 1);
  assert.equal(data.month.label, "November");
  assert.equal(data.month.previous, null);
});

test("last7 window compares against the previous seven days", () => {
  const data = buildDashboard(FIXTURE, NOW);

  assert.equal(data.last7.distanceM, 12540);
  assert.equal(data.last7.walkCount, 2);
  assert.equal(data.last7.deltaM, -2960);
  assert.ok(Math.abs(data.last7.avgPaceSecPerKm - 717.7) <= 1);
});

test("sessions and recent lists are newest first and capped", () => {
  const data = buildDashboard(FIXTURE, NOW);

  assert.equal(data.sessions.length, 6);
  assert.equal(data.sessions[0].id, "easy-6k");
  assert.equal(data.recent.length, 4);
  assert.equal(data.recent[0].id, "easy-6k");
  assert.equal(data.recent[3].id, "5k");
});

test("rhythm covers 21 days ending today", () => {
  const data = buildDashboard(FIXTURE, NOW);

  assert.equal(data.rhythm.days.length, 21);
  assert.equal(data.rhythm.days[0].date, "2026-10-27");
  assert.equal(data.rhythm.days[20].date, "2026-11-16");
  assert.equal(data.rhythm.activeDays, 6);
  assert.ok(data.rhythm.avgGapDays !== null);
  assert.ok(Math.abs(data.rhythm.avgGapDays - 2.8) <= 0.05);
  assert.equal(data.rhythm.usualStartMinute, 1014);
});

test("streak and records reflect the fixture", () => {
  const data = buildDashboard(FIXTURE, NOW);

  assert.equal(data.streak.current, 1);
  assert.equal(data.streak.best, 1);
  assert.equal(data.streak.todayActive, true);
  assert.equal(data.records.longestMonthM, 7070);
  assert.equal(data.records.fiveKStreak, 4);
});

test("streak counts back from yesterday when today has no walk", () => {
  const walks = [
    walk("nov-14", "2026-11-14T17:00:00Z", 4000, 45),
    walk("nov-15", "2026-11-15T17:00:00Z", 4200, 47),
  ];
  const data = buildDashboard(walks, NOW);

  assert.equal(data.streak.todayActive, false);
  assert.equal(data.streak.current, 2);
  assert.equal(data.streak.best, 2);
});

test("empty input produces zeroed, finite values", () => {
  const data = buildDashboard([], NOW);

  assert.equal(data.month.distanceM, 0);
  assert.equal(data.month.movingTimeS, 0);
  assert.equal(data.month.walkCount, 0);
  assert.equal(data.month.avgPaceSecPerKm, 0);
  assert.equal(data.month.previous, null);

  assert.equal(data.last7.distanceM, 0);
  assert.equal(data.last7.movingTimeS, 0);
  assert.equal(data.last7.walkCount, 0);
  assert.equal(data.last7.avgPaceSecPerKm, 0);
  assert.equal(data.last7.deltaM, null);

  assert.deepEqual(data.sessions, []);
  assert.deepEqual(data.recent, []);

  assert.equal(data.rhythm.days.length, 21);
  assert.equal(data.rhythm.activeDays, 0);
  assert.equal(data.rhythm.avgGapDays, null);
  assert.equal(data.rhythm.usualStartMinute, null);

  assert.equal(data.streak.current, 0);
  assert.equal(data.streak.best, 0);
  assert.equal(data.streak.todayActive, false);

  assert.equal(data.records.longestMonthM, 0);
  assert.equal(data.records.fiveKStreak, 0);

  const numericLeaves = [
    data.month.distanceM,
    data.month.movingTimeS,
    data.month.walkCount,
    data.month.avgPaceSecPerKm,
    data.last7.distanceM,
    data.last7.movingTimeS,
    data.last7.walkCount,
    data.last7.avgPaceSecPerKm,
    data.rhythm.activeDays,
    data.streak.current,
    data.streak.best,
    data.records.longestMonthM,
    data.records.fiveKStreak,
  ];

  for (const value of numericLeaves) {
    assert.ok(Number.isFinite(value));
  }
});

test("input array is not mutated", () => {
  const input = [...FIXTURE];
  buildDashboard(input, NOW);

  assert.deepEqual(
    input.map((item) => item.id),
    FIXTURE.map((item) => item.id),
  );
});
