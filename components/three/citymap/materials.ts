import * as THREE from "three";
import { NOISE } from "../journey/materials/glsl";
import { DISTRICTS, PLANT, PUMPS, RESERVOIR, SOURCE_ZONE } from "./layout";
import { KEYS } from "./facilities";
import { ZONES } from "./state";
import { FLOOR_H } from "./city";
import { RIVER_RIBBON_HALF } from "./world";

/**
 * Хотын 3D газрын зургийн shader-үүд. Бүгд ShaderMaterial (procedural хээ, текстургүй), tone mapping-гүй.
 * Бүрэнхий/шөнийн гэрэл: сэрүүн сарны key + тэнгэр/газар hemisphere; дулаан цонх, гудамжны гэрэл; цэвэр усны cyan,
 * бохир усны ногоон, засварын улаан тодотгол. Fog нь камерын зайгаар (кадр бүр) — алс газар дэвсгэрт уусна.
 */
const f = (n: number) => n.toFixed(4);
const v3 = (hex: string, k = 1) => {
  const c = new THREE.Color(hex);
  return `vec3(${f(c.r * k)}, ${f(c.g * k)}, ${f(c.b * k)})`;
};
const v4rect = (r: { x0: number; z0: number; x1: number; z1: number }) => `vec4(${f(r.x0)}, ${f(r.z0)}, ${f(r.x1)}, ${f(r.z1)})`;
const dirGlsl = (x: number, y: number, z: number) => {
  const v = new THREE.Vector3(x, y, z).normalize();
  return `vec3(${f(v.x)}, ${f(v.y)}, ${f(v.z)})`;
};

export const FOG_COLOR = "#0b2740";

export type CityUniforms = ReturnType<typeof createCityUniforms>;
export function createCityUniforms() {
  return {
    uTime: { value: 0 },
    uPhase: { value: 0 },
    uDetail: { value: 1 },
    uEmph: { value: new Array<number>(ZONES).fill(1) },
    uClean: { value: 0 },
    uSewer: { value: 0 },
    uOutfall: { value: 0 },
    uLit: { value: new Array<number>(KEYS).fill(0) },
    uReservoir: { value: 0 },
    uPlant: { value: 0 },
    uWindows: { value: 0 },
    uWells: { value: 0 },
    uRepair: { value: new THREE.Vector2(999, 999) },
    uPulse: { value: 0 },
    uFogColor: { value: new THREE.Color(FOG_COLOR) },
    uFogStart: { value: 8 },
    uFogDensity: { value: 0.06 },
  };
}

// ---------------------------------------------------------------------------------------------

const COMMON = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogStart;
  uniform float uFogDensity;
  const vec3 KEY_DIR = ${dirGlsl(-0.5, 0.8, 0.38)};
  const vec3 KEY_COL = ${v3("#c8d8ee", 0.95)};
  const vec3 SKY = ${v3("#6f8fb8", 1.0)};
  const vec3 GROUND = ${v3("#222d3a", 1.0)};
  vec3 shade(vec3 alb, vec3 n) {
    float k = max(dot(n, KEY_DIR), 0.0);
    return alb * (mix(GROUND, SKY, 0.5 + 0.5 * n.y) + KEY_COL * k);
  }
  vec3 applyFog(vec3 col, vec3 w) {
    float d = length(w - cameraPosition);
    float fo = 1.0 - exp(-pow(max(d - uFogStart, 0.0) * uFogDensity, 2.0));
    float edge = smoothstep(10.5, 17.0, length((w.xz - vec2(0.0, 0.4)) * vec2(0.8, 1.2)));
    return mix(col, uFogColor, clamp(max(fo, edge), 0.0, 1.0));
  }
`;

const COLORSPACE = /* glsl */ `#include <colorspace_fragment>`;

const WORLD_VERTEX = /* glsl */ `
  varying vec3 vW;
  varying vec3 vN;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const RECT = /* glsl */ `
  float rectD(vec2 p, vec4 r) {
    vec2 c = (r.xy + r.zw) * 0.5;
    vec2 h = (r.zw - r.xy) * 0.5;
    vec2 d = abs(p - c) - h;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  }
