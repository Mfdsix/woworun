"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GpxParseError,
  parseGpx,
  simplifyTrack,
  trackDistanceM,
  withTimes,
} from "@/lib/gpx";
import { parseStored, STORAGE_KEY } from "@/lib/import/activity-store";
import {
  formatDuration,
  formatKm,
  formatPace,
  formatShortDate,
} from "@/lib/format";
import { addDays, jakartaToday } from "@/lib/strava/dates";
import type { DashboardData, WalkSession } from "@/lib/strava/types";
import { CalendarCard } from "./calendar-card";
import { RoutePreview, RouteExplorer, type RoutePoint } from "./route-map";
import { useMediaQuery } from "@/lib/use-media-query";
import { HistoryList, type HistorySort } from "./history-list";
import { BottomNav } from "./bottom-nav";
import {
  addMonths,
  filterWalksByRange,
  type CalendarView,
} from "./calendar-utils";
import { ShareSheet } from "./share-sheet";

const SAMPLE = `16 Nov 2026
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
0 kkal`;

type AddResult = {
  added?: number;
  duplicates?: number;
  rejected?: number;
  otherSport?: number;
  invalid?: number;
  error?: string;
};

type Modal = "add" | "clear" | null;

function todayInJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

function skippedLabel(result: AddResult): string {
  return [
    (result.rejected ?? 0) > 0 ? `${result.rejected} rejected` : "",
    (result.otherSport ?? 0) > 0 ? `${result.otherSport} other sports` : "",
    (result.invalid ?? 0) > 0 ? `${result.invalid} invalid` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function HomeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M10 21v-6h4v6" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 15V3" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 12v7h14v-7" />
    </svg>
  );
}

function RouteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.66 8.7l-8.58 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="wl-stat">
      <span className="wl-stat-label">{label}</span>
      <span className={`wl-stat-value${accent ? " is-accent" : ""}`}>{value}</span>
    </div>
  );
}

function paceSecPerKm(walk: WalkSession): number {
  return walk.movingTimeS / (walk.distanceM / 1000);
}

