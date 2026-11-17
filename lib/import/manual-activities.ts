import type { WalkSession } from "../strava/types";

export type ManualParse = {
  walks: WalkSession[];
  items: { walk: WalkSession; points: number }[];
  points: number;
  rejected: number;
  otherSport: number;
  invalid: number;
};

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  mei: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  agu: 7,
  agt: 7,
  sep: 8,
  september: 8,
  oct: 9,
  october: 9,
  okt: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
  des: 11,
};

const DATE_ONLY = /^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/;
const DATE_TIME = /^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4}),?\s+(\d{1,2})[.:](\d{2})$/;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function monthNumber(name: string): number | null {
  const key = name.toLowerCase();
  return key in MONTHS ? MONTHS[key] : null;
}

function isRecordStart(token: string): boolean {
  const match = token.match(DATE_ONLY);
  if (!match) return false;
  return monthNumber(match[2]) !== null;
}

type ParsedDateTime = {
  iso: string;
  date: string;
  time: string;
};

function parseDateTime(token: string): ParsedDateTime | null {
  const match = token.match(DATE_TIME);
  if (!match) return null;

  const day = Number(match[1]);
  const month = monthNumber(match[2]);
  const year = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  if (month === null || day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  const date = `${year}-${pad(month + 1)}-${pad(day)}`;
  const time = `${pad(hour)}:${pad(minute)}`;
  return { iso: `${date}T${time}:00+07:00`, date, time };
}

function diffSeconds(start: string, end: string): number {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
  return Math.round((endMs - startMs) / 1000);
}

function parseDuration(token: string): number | null {
  const cleaned = token
    .toLowerCase()
    .replace(/jam/g, "j")
    .replace(/menit/g, "m")
    .replace(/\s+/g, " ")
    .trim();

  const hours = cleaned.match(/(\d+)\s*j/);
  const minutes = cleaned.match(/(\d+)\s*m/);
  if (!hours && !minutes) return null;

  return (hours ? Number(hours[1]) * 3600 : 0) + (minutes ? Number(minutes[1]) * 60 : 0);
}

function parseDistance(token: string): number | null {
  const hasKm = /km/i.test(token);
  const cleaned = token
    .toLowerCase()
    .replace(/km/g, "")
    .replace(/\s/g, "")
    .replace(",", ".");

  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;

  // Values above 100 are treated as metres; smaller values are kilometres.
  return hasKm || value < 100 ? Math.round(value * 1000) : Math.round(value);
}

function parsePoints(token: string): number {
  const match = token.match(/[+-]?\d+/);
  return match ? Number(match[0]) : 0;
}

function isCountedStatus(token: string): boolean {
  const status = token.toLowerCase();
  return status.includes("terima") || status.includes("accept") || status.includes("count");
}

function isWalking(token: string): boolean {
  const sport = token.toLowerCase();
  return sport.includes("walk") || sport.includes("jalan");
}

/**
 * Parses rows copied from the Individu Bugar activity table.
 *
 * Accepts headers or values only, one field per line or tab-separated.
 * Field order per row:
 * date, start, end, status, title, sport, points, duration, distance, calories.
 */
export function parseManualActivities(text: string): ManualParse {
  const tokens = text
    .split(/[\r\n\t]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  const result: ManualParse = {
    walks: [],
    items: [],
    points: 0,
    rejected: 0,
    otherSport: 0,
    invalid: 0,
  };

  for (let index = 0; index < tokens.length; index += 1) {
    if (!isRecordStart(tokens[index])) continue;

    const record = [tokens[index]];
    let cursor = index + 1;
    while (cursor < tokens.length && !isRecordStart(tokens[cursor]) && record.length < 10) {
      record.push(tokens[cursor]);
      cursor += 1;
    }

    // 9 tokens = no calories column.
    if (record.length < 9) {
      result.invalid += 1;
      index = cursor - 1;
      continue;
    }

    const start = parseDateTime(record[1]);
    const end = parseDateTime(record[2]);
    const duration = parseDuration(record[7]);
    const distance = parseDistance(record[8]);
    const status = record[3];
    const sport = record[5];

    if (!start || !end || distance === null) {
      result.invalid += 1;
      index = cursor - 1;
      continue;
    }

    if (!isCountedStatus(status)) {
      result.rejected += 1;
      index = cursor - 1;
      continue;
    }

    if (!isWalking(sport)) {
      result.otherSport += 1;
      index = cursor - 1;
      continue;
    }

    const elapsed = diffSeconds(start.iso, end.iso);
    const walk: WalkSession = {
      id: `manual-${start.date}-${start.time.replace(":", "")}-${Math.round(distance)}-${elapsed}`,
      name: record[4],
      startLocal: start.iso,
      distanceM: distance,
      movingTimeS: duration ?? elapsed,
      elapsedTimeS: elapsed,
    };
    const points = parsePoints(record[6]);
    result.walks.push(walk);
    result.items.push({ walk, points });
    result.points += points;
    index = cursor - 1;
  }

  return result;
}
