import { describe, expect, it } from "vitest";
import { createTerrainSampler } from "./terrain";
import { PlaneGeometry } from "three";
import { SCENE_PALETTES } from "./config";
import { colorWaterSurface, generateWaterPatterns, WATER_PATTERNS } from "./waterSurface";

describe("lightweight water coloration", () => {
  it("adds bounded, varied colors while preserving the flat water surface", () => {
    const geometry = new PlaneGeometry(160, 160, 48, 48);
    try {
      const original = Array.from(geometry.getAttribute("position").array);
      colorWaterSurface(geometry, SCENE_PALETTES.light);
      const colors = geometry.getAttribute("color");
      expect(colors.count).toBe(49 * 49);
      for (const value of colors.array) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
      expect(new Set(Array.from(colors.array).map((value) => value.toFixed(4))).size).toBeGreaterThan(50);
      expect(Array.from(geometry.getAttribute("position").array)).toEqual(original);
    } finally { geometry.dispose(); }
  });

  it("reuses the color buffer across theme changes and deterministically restores daylight", () => {
    const geometry = new PlaneGeometry(160, 160, 24, 24);
    try {
      colorWaterSurface(geometry, SCENE_PALETTES.light);
      const colors = geometry.getAttribute("color");
      const light = Array.from(colors.array);
      colorWaterSurface(geometry, SCENE_PALETTES.dark);
      expect(geometry.getAttribute("color")).toBe(colors);
      expect(Array.from(colors.array)).not.toEqual(light);
      colorWaterSurface(geometry, SCENE_PALETTES.light);
      expect(geometry.getAttribute("color")).toBe(colors);
      expect(Array.from(colors.array)).toEqual(light);
    } finally { geometry.dispose(); }
  });
});

describe("irregular water detail placement", () => {
  it("is bounded and deterministic without uniform depth rows", () => {
    expect(WATER_PATTERNS.length).toBe(180);
    expect(generateWaterPatterns()).toEqual(WATER_PATTERNS);
    expect(new Set(WATER_PATTERNS.map((pattern) => pattern.z)).size).toBe(180);
    for (const pattern of WATER_PATTERNS) {
      expect(pattern.size).toBeGreaterThanOrEqual(0.2);
      expect(pattern.size).toBeLessThanOrEqual(0.62);
      expect(Math.hypot(pattern.x, pattern.z + 8)).toBeGreaterThanOrEqual(1.5);
    }
  });
  it("keeps the ripple footprint and drift clearance off dry terrain", () => {
    const land = createTerrainSampler();
    try {
      for (const pattern of WATER_PATTERNS) for (let step = 0; step < 24; step++) {
        const angle = step * Math.PI / 12;
        const height = land.heightAt(pattern.x + Math.cos(angle) * 0.7, pattern.z + Math.sin(angle) * 0.7);
        expect(height === null || height < 0).toBe(true);
      }
    } finally { land.dispose(); }
  });
});
