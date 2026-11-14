import { expect, it } from 'vitest';
import { BufferGeometry, InstancedInterleavedBuffer, InterleavedBufferAttribute, QuadraticBezierCurve3, Vector3 } from 'three';
import { updateFishingLine } from './fishingLine';

it('preserves segment/GPU buffer identities while following rod and bobber endpoints', () => {
  const geometry = new BufferGeometry();
  const buffer = new InstancedInterleavedBuffer(new Float32Array(22 * 6), 6);
  const start = new InterleavedBufferAttribute(buffer, 3, 0);
  const end = new InterleavedBufferAttribute(buffer, 3, 3);
  geometry.setAttribute('instanceStart', start); geometry.setAttribute('instanceEnd', end);
  const curve = new QuadraticBezierCurve3(new Vector3(1, 3, -2), new Vector3(0.5, 0.8, -5), new Vector3(-0.35, 0.5, -8));
  const sample = new Vector3(); const array = buffer.array;
  for (let frame = 0; frame < 100; frame++) {
    curve.v0.y += 0.001; curve.v2.z += 0.01;
    updateFishingLine(geometry, curve, sample);
    expect(geometry.getAttribute('instanceStart')).toBe(start);
    expect(geometry.getAttribute('instanceEnd')).toBe(end);
    expect(buffer.array).toBe(array);
    expect(start.getY(0)).toBeCloseTo(curve.v0.y);
    expect(end.getZ(21)).toBeCloseTo(curve.v2.z);
    for (let segment = 0; segment < 21; segment++) {
      expect(end.getX(segment)).toBe(start.getX(segment + 1));
      expect(end.getY(segment)).toBe(start.getY(segment + 1));
      expect(end.getZ(segment)).toBe(start.getZ(segment + 1));
    }
  }
  expect(Array.from(buffer.array).every(Number.isFinite)).toBe(true);
  expect(buffer.version).toBe(100);
  geometry.dispose();
});
