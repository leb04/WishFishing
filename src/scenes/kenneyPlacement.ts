import { Quaternion, Vector3 } from "three";
import type { NatureModel } from "./kenneyAssetPaths";
import type { NatureBounds } from "./kenneyModels";
import { createTerrainSampler, SHORE_CLEARANCE, baselineShoreX as shoreX, remapBankX, WATER_LEVEL } from "./terrain";

export interface NaturePlacement {
  model: NatureModel;
  x: number; y: number; z: number;
  scale: number;
  rotation: Quaternion;
  radius: number;
}
const noise = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};
const isTree = (model: NatureModel) => model === "pine" || model === "tallPine" || model === "oak";

export function isMarkedForRemoval(p: NaturePlacement) {
  const centralGrove = isTree(p.model) && p.z < -112 && p.x > -22 && p.x < 32;
  const isolatedOak = p.model === "oak" && p.x > -24 && p.x < -12 && p.z > -65 && p.z < -47;
  return centralGrove || isolatedOak;
}

/** Bounded initialization only: revalidate candidate regions against imported geometry. */
export function generateBaselineNature(models: Record<NatureModel, NatureBounds>) {
  const land = createTerrainSampler(true);
  const placements: NaturePlacement[] = [];
  function place(model: NatureModel, x: number, z: number, height: number, seed: number) {
    const bounds = models[model];
    const scale = height / bounds.height;
    const surface = land.surfaceAt(x, z);
    const radius = bounds.radius * scale + (model === "oak" && surface ? height * Math.sqrt(1 - surface.normalY ** 2) : 0);
    const tree = isTree(model);
    const clearance = tree ? SHORE_CLEARANCE : 0.3;
    if (!surface || surface.height < 0.25 || surface.normalY < (tree ? 0.93 : 0.9) || (tree && !surface.supportsTrees)) return false;
    if (land.shorelineDistance(x, z) < radius + clearance) return false;
    if (placements.some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + radius + 0.25)) return false;
    // Also test full canopy/rock footprint: submerged parts of overlapping patches
    // cannot masquerade as suitable land merely because the center ray found a hill.
    for (let step = 0; step < 16; step++) {
      const angle = step * Math.PI / 8;
      const ground = land.heightAt(x + Math.cos(angle) * (radius + clearance), z + Math.sin(angle) * (radius + clearance));
      if (ground === null || ground <= WATER_LEVEL + 0.05) return false;
    }
    const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), noise(seed) * Math.PI * 2);
    if (!tree || model === "oak") {
      const d = 0.2;
      const left = land.heightAt(x - d, z), right = land.heightAt(x + d, z);
      const back = land.heightAt(x, z - d), front = land.heightAt(x, z + d);
      if (left === null || right === null || back === null || front === null) return false;
      rotation.premultiply(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3((left - right) / (2 * d), 1, (back - front) / (2 * d)).normalize()));
    }
    const offsets: number[] = [];
    for (const contact of bounds.contacts) {
      const point = contact.clone().multiplyScalar(scale).applyQuaternion(rotation);
      const ground = land.surfaceAt(x + point.x, z + point.z);
      if (!ground || ground.height <= 0.15 || ground.normalY < 0.9) return false;
      offsets.push(ground.height - point.y);
    }
    if (!offsets.length || Math.max(...offsets) - Math.min(...offsets) > 0.14) return false;
    // Tiny root embed covers triangle seams; every base vertex stays within 0.14m.
    const y = Math.max(...offsets) - 0.025;
    if (y - radius * Math.sqrt(1 - surface.normalY ** 2) <= WATER_LEVEL + 0.05) return false;
    placements.push({ model, x, y, z, scale, rotation, radius });
    return true;
  }
  try {
    // Authored cluster centers follow the valley's two unequal slopes. Each tuple
    // is [side, depth, inland offset, desired count]; gaps are deliberate.
    const clusters = [
      [-1, -17, 5, 7], [-1, -34, 10, 11], [-1, -53, 7, 12],
      [-1, -75, 16, 13], [-1, -101, 9, 13], [-1, -130, 16, 14], [-1, -158, 12, 12],
      [1, -24, 8, 9], [1, -45, 13, 12], [1, -69, 8, 13],
      [1, -89, 20, 13], [1, -115, 11, 14], [1, -143, 17, 14], [1, -169, 9, 11],
      [-1, -39, 28, 12], [-1, -81, 32, 12], [-1, -123, 33, 12],
      [1, -52, 31, 12], [1, -101, 34, 12], [1, -146, 32, 12],
    ];
    clusters.forEach(([side, depth, inland, count], clusterIndex) => {
      let added = 0;
      for (let attempt = 0; attempt < 130 && added < count!; attempt++) {
        const seed = clusterIndex * 719 + attempt * 7;
        const angle = noise(seed) * Math.PI * 2, distance = Math.sqrt(noise(seed + 1));
        const z = depth! + Math.sin(angle) * distance * 11;
        const x = shoreX(z, side!) + side! * (inland! + Math.cos(angle) * distance * 7);
        const choice = noise(seed + 3);
        const model = choice > 0.97 && z < -35 && placements.filter((p) => p.model === "oak").length < 8 ? "oak" : choice > 0.62 ? "tallPine" : "pine";
        const height = (model === "oak" ? 3.5 : 4.2) + Math.max(0, 1 + z / 110) * 1.6 + noise(seed + 2) * 1.6;
        if (Math.abs(x) < Math.abs(shoreX(z, side!)) + 2.3) continue;
        if (place(model, x, z, height, seed + 401)) added++;
      }
    });
    // Small far-shore woodland connects the side forests behind the open lake.
    for (let i = 0; i < 120; i++) {
      const x = (noise(i + 1401) - 0.5) * 46, z = -126 - noise(i + 1501) * 23;
      place(noise(i + 1601) > 0.65 ? "tallPine" : "pine", x, z, 4.2 + noise(i + 1701), i + 1801);
    }
    // Selected beach pockets, rather than a continuous rock border.
    for (const [side, depth] of [[-1, -13], [-1, -25], [-1, -43], [-1, -70], [-1, -104], [1, -17], [1, -35], [1, -56], [1, -87], [1, -119]]) {
      for (let i = 0; i < 2; i++) {
        const z = depth! - i * 2.4;
        const x = shoreX(z, side!) + side! * (1.9 + i * 1.8);
        const model = i === 0 ? "boulder" : "smallRock";
        place(model, x, z, i === 0 ? 0.6 + noise(depth!) * 0.2 : 0.32, depth! + i);
      }
    }
    const anchors = [...placements];
    for (let index = 0; index < anchors.length && placements.filter((p) => p.model === "bush").length < 42; index++) {
      const anchor = anchors[index]!;
      if (noise(index + 341) < 0.55) continue;
      for (let attempt = 0; attempt < 10; attempt++) {
        const angle = noise(index * 41 + attempt + 601) * Math.PI * 2;
        const distance = anchor.radius + 1 + noise(attempt + 621) * 0.8;
        if (place("bush", anchor.x + Math.cos(angle) * distance, anchor.z + Math.sin(angle) * distance, 0.65 + noise(index + 710) * 0.4, index + 720)) break;
      }
    }
    return placements;
  } finally { land.dispose(); }
}


