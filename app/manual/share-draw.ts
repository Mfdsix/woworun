import type { DashboardData, WalkSession } from "@/lib/strava/types";
import { trackDistanceM } from "@/lib/gpx";
import type { RoutePoint } from "./route-map";

export type ShareFormat = "4:5" | "9:16";

export const SHARE_SIZES: Record<ShareFormat, { width: number; height: number }> = {
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
};

export type ShareStickerLayer = {
  img: HTMLImageElement;
  /** center position as a fraction of the canvas */
  cx: number;
  cy: number;
  /** sticker width as a fraction of the canvas width */
  scale: number;
};

export type RouteLayer = {
  points: RoutePoint[];
  /** center position as a fraction of the canvas */
  cx: number;
  cy: number;
  /** panel width as a fraction of the canvas width */
  scale: number;
  /** font family for the km label, injected by the drawer */
  labelFont?: string;
};

export type ShareFonts = { sans: string; mono: string };

export type ShareDrawOptions = {
  width: number;
  height: number;
  data: DashboardData;
  selectedWalk: WalkSession | null;
  selectedPoints: number;
  photo: HTMLImageElement | null;
  sticker: ShareStickerLayer | null;
  fonts: ShareFonts;
  route: RouteLayer | null;
};

export function shareCanvasSize(format: ShareFormat): { width: number; height: number } {
  return SHARE_SIZES[format];
}

export function shareFileName(dateISO: string, format: ShareFormat): string {
  const ratio = format === "9:16" ? "story" : "post";
  return `walk-log-${dateISO.slice(0, 10)}-${ratio}.png`;
}

