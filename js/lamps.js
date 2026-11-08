import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));

const riverCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-8.5, 0, -6.5),
  new THREE.Vector3(-5.2, 0, -9.2),
  new THREE.Vector3(-2.1, 0, -12.4),
  new THREE.Vector3(1.4, 0, -15.8),
  new THREE.Vector3(4.6, 0, -20.5),
  new THREE.Vector3(7.2, 0, -27.0),
  new THREE.Vector3(10.0, 0, -36.0),
  new THREE.Vector3(12.4, 0, -48.0),
]);

export function createLamps({ scene, camera, textures }) {
  const group = new THREE.Group();
  scene.add(group);

  const lamps = [];
  const count = 14;

  for (let i = 0; i < count; i += 1) {
    const t = 0.055 + (i / (count - 1)) * 0.925;
    const position = riverCurve.getPoint(t);
    const side = (Math.random() - 0.5) * 0.8;
    position.x += side;
    position.z += (Math.random() - 0.5) * 0.55;
    position.y = 0;

    const distance = position.distanceTo(camera.position);
    const baseGlow = distance * 0.0225;

    const bowl = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 10, 6, 0, TAU, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x0a0604 }),
    );
    bowl.scale.set(1, 0.36, 1);
    bowl.position.copy(position);
    bowl.position.y = 0.012;
    group.add(bowl);

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: textures.halo,
      color: i % 3 === 0 ? 0xffbf7a : 0xffa458,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      toneMapped: true,
    }));
    halo.position.copy(position);
    halo.position.y = 0.105;
    halo.scale.set(baseGlow, baseGlow, 1);
    halo.renderOrder = 2;
    group.add(halo);

    const core = new THREE.Sprite(new THREE.SpriteMaterial({
      map: textures.spark,
      color: 0xffe2b1,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      toneMapped: true,
    }));
    core.position.copy(position);
    core.position.y = 0.115;
    core.scale.set(baseGlow * 0.19, baseGlow * 0.19, 1);
    core.renderOrder = 3;
    group.add(core);

    const initialLit = i === 7 || i === 9 || i === 10;

    lamps.push({
      position,
      halo,
      core,
      baseGlow,
      seed: Math.random() * 10,
      level: initialLit ? 1 : 0,
      target: initialLit ? 1 : 0,
      igniteAt: initialLit ? -100 : Infinity,
      flare: 0,
    });
  }

  /* ——— expanding rings on the water ——— */
  const rings = [];
  for (let i = 0; i < 3; i += 1) {
    const material = new THREE.MeshBasicMaterial({
      map: textures.ring,
      color: 0xffb36a,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      toneMapped: true,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.007;
    mesh.visible = false;
    mesh.renderOrder = 2;
    scene.add(mesh);
    rings.push({ mesh, material, age: Infinity });
  }

  let ringCursor = 0;

  function lightWave(origin, time) {
    for (const lamp of lamps) {
      const distance = lamp.position.distanceTo(origin);
      const delay = distance / 13.0 + lamp.seed * 0.035;
      lamp.igniteAt = Math.min(lamp.igniteAt, time + delay);
      if (lamp.level > 0.9) lamp.flare = 1;
    }

    const ring = rings[ringCursor % rings.length];
    ringCursor += 1;
    ring.age = 0;
    ring.mesh.position.set(origin.x, 0.007, origin.z);
    ring.mesh.scale.setScalar(0.45);
    ring.mesh.visible = true;
    ring.material.opacity = 0.35;
  }

  function update(time, dt, ignition, reduced) {
    const t = reduced ? time * 0.3 : time;
    const reveal = 0.22 + 0.78 * ignition;

    for (const lamp of lamps) {
      if (time >= lamp.igniteAt) lamp.target = 1;
      lamp.level = damp(lamp.level, lamp.target, lamp.target > lamp.level ? 2.8 : 1.2, dt);
      lamp.flare = Math.max(0, lamp.flare - dt * 1.35);

      const flicker =
        0.84 +
        0.11 * Math.sin(t * 6.7 + lamp.seed * 7.1) +
        0.05 * Math.sin(t * 15.3 + lamp.seed * 3.3);
      const lit = lamp.level * reveal;
      const flare = lamp.flare;

      lamp.halo.material.opacity = 0.4 * lit * flicker * (1 + flare * 0.7);
      lamp.core.material.opacity = 0.9 * lit * (0.82 + flicker * 0.2) * (1 + flare * 0.8);

      const scale = lamp.baseGlow * (1 + flare * 0.28) * (0.96 + 0.06 * flicker);
      lamp.halo.scale.set(scale, scale, 1);
      lamp.core.scale.set(scale * 0.19, scale * 0.19, 1);

      lamp.core.position.y = 0.115 + Math.sin(t * 7.0 + lamp.seed) * 0.0025;
    }

    for (const ring of rings) {
      if (ring.age === Infinity) continue;
      ring.age += dt;
      const life = 2.5;
      if (ring.age > life) {
        ring.age = Infinity;
        ring.mesh.visible = false;
        ring.material.opacity = 0;
        continue;
      }
      const p = ring.age / life;
      ring.mesh.scale.setScalar(0.45 + p * 8.5);
      ring.material.opacity = 0.35 * Math.pow(1 - p, 2.2);
    }
  }

  return { update, lightWave };
}
