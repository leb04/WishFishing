import { useEffect, useMemo, useRef } from "react";
import { Color, CubicBezierCurve3, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, MathUtils, Mesh, Object3D, Shape, SphereGeometry, Vector3 } from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { hasSwimmingSchool, type CinematicFish, type FishingPhase, type FishingPose } from "../lib/cinematic";

const UP = new Vector3(0, 1, 0);

function makeFin(points: readonly (readonly [number, number])[]) {
  const shape = new Shape();
  points.forEach(([x, y], i) => i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y));
  shape.closePath();
  return shape;
}

const TAIL = makeFin([[0.03, 0], [-0.37, 0.28], [-0.31, 0.02], [-0.39, -0.25], [-0.1, -0.1]]);
const DORSAL = makeFin([[-0.37, 0.17], [-0.52, 0.39], [-0.88, 0.28], [-0.89, 0.13]]);
const PECTORAL = makeFin([[-0.34, -0.02], [-0.67, -0.26], [-0.61, -0.04]]);
const PELVIC = makeFin([[-0.62, -0.18], [-0.86, -0.34], [-0.92, -0.14]]);

// The mouth is the origin of each fish, so the strike path ends at the hook.
const SWIM_LANES = [
  [-1.72, 0.04, 0.32], [1.92, 0.09, 0.12],
  [-1.45, -0.93, -0.24], [1.59, -0.87, -0.45],
  [-1.52, 0.63, -1.23], [1.42, 0.64, -1.5],
  [-1.62, -0.42, -1.84], [1.76, -0.43, -1.64],
  [-0.61, -1.32, -2.2], [0.83, -1.31, -1.4],
] as const;
const FIN_COLORS = ["#56bdaf", "#77b6cf", "#83cdb0", "#60a4bd", "#8ebbc3"];

type FishSchoolProps = { pose: FishingPose; phase: FishingPhase; school: readonly CinematicFish[]; decoys: readonly CinematicFish[]; attempt: number };

function hookPosition(target: Vector3, pose: FishingPose, time: number) {
  return target.set(
    pose.bobberX - 0.11,
    pose.bobberY + pose.leaderY,
    pose.bobberZ + Math.sin(time * 11) * 0.12 * pose.fishStruggle,
  );
}

