import * as THREE from '/three.js';
import { makeChair } from './chairs.js';

function disposeModel(object) {
  const materials = new Set(), geometries = new Set();
  object.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) materials.add(o.material); });
  object.removeFromParent(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
}

// One on-demand renderer for the showroom and all five cached thumbnails.
// It sleeps completely during circuit selection, racing and hidden browser tabs.
export function createGarage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 1, .1, 30);
  camera.position.set(4.1, 3.0, -5.6); camera.lookAt(0, 1.0, 0);
  scene.add(new THREE.HemisphereLight('#e5f6ff', '#45618b', 3));
  const key = new THREE.DirectionalLight('#fff3df', 4); key.position.set(-3, 6, -5); scene.add(key);
  const rim = new THREE.DirectionalLight('#7eb9ff', 2); rim.position.set(3, 4, 4); scene.add(rim);
  const podium = new THREE.Group();
  const disk = new THREE.Mesh(new THREE.CylinderGeometry(1.92, 2.06, .20, 64), new THREE.MeshStandardMaterial({ color: '#102c4b', metalness: .4, roughness: .32 }));
  disk.position.y = .05; podium.add(disk);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.86, 1.86, .035, 64), new THREE.MeshStandardMaterial({ color: '#244865', metalness: .25, roughness: .45 }));
  top.position.y = .163; podium.add(top);
  for (const radius of [1.96, 1.68]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, radius > 1.9 ? .035 : .012, 6, 80), new THREE.MeshStandardMaterial({ color: '#ffe448', emissive: '#ffce20', emissiveIntensity: 1.4 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = .182; podium.add(ring);
  }
  scene.add(podium);
  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext('2d'), gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  gradient.addColorStop(0, '#020e1ed0'); gradient.addColorStop(1, '#020e1e00'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.9), new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  let model, signature = '', active = false, frame = 0, lastRender = 0, yaw = 0, dragX = null;
  // Ground contact shadow is baked, avoiding another shadow-map pass per frame.
  shadow.position.y = .19; scene.add(shadow);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function resize() {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
  }
  function draw(now) {
    frame = 0;
    if (!active || document.hidden) return;
    if (now - lastRender > 32) {
      if (model) model.rotation.y = yaw + (reducedMotion.matches || dragX !== null ? 0 : Math.sin(now * .00035) * .075);
      renderer.render(scene, camera); lastRender = now;
    }
    frame = requestAnimationFrame(draw);
  }
  function wake() { if (active && !document.hidden && !frame) frame = requestAnimationFrame(draw); }
  const resizeObserver = new ResizeObserver(() => { if (active) resize(); }); resizeObserver.observe(canvas);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else wake(); });
  canvas.addEventListener('pointerdown', e => { dragX = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (dragX !== null) { yaw += (e.clientX - dragX) * .01; dragX = e.clientX; } });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, () => { dragX = null; });
  return {
    update(chair, pilot) {
      const next = `${chair.id}/${chair.color}/${chair.logoId||''}/${pilot.id}`;
      if (signature === next) return;
      signature = next; if (model) disposeModel(model);
      model = makeChair(THREE, chair, pilot); model.position.y = .2; scene.add(model); yaw = 0;
    },
    setRearView(value){yaw=value?Math.PI:0;},
    setActive(value) {
      active = value;
      if (active) { resize(); wake(); }
      else { cancelAnimationFrame(frame); frame = 0; }
    },
    thumbnails(chairs, pilot) {
      const images = new Map();
      const thumbnailScene = new THREE.Scene();
      thumbnailScene.add(new THREE.HemisphereLight('#eaf7ff', '#476385', 3));
      const light = new THREE.DirectionalLight('#fff2d8', 4); light.position.set(-3, 5, -4); thumbnailScene.add(light);
      const thumbnailCamera = new THREE.PerspectiveCamera(34, 320 / 180, .1, 30);
      thumbnailCamera.position.set(3.6, 2.7, -4.5); thumbnailCamera.lookAt(0, 1.1, 0);
      renderer.setPixelRatio(1); renderer.setSize(320, 180, false);
      for (const chair of chairs) {
        const object = makeChair(THREE, chair, pilot); thumbnailScene.add(object);
        renderer.render(thumbnailScene, thumbnailCamera); images.set(chair.id, canvas.toDataURL('image/png')); disposeModel(object);
      }
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); resize();
      return images;
    },
  };
}
