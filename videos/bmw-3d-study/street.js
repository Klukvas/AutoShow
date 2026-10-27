import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { GroundedSkybox } from 'three/addons/objects/GroundedSkybox.js';

export async function createStreetEnvironment(scene, renderer) {
  const [radiance, panorama] = await Promise.all([
    new HDRLoader().loadAsync('./assets/street/urban_street_01_2k.hdr'),
    new THREE.TextureLoader().loadAsync('./assets/street/urban_street_01.jpg')
  ]);
  radiance.mapping = THREE.EquirectangularReflectionMapping;
  panorama.colorSpace = THREE.SRGBColorSpace;
  panorama.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromEquirectangular(radiance);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.9;
  scene.environmentRotation.y = Math.PI;
  scene.fog = null;
  generator.dispose(); radiance.dispose();

  const street = new GroundedSkybox(panorama, 1.65, 60, 128);
  street.name = 'ground-projected-london-street';
  street.position.y = 1.65;
  street.rotation.y = Math.PI;
  street.material.toneMapped = false;
  street.material.color.setScalar(0.62);
  street.material.fog = false;
  scene.add(street);

  const receiver = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ color: '#111719', opacity: 0.42, depthWrite: false }));
  receiver.name = 'street-ground-shadow-receiver';
  receiver.rotation.x = -Math.PI / 2; receiver.position.y = 0.001;
  receiver.receiveShadow = true; scene.add(receiver);
  scene.add(new THREE.HemisphereLight('#e8eef4', '#4b4c43', 0.7));
  const daylight = new THREE.DirectionalLight('#e9eff4', 1.9);
  daylight.position.set(-3, 9, 5); daylight.castShadow = true;
  daylight.shadow.mapSize.set(2048, 2048);
  Object.assign(daylight.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 24 });
  daylight.shadow.bias = -0.0002; daylight.shadow.normalBias = 0.012; daylight.shadow.radius = 5;
  scene.add(daylight);
  return { environment: 'street', source: 'Poly Haven Urban Street 01', license: 'CC0', projectedGroundHeight: 1.65, projectionRadius: 60 };
}
