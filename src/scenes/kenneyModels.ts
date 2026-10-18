import { Box3, Mesh, MeshStandardMaterial, Vector3 } from "three";
import type { BufferGeometry, Material, Object3D } from "three";

export interface NatureBounds {
  height: number;
  radius: number;
  contacts: Vector3[];
}
export interface PreparedNatureModel extends NatureBounds {
  parts: { geometry: BufferGeometry; material: Material | Material[] }[];
  dispose: () => void;
}

/** Bake exporter transforms and normalize each actual model's bottom pivot, once. */
export function prepareNatureModel(scene: Object3D, rock = false): PreparedNatureModel {
  scene.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(scene);
  const center = bounds.getCenter(new Vector3());
  const offset = new Vector3(-center.x, -bounds.min.y, -center.z);
  const height = bounds.max.y - bounds.min.y;
  const parts: PreparedNatureModel["parts"] = [];
  const contacts: Vector3[] = [];
  const materials = new Map<Material, Material>();
  let radius = 0;
  function materialFor(source: Material) {
    let material = materials.get(source);
    if (!material) {
      material = source.clone();
      // The exports mark organic surfaces metallic. Use the unchanged pond lights,
      // preserving roughness without adding showcase environment lights.
      if (material instanceof MeshStandardMaterial) {
        material.metalness = 0;
        // Production-only daylight grading; never mutate the cached showcase source.
        if (material.color.g > material.color.r * 1.1) {
          material.color.r *= 0.32; material.color.g *= 0.62; material.color.b *= 0.55;
        } else if (rock) material.color.set("#8b9290");
      }
      materials.set(source, material);
    }
    return material;
  }
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld).translate(...offset.toArray());
    const position = geometry.getAttribute("position");
    for (let i = 0; i < position.count; i++) {
      const vertex = new Vector3().fromBufferAttribute(position, i);
      radius = Math.max(radius, Math.hypot(vertex.x, vertex.z));
      if (vertex.y <= height * 0.025) contacts.push(vertex);
    }
    parts.push({ geometry, material: Array.isArray(object.material) ? object.material.map(materialFor) : materialFor(object.material) });
  });
  return { height, radius, contacts, parts, dispose() {
    parts.forEach(({ geometry }) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  } };
}
