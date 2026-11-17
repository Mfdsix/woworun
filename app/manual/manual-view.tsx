"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardHeader } from "@/app/dashboard/header";
import { MonthHero } from "@/app/dashboard/month-hero";
import { RecentList } from "@/app/dashboard/recent-list";
import { RhythmStrip } from "@/app/dashboard/rhythm-strip";
import { RunnerMark } from "@/app/dashboard/runner-mark";
import { SessionsChart } from "@/app/dashboard/sessions-chart";
import {
  mergeActivities,
  parseStored,
  serializeStored,
  STORAGE_KEY,
  type StoredActivity,
} from "@/lib/import/activity-store";
import { parseManualActivities } from "@/lib/import/manual-activities";
import { buildDashboard } from "@/lib/strava/metrics";

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

function skippedLabel(rejected: number, otherSport: number, invalid: number): string {
  return [
    rejected > 0 ? `${rejected} rejected` : "",
    otherSport > 0 ? `${otherSport} other sports` : "",
    invalid > 0 ? `${invalid} invalid` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function ManualView({ userId }: { userId: string }) {
  const [items, setItems] = useState<StoredActivity[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let stored: StoredActivity[] = [];

    try {
      const key = `${STORAGE_KEY}:${userId}`;
      let raw = window.localStorage.getItem(key);

      if (!raw) {
        const legacy = window.localStorage.getItem(STORAGE_KEY);
        if (legacy) {
          window.localStorage.setItem(key, legacy);
          window.localStorage.removeItem(STORAGE_KEY);
          raw = legacy;
        }
      }

      stored = parseStored(raw);
    } catch {
      stored = [];
    }

    setItems(stored);
    setNow(new Date());
    setLoaded(true);
  }, [userId]);

  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const focusTimer = window.setTimeout(() => textareaRef.current?.focus(), 40);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const points = items.reduce((total, item) => total + item.points, 0);

  const data = useMemo(() => {
    if (items.length === 0) return null;
    return buildDashboard(
      items.map((item) => item.walk),
      now,
    );
  }, [items, now]);

  function persist(next: StoredActivity[]) {
    setItems(next);
    try {
      window.localStorage.setItem(`${STORAGE_KEY}:${userId}`, serializeStored(next));
    } catch {
      setNotice("Could not save to this browser. The dashboard still works for this session.");
    }
  }

  function openModal() {
    setError(null);
    setOpen(true);
  }

  function addActivities() {
    if (!text.trim()) {
      setError("Paste a few rows first.");
      return;
    }

    const parsed = parseManualActivities(text);
    if (parsed.items.length === 0) {
      setError("No walking rows found. Check the field order and try again.");
      return;
    }

    const merged = mergeActivities(items, parsed.items, new Date());
    if (merged.added === 0) {
      setError(
        `Already saved — ${merged.duplicates} duplicate${merged.duplicates === 1 ? "" : "s"} skipped.`,
      );
      return;
    }

    persist(merged.items);
    setNow(new Date());
    setOpen(false);
    setText("");
    setError(null);

    const skipped = skippedLabel(parsed.rejected, parsed.otherSport, parsed.invalid);
    const duplicateNote =
      merged.duplicates > 0
        ? ` · ${merged.duplicates} duplicate${merged.duplicates === 1 ? "" : "s"} skipped`
        : "";
    setNotice(
      `${merged.added} walk${merged.added === 1 ? "" : "s"} added${duplicateNote}${
        skipped ? ` · ${skipped}` : ""
      }.`,
    );
  }

  function loadSample() {
    setText(SAMPLE);
    setError(null);
  }

  function clearAll() {
    if (!window.confirm("Remove all saved activities from this browser?")) return;
    persist([]);
    setNow(new Date());
    setNotice("All activities cleared.");
  }

  if (!loaded) {
    return (
      <main className="screen">
        <p className="hint">Loading…</p>
      </main>
    );
  }

  return (
    <main className="screen dashboard">
      <DashboardHeader
        athleteName="Local activities"
        computedAt={now}
        stale={false}
        actions="lock"
        statusLabel={
          <>
            {items.length} walks · {points} pts · saved locally
          </>
        }
      />

      {notice && <p className="banner banner-ok">{notice}</p>}

      {!data ? (
        <section className="panel empty-panel">
          <p className="eyebrow">NO ACTIVITIES YET</p>
          <h1 className="heading">Add your first walk</h1>
          <p className="sub">
            Paste rows copied from the activity table. Everything stays in this browser: no
            account, no upload, no Strava API.
          </p>
          <div className="paste-actions">
            <button className="btn btn-primary" type="button" onClick={openModal}>
              Paste activities
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => {
                loadSample();
                setOpen(true);
              }}
            >
              Use sample
            </button>
          </div>
          <p className="hint">
            You can add more later with the + button. Duplicates are skipped automatically.
          </p>
        </section>
      ) : (
        <>
          <div className="dash-grid">
            <section className="panel overview-panel">
              <RunnerMark />
              <MonthHero
                month={data.month}
                last7={data.last7}
                fiveKStreak={data.records.fiveKStreak}
                longestMonthM={data.records.longestMonthM}
              />
              <div className="overview-detail">
                <SessionsChart sessions={data.sessions} />
                <RhythmStrip rhythm={data.rhythm} />
              </div>
            </section>
            <section className="panel recent-panel">
              <RecentList recent={data.recent} linkToStrava={false} />
            </section>
          </div>

          <footer className="dash-footer">
            <span>
              Manual · saved in this browser ·{" "}
              <a className="footer-link" href="/strava">
                Strava
              </a>
            </span>
            <span>
              {data.last7.walkCount} walks in the last 7 days ·{" "}
              <button className="footer-link" type="button" onClick={clearAll}>
                Clear all
              </button>
            </span>
          </footer>
        </>
      )}

      <button className="fab" type="button" aria-label="Add activities" onClick={openModal}>
        +
      </button>

      {open && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="add-title">
            <div className="modal-head">
              <div>
                <p className="eyebrow">ADD ACTIVITIES</p>
                <h2 className="heading" id="add-title">
                  Paste rows
                </h2>
              </div>
              <button className="btn btn-sm btn-ghost" type="button" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            <textarea
              ref={textareaRef}
              className="paste-input"
              value={text}
              onChange={(event) => setText(event.target.value)}
              spellCheck={false}
              aria-label="Activity rows"
              placeholder={`16 Nov 2026\n16 Nov 2026, 16.54\n16 Nov 2026, 18.16\nDiterima\nEasy 6k\nWalking\n+3\n1j 21m\n7,07 km\n0 kkal`}
            />

            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}

            <div className="modal-actions">
              <button className="btn btn-primary" type="button" onClick={addActivities}>
                Add to dashboard
              </button>
              <button className="btn btn-ghost" type="button" onClick={loadSample}>
                Load sample
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>

            <p className="hint">
              Order: date, start, end, status, activity, sport, points, duration, distance,
              calories. Headers and calories are optional. Duplicates are detected by start time,
              duration, distance, and title.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
