"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampRange,
  coverFit,
  drawShareImage,
  shareCanvasSize,
  shareFileName,
  stickerRect,
  type ShareStickerLayer,
} from "./share-draw";
import type { DashboardData, WalkSession } from "@/lib/strava/types";

type Format = "4:5" | "9:16";

const FORMATS: Record<Format, { width: number; height: number; label: string }> = {
  "4:5": { width: 1080, height: 1350, label: "4:5 post" },
  "9:16": { width: 1080, height: 1920, label: "9:16 story" },
};

function todayInJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

type PhotoLayer = { img: HTMLImageElement; url: string };
type StickerLayer = ShareStickerLayer & { url: string };

export function ShareSheet({
  data,
  selectedWalk,
  selectedPoints,
  onClose,
}: {
  data: DashboardData;
  selectedWalk: WalkSession | null;
  selectedPoints: number;
  onClose: () => void;
}) {
  const [format, setFormat] = useState<Format>("4:5");
  const [photo, setPhoto] = useState<PhotoLayer | null>(null);
  const [sticker, setSticker] = useState<StickerLayer | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoRearRef = useRef<HTMLInputElement>(null);
  const photoUserRef = useRef<HTMLInputElement>(null);
  const stickerRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; cx: number; cy: number } | null>(null);

  const { width, height } = shareCanvasSize(format);

  useEffect(() => {
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) setFontsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const kicker = document.querySelector(".wl-kicker") ?? document.body;
    const fonts = {
      sans: getComputedStyle(document.body).fontFamily,
      mono: getComputedStyle(kicker).fontFamily,
    };

    drawShareImage(ctx, {
      width,
      height,
      data,
      selectedWalk,
      selectedPoints,
      photo: photo?.img ?? null,
      sticker: sticker
        ? { img: sticker.img, cx: sticker.cx, cy: sticker.cy, scale: sticker.scale }
        : null,
      fonts,
    });
  }, [data, format, fontsReady, photo, selectedPoints, selectedWalk, sticker, width, height]);

  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.url);
      if (sticker) URL.revokeObjectURL(sticker.url);
    };
  }, [photo, sticker]);

  const loadFile = useCallback((file: File | undefined, kind: "photo" | "sticker") => {
    if (!file) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (kind === "photo") {
        setPhoto((current) => {
          if (current) URL.revokeObjectURL(current.url);
          return { img, url };
        });
        setToast("Photo added.");
      } else {
        setSticker((current) => {
          if (current) URL.revokeObjectURL(current.url);
          return { img, url, cx: 0.5, cy: 0.72, scale: 0.34 };
        });
        setToast("Sticker added. Drag it on the image, resize below.");
      }
      setError(null);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError("Could not load that file.");
    };
    img.src = url;
  }, []);

  function removePhoto() {
    setPhoto((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  function removeSticker() {
    setSticker((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!sticker || !canvasRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px =
      (event.clientX - rect.left) * (canvasRef.current.width / rect.width);
    const py =
      (event.clientY - rect.top) * (canvasRef.current.height / rect.height);
    const rectSticker = stickerRect(
      {
        canvasWidth: canvasRef.current.width,
        canvasHeight: canvasRef.current.height,
        scale: sticker.scale,
        cx: sticker.cx,
        cy: sticker.cy,
      },
      sticker.img,
    );

    if (
      px >= rectSticker.x &&
      px <= rectSticker.x + rectSticker.width &&
      py >= rectSticker.y &&
      py <= rectSticker.y + rectSticker.height
    ) {
      dragRef.current = { startX: px, startY: py, cx: sticker.cx, cy: sticker.cy };
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag || !canvasRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx =
      (event.clientX - rect.left) * (canvasRef.current.width / rect.width) - drag.startX;
    const dy =
      (event.clientY - rect.top) * (canvasRef.current.height / rect.height) - drag.startY;

    setSticker((current) =>
      current
        ? {
            ...current,
            cx: clampRange(drag.cx + dx / canvasRef.current!.width, 0.05, 0.95),
            cy: clampRange(drag.cy + dy / canvasRef.current!.height, 0.05, 0.95),
          }
        : current,
    );
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    canvas.toBlob((blob) => {
      setBusy(false);
      if (!blob) {
        setError("Could not export the image.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = shareFileName(todayInJakarta(), format);
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      setToast("Image downloaded.");
    }, "image/png");
  }

  async function nativeShare() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    setBusy(false);
    if (!blob) return;

    const file = new File([blob], shareFileName(todayInJakarta(), format), {
      type: "image/png",
    });
    const nav = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
    };

    if (typeof nav.canShare === "function" && nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: "Walk Log" });
        setToast("Shared.");
      } catch {
        // user cancelled
      }
    } else {
      download();
    }
  }

  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
  const canShareFiles =
    typeof nav.canShare === "function" &&
    nav.canShare({ files: [new File([new Blob()], "t.png", { type: "image/png" })] });

  return (
    <div className="share-backdrop">
      <div className="share-sheet">
        <div className="share-head">
          <div>
            <span className="wl-kicker">Share</span>
            <h2 className="share-title">
              {selectedWalk ? `Walk: ${selectedWalk.name}` : "Month overview"}
            </h2>
          </div>
          <button className="wl-btn wl-btn-ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <canvas
          ref={canvasRef}
          className="share-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />

        <div className="wl-tabs" role="tablist" aria-label="Image size">
          {(Object.keys(FORMATS) as Format[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={format === key}
              className={format === key ? "is-active" : ""}
              onClick={() => setFormat(key)}
            >
              {FORMATS[key].label}
            </button>
          ))}
        </div>

        <div className="share-toolbar">
          <button
            className="wl-btn wl-btn-ghost"
            type="button"
            onClick={() => stickerRef.current?.click()}
          >
            Upload sticker
          </button>
          <button
            className="wl-btn wl-btn-ghost"
            type="button"
            onClick={() => photoRearRef.current?.click()}
          >
            Rear camera
          </button>
          <button
            className="wl-btn wl-btn-ghost"
            type="button"
            onClick={() => photoUserRef.current?.click()}
          >
            Selfie
          </button>
          {photo && (
            <button className="wl-btn wl-btn-ghost" type="button" onClick={removePhoto}>
              Remove photo
            </button>
          )}
          {sticker && (
            <button className="wl-btn wl-btn-ghost" type="button" onClick={removeSticker}>
              Remove sticker
            </button>
          )}
        </div>

        {sticker && (
          <div className="share-row">
            <span className="wl-kicker">Sticker size</span>
            <input
              className="share-slider"
              type="range"
              min={0.08}
              max={0.7}
              step={0.01}
              value={sticker.scale}
              onChange={(event) =>
                setSticker((current) =>
                  current ? { ...current, scale: Number(event.target.value) } : current,
                )
              }
            />
          </div>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="share-row">
          <button className="wl-btn wl-btn-accent" type="button" onClick={download} disabled={busy}>
            Download PNG
          </button>
          {canShareFiles && (
            <button className="wl-btn wl-btn-ghost" type="button" onClick={nativeShare} disabled={busy}>
              Share
            </button>
          )}
        </div>

        <p className="share-hint">
          Sticker and photo stay in this browser — nothing is uploaded. Drag the sticker on the
          image to move it.
        </p>

        <input
          ref={stickerRef}
          type="file"
          accept="image/png,image/webp,image/jpeg"
          className="share-file"
          onChange={(event) => loadFile(event.target.files?.[0], "sticker")}
        />
        <input
          ref={photoRearRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="share-file"
          onChange={(event) => loadFile(event.target.files?.[0], "photo")}
        />
        <input
          ref={photoUserRef}
          type="file"
          accept="image/*"
          capture="user"
          className="share-file"
          onChange={(event) => loadFile(event.target.files?.[0], "photo")}
        />
      </div>
    </div>
  );
}
