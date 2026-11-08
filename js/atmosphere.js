import * as THREE from 'three';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));

function buildSky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vDir;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        vec3 dir = normalize(vDir);
        float up = dir.y;

        vec3 horizon = vec3(0.0112, 0.0062, 0.0034);
        vec3 lowSky  = vec3(0.0034, 0.0032, 0.0062);
        vec3 zenith  = vec3(0.0010, 0.0013, 0.0027);

        vec3 col = mix(horizon, lowSky, smoothstep(-0.004, 0.17, up));
        col = mix(col, zenith, smoothstep(0.15, 0.8, up));

        // below the horizon (mostly hidden by the water)
        col = mix(vec3(0.0018, 0.0011, 0.0008), col, smoothstep(-0.055, 0.005, up));

        // warm festival haze behind the diya
        float warm = pow(max(dot(dir, normalize(vec3(0.015, 0.032, -1.0))), 0.0), 8.5);
        col += vec3(0.34, 0.125, 0.032) * warm * 0.14;

        // a cool veil in the upper left, like far moonlight
        float cool = pow(max(dot(dir, normalize(vec3(-0.62, 0.45, 0.25))), 0.0), 7.0);
        col += vec3(0.034, 0.058, 0.105) * cool * 0.55;

        // low band of river haze
        float band = exp(-pow((up - 0.014) * 16.0, 2.0));
        col += vec3(0.10, 0.045, 0.016) * band * 0.05;

        // dithering against gradient banding
        col += (hash21(gl_FragCoord.xy) - 0.5) * 0.0016;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(175, 48, 32), material);
  mesh.renderOrder = -20;
  mesh.frustumCulled = false;
  return mesh;
}

function buildStars(textures) {
  const count = 62;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const y = rand(0.035, 0.44);
    const theta = rand(0, TAU);
    const r = 150;
    const horizontal = Math.sqrt(1 - y * y);
    positions[i * 3] = Math.cos(theta) * horizontal * r;
    positions[i * 3 + 1] = y * r;
    positions[i * 3 + 2] = Math.sin(theta) * horizontal * r;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    map: textures.spark,
    color: 0x9fb0ca,
    size: 1.5,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(geometry, material);
  stars.renderOrder = -19;
  stars.frustumCulled = false;
  return stars;
}

function buildHaze(textures) {
  const group = new THREE.Group();
  const layers = [
    { x: 0, y: 0.12, z: -13, sx: 32, sy: 4.5, color: 0xff9848, opacity: 0.03 },
    { x: -9, y: 0.16, z: -22, sx: 26, sy: 5.5, color: 0xff8636, opacity: 0.022 },
    { x: 12, y: 0.1, z: -30, sx: 30, sy: 4.0, color: 0xffb164, opacity: 0.016 },
    { x: -16, y: 0.5, z: -38, sx: 34, sy: 10, color: 0x6b83a1, opacity: 0.02 },
  ];

  layers.forEach((layer) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: textures.halo,
      color: layer.color,
      transparent: true,
      opacity: layer.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    }));
    sprite.position.set(layer.x, layer.y, layer.z);
    sprite.scale.set(layer.sx, layer.sy, 1);
    sprite.renderOrder = -5;
    group.add(sprite);
  });

  return group;
}

function buildBokeh(textures) {
  const group = new THREE.Group();
  const motes = [];

  for (let i = 0; i < 22; i += 1) {
    const warm = Math.random() > 0.28;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: textures.halo,
      color: warm ? 0xffb273 : 0x8096b8,
      transparent: true,
      opacity: rand(0.022, 0.075),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    }));
    const depth = rand(-7.5, -1.2);
    const scale = rand(0.035, 0.16) * (Math.abs(depth) * 0.26 + 0.5);
    sprite.position.set(rand(-3.8, 3.8), rand(0.15, 1.7), depth);
    sprite.scale.set(scale, scale, 1);
    sprite.renderOrder = -4;
    group.add(sprite);
    motes.push({
      sprite,
      baseX: sprite.position.x,
      baseY: sprite.position.y,
      phase: rand(0, TAU),
      speed: rand(0.04, 0.11),
      driftX: rand(0.08, 0.28),
      driftY: rand(0.05, 0.16),
    });
  }

  return { group, motes };
}

