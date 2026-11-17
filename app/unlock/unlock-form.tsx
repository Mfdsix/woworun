"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const PIN_LENGTH = 6;

function sanitizePin(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, PIN_LENGTH);
}

export function UnlockForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [shaking, setShaking] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const busyRef = useRef(false);
  const lastAutoPin = useRef<string | null>(null);
  const resetTimer = useRef<number | null>(null);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const clearResetTimer = useCallback(() => {
    if (resetTimer.current !== null) {
      window.clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
  }, []);

  useEffect(() => {
    focusInput();
    return () => {
      clearResetTimer();
    };
  }, [clearResetTimer, focusInput]);

  const submit = useCallback(
    async (pin: string, confirm: boolean) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setError(null);

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pin, ...(confirm ? { confirm: true } : {}) }),
        });

        if (response.status === 200) {
          router.replace("/");
          router.refresh();
          return;
        }

        if (response.status === 202) {
          setNeedsConfirm(true);
          return;
        }

        if (response.status === 401) {
          setError("Wrong PIN.");
          setShaking(true);
          lastAutoPin.current = null;
          clearResetTimer();
          resetTimer.current = window.setTimeout(() => {
            setValue("");
            setShaking(false);
            resetTimer.current = null;
          }, 600);
          return;
        }

        if (response.status === 409) {
          setError("App is full.");
          return;
        }

        if (response.status === 429) {
          setError("Too many attempts. Try again later.");
          return;
        }

        setError("Something went wrong. Try again.");
      } catch {
        setError("Network error. Try again.");
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [clearResetTimer, router],
  );

  useEffect(() => {
    if (needsConfirm) return;

    if (value.length !== PIN_LENGTH) {
      lastAutoPin.current = null;
      return;
    }

    if (lastAutoPin.current === value) return;
    lastAutoPin.current = value;
    void submit(value, false);
  }, [needsConfirm, submit, value]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    setValue(sanitizePin(event.target.value));
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    setValue(sanitizePin(event.clipboardData.getData("text")));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && value.length === 0) {
      event.preventDefault();
    }
  }

  function handleConfirm() {
    void submit(value, true);
  }

  function handleCancel() {
    setNeedsConfirm(false);
    setError(null);
    setValue("");
    lastAutoPin.current = null;
    focusInput();
  }

  return (
    <main className="screen">
      <div className={`pin-card${shaking ? " shake" : ""}`}>
        <p className="brand">Walk Log</p>
        <h1 className="heading">Unlock</h1>
        <p className="sub">Enter your 6-character PIN.</p>

        <div className="pin-slots" dir="ltr" onClick={focusInput}>
          {Array.from({ length: PIN_LENGTH }).map((_, index) => (
            <div
              key={index}
              className={`pin-slot${value.length > index ? " is-filled" : ""}`}
            >
              {value[index] ?? ""}
            </div>
          ))}
        </div>

        <input
          ref={inputRef}
          className="pin-input"
          dir="ltr"
          value={value}
          onChange={handleChange}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          type="text"
          inputMode="text"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={PIN_LENGTH}
          aria-label="PIN"
          disabled={busy}
        />

        {needsConfirm ? (
          <div className="confirm-panel">
            <p className="sub">This PIN has no space yet. Create a new space?</p>
            <div className="actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={handleConfirm}
                disabled={busy}
              >
                Create space
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={handleCancel}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}

        <p className="hint">
          Your PIN is your only key. Anyone with it can open this dashboard.
        </p>
      </div>
    </main>
  );
}