`;

const districtRect = (id: string) => {
  const d = DISTRICTS.find((q) => q.id === id)!;
  return { x0: d.xs[0] - 0.12, x1: d.xs[d.xs.length - 1] + 0.12, z0: d.ys[0] - 0.12, z1: d.ys[d.ys.length - 1] + 0.12 };
};

// ---------------------------------------------------------------------------------------------
// Газар

export function terrainMaterial(U: CityUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: { uFogColor: U.uFogColor, uFogStart: U.uFogStart, uFogDensity: U.uFogDensity, uEmph: U.uEmph, uWells: U.uWells, uDetail: U.uDetail },
    vertexShader: /* glsl */ `
      attribute float aRiver;
      varying vec3 vW;
      varying vec3 vN;
      varying float vRiver;
      void main() {
        vW = position;
        vN = normal;
        vRiver = aRiver;
        gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uEmph[${ZONES}];
      uniform float uWells;
      uniform float uDetail;
      varying vec3 vW;
      varying vec3 vN;
      varying float vRiver;
      ${NOISE}
      ${COMMON}
      ${RECT}
      const vec4 R_OLD = ${v4rect(districtRect("old"))};
      const vec4 R_NEW = ${v4rect(districtRect("new"))};
      const vec4 R_IND = ${v4rect(districtRect("ind"))};
      const vec4 R_SRC = ${v4rect(SOURCE_ZONE)};
      const vec4 R_PLANT = ${v4rect(PLANT.pad)};
      const vec2 P1 = vec2(${f(PUMPS[0][0])}, ${f(PUMPS[0][1])});
      const vec2 P2 = vec2(${f(PUMPS[1][0])}, ${f(PUMPS[1][1])});
      const vec2 RES = vec2(${f(RESERVOIR.c[0])}, ${f(RESERVOIR.c[1])});
      const vec3 C_GRASS = ${v3("#34483a")};
      const vec3 C_DRY = ${v3("#4a503d")};
      const vec3 C_FIELD_A = ${v3("#4a4c39")};
      const vec3 C_FIELD_B = ${v3("#3a4a3c")};
      const vec3 C_ROCK = ${v3("#4a4842")};
      const vec3 C_REED = ${v3("#294335")};
      const vec3 C_MUD = ${v3("#3b3c37")};
      const vec3 C_URBAN_GRASS = ${v3("#33493b")};
      const vec3 C_PAVED = ${v3("#444d57")};
      const vec3 C_GRAVEL = ${v3("#4d525a")};
      const vec3 C_LAWN = ${v3("#3a5a44")};
      const vec3 C_CONC = ${v3("#5a646f")};
      const vec3 C_CYAN = ${v3("#38b6f0")};
      void main() {
        vec3 n = normalize(vN);
        vec2 q = vW.xz;
        float n1 = vnoise(q * 1.1);
        float n2 = vnoise(q * 4.7 + 7.0);
        float n3 = uDetail > 0.5 ? vnoise(q * 21.0 + 3.0) : 0.5;
        vec3 col = mix(C_GRASS, C_DRY, smoothstep(0.35, 0.8, n1) * 0.85);
        col *= 0.86 + 0.18 * n2 + 0.08 * n3;
        // хотоос гадуурх тариалангийн талбай (өмнөд, зүүн, баруун)
        float farm = max(smoothstep(4.9, 5.4, q.y), max(smoothstep(9.0, 9.6, q.x), smoothstep(-8.6, -9.2, q.x))) * step(-2.0, q.y);
        if (farm > 0.0) {
          vec2 fq = mat2(0.96, 0.28, -0.28, 0.96) * q;
          vec2 cell = fq * vec2(0.85, 2.1);
          vec2 fid = floor(cell);
          vec2 fe = abs(fract(cell) - 0.5);
          vec3 fc = mix(C_FIELD_A, C_FIELD_B, hash21(fid)) * (0.9 + 0.1 * vnoise(fq * vec2(2.0, 40.0)));
          fc *= mix(0.78, 1.0, smoothstep(0.47, 0.44, max(fe.x, fe.y)));
          col = mix(col, fc, farm * 0.8);
        }
        // толгод: налуу ба өндөр
        float slope = 1.0 - n.y;
        col = mix(col, C_ROCK, smoothstep(0.12, 0.4, slope) * 0.55);
        col *= mix(1.0, 1.12, smoothstep(0.15, 1.0, vW.y));
        // голын эрэг: зэгс/нойтон шавар
        col = mix(col, C_REED, (1.0 - smoothstep(0.34, 0.8, vRiver)) * 0.75);
        col = mix(col, C_MUD, 1.0 - smoothstep(0.27, 0.35, vRiver));
        // хотын газар: хашааны зүлэг + хучилт; үйлдвэрийн талбай — хучилт, хайрга
        float dOld = rectD(q, R_OLD);
        float dNew = rectD(q, R_NEW);
        float dInd = rectD(q, R_IND);
        float urban = 1.0 - smoothstep(0.0, 0.2, min(min(dOld, dNew), dInd));
        float nu = vnoise(q * 9.0 + 2.0);
        vec3 uc = mix(C_URBAN_GRASS, C_PAVED, smoothstep(0.4, 0.65, nu * 0.7 + n2 * 0.3)) * (0.92 + 0.1 * n3);
        if (dInd < 0.1) uc = mix(C_PAVED, C_GRAVEL, smoothstep(0.3, 0.8, n2)) * (0.92 + 0.1 * n3);
        col = mix(col, uc, urban);
        // байгууламжийн талбай
        float dSrc = rectD(q, R_SRC);
        col = mix(col, C_LAWN * (0.9 + 0.12 * n2), (1.0 - smoothstep(0.0, 0.04, dSrc)) * 0.85);
        float pads = min(min(length(q - P1) - 0.3, length(q - P2) - 0.3), length(q - RES) - ${f(RESERVOIR.r + 0.2)});
        col = mix(col, C_GRAVEL * (0.9 + 0.12 * n3), 1.0 - smoothstep(0.0, 0.05, pads));
        col = mix(col, C_CONC * (0.9 + 0.1 * n3), 1.0 - smoothstep(0.0, 0.03, rectD(q, R_PLANT)));
        vec3 lit = shade(col, n);
        // эх үүсвэрийн бүс онцлогдох үед (1-р алхам) бүдэг cyan
        lit += C_CYAN * 0.035 * uWells * uEmph[0] * (1.0 - smoothstep(-0.05, 0.08, dSrc));
        gl_FragColor = vec4(applyFog(lit, vW), 1.0);
        ${COLORSPACE}
      }
    `,
  });
}

// ---------------------------------------------------------------------------------------------
// Хараа гол

export function riverMaterial(U: CityUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: { uFogColor: U.uFogColor, uFogStart: U.uFogStart, uFogDensity: U.uFogDensity, uTime: U.uTime, uPhase: U.uPhase, uEmph: U.uEmph, uDetail: U.uDetail },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uPhase;
      uniform float uEmph[${ZONES}];
      uniform float uDetail;
      varying vec3 vW;
      varying vec2 vUv;
      ${NOISE}
      ${COMMON}
      const vec3 W_DEEP = ${v3("#0e3456")};
      const vec3 W_MID = ${v3("#195784")};
      const vec3 W_SHALLOW = ${v3("#246a92")};
      const vec3 W_HI = ${v3("#8fdcff")};
      const vec3 SKY_REFL = ${v3("#4a79a8")};
      void main() {
        float s = vUv.x;
        float across = abs(vUv.y - 0.5) * ${f(RIVER_RIBBON_HALF * 2)};
        float flow = uPhase * 0.22 + uTime * 0.07;
        float n1 = vnoise(vec2(s * 2.6 - flow * 2.6, vUv.y * 9.0));
        float n2 = uDetail > 0.5 ? vnoise(vec2(s * 8.0 - flow * 5.5, vUv.y * 26.0 + 3.0)) : n1;
        vec3 col = mix(W_DEEP, W_MID, 0.25 + 0.35 * n1);
        col = mix(col, W_SHALLOW, smoothstep(0.1, 0.27, across) * 0.55);
        vec3 v = normalize(cameraPosition - vW);
        float fres = pow(1.0 - clamp(v.y, 0.0, 1.0), 3.0);
        col += SKY_REFL * (0.12 + fres * 0.6);
        float glint = smoothstep(0.78, 0.97, n1 * 0.45 + n2 * 0.55);
        col += W_HI * glint * (0.22 + 0.12 * uEmph[0]);
        col += W_HI * smoothstep(0.72, 0.96, n2) * 0.05;
        col += W_HI * (1.0 - smoothstep(0.0, 0.018, abs(across - 0.265))) * 0.14;
        gl_FragColor = vec4(applyFog(col, vW), 1.0);
        ${COLORSPACE}
      }
    `,
  });
}

