import * as THREE from 'three';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

function makePetalGeometry(width, height, bend) {
  const geometry = new THREE.PlaneGeometry(width, height, 8, 2);
  const positions = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < positions.count; i += 1) {
    v.fromBufferAttribute(positions, i);
    const u = v.x / width + 0.5;
    const across = Math.abs(v.y / height) * 2;
    v.z = Math.sin(u * Math.PI) * bend * (1 - across * 0.22);
    positions.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function createSurface({ scene, textures }) {
  /* ——— a rangoli drawn in light beneath the diya ——— */
  const rangoli = new THREE.Mesh(
    new THREE.PlaneGeometry(3.9, 3.9),
    new THREE.MeshBasicMaterial({
      map: textures.rangoli,
      color: 0xffffff,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      toneMapped: true,
    }),
  );
  rangoli.rotation.x = -Math.PI / 2;
  rangoli.position.y = 0.005;
  rangoli.renderOrder = 1;
  scene.add(rangoli);

  /* ——— marigold petals ——— */
  const petalTextures = textures.petal;
  const petals = [];
  const petalGeometry = makePetalGeometry(0.185, 0.093, 0.016);
  const petalGeometries = [
    petalGeometry,
    makePetalGeometry(0.17, 0.086, 0.023),
    makePetalGeometry(0.198, 0.1, 0.012),
  ];

  const tints = [0xffffff, 0xffe0a1, 0xfff0cf, 0xffc574];

  for (let i = 0; i < 15; i += 1) {
    const angle = rand(0, TAU);
    let radius = rand(0.78, 2.25);
    if (i < 4) radius = rand(0.84, 1.25);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius * rand(0.72, 1.05);

    const material = new THREE.MeshStandardMaterial({
      map: petalTextures,
      color: tints[i % tints.length],
      roughness: 0.62,
      metalness: 0,
      alphaTest: 0.38,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(petalGeometries[i % petalGeometries.length], material);
    mesh.position.set(x, 0.014, z);
    mesh.rotation.x = -Math.PI / 2 + rand(-0.15, 0.15);
    mesh.rotation.y = rand(0, TAU);
    mesh.rotation.z = rand(-0.2, 0.2);
    mesh.scale.setScalar(rand(0.85, 1.16));
    scene.add(mesh);

    petals.push({
      mesh,
      baseY: 0.014,
      baseRotZ: mesh.rotation.z,
      phase: rand(0, TAU),
      speed: rand(0.18, 0.35),
    });
  }

  function update(time, dt, ignition, reduced) {
    const t = reduced ? time * 0.3 : time;

    rangoli.rotation.z += dt * 0.006;
    const breathe = 0.92 + 0.08 * Math.sin(t * 0.33);
    rangoli.material.opacity = 0.3 * breathe * (0.4 + 0.6 * ignition);

    for (const petal of petals) {
      petal.mesh.position.y = petal.baseY + Math.sin(t * petal.speed + petal.phase) * 0.0016;
      petal.mesh.rotation.z = petal.baseRotZ + Math.sin(t * petal.speed * 0.6 + petal.phase) * 0.06;
    }
  }

  return { update };
}
