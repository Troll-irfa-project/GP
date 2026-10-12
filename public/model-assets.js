import * as THREE from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';

let pending;
export function loadModels() {
  if (!pending) pending = (async () => {
    const response = await fetch('/assets/models/manifest.json'); if (!response.ok) throw new Error('Catalogue 3D indisponible');
    const manifest = await response.json(), loader = new GLTFLoader(), assets = new Map();
    const palette = await new THREE.TextureLoader().loadAsync('/assets/models/city-kit-suburban/Textures/variation-b.png');
    palette.flipY = false; palette.colorSpace = THREE.SRGBColorSpace; palette.magFilter = THREE.NearestFilter; palette.userData.shared = true;
    await Promise.all(manifest.models.map(async item => {
      const gltf = await loader.loadAsync(item.url); gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse(o => { if (o.isMesh) { for (const m of [].concat(o.material)) { if (item.category === 'house') m.map = palette; if (m.map) m.map.userData.shared = true; } } });
      assets.set(item.id, { ...item, scene: gltf.scene });
    }));
    return assets;
  })().catch(error => { pending = null; throw error; });
  return pending;
}

// Bake the complete GLB node hierarchy before instancing. Source caches stay untouched.
export function instanceModel(THREE, root, asset, placements, options = {}) {
  if (!asset || !placements.length) return;
  const transform = new THREE.Object3D();
  asset.scene.traverse(source => {
    if (!source.isMesh) return;
    const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld);
    const materials = [].concat(source.material).map(m => {
      const material = m.clone(); material.roughness = .8; material.metalness = 0;
      if (asset.category === 'tower') { material.roughness = .42; material.metalness = .16; }
      const naturePalette = { leafsGreen: '#398f39', grass: '#55a63f', woodBark: '#896044', dirt: '#b9ad90', colorRed: '#e64d70', colorYellow: '#ffd751' };
      if (asset.source === 'nature-kit' && naturePalette[m.name]) material.color.set(naturePalette[m.name]);
      if (options.tint) material.color.multiply(new THREE.Color(options.tint));
      if (options.wind) {
        const time = { value: 0 }; root.userData.timeUniforms.push(time);
        material.onBeforeCompile = shader => { shader.uniforms.uWindTime = time; shader.vertexShader = 'uniform float uWindTime;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.x += sin(uWindTime * 1.3 + position.y * 2.0) * max(0.0, position.y - .3) * .015;'); };
        material.customProgramCacheKey = () => 'foliage-wind-v1';
      }
      return material;
    });
    const mesh = new THREE.InstancedMesh(geometry, Array.isArray(source.material) ? materials : materials[0], placements.length);
    mesh.name = `asset:${asset.id}`; mesh.castShadow = !['flower', 'grass'].includes(asset.category); mesh.receiveShadow = true;
    placements.forEach((p, i) => {
      const s = p.scale || 1; transform.position.set(p.x, (p.y || 0) + asset.groundOffsetY * s, p.z); transform.rotation.set(0, p.angle || 0, 0); transform.scale.setScalar(s); transform.updateMatrix(); mesh.setMatrixAt(i, transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); root.add(mesh);
  });
}
