import { Color, type Group, type Mesh, type PointsMaterial } from "three";
import { useFrame } from "@react-three/fiber";
import { memo, Suspense, useMemo, useRef } from "react";
import type { TerrainPatch } from "./terrain";
import { SCENE_PALETTES, type Point3, type SceneLighting, type ScenePalette } from "./config";
import { beachWidth, createTerrainGeometry, shoreX, TERRAIN_PATCHES, WATER_LEVEL } from "./terrain";

import { KenneyVegetation } from "./KenneyVegetation";

function Terrain({ patch, palette }: { patch: TerrainPatch; palette: ScenePalette }) {
  const data = useMemo(() => {
    const geometry = createTerrainGeometry(patch);
    const position = new Float32Array(geometry.getAttribute("position").array);
    const normal = new Float32Array(geometry.getAttribute("normal").array);
    const color = new Color(), grass = new Color(palette.shore), sand = new Color(palette.sand);
    const colors = new Float32Array(position.length);
    for (let i = 0; i < position.length; i += 3) {
      const x = position[i]!, z = position[i + 2]!;
      const distance = Math.abs(x - shoreX(z, x < 0 ? -1 : 1));
      if (patch.kind === "bank") {
        const width = beachWidth(z, x < 0 ? -1 : 1);
        color.copy(sand).lerp(grass, Math.min(1, Math.max(0, (distance - width * 0.35) / (width * 0.65))));
      }
      else color.set(palette[patch.color]);
      const face = Math.floor(i / 9);
      color.multiplyScalar(0.97 + (Math.sin(face * 87.31) * 0.5 + 0.5) * 0.06);
      colors.set([color.r, color.g, color.b], i);
    }
    geometry.dispose();
    return { position, normal, colors };
  }, [patch, palette]);
  return <mesh receiveShadow name={patch.id} position={patch.position} scale={patch.scale} rotation={patch.rotation}>
    <bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[data.position, 3]} />
      <bufferAttribute attach="attributes-normal" args={[data.normal, 3]} />
      <bufferAttribute attach="attributes-color" args={[data.colors, 3]} />
    </bufferGeometry>
    <meshStandardMaterial vertexColors flatShading roughness={1} />
  </mesh>;
}
const SKY_SETTINGS = {
  dawn: { sun: [-45, 53, -299], skyLight: "#f1ddcc", sunLight: "#ffe1bb", drift: 1.1, lift: 2.0 },
  light: { sun: [-78, 72.6, -299], skyLight: "#ebefd6", sunLight: "#fff2d1", drift: 2.5, lift: 0 },
  dusk: { sun: [67, 51, -299], skyLight: "#e2bbce", sunLight: "#ffc7a0", drift: -1.8, lift: -1.5 },
  dark: { sun: [-78, 72.6, -299], skyLight: "#badbe9", sunLight: "#b2d7ee", drift: 0, lift: 0 },
} satisfies Record<SceneLighting, { sun: Point3; skyLight: string; sunLight: string; drift: number; lift: number }>;

export const Environment = memo(function Environment({ lighting, animate }: { lighting: SceneLighting; animate: boolean }) {
  const palette = SCENE_PALETTES[lighting];
  const sky = SKY_SETTINGS[lighting];
  const night = lighting === "dark";
  const scenery = useRef<Group>(null);
  const clouds = useRef<Group>(null);
  const sun = useRef<Mesh>(null);
  const starMaterial = useRef<PointsMaterial>(null);
  const motionTime = useRef(0);
  // Read the camera after SceneContents positions it for this frame.
  useFrame(({ camera }, delta) => {
    if (scenery.current) scenery.current.visible = camera.position.y >= WATER_LEVEL;
    if (!animate) return;
    motionTime.current += Math.min(delta, 0.05);
    const t = motionTime.current;
    if (clouds.current) clouds.current.position.x = Math.sin(t * 0.12) * sky.drift;
    if (sun.current) sun.current.position.y = sky.sun[1] + (1 - Math.cos(t * 0.11)) * sky.lift;
    if (starMaterial.current) starMaterial.current.opacity = 0.65 + Math.sin(t * 0.86) * 0.13;
  }, -1);
  const stars = useMemo(() => {
    const positions = new Float32Array(48 * 3);
    for (let index = 0; index < 48; index++) {
      positions[index * 3] = Math.sin(index * 12.3) * 58;
      positions[index * 3 + 1] = 11 + ((index * 7) % 28);
      positions[index * 3 + 2] = -65 - ((index * 11) % 25);
    }
    return positions;
  }, []);
  return (
    <>
      <color attach="background" args={[palette.sky]} />
      <fog attach="fog" args={[palette.fog, 110, 360]} />
      <group name="environment">
        <hemisphereLight args={[sky.skyLight, palette.shore, palette.ambient]} />
        <directionalLight castShadow shadow-autoUpdate={false} shadow-needsUpdate shadow-mapSize={[1024, 1024]} shadow-camera-left={-75} shadow-camera-right={75} shadow-camera-top={110} shadow-camera-bottom={-110} shadow-camera-far={240} shadow-normalBias={0.06} position={[-30, 65, 10]} color={sky.sunLight} intensity={palette.sunlight} />
        <group ref={scenery} name="above-water-scenery">
          <mesh ref={sun} name={night ? "moon" : "sun"} position={sky.sun}>
            <sphereGeometry args={[night ? 6 : 9, 20, 12]} />
            <meshBasicMaterial color={palette.celestial} fog={false} />
          </mesh>
          {night && <points name="stars">
            <bufferGeometry><bufferAttribute attach="attributes-position" args={[stars, 3]} /></bufferGeometry>
            <pointsMaterial ref={starMaterial} color={palette.celestial} size={0.15} sizeAttenuation transparent opacity={0.65} depthWrite={false} />
          </points>}
          {!night && <group ref={clouds} key={lighting}>{[-1, 1].map((side) => <group key={side} position={side < 0 ? [-114, 66.6, -314] : [38, 30, -100]} scale={side < 0 ? 3 : 1}>
            {[0, 1, 2].map((index) => <mesh key={index} position={[index * 5, index === 1 ? 2.5 : 0, 0]} scale={[index === 1 ? 6 : 7, index === 1 ? 3.7 : 2.1, 3]}>
              <icosahedronGeometry args={[1, 1]} /><meshBasicMaterial color={palette.cloud} fog={side > 0} />
            </mesh>)}
          </group>)}</group>}
          {TERRAIN_PATCHES.map((patch) => <Terrain key={patch.id} patch={patch} palette={palette} />)}
          <Suspense fallback={null}><KenneyVegetation /></Suspense>
        </group>
      </group>
    </>
  );
});
