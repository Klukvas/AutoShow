import * as THREE from 'three';

const TYRE = 'Meshesm8rim0011Mtl';
const RIM = 'Meshesm8rim1Mtl';
const cornerFor = point => `${point.z > 0 ? 'front' : 'rear'}-${point.x > 0 ? 'right' : 'left'}`;

function splitCorners(mesh, vehicleInverse) {
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  geometry.applyMatrix4(vehicleInverse.clone().multiply(mesh.matrixWorld));
  const position = geometry.attributes.position;
  const indices = {};
  for (let index = 0; index < position.count; index += 3) {
    const corners = [0, 1, 2].map(offset => cornerFor(new THREE.Vector3().fromBufferAttribute(position, index + offset)));
    if (!corners.every(corner => corner === corners[0])) throw new Error(`Wheel triangle crosses corners: ${mesh.name}`);
    (indices[corners[0]] ??= []).push(index, index + 1, index + 2);
  }
  const result = Object.entries(indices).map(([corner, sourceIndices]) => {
    const part = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      const values = new attribute.array.constructor(sourceIndices.length * attribute.itemSize);
      sourceIndices.forEach((sourceIndex, targetIndex) => {
        for (let axis = 0; axis < attribute.itemSize; axis++) values[targetIndex * attribute.itemSize + axis] = attribute.array[sourceIndex * attribute.itemSize + axis];
      });
      part.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize, attribute.normalized));
    }
    part.computeBoundingBox();
    return { corner, geometry: part, triangles: sourceIndices.length / 3 };
  });
  geometry.dispose();
  return result;
}

export function createWheelRig(model, vehicle) {
  vehicle.updateWorldMatrix(true, true);
  const vehicleInverse = vehicle.matrixWorld.clone().invert();
  const sources = [];
  model.traverse(mesh => { if (mesh.isMesh && [TYRE, RIM].includes(mesh.material.name)) sources.push(mesh); });
  if (sources.length !== 2) throw new Error(`Expected two source wheel meshes, found ${sources.length}`);
  const parts = sources.flatMap(mesh => splitCorners(mesh, vehicleInverse).map(part => ({ ...part, source: mesh })));
  const wheels = parts.filter(part => part.source.material.name === TYRE).map(tyre => {
    const box = tyre.geometry.boundingBox;
    const pivot = box.getCenter(new THREE.Vector3());
    const radius = ((box.max.y - box.min.y) + (box.max.z - box.min.z)) / 4;
    const group = new THREE.Group(); group.name = `wheel-${tyre.corner}`; group.position.copy(pivot);
    const wheelParts = parts.filter(part => part.corner === tyre.corner);
    for (const part of wheelParts) {
      part.geometry.translate(-pivot.x, -pivot.y, -pivot.z);
      const mesh = new THREE.Mesh(part.geometry, part.source.material);
      mesh.name = `${part.source.name}-${part.corner}`; mesh.castShadow = true; mesh.receiveShadow = true;
      group.add(mesh);
    }
    vehicle.add(group);
    return { group, corner: tyre.corner, radius, pivot: pivot.toArray(), triangles: wheelParts.reduce((sum, part) => sum + part.triangles, 0) };
  });
  for (const source of sources) source.removeFromParent();
  if (wheels.length !== 4 || parts.length !== 8) throw new Error('Incomplete wheel split');
  const sourceTriangles = sources.reduce((sum, source) => sum + (source.geometry.index?.count ?? source.geometry.attributes.position.count) / 3, 0);
  const rigTriangles = wheels.reduce((sum, wheel) => sum + wheel.triangles, 0);
  if (sourceTriangles !== rigTriangles) throw new Error('Wheel split lost or duplicated triangles');
  return { wheels, diagnostics: { sourceTriangles, rigTriangles, sourceMeshesRemoved: sources.map(source => source.name), caliperRotates: false, wheels: wheels.map(({ group, ...details }) => details) } };
}
