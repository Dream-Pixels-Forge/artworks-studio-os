// @vitest-environment jsdom
/**
 * Tests for workspace-state — the layout model + persistence (#5).
 * Covers defaultWorkspaceRoot, migrateLegacy, reconcile, and load/save round-trip.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  defaultWorkspaceRoot,
  migrateLegacy,
  reconcile,
  loadLayout,
  saveLayout,
  togglePanel,
  setActivePanel,
} from "./workspace-state.js";
import type { LayoutNode, PanelDefinition, LegacyWorkspaceLayoutState } from "./types.js";

/** A small fake registry for deterministic tests. */
const FAKE_REGISTRY: PanelDefinition[] = [
  { id: "explorer", title: "Explorer", icon: "📁", component: () => null, defaultSlot: "left", defaultVisible: true },
  { id: "welcome", title: "Welcome", icon: "👋", component: () => null, defaultSlot: "center", defaultVisible: true },
  { id: "assets", title: "Assets", icon: "🎨", component: () => null, defaultSlot: "right", defaultVisible: true },
  { id: "timeline", title: "Timeline", icon: "⏱", component: () => null, defaultSlot: "bottom", defaultVisible: true },
  { id: "hidden", title: "Hidden", icon: "🚫", component: () => null, defaultSlot: "left", defaultVisible: false },
];

beforeEach(() => {
  localStorage.clear();
});

describe("defaultWorkspaceRoot", () => {
  it("builds a tree containing the defaultVisible panels", () => {
    const root = defaultWorkspaceRoot(FAKE_REGISTRY);
    const ids = collectPanelIds(root);
    expect(ids).toContain("explorer");
    expect(ids).toContain("welcome");
    expect(ids).toContain("assets");
    expect(ids).toContain("timeline");
    // Non-visible panel is not in the default.
    expect(ids).not.toContain("hidden");
  });

  it("always includes a center panel even when none are defaultVisible", () => {
    const noVisible: PanelDefinition[] = [
      { id: "x", title: "X", icon: "", component: () => null, defaultSlot: "center", defaultVisible: false },
    ];
    const root = defaultWorkspaceRoot(noVisible);
    expect(collectPanelIds(root)).toContain("x");
  });
});

describe("migrateLegacy", () => {
  it("returns null for an empty legacy state", () => {
    expect(migrateLegacy(null)).toBeNull();
    expect(migrateLegacy({ slots: {}, active: {} })).toBeNull();
  });

  it("translates a flat {slots, active} blob into a tree", () => {
    const legacy: LegacyWorkspaceLayoutState = {
      slots: { left: ["explorer"], center: ["welcome"], right: ["assets"] },
      active: { left: "explorer", center: "welcome" },
    };
    const root = migrateLegacy(legacy)!;
    expect(root).not.toBeNull();
    const ids = collectPanelIds(root);
    expect(ids).toEqual(expect.arrayContaining(["explorer", "welcome", "assets"]));
  });

  it("preserves the active panel per slot in the migrated tab nodes", () => {
    const legacy: LegacyWorkspaceLayoutState = {
      slots: { center: ["welcome", "dashboard"] },
      active: { center: "dashboard" },
    };
    const root = migrateLegacy(legacy)!;
    // Find the center tab node and check its activeIndex points to dashboard.
    const center = findTabBySlot(root, "center")!;
    expect(center).toBeTruthy();
    expect(center.panels[center.activeIndex]).toBe("dashboard");
  });

  it("includes a bottom strip when legacy has bottom panels", () => {
    const legacy: LegacyWorkspaceLayoutState = {
      slots: { center: ["welcome"], bottom: ["timeline"] },
      active: {},
    };
    const root = migrateLegacy(legacy)!;
    expect(root.type).toBe("split"); // column split: [center, bottom]
    expect(collectPanelIds(root)).toContain("timeline");
  });
});

