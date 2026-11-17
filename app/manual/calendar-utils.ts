import { addDays, dayNumber, jakartaToday, startOfMonth } from "@/lib/strava/dates";
import type { WalkSession } from "@/lib/strava/types";

export { startOfMonth };

export type CalendarView = "day" | "week" | "month";
export type DateRange = { start: string; end: string };

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function startOfWeek(dateIso: string): string {
  const weekday = new Date(dayNumber(dateIso)).getUTCDay();
  return addDays(dateIso, -((weekday + 6) % 7));
}

export function endOfWeek(dateIso: string): string {
  return addDays(startOfWeek(dateIso), 6);
}

export function endOfMonth(dateIso: string): string {
  const year = Number(dateIso.slice(0, 4));
  const month = Number(dateIso.slice(5, 7));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${dateIso.slice(0, 7)}-${pad(days)}`;
}

export function addMonths(dateIso: string, months: number): string {
  const year = Number(dateIso.slice(0, 4));
  const monthIndex = Number(dateIso.slice(5, 7)) - 1 + months;
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12;
  const daysInTarget = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(Number(dateIso.slice(8, 10)), daysInTarget);
  return `${targetYear}-${pad(targetMonth + 1)}-${pad(day)}`;
}

export function daysInMonth(dateIso: string): number {
  const year = Number(dateIso.slice(0, 4));
  const month = Number(dateIso.slice(5, 7));
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthLabel(dateIso: string): string {
  const month = Number(dateIso.slice(5, 7));
  return `${MONTHS[month - 1]} ${dateIso.slice(0, 4)}`;
}

/** Weeks (Monday-start) covering the anchor month, including edge days. */
export function monthGrid(dateIso: string): string[][] {
  const gridStart = startOfWeek(startOfMonth(dateIso));
  const last = endOfMonth(dateIso);
  const weeks: string[][] = [];
  let cursor = gridStart;

  while (cursor <= last) {
    weeks.push(Array.from({ length: 7 }, (_, index) => addDays(cursor, index)));
    cursor = addDays(cursor, 7);
  }

  return weeks;
}

export function rangeForView(view: CalendarView, dateIso: string): DateRange {
  if (view === "day") return { start: dateIso, end: dateIso };
  if (view === "week") return { start: startOfWeek(dateIso), end: endOfWeek(dateIso) };
  return { start: startOfMonth(dateIso), end: endOfMonth(dateIso) };
}

function shortDate(iso: string): string {
  const month = Number(iso.slice(5, 7));
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(iso.slice(8, 10))} ${months[month - 1] ?? "?"}`;
}

export function rangeLabel(view: CalendarView, range: DateRange): string {
  if (view === "month") return monthLabel(range.start);
  if (view === "week") return `${shortDate(range.start)} – ${shortDate(range.end)}`;
  return shortDate(range.start);
}

export function inRange(walk: WalkSession, range: DateRange): boolean {
  const date = walk.startLocal.slice(0, 10);
  return date >= range.start && date <= range.end;
}

export function filterWalksByRange(walks: WalkSession[], range: DateRange): WalkSession[] {
  return walks
    .filter((walk) => inRange(walk, range))
    .sort((a, b) => (a.startLocal < b.startLocal ? 1 : -1));
}

export function summarizeWalks(walks: WalkSession[]): {
  count: number;
  distanceM: number;
  movingTimeS: number;
  avgPaceSecPerKm: number;
} {
  const distanceM = walks.reduce((sum, walk) => sum + walk.distanceM, 0);
  const movingTimeS = walks.reduce((sum, walk) => sum + walk.movingTimeS, 0);
  return {
    count: walks.length,
    distanceM,
    movingTimeS,
    avgPaceSecPerKm: distanceM > 0 ? movingTimeS / (distanceM / 1000) : 0,
  };
}

export function distanceByDay(walks: WalkSession[]): Record<string, number> {
  return walks.reduce<Record<string, number>>((map, walk) => {
    const date = walk.startLocal.slice(0, 10);
    map[date] = (map[date] ?? 0) + walk.distanceM;
    return map;
  }, {});
}

export function isToday(dateIso: string): boolean {
  return dateIso === jakartaToday();
}
