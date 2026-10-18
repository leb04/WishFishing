import { useCallback, useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, PlaneGeometry, Vector2 } from "three";
import { BOBBER, SCENE_PALETTES } from "./config";
import { WATER_LEVEL } from "./terrain";
import { colorWaterSurface } from "./waterSurface";
import { WATER_SHADER_COLOR, WATER_SHADER_DECLARATIONS, WATER_SHADER_LIGHT } from "./waterShader";
import type { ScenePalette } from "./config";

export function Water({ palette, animate }: { palette: ScenePalette; animate: boolean }) {
  const surface = useRef<PlaneGeometry>(null);
  const uniforms = useRef({
    uLakeTime: { value: 0 }, uLakeNight: { value: 0 },
    uLakeSky: { value: new Color() }, uLakeGlint: { value: new Color() },
    uLakeBobber: { value: new Vector2(BOBBER[0], BOBBER[2]) },
  });
  useLayoutEffect(() => {
    if (surface.current) colorWaterSurface(surface.current, palette);
    uniforms.current.uLakeSky.value.set(palette.sky);
    uniforms.current.uLakeGlint.value.set(palette.glint);
    uniforms.current.uLakeNight.value = palette === SCENE_PALETTES.dark ? 1 : 0;
  }, [palette]);

  const shadeWater = useCallback((shader: Parameters<import("three").MeshStandardMaterial["onBeforeCompile"]>[0]) => {
    Object.assign(shader.uniforms, uniforms.current);
    shader.vertexShader = "varying vec3 vLakeWorld;\n" + shader.vertexShader
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLakeWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = WATER_SHADER_DECLARATIONS + shader.fragmentShader
      .replace("#include <color_fragment>", "#include <color_fragment>\n" + WATER_SHADER_COLOR)
      .replace("#include <opaque_fragment>", WATER_SHADER_LIGHT + "\n#include <opaque_fragment>");
  }, []);

  useFrame((_, delta) => {
    if (animate) uniforms.current.uLakeTime.value += Math.min(delta, 0.05);
  });
  return <group name="lake">
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER_LEVEL, -26]}>
      <planeGeometry ref={surface} args={[400, 400, 90, 90]} />
      <meshStandardMaterial vertexColors roughness={0.38} metalness={0.06} onBeforeCompile={shadeWater} />
    </mesh>
  </group>;
}
