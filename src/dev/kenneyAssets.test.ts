import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import provenance from "./assets/kenney-nature/provenance.json";
import { KENNEY_ASSETS } from "./kenneyAssets";

describe("official Kenney showcase assets", () => {
  it("contains only the selected six original GLBs with complete embedded resources", () => {
    expect(KENNEY_ASSETS).toHaveLength(6);
    expect(provenance.assets.map((asset) => asset.file).sort()).toEqual(KENNEY_ASSETS.map((asset) => `${asset.name}.glb`).sort());
    for (const asset of provenance.assets) {
      const data = readFileSync(new URL(`./assets/kenney-nature/${asset.file}`, import.meta.url));
      expect(data.length).toBe(asset.bytes);
      expect(createHash("sha256").update(data).digest("hex")).toBe(asset.sha256);
      expect(data.readUInt32LE(0)).toBe(0x46546c67);
      expect(data.readUInt32LE(4)).toBe(2);
      expect(data.readUInt32LE(8)).toBe(data.length);
      expect(data.readUInt32LE(16)).toBe(0x4e4f534a);
      const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
      expect(gltf.meshes.length).toBeGreaterThan(0);
      expect(gltf.materials.length).toBeGreaterThan(0);
      for (const buffer of gltf.buffers) expect(buffer.uri).toBeUndefined();
      for (const image of gltf.images ?? []) expect(image.uri).toBeUndefined();
    }
  });

  it("retains the official pack license and provenance", () => {
    const license = readFileSync(new URL("./assets/kenney-nature/License.txt", import.meta.url), "utf8");
    expect(license).toContain("Nature Kit (2.1)");
    expect(license).toContain("Creative Commons Zero, CC0");
    expect(provenance.source).toBe("https://kenney.nl/assets/nature-kit");
    expect(provenance.license).toBe("CC0-1.0");
  });
});
