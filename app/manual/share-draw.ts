import type { DashboardData, WalkSession } from "@/lib/strava/types";

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

const BG = "#09090b";
const PANEL = "#121215";
const LINE = "rgba(255,255,255,0.08)";
const TEXT = "#f4f4f5";
const MUTED = "#a1a1aa";
const ACCENT = "#f97316";
const PALE_ACCENT = "#fb923c";

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

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }

  if (line) lines.push(line);
  return lines.slice(0, 2);
}

export function drawShareImage(
  ctx: CanvasRenderingContext2D,
  options: ShareDrawOptions,
): void {
  const { width, height, data, selectedWalk, selectedPoints, photo, sticker, fonts } = options;
  const sans = fonts.sans;
  const mono = fonts.mono;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  if (photo) {
    const fit = coverFit(photo.width, photo.height, width, height);
    ctx.drawImage(photo, fit.x, fit.y, fit.width, fit.height);
    const overlay = ctx.createLinearGradient(0, 0, 0, height);
    overlay.addColorStop(0, "rgba(9,9,11,0.15)");
    overlay.addColorStop(0.45, "rgba(9,9,11,0.45)");
    overlay.addColorStop(1, "rgba(9,9,11,0.92)");
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, width, height);
    drawText(ctx, "WALK LOG", 48, 64, { size: 30, weight: 700, family: mono, color: "#e4e4e7" });
  } else {
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#18181c");
    bg.addColorStop(1, BG);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    const glow = ctx.createRadialGradient(width * 0.2, height * 0.12, 0, width * 0.2, height * 0.12, width * 0.6);
    glow.addColorStop(0, "rgba(255,85,0,0.2)");
    glow.addColorStop(1, "rgba(255,85,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  const cardX = 48;
  const cardW = width - 96;
  const cardH = height === 1920 ? 820 : 780;
  const cardY = height - 52 - cardH;
  const p = 52;

  ctx.fillStyle = photo ? "rgba(18,18,21,0.94)" : PANEL;
  roundRect(ctx, cardX, cardY, cardW, cardH, 40);
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.stroke();

  const line = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY);
  line.addColorStop(0, ACCENT);
  line.addColorStop(0.5, "#fb923c");
  line.addColorStop(1, "rgba(255,85,0,0)");
  ctx.fillStyle = line;
  ctx.fillRect(cardX, cardY, cardW, 6);

  const isWalk = Boolean(selectedWalk);
  const label = isWalk
    ? `WALK LOG · WALK DETAIL`
    : `WALK LOG · ${(data.month.label ?? "").toUpperCase()}`;

  const kickerY = cardY + 80;
  drawText(ctx, label, cardX + p, kickerY, {
    size: 30,
    weight: 700,
    family: mono,
    color: MUTED,
  });

  const numberSize = 220;
  const numberY = cardY + 352;
  const numberText = formatDistanceText(isWalk ? selectedWalk : null, data);
  const numberWidth = drawText(ctx, numberText, cardX + p, numberY, {
    size: numberSize,
    weight: 900,
    family: sans,
    color: TEXT,
  });
  drawText(ctx, "km", cardX + p + numberWidth + 28, numberY, {
    size: 88,
    weight: 800,
    family: sans,
    color: ACCENT,
  });

  const statLabelY = cardY + 430;
  const statValueY = cardY + 492;
  const statGap = 48;
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
    drawText(ctx, stat.label, x, statLabelY, { size: 26, weight: 600, family: mono, color: MUTED });
    drawText(ctx, stat.value, x, statValueY, { size: 56, weight: 700, family: sans, color: TEXT });
  });

  const subY = cardY + 556;
  const avgWalk = data.month.walkCount > 0 ? data.month.distanceM / data.month.walkCount : 0;

  if (isWalk && selectedWalk) {
    const delta = selectedWalk.distanceM - avgWalk;
    drawText(
      ctx,
      `${delta >= 0 ? "+" : "-"}${km(Math.abs(delta))} km vs avg ${km(avgWalk)} km/walk`,
      cardX + p,
      subY,
      { size: 32, weight: 600, family: mono, color: MUTED },
    );
  } else {
    drawText(
      ctx,
      `avg ${km(avgWalk)} km/walk · longest ${km(longestOf(data))} km`,
      cardX + p,
      subY,
      { size: 32, weight: 600, family: mono, color: MUTED },
    );
  }

  const sessions = data.sessions.slice(0, 6).reverse();
  const chartTop = cardY + 604;
  const chartHeight = 128;
  const chartMax = sessions.reduce((top, walk) => Math.max(top, walk.distanceM), 0) || 1;
  const chartAvg = sessions.length
    ? sessions.reduce((sum, walk) => sum + walk.distanceM, 0) / sessions.length
    : 0;
  const barGap = 16;
  const barWidth = (cardW - 2 * p - barGap * (sessions.length - 1)) / Math.max(1, sessions.length);

  if (sessions.length > 0) {
    const avgLineY = chartTop + chartHeight - (chartAvg / chartMax) * chartHeight;
    ctx.setLineDash([16, 16]);
    ctx.strokeStyle = "rgba(255,85,0,0.4)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cardX + p, avgLineY);
    ctx.lineTo(cardX + p + sessions.length * (barWidth + barGap) - barGap, avgLineY);
    ctx.stroke();
    ctx.setLineDash([]);

    sessions.forEach((walk, index) => {
      const x = cardX + p + index * (barWidth + barGap);
      const barHeight = Math.max(24, (walk.distanceM / chartMax) * chartHeight);
      const barY = chartTop + chartHeight - barHeight;
      const latest = index === sessions.length - 1;

      ctx.fillStyle = latest
        ? "rgba(255,85,0,0.85)"
        : "rgba(255,255,255,0.08)";
      roundRect(ctx, x, barY, barWidth, barHeight, 8);
      ctx.fill();
      if (latest) {
        ctx.strokeStyle = "rgba(255,85,0,0.9)";
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      drawText(ctx, km(walk.distanceM), x + barWidth / 2, barY - 14, {
        size: 24,
        weight: 600,
        family: mono,
        color: latest ? ACCENT : MUTED,
        align: "center",
      });
      drawText(ctx, shortDate(walk.startLocal), x + barWidth / 2, chartTop + chartHeight + 36, {
        size: 24,
        weight: 500,
        family: mono,
        color: MUTED,
        align: "center",
      });
    });
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
      { canvasWidth: width, canvasHeight: height, scale: sticker.scale, cx: sticker.cx, cy: sticker.cy },
      sticker.img,
    );
    ctx.drawImage(sticker.img, rect.x, rect.y, rect.width, rect.height);
  }

  ctx.restore();
}

function formatDistanceText(walk: WalkSession | null, data: DashboardData): string {
  const meters = walk ? walk.distanceM : data.month.distanceM;
  return km(meters);
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

function longestOf(data: DashboardData): number {
  return data.records.longestMonthM;
}