// ---------------------------------------------------------------------------------------------
// Зам, явган зам

export function roadMaterial(U: CityUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: { uFogColor: U.uFogColor, uFogStart: U.uFogStart, uFogDensity: U.uFogDensity },
    vertexShader: /* glsl */ `
      attribute vec4 aRoad;
      attribute vec2 aEnds;
      attribute float aKind;
      varying vec3 vW;
      varying vec4 vRoad;
      varying vec2 vEnds;
      varying float vKind;
      void main() {
        vRoad = aRoad;
        vEnds = aEnds;
        vKind = aKind;
        vW = position;
        gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vW;
      varying vec4 vRoad;
      varying vec2 vEnds;
      varying float vKind;
      ${NOISE}
      ${COMMON}
      const vec3 C_ASPH = ${v3("#283038")};
      const vec3 C_MARK = ${v3("#e2e8ec")};
      float line(float x, float c, float w) {
        float d = abs(x - c);
        return 1.0 - smoothstep(w * 0.5, w * 0.5 + fwidth(x) * 1.2, d);
      }
      void main() {
        vec3 col = C_ASPH * (0.86 + 0.12 * vnoise(vW.xz * 36.0) + 0.06 * (hash21(floor(vW.xz * 420.0)) - 0.5));
        if (vKind < 0.5) {
          float along = vRoad.x;
          float hw = vRoad.z * 0.5;
          float x = vRoad.y * hw;
          float major = vRoad.w;
          // дугуйн мөр (бага зэрэг бараан зурвас)
          col *= 1.0 - 0.06 * (line(abs(x), hw * 0.5, hw * 0.35));
          float m = line(abs(x), hw - 0.009, 0.003);
          if (major > 0.5) {
            m = max(m, line(abs(x), 0.004, 0.0022));
            m = max(m, line(abs(x), hw * 0.5, 0.002) * step(fract(along * 9.0), 0.55));
          } else {
            m = max(m, line(x, 0.0, 0.0022) * step(fract(along * 9.0), 0.5));
          }
          // уулзварын өмнөх явган хүний гарц
          float zebra = (1.0 - step(0.045, min(vEnds.x, vEnds.y))) * step(abs(x), hw - 0.014);
          zebra *= step(0.5, fract(x * 46.0)) * step(0.008, min(vEnds.x, vEnds.y));
          m = max(m, zebra);
          col = mix(col, C_MARK * (0.68 + 0.12 * vnoise(vW.xz * 90.0)), m * 0.85);
        } else {
          col *= 0.96;
        }
        vec3 lit = shade(col, vec3(0.0, 1.0, 0.0));
        gl_FragColor = vec4(applyFog(lit, vW), 1.0);
        ${COLORSPACE}
      }
    `,
  });
}

export function sidewalkMaterial(U: CityUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: { uFogColor: U.uFogColor, uFogStart: U.uFogStart, uFogDensity: U.uFogDensity },
    vertexShader: WORLD_VERTEX,
    fragmentShader: /* glsl */ `
      varying vec3 vW;
      varying vec3 vN;
      ${NOISE}
      ${COMMON}
      void main() {
        vec3 n = normalize(vN);
        vec3 col = ${v3("#606a74")} * (0.86 + 0.12 * vnoise(vW.xz * 60.0));
        if (n.y < 0.5) col = ${v3("#7c858e")};
        gl_FragColor = vec4(applyFog(shade(col, n), vW), 1.0);
        ${COLORSPACE}
      }
    `,
  });
}