function buildEmbers(textures) {
  const count = 86;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const life = new Float32Array(count);
  const maxLife = new Float32Array(count);
  const velocity = new Float32Array(count);
  const phase = new Float32Array(count);
  const tint = new Float32Array(count * 3);

  function spawn(i, fresh) {
    positions[i * 3] = rand(-0.1, 0.1);
    positions[i * 3 + 1] = rand(0.22, 0.43);
    positions[i * 3 + 2] = 0.45 + rand(-0.075, 0.075);
    velocity[i] = rand(0.055, 0.16);
    phase[i] = rand(0, TAU);
    maxLife[i] = rand(2.6, 6.6);
    life[i] = fresh ? rand(0, maxLife[i]) : 0;

    const warm = Math.random();
    tint[i * 3] = 1.0;
    tint[i * 3 + 1] = 0.36 + warm * 0.34;
    tint[i * 3 + 2] = 0.06 + warm * 0.18;
    colors[i * 3] = 0;
    colors[i * 3 + 1] = 0;
    colors[i * 3 + 2] = 0;
  }

  for (let i = 0; i < count; i += 1) spawn(i, true);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    map: textures.spark,
    size: 0.028,
    sizeAttenuation: true,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 8;

  function update(time, dt, ignition) {
    const posAttr = geometry.attributes.position;
    const colAttr = geometry.attributes.color;
    for (let i = 0; i < count; i += 1) {
      if (life[i] <= 0) {
        if (ignition > 0.3 && Math.random() < dt * 3.2) spawn(i, false);
        else {
          colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = 0;
          continue;
        }
      }

      life[i] += dt;
      const p = posAttr.array;
      p[i * 3] += Math.sin(time * 1.7 + phase[i]) * 0.012 * dt;
      p[i * 3 + 2] += Math.cos(time * 1.3 + phase[i] * 1.7) * 0.01 * dt;
      p[i * 3 + 1] += velocity[i] * dt;
      velocity[i] *= 1 - dt * 0.06;

      if (life[i] > maxLife[i]) life[i] = 0;

      const age = life[i] / maxLife[i];
      const fade = Math.sin(Math.PI * Math.min(1, age)) ** 1.4;
      const heat = 1.25 * ignition * fade;
      colAttr.array[i * 3] = tint[i * 3] * heat;
      colAttr.array[i * 3 + 1] = tint[i * 3 + 1] * heat;
      colAttr.array[i * 3 + 2] = tint[i * 3 + 2] * heat;

      if (life[i] === 0) {
        p[i * 3] = 0;
        p[i * 3 + 1] = -10;
        p[i * 3 + 2] = 0;
      }
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }

  return { points, update };
}

export function createAtmosphere({ scene, textures }) {
  const sky = buildSky();
  scene.add(sky);

  const stars = buildStars(textures);
  scene.add(stars);

  const haze = buildHaze(textures);
  scene.add(haze);

  const bokeh = buildBokeh(textures);
  scene.add(bokeh.group);

  const embers = buildEmbers(textures);
  scene.add(embers.points);

  function update(time, dt, ignition, reduced) {
    const t = reduced ? time * 0.25 : time;

    for (const mote of bokeh.motes) {
      mote.sprite.position.x = mote.baseX + Math.sin(t * mote.speed + mote.phase) * mote.driftX;
      mote.sprite.position.y = mote.baseY + Math.cos(t * mote.speed * 0.83 + mote.phase) * mote.driftY;
    }

    embers.update(t, dt, ignition);
  }

  return { update, sky };
}