export function FishSchool({ pose, phase, school, decoys, attempt }: FishSchoolProps) {
  const root = useRef<Group>(null);
  const leader = useRef<Mesh>(null);
  const hook = useRef<Mesh>(null);
  const bubbles = useRef<InstancedMesh>(null);
  const scratch = useMemo(() => ({ direction: new Vector3(), end: new Vector3(), bubble: new Object3D() }), []);
  const winnerSlot = school.findIndex(fish => fish.catchesHook);
  useFrame(({ clock }) => {
    if (!root.current || !hook.current || !leader.current) return;
    root.current.visible = phase !== "CASTING";
    const { direction, end } = scratch;
    hookPosition(end, pose, clock.elapsedTime);
    hook.current.position.copy(end);
    direction.set(pose.bobberX, pose.bobberY, pose.bobberZ).sub(end);
    leader.current.position.copy(end).addScaledVector(direction, 0.5);
    leader.current.scale.y = direction.length();
    leader.current.quaternion.setFromUnitVectors(UP, direction.normalize());
    if (!bubbles.current) return;
    const impact = phase === "BITING" || phase === "DECOY_BITE" || phase === "DECOY_ESCAPE";
    const progress = Math.min(1, pose.shotProgress * 2.25);
    bubbles.current.visible = impact && progress < 1;
    if (!bubbles.current.visible) return;
    if (phase === "DECOY_ESCAPE") end.set(pose.escapeX, pose.escapeY, pose.escapeZ);
    for (let i = 0; i < 28; i++) {
      const angle = i * 2.39996;
      const spread = progress * (0.55 + (i % 8) * 0.22);
      scratch.bubble.position.set(end.x + Math.cos(angle) * spread,
        end.y + Math.sin(angle) * spread * 0.65 + progress * 0.66, end.z + Math.sin(angle) * spread);
      scratch.bubble.scale.setScalar((1 - progress) * (0.035 + (i % 4) * 0.018));
      scratch.bubble.updateMatrix();
      bubbles.current.setMatrixAt(i, scratch.bubble.matrix);
    }
    bubbles.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={root} name="fish-school">
      <mesh ref={leader}>
        <cylinderGeometry args={[0.008, 0.008, 1, 5]} />
        <meshBasicMaterial color="#b8e8ea" />
      </mesh>
      <mesh ref={hook} rotation={[0, 0, -0.42]}>
        <torusGeometry args={[0.083, 0.014, 6, 14, 4.45]} />
        <meshBasicMaterial color="#f6e7b5" />
      </mesh>
      <instancedMesh ref={bubbles} args={[undefined, undefined, 28]} frustumCulled={false} visible={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color="#a9ecf4" transparent opacity={0.65} depthWrite={false} />
      </instancedMesh>
      {school.map((entry, slot) => (
        (hasSwimmingSchool(phase) || phase === "CASTING" || entry.catchesHook) &&
        <TaggedFish key={entry.id} entry={entry} slot={slot}
          pass={slot > winnerSlot ? slot - 1 : slot}
          phase={phase} pose={pose} decoys={decoys} attempt={attempt} />
      ))}
    </group>
  );
}

function TaggedFish({ entry, slot, pass, phase, pose, decoys, attempt }: Omit<FishSchoolProps, "school"> & { entry: CinematicFish; slot: number; pass: number }) {
  const fish = useRef<Group>(null);
  const tail = useRef<Group>(null);
  const tagAnchor = useRef<Group>(null);
  const tag = useRef<HTMLSpanElement>(null);
  const lane = SWIM_LANES[slot]!;
  const side = Math.sign(lane[0]);
  const facing = side < 0 ? 0 : Math.PI;
  const decoyOrder = decoys.findIndex(candidate => candidate.id === entry.id);
  const isDecoy = decoyOrder >= 0 && decoyOrder === attempt;
  const nextToBite = isDecoy || (entry.catchesHook && attempt >= decoys.length);
  const gone = decoyOrder >= 0 && decoyOrder < attempt;
  const caught = entry.catchesHook && (phase === "BITING" || phase === "REELING" || phase === "SPLASH" || phase === "REVEALING" || phase === "RESULT");
  const holdingBait = isDecoy && (phase === "DECOY_BITE" || phase === "DECOY_PULL");
  const attached = caught || holdingBait;
  const bite = phase === "BITING" || phase === "DECOY_BITE";
  const pulling = phase === "REELING" || phase === "DECOY_PULL";
  const escaping = isDecoy && phase === "DECOY_ESCAPE";
  const fin = FIN_COLORS[slot % FIN_COLORS.length]!;
  const nearMiss = !entry.catchesHook && decoyOrder < 0 && pass < 2;
  const path = useMemo(() => {
    const start = new Vector3(...lane);
    if (entry.catchesHook || decoyOrder >= 0) {
      return new CubicBezierCurve3(start, new Vector3(side * 1.68, -0.45, -0.55),
        new Vector3(side * 0.68, -0.19, 0), new Vector3());
    }
    if (nearMiss) {
      const clearance = pass === 0 ? -0.26 : 0.24;
      return new CubicBezierCurve3(start, new Vector3(side * 0.52, clearance, 0.28),
        new Vector3(-side * 0.48, clearance, -0.18), new Vector3(-side * 3.2, clearance * 3.8, -0.85));
    }
    return new CubicBezierCurve3(start, new Vector3(lane[0] * 0.6, lane[1] - 0.22, lane[2] + 0.24),
      new Vector3(lane[0] * 0.18, lane[1] + 0.24, lane[2] - 0.45),
      new Vector3(lane[0] * 0.32, lane[1] - 0.05, lane[2] - 0.85));
  }, [entry.catchesHook, decoyOrder, lane, nearMiss, pass, side]);
  const swim = useMemo(() => ({ offset: new Vector3(), next: new Vector3(), previous: new Vector3() }), []);
  const body = useMemo(() => {
    const geometry = new SphereGeometry(1, 24, 16);
    const position = geometry.attributes.position!;
    const colors: number[] = [];
    const belly = new Color("#e5ecbe"), flank = new Color(fin);
    const back = new Color("#204f66"), stripe = new Color("#26788d"), color = new Color();
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      const taper = 0.77 + 0.23 * x;
      position.setXYZ(i, x * 0.53 - 0.53, y * 0.31 * taper, z * 0.24 * taper);
      if (y < 0) color.copy(flank).lerp(belly, -y);
      else color.copy(flank).lerp(back, y);
      const band = Math.sin((x * 3.6 + y * 0.48) * Math.PI);
      if (band > 0.64 && x < 0.35) color.lerp(stripe, (band - 0.64) * 1.25 * Math.max(0, y + 0.45));
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, [fin]);
  useEffect(() => () => body.dispose(), [body]);

  useFrame(({ camera, clock }, delta) => {
    if (!fish.current || !tail.current || !tagAnchor.current) return;
    const time = clock.elapsedTime;
    const beat = time * 22 + slot * 1.7;
    const progress = pose.shotProgress;
    const position = hookPosition(fish.current.position, pose, time);

    if (attached) {
      const yaw = bite ? MathUtils.lerp(facing, facing === 0 ? -0.16 : Math.PI * 2 - 0.16, MathUtils.smoothstep(progress, 0.07, 0.88)) : -0.16;
      const struggle = pose.fishStruggle;
      const pitch = bite
        ? MathUtils.lerp(0.26, pose.fishPitch, MathUtils.smoothstep(progress, 0, 0.28)) : pose.fishPitch;
      fish.current.rotation.set(Math.sin(beat) * 0.13 * struggle, yaw + Math.sin(beat * 0.55) * 0.23 * struggle, pitch);
      tail.current.rotation.y = Math.sin(beat + 0.5) * (0.25 + struggle * 0.65);
    } else {
      const movingIn = entry.catchesHook || decoyOrder >= 0;
      let approach = movingIn ? 0.29 : 1;
      if (phase === "CASTING" || phase === "WAITING_FOR_BITE") approach = 0;
      if (phase === "UNDERWATER") {
        approach = movingIn
          ? 0.29 * MathUtils.smoothstep(progress, 0.12, 0.62) + (nextToBite ? 0.71 * MathUtils.smootherstep(progress, 0.69, 1) : 0)
          : nearMiss ? MathUtils.smootherstep(progress, 0.1 + pass * 0.25, 0.59 + pass * 0.27)
            : MathUtils.smoothstep(progress, 0.05 + (slot % 3) * 0.09, 1);
      }
      if (nextToBite && phase === "FINAL_APPROACH") approach = 0.29 + 0.71 * MathUtils.smootherstep(progress, 0.12, 1);
      if (isDecoy && phase === "DECOY_ESCAPE") approach = 1;
      path.getPoint(approach, swim.offset);
      path.getPoint(Math.min(1, approach + 0.02), swim.next);
      path.getPoint(Math.max(0, approach - 0.02), swim.previous);
      swim.next.sub(swim.previous);
      const escape = isDecoy && phase === "DECOY_ESCAPE" ? MathUtils.smoothstep(progress, 0.06, 0.88) : 0;
      const retreat = bite ? MathUtils.smoothstep(progress, 0, 0.9)
        : pulling ? 1 : phase === "DECOY_ESCAPE" ? 1 - MathUtils.smoothstep(progress, 0.12, 0.95) : 0;
      const drift = movingIn ? 1 - approach : 1;
      const swimTime = time * (1.15 + slot * 0.05) + slot * 2.19;
      // The school holds its depth when a hooked fish is lifted.
      const depthSettled = phase === "UNDERWATER" ? MathUtils.smoothstep(progress, 0.35, 0.63) : 1;
      position.x = MathUtils.lerp(position.x, -0.46, drift);
      position.y = MathUtils.lerp(position.y, -3.8, drift * depthSettled);
      position.z = MathUtils.lerp(position.z, -8, drift);
      position.add(swim.offset);
      if (drift > 0) {
        position.x += Math.sin(swimTime) * 0.42 * drift;
        position.y += Math.cos(swimTime * 1.38) * 0.16 * drift;
        position.z += Math.cos(swimTime) * 0.45 * drift;
      }
      position.y -= retreat * 0.85;
      // Ease shallow swimmers away from the underside of the surface.
      if (position.y > -0.45) position.y = -0.45 + 0.2 * (1 - Math.exp(-(position.y + 0.45) / 0.2));
      position.x += retreat * (nearMiss ? -side : side) * 2.6;
      position.z -= retreat * 0.65;
      if (isDecoy && phase === "DECOY_ESCAPE") {
        // Leave from the point where the hook released, independent of the falling line.
        if (pose.escapeY > 0) {
          const fall = Math.min(1, progress / 0.22);
          const diveAway = MathUtils.smoothstep(progress, 0.22, 0.88);
          position.set(pose.escapeX - side * (fall * 0.45 + diveAway * 3.4),
            pose.escapeY - (pose.escapeY + 0.08) * fall * fall - diveAway * 2.25, pose.escapeZ - diveAway * 0.95);
        } else {
          position.set(pose.escapeX - side * escape * 4.9,
            pose.escapeY - escape * 1.55, pose.escapeZ - escape * 0.95);
        }
      }
      const yaw = swim.next.lengthSq() > 0.000001 ? Math.atan2(-swim.next.z * 0.56, swim.next.x) : facing;
      const escapeYaw = nearMiss ? facing : facing + Math.PI;
      const pitch = movingIn ? MathUtils.lerp(0.02, isDecoy && phase === "DECOY_ESCAPE" ? pose.escapePitch : 0.26, approach) * (1 - escape)
        : Math.sin(swimTime * 1.38) * 0.15;
      const swimYaw = MathUtils.lerp(yaw, escapeYaw, retreat) + Math.sin(swimTime * 0.85) * 0.42 * drift;
      fish.current.rotation.set(Math.sin(swimTime) * 0.14 * drift,
        escaping ? MathUtils.lerp(-0.16, side < 0 ? 0 : -Math.PI, MathUtils.smoothstep(progress, 0, 0.35)) : swimYaw, pitch);
      tail.current.rotation.y = Math.sin(beat * 0.8) * (0.23 + (nearMiss || entry.catchesHook ? approach * 0.28 : 0));
    }

    tagAnchor.current.position.z = MathUtils.damp(tagAnchor.current.position.z,
      Math.cos(fish.current.rotation.y) * 0.23, 17, delta);
    const emerging = phase === "UNDERWATER" ? MathUtils.smootherstep(progress, 0.25 + (slot % 3) * 0.04, 0.48 + (slot % 3) * 0.06) : 1;
    position.z -= (1 - emerging) * (2 + slot % 3 * 0.65);
    const swimmingVisible = camera.position.y < 0 && phase !== "WAITING_FOR_BITE" && emerging > 0 && !gone;
    const aboveWater = position.y > 0.05 && (attached || escaping);
    fish.current.visible = swimmingVisible || aboveWater;
    if (tag.current) {
      const visibility = swimmingVisible || aboveWater ? "visible" : "hidden";
      if (tag.current.style.visibility !== visibility) tag.current.style.visibility = visibility;
      const opacity = String(MathUtils.smoothstep(emerging, 0.28, 0.9));
      if (tag.current.style.opacity !== opacity) tag.current.style.opacity = opacity;
    }
  }, -1);

  return (
    <group ref={fish} name={caught ? "hooked-fish" : "swimming-fish"} scale={0.84}>
      <mesh geometry={body}>
        <meshStandardMaterial vertexColors roughness={0.32} emissive="#164449" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[-0.37, 0.005, 0.194]} rotation={[0, 0.22, -0.12]} scale={[0.15, 0.1, 0.035]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color="#409897" roughness={0.55} />
      </mesh>
      <group ref={tail} position={[-1.02, 0, 0]}>
        <mesh>
          <shapeGeometry args={[TAIL]} />
          <meshStandardMaterial color={fin} side={DoubleSide} roughness={0.55} />
        </mesh>
      </group>
      {[DORSAL, PECTORAL, PELVIC].map((fin, index) => (
        <mesh key={fin.uuid} position={[0, 0, index === 1 ? 0.17 : 0.015]} rotation={index === 1 ? [-0.36, 0, 0] : undefined}>
          <shapeGeometry args={[fin]} />
          <meshStandardMaterial color={index === 1 ? "#a2dac1" : "#439d9a"} side={DoubleSide} />
        </mesh>
      ))}
      {[-1, 1].map(side => (
        <group key={side} position={[-0.26, 0.075, side * 0.174]}>
          <mesh scale={[1, 1, 0.58]}>
            <sphereGeometry args={[0.067, 12, 8]} />
            <meshBasicMaterial color="#f5db98" />
          </mesh>
          <mesh position={[0.009, 0, side * 0.031]} scale={[1, 1, 0.5]}>
            <sphereGeometry args={[0.035, 10, 6]} />
            <meshBasicMaterial color="#102631" />
          </mesh>
          <mesh position={[0.016, 0.016, side * 0.047]}>
            <sphereGeometry args={[0.012, 6, 4]} />
            <meshBasicMaterial color="#fff9db" />
          </mesh>
        </group>
      ))}
      <group ref={tagAnchor} position={[-0.56, 0.015, 0.21]}>
        <Html center zIndexRange={[2, 1]} style={{ pointerEvents: "none" }}>
          <span ref={tag} aria-hidden="true" className="fish-tag" data-ticket={/^\d+$/.test(entry.label)} data-biting={attached}>{entry.label}</span>
        </Html>
      </group>
    </group>
  );
}
