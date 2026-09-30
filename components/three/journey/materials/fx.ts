import * as THREE from "three";
import { NOISE, POS_VERTEX, UV_VERTEX } from "./glsl";

/** Бүтэн дэлгэцийн дэвсгэр: SVG картуудын гүн цэнхэр градиент + бүдэг гэрэл + vignette. */
export function createBackdropMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.9999, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uBottom;
      uniform vec3 uHalo;
      varying vec2 vUv;
      ${NOISE}
      void main() {
        vec3 col = mix(uBottom, uTop, smoothstep(0.0, 1.0, vUv.y));
        float halo = 1.0 - smoothstep(0.0, 0.75, length((vUv - vec2(0.5, 0.62)) * vec2(1.0, 1.3)));
        col = mix(col, uHalo, halo * 0.35);
        col *= 1.0 - 0.35 * smoothstep(0.45, 1.0, length(vUv - 0.5) * 1.4);
        col += (hash21(gl_FragCoord.xy) - 0.5) / 255.0;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
    uniforms: {
      uTop: { value: new THREE.Color("#0f3a5e") },
      uBottom: { value: new THREE.Color("#07213a") },
      uHalo: { value: new THREE.Color("#1a5a8c") },
    },
    depthTest: false,
    depthWrite: false,
  });
}

/** Диорамын доорх тавцан: зөөлөн гэрэл + техникийн төвлөрсөн цагираг, загалмай шугам (ирмэг рүүгээ уусна) */
export function createFloorMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: UV_VERTEX,
    fragmentShader: /* glsl */ `
      uniform vec3 uGlow;
      uniform vec3 uLine;
      uniform float uLines;
      varying vec2 vUv;
      void main() {
        vec2 c = (vUv - 0.5) * 2.0;
        float r = length(c);
        float fade = 1.0 - smoothstep(0.1, 1.0, r);
        float rr = r * 7.0;
        float w = fwidth(rr);
        float ring = 1.0 - smoothstep(0.0, w * 1.2, abs(fract(rr) - 0.5) * -1.0 + 0.5);
        float cw = fwidth(c.x) * 1.2;
        float cross = 1.0 - smoothstep(0.0, cw, min(abs(c.x), abs(c.y)));
        float lines = (ring * 0.45 + cross * 0.3) * fade * uLines;
        vec3 col = uGlow * fade * fade * 0.55 + uLine * lines;
        float a = clamp(fade * fade * 0.55 + lines, 0.0, 1.0);
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }
    `,
    uniforms: {
      uGlow: { value: new THREE.Color("#1d6ea8") },
      uLine: { value: new THREE.Color("#5fd3f7") },
      uLines: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
  });
}

/**
 * Хавтгай цагираг (RingGeometry, XY хавтгай): тасархай зураас бага зэрэг эргэлдэж, долгион гадагш тархана.
 * Хамгаалалтын бүс, эх үүсвэрийн цэг зэрэгт.
 */
export function createRingMaterial(color: string, dashes = 36) {
  return new THREE.ShaderMaterial({
    vertexShader: POS_VERTEX,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uPhase;
      uniform float uOpacity;
      uniform float uDashes;
      varying vec3 vPos;
      void main() {
        float ang = atan(vPos.y, vPos.x) / 6.2831853 + 0.5;
        float d = fract(ang * uDashes + uPhase * 0.025);
        float dash = smoothstep(0.3, 0.36, d) * (1.0 - smoothstep(0.94, 1.0, d));
        float pulse = 0.55 + 0.45 * sin(uPhase * 1.4 - length(vPos.xy) * 5.0);
        float a = uOpacity * dash * pulse;
        gl_FragColor = vec4(uColor * a, a);
        #include <colorspace_fragment>
      }
    `,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uPhase: { value: 0 },
      uOpacity: { value: 1 },
      uDashes: { value: dashes },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/** Зөөлөн гэрлийн толбо (PlaneGeometry): цонх, гэрэлтэх цэгийн "glow" — postprocessing-гүйгээр */
export function createGlowMaterial(color: string, opacity = 1) {
  return new THREE.ShaderMaterial({
    vertexShader: UV_VERTEX,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float a = pow(max(1.0 - r, 0.0), 2.2) * uOpacity;
        gl_FragColor = vec4(uColor * a, a);
        #include <colorspace_fragment>
      }
    `,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
