import * as THREE from 'three';
import { createWheelRig } from './wheel-rig.js';
import { motionAt, DURATION } from './motion.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

const canvas = document.querySelector('#car');
const loading = document.querySelector('#loading');
const status = document.querySelector('#status');
const isPreview = new URLSearchParams(location.search).has('preview');
const isStreet = new URLSearchParams(location.search).get('environment') === 'street';
const retry = document.querySelector('#retry');
const clean = new URLSearchParams(location.search).has('clean');
if (clean) document.body.classList.add('clean');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#141719');
scene.fog = new THREE.FogExp2('#141719', 0.028);
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.05, 70);
const initialView = new URLSearchParams(location.search).get('view') === 'wide'
  ? { position: [5.1, 1.65, 5.1], target: [0, 0.65, 0.25] }
  : { position: [3.3, 0.72, 3.62], target: [0.6, 0.68, 2.0] };
let renderer;
let controls;
let model;
let rig;
let timeline;
const vehicle = new THREE.Group();
const contactShadows = new THREE.Group();
scene.add(vehicle, contactShadows);
let currentTime = isPreview ? DURATION : 0;
const wheelParts = [];
const meshes = [];

function render() { if (renderer) renderer.render(scene, camera); }
function restoreView() {
  camera.position.fromArray(initialView.position);
  if (!controls) { camera.lookAt(...initialView.target); render(); return; }
  controls.target.fromArray(initialView.target);
  controls.update();
  render();
}
function fail(error) {
  console.error('BMW study failed:', error);
  loading.hidden = false;
  status.textContent = 'Не вдалося показати 3D-модель. Оновіть сторінку або спробуйте браузер із WebGL.';
  retry.hidden = false;
  window.__study = { ready: false, error: String(error) };
  parent.postMessage({ source: 'bmw-stage', action: 'error' }, location.origin);
}
retry.addEventListener('click', () => location.reload());


