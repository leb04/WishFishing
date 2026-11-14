import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { DirectionalLight, InstancedMesh, Object3D } from "three";
import type { NatureModel } from "./kenneyAssetPaths";
import { KENNEY_URLS } from "./kenneyAssetPaths";
import { prepareNatureModel } from "./kenneyModels";
import type { PreparedNatureModel } from "./kenneyModels";
import { placeNature } from "./kenneyPlacement";
import type { NaturePlacement } from "./kenneyPlacement";

const names = Object.keys(KENNEY_URLS) as NatureModel[];
const urls = names.map((name) => KENNEY_URLS[name]);
function Instances({ part, placements, name }: {
  part: PreparedNatureModel["parts"][number]; placements: NaturePlacement[]; name: string;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const transform = new Object3D();
    placements.forEach((p, index) => {
      transform.position.set(p.x, p.y, p.z);
      transform.quaternion.copy(p.rotation);
      transform.scale.setScalar(p.scale);
      transform.updateMatrix();
      ref.current?.setMatrixAt(index, transform.matrix);
    });
    if (ref.current) { ref.current.instanceMatrix.needsUpdate = true; ref.current.computeBoundingSphere(); }
  }, [placements]);
  return <instancedMesh castShadow receiveShadow name={name} ref={ref} args={[part.geometry, part.material, placements.length]} dispose={null} />;
}

export function KenneyVegetation() {
  const gltfs = useGLTF(urls, false, false);
  const { scene, invalidate } = useThree();
  const data = useMemo(() => {
    const models = Object.fromEntries(names.map((name, index) => [name, prepareNatureModel(gltfs[index]!.scene, name === "boulder" || name === "smallRock")])) as Record<NatureModel, PreparedNatureModel>;
    const placements = placeNature(models);
    return { models, batches: names.map((name) => ({ name, placements: placements.filter((p) => p.model === name) })) };
  }, [gltfs]);
  useEffect(() => () => Object.values(data.models).forEach((model) => model.dispose()), [data]);
  useLayoutEffect(() => {
    // Vegetation is the only shadow caster and its instances stay in place.
    scene.traverse(object => {
      if (object instanceof DirectionalLight && object.castShadow) object.shadow.needsUpdate = true;
    });
    invalidate();
  }, [data, scene, invalidate]);
  return <group name="kenney-nature">
    {data.batches.map(({ name, placements }) => placements.length > 0 && data.models[name].parts.map((part, index) =>
      <Instances key={`${name}-${index}`} name={`kenney-${name}`} part={part} placements={placements} />))}
  </group>;
}