// ---------------------------------------------------------------------------------------------
// Барилга (instanced): давхар бүрийн цонх, дээвэр; ус хүрсэн барилгын суурьт cyan, 6-р алхамд цонх долгиогоор асна

export function buildingMaterial(U: CityUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uFogColor: U.uFogColor,
      uFogStart: U.uFogStart,
      uFogDensity: U.uFogDensity,
      uEmph: U.uEmph,
      uClean: U.uClean,
      uWindows: U.uWindows,
      uTime: U.uTime,
    },
    vertexShader: /* glsl */ `
      attribute vec3 aSize;
      attribute float aSeed;
      attribute float aKind;
      attribute float aDist;
      varying vec3 vW;
      varying vec3 vN;
      varying vec3 vL;
      varying vec3 vLN;
      varying vec3 vSize;
      varying float vSeed;
      varying float vKind;
      varying float vDist;
      void main() {
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        vL = position;
        vLN = normal;
        vSize = aSize;
        vSeed = aSeed;
        vKind = aKind;
        vDist = aDist;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uEmph[${ZONES}];
      uniform float uClean;
      uniform float uWindows;
      uniform float uTime;
      varying vec3 vW;
      varying vec3 vN;
      varying vec3 vL;
      varying vec3 vLN;
      varying vec3 vSize;
      varying float vSeed;
      varying float vKind;
      varying float vDist;
      ${NOISE}
      ${COMMON}
      const float FLOOR_H = ${f(FLOOR_H)};
      const vec3 C_ROOF = ${v3("#3a424b")};
      const vec3 C_GLASS = ${v3("#0d1924")};
      const vec3 C_WARM = ${v3("#ffc979")};
      const vec3 C_WARM2 = ${v3("#ffe2b3")};
      const vec3 C_CYAN = ${v3("#38b6f0")};
      vec3 wallColor(float kind, float s) {
        if (kind < 0.5) return mix(mix(${v3("#959ca5")}, ${v3("#a39a88")}, step(0.55, s)), ${v3("#8fa0ab")}, step(0.85, s));
        if (kind < 1.5) return mix(mix(${v3("#a6b0ba")}, ${v3("#b0a296")}, step(0.6, s)), ${v3("#9aa8b1")}, step(0.82, s));
        if (kind < 2.5) return mix(${v3("#737c84")}, ${v3("#817f77")}, step(0.5, s));
        return ${v3("#a39686")};
      }
      void main() {
        vec3 n = normalize(vN);
        float kind = vKind;
        float emph = mix(0.52, 1.0, uEmph[3]);
        vec3 col;
        vec3 glow = vec3(0.0);
        if (vLN.y > 0.5) {
          // дээвэр: хашлагын ирмэг, дээврийн төхөөрөмж
          vec2 p = vL.xz * vSize.xz;
          vec2 e = vSize.xz * 0.5 - abs(p);
          float edge = 1.0 - smoothstep(0.004, 0.008, min(e.x, e.y));
          vec2 cell = floor(p / 0.05 + vSeed * 13.0);
          float unit = step(0.86, hash21(cell)) * (1.0 - edge);
          col = C_ROOF * (0.9 + 0.12 * vnoise(p * 40.0 + vSeed * 9.0));
          col = mix(col, ${v3("#4a525a")}, edge * 0.8);
          col = mix(col, ${v3("#3c444c")}, unit);
          col = shade(col, n) * emph;
        } else {
          bool sx = abs(vLN.x) > 0.5;
          float len = sx ? vSize.z : vSize.x;
          float u = (sx ? vL.z : vL.x) * len;
          float y = vL.y * vSize.y;
          float face = sx ? (vLN.x > 0.0 ? 1.0 : 2.0) : (vLN.z > 0.0 ? 3.0 : 4.0);
          col = wallColor(kind, vSeed);
          // панелийн заадас (хуучин байр)
          if (kind < 0.5) col *= 0.94 + 0.06 * step(0.08, fract(y / FLOOR_H));
          col *= 0.92 + 0.08 * vnoise(vec2(u, y) * 30.0 + vSeed * 5.0);
          col *= mix(0.72, 1.0, smoothstep(0.0, 0.012, y));
          // цонх
          float colW = kind < 0.5 ? 0.033 : 0.03;
          float rowH = kind > 1.5 ? 0.034 : FLOOR_H;
          vec2 cell = vec2((u + len * 0.5) / colW, (y - 0.004) / rowH);
          vec2 id = floor(cell);
          vec2 fr = fract(cell);
          float win = step(0.2, fr.x) * step(fr.x, 0.8) * step(0.28, fr.y) * step(fr.y, 0.76);
          win *= step(0.012, len * 0.5 - abs(u)) * step(y, vSize.y - 0.01) * step(0.004, y);
          if (kind > 1.5 && kind < 2.5) win *= step(0.6, hash21(id * 1.3 + vSeed)) * step(id.y, 1.5);
          float h = hash21(id + vec2(vSeed * 37.0, face * 11.0));
          // ус хүрсэн дарааллаар асах долгион (6-р алхам), түүнээс өмнө бүрэнхийн сийрэг гэрэл
          float wave = smoothstep(vDist - 0.5, vDist, uWindows);
          float frac = mix(0.2, 0.82, wave) * (kind > 1.5 && kind < 2.5 ? 0.7 : 1.0);
          float on = step(h, frac);
          vec3 warm = mix(C_WARM, C_WARM2, hash21(id * 0.7 + vSeed)) * (0.75 + 0.35 * hash21(id + 3.1));
          vec3 glass = C_GLASS + ${v3("#1e3550")} * (0.3 + 0.7 * fr.y) * 0.5;
          col = shade(col, n) * emph;
          col = mix(col, mix(glass, warm * mix(0.75, 1.15, wave), on), win);
          // ус хүрсэн: суурийн cyan зурвас (4-р алхмаас)
          float supplied = smoothstep(vDist - 0.12, vDist, uClean);
          glow += C_CYAN * supplied * (1.0 - smoothstep(0.0, 0.018, y)) * 0.45 * (1.0 - 0.6 * wave);
        }
        col += glow;
        gl_FragColor = vec4(applyFog(col, vW), 1.0);
        ${COLORSPACE}
      }
    `,
  });
}

