import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";
import { MathUtils, PCFShadowMap, PerspectiveCamera as ThreePerspectiveCamera } from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { CAMERA, getFraming, SCENE_PALETTES } from "./config";
import type { SceneLighting } from "./config";
import { Environment } from "./Environment";
import { FishingRig } from "./FishingRig";
import { hasSwimmingSchool, type CinematicFish, type FishingPhase, type FishingPose } from "../lib/cinematic";
import { FishingEffects } from "./FishingEffects";
import { FishSchool } from "./HookedFish";
import { UnderwaterSet } from "./UnderwaterSet";
import { Water } from "./Water";

interface SceneProps { children?: ReactNode; theme: SceneLighting; animate: boolean; onFailure: () => void; onReady: () => void; pose: FishingPose; busy: boolean; phase?: FishingPhase; school?: readonly CinematicFish[]; decoys?: readonly CinematicFish[]; attempt?: number; keepCamera?: boolean }

function SceneContents({ theme, animate, onFailure, onReady, pose, busy, phase, school, decoys = [], attempt = 0, keepCamera = false }: SceneProps) {
  const { size, gl } = useThree();
  const rendered = useRef(false);
  const framing = useMemo(() => getFraming(size.width / Math.max(1, size.height)), [size.width, size.height]);
  const portrait = size.width < size.height;
  useFrame(({ camera, clock }) => {
    if (!(camera instanceof ThreePerspectiveCamera)) return;
    let fov = framing.fov;
    const progress = pose.shotProgress;
    const escaping = phase === "DECOY_ESCAPE";
    const sharedReel = phase === "DECOY_PULL" || phase === "REELING" || escaping ||
      (keepCamera && (phase === "FINAL_APPROACH" || phase === "DECOY_BITE" || phase === "BITING"));
    const x = escaping ? pose.escapeX + 0.11 : pose.bobberX;
    const z = escaping ? pose.escapeZ : pose.bobberZ;
    const shot = sharedReel ? pose.catchShot
      : phase === "SPLASH" ? (pose.catchShot === "hero" ? "hero" : "breach")
        : phase === "REVEALING" || (phase === "RESULT" && pose.reveal === 1) ? "hero" : phase;
    switch (shot) {
      case "WAITING_FOR_BITE":
        camera.position.set(pose.bobberX + 0.95, 0.75, pose.bobberZ + (portrait ? 3.15 : 2.65) - MathUtils.smoothstep(progress, 0, 1) * 0.22);
        camera.lookAt(pose.bobberX - 0.05, 0.24, pose.bobberZ);
        fov = portrait ? 50 : 42;
        break;
      case "UNDERWATER":
      case "DECOY_BITE":
      case "FINAL_APPROACH":
      case "BITING": {
        const dive = shot === "UNDERWATER" ? MathUtils.smootherstep(progress, 0, 0.36) : 1;
        const drift = shot === "UNDERWATER" ? MathUtils.smoothstep(progress, 0.17, 0.69) : 1;
        let push = 1;
        if (shot === "UNDERWATER") push = MathUtils.smootherstep(progress, 0.65, 1);
        if (shot === "FINAL_APPROACH") push = 0.5 + MathUtils.smootherstep(progress, 0.24, 1) * 0.5;
        const bite = shot === "BITING" || shot === "DECOY_BITE";
        const strike = bite ? MathUtils.smoothstep(progress, 0, 1) : 0;
        const title = bite ? MathUtils.smoothstep(progress, 0.04, 0.3) : 0;
        const impact = bite ? Math.sin(Math.PI * Math.min(1, progress * 4)) * 0.22 : 0;
        const fishY = pose.bobberY + pose.leaderY;
        const nearSurface = MathUtils.smoothstep(fishY, -1.1, -0.27);
        const cameraY = MathUtils.lerp(0.75, MathUtils.lerp(-4.15, fishY, push), dive) - strike * 0.19 - nearSurface * 0.22;
        const distance = MathUtils.lerp(portrait ? 2.93 : 2.43, portrait ? 6.6 : 5.05, dive)
          - drift * 0.25 - push * (portrait ? 2.65 : 1.8) - impact;
        camera.position.set(pose.bobberX + 0.95 - drift * 1.28 + push * 0.66, cameraY, pose.bobberZ + distance);
        camera.lookAt(pose.bobberX - 0.05 - push * 0.37 + title * (portrait ? 0.18 : 0.92),
          MathUtils.lerp(0.24, fishY + 0.16 + push * 0.18 - (portrait ? (1 - push) * 0.27 + title * 0.2 : 0), dive),
          pose.bobberZ);
        fov = MathUtils.lerp(portrait ? 50 : 42, portrait ? 60 : 50, dive) - push * (portrait ? 4 : 6);
        break;
      }
      case "fight": {
        const hookDepth = pose.bobberY + pose.leaderY;
        const depth = escaping
          ? MathUtils.lerp(pose.escapeY, keepCamera ? hookDepth : pose.escapeY - 0.55, MathUtils.smoothstep(progress, 0.05, 0.85))
          : hookDepth;
        const chase = MathUtils.smootherstep(pose.reelTime, 0, 1.85);
        const cameraDepth = MathUtils.lerp(MathUtils.lerp(-3.81, -1.33, chase), depth, 0.43);
        camera.position.set(x + 0.33 - chase * 0.95, cameraDepth - 0.19 - chase * 0.4,
          z + (portrait ? 3.9 : 3.35) - chase * 0.5);
        camera.lookAt(x - 0.42, MathUtils.lerp(cameraDepth, depth, 0.35) + 0.34, z);
        fov = portrait ? 56 : 44;
        break;
      }
      case "rod":
        camera.position.set(framing.rodOrigin[0] - 1.15, 2.02, 5.35);
        camera.lookAt(framing.rodOrigin[0] - 0.5, 1.86 - pose.bend, -0.9);
        fov = portrait ? 60 : 45;
        break;
      case "surface": {
        const lean = MathUtils.smootherstep(pose.reelTime, 2.79, 4.67);
        camera.position.set(x + 0.92 - lean * 0.57, 0.47 - lean * 0.18,
          z + (portrait ? 2.65 : 2.1) - lean * 0.45);
        camera.lookAt(x, 0.1 + lean * 0.2, z);
        camera.rotateZ(-lean * 0.043);
        fov = (portrait ? 52 : 41) - lean * 4;
        break;
      }
      case "breach":
      case "hero": {
        const breach = pose.breachProgress;
        const settle = shot === "breach" || phase === "SPLASH" || phase === "DECOY_PULL"
          ? MathUtils.smootherstep(breach, 0.35, 0.86) : 1;
        const falling = pose.escapeY - (pose.escapeY + 0.08) * Math.min(1, progress / 0.22) ** 2 + 0.45;
        const lift = escaping ? MathUtils.lerp(falling, pose.bobberY,
          keepCamera ? MathUtils.smoothstep(progress, 0.3, 0.88) : 0) : pose.bobberY;
        camera.position.set(
          x + MathUtils.lerp(-1.55, 0.44, settle),
          MathUtils.lerp(0.24, 1.13, settle),
          z + MathUtils.lerp(portrait ? 5.15 : 4.08, portrait ? 3.38 : 2.72, settle),
        );
        camera.lookAt(x - MathUtils.lerp(0.35, 0.47, settle),
          MathUtils.lerp(0.39 + lift * 0.48, lift - 0.68, settle), z);
        fov = MathUtils.lerp(portrait ? 56 : 45, portrait ? 54 : 43, settle);
        const recoil = escaping ? 0 : MathUtils.smoothstep(breach, 0, 0.09) * (1 - MathUtils.smoothstep(breach, 0.1, 0.42));
        camera.rotateZ(recoil * 0.048);
        fov += recoil * 3.2;
        break;
      }
      default:
        camera.position.set(...CAMERA.position);
        camera.lookAt(...CAMERA.target);
    }
    if (pose.shake > 0) {
      const time = clock.elapsedTime;
      camera.position.x += Math.sin(time * 44) * pose.shake * (portrait ? 0.045 : 0.075);
      camera.position.y += Math.sin(time * 59 + 0.8) * pose.shake * 0.038;
      camera.rotateZ(Math.sin(time * 38 + 1.6) * pose.shake * 0.017);
    }
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    if (!rendered.current) {
      rendered.current = true;
      onReady();
    }
  }, -2);
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
    <Environment lighting={theme} animate={animate} />
    <Water palette={palette} animate={animate} />
    <FishingRig palette={palette} origin={framing.rodOrigin} animate={animate} pose={pose} busy={busy} />
    <FishingEffects pose={pose} busy={busy} escaping={phase === "DECOY_ESCAPE"} />
    {hasSwimmingSchool(phase) && <UnderwaterSet />}
    {busy && school && phase && <FishSchool pose={pose} phase={phase} school={school} decoys={decoys} attempt={attempt} />}
  </>;
}

export default function FishingScene(props: SceneProps) {
  const { animate } = props;
  return (
    <Canvas
      shadows={{ type: PCFShadowMap }}
      aria-hidden="true"
      dpr={[1, 1.5]}
      frameloop={animate ? "always" : "demand"}
      camera={{ position: CAMERA.position, near: CAMERA.near, far: CAMERA.far, fov: CAMERA.fov }}
      gl={{ antialias: true, alpha: false, powerPreference: "low-power" }}
    >
      <SceneContents {...props} />
      {props.children}
    </Canvas>
  );
}
