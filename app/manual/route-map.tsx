"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cumulativeDistancesM } from "@/lib/gpx";
import { formatDuration, formatKm, formatPace } from "@/lib/format";
import type { WalkSession } from "@/lib/strava/types";

export type RoutePoint = [lat: number, lng: number, elapsedS: number];

const VIEW = 1000;
const PAD = 84;
const ACCENT = "#fc4c02";
const FAST = [52, 199, 89]; // #34C759
const SLOW = [255, 158, 102]; // #FF9E66

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/// Project [lat, lng] into a VIEW x VIEW square (y flipped), keeping aspect.
export function projectPoints(points: RoutePoint[]): { x: number; y: number }[] {
  let minLat = points[0][0];
  let maxLat = points[0][0];
  let minLng = points[0][1];
  let maxLng = points[0][1];
  for (const [lat, lng] of points) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  const centerLat = (minLat + maxLat) / 2;
  const k = Math.cos(toRad(centerLat));
  const spanX = Math.max((maxLng - minLng) * k, 1e-6);
  const spanY = Math.max(maxLat - minLat, 1e-6);
  const scale = (VIEW - PAD * 2) / Math.max(spanX, spanY);
  const offsetX = (VIEW - spanX * scale) / 2;
  const offsetY = (VIEW - spanY * scale) / 2;

  return points.map(([lat, lng]) => ({
    x: offsetX + (lng - minLng) * k * scale,
    y: VIEW - (offsetY + (lat - minLat) * scale),
  }));
}

function pointAtDistance(
  cum: number[],
  points: RoutePoint[],
  projected: { x: number; y: number }[],
  meters: number,
): { x: number; y: number; t: number } {
  const total = cum[cum.length - 1];
  if (meters <= 0) return { x: projected[0].x, y: projected[0].y, t: 0 };
  if (meters >= total) {
    const last = points.length - 1;
    return { x: projected[last].x, y: projected[last].y, t: points[last][2] };
  }
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= meters) lo = mid;
    else hi = mid;
  }
  const span = Math.max(cum[hi] - cum[lo], 1e-6);
  const f = (meters - cum[lo]) / span;
  return {
    x: projected[lo].x + (projected[hi].x - projected[lo].x) * f,
    y: projected[lo].y + (projected[hi].y - projected[lo].y) * f,
    t: points[lo][2] + (points[hi][2] - points[lo][2]) * f,
  };
}

