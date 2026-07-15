import { describe, expect, it } from "vitest";
import {
  DEFAULT_PALETTE,
  PALETTES,
  isPaletteId,
  resolvePalette,
} from "@/features/appearance";

describe("appearance palettes", () => {
  it("offers four stable palettes with balanced nebula as the default", () => {
    expect(PALETTES.map((palette) => palette.id)).toEqual([
      "classic",
      "midnight",
      "nebula",
      "balanced-nebula",
    ]);
    expect(DEFAULT_PALETTE).toBe("balanced-nebula");
  });

  it("falls back safely when stored browser data is missing or invalid", () => {
    expect(isPaletteId("classic")).toBe(true);
    expect(isPaletteId("purple-everywhere")).toBe(false);
    expect(resolvePalette("midnight")).toBe("midnight");
    expect(resolvePalette(undefined)).toBe(DEFAULT_PALETTE);
    expect(resolvePalette("purple-everywhere")).toBe(DEFAULT_PALETTE);
  });
});