// ---------------------------------------------------------------------------------------------
// Мод (instanced): бага зэрэг найгана (зөвхөн ambient)

export function treeMaterial(U: CityUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: { uFogColor: U.uFogColor, uFogStart: U.uFogStart, uFogDensity: U.uFogDensity, uTime: U.uTime },
    vertexShader: /* glsl */ `
      attribute float aTint;
      attribute float aPart;
      uniform float uTime;
      varying vec3 vW;
      varying vec3 vN;
      varying float vTint;
      varying float vPart;
      void main() {
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        float sway = sin(uTime * 1.1 + w.x * 2.7 + w.z * 1.9) * 0.0035 * aPart * position.y * 12.0;
        w.x += sway;
        w.z += sway * 0.6;
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        vTint = aTint;
        vPart = aPart;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vW;
      varying vec3 vN;
      varying float vTint;
      varying float vPart;
      ${NOISE}
      ${COMMON}
      void main() {
        vec3 n = normalize(vN);
        vec3 crown = mix(mix(${v3("#31563f")}, ${v3("#3d684b")}, step(0.45, vTint)), ${v3("#4d6542")}, step(0.85, vTint));
        vec3 col = vPart > 0.5 ? crown * (0.8 + 0.35 * vnoise(vW.xz * 60.0 + vW.y * 40.0)) : ${v3("#3a2e25")};
        gl_FragColor = vec4(applyFog(shade(col, n), vW), 1.0);
        ${COLORSPACE}
      }
    `,
  });
}

// ---------------------------------------------------------------------------------------------
// Шугам сүлжээ: цэвэр (cyan) / бохир (ногоон) / цэвэршсэн гаргалгаа; урсгалын фронт, импульс, засварын улаан хэсэг

const PIPE_FRAG_HEAD = /* glsl */ `
  uniform float uClean;
  uniform float uSewer;
  uniform float uOutfall;
  uniform float uPhase;
  uniform vec2 uRepair;
  uniform float uPulse;
  const vec3 CLEAN_OFF = ${v3("#173f5f")};
  const vec3 CLEAN_ON = ${v3("#38b6f0")};
  const vec3 CLEAN_HI = ${v3("#b5ecff")};
  const vec3 SEWER_OFF = ${v3("#173d36")};
  const vec3 SEWER_ON = ${v3("#1fa37a")};
  const vec3 SEWER_HI = ${v3("#9af0cf")};
  const vec3 TREATED = ${v3("#4fd2d8")};
  const vec3 ALERT = ${v3("#ff5a6e")};
  /** x — асаалттай эсэх (0..1), y — импульс, z — фронтын толгой */
  vec3 flowState(float kind, float d, float along) {
    float front = kind < 0.5 ? uClean : kind < 1.5 ? uSewer : uOutfall;
    float pos = kind < 1.5 ? d : along;
    float on = smoothstep(front + 0.02, front - 0.06, pos);
    float x = fract(pos * (kind < 1.5 ? 2.4 : 6.0) - uPhase * 0.9);
    float pulse = smoothstep(0.0, 0.08, x) * (1.0 - smoothstep(0.12, 0.34, x));
    float head = (1.0 - smoothstep(0.0, 0.22, front - pos)) * on * step(pos, front);
    return vec3(on, pulse * on, head);
  }
  float repairMask(vec2 p) {
    return 1.0 - smoothstep(0.1, 0.26, length(p - uRepair));
  }
`;

