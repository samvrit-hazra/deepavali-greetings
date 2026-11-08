import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

const WaterShader = {
  name: 'DiwaliWater',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uTime: { value: 0 },
    uDeep: { value: new THREE.Vector3(0.0032, 0.0021, 0.0016) },
    uHorizon: { value: new THREE.Vector3(0.0112, 0.0062, 0.0034) },
    uStir: { value: new THREE.Vector2(0, 0) },
    uStirStrength: { value: 0 },
    uPulses: {
      value: [
        new THREE.Vector4(0, 0, -100, 0),
        new THREE.Vector4(0, 0, -100, 0),
        new THREE.Vector4(0, 0, -100, 0),
        new THREE.Vector4(0, 0, -100, 0),
      ],
    },
  },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;

    void main() {
      vec4 world = modelMatrix * vec4(position, 1.0);
      vWorld = world.xyz;
      vUv = textureMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * viewMatrix * world;
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec3 uDeep;
    uniform vec3 uHorizon;
    uniform vec2 uStir;
    uniform float uStirStrength;
    uniform vec4 uPulses[4];

    varying vec4 vUv;
    varying vec3 vWorld;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise21(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    void main() {
      vec2 uv = vUv.xy / max(vUv.w, 0.0001);
      vec2 p = vWorld.xz;

      vec2 offset = vec2(0.0);

      // slow, almost still night water
      float n1 = noise21(p * 0.72 + vec2(uTime * 0.017, -uTime * 0.012));
      float n2 = noise21(p * 2.15 - vec2(uTime * 0.026, uTime * 0.015));
      offset += vec2(n1 - 0.5, n2 - 0.5) * 0.0032;

      // the viewer's hand in the water
      vec2 dv = p - uStir;
      float d = length(dv);
      float wake = sin(d * 25.0 - uTime * 6.2) * exp(-d * 2.3) * uStirStrength;
      offset += normalize(dv + 0.0001) * wake * 0.0038;

      // click / tap shockwaves
      for (int i = 0; i < 4; i++) {
        vec4 pulse = uPulses[i];
        float age = uTime - pulse.z;
        if (pulse.w > 0.001 && age > 0.0 && age < 5.5) {
          vec2 pd = p - pulse.xy;
          float dist = length(pd);
          float radius = 0.18 + age * 2.65;
          float ring = exp(-pow((dist - radius) * 5.4, 2.0)) * exp(-age * 0.52) * pulse.w;
          offset += normalize(pd + 0.0001) * ring * 0.0082;
        }
      }

      uv += offset;

      // a vertically blurred reflection reads as deep water
      vec3 refl = vec3(0.0);
      float total = 0.0;
      for (int i = 0; i < 7; i++) {
        float f = float(i) - 3.0;
        float w = 1.0 - abs(f) * 0.12;
        refl += texture2D(tDiffuse, uv + vec2(f * 0.00055, f * 0.0019)).rgb * w;
        total += w;
      }
      refl /= total;

      vec3 viewDir = normalize(cameraPosition - vWorld);
      float fresnel = pow(1.0 - clamp(viewDir.y, 0.0, 1.0), 3.4);
      float distCam = length(cameraPosition.xz - p);

      vec3 col = uDeep + refl * (0.48 + 0.56 * fresnel);
      col *= 0.944 + 0.056 * noise21(p * 5.2 + uTime * 0.045);

      float horizon = smoothstep(17.0, 72.0, distCam);
      col = mix(col, uHorizon, horizon * 0.96);
      col += uHorizon * 0.10 * exp(-distCam * 0.055);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createWater(renderer, width, height) {
  const rw = Math.min(1152, Math.max(360, Math.round(width * (width > 900 ? 0.56 : 0.8))));
  const rh = Math.max(240, Math.round((rw * height) / width));

  const water = new Reflector(new THREE.PlaneGeometry(300, 300), {
    clipBias: 0.0025,
    textureWidth: rw,
    textureHeight: rh,
    color: 0x050403,
    shader: WaterShader,
    multisample: 0,
  });

  water.rotation.x = -Math.PI / 2;
  water.position.y = 0;
  water.name = 'water';
  return water;
}

export function resizeWater(water, width, height) {
  const rw = Math.min(1152, Math.max(360, Math.round(width * (width > 900 ? 0.56 : 0.8))));
  const rh = Math.max(240, Math.round((rw * height) / width));
  const rt = water.getRenderTarget();
  rt.setSize(rw, rh);
}

export function addPulse(water, point, time) {
  const pulses = water.material.uniforms.uPulses.value;
  let oldest = 0;
  let oldestAge = -Infinity;
  for (let i = 0; i < pulses.length; i += 1) {
    const age = time - pulses[i].z;
    if (age > oldestAge) {
      oldestAge = age;
      oldest = i;
    }
  }
  pulses[oldest].set(point.x, point.z, time, 1.0);
}
