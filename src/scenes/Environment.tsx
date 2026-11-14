import { Color } from "three";
import { Suspense, useMemo } from "react";
import type { TerrainPatch } from "./terrain";
import type { ScenePalette } from "./config";
import { beachWidth, createTerrainGeometry, shoreX, TERRAIN_PATCHES } from "./terrain";

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
export function Environment({ palette, night }: { palette: ScenePalette; night: boolean }) {
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
      <hemisphereLight args={[night ? "#badbe9" : "#ebefd6", palette.shore, palette.ambient]} />
      <directionalLight castShadow shadow-autoUpdate={false} shadow-needsUpdate shadow-mapSize={[1024, 1024]} shadow-camera-left={-75} shadow-camera-right={75} shadow-camera-top={110} shadow-camera-bottom={-110} shadow-camera-far={240} shadow-normalBias={0.06} position={[-30, 65, 10]} color={night ? "#b2d7ee" : "#fff2d1"} intensity={palette.sunlight} />
      {/* Perspective-scaled sky objects sit beyond the ridges; both discs are
          slightly higher than their previous framing, without changing size. */}
      <mesh name={night ? "moon" : "sun"} position={[-78, 72.6, -299]}>
        <sphereGeometry args={[night ? 6 : 9, 20, 12]} />
        <meshBasicMaterial color={palette.celestial} fog={false} />
      </mesh>
      {night && <points name="stars">
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[stars, 3]} /></bufferGeometry>
        <pointsMaterial color={palette.celestial} size={0.15} sizeAttenuation transparent opacity={0.65} depthWrite={false} />
      </points>}
      {!night && [-1, 1].map((side) => <group key={side} position={side < 0 ? [-114, 66.6, -314] : [38, 30, -100]} scale={side < 0 ? 3 : 1}>
        {[0, 1, 2].map((index) => <mesh key={index} position={[index * 5, index === 1 ? 2.5 : 0, 0]} scale={[index === 1 ? 6 : 7, index === 1 ? 3.7 : 2.1, 3]}>
          <icosahedronGeometry args={[1, 1]} /><meshBasicMaterial color={palette.cloud} fog={side > 0} />
        </mesh>)}
      </group>)}
      {TERRAIN_PATCHES.map((patch) => <Terrain key={patch.id} patch={patch} palette={palette} />)}
      <Suspense fallback={null}><KenneyVegetation /></Suspense>
      </group>
    </>
  );
}