export function pipeMaterial(U: CityUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uFogColor: U.uFogColor,
      uFogStart: U.uFogStart,
      uFogDensity: U.uFogDensity,
      uClean: U.uClean,
      uSewer: U.uSewer,
      uOutfall: U.uOutfall,
      uPhase: U.uPhase,
      uRepair: U.uRepair,
      uPulse: U.uPulse,
      uEmph: U.uEmph,
    },
    vertexShader: /* glsl */ `
      attribute float aD;
      attribute float aKind;
      attribute float aAlong;
      attribute float aTrunk;
      varying vec3 vW;
      varying vec3 vN;
      varying float vD;
      varying float vKind;
      varying float vAlong;
      varying float vTrunk;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vD = aD;
        vKind = aKind;
        vAlong = aAlong;
        vTrunk = aTrunk;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vW;
      varying vec3 vN;
      varying float vD;
      varying float vKind;
      varying float vAlong;
      varying float vTrunk;
      uniform float uEmph[${ZONES}];
      ${NOISE}
      ${COMMON}
      ${PIPE_FRAG_HEAD}
      void main() {
        vec3 n = normalize(vN);
        vec3 v = normalize(cameraPosition - vW);
        float facing = abs(dot(n, v));
        vec3 st = flowState(vKind, vD, vAlong);
        vec3 off = vKind < 0.5 ? CLEAN_OFF : SEWER_OFF;
        vec3 on = vKind < 0.5 ? CLEAN_ON : vKind < 1.5 ? SEWER_ON : TREATED;
        vec3 hi = vKind < 0.5 ? CLEAN_HI : SEWER_HI;
        // асаалтгүй: бараан хоолой (гэрэлтэй); асаалттай: дотроосоо гэрэлтэх цөм (төв нь тод)
        vec3 dark = shade(off * 1.6, n);
        vec3 glow = on * (0.42 + 0.48 * pow(facing, 1.4)) + hi * (st.y * 0.45 + st.z * 0.75);
        // онцлох алхам: цэвэр ус — хот (4-р алхам), бохир ус — цэвэрлэх байгууламж (5-р алхам)
        glow *= mix(0.55, 1.0, vKind < 0.5 ? uEmph[3] : uEmph[4]);
        vec3 col = mix(dark, glow, st.x);
        float rep = repairMask(vW.xz) * step(vKind, 0.5);
        col = mix(col, ALERT * (0.75 + 0.45 * pow(facing, 1.2)) + ALERT * 0.35 * uPulse, rep * 0.9);
        gl_FragColor = vec4(applyFog(col, vW), 1.0);
        ${COLORSPACE}
      }
    `,
  });
}

/** Хоолойн гэрлийн туяа (bloom-гүйгээр): өргөн хоолойн additive fresnel бүрхүүл — зөвхөн асаалттай хэсэгт */
export function pipeGlowMaterial(U: CityUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uClean: U.uClean,
      uSewer: U.uSewer,
      uOutfall: U.uOutfall,
      uPhase: U.uPhase,
      uRepair: U.uRepair,
      uPulse: U.uPulse,
      uFogColor: U.uFogColor,
      uFogStart: U.uFogStart,
      uFogDensity: U.uFogDensity,
    },
    vertexShader: /* glsl */ `
      attribute float aD;
      attribute float aKind;
      attribute float aAlong;
      varying vec3 vW;
      varying vec3 vN;
      varying float vD;
      varying float vKind;
      varying float vAlong;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vD = aD;
        vKind = aKind;
        vAlong = aAlong;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vW;
      varying vec3 vN;
      varying float vD;
      varying float vKind;
      varying float vAlong;
      ${COMMON}
      ${PIPE_FRAG_HEAD}
      void main() {
        vec3 n = normalize(vN);
        vec3 v = normalize(cameraPosition - vW);
        float facing = abs(dot(n, v));
        vec3 st = flowState(vKind, vD, vAlong);
        vec3 on = vKind < 0.5 ? CLEAN_ON : vKind < 1.5 ? SEWER_ON : TREATED;
        float a = pow(facing, 2.2) * (0.1 + 0.16 * st.y + 0.3 * st.z) * st.x;
        float rep = repairMask(vW.xz) * step(vKind, 0.5);
        vec3 col = mix(on, ALERT, rep);
        a = max(a, rep * pow(facing, 2.0) * (0.3 + 0.3 * uPulse));
        float d = length(vW - cameraPosition);
        a *= 1.0 - clamp(1.0 - exp(-pow(max(d - uFogStart, 0.0) * uFogDensity, 2.0)), 0.0, 1.0);
        gl_FragColor = vec4(col * a, a);
        ${COLORSPACE}
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/** Холбоос (instanced богино цилиндр): бараан таг + асаалттай үед гэрэлтэх цагираг */
export function jointMaterial(U: CityUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uFogColor: U.uFogColor,
      uFogStart: U.uFogStart,
      uFogDensity: U.uFogDensity,
      uClean: U.uClean,
      uSewer: U.uSewer,
      uOutfall: U.uOutfall,
      uPhase: U.uPhase,
      uRepair: U.uRepair,
      uPulse: U.uPulse,
    },
    vertexShader: /* glsl */ `
      attribute float aD;
      attribute float aKind;
      varying vec3 vW;
      varying vec3 vN;
      varying vec3 vL;
      varying float vD;
      varying float vKind;
      void main() {
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        vL = position;
        vD = aD;
        vKind = aKind;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vW;
      varying vec3 vN;
      varying vec3 vL;
      varying float vD;
      varying float vKind;
      ${NOISE}
      ${COMMON}
      ${PIPE_FRAG_HEAD}
      void main() {
        vec3 n = normalize(vN);
        vec3 st = flowState(vKind, vD, 0.0);
        vec3 on = vKind < 0.5 ? CLEAN_ON : SEWER_ON;
        vec3 col = shade(${v3("#5b6873")}, n);
        float band = 1.0 - smoothstep(0.08, 0.14, abs(vL.y - 0.62));
        col = mix(col, on * 1.3, band * st.x);
        col += on * 0.25 * st.x * step(0.5, n.y);
        gl_FragColor = vec4(applyFog(col, vW), 1.0);
        ${COLORSPACE}
      }
    `,
  });
}

// ---------------------------------------------------------------------------------------------
// Байгууламж

export function facilityMaterial(U: CityUniforms) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uFogColor: U.uFogColor, uFogStart: U.uFogStart, uFogDensity: U.uFogDensity, uEmph: U.uEmph },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aMat;
      attribute float aZone;
      varying vec3 vW;
      varying vec3 vN;
      varying vec3 vCol;
      varying float vMat;
      varying float vZone;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vCol = aColor;
        vMat = aMat;
        vZone = aZone;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uEmph[${ZONES}];
      varying vec3 vW;
      varying vec3 vN;
      varying vec3 vCol;
      varying float vMat;
      varying float vZone;
      ${NOISE}
      ${COMMON}
      void main() {
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        vec3 v = normalize(cameraPosition - vW);
        int m = int(vMat + 0.5);
        vec3 alb = vCol;
        float sp = 0.0;
        if (m == 0) alb *= 0.88 + 0.12 * vnoise(vW.xz * 50.0 + vW.y * 30.0);
        else if (m == 1) sp = 0.35;
        else if (m == 2) sp = 0.2;
        else if (m == 5) alb *= 0.75 + 0.3 * step(0.4, fract(vW.x * 120.0));
        else if (m == 6) alb *= mix(0.45, 1.0, smoothstep(0.0, 0.14, vW.y));
        else if (m == 7) alb = mix(${v3("#e8eef2")}, ${v3("#d94a5c")}, step(0.5, fract((vW.x + vW.z) * 40.0)));
        vec3 col = shade(alb, n);
        col += ${v3("#dce8f2")} * sp * pow(max(dot(n, normalize(KEY_DIR + v)), 0.0), 30.0);
        int z = int(vZone + 0.5);
        float e = z >= 5 ? 1.0 : uEmph[z];
        col *= mix(0.5, 1.0, e);
        gl_FragColor = vec4(applyFog(col, vW), 1.0);
        ${COLORSPACE}
      }
    `,
  });
}

