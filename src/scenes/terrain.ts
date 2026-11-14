import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, Vector3 } from "three";
import type { Point3 } from "./config";

export const WATER_LEVEL = 0;
export const SHORE_CLEARANCE = 0.8;
export interface TerrainPatch {
  id: string; color: "shore" | "hill" | "farHill" | "distantPeak";
  position: Point3; scale: Point3; rotation: Point3;
  kind: "bank" | "ridge"; side?: number; layer?: number; vegetation?: boolean;
}
const origin: Point3 = [0, 0, 0], unit: Point3 = [1, 1, 1];
export const TERRAIN_PATCHES: TerrainPatch[] = [
  { id: "west-bank", color: "shore", position: origin, scale: unit, rotation: origin, kind: "bank", side: -1 },
  { id: "east-bank", color: "shore", position: origin, scale: unit, rotation: origin, kind: "bank", side: 1 },
  ...[0, 1, 2].map((layer): TerrainPatch => ({ id: `distant-ridge-${layer}`, color: layer === 0 ? "hill" : layer === 1 ? "farHill" : "distantPeak", position: origin, scale: unit, rotation: origin, kind: "ridge", layer, vegetation: layer === 0 })),
];
/** One authored valley, asymmetric coves and continuous land on either side. */
export function baselineShoreX(z: number, side: number) {
  return side * (12.8 + Math.sin(z * 0.065 + side * 0.8) * 2.8 + Math.sin(z * 0.14 + side * 1.7) * 1.15 + Math.max(0, -z - 65) * 0.18);
}
const SHORE_PROFILE = [
  [12, 12.72, 15.33, 2.4, 1.3],
  [-8, 10.5, 14.2, 1.0, 2.5],
  [-30, 16.0, 10.5, 3.3, 0.7],
  [-58, 11.8, 16.3, 0.65, 3.0],
  [-88, 18.3, 16.0, 2.8, 0.85],
  [-118, 20.73, 19.9, 1.6, 1.8],
] as const;
function profileAt(z: number, column: 1 | 2 | 3 | 4) {
  for (let i = 0; i < SHORE_PROFILE.length - 1; i++) {
    const a = SHORE_PROFILE[i]!, b = SHORE_PROFILE[i + 1]!;
    if (z > a[0] || z < b[0]) continue;
    const t = (a[0] - z) / (a[0] - b[0]);
    const ease = t * t * (3 - 2 * t);
    return a[column] + (b[column] - a[column]) * ease;
  }
  return z > 12 ? SHORE_PROFILE[0]![column] : SHORE_PROFILE.at(-1)![column];
}
export function shoreX(z: number, side: number) {
  if (z >= 12 || z <= -118) return baselineShoreX(z, side);
  // Blend back into the baseline at the ends to avoid seams.
  const authored = side * profileAt(z, side < 0 ? 1 : 2);
  const edge = Math.min((12 - z) / 6, (z + 118) / 6, 1);
  const blend = edge * edge * (3 - 2 * edge);
  return baselineShoreX(z, side) * (1 - blend) + authored * blend;
}
export function beachWidth(z: number, side: number) {
  return profileAt(z, side < 0 ? 3 : 4);
}
/** Fade the changed contour into the existing hills instead of moving the forest. */
export function remapBankX(x: number, z: number) {
  const side = x < 0 ? -1 : 1;
  const inland = Math.max(0, (x - baselineShoreX(z, side)) * side);
  const t = Math.min(1, inland / 24);
  const influence = 1 - t * t * (3 - 2 * t);
  return x + (shoreX(z, side) - baselineShoreX(z, side)) * influence;
}
const BANK_STEPS = [-1.2, 0, 1.5, 3, 5, 8, 12, 17, 23, 31, 42, 56, 74];
function bankHeight(z: number, distance: number, side: number) {
  if (distance < 0) return -0.5;
  const rise = 1 - Math.exp(-distance / 18);
  return 0.08 + distance * 0.17 + rise * (2.5 + 2.3 * Math.sin(z * 0.045 + side) + 1.3 * Math.sin(z * 0.095 - side * 2))
    + Math.min(distance / 4, 1) * 0.22 * Math.sin(z * 0.48 + distance * 0.7 + side);
}
export function createTerrainGeometry(patch: TerrainPatch, baseline = false) {
  const vertices: Vector3[][] = [];
  if (patch.kind === "bank") {
    const side = patch.side!;
    const depths = baseline ? Array.from({ length: 41 }, (_, row) => 12 - row * 5)
      : [...[12, 7, 2, -3], ...Array.from({ length: 45 }, (_, row) => -8 - row * 2.5), ...Array.from({ length: 14 }, (_, row) => -123 - row * 5)];
    for (const z of depths) {
      vertices.push(BANK_STEPS.map((step) => {
        const distance = !baseline && step > 0 && step <= 3 ? step * beachWidth(z, side) / 3 : step;
        const x = baselineShoreX(z, side) + side * distance;
        return new Vector3(baseline ? x : remapBankX(x, z), bankHeight(z, distance, side), z);
      }));
    }
  } else {
    const layer = patch.layer!;
    const silhouettes = [
      [8, 18, 29, 23, 36, 20, 7, 3, 6, 9, 23, 31, 22, 28, 16],
      [16, 26, 39, 31, 44, 37, 19, 15, 26, 20, 30, 42, 32, 38, 22],
      [22, 32, 49, 39, 53, 43, 28, 23, 32, 27, 42, 52, 40, 46, 29],
    ][layer]!;
    for (let row = 0; row < 4; row++) {
      vertices.push(silhouettes.map((height, i) => new Vector3(-154 + i * 22 + (row === 1 ? 4 : 0), row === 1 ? height : row === 2 ? height * 0.6 : (layer === 0 && row === 0 ? -0.4 : -3), (layer === 0 ? -118 : -174 - layer * 34) - row * 18)));
    }
  }
  const positions: number[] = [];
  for (let row = 0; row < vertices.length - 1; row++) for (let col = 0; col < vertices[row]!.length - 1; col++) {
    const a = vertices[row]![col]!, b = vertices[row]![col + 1]!, c = vertices[row + 1]![col]!, d = vertices[row + 1]![col + 1]!;
    const triangles = (row + col) % 2 ? [[a, b, c], [b, d, c]] : [[a, b, d], [a, d, c]];
    for (const triangle of triangles) {
      const [p, q, r] = triangle as [Vector3, Vector3, Vector3];
      if (new Vector3().subVectors(q, p).cross(new Vector3().subVectors(r, p)).y < 0) triangle.reverse();
      triangle.forEach((v) => positions.push(v.x, v.y, v.z));
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

export function createTerrainSampler(baseline = false) {
  const material = new MeshBasicMaterial();
  const meshes = TERRAIN_PATCHES.map((patch) => {
    const mesh = new Mesh(createTerrainGeometry(patch, baseline), material);
    mesh.userData.supportsTrees = patch.vegetation !== false;
    mesh.updateMatrixWorld(); return mesh;
  });
  // Exact water-plane crossings of the same rendered triangles.
  const shore: [Vector3, Vector3][] = [];
  for (const mesh of meshes) {
    const p = mesh.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i += 3) {
      const triangle = [0, 1, 2].map((n) => new Vector3().fromBufferAttribute(p, i + n));
      const crossings: Vector3[] = [];
      for (let n = 0; n < 3; n++) {
        const a = triangle[n]!, b = triangle[(n + 1) % 3]!;
        if ((a.y <= 0 && b.y > 0) || (a.y > 0 && b.y <= 0)) crossings.push(a.clone().lerp(b, -a.y / (b.y - a.y)));
      }
      if (crossings.length === 2) shore.push(crossings as [Vector3, Vector3]);
    }
  }
  // XZ bins index the rendered triangles once. Queries use exact barycentric
  // interpolation, avoiding thousands of ray/triangle tests for every root vertex.
  type Face = { a: Vector3; b: Vector3; c: Vector3; determinant: number; normalY: number; supportsTrees: boolean };
  const bins = new Map<string, Face[]>();
  for (const mesh of meshes) {
    const positions = mesh.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i += 3) {
      const a = new Vector3().fromBufferAttribute(positions, i), b = new Vector3().fromBufferAttribute(positions, i + 1), c = new Vector3().fromBufferAttribute(positions, i + 2);
      const determinant = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
      if (Math.abs(determinant) < 1e-8) continue;
      const normalY = b.clone().sub(a).cross(c.clone().sub(a)).normalize().y;
      const face = { a, b, c, determinant, normalY, supportsTrees: mesh.userData.supportsTrees === true };
      for (let x = Math.floor(Math.min(a.x, b.x, c.x) / 8); x <= Math.floor(Math.max(a.x, b.x, c.x) / 8); x++)
        for (let z = Math.floor(Math.min(a.z, b.z, c.z) / 8); z <= Math.floor(Math.max(a.z, b.z, c.z) / 8); z++) {
          const key = `${x}:${z}`;
          if (!bins.has(key)) bins.set(key, []);
          bins.get(key)!.push(face);
        }
    }
  }
  function surfaceAt(x: number, z: number) {
    let hit: { height: number; normalY: number; supportsTrees: boolean } | null = null;
    for (const face of bins.get(`${Math.floor(x / 8)}:${Math.floor(z / 8)}`) ?? []) {
      const { a, b, c, determinant } = face;
      const u = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / determinant;
      const v = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / determinant;
      if (u < -1e-7 || v < -1e-7 || u + v > 1.0000001) continue;
      const height = u * a.y + v * b.y + (1 - u - v) * c.y;
      if (!hit || height > hit.height) hit = { height, normalY: face.normalY, supportsTrees: face.supportsTrees };
    }
    return hit;
  }
  function heightAt(x: number, z: number) { return surfaceAt(x, z)?.height ?? null; }
  function shorelineDistance(x: number, z: number) {
    let distance = Infinity;
    for (const [a, b] of shore) {
      const dx = b.x - a.x, dz = b.z - a.z;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
      distance = Math.min(distance, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
    }
    return distance;
  }
  return { surfaceAt, heightAt, shorelineDistance, dispose() { meshes.forEach((mesh) => mesh.geometry.dispose()); material.dispose(); } };
}
