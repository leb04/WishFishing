import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { BOBBER, CAMERA, getFraming, ROD_TIP, SCENE_PALETTES, shouldAnimateScene } from "./config";

describe("first-person framing", () => {
  it.each([0.52, 0.64, 1, 1.43, 2])("keeps the grip, reel, tip, and bobber in frame at aspect %s", (aspect) => {
    const framing = getFraming(aspect);
    const camera = new PerspectiveCamera(framing.fov, aspect, CAMERA.near, CAMERA.far);
    camera.position.set(...CAMERA.position);
    camera.lookAt(...CAMERA.target);
    camera.updateMatrixWorld();
    const grip = new Vector3(...framing.rodOrigin);
    const points = [
      grip,
      grip.clone().add(new Vector3(0.3, 0.2, -0.55)),
      grip.clone().add(new Vector3(...ROD_TIP)),
      new Vector3(...BOBBER),
    ];
    for (const point of points) {
      const projected = point.clone().project(camera);
      expect(Math.abs(projected.x)).toBeLessThan(0.95);
      expect(Math.abs(projected.y)).toBeLessThan(0.95);
      expect(projected.z).toBeGreaterThan(-1);
      expect(projected.z).toBeLessThan(1);
    }
    // The sky/horizon and surface stay above and below the view center.
    expect(new Vector3(0, 0, -90).project(camera).y).toBeGreaterThan(0);
    expect(new Vector3(...BOBBER).project(camera).y).toBeLessThan(0);
  });

  it("keeps daylight and night palettes independent and complete", () => {
    const palettes = Object.values(SCENE_PALETTES);
    for (const palette of palettes) expect(Object.keys(palette).sort()).toEqual(Object.keys(SCENE_PALETTES.light).sort());
    expect(new Set(palettes.map(palette => palette.sky)).size).toBe(palettes.length);
    expect(new Set(palettes.map(palette => palette.water)).size).toBe(palettes.length);
  });
});

describe("ambient render policy", () => {
  const active = { visible: true, inView: true, suspended: false, reducedMotion: false, paused: false };
  it("animates only when visible, onscreen, unobscured, and motion is allowed", () => {
    expect(shouldAnimateScene(active)).toBe(true);
    for (const overrides of [
      { visible: false }, { inView: false }, { suspended: true }, { reducedMotion: true }, { paused: true },
    ]) expect(shouldAnimateScene({ ...active, ...overrides })).toBe(false);
  });
});
