"use client";

export default function OfflinePage() {
  return (
    <main className="screen">
      <div className="pin-card">
        <p className="brand">Walk Log</p>
        <h1 className="heading">You&apos;re offline</h1>
        <p className="sub">
          Saved activities are still in this browser. Reconnect to load a fresh page, or reopen the
          app once you&apos;re back online.
        </p>
        <button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    </main>
  );
}
