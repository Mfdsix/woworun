const DAY_MS = 86_400_000;
const JAKARTA_TIME_ZONE = "Asia/Jakarta";

function dateParts(dateIso: string): { year: number; month: number; day: number } {
  const year = Number(dateIso.slice(0, 4));
  const month = Number(dateIso.slice(5, 7));
  const day = Number(dateIso.slice(8, 10));
  return { year, month, day };
}

export function jakartaToday(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const formattedParts = formatter.formatToParts(now);
  const year = formattedParts.find((part) => part.type === "year")?.value ?? "1970";
  const month = formattedParts.find((part) => part.type === "month")?.value ?? "01";
  const day = formattedParts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

export function dayNumber(dateIso: string): number {
  const { year, month, day } = dateParts(dateIso);
  return Date.UTC(year, month - 1, day);
}

export function addDays(dateIso: string, days: number): string {
  const shifted = new Date(dayNumber(dateIso) + days * DAY_MS);
  return shifted.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  return Math.round((dayNumber(a) - dayNumber(b)) / DAY_MS);
}

export function monthKey(dateIso: string): string {
  return dateIso.slice(0, 7);
}

export function dayOfMonth(dateIso: string): number {
  return dateParts(dateIso).day;
}

export function startOfMonth(dateIso: string): string {
  return `${monthKey(dateIso)}-01`;
}

export function previousMonthKey(dateIso: string): string {
  const { year, month } = dateParts(dateIso);
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  return `${String(previousYear).padStart(4, "0")}-${String(previousMonth).padStart(2, "0")}`;
}

export function todayDayOfMonth(now: Date = new Date()): number {
  return dayOfMonth(jakartaToday(now));
}
