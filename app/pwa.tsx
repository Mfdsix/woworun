"use client";

import { useEffect, useState } from "react";

export function Pwa() {
  const [waiting, setWaiting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let active = true;
    let cleanup: (() => void) | undefined;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (!active) return;
        if (registration.waiting) setWaiting(true);

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              setWaiting(true);
            }
          });
        });

        const onControllerChange = () => {
          if (registration.waiting) setWaiting(true);
        };
        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
        cleanup = () => {
          navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
        };
      })
      .catch(() => {
        // Service workers unavailable (private mode / insecure context).
      });

    return () => {
      active = false;
      cleanup?.();
    };
  }, []);

  async function reload() {
    setDismissed(true);
    const registration = await navigator.serviceWorker.getRegistration();
    const worker = registration?.waiting;

    if (!worker) {
      window.location.reload();
      return;
    }

    worker.postMessage({ type: "SKIP_WAITING" });
    worker.addEventListener("statechange", () => {
      if (worker.state === "activated") window.location.reload();
    });
  }

  if (!waiting || dismissed) return null;

  return (
    <div className="update-banner" role="status">
      <span>Update available.</span>
      <button className="footer-link" type="button" onClick={reload}>
        Reload
      </button>
    </div>
  );
}
