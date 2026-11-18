/// Parsing + simplification of exported GPX activity files.
/// Pure functions — no DOM/React — so tests can run them headlessly.

export type GpxPoint = {
  lat: number;
  lng: number;
  /// Seconds since the first track point. null when the GPX has no timestamps.
  t: number | null;
  /// Elevation in meters. null when the GPX has no <ele>.
  ele: number | null;
};

/// A simplified track ready for storage/rendering: flat [lat, lng, t] triples.
export type RoutePoint = [lat: number, lng: number, t: number];

const EARTH_RADIUS_M = 6371008.8;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/// Great-circle distance between two lat/lng pairs, in meters.
export function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export class GpxParseError extends Error {}

/// Parse an attribute like lat="13.72" or lon='100.49' out of a tag source.
function readAttr(source: string, name: string): number {
  const match = source.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`));
  if (!match) return Number.NaN;
  return Number.parseFloat(match[1]);
}

/// Read the text of the first child element with the given local name,
/// e.g. <ele>86.3</ele> or <time>2026-11-16T09:54:00Z</time>.
function readChildText(source: string, localName: string): string | null {
  const pattern = new RegExp(
    `<${localName}(?:\\s[^>]*)?>([\\s\\S]*?)</${localName}>`,
    "i",
  );
  const match = source.match(pattern);
  const value = match?.[1]?.trim();
  return value ? value : null;
}

/// Parse the track points of a GPX document.
///
/// Recognizes the pattern Strava exports (attributes and children on their
/// own lines, extension blocks inside trkpt, any number of trkseg):
///
///   <gpx ... creator="StravaGPX">
///     <trk><name>...</name><trkseg>
///       <trkpt lat="13.7259290" lon="100.4914910">
///         <ele>9.8</ele>
///         <time>2026-11-16T09:54:00Z</time>
///       </trkpt>
///
/// Times are converted to seconds relative to the first point. Files
/// without timestamps yield t = null — the caller can distribute times
/// afterwards with withTimes().
export function parseGpx(xml: string): GpxPoint[] {
  // The root element must be <gpx ...>, optionally with a namespace prefix.
  if (!/<[A-Za-z0-9_-]*:?gpx[\s>]/i.test(xml.trim())) {
    throw new GpxParseError("This file is not a GPX document.");
  }

  const points: GpxPoint[] = [];
  let firstTime: number | null = null;
  let cursor = 0;

  while (cursor < xml.length) {
    const openStart = xml.indexOf("<trkpt", cursor);
    if (openStart === -1) break;

    // Skip tags that merely start with "trkpt" (e.g. <trkptext>).
    const charAfter = xml[openStart + 6] ?? ">";
    if (/[A-Za-z0-9_.-]/.test(charAfter)) {
      cursor = openStart + 6;
      continue;
    }

    const openEnd = xml.indexOf(">", openStart);
    if (openEnd === -1) break;

    const attrs = xml.slice(openStart + 6, openEnd);
    const selfClosing = attrs.endsWith("/");
    const closeStart = selfClosing
      ? openEnd
      : xml.indexOf("</trkpt>", openEnd);
    if (closeStart === -1) break;

    const lat = readAttr(attrs, "lat");
    const lng = readAttr(attrs, "lon");
    const inner = selfClosing ? "" : xml.slice(openEnd + 1, closeStart);

    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      let t: number | null = null;
      const timeText = readChildText(inner, "time");
      if (timeText) {
        const ms = Date.parse(timeText);
        if (Number.isFinite(ms)) {
          if (firstTime === null) firstTime = ms;
          t = Math.max(0, (ms - firstTime) / 1000);
        }
      }

      const eleText = readChildText(inner, "ele");
      const ele = eleText === null ? null : Number.parseFloat(eleText);

      points.push({
        lat,
        lng,
        t,
        ele: ele !== null && Number.isFinite(ele) ? ele : null,
      });
    }

    cursor = selfClosing ? openEnd + 1 : closeStart + "</trkpt>".length;
  }

  if (points.length < 2) {
    throw new GpxParseError(
      "No usable track points found — is this a GPX export of the activity?",
    );
  }
  return points;
}

/// Total path length in meters.
export function trackDistanceM(points: GpxPoint[] | RoutePoint[]): number {
  const cum = cumulativeDistancesM(points);
  return cum[cum.length - 1] ?? 0;
}

export function cumulativeDistancesM(points: GpxPoint[] | RoutePoint[]): number[] {
  const coords = points.map((p) =>
    "lat" in p ? ([p.lat, p.lng, p.t ?? 0] as RoutePoint) : (p as RoutePoint),
  );
  const cum = [0];
  for (let i = 1; i < coords.length; i += 1) {
    cum.push(
      cum[i - 1] + haversineM(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]),
    );
  }
  return cum;
}

/// Project lat/lng to meters around the centroid (local equirectangular) for 2D ops.
function toLocalMeters(points: GpxPoint[] | RoutePoint[]): { x: number; y: number }[] {
  const coords = points.map((p) =>
    "lat" in p ? ([p.lat, p.lng, p.t ?? 0] as RoutePoint) : (p as RoutePoint),
  );
  let latSum = 0;
  let lngSum = 0;
  for (const p of coords) {
    latSum += p[0];
    lngSum += p[1];
  }
  const lat0 = latSum / coords.length;
  const lng0 = lngSum / coords.length;
  const k = Math.cos(toRad(lat0));
  return coords.map((p) => ({
    x: toRad(p[1] - lng0) * EARTH_RADIUS_M * k,
    y: toRad(p[0] - lat0) * EARTH_RADIUS_M,
  }));
}

function perpendicularDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    return Math.hypot(px - ax, py - ay);
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/// Douglas-Peucker on the meter-projected track, keeping indices.
function douglasPeucker(points: GpxPoint[] | RoutePoint[], toleranceM: number): number[] {
  const local = toLocalMeters(points);
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop() as [number, number];
    if (end <= start + 1) continue;

    const a = local[start];
    const b = local[end];
    let maxDist = -1;
    let maxIndex = start;
    for (let i = start + 1; i < end; i += 1) {
      const dist = perpendicularDistance(
        local[i].x,
        local[i].y,
        a.x,
        a.y,
        b.x,
        b.y,
      );
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }
    if (maxDist > toleranceM) {
      keep[maxIndex] = true;
      stack.push([start, maxIndex], [maxIndex, end]);
    }
  }

  const indices: number[] = [];
  for (let i = 0; i < keep.length; i += 1) {
    if (keep[i]) indices.push(i);
  }
  return indices;
}

/// Simplify a track to at most `maxPoints` points, preserving first/last and
/// timestamps where available. Tolerance in meters controls shape fidelity.
export function simplifyTrack(
  points: GpxPoint[],
  maxPoints = 900,
  toleranceM = 3,
): RoutePoint[] {
  let tolerance = toleranceM;
  let indices = douglasPeucker(points, tolerance);
  while (indices.length > maxPoints) {
    tolerance *= 1.6;
    indices = douglasPeucker(points, tolerance);
  }

  return indices.map((index) => {
    const p = points[index];
    return [p.lat, p.lng, p.t ?? 0] as RoutePoint;
  });
}

/// Ensure every point carries a timestamp. When the GPX lacked <time>,
/// distribute `totalSeconds` proportionally to distance travelled.
export function withTimes(points: RoutePoint[], totalSeconds: number): RoutePoint[] {
  if (points.length === 0) return points;
  const cum = cumulativeDistancesM(points);
  const totalM = cum[cum.length - 1];
  return points.map((p, i) => {
    if (p[2] > 0 || i === 0) return p;
    const fraction = totalM > 0 ? cum[i] / totalM : i / (points.length - 1);
    return [p[0], p[1], Math.round(fraction * totalSeconds)] as RoutePoint;
  });
}

export type RouteBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export function boundsOf(points: RoutePoint[]): RouteBounds {
  const bounds: RouteBounds = {
    minLat: points[0][0],
    maxLat: points[0][0],
    minLng: points[0][1],
    maxLng: points[0][1],
  };
  for (const [lat, lng] of points) {
    if (lat < bounds.minLat) bounds.minLat = lat;
    if (lat > bounds.maxLat) bounds.maxLat = lat;
    if (lng < bounds.minLng) bounds.minLng = lng;
    if (lng > bounds.maxLng) bounds.maxLng = lng;
  }
  return bounds;
}

export type RouteStats = {
  distanceM: number;
  start: RoutePoint;
  end: RoutePoint;
};

export function routeStats(points: RoutePoint[]): RouteStats {
  return {
    distanceM: trackDistanceM(points),
    start: points[0],
    end: points[points.length - 1],
  };
}