/** Reground the baseline placements against the current shoreline. */
export function placeNature(models: Record<NatureModel, NatureBounds>) {
  const baseline = generateBaselineNature(models);
  const land = createTerrainSampler();
  const result: NaturePlacement[] = [];
  const correctedByOriginal = new Map<NaturePlacement, NaturePlacement>();
  const heading = new Vector3(), up = new Vector3(0, 1, 0);
  function ground(original: NaturePlacement, x: number, z: number, fitPine = false): NaturePlacement | null {
    const surface = land.surfaceAt(x, z), tree = isTree(original.model);
    if (!surface || surface.height < 0.25 || surface.normalY < (tree ? 0.93 : 0.9)) return null;
    if (original.model === "bush" && !result.some((p) => p.model !== "bush" && Math.hypot(p.x - x, p.z - z) < p.radius + 1.8)) return null;
    const bounds = models[original.model];
    const clearance = tree ? SHORE_CLEARANCE : 0.3;
    heading.set(0, 0, 1).applyQuaternion(original.rotation);
    const rotation = new Quaternion().setFromAxisAngle(up, Math.atan2(heading.x, heading.z));
    if (!tree || original.model === "oak" || fitPine) {
      const l = land.heightAt(x - 0.2, z), r = land.heightAt(x + 0.2, z), b = land.heightAt(x, z - 0.2), f = land.heightAt(x, z + 0.2);
      if (l === null || r === null || b === null || f === null) return null;
      const tilt = new Quaternion().setFromUnitVectors(up, new Vector3((l - r) / 0.4, 1, (b - f) / 0.4).normalize());
      if (fitPine) tilt.slerp(new Quaternion(), 0.65);
      rotation.premultiply(tilt);
    }
    const radius = bounds.radius * original.scale + (original.model === "oak" || fitPine ? bounds.height * original.scale * Math.sqrt(1 - surface.normalY ** 2) * (fitPine ? 0.35 : 1) : 0);
    if (land.shorelineDistance(x, z) < radius + clearance || result.some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + radius + 0.25)) return null;
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI / 8;
      const edge = land.heightAt(x + Math.cos(angle) * (radius + clearance), z + Math.sin(angle) * (radius + clearance));
      if (edge === null || edge < 0.05) return null;
    }
    let minimum = Infinity, maximum = -Infinity;
    for (const contact of bounds.contacts) {
      const point = contact.clone().multiplyScalar(original.scale).applyQuaternion(rotation);
      const ground = land.surfaceAt(x + point.x, z + point.z);
      if (!ground || ground.height <= 0.15 || ground.normalY < 0.9) return null;
      minimum = Math.min(minimum, ground.height - point.y); maximum = Math.max(maximum, ground.height - point.y);
    }
    if (maximum - minimum > 0.14 || maximum - 0.025 - radius * Math.sqrt(1 - surface.normalY ** 2) <= 0.05) return null;
    return { ...original, x, y: maximum - 0.025, z, rotation, radius };
  }
  try {
    baseline.forEach((original, index) => {
      let x = remapBankX(original.x, original.z), z = original.z;
      const anchor = original.model === "bush" ? baseline.filter((p) => p.model !== "bush").reduce((closest, p) =>
        Math.hypot(p.x - original.x, p.z - original.z) - p.radius < Math.hypot(closest.x - original.x, closest.z - original.z) - closest.radius ? p : closest) : undefined;
      const correctedAnchor = anchor && correctedByOriginal.get(anchor);
      if (anchor && correctedAnchor) {
        x += correctedAnchor.x - remapBankX(anchor.x, anchor.z);
        z += correctedAnchor.z - anchor.z;
      }
      let corrected = ground(original, x, z);
      // Search only the immediate neighborhood when a revised facet invalidates
      // support or spacing. Never generate replacement clusters or change scale.
      for (let attempt = 0; !corrected && attempt < 128; attempt++) {
        const angle = noise(index * 83 + attempt + 7001) * Math.PI * 2;
        const distance = 0.25 + Math.floor(attempt / 16) * 0.45;
        corrected = ground(original, x + Math.cos(angle) * distance, z + Math.sin(angle) * distance);
      }
      for (let attempt = 0; !corrected && isTree(original.model) && attempt < 80; attempt++) {
        const angle = noise(index * 83 + attempt + 9001) * Math.PI * 2;
        const distance = attempt === 0 ? 0 : 0.25 + Math.floor(attempt / 16) * 0.4;
        corrected = ground(original, x + Math.cos(angle) * distance, z + Math.sin(angle) * distance, true);
      }
      if (corrected) { result.push(corrected); correctedByOriginal.set(original, corrected); }
    });
    const kept = result.filter((p) => !isMarkedForRemoval(p));
    // Avoid leaving a bush orphaned if its only nearby tree was marked out.
    return kept.filter((p) => p.model !== "bush" || kept.some((anchor) => anchor.model !== "bush" && Math.hypot(anchor.x - p.x, anchor.z - p.z) < anchor.radius + 1.8));
  } finally { land.dispose(); }
}
