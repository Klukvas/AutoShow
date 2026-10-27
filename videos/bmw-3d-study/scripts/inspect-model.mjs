import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';

const bytes = readFileSync(new URL('../assets/bmw-m4.glb', import.meta.url));
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
const binaryStart = 28 + jsonLength;
const meshMatrices = new Map();
function traverse(nodeIndex, parent) {
  const node = gltf.nodes[nodeIndex];
  const local = new THREE.Matrix4();
  if (node.matrix) local.fromArray(node.matrix);
  else local.compose(new THREE.Vector3(...(node.translation ?? [0, 0, 0])), new THREE.Quaternion(...(node.rotation ?? [0, 0, 0, 1])), new THREE.Vector3(...(node.scale ?? [1, 1, 1])));
  const world = parent.clone().multiply(local);
  if (node.mesh !== undefined) meshMatrices.set(node.mesh, { matrix: world, node: node.name });
  for (const child of node.children ?? []) traverse(child, world);
}
for (const node of gltf.scenes[gltf.scene].nodes) traverse(node, new THREE.Matrix4());
function positions(meshIndex) {
  const accessor = gltf.accessors[gltf.meshes[meshIndex].primitives[0].attributes.POSITION];
  const view = gltf.bufferViews[accessor.bufferView];
  const offset = binaryStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const points = [];
  for (let index = 0; index < accessor.count; index++) {
    const base = offset + index * (view.byteStride ?? 12);
    points.push(new THREE.Vector3(bytes.readFloatLE(base), bytes.readFloatLE(base + 4), bytes.readFloatLE(base + 8)).applyMatrix4(meshMatrices.get(meshIndex).matrix).multiplyScalar(0.242));
  }
  return points;
}
const allBounds = new THREE.Box3();
for (let index = 0; index < gltf.meshes.length; index++) for (const point of positions(index)) allBounds.expandByPoint(point);
const center = allBounds.getCenter(new THREE.Vector3());
const normalization = new THREE.Vector3(-center.x, -allBounds.min.y + 0.005, -center.z);
const groups = {};
for (const meshIndex of [27, 28, 29]) {
  const material = gltf.materials[gltf.meshes[meshIndex].primitives[0].material].name;
  const bounds = {};
  for (const raw of positions(meshIndex)) {
    const point = raw.add(normalization);
    const corner = `${point.z > 0 ? 'front' : 'rear'}-${point.x > 0 ? 'right' : 'left'}`;
    (bounds[corner] ??= new THREE.Box3()).expandByPoint(point);
  }
  groups[material] = { node: meshMatrices.get(meshIndex).node, corners: Object.fromEntries(Object.entries(bounds).map(([corner, box]) => [corner, { min: box.min.toArray(), max: box.max.toArray(), center: box.getCenter(new THREE.Vector3()).toArray() }])) };
}
const report = { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, metadata: gltf.asset, meshCount: gltf.meshes.length, groups, axleDirection: [1, 0, 0], note: 'Static only. Four corners spatially separable in each source mesh. Tyre bounds center is candidate axle pivot. Rim and tyre meshes contain all four wheels; calipers remain a separate stationary mesh. No animation/rotation implemented.' };
writeFileSync(new URL('../evidence/model-inspection.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
