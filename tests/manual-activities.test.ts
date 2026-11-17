import assert from "node:assert/strict";
import test from "node:test";
import { parseManualActivities } from "../lib/import/manual-activities";

const SAMPLE = `
Action
Tanggal
Mulai
Selesai
Status
Aktivitas
Jenis olahraga
Poin
Durasi
Jarak
Kalori

16 Nov 2026
16 Nov 2026, 16.54
16 Nov 2026, 18.16
Diterima
Easy 6k
Walking
+3
1j 21m
7,07 km
0 kkal

12 Nov 2026
12 Nov 2026, 16.45
12 Nov 2026, 17.55
Diterima
3rd 5k
Walking
+3
1j 9m
5,47 km
0 kkal

9 Nov 2026
9 Nov 2026, 17.05
9 Nov 2026, 18.03
Diterima
2nd 5k
Walking
+3
58m
5,25 km
0 kkal
`;

test("parses the pasted table with headers and blank lines", () => {
  const result = parseManualActivities(SAMPLE);

  assert.equal(result.walks.length, 3);
  assert.equal(result.points, 9);
  assert.equal(result.rejected, 0);
  assert.equal(result.otherSport, 0);
  assert.equal(result.invalid, 0);

  assert.equal(result.walks[0].name, "Easy 6k");
  assert.equal(result.walks[0].startLocal, "2026-11-16T16:54:00+07:00");
  assert.equal(result.walks[0].distanceM, 7070);
  assert.equal(result.walks[0].movingTimeS, 4860);
  assert.equal(result.walks[0].elapsedTimeS, 4920);

  assert.equal(result.walks[1].distanceM, 5470);
  assert.equal(result.walks[2].movingTimeS, 3480);
});

test("accepts tab-separated rows without a header", () => {
  const text = [
    "16 Nov 2026\t16 Nov 2026, 16.54\t16 Nov 2026, 18.16\tDiterima\tEasy 6k\tWalking\t+3\t1j 21m\t7,07 km\t0 kkal",
    "12 Nov 2026\t12 Nov 2026, 16.45\t12 Nov 2026, 17.55\tDiterima\t3rd 5k\tWalking\t+3\t1j 9m\t5,47 km\t0 kkal",
  ].join("\n");

  const result = parseManualActivities(text);
  assert.equal(result.walks.length, 2);
  assert.equal(result.walks[1].distanceM, 5470);
});

test("skips rejected rows and non-walking sports", () => {
  const text = [
    "16 Nov 2026\t16 Nov 2026, 16.54\t16 Nov 2026, 18.16\tDiterima\tEasy 6k\tWalking\t+3\t1j 21m\t7,07 km\t0 kkal",
    "15 Nov 2026\t15 Nov 2026, 16.54\t15 Nov 2026, 17.10\tDitolak\tRejected\tWalking\t+0\t16m\t1,2 km\t0 kkal",
    "14 Nov 2026\t14 Nov 2026, 16.54\t14 Nov 2026, 17.10\tDiterima\tRun\tRunning\t+3\t16m\t3,2 km\t0 kkal",
  ].join("\n");

  const result = parseManualActivities(text);
  assert.equal(result.walks.length, 1);
  assert.equal(result.rejected, 1);
  assert.equal(result.otherSport, 1);
  assert.equal(result.points, 3);
});

test("supports rows without the calories column", () => {
  const text = [
    "16 Nov 2026",
    "16 Nov 2026, 16.54",
    "16 Nov 2026, 18.16",
    "Diterima",
    "Easy 6k",
    "Walking",
    "+3",
    "1j 21m",
    "7,07 km",
  ].join("\n");

  const result = parseManualActivities(text);
  assert.equal(result.walks.length, 1);
  assert.equal(result.walks[0].distanceM, 7070);
});

test("counts malformed rows as invalid", () => {
  const text = [
    "16 Nov 2026",
    "not a time",
    "not a time",
    "Diterima",
    "Easy 6k",
    "Walking",
    "+3",
    "1j 21m",
    "7,07 km",
    "0 kkal",
  ].join("\n");

  const result = parseManualActivities(text);
  assert.equal(result.walks.length, 0);
  assert.equal(result.invalid, 1);
});
