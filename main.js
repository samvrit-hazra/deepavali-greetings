import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import {
  makeHaloTexture,
  makeSparkTexture,
  makeStreakTexture,
  makePetalTexture,
  makeClayTexture,
  makeBumpTexture,
  makeRangoliTexture,
  makeRingTexture,
} from './js/textures.js';
import { createAtmosphere } from './js/atmosphere.js';
import { createSurface } from './js/surface.js';
import { createDiya } from './js/diya.js';
import { createWater, resizeWater, addPulse } from './js/water.js';
import { createLamps } from './js/lamps.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = window.matchMedia('(hover: none)').matches;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);

const GrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uGrain: { value: 0.026 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uGrain;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(443.897, 441.423));
      p += dot(p, p + 19.19);
      return fract(p.x * p.y);
    }

    void main() {
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      float grain = hash(vUv * uResolution + fract(uTime) * 91.7) - 0.5;
      col += grain * uGrain;

      vec2 q = vUv - 0.5;
      float vig = smoothstep(1.15, 0.28, length(q) * 1.32);
      col *= mix(0.7, 1.0, vig);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

function layoutFor(width, height) {
  const aspect = width / height;
  if (aspect < 0.82) {
    return { fov: 34, pos: [0, 1.03, 4.85], target: [0, 0.22, 0] };
  }
  if (aspect < 1.25) {
    return { fov: 33, pos: [0.18, 0.86, 4.2], target: [-0.08, 0.23, 0] };
  }
  return { fov: 31, pos: [0.3, 0.72, 3.42], target: [-0.24, 0.24, 0] };
}

function start() {
  const canvas = document.getElementById('scene');
  if (!canvas) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
  } catch (error) {
    document.body.classList.add('no-webgl', 'is-ready');
    return;
  }

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    document.body.classList.add('no-webgl');
  });

  const dpr = Math.min(window.devicePixelRatio || 1, 1.7);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setClearColor(0x050303, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050303);

  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 400);
  const basePos = new THREE.Vector3();
  const baseTarget = new THREE.Vector3();
  const targetSmooth = new THREE.Vector3();

  /* ——— lights ——— */
  const hemi = new THREE.HemisphereLight(0x2a3547, 0x2a160d, 0.5);
  scene.add(hemi);

  const rimLight = new THREE.DirectionalLight(0x8ba1bd, 0.55);
  rimLight.position.set(-5, 6, -7);
  scene.add(rimLight);

  const frontFill = new THREE.DirectionalLight(0xffb273, 0.28);
  frontFill.position.set(2.5, 2.4, 4.5);
  scene.add(frontFill);

  /* ——— textures ——— */
  const textures = {
    halo: makeHaloTexture(renderer),
    spark: makeSparkTexture(renderer),
    streak: makeStreakTexture(renderer),
    petal: makePetalTexture(renderer),
    clay: makeClayTexture(renderer),
    bump: makeBumpTexture(renderer),
    rangoli: makeRangoliTexture(renderer),
    ring: makeRingTexture(renderer),
  };

  /* ——— world ——— */
  const atmosphere = createAtmosphere({ scene, textures });
  const surface = createSurface({ scene, textures });
  const lamps = createLamps({ scene, camera, textures });

  const diya = createDiya({ textures });
  scene.add(diya.group);

  const water = createWater(renderer, window.innerWidth, window.innerHeight);
  scene.add(water);

  /* ——— post ——— */
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(dpr);
  composer.setSize(window.innerWidth, window.innerHeight);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.28,
    0.38,
    0.9,
  );
  composer.addPass(bloom);

  const grade = new ShaderPass(GrainShader);
  composer.addPass(grade);

  composer.addPass(new OutputPass());

  /* ——— responsive camera ——— */
  function applySize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const nextDpr = Math.min(window.devicePixelRatio || 1, 1.7);

    renderer.setPixelRatio(nextDpr);
    renderer.setSize(width, height);
    composer.setPixelRatio(nextDpr);
    composer.setSize(width, height);

    camera.aspect = width / height;
    const layout = layoutFor(width, height);
    camera.fov = layout.fov;
    camera.updateProjectionMatrix();

    basePos.fromArray(layout.pos);
    baseTarget.fromArray(layout.target);
    targetSmooth.copy(baseTarget);

    resizeWater(water, width, height);
    grade.uniforms.uResolution.value.set(width * nextDpr, height * nextDpr);
  }

  applySize();
  window.addEventListener('resize', applySize, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(applySize, 220), { passive: true });

  /* ——— pointer & interaction ——— */
  const pointerTarget = new THREE.Vector2(0, 0);
  const pointer = new THREE.Vector2(0, 0);
  const raycaster = new THREE.Raycaster();
  const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hitPoint = new THREE.Vector3();
  const stirTarget = new THREE.Vector3(0, 0, 0.7);
  const stirPoint = new THREE.Vector2(0, 0);
  let stirEnergy = 0;
  let sceneTime = 0;
  let waveCount = 0;

  const button = document.getElementById('light-river');

  function waveAt(point) {
    addPulse(water, point, sceneTime);
    lamps.lightWave(point, sceneTime);
    waveCount += 1;
    document.body.classList.add('has-stirred');
    if (waveCount === 1) {
      document.body.classList.add('has-waved');
    }
  }

  function handlePointer(clientX, clientY, isMove) {
    const ndc = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1,
    );

    pointerTarget.set(clamp(ndc.x, -1, 1), clamp(ndc.y, -1, 1));

    camera.updateMatrixWorld();
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.ray.intersectPlane(waterPlane, hitPoint);
    if (hit) {
      stirTarget.copy(hitPoint);
      stirEnergy = Math.min(1, stirEnergy + (isMove ? 0.42 : 0.65));
      if (isMove) document.body.classList.add('has-stirred');
    } else if (isMove) {
      stirEnergy *= 0.7;
    }

    return hit ? hitPoint.clone() : null;
  }

  window.addEventListener('pointermove', (event) => {
    handlePointer(event.clientX, event.clientY, true);
  }, { passive: true });

  window.addEventListener('pointerdown', (event) => {
    if (event.target instanceof Element && event.target.closest('button, a')) return;
    const point = handlePointer(event.clientX, event.clientY, false);
    waveAt(point || new THREE.Vector3(0, 0, 0.55));
  }, { passive: true });

  if (button) {
    button.addEventListener('click', () => {
      waveAt(new THREE.Vector3(0, 0, 0.55));
    });
  }

  window.addEventListener('pointerleave', () => {
    pointerTarget.set(0, 0);
    stirEnergy = 0;
  }, { passive: true });

  /* ——— intro ——— */
  let readyAt = 0;
  let markedReady = false;
  let firstFrame = true;
  let ignition = 0;

  function markReady() {
    if (markedReady) return;
    markedReady = true;
    readyAt = performance.now();
    document.body.classList.add('is-ready');
  }

  const fontReady = document.fonts && document.fonts.ready
    ? document.fonts.ready
    : Promise.resolve();

  /* ——— loop ——— */
  const clock = new THREE.Clock();
  const chill = document.documentElement;

  function frame() {
    requestAnimationFrame(frame);

    const dt = Math.min(clock.getDelta(), 0.05);
    const now = performance.now();
    sceneTime += dt;

    if (!markedReady) {
      const wait = Promise.race([
        fontReady,
        new Promise((resolve) => setTimeout(resolve, 1400)),
      ]);
      wait.then(() => requestAnimationFrame(markReady));
    }

    if (readyAt > 0) {
      const intro = clamp((now - readyAt - 100) / 2400, 0, 1);
      ignition = reducedMotion ? 1 : easeOutQuint(intro);
    }

    if (firstFrame) {
      firstFrame = false;
    }

    // pointer easing
    const easiness = reducedMotion ? 20 : 3.2;
    pointer.x = damp(pointer.x, pointerTarget.x, easiness, dt);
    pointer.y = damp(pointer.y, pointerTarget.y, easiness, dt);

    const parallax = coarsePointer ? 0.3 : 1;
    const drift = reducedMotion ? 0 : 1;
    const dx = Math.sin(sceneTime * 0.21 + 0.4) * 0.018 * drift;
    const dy = Math.sin(sceneTime * 0.16 + 1.3) * 0.012 * drift;
    const dz = Math.sin(sceneTime * 0.11) * 0.014 * drift;

    camera.position.set(
      basePos.x + pointer.x * 0.06 * parallax + dx,
      basePos.y + pointer.y * 0.028 * parallax + dy,
      basePos.z + dz,
    );
    targetSmooth.set(
      baseTarget.x + pointer.x * 0.036 * parallax,
      baseTarget.y + pointer.y * 0.024 * parallax,
      baseTarget.z,
    );
    camera.lookAt(targetSmooth);
    camera.updateMatrixWorld();

    // water stir
    stirPoint.x = damp(stirPoint.x, stirTarget.x, 8.5, dt);
    stirPoint.y = damp(stirPoint.y, stirTarget.z, 8.5, dt);
    stirEnergy = damp(stirEnergy, 0, 2.3, dt);
    const waterUniforms = water.material.uniforms;
    waterUniforms.uTime.value = sceneTime;
    waterUniforms.uStir.value.copy(stirPoint);
    waterUniforms.uStirStrength.value = stirEnergy;

    // living pieces
    atmosphere.update(sceneTime, dt, ignition, reducedMotion);
    surface.update(sceneTime, dt, ignition, reducedMotion);
    lamps.update(sceneTime, dt, ignition, reducedMotion);
    diya.update(sceneTime, dt, ignition, { x: pointer.x, y: -pointer.y }, reducedMotion);

    grade.uniforms.uTime.value = sceneTime;

    composer.render();

    if (!markedReady && !reducedMotion && sceneTime > 0.5) {
      // a safety net if fonts or the first frame stall
      if (chill) chill.dataset.rendered = 'true';
    }
  }

  // exposed for debugging / art direction in the console
  window.__diwali = { renderer, scene, camera, composer, bloom, grade, water, diya, lamps, atmosphere, surface };

  // render once before revealing anything
  requestAnimationFrame(frame);

  // if the module is alive but something above failed to reveal, this guarantees content
  setTimeout(markReady, 4200);
}

start();
