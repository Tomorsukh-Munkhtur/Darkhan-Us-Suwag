import * as THREE from "three";
import { NOISE } from "./glsl";

/**
 * Хотын барилгууд (InstancedMesh, нэг draw call).
 * Instance бүрийн атрибут: aDelay (0–1, эх үүсвэрээс хэр хол), aSeed, aFloors (давхрын тоо).
 * uGrow — барилга долгиолон босно; uLit — ус хүрэхийн хэрээр цонх шар гэрэлтэнэ.
 * CPU-гаас матриц шинэчлэхгүй — бүх анимац shader-т.
 */
export function createBuildingMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute float aDelay;
      attribute float aSeed;
      attribute float aFloors;
      uniform float uGrow;
      varying vec2 vUv;
      varying vec3 vN;
      varying float vDelay;
      varying float vSeed;
      varying float vFloors;
      void main() {
        vUv = uv;
        vDelay = aDelay;
        vSeed = aSeed;
        vFloors = aFloors;
        float g = clamp((uGrow - aDelay * 0.55) * 2.6, 0.0, 1.0);
        g = 1.0 - pow(1.0 - g, 3.0);
        vec3 p = position;
        p.y *= max(g, 0.001);
        vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uBody;
      uniform vec3 uRoof;
      uniform vec3 uWindow;
      uniform vec3 uWarm;
      uniform vec3 uLightDir;
      uniform float uLit;
      varying vec2 vUv;
      varying vec3 vN;
      varying float vDelay;
      varying float vSeed;
      varying float vFloors;
      ${NOISE}
      void main() {
        vec3 n = normalize(vN);
        float diff = 0.5 + 0.5 * max(dot(n, uLightDir), 0.0);
        float top = step(0.5, n.y);
        vec3 col = mix(uBody, uRoof, top) * diff;
        if (top < 0.5 && abs(n.y) < 0.5) {
          vec2 g = vec2(vUv.x * 3.0, vUv.y * vFloors);
          vec2 f = fract(g);
          vec2 id = floor(g);
          float win = step(0.26, f.x) * step(f.x, 0.74) * step(0.3, f.y) * step(f.y, 0.72) * step(0.5, id.y);
          float on = step(0.28, hash21(id + vSeed * 17.0));
          float lit = smoothstep(vDelay, vDelay + 0.12, uLit) * on;
          col = mix(col, mix(uWindow, uWarm, lit), win);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
    uniforms: {
      uBody: { value: new THREE.Color("#1b4a70") },
      uRoof: { value: new THREE.Color("#2a6490") },
      uWindow: { value: new THREE.Color("#0c2238") },
      uWarm: { value: new THREE.Color("#ffc94d") },
      uLightDir: { value: new THREE.Vector3(0.45, 0.75, 0.5).normalize() },
      uGrow: { value: 0 },
      uLit: { value: 0 },
    },
  });
}