function makeEnvironment() {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color('#272a2e');
  const softbox = (position, size, intensity, color = '#ffffff') => {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(...size), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    panel.position.fromArray(position); panel.lookAt(0, 0.5, 0); studio.add(panel);
  };
  softbox([0, 6, 1], [7, 3], 5);
  softbox([4, 3, 0], [2.5, 6], 3);
  softbox([-5, 2.2, -1], [0.8, 7], 3, '#ffe4ca');
  softbox([0, 2, 6], [5, 1.3], 4);
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromScene(studio, 0.04, 0.1, 50);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.8;
  generator.dispose();
  studio.traverse(item => { item.geometry?.dispose(); item.material?.dispose(); });
}
function makeLights() {
  scene.add(new THREE.HemisphereLight('#eef2ff', '#1a1a19', 1.25));
  const key = new THREE.DirectionalLight('#eef1f4', 1.4);
  key.position.set(1.5, 7, 5); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 20 });
  key.shadow.bias = -0.0002; key.shadow.normalBias = 0.015; key.shadow.radius = 5;
  scene.add(key);
  const fill = new THREE.RectAreaLight('#dbe5ff', 5, 6, 3);
  fill.position.set(4, 3, 2); fill.lookAt(0, 0.8, 0); scene.add(fill);
  const rim = new THREE.RectAreaLight('#ffe3c6', 7, 7, 1);
  rim.position.set(-4, 2.8, -1); rim.lookAt(0, 0.8, 0); scene.add(rim);
}
function makeGround() {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color: '#050607', roughness: 0.78, metalness: 0, envMapIntensity: 0.03 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; if (!isStreet) scene.add(floor);
  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 128;
  const context = shadowCanvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(0,0,0,.8)'); gradient.addColorStop(.48, 'rgba(0,0,0,.4)'); gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
  const material = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false, opacity: 0.7 });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3, 5.8), material);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.004; contactShadows.add(shadow);
  for (const [x, z] of [[0.789, 1.534], [-0.789, 1.534], [0.817, -1.320], [-0.817, -1.320]]) {
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.05), material.clone());
    contact.material.opacity = 0.88; contact.rotation.x = -Math.PI / 2; contact.position.set(x, 0.008, z); contactShadows.add(contact);
  }
}
function retouchMaterial(mesh) {
  const source = mesh.material;
  const name = source.name;
  mesh.castShadow = true; mesh.receiveShadow = true;
  if (name === 'Meshesengine51Mtl') { mesh.visible = false; return; }
  if (['Meshesbody151Mtl', 'Mesheszx1Mtl', 'Mesheslivery1Mtl'].includes(name)) {
    mesh.material = new THREE.MeshPhysicalMaterial({ name, color: '#363d44', metalness: 0.95, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.19 });
  } else if (name === 'Mesheswindows1Mtl') {
    mesh.material = new THREE.MeshPhysicalMaterial({ name, color: '#111b24', metalness: 0.15, roughness: 0.09, clearcoat: 1, transparent: true, opacity: 0.8 });
  } else {
    mesh.material = source.clone();
    if (name === 'Meshesled111Mtl') { mesh.material.emissive.set('#e4e9ef'); mesh.material.emissiveMap = source.map; mesh.material.emissiveIntensity = 0.3; }
    if (name.includes('m8rim001')) { mesh.material.roughness = 0.86; mesh.material.metalness = 0.05; }
    if (name === 'Meshesm8rim1Mtl') { mesh.material.roughness = 0.24; mesh.material.metalness = 0.85; }
    if (name === 'Caliper1Mtl') { mesh.material.color.set('#b38733'); mesh.material.roughness = 0.45; mesh.material.metalness = 0.65; }
  }
}
function inspectGeometry(root) {
  root.updateMatrixWorld(true);
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    const box = new THREE.Box3().setFromObject(mesh);
    const entry = { node: mesh.name, material: mesh.material.name, vertices: mesh.geometry.attributes.position.count, min: box.min.toArray(), max: box.max.toArray() };
    meshes.push(entry);
    if (['Caliper1Mtl', 'Meshesm8rim1Mtl', 'Meshesm8rim0011Mtl'].includes(mesh.material.name)) wheelParts.push(entry);
  });
}
function renderAt(inputTime) {
  const motion = motionAt(isStreet ? DURATION : inputTime);
  currentTime = motion.time;
  vehicle.position.z = -motion.remaining;
  contactShadows.position.z = -motion.remaining;
  for (const wheel of rig?.wheels ?? []) wheel.group.rotation.x = -motion.remaining / wheel.radius;
  restoreView();
  render();
}
addEventListener('hf-seek', event => renderAt(event.detail.time));
addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== parent || event.data?.source !== 'bmw-viewer') return;
  const { action, time } = event.data;
  if (action === 'hello' && window.__study?.ready) parent.postMessage({ source: 'bmw-stage', action: 'ready' }, location.origin);
  if (action === 'seek' && Number.isFinite(time)) {
    timeline?.pause().time(Math.max(0, Math.min(DURATION, time)), true);
    renderAt(time);
  }
  if (action === 'playing' && controls) controls.enabled = !time;
  if (action === 'reset') restoreView();
});
async function boot() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    RectAreaLightUniformsLib.init();
    if (isStreet) {
      const { createStreetEnvironment } = await import('./street.js');
      await createStreetEnvironment(scene, renderer);
    } else { makeEnvironment(); makeLights(); }
    makeGround();
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = false; controls.enablePan = false; controls.enabled = isPreview;
    controls.minDistance = 2; controls.maxDistance = 15;
    controls.minPolarAngle = 0.15; controls.maxPolarAngle = Math.PI / 2 - 0.015;
    controls.addEventListener('change', render);
    restoreView();
    const gltf = await new GLTFLoader().loadAsync('./assets/bmw-m4.glb', progress => {
      if (progress.total) status.textContent = `Завантажуємо модель… ${Math.round(progress.loaded / progress.total * 100)}%`;
    });
    model = gltf.scene;
    model.scale.setScalar(0.242);
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -box.min.y + 0.005, -center.z);
    model.traverse(mesh => { if (mesh.isMesh) retouchMaterial(mesh); });
    vehicle.add(model); inspectGeometry(model);
    rig = createWheelRig(model, vehicle);
    timeline = window.registerBMWTimeline(renderAt);
    await renderer.compileAsync(scene, camera); renderAt(currentTime);
    loading.hidden = true;
    window.__study = { ready: true, model: gltf.parser.json.asset, meshCount: meshes.length, meshes, wheelParts, camera, controls, renderer, scene, modelRoot: model, vehicle, rig: rig.diagnostics, wheels: rig.wheels, render, renderAt, restoreView, initialView, timeline, getTime: () => currentTime };
    dispatchEvent(new CustomEvent('study-ready'));
    parent.postMessage({ source: 'bmw-stage', action: 'ready' }, location.origin);
  } catch (error) { fail(error); }
}
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer?.setSize(innerWidth, innerHeight); render();
});
canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); fail(new Error('WebGL context lost')); });
window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady['bmw-arrival'] = boot();
