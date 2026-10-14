import * as THREE from 'three';

// Fixed-capacity particle pool: no per-frame geometry or material allocations.
export function createRaceEffects(scene) {
  const capacity = 240, positions = new Float32Array(capacity * 3), colors = new Float32Array(capacity * 3), sizes = new Float32Array(capacity), life = new Float32Array(capacity), velocity = new Float32Array(capacity * 3);
  for (let i = 0; i < capacity; i++) positions[i * 3 + 1] = -1000;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
  const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, vertexColors: true, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float size;varying vec3 vColor;void main(){vColor=color;vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(size*360./max(1.,-p.z),1.,28.);gl_Position=projectionMatrix*p;}',
    fragmentShader: 'varying vec3 vColor;void main(){float r=length(gl_PointCoord-.5);if(r>.5)discard;gl_FragColor=vec4(vColor,pow(1.-r*2.,1.6)*.8);}',
  });
  const particles = new THREE.Points(geometry, material); particles.name = 'pooled-race-vfx'; particles.frustumCulled = false; scene.add(particles);
  let cursor = 0, emission = 0;
  function spawn(pose, side, boost) {
    const index = cursor++ % capacity, a = index * 3, forwardX = Math.cos(pose.heading), forwardZ = Math.sin(pose.heading);
    positions[a] = pose.x - forwardX * .55 - forwardZ * side * .65; positions[a + 1] = .65; positions[a + 2] = pose.z - forwardZ * .55 + forwardX * side * .65;
    const random = Math.sin(cursor * 78.23) * .5 + .5;
    velocity[a] = -forwardX * (boost ? 3 : .7) + (random - .5) * 2; velocity[a + 1] = .9 + random * 1.5; velocity[a + 2] = -forwardZ * (boost ? 3 : .7) + (random - .5);
    colors[a] = boost ? .25 : 1; colors[a + 1] = boost ? .85 : .65; colors[a + 2] = boost ? 1 : .15;
    sizes[index] = boost ? .6 : .32; life[index] = boost ? .42 : .34;
  }
  return {
    reset() { life.fill(0); sizes.fill(0); emission = 0; },
    update(models, dt) {
      emission += dt * 38; const emit = Math.floor(emission); emission -= emit;
      for (const model of models.values()) {
        const pose = model.userData.pose; if (!pose || Math.abs(pose.speed) < 4) continue;
        if (pose.drifting || pose.boost > .05 || pose.itemBoost > .05) for (let i = 0; i < emit; i++) for (const side of [-1, 1]) spawn(pose, side, pose.boost > .05 || pose.itemBoost > .05);
      }
      for (let i = 0; i < capacity; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt; const a = i * 3;
        if (life[i] <= 0) { sizes[i] = 0; positions[a + 1] = -1000; continue; }
        positions[a] += velocity[a] * dt; positions[a + 1] += velocity[a + 1] * dt; positions[a + 2] += velocity[a + 2] * dt;
        velocity[a + 1] -= dt * 4; sizes[i] *= Math.exp(-dt * 1.7);
      }
      geometry.attributes.position.needsUpdate = geometry.attributes.color.needsUpdate = geometry.attributes.size.needsUpdate = true;
    },
  };
}

let contactTexture;
export function attachContactShadow(model) {
  if(!contactTexture){
  const size = 64, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'), gradient = ctx.createRadialGradient(32, 32, 5, 32, 32, 31);
  gradient.addColorStop(0, '#081624aa'); gradient.addColorStop(.5, '#08162455'); gradient.addColorStop(1, '#08162400'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  contactTexture=texture;contactTexture.userData.shared=true;
  }
  const texture=contactTexture;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 3.0), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  shadow.name = 'contact-shadow'; shadow.rotation.x = -Math.PI / 2; shadow.position.y = .012; model.add(shadow);
}
