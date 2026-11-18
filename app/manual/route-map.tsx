"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cumulativeDistancesM } from "@/lib/gpx";
import { formatDuration, formatKm } from "@/lib/format";

export type RoutePoint = [lat: number, lng: number, elapsedS: number];

const VIEW = 1000;
const PAD = 84;

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

function pointAtTime(points: RoutePoint[], seconds: number): RoutePoint {
  if (seconds <= 0) return points[0];
  const last = points[points.length - 1];
  if (seconds >= last[2]) return last;

  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid][2] <= seconds) lo = mid;
    else hi = mid;
  }

  const a = points[lo];
  const b = points[hi];
  const span = Math.max(b[2] - a[2], 1e-6);
  const f = (seconds - a[2]) / span;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, seconds];
}

function distanceAtTime(cum: number[], points: RoutePoint[], seconds: number): number {
  if (seconds <= 0) return 0;
  if (seconds >= points[points.length - 1][2]) return cum[cum.length - 1];
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid][2] <= seconds) lo = mid;
    else hi = mid;
  }
  const a = points[lo];
  const b = points[hi];
  const span = Math.max(b[2] - a[2], 1e-6);
  const f = (seconds - a[2]) / span;
  return cum[lo] + (cum[hi] - cum[lo]) * f;
}

type RouteMapProps = {
  points: RoutePoint[];
  /// Play controls + moving marker under the map.
  animated?: boolean;
  /// Zoom buttons + legend overlay (in-card map).
  interactive?: boolean;
  className?: string;
};

const SPEEDS = [1, 2, 4] as const;
const ZOOM_MIN = 0.8;
const ZOOM_MAX = 1.6;

export function RouteMap({ points, animated = false, interactive = false, className }: RouteMapProps) {
  const projected = useMemo(() => projectPoints(points), [points]);
  const cum = useMemo(() => cumulativeDistancesM(points), [points]);
  const totalSeconds = points[points.length - 1][2] || 1;
  const totalMeters = cum[cum.length - 1];

  const basePath = useMemo(
    () => projected.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" "),
    [projected],
  );

  const kmTicks = useMemo(() => {
    const ticks: { x: number; y: number; km: number }[] = [];
    let km = 1;
    for (let i = 1; i < points.length - 1 && km * 1000 < totalMeters; i += 1) {
      if (cum[i] >= km * 1000) {
        ticks.push({ x: projected[i].x, y: projected[i].y, km });
        km += 1;
        i -= 1; // re-check the same point for the next km boundary
      }
    }
    return ticks.slice(0, 24);
  }, [cum, points, projected, totalMeters]);

  const [zoom, setZoom] = useState(1);
  const [elapsedS, setElapsedS] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    if (!animated || !playing) return;
    lastTickRef.current = null;

    const step = (now: number) => {
      const last = lastTickRef.current;
      lastTickRef.current = now;
      if (last !== null) {
        const dt = Math.min(0.25, (now - last) / 1000);
        setElapsedS((current) => {
          const next = current + dt * speed;
          if (next >= totalSeconds) {
            setPlaying(false);
            return totalSeconds;
          }
          return next;
        });
      }
      rafRef.current = window.requestAnimationFrame(step);
    };

    rafRef.current = window.requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [animated, playing, speed, totalSeconds]);

  function reset() {
    setPlaying(false);
    setElapsedS(0);
  }

  function cycleSpeed() {
    const index = SPEEDS.indexOf(speed);
    setSpeed(SPEEDS[(index + 1) % SPEEDS.length]);
  }

  const marker = animated ? pointAtTime(points, elapsedS) : null;
  const markerPx = marker ? projectPoints([marker])[0] : null;
  const coveredM = animated ? distanceAtTime(cum, points, elapsedS) : totalMeters;

  const totalKmLabel = `${formatKm(totalMeters)} km`;

  return (
    <div className={className ? `route-panel ${className}` : "route-panel"}>
      <div className={interactive ? "route-map-box" : undefined}>
        <svg
          className="route-svg"
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          role="img"
          aria-label="Walking route"
          style={interactive ? { transform: `scale(${zoom})` } : undefined}
        >
          <defs>
            <linearGradient id="routeTrackGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff6b2c" />
              <stop offset="50%" stopColor="#fc4c02" />
              <stop offset="100%" stopColor="#e04300" />
            </linearGradient>
          </defs>

          <path
            key={basePath}
            d={basePath}
            pathLength={1000}
            className="route-base"
            stroke="url(#routeTrackGradient)"
          />
          {animated && elapsedS > 0 && (
            <path
              d={projected
                .slice(
                  0,
                  Math.max(
                    2,
                    points.findIndex((p) => p[2] >= elapsedS) + 1,
                  ),
                )
                .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                .join(" ")}
              className="route-progress"
            />
          )}

          {kmTicks.map((tick) => (
            <g key={tick.km}>
              <circle cx={tick.x} cy={tick.y} r={7} className="route-km-dot" />
              <text x={tick.x} y={tick.y - 16} className="route-km-label" textAnchor="middle">
                {tick.km}
              </text>
            </g>
          ))}

          <circle cx={projected[0].x} cy={projected[0].y} r={14} className="route-start-glow" />
          <circle
            cx={projected[0].x}
            cy={projected[0].y}
            r={7}
            className="route-start"
          />
          <circle
            cx={projected[projected.length - 1].x}
            cy={projected[projected.length - 1].y}
            r={13}
            className="route-finish"
          />

          {markerPx && (
            <g className="route-marker">
              <circle cx={markerPx.x} cy={markerPx.y} r={26} className="route-marker-glow" />
              <circle cx={markerPx.x} cy={markerPx.y} r={13} className="route-marker-core" />
            </g>
          )}
        </svg>

        {interactive && (
          <>
            <div className="route-zoom">
              <button
                className="route-zoom-btn"
                type="button"
                aria-label="Zoom in"
                onClick={() => setZoom((z) => Math.min(ZOOM_MAX, Number((z + 0.2).toFixed(1))))}
              >
                +
              </button>
              <button
                className="route-zoom-btn"
                type="button"
                aria-label="Zoom out"
                onClick={() => setZoom((z) => Math.max(ZOOM_MIN, Number((z - 0.2).toFixed(1))))}
              >
                −
              </button>
            </div>
            <div className="route-legend">
              <span className="inline-flex items-center gap-1.5">
                <i /> Start / Finish
              </span>
              <span className="inline-flex items-center gap-1.5">
                <b /> GPS track
              </span>
              <span className="route-legend-km">{totalKmLabel}</span>
            </div>
          </>
        )}
      </div>

      {animated && (
        <div className="route-controls">
          <button
            className="wl-btn wl-btn-ghost"
            type="button"
            onClick={() => {
              if (elapsedS >= totalSeconds) reset();
              setPlaying((current) => !current);
            }}
          >
            {playing ? "Pause" : elapsedS >= totalSeconds ? "Replay" : "Play"}
          </button>
          <button className="wl-btn wl-btn-ghost route-speed" type="button" onClick={cycleSpeed}>
            {speed}×
          </button>
          <input
            className="route-scrub"
            type="range"
            min={0}
            max={Math.round(totalSeconds)}
            value={Math.round(elapsedS)}
            onChange={(event) => {
              setPlaying(false);
              setElapsedS(Number(event.target.value));
            }}
            aria-label="Route position"
          />
          <span className="route-readout">
            {formatKm(coveredM)} km · {formatDuration(Math.round(elapsedS))}
          </span>
        </div>
      )}
    </div>
  );
}
