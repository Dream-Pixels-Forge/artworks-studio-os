// @vitest-environment jsdom
/**
 * Tests for the workspace store — named, saveable workspaces (#5).
 * Covers the built-in presets, CRUD, active-workspace tracking, and
 * built-in protection on delete.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  buildBuiltinWorkspaces,
  seedBuiltinWorkspaces,
  listWorkspaces,
  getWorkspace,
  saveWorkspace,
  deleteWorkspace,
  getActiveWorkspaceId,
  setActiveWorkspace,
  __clearWorkspaces,
} from "./workspace-store.js";
import type { PanelDefinition } from "./types.js";

const FAKE_REGISTRY: PanelDefinition[] = [
  { id: "explorer", title: "Explorer", icon: "📁", component: () => null, defaultSlot: "left", defaultVisible: true },
  { id: "welcome", title: "Welcome", icon: "👋", component: () => null, defaultSlot: "center", defaultVisible: true },
  { id: "assets", title: "Assets", icon: "🎨", component: () => null, defaultSlot: "right", defaultVisible: true },
  { id: "timeline", title: "Timeline", icon: "⏱", component: () => null, defaultSlot: "bottom", defaultVisible: true },
];

beforeEach(() => {
  __clearWorkspaces();
});

describe("buildBuiltinWorkspaces", () => {
  it("creates the three department presets", () => {
    const builtins = buildBuiltinWorkspaces(FAKE_REGISTRY);
    const names = builtins.map((w) => w.name);
    expect(names).toEqual(expect.arrayContaining(["Storyboarding", "Editing", "Production"]));
    expect(builtins.every((w) => w.builtin === true)).toBe(true);
  });

  it("each preset has a non-null root tree", () => {
    const builtins = buildBuiltinWorkspaces(FAKE_REGISTRY);
    expect(builtins.every((w) => w.root !== null)).toBe(true);
  });
});

describe("seedBuiltinWorkspaces", () => {
  it("seeds on first run and sets the first active", () => {
    const seeded = seedBuiltinWorkspaces(FAKE_REGISTRY);
    expect(seeded).toBe(true);
    expect(listWorkspaces().length).toBe(3);
    expect(getActiveWorkspaceId()).not.toBeNull();
  });

  it("does not re-seed when workspaces already exist", () => {
    seedBuiltinWorkspaces(FAKE_REGISTRY);
    const reseeded = seedBuiltinWorkspaces(FAKE_REGISTRY);
    expect(reseeded).toBe(false);
    expect(listWorkspaces().length).toBe(3);
  });
});

describe("saveWorkspace / getWorkspace", () => {
  it("saves a custom workspace and retrieves it by id", () => {
    saveWorkspace({ id: "custom-1", name: "My Layout", root: null, updatedAt: 0 });
    const got = getWorkspace("custom-1");
    expect(got?.name).toBe("My Layout");
  });

  it("upserts an existing workspace by id", () => {
    saveWorkspace({ id: "custom-1", name: "V1", root: null, updatedAt: 0 });
    saveWorkspace({ id: "custom-1", name: "V2", root: null, updatedAt: 0 });
    expect(getWorkspace("custom-1")?.name).toBe("V2");
    expect(listWorkspaces().filter((w) => w.id === "custom-1")).toHaveLength(1);
  });
});

describe("deleteWorkspace", () => {
  it("deletes a custom workspace", () => {
    saveWorkspace({ id: "custom-1", name: "X", root: null, updatedAt: 0 });
    deleteWorkspace("custom-1");
    expect(getWorkspace("custom-1")).toBeNull();
  });

  it("protects built-in workspaces from deletion", () => {
    seedBuiltinWorkspaces(FAKE_REGISTRY);
    const builtin = listWorkspaces()[0]!;
    deleteWorkspace(builtin.id);
    expect(getWorkspace(builtin.id)).not.toBeNull();
  });

  it("clears the active id when deleting the active workspace", () => {
    saveWorkspace({ id: "custom-1", name: "X", root: null, updatedAt: 0 });
    setActiveWorkspace("custom-1");
    deleteWorkspace("custom-1");
    expect(getActiveWorkspaceId()).toBeNull();
  });
});

describe("setActiveWorkspace", () => {
  it("persists the active id across reads", () => {
    seedBuiltinWorkspaces(FAKE_REGISTRY);
    const id = listWorkspaces()[0]!.id;
    setActiveWorkspace(id);
    expect(getActiveWorkspaceId()).toBe(id);
  });

  it("clears when passed null", () => {
    setActiveWorkspace("anything");
    setActiveWorkspace(null);
    expect(getActiveWorkspaceId()).toBeNull();
  });
});
