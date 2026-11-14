import type { BufferGeometry, InterleavedBufferAttribute, QuadraticBezierCurve3, Vector3 } from 'three';

/** Update Drei's existing segment buffer; setPositions would allocate a GPU buffer each frame. */
export function updateFishingLine(geometry: BufferGeometry, curve: QuadraticBezierCurve3, sample: Vector3) {
  const start = geometry.getAttribute('instanceStart') as InterleavedBufferAttribute;
  const end = geometry.getAttribute('instanceEnd') as InterleavedBufferAttribute;
  if (!start || !end) return;
  for (let i = 0; i < start.count; i++) {
    curve.getPoint(i / start.count, sample);
    start.setXYZ(i, sample.x, sample.y, sample.z);
    curve.getPoint((i + 1) / start.count, sample);
    end.setXYZ(i, sample.x, sample.y, sample.z);
  }
  start.data.needsUpdate = true;
}
