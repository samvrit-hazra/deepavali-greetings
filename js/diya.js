import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));

const flameProfile = [
  [0.0, 0.0],
  [0.019, 0.008],
  [0.039, 0.035],
  [0.046, 0.072],
  [0.045, 0.115],
  [0.039, 0.165],
  [0.029, 0.219],
  [0.018, 0.272],
  [0.008, 0.317],
  [0.002, 0.342],
  [0.0, 0.35],
].map(([x, y]) => new THREE.Vector2(x, y));

function makeFlameMaterial(shared, { edge, mid, core, alpha }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uLean: shared.uLean,
      uIntensity: shared.uIntensity,
      uAlpha: { value: alpha },
      uEdge: { value: new THREE.Color(edge) },
      uMid: { value: new THREE.Color(mid) },
      uCore: { value: new THREE.Color(core) },
    },
    vertexShader: /* glsl */`
      uniform float uTime;
      uniform vec2 uLean;
      varying vec2 vUv;
      varying vec3 vNormalV;
      varying vec3 vViewV;

      void main() {
        vUv = uv;
        vec3 p = position;
        float h = clamp(p.y / 0.35, 0.0, 1.0);

        float sway = sin(uTime * 6.1 + p.y * 24.0 + uv.x * 6.283) * 0.0085;
        sway += sin(uTime * 2.6 + p.y * 9.0 + uv.x * 2.0) * 0.006;
        p.x += sway * h * h;
        p.z += cos(uTime * 5.0 + p.y * 20.0 + uv.x * 3.0) * 0.006 * h * h;

        p.x += uLean.x * h * h * 0.062;
        p.z += uLean.y * h * h * 0.062;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vNormalV = normalize(normalMatrix * normal);
        vViewV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform float uIntensity;
      uniform float uAlpha;
      uniform vec3 uEdge;
      uniform vec3 uMid;
      uniform vec3 uCore;
      varying vec2 vUv;
      varying vec3 vNormalV;
      varying vec3 vViewV;

      void main() {
        float h = clamp(vUv.y, 0.0, 1.0);
        float facing = abs(dot(normalize(vNormalV), normalize(vViewV)));
        float body = smoothstep(0.0, 0.055, h) * (1.0 - smoothstep(0.6, 0.995, h));
        float edge = smoothstep(0.0, 0.6, facing);
        float flicker = 0.93 + 0.07 * sin(uTime * 10.5 + h * 22.0 + vUv.x * 9.0);

        vec3 col = mix(uEdge, uMid, smoothstep(0.0, 0.5, h));
        col = mix(col, uCore, smoothstep(0.34, 0.82, h) * smoothstep(0.12, 0.82, facing) * 0.9);
        col *= 1.35 + 1.05 * facing;
        col *= flicker;

        float alpha = body * mix(0.18, 1.0, edge) * uAlpha * uIntensity * flicker;
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
  });
}

export function createDiya({ textures }) {
  const group = new THREE.Group();
  group.position.set(0, 0.026, 0);

  /* ——— hand-thrown bowl ——— */
  const profile = [
    [0.0, -0.102],
    [0.1, -0.102],
    [0.21, -0.088],
    [0.34, -0.05],
    [0.452, 0.012],
    [0.52, 0.078],
    [0.562, 0.138],
    [0.578, 0.168],
    [0.572, 0.184],
    [0.548, 0.18],
    [0.528, 0.158],
    [0.5, 0.124],
    [0.43, 0.082],
    [0.34, 0.06],
    [0.21, 0.052],
    [0.0, 0.048],
  ].map(([x, y]) => new THREE.Vector2(x, y));

  const bowlGeo = new THREE.LatheGeometry(profile, 144);
  const positions = bowlGeo.attributes.position;
  const vertex = new THREE.Vector3();
  for (let i = 0; i < positions.count; i += 1) {
    vertex.fromBufferAttribute(positions, i);
    const radius = Math.hypot(vertex.x, vertex.z);
    const theta = Math.atan2(vertex.z, vertex.x);

    // a pinched spout at the front, and a faint hand-formed wobble
    let angle = theta - Math.PI / 2;
    angle = Math.atan2(Math.sin(angle), Math.cos(angle));
    const spout = Math.exp(-(angle * angle) / (0.6 * 0.6));
    const upper = THREE.MathUtils.smoothstep(vertex.y, 0.015, 0.16);
    const rim = THREE.MathUtils.smoothstep(vertex.y, 0.118, 0.188);
    const wobble = Math.sin(theta * 5.0 + 1.25) * 0.0058 + Math.sin(theta * 9.0 - 0.4) * 0.0028;
    const scale = 1.0 + spout * 0.118 * upper + wobble * upper;

    vertex.x *= scale;
    vertex.z *= scale;
    vertex.y += spout * 0.017 * rim;
    vertex.y += Math.sin(theta * 7.0 + 0.8) * 0.0022 * rim;
    vertex.y += Math.sin(theta * 3.0 + 0.2) * 0.0014 * upper;
    positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  bowlGeo.computeVertexNormals();

  const clayMaterial = new THREE.MeshStandardMaterial({
    map: textures.clay,
    bumpMap: textures.bump,
    bumpScale: 0.018,
    color: 0xe8b889,
    roughness: 0.72,
    metalness: 0.008,
    emissive: new THREE.Color(0x5a2410),
    emissiveIntensity: 0.42,
  });
  const bowl = new THREE.Mesh(bowlGeo, clayMaterial);
  group.add(bowl);

  /* ——— oil ——— */
  const oil = new THREE.Mesh(
    new THREE.CircleGeometry(0.413, 80),
    new THREE.MeshPhysicalMaterial({
      color: 0x2c0c03,
      roughness: 0.07,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.045,
      envMapIntensity: 0,
    }),
  );
  oil.rotation.x = -Math.PI / 2;
  oil.position.y = 0.077;
  group.add(oil);

  /* ——— wick ——— */
  const wick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0042, 0.0115, 0.125, 8, 1),
    new THREE.MeshStandardMaterial({ color: 0x160d08, roughness: 0.94, metalness: 0 }),
  );
  wick.position.set(0, 0.128, 0.428);
  wick.rotation.x = 0.33;
  group.add(wick);

  const wickTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.0075, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff8826, toneMapped: true }),
  );
  wickTip.position.set(0, 0.186, 0.448);
  group.add(wickTip);

  /* ——— flame ——— */
  const shared = {
    uTime: { value: 0 },
    uLean: { value: new THREE.Vector2(0, 0) },
    uIntensity: { value: 0 },
  };

  const flameGroup = new THREE.Group();
  flameGroup.position.set(0, 0.185, 0.448);
  group.add(flameGroup);

  const outerFlame = new THREE.Mesh(
    new THREE.LatheGeometry(flameProfile, 40),
    makeFlameMaterial(shared, { edge: 0xff4b00, mid: 0xffa039, core: 0xfff3d0, alpha: 1.0 }),
  );
  outerFlame.renderOrder = 4;
  flameGroup.add(outerFlame);

  const innerFlame = new THREE.Mesh(
    new THREE.LatheGeometry(flameProfile, 32),
    makeFlameMaterial(shared, { edge: 0xffc25a, mid: 0xfff0bd, core: 0xffffff, alpha: 0.85 }),
  );
  innerFlame.scale.set(0.54, 0.7, 0.54);
  innerFlame.position.y = 0.012;
  innerFlame.renderOrder = 5;
  flameGroup.add(innerFlame);

  const blueBase = new THREE.Mesh(
    new THREE.SphereGeometry(0.033, 16, 10),
    new THREE.MeshBasicMaterial({
      color: 0x4d76ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: true,
    }),
  );
  blueBase.scale.set(1, 0.42, 1);
  blueBase.position.y = 0.008;
  blueBase.renderOrder = 3;
  flameGroup.add(blueBase);

  /* ——— halo, streak, light ——— */
  const haloInner = new THREE.Sprite(new THREE.SpriteMaterial({
    map: textures.halo,
    color: 0xffe9c7,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    toneMapped: true,
  }));
  haloInner.scale.set(0.3, 0.3, 1);
  haloInner.position.set(0, 0.14, 0);
  haloInner.renderOrder = 6;
  flameGroup.add(haloInner);

  const haloOuter = new THREE.Sprite(new THREE.SpriteMaterial({
    map: textures.halo,
    color: 0xffc27a,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    toneMapped: true,
  }));
  haloOuter.scale.set(0.86, 0.86, 1);
  haloOuter.position.set(0, 0.13, 0);
  haloOuter.renderOrder = 6;
  flameGroup.add(haloOuter);

  const streak = new THREE.Sprite(new THREE.SpriteMaterial({
    map: textures.streak,
    color: 0xffd7a2,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    toneMapped: true,
  }));
  streak.scale.set(0.58, 0.028, 1);
  streak.position.set(0, 0.14, 0);
  streak.renderOrder = 7;
  flameGroup.add(streak);

  const light = new THREE.PointLight(0xffa354, 0, 9, 1.8);
  light.position.set(0, 0.3, 0.455);
  group.add(light);

  // a faint warm bounce, as though the water were giving the flame back
  const bounce = new THREE.PointLight(0xff7a30, 0, 4.5, 2);
  bounce.position.set(0, 0.02, 1.05);
  group.add(bounce);

  // a soft key to keep the terracotta readable in near-darkness
  const fill = new THREE.PointLight(0xffc08a, 0, 3.2, 2);
  fill.position.set(0.35, 0.55, 1.15);
  group.add(fill);

  const streakBase = new THREE.Vector3(0.58, 0.028, 1);
  let currentLean = new THREE.Vector2(0, 0);

  function update(time, dt, ignition, pointerLean, reduced) {
    const t = reduced ? time * 0.28 : time;

    const flicker =
      0.93 +
      0.045 * Math.sin(t * 7.15) +
      0.03 * Math.sin(t * 13.1 + 1.7) +
      0.018 * Math.sin(t * 23.3 + 0.4);
    const flick = clamp(flicker, 0.82, 1.08);

    shared.uTime.value = t;
    shared.uIntensity.value = ignition * flick;
    currentLean.x = damp(currentLean.x, pointerLean.x * 0.9, 3.0, dt);
    currentLean.y = damp(currentLean.y, pointerLean.y * 0.55, 3.0, dt);
    shared.uLean.value.copy(currentLean);

    group.position.y = 0.026 + Math.sin(t * 0.62) * 0.0032;
    group.rotation.z = Math.sin(t * 0.41) * 0.006;
    group.rotation.x = Math.sin(t * 0.33 + 0.8) * 0.0035;

    const glow = ignition * flick;
    light.intensity = 1.15 * glow;
    light.position.x = currentLean.x * 0.022;
    bounce.intensity = 0.18 * glow;
    fill.intensity = 0.22 * glow;

    haloInner.material.opacity = 0.14 * glow;
    haloOuter.material.opacity = 0.04 * glow;
    const haloScale = 1 + (flick - 0.93) * 0.9;
    haloInner.scale.set(0.22 * haloScale, 0.22 * haloScale, 1);
    haloOuter.scale.set(0.52 * haloScale, 0.52 * haloScale, 1);
    streak.material.opacity = 0.085 * glow * (0.85 + 0.15 * flick);
    streak.scale.set(streakBase.x * (0.95 + 0.08 * flick), streakBase.y, 1);

    blueBase.material.opacity = 0.3 * ignition;
    wickTip.scale.setScalar(0.4 + 0.6 * ignition);
  }

  return {
    group,
    update,
    light,
    flameGroup,
    shared,
  };
}
