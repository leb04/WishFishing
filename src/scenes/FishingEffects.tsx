import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh, MeshBasicMaterial, Object3D, InstancedMesh } from 'three';
import type { FishingPose } from '../lib/cinematic';

const SPRAY_DROPS = 40;

export function FishingEffects({ pose, busy, escaping }: { pose: FishingPose; busy: boolean; escaping: boolean }) {
  const splash = useRef<InstancedMesh>(null);
  const ring = useRef<Mesh>(null);
  const impactRing = useRef<Mesh>(null);
  const outerRing = useRef<Mesh>(null);
  const root = useRef<Group>(null);
  const scratch = useMemo(() => new Object3D(), []);
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    if (!root.current || !splash.current || !ring.current || !impactRing.current || !outerRing.current) return;
    root.current.visible = busy;
    if (!busy) { elapsed.current = 0; return; }
    elapsed.current += Math.min(delta, 0.05);
    root.current.position.set(escaping ? pose.escapeX + 0.11 : pose.bobberX, 0.025, escaping ? pose.escapeZ : pose.bobberZ);
    const progress = pose.splash;
    splash.current.visible = progress > 0 && progress < 1;
    if (splash.current.visible) for (let i = 0; i < SPRAY_DROPS; i++) {
      const angle = i * 2.39996;
      const speed = 0.5 + (i % 7) * 0.19;
      const radius = progress * speed * pose.splashSize;
      scratch.position.set(Math.cos(angle) * radius,
        Math.sin(progress * Math.PI) * (0.38 + (i % 6) * 0.23) * pose.splashSize, Math.sin(angle) * radius);
      const size = (1 - progress) * pose.splashSize * (i % 3 === 0 ? 0.07 : 0.038);
      scratch.scale.set(size * 0.67, size * (1.3 + speed * 0.68), size * 0.67);
      scratch.rotation.set(Math.sin(angle) * progress, 0, -Math.cos(angle) * progress);
      scratch.updateMatrix();
      splash.current.setMatrixAt(i, scratch.matrix);
    }
    if (splash.current.visible) splash.current.instanceMatrix.needsUpdate = true;
    impactRing.current.visible = progress > 0 && progress < 1;
    impactRing.current.scale.setScalar((0.25 + progress * 1.6) * pose.splashSize);
    (impactRing.current.material as MeshBasicMaterial).opacity = Math.sin(progress * Math.PI) * 0.55;
    const outer = Math.max(0, (progress - 0.16) / 0.84);
    outerRing.current.visible = progress > 0.16 && progress < 1;
    outerRing.current.scale.setScalar((0.22 + outer * 2.15) * pose.splashSize);
    (outerRing.current.material as MeshBasicMaterial).opacity = Math.sin(outer * Math.PI) * 0.42;
    const radius = 0.3 + (elapsed.current * 1.1 % 1) * 0.6;
    ring.current.scale.setScalar(radius * (1 + pose.disturbance));
    (ring.current.material as MeshBasicMaterial).opacity = Math.min(0.55, pose.disturbance * 0.35);
  });
  return <group ref={root} visible={false} name="cinematic-water-effects">
    <instancedMesh ref={splash} args={[undefined, undefined, SPRAY_DROPS]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial color="#a8dfeb" transparent opacity={0.85} />
    </instancedMesh>
    <mesh ref={impactRing} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
      <ringGeometry args={[0.95, 1, 48]} />
      <meshBasicMaterial color="#a8dfeb" transparent opacity={0} depthWrite={false} />
    </mesh>
    <mesh ref={outerRing} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.011, 0]}>
      <ringGeometry args={[0.967, 1, 48]} />
      <meshBasicMaterial color="#d3f6f5" transparent opacity={0} depthWrite={false} />
    </mesh>
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.96, 1, 48]} />
      <meshBasicMaterial color="#addbda" transparent opacity={0} depthWrite={false} />
    </mesh>
  </group>;
}