function lerpColor(from: number[], to: number[], t: number): string {
  const mix = from.map((c, i) => Math.round(c + (to[i] - c) * Math.min(1, Math.max(0, t))));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

function pathTo(points: { x: number; y: number }[], from: number, to: number): string {
  let d = "";
  for (let i = from; i <= to; i += 1) {
    d += `${i === from ? "M" : "L"}${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)} `;
  }
  return d;
}

/* ------------------------------------------------------------------ */
/* Minimal in-card preview — click to open the full explorer            */
/* ------------------------------------------------------------------ */

export function RoutePreview({
  points,
  onExpand,
  className,
}: {
  points: RoutePoint[];
  onExpand: () => void;
  className?: string;
}) {
  const projected = useMemo(() => projectPoints(points), [points]);
  const basePath = useMemo(
    () => projected.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" "),
    [projected],
  );
  const first = projected[0];
  const last = projected[projected.length - 1];

  return (
    <button
      type="button"
      className={className ? `route-preview-box ${className}` : "route-preview-box"}
      onClick={onExpand}
      aria-label="Expand interactive route map"
    >
      <svg viewBox={`0 0 ${VIEW} ${VIEW}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Route preview">
        <path
          key={basePath}
          d={basePath}
          pathLength={1000}
          className="route-base route-base-preview"
        />
        <circle cx={first.x} cy={first.y} r={12} className="route-preview-dot-start" />
        <circle cx={last.x} cy={last.y} r={10} className="route-preview-dot-end" />
      </svg>
      <span className="route-expand-pill">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
          />
        </svg>
        Expand map
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Full interactive explorer modal                                     */
/* ------------------------------------------------------------------ */

type KmSegment = {
  km: number;
  fromIdx: number;
  toIdx: number;
  x: number;
  y: number;
  paceSecPerKm: number;
  elapsedS: number;
  color: string;
};

const SPEEDS = [1, 2, 4] as const;
const ZOOM_MIN = 0.75;
const ZOOM_MAX = 2.6;

export function RouteExplorer({
  points,
  walk,
  onClose,
}: {
  points: RoutePoint[];
  walk: WalkSession;
  onClose: () => void;
}) {
  const projected = useMemo(() => projectPoints(points), [points]);
  const cum = useMemo(() => cumulativeDistancesM(points), [points]);
  const totalMeters = cum[cum.length - 1];
  const totalSeconds = points[points.length - 1][2];
  const basePath = useMemo(
    () => projected.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" "),
    [projected],
  );

  const segments = useMemo<KmSegment[]>(() => {
    const boundaries: number[] = [];
    let km = 1;
    for (let i = 1; i < points.length - 1 && km * 1000 < totalMeters; i += 1) {
      if (cum[i] >= km * 1000) {
        boundaries.push(i);
        km += 1;
        i -= 1;
      }
    }
    const idxs = [0, ...boundaries, points.length - 1];
    const paces: number[] = [];
    const segs: KmSegment[] = [];
    for (let s = 0; s < idxs.length - 1; s += 1) {
      const fromIdx = idxs[s];
      const toIdx = idxs[s + 1];
      const distKm = (cum[toIdx] - cum[fromIdx]) / 1000;
      const pace = (points[toIdx][2] - points[fromIdx][2]) / Math.max(distKm, 0.05);
      paces.push(pace);
      const tipIdx = toIdx;
      segs.push({
        km: s + 1,
        fromIdx,
        toIdx,
        x: projected[tipIdx].x,
        y: projected[tipIdx].y,
        paceSecPerKm: pace,
        elapsedS: points[toIdx][2],
        color: "",
      });
    }
    const min = Math.min(...paces);
    const max = Math.max(...paces);
    for (const seg of segs) {
      const t = max > min ? (seg.paceSecPerKm - min) / (max - min) : 0.5;
      seg.color = lerpColor(FAST, SLOW, t);
    }
    return segs;
  }, [cum, points, projected, totalMeters]);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [heatmap, setHeatmap] = useState(false);
  const [gridOn, setGridOn] = useState(true);
  const [activeKm, setActiveKm] = useState<number | null>(null);
  const [scrub, setScrub] = useState(0); // 0..100 percent of distance
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const scrubMeters = (scrub / 100) * totalMeters;
  const puck = pointAtDistance(cum, points, projected, scrubMeters);
  const coveredKm = totalMeters / 1000 * (scrub / 100);
  const elapsedS = puck.t;
  const overallPace = totalSeconds / (totalMeters / 1000);
  const activeSeg = activeKm ? segments.find((s) => s.km === activeKm) : null;

  function stopPlayback() {
    setPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  useEffect(() => () => stopPlayback(), []);

  useEffect(() => {
    if (!playing) return;
    intervalRef.current = setInterval(() => {
      setScrub((current) => {
        const next = current + 1;
        if (next >= 100) {
          stopPlayback();
          return 100;
        }
        return next;
      });
    }, 45);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [playing]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function applyPan(dxPx: number, dyPx: number) {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scale = VIEW / rect.width;
    setPan((current) => ({
      x: current.x + dxPx * scale,
      y: current.y + dyPx * scale,
    }));
  }

  function cycleSpeed() {
    const index = SPEEDS.indexOf(speed);
    setSpeed(SPEEDS[(index + 1) % SPEEDS.length]);
  }

  return (
    <div
      className="map-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          stopPlayback();
          onClose();
        }
      }}
    >
      <div className="map-dialog" role="dialog" aria-modal="true">
        <div className="map-head">
          <div className="map-head-left">
            <span className="wl-badge">{formatShortDate(walk.startLocal)}</span>
            <div>
              <h3 className="map-title">{walk.name}</h3>
              <div className="map-head-meta">
                <span className="map-head-km">{formatKm(walk.distanceM)} km</span>
                <span>·</span>
                <span>{formatDuration(walk.movingTimeS)}</span>
                <span>·</span>
                <span className="map-head-pace">{formatPace(overallPace)}/km</span>
              </div>
            </div>
          </div>
          <div className="map-head-actions">
            <div className="cal-switch">
              <button
                type="button"
                className={`cal-switch-tab${!heatmap ? " is-active" : ""}`}
                onClick={() => setHeatmap(false)}
              >
                Solid orange
              </button>
              <button
                type="button"
                className={`cal-switch-tab${heatmap ? " is-active" : ""}`}
                onClick={() => setHeatmap(true)}
              >
                Pace heatmap
              </button>
            </div>
            <button
              className="wl-btn wl-btn-ghost"
              type="button"
              onClick={() => setGridOn((current) => !current)}
            >
              Grid: {gridOn ? "On" : "Off"}
            </button>
            <button
              className="wl-btn wl-btn-ghost"
              type="button"
              aria-label="Close route explorer"
              onClick={() => {
                stopPlayback();
                onClose();
              }}
            >
              Close
            </button>
          </div>
        </div>

        <div
          ref={viewportRef}
          className={`map-viewport ${gridOn ? "is-grid" : "is-plain"}`}
          onWheel={(event) => {
            event.preventDefault();
            const delta = event.deltaY < 0 ? 0.15 : -0.15;
            setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number((z + delta).toFixed(2)))));
          }}
          onPointerDown={(event) => {
            if ((event.target as HTMLElement).closest("button")) return;
            dragRef.current = {
              px: event.clientX,
              py: event.clientY,
              ox: pan.x,
              oy: pan.y,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag) return;
            setPan({
              x: drag.ox + (event.clientX - drag.px),
              y: drag.oy + (event.clientY - drag.py),
            });
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
        >
          <svg viewBox={`0 0 ${VIEW} ${VIEW}`} preserveAspectRatio="xMidYMid meet">
            <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
              <path d={basePath} className="route-base-hidden" />

              {heatmap ? (
                segments.map((seg) => (
                  <path
                    key={seg.km}
                    d={pathTo(projected, seg.fromIdx, seg.toIdx)}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={10}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))
              ) : (
                <path
                  key={basePath}
                  d={basePath}
                  pathLength={1000}
                  className="route-base route-base-explorer"
                />
              )}

              {segments.map((seg) => (
                <g
                  key={seg.km}
                  className="map-km-marker"
                  onMouseEnter={() => setActiveKm(seg.km)}
                  onClick={(event) => {
                    event.stopPropagation();
                    setActiveKm(seg.km);
                  }}
                >
                  <circle
                    cx={seg.x}
                    cy={seg.y}
                    r={11}
                    fill={activeKm === seg.km ? ACCENT : "#141416"}
                    stroke={heatmap ? seg.color : ACCENT}
                    strokeWidth={2.5}
                  />
                  <text x={seg.x} y={seg.y + 4} textAnchor="middle" className="map-km-marker-text">
                    {seg.km}
                  </text>
                </g>
              ))}

              <circle cx={projected[0].x} cy={projected[0].y} r={8} className="map-start-dot" />
              <circle
                cx={projected[projected.length - 1].x}
                cy={projected[projected.length - 1].y}
                r={8}
                className="map-finish-dot"
              />

              <g>
                <circle cx={puck.x} cy={puck.y} r={18} fill={ACCENT} fillOpacity={0.28} />
                <circle cx={puck.x} cy={puck.y} r={9} fill={ACCENT} stroke="#fff" strokeWidth={3} />
              </g>
            </g>
          </svg>

          <div className="map-inspector">
            <div className="map-inspector-label">
              <span className="map-inspector-dot" />
              {activeSeg ? `Split · Kilometer ${activeSeg.km}` : scrub > 0 ? "Live playback" : "Route overview"}
            </div>
            <div className="map-inspector-grid">
              <div>
                <span className="map-inspector-caption">Distance</span>
                <span className="map-inspector-value">
                  {coveredKm.toFixed(1)} / {(totalMeters / 1000).toFixed(1)} km
                </span>
              </div>
              <div className="map-inspector-sep" />
              <div>
                <span className="map-inspector-caption">Elapsed</span>
                <span className="map-inspector-value">{formatDuration(Math.round(elapsedS))}</span>
              </div>
              <div className="map-inspector-sep" />
              <div>
                <span className="map-inspector-caption">Pace</span>
                <span className="map-inspector-value is-accent">
                  {formatPace(activeSeg ? activeSeg.paceSecPerKm : overallPace)}/km
                </span>
              </div>
            </div>
          </div>

          <div className="route-zoom map-zoom">
            <button
              className="route-zoom-btn"
              type="button"
              aria-label="Zoom in"
              onClick={() => setZoom((z) => Math.min(ZOOM_MAX, Number((z + 0.25).toFixed(2))))}
            >
              +
            </button>
            <button
              className="route-zoom-btn"
              type="button"
              aria-label="Zoom out"
              onClick={() => setZoom((z) => Math.max(ZOOM_MIN, Number((z - 0.25).toFixed(2))))}
            >
              −
            </button>
            <button
              className="route-zoom-btn"
              type="button"
              aria-label="Reset pan and zoom"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
            >
              ⌂
            </button>
          </div>

          <div className="route-legend map-legend">
            <span className="inline-flex items-center gap-1.5">
              <span className="route-legend-start" /> Start
            </span>
            <span className="inline-flex items-gap-1.5 items-center">
              <i /> Finish
            </span>
            {heatmap && (
              <span className="map-legend-heat">
                <span>Slow</span>
                <span className="map-legend-gradient" />
                <span>Fast</span>
              </span>
            )}
          </div>

          <div className="map-hint">Scroll to zoom · Drag to pan · Click km markers</div>
        </div>

        <div className="map-footer">
          <button
            className="wl-btn wl-btn-accent"
            type="button"
            onClick={() => {
              if (playing) {
                stopPlayback();
                return;
              }
              if (scrub >= 100) setScrub(0);
              setPlaying(true);
            }}
          >
            {playing ? "Pause" : scrub >= 100 ? "Replay walk" : "Play walk"}
          </button>
          <button className="wl-btn wl-btn-ghost route-speed" type="button" onClick={cycleSpeed}>
            {speed}×
          </button>
          <span className="map-slider-label">{(coveredKm).toFixed(1)}</span>
          <input
            className="strava-slider"
            type="range"
            min={0}
            max={100}
            value={Math.round(scrub)}
            onChange={(event) => {
              stopPlayback();
              setScrub(Number(event.target.value));
            }}
            aria-label="Route position"
          />
          <span className="map-slider-label">{formatKm(totalMeters)} km</span>
        </div>
      </div>
    </div>
  );
}

function formatShortDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (!year || !month || !day) return iso.slice(0, 10);
  return `${day} ${months[month - 1]}`;
}
