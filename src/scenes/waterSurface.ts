import { BufferAttribute, Color } from "three";
import type { BufferGeometry } from "three";
import type { ScenePalette } from "./config";
import { createTerrainSampler } from "./terrain";

/** Color a flat water grid once per palette change; no texture or reflection pass. */
export function colorWaterSurface(geometry: BufferGeometry, palette: ScenePalette) {
  const positions = geometry.getAttribute("position");
  let colors = geometry.getAttribute("color");
  if (!colors) {
    colors = new BufferAttribute(new Float32Array(positions.count * 3), 3);
    geometry.setAttribute("color", colors);
  }
  const base = new Color(palette.water);
  const deep = new Color(palette.deepWater);
  const shallow = new Color(palette.shallowWater);
  const color = new Color();
  const land = createTerrainSampler();
  try {
    for (let index = 0; index < positions.count; index++) {
      const x = positions.getX(index);
      // PlaneGeometry is rotated -PI/2 and the lake center is at world Z = -26.
      const z = -positions.getY(index) - 26;
      const distance = land.shorelineDistance(x, z);
      const nearShore = Math.max(0, 1 - distance / 2.8);
      const variation = 0.25 + Math.sin(x * 0.18 + z * 0.12) * 0.045 + Math.cos(z * 0.29 - x * 0.1) * 0.03;
      color.copy(base).lerp(deep, variation).lerp(shallow, nearShore * 0.45);
      colors.setXYZ(index, color.r, color.g, color.b);
    }
    colors.needsUpdate = true;
  } finally { land.dispose(); }
}

/** Small irregular details, masked against land once rather than queried per frame. */
export function generateWaterPatterns(count = 180) {
  const land = createTerrainSampler();
  const patterns = [];
  const hash = (seed: number) => { const value = Math.sin(seed * 127.1 + 74.7) * 43758.5453; return value - Math.floor(value); };
  try {
    for (let attempt = 0; attempt < count * 8 && patterns.length < count; attempt++) {
      const x = (hash(attempt * 7) - 0.5) * 46, z = 2 - hash(attempt * 7 + 1) * 74;
      if (Math.hypot(x, z + 8) < 1.5) continue;
      const dry = Array.from({ length: 8 }, (_, i) => land.heightAt(x + Math.cos(i * Math.PI / 4) * 0.8, z + Math.sin(i * Math.PI / 4) * 0.8))
        .some((height) => height !== null && height > -0.05);
      if (dry) continue;
      patterns.push({ x, z, size: 0.2 + hash(attempt * 7 + 2) * 0.42, phase: hash(attempt * 7 + 3) * Math.PI * 2, rotation: (hash(attempt * 7 + 4) - 0.5) * 0.9 });
    }
    return patterns;
  } finally { land.dispose(); }
}
export const WATER_PATTERNS = generateWaterPatterns();
