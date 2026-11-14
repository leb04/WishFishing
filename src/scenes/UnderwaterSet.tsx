import { useMemo, useRef } from "react";
import { BackSide, DoubleSide, Group, MathUtils, Mesh, Points, ShaderMaterial } from "three";
import { useFrame } from "@react-three/fiber";
import { WATER_LEVEL } from "./terrain";

const surfaceVertex = `
  varying vec2 lakeUv;
  varying vec3 worldPosition;
  void main() {
    lakeUv = uv;
    worldPosition = (modelMatrix * vec4(position, 1.)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  }
`;
const surfaceFragment = `
  uniform float time;
  varying vec2 lakeUv;
  varying vec3 worldPosition;
  void main() {
    vec2 p = worldPosition.xz * .86;
    float a = sin(p.x * 1.8 + p.y * 1.4 + sin(p.y * 1.9 - time) + time * .8);
    float b = sin(p.y * 2.2 - p.x * .9 + sin(p.x * 2.4 + time * .7));
    float glint = pow(max(0., a * .5 + b * .5), 4.);
    float glow = exp(-length((lakeUv - vec2(.51, .47)) * vec2(3.5, 4.4)) * 2.);
    float fade = 1. - smoothstep(4., 23., distance(worldPosition, cameraPosition));
    gl_FragColor = vec4(mix(vec3(.018,.18,.24), vec3(.23,.66,.70), glow * .8 + glint * .26), fade);
  }
`;
const shaftFragment = `
  varying vec2 lakeUv;
  void main() {
    float feather = 1. - smoothstep(0., .5, abs(lakeUv.x - .5));
    float lengthFade = smoothstep(0., .85, lakeUv.y) * (1. - smoothstep(.88, 1., lakeUv.y));
    gl_FragColor = vec4(.33, .79, .83, feather * lengthFade * .19);
  }
`;

const depthVertex = `
  varying vec3 waterPosition;
  void main() {
    waterPosition = (modelMatrix * vec4(position, 1.)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  }
`;
const depthFragment = `
  varying vec3 waterPosition;
  void main() {
    float depth = smoothstep(0., 11., -waterPosition.y);
    float glow = exp(-abs(waterPosition.x + .9) * .14) * (1. - depth);
    gl_FragColor = vec4(mix(vec3(.012,.035,.072), vec3(.026,.19,.24), glow), 1.);
  }
`;

export function UnderwaterSet() {
  const root = useRef<Group>(null);
  const surface = useRef<ShaderMaterial>(null);
  const beams = useRef<Group>(null);
  const plankton = useRef<Points>(null);
  const bubbleRefs = useRef<(Mesh | null)[]>([]);
  const uniforms = useMemo(() => ({ time: { value: 0 } }), []);
  const dust = useMemo(() => {
    const positions = new Float32Array(120 * 3);
    for (let i = 0; i < 120; i++) {
      positions[i * 3] = Math.sin(i * 41.37) * 6.2;
      positions[i * 3 + 1] = -0.3 - (i * 0.618 % 1) * 9;
      positions[i * 3 + 2] = -11 + Math.cos(i * 5.69) * 4.8;
    }
    return positions;
  }, []);

  useFrame(({ camera, clock }) => {
    if (!root.current) return;
    root.current.visible = camera.position.y < WATER_LEVEL;
    if (!root.current.visible) return;
    const time = clock.elapsedTime;
    if (surface.current) surface.current.uniforms.time!.value = time;
    if (beams.current) beams.current.rotation.y = Math.sin(time * 0.35) * 0.07;
    if (plankton.current) {
      plankton.current.position.set(Math.sin(time * 0.22) * 0.2, Math.sin(time * 0.34) * 0.18, 0);
      plankton.current.rotation.z = Math.sin(time * 0.17) * 0.022;
    }
    bubbleRefs.current.forEach((bubble, index) => {
      if (!bubble) return;
      const rise = (time * (0.36 + index % 4 * 0.09) + index * 0.217) % 1;
      bubble.position.y = -7.6 + rise * 7.4;
      bubble.position.x = -1.65 + index % 6 * 0.54 + Math.sin(time * 1.7 + index) * 0.08;
      bubble.scale.setScalar(MathUtils.smoothstep(rise, 0, 0.14) * (1 - MathUtils.smoothstep(rise, 0.85, 1)));
    });
  }, -1);

  return (
    <group ref={root} visible={false} name="underwater-set">
      <mesh position={[-0.35, -4.9, -8]}>
        <sphereGeometry args={[24, 22, 14]} />
        <shaderMaterial side={BackSide} vertexShader={depthVertex} fragmentShader={depthFragment} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.35, -0.012, -8]}>
        <planeGeometry args={[50, 50]} />
        <shaderMaterial ref={surface} side={BackSide} uniforms={uniforms} vertexShader={surfaceVertex} fragmentShader={surfaceFragment} transparent depthWrite={false} />
      </mesh>
      <group ref={beams} position={[-0.2, -0.1, -11.4]}>
        {[-1, 0, 1].map((index) => (
          <mesh key={index} position={[index * 1.85, -4, -Math.abs(index) * 0.6]} rotation={[0, 0, -0.24]}>
            <planeGeometry args={[0.7 + Math.abs(index) * 0.3, 8]} />
            <shaderMaterial vertexShader={surfaceVertex} fragmentShader={shaftFragment} transparent depthWrite={false} side={DoubleSide} />
          </mesh>
        ))}
      </group>
      <points ref={plankton}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[dust, 3]} /></bufferGeometry>
        <pointsMaterial color="#9fd8dc" size={0.024} transparent opacity={0.44} depthWrite={false} />
      </points>
      <group>
        {Array.from({ length: 18 }, (_, index) => (
          <mesh key={index} ref={(mesh) => { bubbleRefs.current[index] = mesh; }} position={[0, -2, -7.2 - index % 5 * 0.74]}>
            <sphereGeometry args={[0.016 + index % 4 * 0.009, 7, 5]} />
            <meshBasicMaterial color="#bbefde" transparent opacity={0.36} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
