import { useEffect, useMemo } from "react";
import { PCFShadowMap } from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { CAMERA, getFraming, SCENE_PALETTES } from "./config";
import type { SceneTheme } from "./config";
import { Environment } from "./Environment";
import { FishingRig } from "./FishingRig";
import { Water } from "./Water";

function SceneContents({ theme, animate, onFailure }: { theme: SceneTheme; animate: boolean; onFailure: () => void }) {
  const { size, gl } = useThree();
  const framing = useMemo(() => getFraming(size.width / Math.max(1, size.height)), [size.width, size.height]);
  const palette = SCENE_PALETTES[theme];

  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => {
      event.preventDefault();
      onFailure();
    };
    canvas.addEventListener("webglcontextlost", lost);
    return () => canvas.removeEventListener("webglcontextlost", lost);
  }, [gl, onFailure]);

  return <>
    <PerspectiveCamera
      makeDefault
      name="pond-camera"
      position={CAMERA.position}
      near={CAMERA.near}
      far={CAMERA.far}
      fov={framing.fov}
      onUpdate={(camera) => camera.lookAt(...CAMERA.target)}
    />
    <Environment palette={palette} night={theme === "dark"} />
    <Water palette={palette} animate={animate} />
    <FishingRig palette={palette} origin={framing.rodOrigin} animate={animate} />
  </>;
}

export default function FishingScene({ theme, animate, onFailure }: { theme: SceneTheme; animate: boolean; onFailure: () => void }) {
  return (
    <Canvas
      shadows={{ type: PCFShadowMap }}
      aria-hidden="true"
      dpr={[1, 1.5]}
      frameloop={animate ? "always" : "demand"}
      camera={{ position: CAMERA.position, near: CAMERA.near, far: CAMERA.far, fov: CAMERA.fov }}
      gl={{ antialias: true, alpha: false, powerPreference: "low-power" }}
    >
      <SceneContents theme={theme} animate={animate} onFailure={onFailure} />
    </Canvas>
  );
}
