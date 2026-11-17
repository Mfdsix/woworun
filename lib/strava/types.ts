export type WalkSession = {
  id: string;
  name: string;
  startLocal: string; // "2026-11-16T16:54:00Z" verbatim from Strava
  distanceM: number;
  movingTimeS: number;
  elapsedTimeS: number;
};

export type RhythmDay = { date: string; active: boolean };

export type DashboardData = {
  month: {
    label: string; // "November"
    distanceM: number;
    movingTimeS: number;
    walkCount: number;
    avgPaceSecPerKm: number; // 0 when no distance
    previous: { distanceM: number; throughDay: number } | null;
  };
  last7: {
    distanceM: number;
    movingTimeS: number;
    walkCount: number;
    avgPaceSecPerKm: number;
    deltaM: number | null; // null when previous window had no walks
  };
  sessions: WalkSession[]; // last 6, newest first
  recent: WalkSession[]; // last 4, newest first
  rhythm: {
    days: RhythmDay[]; // oldest -> newest, exactly 21 entries ending today
    activeDays: number;
    avgGapDays: number | null; // average days between consecutive active dates
    usualStartMinute: number | null; // median minutes since midnight
  };
  streak: { current: number; best: number; todayActive: boolean };
  records: { longestMonthM: number; fiveKStreak: number };
};
