import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { afterAll, describe, expect, it } from "vitest";
import { baselineShoreX, beachWidth, createTerrainGeometry, createTerrainSampler, remapBankX, shoreX, TERRAIN_PATCHES } from "./terrain";
const land = createTerrainSampler();
afterAll(() => land.dispose());
describe("authored continuous lake valley", () => {
  it("keeps the fishing corridor underwater and both banks connected", () => {
    for (let z = 5; z > -115; z -= 2) {
      expect(land.heightAt(0, z)).toBeNull();
      for (const side of [-1, 1]) {
        const x = shoreX(z, side);
        expect(land.heightAt(x + side * 4, z)).toBeGreaterThan(0.2);
        expect(land.heightAt(x + side * 25, z)).toBeGreaterThan(2);
      }
    }
  });
  it("uses irregular asymmetric shores with gentle beach slopes", () => {
    const distances = [];
    for (let z = -10; z > -110; z -= 5) {
      distances.push(shoreX(z, 1) + shoreX(z, -1));
      for (const side of [-1, 1]) {
        const x = shoreX(z, side) + side * 3;
        expect(land.surfaceAt(x, z)?.normalY).toBeGreaterThan(0.85);
        expect(land.shorelineDistance(x, z)).toBeGreaterThan(1.5);
        expect(land.shorelineDistance(x, z)).toBeLessThan(4.5);
      }
    }
    expect(Math.max(...distances) - Math.min(...distances)).toBeGreaterThan(1);
  });
  it("preserves the lake envelope while introducing broad bends and varied beaches", () => {
    for (let z = -8; z >= -110; z -= 2) {
      const oldWidth = baselineShoreX(z, 1) - baselineShoreX(z, -1);
      const newWidth = shoreX(z, 1) - shoreX(z, -1);
      expect(newWidth / oldWidth).toBeGreaterThan(0.75);
      expect(newWidth / oldWidth).toBeLessThan(1.3);
      for (const x of [-5, 0, 5]) expect(land.heightAt(x, z)).toBeNull();
    }
    const widths = [];
    for (const side of [-1, 1]) for (let z = 10; z >= -115; z -= 2.5) {
      widths.push(beachWidth(z, side));
      const inland = [-1.2, 0, 1, 3, 5, 8, 12, 17, 23, 31, 74].map((distance) =>
        remapBankX(baselineShoreX(z, side) + side * distance, z) * side);
      for (let i = 1; i < inland.length; i++) expect(inland[i]!).toBeGreaterThan(inland[i - 1]!);
    }
    expect(Math.max(...widths) / Math.min(...widths)).toBeGreaterThan(4);
    expect(Math.abs(shoreX(-30, -1) - baselineShoreX(-30, -1))).toBeGreaterThan(3);
    expect(Math.abs(shoreX(-58, 1) - baselineShoreX(-58, 1))).toBeGreaterThan(3);
  });
  it("retains mountain geometry exactly and joins the water without duplicate shore surfaces", () => {
    for (const patch of TERRAIN_PATCHES) {
      const geometry = createTerrainGeometry(patch), baseline = createTerrainGeometry(patch, true);
      if (patch.kind === "ridge") expect(Array.from(geometry.getAttribute("position").array)).toEqual(Array.from(baseline.getAttribute("position").array));
      else {
        const positions = geometry.getAttribute("position");
        expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
        expect(Math.min(...Array.from({ length: positions.count }, (_, i) => positions.getY(i)))).toBeLessThan(0);
        for (let z = -10; z > -110; z -= 2.5) {
          const edge = shoreX(z, patch.side!);
          expect(land.heightAt(edge + patch.side! * 0.35, z)).toBeGreaterThan(0);
          expect(land.heightAt(edge - patch.side! * 0.6, z)).toBeLessThan(0);
        }
      }
      geometry.dispose(); baseline.dispose();
    }
  });
  it("matches independent raycasts against the actual terrain mesh", () => {
    const material = new MeshBasicMaterial();
    const meshes = TERRAIN_PATCHES.map((patch) => new Mesh(createTerrainGeometry(patch), material));
    const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
    try {
      for (let i = 0; i < 80; i++) {
        const x = Math.sin(i * 11.7) * 65, z = -5 - (i * 17.3) % 250;
        ray.ray.origin.set(x, 100, z);
        const hit = ray.intersectObjects(meshes, false)[0];
        if (hit) expect(land.heightAt(x, z)).toBeCloseTo(hit.point.y, 5);
        else expect(land.heightAt(x, z)).toBeNull();
      }
    } finally { meshes.forEach((mesh) => mesh.geometry.dispose()); material.dispose(); }
  });
  it("shares deterministic rendered triangles with placement and overlaps three distant ridges", () => {
    expect(TERRAIN_PATCHES.filter((p) => p.kind === "ridge")).toHaveLength(3);
    for (const patch of TERRAIN_PATCHES) {
      const a = createTerrainGeometry(patch), b = createTerrainGeometry(patch);
      expect(Array.from(a.getAttribute("position").array)).toEqual(Array.from(b.getAttribute("position").array));
      expect(a.getAttribute("position").count).toBeLessThan(5000);
      a.dispose(); b.dispose();
    }
    expect(land.surfaceAt(-40, -255)?.supportsTrees).toBe(false);
  });
});
