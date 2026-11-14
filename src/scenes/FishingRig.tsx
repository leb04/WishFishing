import { useMemo, useRef } from "react";
import type { ComponentRef } from "react";
import type { FishingPose } from "../lib/cinematic";
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Group, Quaternion, QuadraticBezierCurve3, Vector3 } from "three";
import { updateFishingLine } from "./fishingLine";
import { BOBBER, ROD_TIP } from "./config";
import type { Point3, ScenePalette } from "./config";

function RodSection({ start, end, width, color }: { start: Point3; end: Point3; width: number; color: string }) {
  const { midpoint, quaternion, length } = useMemo(() => {
    const a = new Vector3(...start);
    const b = new Vector3(...end);
    const direction = b.clone().sub(a);
    return {
      midpoint: a.add(b).multiplyScalar(0.5),
      quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize()),
      length: direction.length(),
    };
  }, [start, end]);
  return <mesh position={midpoint} quaternion={quaternion}>
    <cylinderGeometry args={[width * 0.7, width, length, 8]} />
    <meshStandardMaterial color={color} roughness={0.6} metalness={0.15} />
  </mesh>;
}

export function FishingRig({ palette, origin, animate, pose, busy }: { palette: ScenePalette; origin: Point3; animate: boolean; pose: FishingPose; busy: boolean }) {
  const rod = useRef<Group>(null);
  const bend = useRef<Group>(null);
  const anchor = useRef<Group>(null);
  const fishingLine = useRef<ComponentRef<typeof Line>>(null);
  const scratch = useMemo(() => ({ tip: new Vector3(), end: new Vector3(), middle: new Vector3(),
    curve: new QuadraticBezierCurve3(), sample: new Vector3() }), []);
  const float = useRef<Group>(null);
  const time = useRef(0);
  const tip = useMemo<Point3>(() => [origin[0] + ROD_TIP[0], origin[1] + ROD_TIP[1], origin[2] + ROD_TIP[2]], [origin]);
  const line = useMemo(() => new QuadraticBezierCurve3(
    new Vector3(...tip),
    new Vector3(tip[0] * 0.55, 0.85, -5),
    new Vector3(BOBBER[0], BOBBER[1] + 0.36, BOBBER[2]),
  ).getPoints(22), [tip]);
  useFrame((_, delta) => {
    if (!float.current || !rod.current || !bend.current || !anchor.current) return;
    if (animate) time.current += Math.min(delta, 0.05);
    rod.current.rotation.set(busy ? pose.rodX : 0, 0, busy ? pose.rodZ : 0);
    bend.current.rotation.x = busy ? -pose.bend : 0;
    anchor.current.position.set(busy ? pose.bobberX : BOBBER[0], busy ? pose.bobberY : BOBBER[1], busy ? pose.bobberZ : BOBBER[2]);
    float.current.position.y = busy ? 0 : Math.sin(time.current * 1.3) * 0.035;
    float.current.rotation.z = busy ? pose.rodZ * 2 : Math.sin(time.current * 0.9) * 0.035;
    // World endpoints follow the actual transformed rod tip and bobber cap.
    bend.current.updateWorldMatrix(true, false);
    scratch.tip.set(ROD_TIP[0] + 0.5, ROD_TIP[1] - 1.18, ROD_TIP[2] + 3.9);
    bend.current.localToWorld(scratch.tip);
    float.current.updateWorldMatrix(true, false);
    scratch.end.set(0, 0.36, 0);
    float.current.localToWorld(scratch.end);
    const taut = busy ? pose.taut : 0;
    scratch.middle.set(scratch.tip.x * 0.55, 0.85, -5);
    scratch.sample.copy(scratch.tip).add(scratch.end).multiplyScalar(0.5);
    scratch.middle.lerp(scratch.sample, taut);
    scratch.curve.v0.copy(scratch.tip);
    scratch.curve.v1.copy(scratch.middle);
    scratch.curve.v2.copy(scratch.end);
    if (fishingLine.current) updateFishingLine(fishingLine.current.geometry, scratch.curve, scratch.sample);
  });
  return (
    <group name="fishing-rig">
      <group name="rod-anchor" position={origin}>
        <group name="rod-pivot" ref={rod}>
          <RodSection start={[0, 0, 0]} end={[-0.11, 0.3, -0.85]} width={0.073} color={palette.grip} />
          <RodSection start={[-0.11, 0.3, -0.85]} end={[-0.5, 1.18, -3.9]} width={0.04} color={palette.rod} />
          <group ref={bend} position={[-0.5, 1.18, -3.9]}>
            <RodSection start={[0, 0, 0]} end={[ROD_TIP[0] + 0.5, ROD_TIP[1] - 1.18, ROD_TIP[2] + 3.9]} width={0.025} color={palette.rod} />
            <mesh position={[ROD_TIP[0] * 0.9 + 0.5, ROD_TIP[1] * 0.9 - 1.18, ROD_TIP[2] * 0.9 + 3.9]} rotation={[0.27, 0, 0]}>
              <torusGeometry args={[0.055 * (1 - 0.9 * 0.45), 0.012, 4, 10]} /><meshStandardMaterial color={palette.metal} />
            </mesh>
          </group>
          <mesh name="reel" position={[0.03, 0.2, -0.55]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.16, 0.16, 0.17, 12]} /><meshStandardMaterial color={palette.metal} roughness={0.32} metalness={0.3} />
          </mesh>
          <RodSection start={[0.07, 0.2, -0.55]} end={[0.25, 0.2, -0.55]} width={0.025} color={palette.metal} />
          <mesh position={[0.25, 0.2, -0.55]}><sphereGeometry args={[0.055, 8, 6]} /><meshStandardMaterial color={palette.grip} /></mesh>
          {[0.25, 0.6].map((fraction) => <mesh key={fraction} position={[ROD_TIP[0] * fraction, ROD_TIP[1] * fraction, ROD_TIP[2] * fraction]} rotation={[0.27, 0, 0]}>
            <torusGeometry args={[0.055 * (1 - fraction * 0.45), 0.012, 4, 10]} /><meshStandardMaterial color={palette.metal} />
          </mesh>)}
        </group>
      </group>
      <Line ref={fishingLine} name="fishing-line" frustumCulled={false} points={line} color={palette.line} lineWidth={1} transparent opacity={0.85} />
      <group ref={anchor} name="bobber-anchor" position={BOBBER}>
        <group name="bobber-pivot" ref={float}>
          <mesh position={[0, 0.03, 0]}><sphereGeometry args={[0.16, 12, 8]} /><meshStandardMaterial color={palette.celestial} roughness={0.65} /></mesh>
          <mesh position={[0, 0.18, 0]}><cylinderGeometry args={[0.055, 0.1, 0.24, 10]} /><meshStandardMaterial color={palette.grip} /></mesh>
          <mesh position={[0, 0.36, 0]}><sphereGeometry args={[0.055, 8, 6]} /><meshBasicMaterial color={palette.celestial} /></mesh>
        </group>
      </group>
    </group>
  );
}