export function clampRange(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function coverFit(
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number,
): { x: number; y: number; width: number; height: number } {
  const scale = Math.max(dstWidth / srcWidth, dstHeight / srcHeight);
  const width = srcWidth * scale;
  const height = srcHeight * scale;
  return { x: (dstWidth - width) / 2, y: (dstHeight - height) / 2, width, height };
}

export function stickerRect(
  params: { canvasWidth: number; canvasHeight: number; scale: number; cx: number; cy: number },
  image: { width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  const width = params.scale * params.canvasWidth;
  const height = width * (image.height / image.width);
  const x = params.cx * params.canvasWidth - width / 2;
  const y = params.cy * params.canvasHeight - height / 2;
  return { x, y, width, height };
}

export const ROUTE_PANEL_ASPECT = 0.62;

export function routeRect(
  params: { canvasWidth: number; canvasHeight: number; scale: number; cx: number; cy: number },
): { x: number; y: number; width: number; height: number } {
  const width = params.scale * params.canvasWidth;
  const height = width * ROUTE_PANEL_ASPECT;
  const x = params.cx * params.canvasWidth - width / 2;
  const y = params.cy * params.canvasHeight - height / 2;
  return { x, y, width, height };
}

const BG = "#09090b";
const LINE = "rgba(255,255,255,0.08)";
const TEXT = "#f4f4f5";
const MUTED = "#a1a1aa";
const ACCENT = "#fc4c02";

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

type DrawTextOptions = {
  size: number;
  weight?: number;
  family: string;
  color: string;
  align?: CanvasTextAlign;
};

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: DrawTextOptions,
): number {
  ctx.font = `${options.weight ?? 600} ${options.size}px ${options.family}`;
  ctx.fillStyle = options.color;
  ctx.textAlign = options.align ?? "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, y);
  return ctx.measureText(text).width;
}

function projectRoute(
  points: RoutePoint[],
  x: number,
  y: number,
  width: number,
  height: number,
  pad: number,
): { x: number; y: number }[] {
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
  const k = Math.cos((centerLat * Math.PI) / 180);
  const spanX = Math.max((maxLng - minLng) * k, 1e-6);
  const spanY = Math.max(maxLat - minLat, 1e-6);
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const offsetX = x + (width - spanX * scale) / 2;
  const offsetY = y + (height - spanY * scale) / 2;

  return points.map(([lat, lng]) => ({
    x: offsetX + (lng - minLng) * k * scale,
    y: y + height - (offsetY - y + (lat - minLat) * scale),
  }));
}

function drawRoutePanel(
  ctx: CanvasRenderingContext2D,
  layer: RouteLayer,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const rect = routeRect({
    canvasWidth,
    canvasHeight,
    scale: layer.scale,
    cx: layer.cx,
    cy: layer.cy,
  });
  const r = Math.min(28, rect.width / 8);

  ctx.save();
  ctx.fillStyle = "rgba(13,13,16,0.82)";
  roundRect(ctx, rect.x, rect.y, rect.width, rect.height, r);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const projected = projectRoute(
    layer.points,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    Math.max(30, rect.width * 0.09),
  );
  const path = projected
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 12;
  ctx.stroke(new Path2D(path));

  ctx.shadowColor = "rgba(252,76,2,0.4)";
  ctx.shadowBlur = 14;
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 7;
  ctx.stroke(new Path2D(path));
  ctx.shadowBlur = 0;

  const start = projected[0];
  const end = projected[projected.length - 1];
  ctx.fillStyle = TEXT;
  ctx.beginPath();
  ctx.arc(start.x, start.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.arc(end.x, end.y, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = `500 24px ${layer.labelFont ?? "sans-serif"}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const km = (trackDistanceM(layer.points) / 1000).toFixed(1);
  ctx.fillText(`${km} km`, rect.x + 22, rect.y + rect.height - 20);
  ctx.restore();
}

export function drawShareImage(
  ctx: CanvasRenderingContext2D,
  options: ShareDrawOptions,
): void {
  const { width, height, data, selectedWalk, selectedPoints, photo, sticker, fonts, route } =
    options;
  const sans = fonts.sans;
  const mono = fonts.mono;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  if (photo) {
    const fit = coverFit(photo.width, photo.height, width, height);
    ctx.drawImage(photo, fit.x, fit.y, fit.width, fit.height);
    const overlay = ctx.createLinearGradient(0, 0, 0, height);
    overlay.addColorStop(0, "rgba(9,9,11,0.1)");
    overlay.addColorStop(0.5, "rgba(9,9,11,0.32)");
    overlay.addColorStop(1, "rgba(9,9,11,0.8)");
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, width, height);
    drawText(ctx, "WALK LOG", 48, 64, { size: 30, weight: 700, family: mono, color: "#e4e4e7" });
  } else {
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#18181c");
    bg.addColorStop(1, BG);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    const glow = ctx.createRadialGradient(
      width * 0.2,
      height * 0.12,
      0,
      width * 0.2,
      height * 0.12,
      width * 0.6,
    );
    glow.addColorStop(0, "rgba(252,76,2,0.14)");
    glow.addColorStop(1, "rgba(252,76,2,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  // Compact glass card pinned to the bottom.
  const cardX = 48;
  const cardW = width - 96;
  const cardH = 470;
  const cardY = height - 52 - cardH;
  const p = 52;

  ctx.fillStyle = photo ? "rgba(18,18,21,0.66)" : "rgba(18,18,21,0.88)";
  roundRect(ctx, cardX, cardY, cardW, cardH, 40);
  ctx.fill();
  ctx.strokeStyle = photo ? "rgba(255,255,255,0.12)" : LINE;
  ctx.lineWidth = 2;
  ctx.stroke();

  const accent = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY);
  accent.addColorStop(0, ACCENT);
  accent.addColorStop(1, "rgba(252,76,2,0)");
  ctx.fillStyle = accent;
  ctx.fillRect(cardX, cardY, cardW, 5);

  const isWalk = Boolean(selectedWalk);
  const label = isWalk
    ? "WALK LOG · WALK DETAIL"
    : `WALK LOG · ${(data.month.label ?? "").toUpperCase()}`;

  const kickerY = cardY + 74;
  drawText(ctx, label, cardX + p, kickerY, { size: 26, weight: 700, family: mono, color: MUTED });
  const contextText = isWalk && selectedWalk
    ? shortDate(selectedWalk.startLocal)
    : `${data.month.walkCount} walks`;
  drawText(ctx, contextText, cardX + cardW - p, kickerY, {
    size: 26,
    weight: 500,
    family: mono,
    color: photo ? "#e4e4e7" : MUTED,
    align: "right",
  });

  const numberSize = 150;
  const numberY = cardY + 264;
  const meters = isWalk && selectedWalk ? selectedWalk.distanceM : data.month.distanceM;
  const numberWidth = drawText(ctx, km(meters), cardX + p, numberY, {
    size: numberSize,
    weight: 900,
    family: sans,
    color: TEXT,
  });
  drawText(ctx, "km", cardX + p + numberWidth + 22, numberY, {
    size: 60,
    weight: 800,
    family: sans,
    color: ACCENT,
  });

  const statLabelY = cardY + 336;
  const statValueY = cardY + 398;
  const statGap = 44;
  const statWidth = (cardW - 2 * p - 2 * statGap) / 3;
  const stats = isWalk && selectedWalk
    ? [
        { label: "DURATION", value: formatSeconds(selectedWalk.movingTimeS) },
        {
          label: "PACE",
          value: paceText(selectedWalk.movingTimeS / (selectedWalk.distanceM / 1000)),
        },
        { label: "POINTS", value: `+${selectedPoints}` },
      ]
    : [
        { label: "WALKS", value: String(data.month.walkCount) },
        { label: "DURATION", value: formatSeconds(data.month.movingTimeS) },
        { label: "AVG PACE", value: paceText(data.month.avgPaceSecPerKm) },
      ];

  stats.forEach((stat, index) => {
    const x = cardX + p + index * (statWidth + statGap);
    drawText(ctx, stat.label, x, statLabelY, { size: 24, weight: 600, family: mono, color: MUTED });
    drawText(ctx, stat.value, x, statValueY, { size: 48, weight: 700, family: sans, color: TEXT });
  });

  if (route && route.points.length >= 2) {
    drawRoutePanel(ctx, { ...route, labelFont: mono }, width, height);
  }

  const footerY = height - 26;
  drawText(ctx, "WALK LOG · MANUAL", cardX, footerY, {
    size: 26,
    weight: 600,
    family: mono,
    color: photo ? "#e4e4e7" : "#71717a",
  });
  drawText(ctx, shortDate(new Date().toISOString()), width - cardX, footerY, {
    size: 26,
    weight: 500,
    family: mono,
    color: photo ? "#e4e4e7" : "#71717a",
    align: "right",
  });

  if (sticker) {
    const rect = stickerRect(
      {
        canvasWidth: width,
        canvasHeight: height,
        scale: sticker.scale,
        cx: sticker.cx,
        cy: sticker.cy,
      },
      sticker.img,
    );
    ctx.drawImage(sticker.img, rect.x, rect.y, rect.width, rect.height);
  }

  ctx.restore();
}

function km(meters: number): string {
  return (meters / 1000).toFixed(1);
}

function formatSeconds(seconds: number): string {
  const total = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function paceText(secondsPerKm: number): string {
  const total = Math.max(0, Math.round(secondsPerKm));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}'${String(seconds).padStart(2, "0")}"/km`;
}

function shortDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (!year || !month || !day) return iso.slice(0, 10);
  return `${day} ${months[month - 1]}`;
}