/** Байгууламжийн гэрэл: цонх, фланцын цагираг, дохионы гэрэл — uLit[aKey]-ээр */
export function facilityLightMaterial(U: CityUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: { uFogColor: U.uFogColor, uFogStart: U.uFogStart, uFogDensity: U.uFogDensity, uLit: U.uLit },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aKey;
      uniform float uLit[${KEYS}];
      varying vec3 vW;
      varying vec3 vCol;
      varying float vLit;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vCol = aColor;
        vLit = uLit[int(aKey + 0.5)];
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vW;
      varying vec3 vCol;
      varying float vLit;
      ${COMMON}
      void main() {
        vec3 col = mix(${v3("#1a242e")}, vCol, clamp(vLit, 0.0, 1.0)) * (1.0 + 0.3 * max(vLit - 1.0, 0.0));
        gl_FragColor = vec4(applyFog(col, vW), 1.0);
        ${COLORSPACE}
      }
    `,
  });
}

/** Усан сан (цэвэр ус, түвшин uReservoir), тунгаагуур/агааржуулах сав (бохир → идэвхтэй, uPlant) */
export function facilityWaterMaterial(U: CityUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uFogColor: U.uFogColor,
      uFogStart: U.uFogStart,
      uFogDensity: U.uFogDensity,
      uReservoir: U.uReservoir,
      uPlant: U.uPlant,
      uTime: U.uTime,
      uPhase: U.uPhase,
    },
    vertexShader: /* glsl */ `
      attribute float aKind;
      uniform float uReservoir;
      varying vec3 vW;
      varying float vKind;
      void main() {
        vec3 p = position;
        // усан сан: бага түвшнээс (нөөц) 3-р алхамд дүүрнэ
        if (aKind < 0.5) p.y = 0.018 + (0.25 + 0.75 * uReservoir) * ${f(RESERVOIR.h - 0.045)};
        vec4 w = modelMatrix * vec4(p, 1.0);
        vW = w.xyz;
        vKind = aKind;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uReservoir;
      uniform float uPlant;
      uniform float uTime;
      uniform float uPhase;
      varying vec3 vW;
      varying float vKind;
      ${NOISE}
      ${COMMON}
      void main() {
        float t = uPhase * 0.4 + uTime * 0.12;
        vec3 col;
        if (vKind < 0.5) {
          vec2 d = vW.xz - vec2(${f(RESERVOIR.c[0])}, ${f(RESERVOIR.c[1])});
          float r = length(d) / ${f(RESERVOIR.r)};
          float rings = 0.5 + 0.5 * sin(r * 22.0 - t * 6.0);
          col = mix(${v3("#0c3a63")}, ${v3("#1b77b3")}, 0.35 + 0.35 * vnoise(vW.xz * 14.0 + t));
          col += ${v3("#8fe0ff")} * rings * 0.12 * (1.0 - r) + ${v3("#38b6f0")} * 0.18 * uReservoir;
        } else {
          float n = vnoise(vW.xz * 24.0 + vec2(t, -t * 0.7));
          vec3 idle = ${v3("#1b2a25")};
          vec3 act = mix(${v3("#11463c")}, ${v3("#1f8a6a")}, 0.35 + 0.4 * n);
          if (vKind > 1.5) act = mix(act, ${v3("#b9f2dc")}, smoothstep(0.62, 0.9, vnoise(vW.xz * 70.0 + t * 3.0)) * 0.45);
          col = mix(idle, act, uPlant);
        }
        gl_FragColor = vec4(applyFog(col, vW), 1.0);
        ${COLORSPACE}
      }
    `,
  });
}

/** Газрын гэрэлт тэмдэглэгээ (additive): худаг/насос/усан сангийн цагираг, бүсийн тасархай хүрээ, засварын улаан импульс */
export function decalMaterial(U: CityUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: { uLit: U.uLit, uTime: U.uTime, uPhase: U.uPhase, uPulse: U.uPulse },
    vertexShader: /* glsl */ `
      attribute float aKind;
      attribute float aKey;
      attribute vec2 aSize;
      uniform float uLit[${KEYS}];
      varying vec2 vUv;
      varying float vKind;
      varying float vLit;
      varying vec2 vSize;
      void main() {
        vUv = uv;
        vKind = aKind;
        vLit = uLit[int(aKey + 0.5)];
        vSize = aSize;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uPhase;
      uniform float uPulse;
      varying vec2 vUv;
      varying float vKind;
      varying float vLit;
      varying vec2 vSize;
      void main() {
        vec3 col;
        float a;
        if (vKind < 0.5) {
          // цагираг + гадагш тархах долгион
          float r = length(vUv - 0.5) * 2.0;
          float ring = 1.0 - smoothstep(0.0, 0.035, abs(r - 0.42));
          float w = fract(uPhase * 0.6 + uTime * 0.35);
          float ripple = (1.0 - smoothstep(0.0, 0.05, abs(r - (0.42 + w * 0.55)))) * (1.0 - w);
          float fill = (1.0 - smoothstep(0.0, 0.42, r)) * 0.12;
          a = (ring * 0.7 + ripple * 0.6 + fill) * step(r, 1.0);
          col = ${v3("#38b6f0")};
        } else if (vKind < 1.5) {
          // тэгш өнцөгт бүсийн тасархай хүрээ
          vec2 p = (vUv - 0.5) * vSize;
          vec2 e = vSize * 0.5 - abs(p) - 0.04;
          float d = min(e.x, e.y);
          float border = 1.0 - smoothstep(0.0, 0.012, abs(d));
          float per = (abs(p.x) / vSize.x > abs(p.y) / vSize.y) ? p.y : p.x;
          float dash = step(0.45, fract(per * 9.0 - uPhase * 0.3));
          a = border * dash * 0.75 + (1.0 - smoothstep(0.0, 0.25, -d)) * step(0.0, d) * 0.05;
          col = ${v3("#38b6f0")};
        } else {
          // засвар: улаан импульс
          float r = length(vUv - 0.5) * 2.0;
          float w = fract(uTime * 0.5);
          float ring = 1.0 - smoothstep(0.0, 0.06, abs(r - (0.2 + w * 0.7)));
          a = (ring * (1.0 - w) * 0.9 + (1.0 - smoothstep(0.0, 0.3, r)) * 0.35 + uPulse * 0.1 * (1.0 - smoothstep(0.0, 0.5, r))) * step(r, 1.0);
          col = ${v3("#ff5a6e")};
          a *= 1.0;
          gl_FragColor = vec4(col * a, a);
          ${COLORSPACE}
          return;
        }
        a *= vLit;
        gl_FragColor = vec4(col * a, a);
        ${COLORSPACE}
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// ---------------------------------------------------------------------------------------------
// Гудамжны гэрэл: шон (instanced), гэрлийн туяа (billboard), газрын толбо

export function poleMaterial(U: CityUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: { uFogColor: U.uFogColor, uFogStart: U.uFogStart, uFogDensity: U.uFogDensity },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      varying vec3 vN;
      void main() {
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vW;
      varying vec3 vN;
      ${COMMON}
      void main() {
        gl_FragColor = vec4(applyFog(shade(${v3("#4c5864")}, normalize(vN)), vW), 1.0);
        ${COLORSPACE}
      }
    `,
  });
}

/** Instanced billboard (камер руу харсан) — гэрлийн туяа; aSize — хэмжээ */
export function spriteMaterial(U: CityUniforms, color: string, strength: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uFogColor: U.uFogColor, uFogStart: U.uFogStart, uFogDensity: U.uFogDensity, uTime: U.uTime },
    vertexShader: /* glsl */ `
      attribute float aSize;
      varying vec2 vUv;
      varying vec3 vW;
      void main() {
        vec4 c = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 w = c.xyz + (right * position.x + up * position.y) * aSize;
        vUv = uv;
        vW = c.xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vW;
      ${COMMON}
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float a = (pow(max(1.0 - r, 0.0), 3.0) * 0.8 + pow(max(1.0 - r, 0.0), 12.0)) * ${f(strength)};
        float d = length(vW - cameraPosition);
        a *= 1.0 - clamp(1.0 - exp(-pow(max(d - uFogStart, 0.0) * uFogDensity, 2.0)), 0.0, 1.0);
        gl_FragColor = vec4(${v3(color)} * a, a);
        ${COLORSPACE}
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/** Газар дээрх дулаан гэрлийн толбо (instanced хэвтээ quad) */
export function poolMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float a = pow(max(1.0 - r, 0.0), 2.0) * 0.24;
        gl_FragColor = vec4(${v3("#ffc98a")} * a, a);
        ${COLORSPACE}
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
