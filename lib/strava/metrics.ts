import { formatMonthLabel } from "../format";
import {
  addDays,
  dayOfMonth,
  diffDays,
  jakartaToday,
  monthKey,
  previousMonthKey,
  todayDayOfMonth,
} from "./dates";
import type { DashboardData, RhythmDay, WalkSession } from "./types";

const RHYTHM_DAYS = 21;
const SESSION_COUNT = 6;
const RECENT_COUNT = 4;
const FIVE_K_METERS = 5000;

function walkDate(walk: WalkSession): string {
  return walk.startLocal.slice(0, 10);
}

function startMinuteOfDay(startLocal: string): number {
  const hours = Number(startLocal.slice(11, 13));
  const minutes = Number(startLocal.slice(14, 16));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function paceSecondsPerKm(movingTimeS: number, distanceM: number): number {
  if (!(distanceM > 0) || !(movingTimeS > 0)) return 0;
  return safeNumber(movingTimeS / (distanceM / 1000));
}

function sumDistance(walks: WalkSession[]): number {
  return safeNumber(walks.reduce((total, walk) => total + safeNumber(walk.distanceM), 0));
}

function sumMovingTime(walks: WalkSession[]): number {
  return safeNumber(walks.reduce((total, walk) => total + safeNumber(walk.movingTimeS), 0));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];

  return (sorted[middle - 1] + sorted[middle]) / 2;
}

export function sortWalksNewestFirst(walks: WalkSession[]): WalkSession[] {
  return [...walks].sort((a, b) => {
    if (a.startLocal === b.startLocal) return 0;
    return a.startLocal < b.startLocal ? 1 : -1;
  });
}

export function uniqueWalkDates(walks: WalkSession[]): string[] {
  return Array.from(new Set(walks.map(walkDate))).sort();
}

export function buildDashboard(walks: WalkSession[], now: Date): DashboardData {
  const sorted = sortWalksNewestFirst(walks);
  const today = jakartaToday(now);
  const currentMonth = monthKey(today);
  const throughDay = todayDayOfMonth(now);

  const monthWalks = sorted.filter((walk) => monthKey(walkDate(walk)) === currentMonth);
  const monthDistanceM = sumDistance(monthWalks);
  const monthMovingTimeS = sumMovingTime(monthWalks);

  const previousWalks = sorted.filter((walk) => {
    const date = walkDate(walk);
    return monthKey(date) === previousMonthKey(today) && dayOfMonth(date) <= throughDay;
  });
  const previous =
    previousWalks.length > 0
      ? { distanceM: sumDistance(previousWalks), throughDay }
      : null;

  const last7Start = addDays(today, -6);
  const previous7Start = addDays(today, -13);
  const previous7End = addDays(today, -7);

  const last7Walks = sorted.filter((walk) => {
    const date = walkDate(walk);
    return date >= last7Start && date <= today;
  });
  const previous7Walks = sorted.filter((walk) => {
    const date = walkDate(walk);
    return date >= previous7Start && date <= previous7End;
  });

  const last7DistanceM = sumDistance(last7Walks);
  const last7MovingTimeS = sumMovingTime(last7Walks);
  const previous7DistanceM = sumDistance(previous7Walks);

  const days: RhythmDay[] = [];
  for (let offset = RHYTHM_DAYS - 1; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    days.push({ date, active: sorted.some((walk) => walkDate(walk) === date) });
  }

  const windowStart = days[0]?.date ?? addDays(today, -(RHYTHM_DAYS - 1));
  const windowEnd = today;
  const windowWalks = sorted.filter((walk) => {
    const date = walkDate(walk);
    return date >= windowStart && date <= windowEnd;
  });

  const activeDatesInWindow = days.filter((day) => day.active).map((day) => day.date);

  let avgGapDays: number | null = null;
  if (activeDatesInWindow.length >= 2) {
    let totalGap = 0;
    for (let index = 1; index < activeDatesInWindow.length; index += 1) {
      totalGap += diffDays(activeDatesInWindow[index], activeDatesInWindow[index - 1]);
    }
    const averageGap = totalGap / (activeDatesInWindow.length - 1);
    avgGapDays = Number.isFinite(averageGap) ? Math.round(averageGap * 10) / 10 : null;
  }

  const startMinutes = windowWalks
    .map((walk) => startMinuteOfDay(walk.startLocal))
    .filter((minute) => Number.isFinite(minute));
  const usualStartMinute = median(startMinutes);

  const dates = uniqueWalkDates(sorted);
  const dateSet = new Set(dates);
  const todayActive = dateSet.has(today);

  let currentStreak = 0;
  let cursor = todayActive ? today : addDays(today, -1);
  while (dateSet.has(cursor)) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  let bestStreak = 0;
  let runLength = 0;
  let previousDate: string | null = null;
  for (const date of dates) {
    if (previousDate !== null && diffDays(date, previousDate) === 1) {
      runLength += 1;
    } else {
      runLength = 1;
    }
    if (runLength > bestStreak) bestStreak = runLength;
    previousDate = date;
  }

  let fiveKStreak = 0;
  for (const walk of sorted) {
    if (safeNumber(walk.distanceM) >= FIVE_K_METERS) {
      fiveKStreak += 1;
    } else {
      break;
    }
  }

  const longestMonthM = monthWalks.reduce(
    (longest, walk) => Math.max(longest, safeNumber(walk.distanceM)),
    0,
  );

  return {
    month: {
      label: formatMonthLabel(today),
      distanceM: monthDistanceM,
      movingTimeS: monthMovingTimeS,
      walkCount: monthWalks.length,
      avgPaceSecPerKm: paceSecondsPerKm(monthMovingTimeS, monthDistanceM),
      previous,
    },
    last7: {
      distanceM: last7DistanceM,
      movingTimeS: last7MovingTimeS,
      walkCount: last7Walks.length,
      avgPaceSecPerKm: paceSecondsPerKm(last7MovingTimeS, last7DistanceM),
      deltaM:
        previous7Walks.length === 0 ? null : last7DistanceM - previous7DistanceM,
    },
    sessions: sorted.slice(0, SESSION_COUNT),
    recent: sorted.slice(0, RECENT_COUNT),
    rhythm: {
      days,
      activeDays: activeDatesInWindow.length,
      avgGapDays,
      usualStartMinute,
    },
    streak: {
      current: currentStreak,
      best: bestStreak,
      todayActive,
    },
    records: {
      longestMonthM: safeNumber(longestMonthM),
      fiveKStreak,
    },
  };
}
