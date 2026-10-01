import * as THREE from "three";
import { NOISE, POS_VERTEX, UV_VERTEX } from "./glsl";

/** Гол (ribbon): голд нь урсгалын гялбаа, эрэг рүүгээ гүн өнгө. uv.x — голын дагуу, uv.y — хөндлөн. */
export function createRiverMaterial(length: number) {
  return new THREE.ShaderMaterial({
    vertexShader: UV_VERTEX,
    fragmentShader: /* glsl */ `
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uGlow;
      uniform float uPhase;
      uniform float uDetail;
      uniform float uDraw;
      uniform float uLen;
      varying vec2 vUv;
      ${NOISE}
      void main() {
        if (vUv.x > uDraw) discard;
        float across = abs(vUv.y - 0.5) * 2.0;
        vec2 p = vec2(vUv.x * uLen * 5.0 - uPhase * 1.1, vUv.y * 2.5);
        float n = uDetail > 0.5 ? vnoise(p) * 0.6 + vnoise(p * 2.3 + 7.1) * 0.4 : vnoise(p);
        float streak = smoothstep(0.6, 0.9, n) * (1.0 - across);
        vec3 col = mix(uShallow, uDeep, across * 0.85);
        col += uGlow * streak * 0.7;
        col = mix(col, uGlow, smoothstep(0.8, 1.0, across) * 0.3);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
    uniforms: {
      uDeep: { value: new THREE.Color("#0f5a8f") },
      uShallow: { value: new THREE.Color("#2aa7e6") },
      uGlow: { value: new THREE.Color("#bff0ff") },
      uPhase: { value: 0 },
      uDetail: { value: 1 },
      uDraw: { value: 1 },
      uLen: { value: length },
    },
  });
}

/** Гүний уст давхарга: хөндлөн огтлол дээр аажим гүйх гялбаа. uIntensity (0–1) — гэрэлтэх хэмжээ. */
export function createAquiferMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: POS_VERTEX,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase;
      uniform vec3 uGlow;
      uniform float uPhase;
      uniform float uDetail;
      uniform float uIntensity;
      varying vec3 vPos;
      ${NOISE}
      void main() {
        vec2 p = vec2(vPos.x * 2.2 + vPos.z * 1.4 - uPhase * 0.22, vPos.y * 10.0);
        float n = uDetail > 0.5 ? vnoise(p) * 0.65 + vnoise(p * 2.7 + 3.1) * 0.35 : vnoise(p);
        float shimmer = smoothstep(0.55, 0.95, n);
        float band = 0.5 + 0.5 * sin(vPos.x * 2.4 + vPos.z * 1.1 - uPhase * 0.7);
        vec3 col = mix(uBase, uGlow, (0.18 + 0.5 * shimmer + 0.14 * band) * uIntensity);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
    uniforms: {
      uBase: { value: new THREE.Color("#0b3558") },
      uGlow: { value: new THREE.Color("#5fd3f7") },
      uPhase: { value: 0 },
      uDetail: { value: 1 },
      uIntensity: { value: 0 },
    },
  });
}

/** Усан сангийн гадаргуу (CircleGeometry): долгио, гэрлийн тусгал, ирмэгийн гялбаа */
export function createWaterSurfaceMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: UV_VERTEX,
    fragmentShader: /* glsl */ `
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uGlow;
      uniform float uPhase;
      uniform float uDetail;
      varying vec2 vUv;
      ${NOISE}
      void main() {
        vec2 c = vUv - 0.5;
        float r = length(c) * 2.0;
        float ripple = sin(r * 24.0 - uPhase * 1.5) * 0.5 + 0.5;
        vec2 p = c * 6.0 + vec2(uPhase * 0.12, -uPhase * 0.08);
        float n = uDetail > 0.5 ? vnoise(p * 1.6) * 0.6 + vnoise(p * 3.7 + 2.0) * 0.4 : vnoise(p * 1.6);
        float caustic = smoothstep(0.58, 0.86, n);
        vec3 col = mix(uShallow, uDeep, r * 0.75);
        col += uGlow * (caustic * 0.32 + ripple * 0.05 * (1.0 - r));
        float glint = exp(-pow((c.x * 0.8 + c.y * 0.6 - sin(uPhase * 0.3) * 0.3) * 7.0, 2.0));
        col += uGlow * glint * 0.22;
        col = mix(col, uGlow, smoothstep(0.9, 1.0, r) * 0.55);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
    uniforms: {
      uDeep: { value: new THREE.Color("#12689f") },
      uShallow: { value: new THREE.Color("#3cc0f2") },
      uGlow: { value: new THREE.Color("#d8f6ff") },
      uPhase: { value: 0 },
      uDetail: { value: 1 },
    },
  });
}
