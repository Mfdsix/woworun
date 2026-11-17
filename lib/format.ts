const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function utcNoon(dateIso: string): Date {
  const year = Number(dateIso.slice(0, 4));
  const month = Number(dateIso.slice(5, 7));
  const day = Number(dateIso.slice(8, 10));
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export function formatKm(meters: number, digits = 1): string {
  const safe = Number.isFinite(meters) ? meters : 0;
  return (safe / 1000).toFixed(digits);
}

export function formatDuration(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.round(totalSeconds) : 0;
  const minutes = Math.floor(safe / 60);

  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${String(rest).padStart(2, "0")}m`;
}

export function formatPace(secPerKm: number): string {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return "\u2014";

  const totalSeconds = Math.round(secPerKm);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}'${String(seconds).padStart(2, "0")}"`;
}

export function formatShortDate(isoLocal: string): string {
  const datePart = isoLocal.slice(0, 10);
  const day = Number(datePart.slice(8, 10));
  const monthIndex = Number(datePart.slice(5, 7)) - 1;
  const monthName = MONTH_SHORT[monthIndex] ?? "";
  return `${String(day).padStart(2, "0")} ${monthName}`.trim();
}

export function formatMonthLabel(dateIso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
  }).format(utcNoon(dateIso));
}

export function formatClock(minutesSinceMidnight: number | null): string {
  if (minutesSinceMidnight === null || !Number.isFinite(minutesSinceMidnight)) {
    return "\u2014";
  }

  const safe = ((Math.round(minutesSinceMidnight) % 1440) + 1440) % 1440;
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatRelativeSync(computedAtIso: string, now: Date = new Date()): string {
  const computedMs = Date.parse(computedAtIso);
  if (!Number.isFinite(computedMs)) return "just now";

  const diffSeconds = Math.max(0, Math.floor((now.getTime() - computedMs) / 1000));
  if (diffSeconds < 60) return "just now";

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return `${Math.floor(diffHours / 24)}d ago`;
}
