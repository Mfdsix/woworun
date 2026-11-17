import assert from "node:assert/strict";
import test from "node:test";
import type { WalkSession } from "../lib/strava/types";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  filterWalksByRange,
  monthGrid,
  monthLabel,
  rangeForView,
  rangeLabel,
  startOfWeek,
  startOfMonth,
  summarizeWalks,
} from "../app/manual/calendar-utils";

function walk(id: string, startLocal: string, distanceM: number, movingTimeS: number): WalkSession {
  return { id, name: id, startLocal, distanceM, movingTimeS, elapsedTimeS: movingTimeS };
}

test("month grid starts on monday and covers the month", () => {
  const grid = monthGrid("2026-11-17");
  const flat = grid.flat();

  assert.equal(flat[0], "2026-10-26"); // monday before nov 1
  assert.ok(flat.includes("2026-11-01"));
  assert.ok(flat.includes("2026-11-30"));
  assert.ok(flat.every((date) => date < "2026-12-01" || grid[grid.length - 1].includes(date)));
  assert.ok(grid.every((row) => row.length === 7));
});

test("week helpers use monday start", () => {
  assert.equal(startOfWeek("2026-11-18"), "2026-11-16"); // wednesday → monday
  assert.equal(endOfWeek("2026-11-18"), "2026-11-22");
});

test("add months clamps the day", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-11-17", 1), "2026-12-17");
  assert.equal(addMonths("2026-11-17", -1), "2026-10-17");
});

test("month boundaries and labels", () => {
  assert.equal(startOfMonth("2026-11-17"), "2026-11-01");
  assert.equal(endOfMonth("2026-11-17"), "2026-11-30");
  assert.equal(monthLabel("2026-11-17"), "November 2026");
});

test("range for view covers day, week, and month", () => {
  assert.deepEqual(rangeForView("day", "2026-11-17"), { start: "2026-11-17", end: "2026-11-17" });
  assert.deepEqual(rangeForView("week", "2026-11-18"), {
    start: "2026-11-16",
    end: "2026-11-22",
  });
  assert.deepEqual(rangeForView("month", "2026-11-17"), {
    start: "2026-11-01",
    end: "2026-11-30",
  });
});

test("filter and summarize walks by range", () => {
  const walks = [
    walk("a", "2026-11-16T16:54:47+07:00", 7067.4, 4893),
    walk("b", "2026-11-12T16:45:40+07:00", 5470.7, 4174),
    walk("c", "2026-10-29T16:49:24+07:00", 3380.9, 2683),
  ];

  const day = filterWalksByRange(walks, { start: "2026-11-16", end: "2026-11-16" });
  assert.equal(day.length, 1);
  assert.equal(day[0].id, "a");

  const summary = summarizeWalks(day);
  assert.equal(summary.count, 1);
  assert.equal(summary.distanceM, 7067.4);
  assert.equal(summary.movingTimeS, 4893);
  assert.ok(Math.abs(summary.avgPaceSecPerKm - 692.3) < 0.5);

  const empty = summarizeWalks(filterWalksByRange(walks, { start: "2026-11-01", end: "2026-11-01" }));
  assert.equal(empty.count, 0);
  assert.equal(empty.avgPaceSecPerKm, 0);
});

test("range labels", () => {
  assert.equal(rangeLabel("day", { start: "2026-11-17", end: "2026-11-17" }), "17 Nov");
  assert.equal(
    rangeLabel("week", { start: "2026-11-16", end: "2026-11-22" }),
    "16 Nov – 22 Nov",
  );
  assert.equal(rangeLabel("month", { start: "2026-11-01", end: "2026-11-30" }), "November 2026");
});
