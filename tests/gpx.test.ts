import assert from "node:assert/strict";
import test from "node:test";
import {
  GpxParseError,
  boundsOf,
  cumulativeDistancesM,
  parseGpx,
  simplifyTrack,
  trackDistanceM,
  withTimes,
  type RoutePoint,
} from "../lib/gpx";

const SAMPLE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="StravaGPX" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Easy 6k</name>
    <trkseg>
      <trkpt lat="-6.2088" lon="106.8456"><ele>50.2</ele><time>2026-11-16T09:54:00Z</time></trkpt>
      <trkpt lat="-6.2090" lon="106.8458"><ele>50.5</ele><time>2026-11-16T09:54:30Z</time></trkpt>
      <trkpt lat="-6.2094" lon="106.8462"><ele>51.0</ele><time>2026-11-16T09:55:00Z</time></trkpt>
      <trkpt lat="-6.2100" lon="106.8470"><ele>51.4</ele><time>2026-11-16T09:56:00Z</time></trkpt>
      <trkpt lat="-6.2108" lon="106.8480"><ele>52.1</ele><time>2026-11-16T09:57:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`;

test("parseGpx extracts lat/lng, relative seconds, and elevation", () => {
  const points = parseGpx(SAMPLE_GPX);
  assert.equal(points.length, 5);
  assert.equal(points[0].lat, -6.2088);
  assert.equal(points[0].lng, 106.8456);
  assert.equal(points[0].t, 0);
  assert.equal(points[1].t, 30);
  assert.equal(points[4].t, 180);
  assert.equal(points[2].ele, 51.0);
});

test("parseGpx follows the exact Strava export pattern", () => {
  // Modeled on real Strava exports: schemaLocation attributes on <gpx>,
  // trkpt attributes and children on separate lines, extension blocks,
  // and the track split across several trkseg elements.
  const strava = `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="StravaGPX Android" version="1.1" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
 <metadata>
  <time>2026-11-16T09:54:00Z</time>
 </metadata>
 <trk>
  <name>Easy 6k</name>
  <type>9</type>
  <trkseg>
   <trkpt lat="-6.2088" lon="106.8456">
    <ele>9.8</ele>
    <time>2026-11-16T09:54:00Z</time>
   </trkpt>
   <trkpt lat="-6.2090" lon="106.8458">
    <ele>10.5</ele>
    <time>2026-11-16T09:54:30Z</time>
    <extensions>
     <gpxtpx:TrackPointExtension>
      <gpxtpx:hr>95</gpxtpx:hr>
     </gpxtpx:TrackPointExtension>
    </extensions>
   </trkpt>
  </trkseg>
  <trkseg>
   <trkpt lat="-6.2094" lon="106.8462">
    <ele>10.7</ele>
    <time>2026-11-16T09:55:00Z</time>
   </trkpt>
  </trkseg>
 </trk>
</gpx>`;
  const points = parseGpx(strava);
  assert.equal(points.length, 3);
  assert.equal(points[0].t, 0);
  assert.equal(points[1].t, 30);
  assert.equal(points[2].t, 60);
  assert.equal(points[1].ele, 10.5);
});

test("parseGpx rejects files without gpx root or track points", () => {
  assert.throws(() => parseGpx("<not-gpx/>"), GpxParseError);
  assert.throws(
    () =>
      parseGpx(
        `<gpx xmlns="http://www.topografix.com/GPX/1/1"><metadata/></gpx>`,
      ),
    GpxParseError,
  );
});

test("trackDistanceM and cumulativeDistancesM are consistent", () => {
  const points = parseGpx(SAMPLE_GPX);
  const cum = cumulativeDistancesM(points);
  assert.equal(cum.length, points.length);
  assert.equal(cum[0], 0);
  // 5 points spanning ~200 m of city blocks — generous sanity band.
  const total = trackDistanceM(points);
  assert.ok(total > 50 && total < 500, `total=${total}`);
  assert.ok(Math.abs(cum[cum.length - 1] - total) < 0.01);
});

test("simplifyTrack keeps endpoints and respects maxPoints", () => {
  // Generate a dense zig-zag track of 2000 points.
  const points = [];
  for (let i = 0; i < 2000; i += 1) {
    const wiggle = (i % 2 === 0 ? 0.0004 : -0.0004);
    points.push({
      lat: -6.2 + i * 0.00003,
      lng: 106.8 + wiggle,
      t: i * 3,
      ele: null,
    });
  }
  const simplified = simplifyTrack(points, 200, 2);
  assert.ok(simplified.length <= 200, `len=${simplified.length}`);
  assert.equal(simplified[0][0], points[0].lat);
  assert.equal(simplified[simplified.length - 1][0], points[points.length - 1].lat);
  // Timestamps preserved where available.
  assert.ok(simplified.every((p) => p[2] % 3 === 0));
});

test("simplifyTrack on a straight line collapses to the endpoints", () => {
  const points = [];
  for (let i = 0; i < 100; i += 1) {
    points.push({ lat: -6.2 + i * 0.0001, lng: 106.8, t: i * 10, ele: null });
  }
  const simplified = simplifyTrack(points, 900, 3);
  assert.equal(simplified.length, 2);
});

test("boundsOf wraps the full track", () => {
  const points = parseGpx(SAMPLE_GPX).map((p): RoutePoint => [p.lat, p.lng, p.t ?? 0]);
  const bounds = boundsOf(points);
  assert.equal(bounds.minLat, -6.2108);
  assert.equal(bounds.maxLat, -6.2088);
  assert.equal(bounds.minLng, 106.8456);
  assert.equal(bounds.maxLng, 106.848);
});

test("withTimes distributes seconds by distance when the GPX has none", () => {
  const raw = [
    { lat: 0, lng: 0, t: null, ele: null },
    { lat: 0, lng: 0.001, t: null, ele: null },
    { lat: 0, lng: 0.003, t: null, ele: null },
  ];
  const route = withTimes(
    raw.map((p) => [p.lat, p.lng, 0] as [number, number, number]),
    300,
  );
  assert.equal(route[0][2], 0);
  assert.ok(route[1][2] > 0 && route[1][2] < 150);
  assert.equal(route[2][2], 300);
});
