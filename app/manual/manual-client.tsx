"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseStored, STORAGE_KEY } from "@/lib/import/activity-store";
import {
  formatDuration,
  formatKm,
  formatPace,
  formatShortDate,
} from "@/lib/format";
import type { DashboardData } from "@/lib/strava/types";

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

function deltaLabel(deltaM: number | null): string {
  if (deltaM === null) return "no previous 7 days";
  const sign = deltaM < 0 ? "-" : "+";
  return `${sign}${formatKm(Math.abs(deltaM))} km vs previous 7 days`;
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

function BrandMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="13" cy="4" r="1.5" fill="currentColor" />
      <path d="M7 21l3-6 2.5 2 3.5-5" />
      <path d="M6 12l3-3 4 1 3 3" />
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

function Chart({ data }: { data: DashboardData }) {
  const chart = data.sessions.slice(0, 6).reverse();
  const max = chart.reduce((top, walk) => Math.max(top, walk.distanceM), 0) || 1;
  const avg = chart.length
    ? chart.reduce((sum, walk) => sum + walk.distanceM, 0) / chart.length
    : 0;
  const avgPct = Math.min(82, Math.max(22, Math.round((avg / max) * 76)));

  return (
    <div className="wl-chart">
      <div className="wl-chart-head">
        <span className="wl-kicker">LAST 6 WALKS</span>
        <span className="wl-chart-avg">avg {formatKm(avg)} km</span>
      </div>
      <div className="wl-chart-body">
        {chart.length === 0 ? (
          <p className="wl-chart-empty">No walks yet.</p>
        ) : (
          <>
            <div className="wl-avg-line" style={{ bottom: `${avgPct}%` }} />
            <div
              className="wl-bars"
              style={{ gridTemplateColumns: `repeat(${chart.length}, minmax(0, 1fr))` }}
            >
              {chart.map((walk, index) => {
                const height = Math.max(20, Math.round((walk.distanceM / max) * 80));
                const latest = index === chart.length - 1;
                return (
                  <div className="wl-bar-col" key={walk.id}>
                    <span className={`wl-bar-value${latest ? " is-latest" : ""}`}>
                      {formatKm(walk.distanceM)}
                    </span>
                    <div className="wl-bar-track">
                      <div
                        className={`wl-bar${latest ? " is-latest" : ""}`}
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <span className="wl-bar-date">{formatShortDate(walk.startLocal)}</span>
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
  walkCount,
  points,
}: {
  userId: string;
  data: DashboardData | null;
  walkCount: number;
  points: number;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<Modal>(null);
  const [tab, setTab] = useState<"quick" | "paste">("quick");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [quick, setQuick] = useState({
    title: "",
    km: "",
    mins: "",
    date: todayInJakarta(),
    time: "17:00",
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

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

  function openAdd(nextTab: "quick" | "paste" = "quick") {
    setTab(nextTab);
    setError(null);
    setModal("add");
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
  const last7 = data?.last7 ?? null;
  const avgWalk = month && month.walkCount > 0 ? month.distanceM / month.walkCount : 0;
  const longest = data?.records.longestMonthM ?? 0;
  const avgBarWidth = longest > 0 ? Math.min(100, Math.max(12, (avgWalk / longest) * 100)) : 0;
  const streak = data?.records.fiveKStreak ?? 0;

  return (
    <div className="wl-shell">
      <header className="wl-topbar">
        <div className="wl-brand">
          <span className="wl-mark">
            <BrandMark />
          </span>
          <div className="wl-title">
            <span className="wl-kicker">Walk Log</span>
            <h1 className="wl-heading">Local activities</h1>
          </div>
        </div>

        <div className="wl-actions">
          <span className="wl-summary">
            {walkCount} walks · {points} pts
          </span>
          <span className="wl-synced">
            <span className="wl-dot" />
            PIN synced
          </span>
          <button className="wl-btn wl-btn-accent" type="button" onClick={() => openAdd("quick")}>
            <span aria-hidden="true">+</span> Add Walk
          </button>
          <form action="/api/auth/logout" method="post">
            <button className="wl-btn wl-btn-ghost" type="submit">
              Lock
            </button>
          </form>
        </div>
      </header>

      {!data || !month || !last7 ? (
        <section className="wl-empty">
          <span className="wl-kicker">NO ACTIVITIES YET</span>
          <h2 className="wl-empty-title">Add your first walk</h2>
          <p className="wl-empty-copy">
            Quick add one walk, or paste rows from the activity table. Entries are saved to your
            PIN account and follow you across devices.
          </p>
          <div className="wl-actions">
            <button className="wl-btn wl-btn-accent" type="button" onClick={() => openAdd("quick")}>
              + Add Walk
            </button>
            <button className="wl-btn wl-btn-ghost" type="button" onClick={() => openAdd("paste")}>
              Paste rows
            </button>
          </div>
        </section>
      ) : (
        <main className="wl-main">
          <section className="wl-hero">
            <div className="wl-accent-line" />

            <div className="wl-row">
              <div className="wl-row-left">
                <span className="wl-kicker">{month.label.toUpperCase()}</span>
                <span className="wl-badge">ACTIVE MONTH</span>
              </div>
              <span className="wl-summary wl-summary-compact">
                {walkCount} walks · {points} pts
              </span>
            </div>

            <div className="wl-hero-main">
              <div className="wl-hero-line">
                <span className="wl-hero-number">{formatKm(month.distanceM)}</span>
                <span className="wl-unit">km</span>
              </div>

              <div className="wl-stats">
                <StatCard label="WALKS" value={String(month.walkCount)} />
                <StatCard label="DURATION" value={formatDuration(month.movingTimeS)} />
                <StatCard label="AVG PACE" value={`${formatPace(month.avgPaceSecPerKm)}/km`} accent />
              </div>

              <div className="wl-substats">
                <div className="wl-substat">
                  <div className="wl-row">
                    <span className="wl-stat-label">AVG / WALK</span>
                    <span className="wl-substat-value">{formatKm(avgWalk)} km</span>
                  </div>
                  <div className="wl-avg-track">
                    <span style={{ width: `${avgBarWidth}%` }} />
                  </div>
                </div>
                <div className="wl-substat is-peak">
                  <span className="wl-stat-label">LONGEST</span>
                  <span className="wl-peak-value">{formatKm(longest)} km</span>
                </div>
              </div>
            </div>

            <Chart data={data} />
          </section>

          <div className="wl-side">
            <section className="wl-card wl-last7">
              <div className="wl-row">
                <span className="wl-kicker">LAST 7 DAYS</span>
                <span className="wl-delta">{deltaLabel(last7.deltaM)}</span>
              </div>
              <div className="wl-row">
                <div className="wl-last7-number">
                  {formatKm(last7.distanceM)} <span>km</span>
                </div>
                <span className="wl-mono">
                  {formatDuration(last7.movingTimeS)} · {last7.walkCount} walks
                </span>
              </div>
              <div className="wl-streak-row">
                <span className="wl-streak">
                  <span aria-hidden="true">▲</span>
                  {streak >= 2 ? `${streak} walks ≥5k in a row` : "No 5k streak yet"}
                </span>
                <span className="wl-kicker">CONSISTENCY</span>
              </div>
            </section>

            <section className="wl-card wl-recent">
              <div className="wl-recent-head">
                <div className="wl-row-left">
                  <span className="wl-kicker">RECENT</span>
                  <span className="wl-count">{data.recent.length}</span>
                </div>
                <span className="wl-kicker">DIST / TIME · PACE</span>
              </div>
              <div className="wl-recent-list">
                {data.recent.length === 0 ? (
                  <p className="wl-empty-note">No walks yet.</p>
                ) : (
                  data.recent.map((walk, index) => (
                    <div className="wl-recent-row" key={walk.id}>
                      <div className="wl-recent-main">
                        <span className={`wl-row-dot${index === 0 ? " is-latest" : ""}`} />
                        <span className="wl-recent-name">{walk.name}</span>
                        <span className="wl-recent-date">{formatShortDate(walk.startLocal)}</span>
                      </div>
                      <div className="wl-recent-stats">
                        <span className="wl-recent-km">{formatKm(walk.distanceM)} km</span>
                        <span className="wl-recent-sep">/</span>
                        <span className="wl-recent-duration">{formatDuration(walk.movingTimeS)}</span>
                        <span className="wl-recent-sep">·</span>
                        <span>{formatPace(walk.movingTimeS / (walk.distanceM / 1000))}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </main>
      )}

      <footer className="wl-footer">
        <div className="wl-footer-left">
          <span>MANUAL</span>
          <span className="wl-sep">·</span>
          <span className="wl-synced-text">PIN SYNCED</span>
          <span className="wl-sep">·</span>
          <a href="/strava">STRAVA</a>
        </div>
        <div className="wl-footer-right">
          <span>{last7?.walkCount ?? 0} WALKS IN THE LAST 7 DAYS</span>
          <span className="wl-sep">·</span>
          <button className="wl-link" type="button" onClick={() => setModal("clear")}>
            Clear all
          </button>
        </div>
      </footer>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
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
                <p className="wl-kicker">ADD ACTIVITY</p>
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
                <p className="wl-kicker">DANGER ZONE</p>
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
