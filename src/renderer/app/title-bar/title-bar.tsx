/**
 * Title bar.
 *
 * The custom application chrome for a frameless window. The whole bar is a
 * drag region (-webkit-app-region: drag); the window-control buttons opt
 * back out (no-drag) so clicks register. On macOS the native traffic lights
 * provide minimize/maximize/close at the leading edge, so we paint no
 * custom controls there; on Windows/Linux the full set (minimize /
 * maximize-restore / close) lives on the trailing edge.
 */
import { useEffect, useState, type ReactNode } from "react";
import { PRODUCT_NAME } from "@shared/utils/index.js";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  // Seed the maximize state and subscribe to OS-driven changes.
  useEffect(() => {
    let active = true;
    void window.artworks.window.isMaximized().then((value) => {
      if (active) setMaximized(value);
    });
    const unsubscribe = window.artworks.window.onMaximizedChanged((value) => {
      setMaximized(value);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return (
    <header className={`title-bar${isMac ? " title-bar--mac" : ""}`} role="banner">
      <div className="title-bar__brand">
        {/* mac reserves leading space for the traffic lights; others get the mark. */}
        {!isMac && (
          <span className="title-bar__mark" aria-hidden="true">
            ◆
          </span>
        )}
        <span className="title-bar__title">{PRODUCT_NAME}</span>
      </div>

      <div className="title-bar__spacer" />

      {!isMac && (
        <div className="title-bar__controls">
          <TitleBarButton label="Minimize" onClick={() => window.artworks.window.minimize()}>
            <MinimizeIcon />
          </TitleBarButton>
          <TitleBarButton
            label={maximized ? "Restore" : "Maximize"}
            onClick={() => window.artworks.window.toggleMaximize()}
          >
            {maximized ? <RestoreIcon /> : <MaximizeIcon />}
          </TitleBarButton>
          <TitleBarButton
            label="Close"
            variant="close"
            onClick={() => window.artworks.window.close()}
          >
            <CloseIcon />
          </TitleBarButton>
        </div>
      )}
    </header>
  );
}

interface TitleBarButtonProps {
  label: string;
  onClick: () => void;
  variant?: "default" | "close";
  children: ReactNode;
}

function TitleBarButton({ label, onClick, variant = "default", children }: TitleBarButtonProps) {
  return (
    <button
      type="button"
      className={`title-bar__btn${variant === "close" ? " title-bar__btn--close" : ""}`}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// --- inline icons (line-based, per the design system) ---------------------

function MinimizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M0 5 H10" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <rect
        x="0.5"
        y="0.5"
        width="9"
        height="9"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <rect
        x="0.5"
        y="2.5"
        width="6"
        height="6"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />
      <path d="M2.5 2.5 V0.5 H8.5 V6.5 H6.5" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M0 0 L10 10 M10 0 L0 10" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
