/**
 * Example test — proves the test runner, alias resolution, and shared
 * module import all work. Real tests arrive with each module.
 */
import { describe, it, expect } from "vitest";
import { PRODUCT_NAME, TAGLINE } from "./index.js";

describe("shared/utils", () => {
  it("exposes the product name", () => {
    expect(PRODUCT_NAME).toBe("Artworks Studio OS");
  });

  it("exposes the tagline", () => {
    expect(TAGLINE).toBe("Create Stories. Build Worlds. Direct Intelligence.");
  });
});