function Last7Chart({ walks }: { walks: WalkSession[] }) {
  const today = jakartaToday();
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = addDays(today, -i);
    const dayWalks = walks.filter((walk) => walk.startLocal.slice(0, 10) === date);
    const meters = dayWalks.reduce((sum, walk) => sum + walk.distanceM, 0);
    const weekday = new Date(
      Number(date.slice(0, 4)),
      Number(date.slice(5, 7)) - 1,
      Number(date.slice(8, 10)),
    ).getDay();
    days.push({
      date,
      meters,
      label: "SMTWTFS"[weekday],
      isToday: i === 0,
    });
  }

  const max = days.reduce((top, day) => Math.max(top, day.meters), 0) || 1;
  const walked = days.filter((day) => day.meters > 0);
  const avg = walked.length
    ? walked.reduce((sum, day) => sum + day.meters, 0) / walked.length
    : 0;
  const avgPct = Math.min(82, Math.max(12, Math.round((avg / max) * 76)));

  return (
    <div className="wl-chart">
      <div className="wl-chart-head">
        <span className="wl-kicker">Last 7 days</span>
        <span className="wl-chart-avg">
          {walked.length}/7 active{avg > 0 ? ` · avg ${formatKm(avg)} km` : ""}
        </span>
      </div>
      <div className="wl-chart-body">
        {walked.length === 0 ? (
          <p className="wl-chart-empty">No walks in the last 7 days.</p>
        ) : (
          <>
            <div className="wl-avg-line" style={{ bottom: `${avgPct}%` }} />
            <div className="wl-bars" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
              {days.map((day) => {
                const height = day.meters > 0 ? Math.max(10, Math.round((day.meters / max) * 80)) : 4;
                const latest = day.meters > 0;
                return (
                  <div className="wl-bar-col" key={day.date}>
                    <span className={`wl-bar-value${latest ? " is-latest" : ""}`}>
                      {day.meters > 0 ? formatKm(day.meters) : ""}
                    </span>
                    <div className="wl-bar-track">
                      <div
                        className={`wl-bar${latest ? " is-latest" : ""}${day.meters === 0 ? " is-empty" : ""}`}
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <span className={`wl-bar-date${day.isToday ? " is-today" : ""}`}>{day.label}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function ManualClient({
  userId,
  data,
  walks,
  walkCount,
  points,
  pointsByWalk,
}: {
  userId: string;
  data: DashboardData | null;
  walks: WalkSession[];
  walkCount: number;
  points: number;
  pointsByWalk: Record<string, number>;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<Modal>(null);
  const [tab, setTab] = useState<"quick" | "paste">("quick");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [calView, setCalView] = useState<CalendarView>("month");
  const [anchorDate, setAnchorDate] = useState(() => jakartaToday());
  const [sortBy, setSortBy] = useState<"recent" | "distance" | "duration" | "pace">("recent");
  const [quick, setQuick] = useState({
    title: "",
    km: "",
    mins: "",
    date: todayInJakarta(),
    time: "17:00",
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const routeFileRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const [routes, setRoutes] = useState<Record<string, RoutePoint[] | null>>({});
  const routesRef = useRef(routes);
  routesRef.current = routes;
  const [routeBusy, setRouteBusy] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [overlayHistory, setOverlayHistory] = useState(false);
  const isMobile = useMediaQuery("(max-width: 599px)");

  useEffect(() => {
    let cancelled = false;

    async function migrateBrowserData() {
      const keys = [`${STORAGE_KEY}:${userId}`, STORAGE_KEY];

      for (const key of keys) {
        let raw: string | null = null;
        try {
          raw = window.localStorage.getItem(key);
        } catch {
          continue;
        }
        if (!raw) continue;

        const items = parseStored(raw);
        if (items.length === 0) {
          try {
            window.localStorage.removeItem(key);
          } catch {
            // ignore
          }
          continue;
        }

        try {
          const response = await fetch("/api/manual-activities/import", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              items: items.map(({ walk, points }) => ({ walk, points })),
            }),
          });
          if (!response.ok) continue;

          const result = (await response.json()) as AddResult;
          window.localStorage.removeItem(key);
          if (cancelled) return;

          if ((result.added ?? 0) > 0) {
            setToast(
              `${result.added} browser entr${result.added === 1 ? "y" : "ies"} imported to your PIN account.`,
            );
            router.refresh();
          }
        } catch {
          // Offline: keep the key and retry next time.
        }
      }
    }

    void migrateBrowserData();
    return () => {
      cancelled = true;
    };
  }, [router, userId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (selectedDate && !walks.some((walk) => walk.startLocal.slice(0, 10) === selectedDate)) {
      // keep the selection even if the day has no walk — history shows the empty state
    }
  }, [walks, selectedDate]);

  useEffect(() => {
    if (!modal) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", onKey);
    const timer = window.setTimeout(() => {
      if (modal === "add") {
        if (tab === "paste") textareaRef.current?.focus();
        else titleRef.current?.focus();
      }
    }, 40);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    };
  }, [modal, tab]);

  async function fetchRoute(activityId: string): Promise<RoutePoint[] | null> {
    const cached = routesRef.current[activityId];
    if (cached !== undefined) return cached;

    try {
      const response = await fetch(`/api/manual-activities/${activityId}/route`);
      if (response.status === 404) {
        setRoutes((current) => ({ ...current, [activityId]: null }));
        return null;
      }
      if (!response.ok) return null;
      const payload = (await response.json()) as { points?: unknown };
      const points = payload.points;
      if (
        !Array.isArray(points) ||
        points.length < 2 ||
        !Array.isArray(points[0]) ||
        typeof points[0][0] !== "number"
      ) {
        setRoutes((current) => ({ ...current, [activityId]: null }));
        return null;
      }
      const route = points as RoutePoint[];
      setRoutes((current) => ({ ...current, [activityId]: route }));
      return route;
    } catch {
      return null;
    }
  }

  async function attachGpx(
    activityId: string,
    file: File,
    fallbackSeconds: number,
  ): Promise<void> {
    if (routeBusy) return;
    setRouteBusy(true);
    try {
      const parsed = parseGpx(await file.text());
      const points = withTimes(simplifyTrack(parsed, 900, 3), Math.max(60, fallbackSeconds));
      const distance = trackDistanceM(points);
      if (distance < 50) {
        setToast("The GPX track is too short to draw.");
        return;
      }

      const response = await fetch(`/api/manual-activities/${activityId}/route`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ points }),
      });
      if (!response.ok) {
        setToast("Could not save the route. Try again.");
        return;
      }
      setRoutes((current) => ({ ...current, [activityId]: points }));
      setToast("Route attached to this walk.");
    } catch (error) {
      if (error instanceof GpxParseError) {
        setToast(error.message);
        return;
      }
      setToast("Network error. Try again.");
    } finally {
      setRouteBusy(false);
      if (routeFileRef.current) routeFileRef.current.value = "";
    }
  }

  async function detachRoute(activityId: string): Promise<void> {
    if (routeBusy) return;
    setRouteBusy(true);
    try {
      const response = await fetch(`/api/manual-activities/${activityId}/route`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setToast("Could not remove the route.");
        return;
      }
      setRoutes((current) => ({ ...current, [activityId]: null }));
      setToast("Route removed.");
    } catch {
      setToast("Network error. Try again.");
    } finally {
      setRouteBusy(false);
    }
  }

  function openAdd(options?: { tab?: "quick" | "paste"; date?: string }) {
    const date = options?.date;
    setTab(options?.tab ?? "quick");
    if (date) {
      setQuick((current) => ({ ...current, date }));
    }
    setError(null);
    setModal("add");
  }

  function toggleDate(date: string) {
    setSelectedDate((current) => (current === date ? null : date));
  }

  function handleToday() {
    setAnchorDate(jakartaToday());
    setSelectedDate(null);
  }

  function handleMonthNav(delta: number) {
    if (calView === "day") {
      setAnchorDate(addDays(anchorDate, delta));
      return;
    }
    if (calView === "week") {
      setAnchorDate(addDays(anchorDate, delta * 7));
      return;
    }
    setAnchorDate(addMonths(anchorDate, delta));
  }

  async function postJson(url: string, body: unknown) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as AddResult | null;
    return { response, payload };
  }

  function finishAdd(payload: AddResult | null) {
    if (!payload || (payload.added ?? 0) === 0) {
      setError(
        (payload?.duplicates ?? 0) > 0
          ? `Already saved — ${payload?.duplicates} duplicate${
              payload?.duplicates === 1 ? "" : "s"
            } skipped.`
          : "No walking rows found. Check the field order and try again.",
      );
      return;
    }

    setModal(null);
    setError(null);
    const skipped = skippedLabel(payload);
    setToast(
      `${payload.added} walk${payload.added === 1 ? "" : "s"} added${
        (payload.duplicates ?? 0) > 0 ? ` · ${payload.duplicates} duplicates skipped` : ""
      }${skipped ? ` · ${skipped}` : ""}.`,
    );
    router.refresh();
  }

  async function addPaste() {
    if (!text.trim()) {
      setError("Paste a few rows first.");
      return;
    }

    if (/<\?xml|<gpx[\s>]|<trkpt|<TrainingCenterDatabase|<Trackpoint/i.test(text)) {
      setError(
        "This looks like a GPX/TCX file, not table rows. Open the walk detail and use Attach GPX route instead.",
      );
      return;
    }

    setBusy(true);
    try {
      const { response, payload } = await postJson("/api/manual-activities", { text });
      if (!response.ok) {
        setError(payload?.error ?? "Could not save activities.");
        return;
      }
      finishAdd(payload);
      setText("");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function addQuick() {
    const title = quick.title.trim();
    const km = Number(quick.km);
    const mins = Number(quick.mins);

    if (!title || !quick.date || !quick.time || !Number.isFinite(km) || km <= 0) {
      setError("Fill the title, date, time, and a positive distance.");
      return;
    }
    if (!Number.isFinite(mins) || mins <= 0) {
      setError("Duration must be a positive number of minutes.");
      return;
    }

    const startLocal = `${quick.date}T${quick.time}:00+07:00`;
    const distanceM = Math.round(km * 1000);
    const seconds = Math.round(mins * 60);

    setBusy(true);
    try {
      const { response, payload } = await postJson("/api/manual-activities/import", {
        items: [
          {
            walk: {
              id: `quick-${Date.now()}`,
              name: title,
              startLocal,
              distanceM,
              movingTimeS: seconds,
              elapsedTimeS: seconds,
            },
            points: Math.max(1, Math.round(km / 2)),
          },
        ],
      });
      if (!response.ok) {
        setError(payload?.error ?? "Could not save the walk.");
        return;
      }
      finishAdd(payload);
      setQuick((current) => ({ ...current, title: "", km: "", mins: "" }));
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    if (!window.confirm("Delete all manual activities from your PIN account?")) return;

    setBusy(true);
    try {
      const response = await fetch("/api/manual-activities", { method: "DELETE" });
      if (!response.ok) {
        setError("Could not clear activities.");
        return;
      }
      setModal(null);
      setToast("All activities cleared.");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function loadSample() {
    setBusy(true);
    try {
      const { response, payload } = await postJson("/api/manual-activities", { text: SAMPLE });
      if (!response.ok) {
        setError(payload?.error ?? "Could not load the sample.");
        return;
      }
      if ((payload?.added ?? 0) === 0) {
        setToast("Sample already saved.");
        setModal(null);
        return;
      }
      setModal(null);
      setToast(`${payload?.added} sample walks added.`);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const month = data?.month ?? null;
  const historyWalks = useMemo(() => {
    const base = selectedDate
      ? filterWalksByRange(walks, { start: selectedDate, end: selectedDate })
      : filterWalksByRange(walks, { start: "0000-01-01", end: "9999-12-31" });

    if (selectedDate) return base;

    const sorted = [...base];
    if (sortBy === "distance") sorted.sort((a, b) => b.distanceM - a.distanceM);
    else if (sortBy === "duration") sorted.sort((a, b) => b.movingTimeS - a.movingTimeS);
    else if (sortBy === "pace") sorted.sort((a, b) => paceSecPerKm(a) - paceSecPerKm(b));
    return sorted;
  }, [walks, selectedDate, sortBy]);
  const avgWalk = month && month.walkCount > 0 ? month.distanceM / month.walkCount : 0;
  const longest = data?.records.longestMonthM ?? 0;
  const avgBarWidth = longest > 0 ? Math.min(100, Math.max(12, (avgWalk / longest) * 100)) : 0;
  const streak = data?.records.fiveKStreak ?? 0;
  const selected = useMemo(() => {
    if (!selectedDate) return null;
    const dayWalks = walks.filter((walk) => walk.startLocal.slice(0, 10) === selectedDate);
    if (dayWalks.length === 0) return null;
    return dayWalks.reduce((latest, walk) => (walk.startLocal > latest.startLocal ? walk : latest));
  }, [walks, selectedDate]);
  const selectedPoints = selected ? (pointsByWalk[selected.id] ?? 0) : 0;
  const selectedDelta = selected ? selected.distanceM - avgWalk : 0;
  const selectedRoute = selected ? (routes[selected.id] ?? null) : null;

  // Swipe navigation between activities (mobile home).
  const navWalks = useMemo(
    () => [...walks].sort((a, b) => (a.startLocal < b.startLocal ? 1 : -1)),
    [walks],
  );
  const navIndex = selected ? navWalks.findIndex((w) => w.id === selected.id) : -1;
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragMode = useRef<"idle" | "horizontal" | "vertical">("idle");
  const suppressClickRef = useRef(false);

  function handleSwipeNavigate(dir: 1 | -1) {
    const nextIndex = navIndex + dir;
    if (nextIndex < -1 || nextIndex >= navWalks.length) return; // boundary
    if (nextIndex === -1) {
      setSelectedDate(null); // back to month overview
      return;
    }
    setSelectedDate(navWalks[nextIndex].startLocal.slice(0, 10));
  }

  function onCardPointerDown(event: React.PointerEvent) {
    if (!isMobile) return;
    dragStart.current = { x: event.clientX, y: event.clientY };
    dragMode.current = "idle";
    setDragging(true);
  }

  function onCardPointerMove(event: React.PointerEvent) {
    if (!dragging) return;
    const dx = event.clientX - dragStart.current.x;
    const dy = event.clientY - dragStart.current.y;
    if (dragMode.current === "idle") {
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      dragMode.current = Math.abs(dx) > Math.abs(dy) * 1.2 ? "horizontal" : "vertical";
      if (dragMode.current === "vertical") {
        setDragging(false);
        return;
      }
    }
    if (dragMode.current !== "horizontal") return;
    const dir = dx < 0 ? 1 : -1;
    const candidate = navIndex + dir;
    const inRange = candidate >= -1 && candidate < navWalks.length;
    suppressClickRef.current = true;
    // Boundary resistance: past the ends the card only moves a quarter.
    setDragX(inRange ? dx : dx * 0.22);
  }

  function onCardPointerUp() {
    if (!dragging) return;
    setDragging(false);
    if (dragMode.current === "horizontal" && Math.abs(dragX) > 64) {
      handleSwipeNavigate(dragX < 0 ? 1 : -1);
    }
    setDragX(0);
    dragMode.current = "idle";
  }

  function onCardPointerCancel() {
    setDragging(false);
    setDragX(0);
    dragMode.current = "idle";
  }

  useEffect(() => {
    const id = selected?.id;
    if (!id) return;
    void fetchRoute(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  // The inline map lives in the right column — close it when the day changes.
  useEffect(() => {
    setExplorerOpen(false);
  }, [selectedDate]);

  return (
    <div className="wl-shell">
      {!data || !month ? (
        <section className="wl-empty">
          <span className="wl-kicker">No activities yet</span>
          <h2 className="wl-empty-title">Add your first walk</h2>
          <p className="wl-empty-copy">
            Quick add one walk, or paste rows from the activity table. Entries are saved to your
            PIN account and follow you across devices.
          </p>
          <div className="wl-actions">
            <button className="wl-btn wl-btn-accent" type="button" onClick={() => openAdd({ tab: "quick" })}>
              + Add Walk
            </button>
            <button className="wl-btn wl-btn-ghost" type="button" onClick={() => openAdd({ tab: "paste" })}>
              Paste rows
            </button>
          </div>
        </section>
      ) : (
        <main className="wl-main">
          <section
            className={`wl-hero${dragging && Math.abs(dragX) > 4 ? " is-swiping" : ""}`}
            ref={heroRef}
            style={isMobile ? { transform: `translateX(${dragX}px)` } : undefined}
            onPointerDown={onCardPointerDown}
            onPointerMove={onCardPointerMove}
            onPointerUp={onCardPointerUp}
            onPointerCancel={onCardPointerCancel}
            onClickCapture={(event) => {
              if (suppressClickRef.current) {
                event.stopPropagation();
                event.preventDefault();
                suppressClickRef.current = false;
              }
            }}
          >
            <div className="wl-accent-line" />

            {selected ? (
              <>
                <div className="wl-row">
                  <div className="wl-row-left">
                    <span className="wl-kicker">Activity detail</span>
                    <span className="wl-badge">{formatShortDate(selected.startLocal)}</span>
                    {isMobile && navWalks.length > 0 && (
                      <span className="wl-nav-count">
                        {navIndex + 1} / {navWalks.length}
                      </span>
                    )}
                  </div>
                  <div className="wl-actions">
                    <button
                      className={`wl-home${selectedRoute ? " is-active" : ""}`}
                      type="button"
                      aria-label="Attach GPX route"
                      title="Attach GPX route"
                      disabled={routeBusy}
                      onClick={() => routeFileRef.current?.click()}
                    >
                      <RouteIcon />
                    </button>
                    <input
                      ref={routeFileRef}
                      className="share-file"
                      type="file"
                      accept=".gpx,application/gpx+xml,text/xml"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file && selected) {
                          void attachGpx(selected.id, file, selected.movingTimeS);
                        }
                      }}
                    />
                    <button
                      className="wl-home"
                      type="button"
                      aria-label="Share image"
                      onClick={() => setShareOpen(true)}
                    >
                      <ShareIcon />
                    </button>
                    <button
                      className="wl-home"
                      type="button"
                      aria-label="Back to month overview"
                      title="Back to month overview"
                      onClick={() => setSelectedDate(null)}
                    >
                      <HomeIcon />
                    </button>
                  </div>
                </div>

                <div className="wl-detail-main">
                  <h2 className="wl-detail-title">{selected.name}</h2>
                  <p className="wl-detail-meta">
                    {formatShortDate(selected.startLocal)} · {selected.startLocal.slice(11, 16)}
                  </p>

                  <div className="wl-hero-line">
                    <span className="wl-hero-number">{formatKm(selected.distanceM)}</span>
                    <span className="wl-unit">km</span>
                  </div>

                  <div className="wl-stats">
                    <StatCard label="Duration" value={formatDuration(selected.movingTimeS)} />
                    <StatCard
                      label="Pace"
                      value={`${formatPace(selected.movingTimeS / (selected.distanceM / 1000))}/km`}
                      accent
                    />
                    <StatCard label="Start" value={selected.startLocal.slice(11, 16)} />
                  </div>

                  <div className="wl-substats">
                    <div className="wl-substat">
                      <span className="wl-stat-label">vs avg / walk</span>
                      <span className="wl-substat-value">
                        {selectedDelta >= 0 ? "+" : "-"}
                        {formatKm(Math.abs(selectedDelta))} km
                      </span>
                    </div>
                    <div className="wl-substat is-peak">
                      <span className="wl-stat-label">Points</span>
                      <span className="wl-peak-value">+{selectedPoints} pts</span>
                    </div>
                  </div>

                  {selectedRoute && (
                    <div className="wl-route-block">
                      <RoutePreview
                        points={selectedRoute}
                        onExpand={() => setExplorerOpen(true)}
                      />
                      <div className="wl-actions">
                        <button
                          className="wl-btn wl-btn-ghost"
                          type="button"
                          disabled={routeBusy}
                          onClick={() => selected && detachRoute(selected.id)}
                        >
                          Remove route
                        </button>
                      </div>
                    </div>
                  )}

                  <p className="wl-detail-hint">
                    {selectedRoute
                      ? "Route attached · tap the map to open the interactive explorer."
                      : "Tap the paperclip icon to attach a GPX route for this walk."}
                  </p>
                </div>
              </>
            ) : selectedDate ? (
              <div className="wl-detail-main">
                <div className="wl-row">
                  <div className="wl-row-left">
                    <span className="wl-kicker">No walk logged</span>
                    <span className="wl-badge">
                      {formatShortDate(selectedDate)}
                    </span>
                  </div>
                  <div className="wl-actions">
                    <button
                      className="wl-home"
                      type="button"
                      aria-label="Back to month overview"
                      title="Back to month overview"
                      onClick={() => setSelectedDate(null)}
                    >
                      <HomeIcon />
                    </button>
                  </div>
                </div>

                <div className="wl-hero-line">
                  <span className="wl-hero-number">0.0</span>
                  <span className="wl-unit">km</span>
                </div>

                <p className="wl-detail-meta">
                  {formatShortDate(selectedDate ?? jakartaToday())} · rest day
                </p>

                <div className="wl-actions">
                  <button
                    className="wl-btn wl-btn-accent"
                    type="button"
                    onClick={() => openAdd({ date: selectedDate ?? undefined })}
                  >
                    + Log this day
                  </button>
                  <button
                    className="wl-btn wl-btn-ghost"
                    type="button"
                    onClick={() => setSelectedDate(null)}
                  >
                    Back to month overview
                  </button>
                </div>

                <p className="wl-detail-hint">
                  No walk recorded on this date. Log one, or pick a day with a walk.
                </p>
              </div>
            ) : (
              <div className="wl-detail-main">
                <div className="wl-row">
                  <div className="wl-row-left">
                    <span className="wl-kicker">{month.label}</span>
                    <span className="wl-badge">Active month</span>
                  </div>
                  <div className="wl-actions">
                    <button
                      className="wl-home"
                      type="button"
                      aria-label="Share image"
                      onClick={() => setShareOpen(true)}
                    >
                      <ShareIcon />
                    </button>
                    <span className="wl-summary wl-summary-compact">
                      {walkCount} walks · {points} pts
                    </span>
                  </div>
                </div>

                <div className="wl-hero-line">
                  <span className="wl-hero-number">{formatKm(month.distanceM)}</span>
                  <span className="wl-unit">km</span>
                </div>

                <div className="wl-stats">
                  <StatCard label="Walks" value={String(month.walkCount)} />
                  <StatCard label="Duration" value={formatDuration(month.movingTimeS)} />
                  <StatCard
                    label="Avg pace"
                    value={`${formatPace(month.avgPaceSecPerKm)}/km`}
                    accent
                  />
                </div>

                <div className="wl-substats">
                  <div className="wl-substat">
                    <div className="wl-row">
                      <span className="wl-stat-label">Avg / walk</span>
                      <span className="wl-substat-value">{formatKm(avgWalk)} km</span>
                    </div>
                    <div className="wl-avg-track">
                      <span style={{ width: `${avgBarWidth}%` }} />
                    </div>
                  </div>
                  <div className="wl-substat is-peak">
                    <span className="wl-stat-label">Peak</span>
                    <span className="wl-peak-value">{formatKm(longest)} km</span>
                  </div>
                </div>

                <Last7Chart walks={walks} />

                <p className="wl-detail-hint">
                  Pick a day in the calendar or a row in history to see its detail.
                </p>
              </div>
            )}
          </section>

          {!isMobile && explorerOpen && selected && selectedRoute ? (
            <div className="wl-side wl-side-explorer">
              <RouteExplorer
                variant="inline"
                points={selectedRoute}
                walk={selected}
                onClose={() => setExplorerOpen(false)}
              />
            </div>
          ) : !isMobile ? (
          <div className="wl-side">
            <CalendarCard
              walks={walks}
              view={calView}
              anchorDate={anchorDate}
              selectedDate={selectedDate}
              streak={data.records.fiveKStreak}
              onSelectDate={toggleDate}
              onViewChange={setCalView}
              onMonthNav={handleMonthNav}
              onToday={handleToday}
              onAddForDate={(date) => openAdd({ date })}
            />

            <section className="wl-card wl-history">
              <HistoryList
                walks={historyWalks}
                selectedDate={selectedDate}
                walkCount={walkCount}
                sortBy={sortBy}
                onSort={(key) => {
                  setSortBy(key);
                  setSelectedDate(null);
                }}
                onToggleDate={toggleDate}
                onShowAll={() => setSelectedDate(null)}
              />
            </section>
          </div>
          ) : null}
        </main>
      )}

      <BottomNav
        open={menuOpen}
        walkCount={walkCount}
        points={points}
        compact={!isMobile}
        onToggle={() => setMenuOpen((current) => !current)}
        onHome={() => {
          setMenuOpen(false);
          setExplorerOpen(false);
          setSelectedDate(null);
        }}
        onCalendar={() => {
          setMenuOpen(false);
          setExplorerOpen(false);
          setOverlayHistory(false);
          setCalendarOpen(true);
        }}
        onAdd={() => {
          setMenuOpen(false);
          openAdd({ tab: "quick" });
        }}
        onClear={() => {
          setMenuOpen(false);
          setModal("clear");
        }}
        onClose={() => setMenuOpen(false)}
      />

      {isMobile && calendarOpen && (
        <div className="mobile-calendar">
          <div className="mobile-overlay-head">
            {overlayHistory && (
              <button
                className="wl-home"
                type="button"
                aria-label="Back to calendar"
                onClick={() => {
                  setSelectedDate(null);
                  setOverlayHistory(false);
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            )}
            <span className="wl-kicker">{overlayHistory ? "History" : "Calendar"}</span>
            <button
              className="wl-home"
              type="button"
              aria-label="Close"
              onClick={() => {
                setCalendarOpen(false);
                setOverlayHistory(false);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {overlayHistory && selectedDate ? (
            historyWalks.length > 0 ? (
              <section className="wl-card wl-history mobile-history">
                <HistoryList
                  walks={historyWalks}
                  selectedDate={selectedDate}
                  walkCount={walkCount}
                  sortBy={sortBy}
                  onSort={setSortBy}
                  onToggleDate={toggleDate}
                  onShowAll={() => {
                    setSelectedDate(null);
                    setOverlayHistory(false);
                  }}
                  onRowSelect={() => {
                    setCalendarOpen(false);
                    setOverlayHistory(false);
                  }}
                />
              </section>
            ) : (
              <section className="wl-card mobile-history-empty">
                <p className="wl-empty-note">
                  No walk logged on {formatShortDate(selectedDate)}.
                </p>
                <div className="wl-actions">
                  <button
                    className="wl-btn wl-btn-accent"
                    type="button"
                    onClick={() => {
                      setCalendarOpen(false);
                      setOverlayHistory(false);
                      openAdd({ date: selectedDate });
                    }}
                  >
                    + Log this day
                  </button>
                  <button
                    className="wl-btn wl-btn-ghost"
                    type="button"
                    onClick={() => {
                      setSelectedDate(null);
                      setOverlayHistory(false);
                    }}
                  >
                    Back to calendar
                  </button>
                </div>
              </section>
            )
          ) : (
            <CalendarCard
              walks={walks}
              view={calView}
              anchorDate={anchorDate}
              selectedDate={selectedDate}
              streak={data?.records.fiveKStreak ?? 0}
              onSelectDate={(date) => {
                const wasSelected = selectedDate === date;
                toggleDate(date);
                setOverlayHistory(!wasSelected);
              }}
              onViewChange={setCalView}
              onMonthNav={handleMonthNav}
              onToday={handleToday}
              onAddForDate={(date) => openAdd({ date })}
            />
          )}
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      {shareOpen && data && (
        <ShareSheet
          data={data}
          selectedWalk={selected}
          selectedPoints={selectedPoints}
          route={selectedRoute}
          onClose={() => setShareOpen(false)}
        />
      )}

      {explorerOpen && selected && selectedRoute && (
        <RouteExplorer
          points={selectedRoute}
          walk={selected}
          onClose={() => setExplorerOpen(false)}
        />
      )}

      {modal === "add" && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModal(null);
          }}
        >
          <div className="modal wl-modal" role="dialog" aria-modal="true" aria-labelledby="add-title">
            <div className="modal-head">
              <div>
                <p className="wl-kicker">Add activity</p>
                <h2 className="heading" id="add-title">
                  Add Walk
                </h2>
              </div>
              <button className="wl-btn wl-btn-ghost" type="button" onClick={() => setModal(null)}>
                Close
              </button>
            </div>

            <div className="wl-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "quick"}
                className={tab === "quick" ? "is-active" : ""}
                onClick={() => {
                  setTab("quick");
                  setError(null);
                }}
              >
                Quick add
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "paste"}
                className={tab === "paste" ? "is-active" : ""}
                onClick={() => {
                  setTab("paste");
                  setError(null);
                }}
              >
                Paste rows
              </button>
            </div>

            {tab === "quick" ? (
              <div className="wl-form">
                <label className="wl-field wl-field-wide">
                  <span>Activity title</span>
                  <input
                    ref={titleRef}
                    className="wl-input"
                    value={quick.title}
                    onChange={(event) =>
                      setQuick((current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="e.g. Evening 6k"
                  />
                </label>
                <div className="wl-form-grid">
                  <label className="wl-field">
                    <span>Date</span>
                    <input
                      className="wl-input"
                      type="date"
                      value={quick.date}
                      onChange={(event) =>
                        setQuick((current) => ({ ...current, date: event.target.value }))
                      }
                    />
                  </label>
                  <label className="wl-field">
                    <span>Start</span>
                    <input
                      className="wl-input"
                      type="time"
                      value={quick.time}
                      onChange={(event) =>
                        setQuick((current) => ({ ...current, time: event.target.value }))
                      }
                    />
                  </label>
                  <label className="wl-field">
                    <span>Distance (km)</span>
                    <input
                      className="wl-input"
                      type="number"
                      min="0.1"
                      max="200"
                      step="0.1"
                      value={quick.km}
                      onChange={(event) =>
                        setQuick((current) => ({ ...current, km: event.target.value }))
                      }
                      placeholder="5.4"
                    />
                  </label>
                  <label className="wl-field">
                    <span>Duration (min)</span>
                    <input
                      className="wl-input"
                      type="number"
                      min="1"
                      max="1440"
                      value={quick.mins}
                      onChange={(event) =>
                        setQuick((current) => ({ ...current, mins: event.target.value }))
                      }
                      placeholder="62"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                className="paste-input"
                value={text}
                onChange={(event) => setText(event.target.value)}
                spellCheck={false}
                aria-label="Activity rows"
                placeholder={`16 Nov 2026\n16 Nov 2026, 16.54\n16 Nov 2026, 18.16\nDiterima\nEasy 6k\nWalking\n+3\n1j 21m\n7,07 km\n0 kkal`}
              />
            )}

            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}

            <div className="modal-actions">
              <button
                className="wl-btn wl-btn-accent"
                type="button"
                onClick={tab === "quick" ? addQuick : addPaste}
                disabled={busy}
              >
                {busy ? "Saving…" : "Save Walk"}
              </button>
              {tab === "paste" ? (
                <button
                  className="wl-btn wl-btn-ghost"
                  type="button"
                  onClick={() => setText(SAMPLE)}
                  disabled={busy}
                >
                  Load sample
                </button>
              ) : null}
              <button
                className="wl-btn wl-btn-ghost"
                type="button"
                onClick={() => setModal(null)}
                disabled={busy}
              >
                Cancel
              </button>
            </div>

            <p className="hint">
              {tab === "quick"
                ? "Saved as Walking at +07:00. Points follow the same rule as the sample (1 point per 2 km, minimum 1)."
                : "Order: date, start, end, status, activity, sport, points, duration, distance, calories. Headers and calories are optional."}
            </p>
          </div>
        </div>
      )}

      {modal === "clear" && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModal(null);
          }}
        >
          <div className="modal wl-modal wl-modal-sm" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <p className="wl-kicker">Danger zone</p>
                <h2 className="heading">Clear or restore</h2>
              </div>
            </div>
            <p className="sub">
              Clear all manual walks from your PIN account, or load the November sample again.
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button className="btn btn-danger" type="button" onClick={clearAll} disabled={busy}>
                {busy ? "Working…" : "Clear all"}
              </button>
              <button className="wl-btn wl-btn-ghost" type="button" onClick={loadSample} disabled={busy}>
                Load sample
              </button>
              <button className="wl-btn wl-btn-ghost" type="button" onClick={() => setModal(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
