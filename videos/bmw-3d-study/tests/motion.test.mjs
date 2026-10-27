import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { motionAt, SPEED, TRAVEL, CRUISE_END, STOP_TIME } from '../motion.js';
import { createWheelRig } from '../wheel-rig.js';

test('cruise joins smooth braking continuously and stops without reverse travel', () => {
  assert.equal(motionAt(0).remaining, TRAVEL);
  let previous = TRAVEL;
  for (let time = 0; time <= 5; time += 0.005) {
    const state = motionAt(time);
    assert.ok(state.remaining <= previous + 1e-12 && state.remaining >= 0);
    assert.ok(state.speed >= -1e-12 && state.speed <= SPEED + 1e-12);
    previous = state.remaining;
  }
  for (const boundary of [CRUISE_END, STOP_TIME]) {
    assert.ok(Math.abs(motionAt(boundary - 1e-7).remaining - motionAt(boundary + 1e-7).remaining) < 1e-6);
    assert.ok(Math.abs(motionAt(boundary - 1e-7).speed - motionAt(boundary + 1e-7).speed) < 1e-6);
  }
});
test('distance derivative equals physical velocity', () => {
  for (const time of [0.5, 1, 1.8, 2, 2.3, 2.49]) {
    const delta = 1e-5;
    const numerical = (motionAt(time + delta).travelled - motionAt(time - delta).travelled) / (2 * delta);
    assert.ok(Math.abs(numerical - motionAt(time).speed) < 1e-5);
  }
});
test('hold is exactly stationary and random/backward seeks have no accumulated state', () => {
  const samples = [0, 1, 1.8, 2.5, 5, 0.7, 4.2, 1.3, 0];
  for (const time of samples) assert.deepEqual(motionAt(time), motionAt(time));
  for (const time of [2.5, 3, 4.5, 5]) assert.deepEqual({ ...motionAt(time), time: 0 }, { ...motionAt(2.5), time: 0 });
  assert.equal(motionAt(-4).time, 0); assert.equal(motionAt(20).time, 5); assert.equal(motionAt(NaN).time, 0);
});

function loadSourceGeometry() {
  const bytes = readFileSync(new URL('../assets/bmw-m4.glb', import.meta.url));
  const length = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + length));
  const binaryStart = 28 + length;
  function attribute(accessorIndex) {
    const accessor = gltf.accessors[accessorIndex], view = gltf.bufferViews[accessor.bufferView];
    const TypedArray = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array }[accessor.componentType];
    const itemSize = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type];
    const start = binaryStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const data = bytes.subarray(start, start + accessor.count * itemSize * TypedArray.BYTES_PER_ELEMENT);
    return new THREE.BufferAttribute(new TypedArray(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)), itemSize);
  }
  const nodes = gltf.nodes.map(node => {
    const group = new THREE.Group(); group.name = node.name;
    if (node.matrix) group.applyMatrix4(new THREE.Matrix4().fromArray(node.matrix));
    if (node.mesh !== undefined) {
      const primitive = gltf.meshes[node.mesh].primitives[0];
      const geometry = new THREE.BufferGeometry();
      for (const [semantic, accessor] of Object.entries(primitive.attributes)) geometry.setAttribute({ POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv' }[semantic] ?? semantic, attribute(accessor));
      if (primitive.indices !== undefined) geometry.setIndex(attribute(primitive.indices));
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ name: gltf.materials[primitive.material].name }));
      mesh.name = node.name; group.add(mesh);
    }
    return group;
  });
  gltf.nodes.forEach((node, index) => (node.children ?? []).forEach(child => nodes[index].add(nodes[child])));
  const model = new THREE.Group(); gltf.scenes[gltf.scene].nodes.forEach(index => model.add(nodes[index]));
  model.scale.setScalar(0.242);
  const box = new THREE.Box3().setFromObject(model), center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -box.min.y + 0.005, -center.z);
  return model;
}

test('real source mesh splits four complete wheels even when early seek translated vehicle', () => {
  const model = loadSourceGeometry(), vehicle = new THREE.Group(); vehicle.add(model);
  vehicle.position.z = -TRAVEL;
  const calipers = []; model.traverse(mesh => { if (mesh.isMesh && mesh.material.name === 'Caliper1Mtl') calipers.push(mesh); });
  assert.equal(calipers.length, 1);
  const caliperMatrix = calipers[0].matrix.clone();
  const { wheels, diagnostics } = createWheelRig(model, vehicle);
  assert.equal(wheels.length, 4); assert.equal(diagnostics.sourceTriangles, diagnostics.rigTriangles);
  assert.equal(diagnostics.sourceTriangles, 18668);
  assert.equal(wheels.reduce((count, wheel) => count + wheel.group.children.length, 0), 8);
  assert.equal(diagnostics.caliperRotates, false);
  assert.ok(wheels.every(wheel => wheel.radius > 0.35 && wheel.radius < 0.39));
  assert.ok(wheels.every(wheel => wheel.group.parent === vehicle && Math.abs(wheel.group.position.z) < 2));
  const pose = time => wheels.map(wheel => { wheel.group.rotation.x = -motionAt(time).remaining / wheel.radius; return wheel.group.rotation.x; });
  const reference = pose(1.3); pose(5); pose(0); assert.deepEqual(pose(1.3), reference);
  assert.deepEqual(pose(2.5), pose(5));
  assert.ok(calipers[0].matrix.equals(caliperMatrix));
  assert.ok(wheels.every(wheel => Math.abs((-motionAt(1).remaining / wheel.radius) * wheel.radius + motionAt(1).remaining) < 1e-12));
});
