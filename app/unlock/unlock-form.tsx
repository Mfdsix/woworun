"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const PIN_LENGTH = 6;

function sanitizePin(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function UnlockForm() {
  const router = useRouter();
  const [chars, setChars] = useState<string[]>(() => Array(PIN_LENGTH).fill(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [shaking, setShaking] = useState(false);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const busyRef = useRef(false);
  const lastAutoPin = useRef<string | null>(null);
  const resetTimer = useRef<number | null>(null);

  const pin = chars.join("");

  const focusInput = useCallback((index: number) => {
    const target = inputRefs.current[Math.max(0, Math.min(PIN_LENGTH - 1, index))];
    target?.focus();
    target?.select();
  }, []);

  const clearResetTimer = useCallback(() => {
    if (resetTimer.current !== null) {
      window.clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
  }, []);

  useEffect(() => {
    focusInput(0);
    return () => {
      clearResetTimer();
    };
  }, [clearResetTimer, focusInput]);

  const submit = useCallback(
    async (value: string, confirm: boolean) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setError(null);

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pin: value, ...(confirm ? { confirm: true } : {}) }),
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
            setChars(Array(PIN_LENGTH).fill(""));
            setShaking(false);
            focusInput(0);
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
    [clearResetTimer, focusInput, router],
  );

  useEffect(() => {
    if (needsConfirm || busy) return;

    if (pin.length !== PIN_LENGTH) {
      lastAutoPin.current = null;
      return;
    }

    if (lastAutoPin.current === pin) return;
    lastAutoPin.current = pin;
    void submit(pin, false);
  }, [busy, needsConfirm, pin, submit]);

  function writeAt(index: number, raw: string) {
    const clean = sanitizePin(raw);

    setChars((current) => {
      const next = [...current];
      if (!clean) {
        next[index] = "";
        return next;
      }
      for (let offset = 0; offset < clean.length && index + offset < PIN_LENGTH; offset += 1) {
        next[index + offset] = clean[offset];
      }
      return next;
    });

    focusInput(index + Math.max(0, clean.length));
  }

  function handleChange(index: number, event: React.ChangeEvent<HTMLInputElement>) {
    writeAt(index, event.target.value);
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      if (chars[index]) {
        event.preventDefault();
        setChars((current) => {
          const next = [...current];
          next[index] = "";
          return next;
        });
      } else if (index > 0) {
        event.preventDefault();
        setChars((current) => {
          const next = [...current];
          next[index - 1] = "";
          return next;
        });
        focusInput(index - 1);
      }
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusInput(index - 1);
    }

    if (event.key === "ArrowRight" && index < PIN_LENGTH - 1) {
      event.preventDefault();
      focusInput(index + 1);
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const clean = sanitizePin(event.clipboardData.getData("text")).slice(0, PIN_LENGTH);
    setChars(Array.from({ length: PIN_LENGTH }, (_, index) => clean[index] ?? ""));
    focusInput(clean.length);
  }

  function handleConfirm() {
    void submit(pin, true);
  }

  function handleCancel() {
    setNeedsConfirm(false);
    setError(null);
    setChars(Array(PIN_LENGTH).fill(""));
    lastAutoPin.current = null;
    focusInput(0);
  }

  return (
    <main className="screen">
      <div className={`pin-card${shaking ? " shake" : ""}`}>
        <p className="brand">Walk Log</p>
        <h1 className="heading">Unlock</h1>
        <p className="sub">Enter your 6-character PIN.</p>

        <div className="pin-slots" dir="ltr">
          {chars.map((char, index) => (
            <input
              key={index}
              ref={(element) => {
                inputRefs.current[index] = element;
              }}
              className={`pin-slot${char ? " is-filled" : ""}`}
              dir="ltr"
              value={char}
              onChange={(event) => handleChange(index, event)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              onPaste={handlePaste}
              type="text"
              inputMode="text"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={1}
              aria-label={`PIN character ${index + 1}`}
              disabled={busy}
            />
          ))}
        </div>

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
              <button className="btn btn-ghost" type="button" onClick={handleCancel} disabled={busy}>
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
