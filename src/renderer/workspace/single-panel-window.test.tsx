// @vitest-environment jsdom
/**
 * Tests for SinglePanelWindow — the root mounted inside a detached panel's
 * BrowserWindow. Covers the lookup → render path, the unknown-id fallback,
 * and that the close button calls the window-control bridge.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { ComponentType } from "react";
import { SinglePanelWindow } from "./single-panel-window.js";
import { panelRegistry } from "./registry.js";
import type { PanelProps } from "./types.js";

/* ------------------------------------------------------------------ */
/*  Mock window.artworks.window (preload bridge) — partial cast.      */
/* ------------------------------------------------------------------ */
const mockClose = vi.fn();

beforeEach(() => {
  mockClose.mockReset();
  (window as unknown as { artworks: { window: { close: typeof mockClose } } }).artworks = {
    window: { close: mockClose },
  };
});

afterEach(() => {
  cleanup();
});

/** A throwaway panel id so the test doesn't depend on the built-in registry. */
const TEST_PANEL_ID = "__single-panel-window-test__";

/** Register (or re-register) a fake panel for the test id. */
function registerFakePanel(): void {
  // The registry throws on duplicate id; clear by reaching into the private
  // map via the public surface we have. Easiest: use a fresh id per call by
  // bumping a counter, but a stable id is more readable — so we recreate the
  // registry's entry by first checking.
  if (panelRegistry.has(TEST_PANEL_ID)) return;
  const Fake: ComponentType<PanelProps> = () => <div data-testid="fake-panel-body">fake panel content</div>;
  panelRegistry.register({
    id: TEST_PANEL_ID,
    title: "Fake Panel",
    icon: "🧪",
    component: Fake,
    defaultSlot: "center",
    defaultVisible: true,
  });
}

describe("SinglePanelWindow", () => {
  it("renders the registered panel inside the minimal frame", () => {
    registerFakePanel();
    render(<SinglePanelWindow panelId={TEST_PANEL_ID} />);
    // Title strip shows the panel's title + icon.
    expect(screen.getByText("Fake Panel")).toBeTruthy();
    // The panel component itself is mounted.
    expect(screen.getByTestId("fake-panel-body").textContent).toBe("fake panel content");
  });

  it("passes isActive=true to the mounted panel", () => {
    let seen: boolean | undefined;
    const Probe: ComponentType<PanelProps> = (props) => {
      seen = props.isActive;
      return <div data-testid="probe" />;
    };
    const id = "__probeIsActive__";
    if (!panelRegistry.has(id)) {
      panelRegistry.register({
        id, title: "Probe", icon: "", component: Probe,
        defaultSlot: "center", defaultVisible: true,
      });
    }
    render(<SinglePanelWindow panelId={id} />);
    expect(seen).toBe(true);
  });

  it("shows an 'Unknown panel' fallback for an unregistered id", () => {
    render(<SinglePanelWindow panelId="does-not-exist-xyz" />);
    expect(screen.getByText(/Unknown panel/)).toBeTruthy();
    expect(screen.getByText(/does-not-exist-xyz/)).toBeTruthy();
  });

  it("calls the window-control bridge when the close button is clicked", () => {
    registerFakePanel();
    render(<SinglePanelWindow panelId={TEST_PANEL_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Close window" }));
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
