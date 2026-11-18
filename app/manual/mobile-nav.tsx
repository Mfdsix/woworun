"use client";

import type { ReactNode } from "react";

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M10 21v-6h4v6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="17" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
      <path d="M10 17l-5-5 5-5" />
      <path d="M5 12h11" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function MobileNav({
  open,
  walkCount,
  points,
  onToggle,
  onHome,
  onCalendar,
  onAdd,
  onClear,
  onClose,
}: {
  open: boolean;
  walkCount: number;
  points: number;
  onToggle: () => void;
  onHome: () => void;
  onCalendar: () => void;
  onAdd: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <button
        className="mobile-bar"
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={onToggle}
      >
        <MenuIcon />
        <span>Menus</span>
      </button>

      {open && (
        <div
          className="mobile-sheet-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <div className="mobile-sheet" role="menu" aria-label="Main menu">
            <div className="mobile-sheet-grip" />
            <div className="mobile-sheet-head">
              <span className="wl-kicker">Walk Log</span>
              <span className="mobile-sheet-summary">
                {walkCount} walks · {points} pts · PIN synced
              </span>
            </div>

            <button className="mobile-menu-item" type="button" onClick={onHome}>
              <HomeIcon />
              <span>
                Home
                <small>Month overview</small>
              </span>
            </button>
            <button className="mobile-menu-item" type="button" onClick={onCalendar}>
              <CalendarIcon />
              <span>
                Calendar
                <small>Pick a day</small>
              </span>
            </button>
            <button className="mobile-menu-item" type="button" onClick={onAdd}>
              <PlusIcon />
              <span>
                Add new
                <small>Log a walk</small>
              </span>
            </button>
            <form action="/api/auth/logout" method="post" className="mobile-menu-item-form">
              <button className="mobile-menu-item" type="submit">
                <LogoutIcon />
                <span>
                  Logout
                  <small>End session</small>
                </span>
              </button>
            </form>

            <div className="mobile-sheet-divider" />
            <button className="mobile-menu-item is-danger" type="button" onClick={onClear}>
              <TrashIcon />
              <span>
                Clear all
                <small>Delete every walk</small>
              </span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function MobileSheetHeader({
  kicker,
  onBack,
  children,
}: {
  kicker: string;
  onBack: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="mobile-overlay-head">
      <span className="wl-kicker">{kicker}</span>
      <button
        className="wl-home"
        type="button"
        aria-label="Close"
        onClick={onBack}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      {children}
    </div>
  );
}
