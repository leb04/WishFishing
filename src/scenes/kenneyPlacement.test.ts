import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Mesh, MeshStandardMaterial } from "three";
import { prepareNatureModel } from "./kenneyModels";
import type { PreparedNatureModel } from "./kenneyModels";
import { generateBaselineNature, isMarkedForRemoval, placeNature } from "./kenneyPlacement";
import type { NatureModel } from "./kenneyAssetPaths";
import { createTerrainSampler, SHORE_CLEARANCE } from "./terrain";

const files = { pine: "tree_pineDefaultA", tallPine: "tree_pineTallA_detailed", oak: "tree_oak", boulder: "rock_largeA", smallRock: "rock_smallC", bush: "plant_bushDetailed" };
const models = {} as Record<NatureModel, PreparedNatureModel>;
const originals: MeshStandardMaterial[] = [];
beforeAll(async () => {
  for (const name of Object.keys(files) as NatureModel[]) {
    const bytes = readFileSync(new URL(`../dev/assets/kenney-nature/${files[name]}.glb`, import.meta.url));
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    gltf.scene.traverse((object) => {
      if (object instanceof Mesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material instanceof MeshStandardMaterial) originals.push(material);
    });
    models[name] = prepareNatureModel(gltf.scene);
  }
});
afterAll(() => Object.values(models).forEach((model) => model.dispose()));

describe("actual Kenney geometry on the reconstructed fishing terrain", () => {
  it("normalizes exporter pivots and adapts shared material copies without mutating originals", () => {
    expect(originals.every((material) => material.metalness === 1)).toBe(true);
    for (const model of Object.values(models)) {
      expect(model.height).toBeGreaterThan(0);
      expect(model.contacts.length).toBeGreaterThan(0);
      for (const part of model.parts) {
        part.geometry.computeBoundingBox();
        expect(part.geometry.boundingBox!.min.y).toBeCloseTo(0, 6);
        for (const material of Array.isArray(part.material) ? part.material : [part.material]) {
          expect((material as MeshStandardMaterial).metalness).toBe(0);
          expect(originals.includes(material as MeshStandardMaterial)).toBe(false);
        }
      }
    }
  });
  it("keeps a deterministic moderate forest and uses every approved model", () => {
    const placements = placeNature(models);
    expect(placeNature(models)).toEqual(placements);
    const counts = Object.fromEntries(Object.keys(files).map((name) => [name, placements.filter((p) => p.model === name).length]));
    console.info("Marked-area corrections model counts", counts);
    const baseline = generateBaselineNature(models);
    for (const name of Object.keys(files)) expect(counts[name]).toBeLessThanOrEqual(baseline.filter((p) => p.model === name).length);
    expect(placements.every((p) => !isMarkedForRemoval(p))).toBe(true);
    expect(counts.oak).toBe(7);
    expect(Object.values(counts).every((count) => count > 0)).toBe(true);
    expect(counts.pine!).toBeGreaterThan(counts.tallPine!);
    expect(counts.oak!).toBeLessThanOrEqual(16);
    expect(counts.pine! + counts.tallPine! + counts.oak!).toBeGreaterThanOrEqual(100);
    expect(counts.pine! + counts.tallPine! + counts.oak!).toBeLessThanOrEqual(300);
    expect(counts.bush!).toBeLessThanOrEqual(42);
    expect(counts.boulder! + counts.smallRock!).toBeLessThanOrEqual(20);
  });
  it("grounds actual base vertices, preserves shoreline clearance and prevents model overlaps", () => {
    const placements = placeNature(models);
    const terrain = createTerrainSampler();
    try {
      for (const [index, p] of placements.entries()) {
        const tree = ["pine", "tallPine", "oak"].includes(p.model);
        expect(terrain.shorelineDistance(p.x, p.z)).toBeGreaterThanOrEqual(p.radius + (tree ? SHORE_CLEARANCE : 0.3));
        for (const contact of models[p.model].contacts) {
          const vertex = contact.clone().multiplyScalar(p.scale).applyQuaternion(p.rotation);
          const ground = terrain.surfaceAt(p.x + vertex.x, p.z + vertex.z)!;
          expect(ground.height).toBeGreaterThan(0.15);
          expect(ground.normalY).toBeGreaterThanOrEqual(0.9);
          const gap = p.y + vertex.y - ground.height;
          expect(gap).toBeGreaterThanOrEqual(-0.025001);
          expect(gap).toBeLessThanOrEqual(0.116);
        }
        for (const other of placements.slice(index + 1)) expect(Math.hypot(p.x - other.x, p.z - other.z)).toBeGreaterThanOrEqual(p.radius + other.radius + 0.25);
        if (tree) {
          expect(p.scale * models[p.model].height).toBeGreaterThanOrEqual(3.5);
          if (p.z > -118) expect(Math.abs(p.x)).toBeGreaterThan(5);
        }
        if (p.model === "bush") expect(placements.some((other) => other.model !== "bush" && Math.hypot(p.x - other.x, p.z - other.z) < other.radius + 1.81)).toBe(true);
      }
    } finally { terrain.dispose(); }
  });
});
