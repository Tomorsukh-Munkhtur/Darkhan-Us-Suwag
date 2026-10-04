import * as THREE from "three";
import { NOISE } from "../journey/materials/glsl";
import { DISTRICTS, GER_AREAS, HIGHWAY, PARK, PLANT, PUMPS, RESERVOIR_H, RESERVOIRS, SOURCE_ZONE } from "./layout";
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
  const vec3 KEY_COL = ${v3("#d2def0", 1.08)};
  const vec3 SKY = ${v3("#6a88b0", 0.88)};
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
      const vec2 RES = vec2(${f((RESERVOIRS[0].c[0] + RESERVOIRS[3].c[0]) / 2)}, ${f((RESERVOIRS[0].c[1] + RESERVOIRS[3].c[1]) / 2)});
      const vec4 R_PARK = ${v4rect(PARK)};
      const vec4 R_GER[${GER_AREAS.length}] = vec4[${GER_AREAS.length}](${GER_AREAS.map(v4rect).join(", ")});
      const vec3 C_DIRT = ${v3("#4b4537")};
      const vec3 C_LANE = ${v3("#5c5647")};
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
        float farm = max(smoothstep(4.9, 5.4, q.y), max(smoothstep(9.3, 9.9, q.x), smoothstep(-9.3, -9.9, q.x))) * step(-2.0, q.y);
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
        float pads = min(min(length(q - P1) - 0.3, length(q - P2) - 0.3), rectD(q, vec4(RES - vec2(0.42, 0.42), RES + vec2(0.42, 0.42))));
        col = mix(col, C_GRAVEL * (0.9 + 0.12 * n3), 1.0 - smoothstep(0.0, 0.05, pads));
        col = mix(col, C_CONC * (0.9 + 0.1 * n3), 1.0 - smoothstep(0.0, 0.03, rectD(q, R_PLANT)));
        // "Миний Монгол" цэцэрлэгт хүрээлэн: арчилгаатай зүлэг
        col = mix(col, C_LAWN * (0.88 + 0.16 * n2), (1.0 - smoothstep(0.0, 0.05, rectD(q, R_PARK))) * 0.9);
        // гэр хороолол: хуурай шороо (хашааны мөр нь instanced хайсаар)
        float dGer = 1e3;
        for (int k = 0; k < ${GER_AREAS.length}; k++) dGer = min(dGer, rectD(q, R_GER[k]));
        if (dGer < 0.06) col = mix(col, mix(C_DIRT, C_LANE, n2) * (0.85 + 0.25 * n3), (1.0 - smoothstep(0.0, 0.06, dGer)) * 0.85);
        // өвс, хөрсний нарийн бүтэц (ойроос харахад тэгш биш)
        if (uDetail > 0.5) col *= 0.9 + 0.2 * vnoise(q * 64.0 + 1.3) * vnoise(q * 17.0 + 4.1);
        vec3 lit = shade(col, n) * 0.82;
        // шөнийн хотын гэрлийн тусгал: хорооллын эргэн тойронд газар дулаан, натрийн шаргал туяатай
        float dCity = min(min(dOld, dNew), dInd);
        lit += ${v3("#ff9a4a")} * 0.03 * (1.0 - smoothstep(-0.2, 1.4, dCity)) * (0.7 + 0.3 * n2);
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
      // шөнийн гол (фото мэт): бараан, гүн ус — өнгө нь голдуу тусгалаас (тэнгэр, сар, хотын гэрэл)
      const vec3 W_DEEP = ${v3("#061827")};
      const vec3 W_SHALLOW = ${v3("#0d2a40")};
      const vec3 SKY_ZENITH = ${v3("#0c2238")};
      const vec3 SKY_HORIZON = ${v3("#2a5274")};
      const vec3 MOON = ${v3("#e6eeff")};
      const vec3 W_HI = ${v3("#8fdcff")};
      const mat2 ROT = mat2(0.8, 0.6, -0.6, 0.8);
      float fbm2(vec2 p) { float a = vnoise(p); p = ROT * p * 2.03 + 5.1; a += vnoise(p) * 0.5; p = ROT * p * 2.01 + 2.7; return a + vnoise(p) * 0.25; }
      void main() {
        float s = vUv.x;
        float across = abs(vUv.y - 0.5) * ${f(RIVER_RIBBON_HALF * 2)};
        float flow = uPhase * 0.22 + uTime * 0.07;
        // урсгалын дагуу сунасан долгион (хоёр давхар) → гадаргуугийн хэвийн вектор
        vec2 p1 = vec2(s * 3.2 - flow * 3.0, vUv.y * 7.0);
        vec2 p2 = vec2(s * 11.0 - flow * 6.5, vUv.y * 22.0 + 3.0);
        float e = 0.09;
        float h0 = fbm2(p1) + (uDetail > 0.5 ? 0.45 * vnoise(p2) : 0.0);
        float hx = fbm2(p1 + vec2(e, 0.0)) + (uDetail > 0.5 ? 0.45 * vnoise(p2 + vec2(e * 3.4, 0.0)) : 0.0);
        float hz = fbm2(p1 + vec2(0.0, e)) + (uDetail > 0.5 ? 0.45 * vnoise(p2 + vec2(0.0, e * 3.1)) : 0.0);
        vec3 nw = normalize(vec3((h0 - hx) * 0.16, 1.0, (h0 - hz) * 0.16));
        vec3 v = normalize(cameraPosition - vW);
        vec3 r = reflect(-v, nw);
        // Fresnel (Schlick, ус ≈ 0.02): налуу харахад тэнгэрийн тусгал давамгайлна
        float fres = 0.02 + 0.98 * pow(1.0 - clamp(dot(nw, v), 0.0, 1.0), 5.0);
        vec3 body = mix(W_DEEP, W_SHALLOW, smoothstep(0.12, 0.27, across) * 0.7);
        vec3 sky = mix(SKY_HORIZON, SKY_ZENITH, smoothstep(0.35, 0.98, r.y));
        vec3 col = mix(body, sky, clamp(fres * 1.3 + 0.18, 0.0, 1.0));
        float lane = vnoise(vec2(s * 0.8 - flow * 1.4, vUv.y * 34.0)) * vnoise(vec2(s * 2.3 - flow * 2.2, vUv.y * 13.0 + 7.0));
        col += SKY_HORIZON * 0.22 * smoothstep(0.32, 0.75, lane);
        // сарны гялтганасан мөр: долгионы налуу дээр хурц, сийрэг тусгал (HDR → туяарна)
        float moon = pow(max(dot(r, ${dirGlsl(0.12, 0.42, -0.9)}), 0.0), 220.0);
        col += MOON * moon * 2.4;
        // жижиг гялтгануур: зөвхөн нарийн долгионы оройд (том толбо биш)
        float spark = smoothstep(0.9, 0.99, vnoise(p2 * 2.3 - flow * 3.0) * 0.7 + vnoise(p2 * 5.1 + 9.0) * 0.3);
        col += MOON * spark * pow(max(dot(r, ${dirGlsl(0.12, 0.42, -0.9)}), 0.0), 40.0) * 0.9;
        // эргийн нойтон бараан зурвас
        col *= mix(1.0, 0.7, smoothstep(0.235, 0.27, across));
        // эх үүсвэрийн алхамд (1-р) бүдэг cyan гялбаа хадгална
        col += W_HI * smoothstep(0.85, 0.98, vnoise(p2 * 1.9 - flow * 2.0)) * 0.08 * uEmph[0];
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
      const vec3 C_VERGE = ${v3("#30483a")};
      const vec3 C_BIKE = ${v3("#1f9a5e")};
      const vec3 C_CURB = ${v3("#8a939b")};
      // хоёр урсгалтай зам: тусгаарлагч | зорчих хэсэг | модтой зурвас | дугуйн зам (төвөөс)
      const float HW_MED = ${f(HIGHWAY.median)};
      const float HW_CAR = ${f(HIGHWAY.carriage)};
      const float HW_STRIP = ${f(HIGHWAY.strip)};
      // шугамын пикселийн хамрах хувь (box filter): алсад пикселээс нарийн шугам бүдгэрнэ (тод зураас болж томрохгүй)
      float line(float x, float c, float w) {
        float fw = max(fwidth(x), 1e-6);
        float lo = max(x - fw * 0.5, c - w * 0.5);
        float hi = min(x + fw * 0.5, c + w * 0.5);
        return clamp((hi - lo) / fw, 0.0, 1.0);
      }
      void main() {
        vec3 col = C_ASPH * (0.86 + 0.12 * vnoise(vW.xz * 36.0) + 0.06 * (hash21(floor(vW.xz * 420.0)) - 0.5));
        if (vKind < 0.5) {
          float along = vRoad.x;
          float hw = vRoad.z * 0.5;
          float x = vRoad.y * hw;
          float type = vRoad.w;
          vec3 mark = C_MARK * (0.68 + 0.12 * vnoise(vW.xz * 90.0));
          float zebra = (1.0 - step(0.045, min(vEnds.x, vEnds.y))) * step(abs(x), hw - 0.014);
          zebra *= step(0.5, fract(x * 46.0)) * step(0.008, min(vEnds.x, vEnds.y));
          if (type > 2.5) {
            // тойрог: ирмэгийн шугам, эгнээ хуваах тасархай
            col *= 1.0 - 0.06 * line(abs(x), hw * 0.5, hw * 0.35);
            float m = line(abs(x), hw - 0.008, 0.003);
            m = max(m, line(x, 0.0, 0.0022) * step(fract(along * 9.0), 0.5));
            col = mix(col, mark, m * 0.85);
          } else if (type > 1.5) {
            float ax = abs(x);
            float grass = 0.82 + 0.3 * vnoise(vW.xz * 48.0) * vnoise(vW.xz * 13.0 + 2.0);
            if (ax < HW_MED || (ax > HW_CAR && ax < HW_STRIP)) {
              // модтой тусгаарлагч, зурвас — зүлэг, хашлагын цайвар ирмэг
              col = C_VERGE * grass;
              col = mix(col, C_CURB, max(line(ax, HW_MED - 0.002, 0.003), max(line(ax, HW_CAR + 0.002, 0.003), line(ax, HW_STRIP - 0.002, 0.003))));
            } else if (ax >= HW_STRIP) {
              // дугуйн зам: ногоон хучилт, цагаан ирмэг
              col = C_BIKE * (0.85 + 0.15 * vnoise(vW.xz * 60.0));
              col = mix(col, mark, max(line(ax, HW_STRIP + 0.003, 0.0018), line(ax, hw - 0.003, 0.0018)) * 0.8);
            } else {
              // зорчих хэсэг: 2 эгнээ (тасархай), ирмэгийн тасралтгүй шугам, дугуйн мөр
              float lane = (HW_MED + HW_CAR) * 0.5;
              col *= 1.0 - 0.06 * line(abs(ax - lane), (HW_CAR - HW_MED) * 0.25, (HW_CAR - HW_MED) * 0.18);
              float m = max(line(ax, HW_MED + 0.005, 0.0025), line(ax, HW_CAR - 0.005, 0.0025));
              m = max(m, line(ax, lane, 0.002) * step(fract(along * 9.0), 0.55));
              m = max(m, zebra);
              col = mix(col, mark, m * 0.85);
            }
          } else {
            // дугуйн мөр (бага зэрэг бараан зурвас)
            col *= 1.0 - 0.06 * (line(abs(x), hw * 0.5, hw * 0.35));
            float m = line(abs(x), hw - 0.009, 0.003);
            if (type > 0.5) {
              m = max(m, line(abs(x), 0.004, 0.0022));
              m = max(m, line(abs(x), hw * 0.5, 0.002) * step(fract(along * 9.0), 0.55));
            } else {
              m = max(m, line(x, 0.0, 0.0022) * step(fract(along * 9.0), 0.5));
            }
            // уулзварын өмнөх явган хүний гарц
            m = max(m, zebra);
            col = mix(col, mark, m * 0.85);
          }
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
      attribute float aShop;
      varying vec3 vW;
      varying vec3 vN;
      varying vec3 vL;
      varying vec3 vLN;
      varying vec3 vSize;
      varying float vSeed;
      varying float vKind;
      varying float vDist;
      varying float vShop;
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
        vShop = aShop;
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
      varying float vShop;
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
        if (kind > 3.5) {
          // дээврийн төхөөрөмж (лифтний өрөө, агааржуулалт): энгийн саарал, дээд тал цайвар
          col = mix(${v3("#5d666f")}, ${v3("#707a83")}, vSeed) * (vLN.y > 0.5 ? 1.12 : 1.0);
          col = shade(col, n) * emph;
        } else if (vLN.y > 0.5) {
          // дээвэр: битум/хайрган хучилт (өнгөний хувилбар), хашлагын ирмэг, ус зайлуулах заадас
          vec2 p = vL.xz * vSize.xz;
          vec2 e = vSize.xz * 0.5 - abs(p);
          float edge = 1.0 - smoothstep(0.004, 0.008, min(e.x, e.y));
          vec3 roof = mix(mix(C_ROOF, ${v3("#454c53")}, step(0.45, vSeed)), ${v3("#3b4752")}, step(0.8, vSeed));
          col = roof * (0.88 + 0.1 * vnoise(p * 40.0 + vSeed * 9.0) + 0.06 * hash21(floor(p * 260.0)));
          col *= 0.94 + 0.06 * step(0.04, abs(fract(p.x * 9.0 + vSeed) - 0.5));
          col = mix(col, ${v3("#59626a")}, edge * 0.85);
          col = shade(col, n) * emph;
          col += ${v3("#8fb0c8", 0.08)} * edge;
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
          // тагт: урт фасадын зарим баганад давхар бүрийн доод хэсэгт цайвар хашлага (доод давхраас бусад)
          float balcony = 0.0;
          if (kind < 1.5 && len > 0.2 && id.y > 0.5) {
            balcony = step(hash21(vec2(id.x * 1.7 + face, vSeed * 13.0)), 0.36) * step(0.04, fr.y) * step(fr.y, 0.24) * step(0.12, fr.x) * step(fr.x, 0.88);
            balcony *= step(y, vSize.y - 0.012);
          }
          float h = hash21(id + vec2(vSeed * 37.0, face * 11.0));
          // ус хүрсэн дарааллаар асах долгион (6-р алхам), түүнээс өмнө бүрэнхийн сийрэг гэрэл
          float wave = smoothstep(vDist - 0.5, vDist, uWindows);
          float frac = mix(0.2, 0.82, wave) * (kind > 1.5 && kind < 2.5 ? 0.7 : 1.0);
          float on = step(h, frac);
          vec3 warm = mix(C_WARM, C_WARM2, hash21(id * 0.7 + vSeed)) * (0.75 + 0.35 * hash21(id + 3.1));
          vec3 glass = C_GLASS + ${v3("#1e3550")} * (0.3 + 0.7 * fr.y) * 0.5;
          col = shade(col, n) * emph;
          col = mix(col, mix(glass, warm * mix(0.75, 1.15, wave), on), win);
          col = mix(col, shade(${v3("#c4c9cd")}, n) * emph, balcony * 0.85);
          // орц: доод давхарт хааяа хаалга + дээрх дулаан гэрэл
          if (kind < 1.5 && id.y < 0.5 && len > 0.2) {
            float door = step(hash21(vec2(id.x * 3.1 + face * 7.0, vSeed * 5.0)), 0.09) * step(0.25, fr.x) * step(fr.x, 0.75) * step(y, 0.016);
            col = mix(col, ${v3("#20272e")}, door);
            glow += C_WARM * door * 0.18 + C_WARM * step(hash21(vec2(id.x * 3.1 + face * 7.0, vSeed * 5.0)), 0.09) * (1.0 - smoothstep(0.0, 0.003, abs(y - 0.019))) * step(0.3, fr.x) * step(fr.x, 0.7) * 0.9;
          }
          // өргөн чөлөөний дагуух дэлгүүр: доод давхрын өргөн шилэн нүүр + гэрэлт хаяг
          if (vShop > 0.5 && y < FLOOR_H) {
            float shopWin = step(0.06, fr.x) * step(fr.x, 0.94) * step(0.003, y) * step(y, 0.017) * step(0.012, len * 0.5 - abs(u));
            vec3 shopCol = mix(${v3("#ffd9a0")}, ${v3("#fff1d6")}, hash21(id + 9.0)) * 0.95;
            col = mix(col, shopCol, shopWin);
            float sign = step(0.0185, y) * step(y, 0.0215) * step(0.1, fr.x) * step(fr.x, 0.9) * step(0.5, hash21(vec2(id.x, vSeed)));
            vec3 signCol = mix(mix(${v3("#7fe0ff")}, ${v3("#ffffff")}, step(0.5, hash21(id + 4.0))), ${v3("#ffb36b")}, step(0.8, hash21(id + 2.0)));
            col = mix(col, signCol * 0.9, sign);
          }
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
      varying float vH;
      varying vec3 vRad;
      void main() {
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vH = position.y;
        // титмийн төвөөс гарах чиглэл: талсуудын хурц ирмэгийг зөөлрүүлж бөөрөнхий навч мэт гэрэлтүүлнэ
        vRad = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * vec3(position.x, (position.y - 0.06) * 0.6, position.z));
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
      varying float vH;
      varying vec3 vRad;
      ${NOISE}
      ${COMMON}
      void main() {
        vec3 n = normalize(mix(normalize(vN), normalize(vRad), vPart > 0.5 ? 0.7 : 0.0));
        // шөнийн навч: бараан, өнгө нь мод бүрт өөр (заримд нь намрын шаргал)
        vec3 crown = mix(mix(${v3("#22402d")}, ${v3("#2c4b35")}, step(0.45, vTint)), ${v3("#44502f")}, step(0.85, vTint));
        // навчны бөөгнөрөл: хоёр хэмжээст noise → гэрэлтэй/сүүдэртэй толбо
        float leaf = vnoise(vW.xz * 110.0 + vW.y * 90.0) * 0.55 + vnoise(vW.xz * 38.0 + vW.y * 29.0 + 3.0) * 0.45;
        vec3 col = crown * (0.55 + 0.8 * leaf);
        // титмийн доод хэсэг өөрийнхөө сүүдэрт
        col *= mix(0.55, 1.08, smoothstep(0.03, 0.1, vH));
        if (vPart < 0.5) col = ${v3("#2e241d")};
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
        if (vKind > 0.5 && vKind < 1.5) glow = on * (0.14 + 0.85 * pow(facing, 3.0)) + hi * (st.y * 0.35 + st.z * 0.6) * pow(facing, 1.5);
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
        else if (m == 9) alb *= 0.78 + 0.34 * vnoise(vW.xz * 40.0) * vnoise(vW.xz * 11.0 + 3.0);
        else if (m == 10) sp = 0.5;
        vec3 col = shade(alb, n);
        col += ${v3("#dce8f2")} * sp * pow(max(dot(n, normalize(KEY_DIR + v)), 0.0), 30.0);
        // хөшөө: доороос гэрэлтүүлсэн (шөнө) — алт гялалзана, цагаан/цөцгий чулуу дулаан туяатай
        if (m == 8) {
          float h = pow(max(dot(n, normalize(${dirGlsl(0.2, 0.9, 0.6)} + v)), 0.0), 18.0);
          col = shade(alb, n) * 0.75 + ${v3("#ffe7a8")} * h * 0.45 + alb * 0.1;
        } else if (m == 11) {
          col += alb * ${v3("#ffe2b8")} * 0.1 * (1.0 - smoothstep(0.0, 0.45, vW.y));
        }
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
      attribute vec3 aRef;
      uniform float uReservoir;
      varying vec3 vW;
      varying float vKind;
      varying vec3 vRef;
      void main() {
        vec3 p = position;
        // усан сан: бага түвшнээс (нөөц) 3-р алхамд дүүрнэ
        if (aKind < 0.5) p.y = 0.018 + (0.25 + 0.75 * uReservoir) * ${f(RESERVOIR_H - 0.045)};
        vec4 w = modelMatrix * vec4(p, 1.0);
        vW = w.xyz;
        vKind = aKind;
        vRef = aRef;
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
      varying vec3 vRef;
      ${NOISE}
      ${COMMON}
      void main() {
        float t = uPhase * 0.4 + uTime * 0.12;
        vec3 col;
        if (vKind < 0.5) {
          // сан бүрийн төвөөс цагираг долгио (aRef: төв x, z, радиус)
          vec2 d = vW.xz - vRef.xy;
          float r = min(length(d) / vRef.z, 1.0);
          float rings = 0.5 + 0.5 * sin(r * 22.0 - t * 6.0);
          col = mix(${v3("#0c3a63")}, ${v3("#1b77b3")}, 0.35 + 0.35 * vnoise(vW.xz * 14.0 + t));
          col += ${v3("#8fe0ff")} * rings * 0.12 * (1.0 - r) + ${v3("#38b6f0")} * 0.18 * uReservoir;
        } else if (vKind > 2.5) {
          // усан толь (Морин хуур цогцолбор): тэнгэр, гэрлийн тусгалтай нам гүм ус
          float n = vnoise(vW.xz * 30.0 + vec2(t * 0.3, 0.0));
          col = mix(${v3("#0a2236")}, ${v3("#24527a")}, 0.35 + 0.35 * n) + ${v3("#ffe2b8")} * smoothstep(0.75, 0.95, vnoise(vW.xz * 90.0 - t)) * 0.18;
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

// ---------------------------------------------------------------------------------------------
// Хуурамч сүүдэр (instanced quad): дүрсийг гэрлийн эсрэг чиглэлд шилжүүлж (6 дээж) зөөлөн ирмэгтэй харанхуйлна

export function shadowMaterial(U: CityUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: { uFogStart: U.uFogStart, uFogDensity: U.uFogDensity },
    vertexShader: /* glsl */ `
      attribute vec4 aShape;
      attribute vec4 aParam;
      attribute float aK;
      varying vec2 vP;
      varying vec3 vW;
      varying vec4 vShape;
      varying vec4 vParam;
      varying float vK;
      void main() {
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vP = w.xz;
        vW = w.xyz;
        vShape = aShape;
        vParam = aParam;
        vK = aK;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uFogStart;
      uniform float uFogDensity;
      varying vec2 vP;
      varying vec3 vW;
      varying vec4 vShape;
      varying vec4 vParam;
      varying float vK;
      float sdBox(vec2 p, vec2 b) {
        vec2 d = abs(p) - b;
        return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
      }
      float shapeD(vec2 p) {
        if (vParam.x < 0.5) {
          vec2 q = p - vShape.xy;
          float c = cos(vParam.y);
          float s = sin(vParam.y);
          return sdBox(vec2(c * q.x - s * q.y, s * q.x + c * q.y), vShape.zw);
        }
        if (vParam.x < 1.5) return length(p - vShape.xy) - vShape.z;
        vec2 pa = p - vShape.xy;
        vec2 ba = vShape.zw - vShape.xy;
        float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
        return length(pa - ba * h) - vParam.y;
      }
      void main() {
        vec2 sw = vParam.zw;
        float a;
        if (vParam.x > 1.5) {
          // хөвөгч хоолой: зөвхөн шилжсэн нарийн сүүдэр
          float d = shapeD(vP - sw);
          a = (1.0 - smoothstep(-0.003, 0.012, d)) * 0.3;
        } else {
          float d = 1e3;
          for (int i = 0; i < 6; i++) d = min(d, shapeD(vP - sw * (float(i) / 5.0)));
          float shade = 1.0 - smoothstep(-0.004, 0.018 + length(sw) * 0.12, d);
          float ao = 1.0 - smoothstep(0.0, 0.035, shapeD(vP));
          a = max(shade * 0.38, ao * 0.32);
        }
        a *= vK;
        float dist = length(vW - cameraPosition);
        a *= 1.0 - clamp(1.0 - exp(-pow(max(dist - uFogStart, 0.0) * uFogDensity, 2.0)), 0.0, 1.0);
        gl_FragColor = vec4(0.0, 0.008, 0.02, a);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}

/**
 * Жижиг instanced биет: машин (их бие + бүхээг; явж буй машинд урд цагаан, хойд улаан гэрэл) ба хоолойн бетон тулгуур.
 * aType: 0 тулгуур, 1 зогсоолын машин, 2 явж буй машин. Статик байрлал — цаг ашиглахгүй.
 */
export function propMaterial(U: CityUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: { uFogColor: U.uFogColor, uFogStart: U.uFogStart, uFogDensity: U.uFogDensity, uEmph: U.uEmph },
    vertexShader: /* glsl */ `
      attribute float aType;
      attribute float aTint;
      varying vec3 vW;
      varying vec3 vN;
      varying vec3 vL;
      varying vec3 vLN;
      varying float vType;
      varying float vTint;
      void main() {
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        vL = position;
        vLN = normal;
        vType = aType;
        vTint = aTint;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uEmph[${ZONES}];
      varying vec3 vW;
      varying vec3 vN;
      varying vec3 vL;
      varying vec3 vLN;
      varying float vType;
      varying float vTint;
      ${COMMON}
      vec3 carColor(float t) {
        if (t < 0.24) return ${v3("#d6dade")};
        if (t < 0.42) return ${v3("#9aa3ab")};
        if (t < 0.6) return ${v3("#23272c")};
        if (t < 0.7) return ${v3("#8a2f33")};
        if (t < 0.82) return ${v3("#2f4f7a")};
        if (t < 0.92) return ${v3("#b3a487")};
        return ${v3("#3d5a49")};
      }
      void main() {
        vec3 n = normalize(vN);
        vec3 col;
        if (vType < 0.5) {
          col = shade(${v3("#7d868f")}, n);
        } else {
          col = carColor(vTint);
          // бүхээгийн шил
          float cabin = step(0.6, vL.y);
          if (cabin > 0.5 && vLN.y < 0.5) col = mix(${v3("#14202c")}, ${v3("#3a5874")}, 0.35);
          col = shade(col, n) + ${v3("#dce8f2")} * 0.12 * pow(max(dot(n, normalize(KEY_DIR + normalize(cameraPosition - vW))), 0.0), 24.0);
          if (vType > 1.5 && vL.y < 0.55) {
            col = mix(col, ${v3("#fff4dc")} * 1.25, step(0.5, vLN.x) * step(0.2, vL.y));
            col = mix(col, ${v3("#ff3a3a")} * 0.9, step(vLN.x, -0.5) * step(0.25, vL.y));
          }
          col *= mix(0.65, 1.0, uEmph[3]);
        }
        gl_FragColor = vec4(applyFog(col, vW), 1.0);
        ${COLORSPACE}
      }
    `,
  });
}

/**
 * Гэр хороолол (instanced): гэр, байшин, хашаа. aPart — 0 хана (aWall), 1 дээвэр (aRoof), 2 тооно, 3 хаалга/цонх
 * (шөнө дулаан гэрэлтэнэ — aLitW). Хотын онцлох бүсээр (uEmph[3]) бүдгэрнэ.
 */
export function gerMaterial(U: CityUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: { uFogColor: U.uFogColor, uFogStart: U.uFogStart, uFogDensity: U.uFogDensity, uEmph: U.uEmph },
    vertexShader: /* glsl */ `
      attribute float aPart;
      attribute vec3 aWall;
      attribute vec3 aRoof;
      attribute float aLitW;
      varying vec3 vW;
      varying vec3 vN;
      varying vec3 vWall;
      varying vec3 vRoof;
      varying float vPart;
      varying float vLit;
      void main() {
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        vWall = aWall;
        vRoof = aRoof;
        vPart = aPart;
        vLit = aLitW;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uEmph[${ZONES}];
      varying vec3 vW;
      varying vec3 vN;
      varying vec3 vWall;
      varying vec3 vRoof;
      varying float vPart;
      varying float vLit;
      ${COMMON}
      void main() {
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        int p = int(vPart + 0.5);
        vec3 col;
        if (p == 3) {
          col = mix(${v3("#1a222b")}, ${v3("#ffc87a")} * 1.1, vLit);
        } else {
          vec3 alb = p == 0 ? vWall : p == 1 ? vRoof : ${v3("#3a3530")};
          col = shade(alb, n);
        }
        col *= mix(0.6, 1.0, uEmph[3]);
        gl_FragColor = vec4(applyFog(col, vW), 1.0);
        ${COLORSPACE}
      }
    `,
    side: THREE.DoubleSide,
  });
}