describe("reconcile", () => {
  it("drops panel ids no longer in the registry", () => {
    const root: LayoutNode = {
      id: "s",
      type: "split",
      direction: "row",
      sizes: [0.5, 0.5],
      children: [
        { id: "g1", type: "tab", slot: "center", panels: ["welcome", "ghost"], activeIndex: 0 },
        { id: "g2", type: "tab", slot: "right", panels: ["assets"], activeIndex: 0 },
      ],
    };
    const result = reconcile(root, FAKE_REGISTRY)!;
    expect(collectPanelIds(result)).not.toContain("ghost");
    expect(collectPanelIds(result)).toContain("welcome");
  });

  it("dedupes a panel that appears in two groups", () => {
    const root: LayoutNode = {
      id: "s",
      type: "split",
      direction: "row",
      sizes: [0.5, 0.5],
      children: [
        { id: "g1", type: "tab", slot: "center", panels: ["welcome"], activeIndex: 0 },
        { id: "g2", type: "tab", slot: "right", panels: ["welcome", "assets"], activeIndex: 0 },
      ],
    };
    const result = reconcile(root, FAKE_REGISTRY)!;
    const ids = collectPanelIds(result);
    // welcome appears only once.
    expect(ids.filter((id) => id === "welcome")).toHaveLength(1);
  });

  it("returns null when every panel is dead", () => {
    const root: LayoutNode = { id: "g", type: "tab", slot: "center", panels: ["ghost1", "ghost2"], activeIndex: 0 };
    expect(reconcile(root, FAKE_REGISTRY)).toBeNull();
  });
});

describe("loadLayout / saveLayout", () => {
  it("round-trips a layout tree through localStorage", () => {
    const root = defaultWorkspaceRoot(FAKE_REGISTRY);
    saveLayout(root);
    const loaded = loadLayout(FAKE_REGISTRY);
    expect(collectPanelIds(loaded)).toEqual(expect.arrayContaining(collectPanelIds(root)));
  });

  it("migrates a legacy blob on first load", () => {
    localStorage.setItem("artworks:workspace-layout", JSON.stringify({
      slots: { left: ["explorer"], center: ["welcome"] },
      active: { left: "explorer" },
    }));
    const loaded = loadLayout(FAKE_REGISTRY);
    const ids = collectPanelIds(loaded);
    expect(ids).toContain("explorer");
    expect(ids).toContain("welcome");
  });

  it("falls back to the default when storage is corrupt", () => {
    localStorage.setItem("artworks:workspace-layout", "{not json");
    const loaded = loadLayout(FAKE_REGISTRY);
    expect(collectPanelIds(loaded).length).toBeGreaterThan(0);
  });
});

// Regression: togglePanel / setActivePanel used to call require() in a Vite/ESM
// renderer and threw ReferenceError at runtime. These tests exercise the path
// end-to-end so the bug class can't silently come back (the unit gate passed
// before because the functions were never invoked).
describe("togglePanel", () => {
  it("removes a panel that is already in the tree", () => {
    const root: LayoutNode = {
      id: "s",
      type: "split",
      direction: "row",
      sizes: [0.5, 0.5],
      children: [
        { id: "g1", type: "tab", slot: "center", panels: ["welcome"], activeIndex: 0 },
        { id: "g2", type: "tab", slot: "right", panels: ["assets"], activeIndex: 0 },
      ],
    };
    const next = togglePanel(root, "welcome", FAKE_REGISTRY);
    expect(collectPanelIds(next)).not.toContain("welcome");
  });

  it("adds a panel that is absent, into its default slot", () => {
    // Single center group; toggling `assets` (defaultSlot right) wraps a split.
    const root: LayoutNode = { id: "g1", type: "tab", slot: "center", panels: ["welcome"], activeIndex: 0 };
    const next = togglePanel(root, "assets", FAKE_REGISTRY);
    expect(collectPanelIds(next)).toEqual(expect.arrayContaining(["welcome", "assets"]));
  });
});

describe("setActivePanel", () => {
  it("changes the active tab within a group and returns the original root if absent", () => {
    const root: LayoutNode = { id: "g1", type: "tab", slot: "center", panels: ["welcome", "assets"], activeIndex: 0 };
    const next = setActivePanel(root, "assets") as { activeIndex: number };
    expect(next.activeIndex).toBe(1);
    const unchanged = setActivePanel(root, "ghost") as { activeIndex: number };
    expect(unchanged.activeIndex).toBe(0);
  });
});

// ---- helpers ----

/** Collect every panel id referenced anywhere in the tree. */
function collectPanelIds(node: LayoutNode): string[] {
  if (node.type === "tab") return [...node.panels];
  return node.children.flatMap(collectPanelIds);
}

/** Find the first tab node tagged with a slot. */
function findTabBySlot(node: LayoutNode, slot: string): { panels: string[]; activeIndex: number } | null {
  if (node.type === "tab") return node.slot === slot ? node : null;
  for (const c of node.children) {
    const f = findTabBySlot(c, slot);
    if (f) return f;
  }
  return null;
}
