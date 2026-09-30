import * as THREE from "three";
import { NOISE } from "../journey/materials/glsl";
import {
  CHAMBER,
  COL,
  COL_LEVEL,
  DROP,
  ELEMENTS,
  FACE_Z,
  GROUPS,
  HOUSE_Z,
  HOUSES,
  HPIPE,
  JOINT,
  JUNCTION_Y,
  LAMPS,
  LAYERS,
  LITS,
  MAIN,
  MAIN_DEPTH0,
  MAIN_STEP,
  MH,
  MH_BOTTOM,
  SLAB,
  STREET,
} from "./layout";

/**
 * Огтлолын shader-үүд. Бүгд ShaderMaterial (гэрэл, хээ нь procedural, текстургүй), tone mapping-гүй
 * (сайтын өнгөтэй шууд тааруулсан). Хуваалцсан uniform (uDim, uPhase, uReveal, uFlow …) нэг объект —
 * кадр бүр нэг удаа бичихэд бүх материал шинэчлэгдэнэ.
 */
const f = (n: number) => n.toFixed(4);
const v3 = (hex: string, k = 1) => {
  const c = new THREE.Color(hex);
  return `vec3(${f(c.r * k)}, ${f(c.g * k)}, ${f(c.b * k)})`;
};
const arr = (xs: readonly number[]) => `float[${xs.length}](${xs.map(f).join(", ")})`;
const dirGlsl = (x: number, y: number, z: number) => {
  const v = new THREE.Vector3(x, y, z).normalize();
  return `vec3(${f(v.x)}, ${f(v.y)}, ${f(v.z)})`;
};

export type SewerUniforms = ReturnType<typeof createSewerUniforms>;

export function createSewerUniforms() {
  return {
    uDim: { value: 1 },
    uPhase: { value: 0 },
    uShimmer: { value: 0 },
    uBreath: { value: 0 },
    uDetail: { value: 1 },
    uActive: { value: 0 },
    uSurface: { value: 0 },
    uMarks: { value: 0 },
    uGrow: { value: new Array<number>(GROUPS).fill(0) },
    uLit: { value: new Array<number>(LITS).fill(0) },
    uReveal: { value: new Array<number>(ELEMENTS).fill(0) },
    uFlow: { value: new Array<number>(ELEMENTS).fill(0) },
  };
}

// ---------------------------------------------------------------------------------------------
// Хуваалцсан GLSL

const LAYOUT = /* glsl */ `
  const float FZ = ${f(FACE_Z)};
  const float X0 = ${f(SLAB.x0)};
  const float X1 = ${f(SLAB.x1)};
  const float Y0 = ${f(SLAB.y0)};
  const float L_BASE = ${f(LAYERS.base)};
  const float L_FILL = ${f(LAYERS.fill)};
  const float L_SOIL = ${f(LAYERS.soil)};
  const float L_CLAY = ${f(LAYERS.clay)};
  const float MY = ${f(MAIN.y)};
  const float MRI = ${f(MAIN.rIn)};
  const float MRO = ${f(MAIN.rOut)};
  const float MX0 = ${f(MAIN.x0)};
  const float MX1 = ${f(MAIN.x1)};
  const float CY = ${f(COL.y)};
  const float CRI = ${f(COL.rIn)};
  const float CRO = ${f(COL.rOut)};
  const float CX0 = ${f(COL.x0)};
  const float CX1 = ${f(COL.x1)};
  const float CLEVEL = ${f(COL_LEVEL)};
  const float MHX = ${f(MH.x)};
  const float MHRI = ${f(MH.rIn)};
  const float MHT = ${f(MH.wall)};
  const float MH_NECK = ${f(MH.neckR)};
  const float MH_CONE_Y = ${f(MH.coneY)};
  const float MH_NECK_Y = ${f(MH.neckY)};
  const float MH_BOT = ${f(MH_BOTTOM)};
  const float CH_HALF = ${f(CHAMBER.half)};
  const float CH_WALL = ${f(CHAMBER.wall)};
  const float CH_FLOOR = ${f(CHAMBER.floor)};
  const float LAT_Y = ${f(CHAMBER.lateralY)};
  const float LAT_R = ${f(CHAMBER.lateralR)};
  const float HPRI = ${f(HPIPE.rIn)};
  const float HPRO = ${f(HPIPE.rOut)};
  const float JY = ${f(JUNCTION_Y)};
  const float JOINT = ${f(JOINT)};
  const float DROP_X1 = ${f(DROP.x0 + DROP.dx)};
  const float HX[3] = ${arr(HOUSES.map((h) => h.x))};

  float mainLevel(float x) {
    float d = ${f(MAIN_DEPTH0)};
    for (int i = 0; i < 3; i++) d += ${f(MAIN_STEP)} * smoothstep(HX[i] - 0.05, HX[i] + 0.25, x);
    return MY - MRI + d;
  }
  float mhInner(float y) {
    if (y < MH_CONE_Y) return MHRI;
    if (y < MH_NECK_Y) return mix(MHRI, MH_NECK, (y - MH_CONE_Y) / (MH_NECK_Y - MH_CONE_Y));
    return MH_NECK;
  }
`;

/** Бохир ус: бараан ногоон-цэнхэр (teal), урсгалын чиглэлд (s) гүйх зурвас. Цэвэр усны цэнхэр биш. */
const WASTE = /* glsl */ `
  const vec3 W_DEEP = ${v3("#08302f")};
  const vec3 W_MID = ${v3("#155a4f")};
  const vec3 W_HI = ${v3("#5fe3b8")};
  const vec3 C_FOAM = ${v3("#a9e8cf")};
  vec3 wasteColor(float s, float t) {
    float n1 = vnoise(vec2(s * 3.2 - uPhase * 1.2, t * 34.0));
    float n2 = uDetail > 0.5 ? vnoise(vec2(s * 9.0 - uPhase * 2.2 + uShimmer * 0.3, t * 60.0 + 5.0)) : n1;
    float streak = smoothstep(0.6, 0.95, n1 * 0.55 + n2 * 0.45);
    vec3 col = mix(W_DEEP, W_MID, 0.4 + 0.35 * n1);
    return col + W_HI * streak * 0.24;
  }
`;

/** Сэрүүн шөнийн гэрэл: тэнгэр/газар (hemisphere) + дээд-зүүн-урдаас key + арын цэнхэр rim */
const LIGHT = /* glsl */ `
  const vec3 KEY_DIR = ${dirGlsl(-0.45, 0.8, 0.55)};
  const vec3 KEY_COL = ${v3("#c8d6e8", 0.95)};
  const vec3 SKY = ${v3("#5f7896", 0.9)};
  const vec3 GROUND = ${v3("#1a2330", 0.8)};
  const vec3 RIM_DIR = ${dirGlsl(0.6, 0.35, -0.7)};
  const vec3 RIM_COL = ${v3("#3f8fb8", 0.5)};
  vec3 shade(vec3 alb, vec3 n, vec3 v) {
    float k = max(dot(n, KEY_DIR), 0.0);
    vec3 amb = mix(GROUND, SKY, 0.5 + 0.5 * n.y);
    float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0) * (0.5 + 0.5 * dot(n, RIM_DIR));
    return alb * (amb + KEY_COL * k) + RIM_COL * max(rim, 0.0);
  }
  float spec(vec3 n, vec3 v, float pw) {
    return pow(max(dot(n, normalize(KEY_DIR + v)), 0.0), pw);
  }
`;

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

const COLORSPACE = /* glsl */ `#include <colorspace_fragment>`;

// ---------------------------------------------------------------------------------------------

/**
 * Хөрсний блок. Урд тал (z = FACE_Z) — огтлол: давхарга, хайрга, чулуу; нээгдсэн хоолой/худгийн хана
 * (бетон, муфт), дотор нь нүх (discard → ард байгаа interior харагдана), бохир усны огтлол.
 * Баруун тал — давхарга + коллекторын төгсгөл. DoubleSide: нүхээр харахад блокийн дотор тал бараан хөрс.
 */
export function earthMaterial(U: SewerUniforms) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uDim: U.uDim,
      uPhase: U.uPhase,
      uShimmer: U.uShimmer,
      uDetail: U.uDetail,
      uActive: U.uActive,
      uReveal: U.uReveal,
      uFlow: U.uFlow,
    },
    vertexShader: WORLD_VERTEX,
    fragmentShader: /* glsl */ `
      uniform float uDim;
      uniform float uPhase;
      uniform float uShimmer;
      uniform float uDetail;
      uniform float uActive;
      uniform float uReveal[${ELEMENTS}];
      uniform float uFlow[${ELEMENTS}];
      varying vec3 vW;
      varying vec3 vN;
      ${NOISE}
      ${LAYOUT}
      ${WASTE}

      const vec3 C_ASPH = ${v3("#23292f")};
      const vec3 C_BASE = ${v3("#57585a")};
      const vec3 C_FILL = ${v3("#62584a")};
      const vec3 C_SOIL = ${v3("#4a3d31")};
      const vec3 C_CLAY = ${v3("#3a3430")};
      const vec3 C_DEEP = ${v3("#2a2c33")};
      const vec3 C_BED = ${v3("#6a6962")};
      const vec3 C_CONC = ${v3("#69727a")};
      const vec3 C_PIPE_M = ${v3("#5c6670")};
      const vec3 C_PIPE_C = ${v3("#4f5861")};
      const vec3 C_PIPE_H = ${v3("#6d7782")};
      const vec3 C_IRON = ${v3("#2a3036")};
      const vec3 C_EDGE = ${v3("#5fe3b8", 0.9)};

      float pebbles(vec2 p, float scale, float density, out float tone) {
        vec2 q = p * scale;
        vec2 id = floor(q);
        vec2 fq = fract(q) - 0.5;
        float h = hash21(id);
        vec2 o = vec2(hash21(id + 1.7), hash21(id + 4.3)) - 0.5;
        float r = 0.2 + 0.2 * hash21(id + 9.1);
        tone = hash21(id + 2.9);
        float d = length((fq - o * 0.4) * vec2(1.0, 1.4));
        return step(1.0 - density, h) * (1.0 - smoothstep(r - 0.07, r, d));
      }

      vec3 layers(float hx, float y) {
        vec2 p = vec2(hx, y);
        float yy = y + (vnoise(vec2(hx * 2.2, 3.0)) - 0.5) * 0.045;
        float grain = hash21(floor(p * 170.0));
        float tone;
        vec3 c;
        if (yy > L_BASE) {
          c = C_ASPH * (0.85 + 0.22 * grain);
        } else if (yy > L_FILL) {
          c = C_BASE * (0.78 + 0.28 * grain);
          float pb = pebbles(p, 42.0, 0.75, tone);
          c = mix(c, C_BASE * (0.7 + 0.7 * tone), pb);
        } else if (yy > L_SOIL) {
          c = C_FILL * (0.86 + 0.18 * grain) * (0.92 + 0.12 * vnoise(p * 9.0));
          float pb = pebbles(p, 30.0, 0.16, tone);
          c = mix(c, C_BASE * (0.8 + 0.5 * tone), pb * 0.8);
        } else if (yy > L_CLAY) {
          c = C_SOIL * (0.8 + 0.3 * vnoise(p * 5.0)) * (0.9 + 0.14 * grain);
          float pb = pebbles(p, 12.0, 0.1, tone);
          c = mix(c, ${v3("#5b5650")} * (0.7 + 0.5 * tone), pb);
        } else {
          float k = smoothstep(L_CLAY, Y0, yy);
          c = mix(C_CLAY, C_DEEP, k) * (0.9 + 0.1 * grain);
          c *= 0.92 + 0.08 * sin(yy * 70.0 + vnoise(p * 3.0) * 4.0);
          float pb = pebbles(p, 9.0, 0.08, tone);
          c = mix(c, ${v3("#4b4a4c")} * (0.7 + 0.5 * tone), pb);
        }
        float b = min(min(abs(yy - L_BASE), abs(yy - L_FILL)), min(abs(yy - L_SOIL), abs(yy - L_CLAY)));
        return c * (0.8 + 0.2 * smoothstep(0.0, 0.012, b));
      }

      vec3 bedding(vec2 p) {
        float tone;
        vec3 c = C_BED * (0.8 + 0.25 * hash21(floor(p * 170.0)));
        float pb = pebbles(p, 55.0, 0.8, tone);
        return mix(c, C_BED * (0.65 + 0.7 * tone), pb);
      }

      vec3 concrete(vec2 p) {
        return C_CONC * (0.84 + 0.12 * vnoise(p * 30.0) + 0.08 * hash21(floor(p * 220.0)));
      }

      vec3 pipeWall(vec2 p, float ad, float ri, float ro, vec3 base) {
        float t = (ad - ri) / (ro - ri);
        vec3 c = base * (0.86 + 0.12 * vnoise(p * 40.0));
        c *= 0.62 + 0.38 * smoothstep(0.0, 0.4, t);
        c += 0.07 * smoothstep(0.75, 1.0, t);
        return c;
      }

      float bell(float x, float x0) {
        float d = abs(fract((x - x0) / JOINT) - 0.5) * JOINT;
        return 1.0 - smoothstep(0.03, 0.036, d);
      }

      float revEdge(float a, float rev, float len) {
        return (1.0 - smoothstep(0.0, 0.07, (rev - a) * len)) * step(rev, 0.999);
      }

      vec3 section(vec2 p, float level, float seed) {
        float depth = level - p.y;
        vec3 c = wasteColor(p.x, p.y * 0.6 + seed);
        c *= mix(1.0, 0.5, smoothstep(0.0, 0.15, depth));
        c += W_HI * (1.0 - smoothstep(0.0, 0.01, depth)) * 0.55;
        return c * (1.0 + 0.12 * uActive);
      }

      vec3 frontFace(vec2 p, out bool open) {
        open = false;
        vec3 col = layers(p.x, p.y);
        int kind = 0;
        vec3 wall = vec3(0.0);
        vec3 water = vec3(0.0);
        float mA = (p.x - MX0) / (MX1 - MX0);
        float cA = (p.x - CX0) / (CX1 - CX0);
        bool inCh = abs(p.x - MHX) < MHRI;

        // хоолойн дэр (хайрга) — нээгдсэн хэсэгт л
        if (mA <= uReveal[3] && p.y < MY + 0.03 && p.y > MY - MRO - 0.075) col = bedding(p);
        if (cA >= 0.0 && cA <= uReveal[5] && !inCh && p.y < CY + 0.04 && p.y > CY - CRO - 0.08) col = bedding(p);
        for (int i = 0; i < 3; i++) {
          if (p.y / JY <= uReveal[i] && abs(p.x - HX[i]) < 0.13 && p.y < CH_FLOOR && p.y > JY - 0.02) col = mix(col, bedding(p) * 0.85, 0.5);
        }

        // засварын худаг: бетон цагираг, конус, хүзүү, суурь
        float mhA = p.y / MH_BOT;
        if (mhA <= uReveal[4] && p.y > MH_BOT) {
          float dx = abs(p.x - MHX);
          float e = revEdge(mhA, uReveal[4], -MH_BOT);
          if (p.y < CY) {
            if (dx < MHRI + MHT + 0.05) {
              kind = 1;
              wall = concrete(p) * 0.88 + C_EDGE * e;
            }
          } else {
            float ri = mhInner(p.y);
            if (dx < ri + MHT) {
              if (dx < ri) kind = 2;
              else {
                kind = 1;
                float rl = fract((p.y - CY) / 0.3);
                wall = concrete(p) * (0.76 + 0.24 * smoothstep(0.0, 0.04, min(rl, 1.0 - rl)));
                if (p.y > -0.03) wall = C_IRON;
                wall += C_EDGE * e;
              }
            }
          }
        }

        // коллектор (худаг дотор — зөвхөн доод хагас нь ил суваг)
        if (cA >= 0.0 && cA <= uReveal[5]) {
          float dy = p.y - CY;
          float ady = abs(dy);
          if (!(inCh && dy > 0.0)) {
            float ro = CRO + (inCh ? 0.0 : bell(p.x, CX0) * 0.026);
            if (ady < ro) {
              float e = revEdge(cA, uReveal[5], CX1 - CX0);
              if (ady > CRI) {
                kind = 1;
                wall = pipeWall(p, ady, CRI, ro, C_PIPE_C) + C_EDGE * e;
              } else if (p.y < CLEVEL && cA <= uFlow[5]) {
                kind = 3;
                water = section(p, CLEVEL, 0.0);
              } else kind = 2;
            }
          }
        }

        // гол шугам
        if (mA >= 0.0 && mA <= uReveal[3]) {
          float dy = p.y - MY;
          float ady = abs(dy);
          float ro = MRO + (p.x < MHX - MHRI - MHT ? bell(p.x, MX0) * 0.022 : 0.0);
          if (ady < ro) {
            float e = revEdge(mA, uReveal[3], MX1 - MX0);
            float lv = mainLevel(p.x);
            if (ady > MRI) {
              kind = 1;
              wall = pipeWall(p, ady, MRI, ro, C_PIPE_M) + C_EDGE * e;
            } else if (p.y < lv && mA <= uFlow[3]) {
              kind = 3;
              water = section(p, lv, 3.0);
            } else kind = 2;
          }
        }

        // айлын үзлэгийн худаг + босоо холболт
        for (int i = 0; i < 3; i++) {
          float a = p.y / JY;
          if (a > uReveal[i]) continue;
          float dx = abs(p.x - HX[i]);
          float e = revEdge(a, uReveal[i], -JY);
          if (p.y > CH_FLOOR - CH_WALL && dx < CH_HALF + CH_WALL) {
            if (dx < CH_HALF && p.y > CH_FLOOR) kind = 2;
            else {
              kind = 1;
              wall = concrete(p) * 0.92 + C_EDGE * e;
            }
          }
          if (p.y < CH_FLOOR + 0.001 && p.y > JY - 0.004 && dx < HPRO) {
            if (dx < HPRI) kind = 2;
            else {
              kind = 1;
              wall = pipeWall(p, dx, HPRI, HPRO, C_PIPE_H) + C_EDGE * e;
            }
          }
        }

        if (kind == 2) open = true;
        if (kind == 1) return wall;
        if (kind == 3) return water;
        return col;
      }

      vec3 sideFace(vec2 q, out bool open) {
        open = false;
        vec3 col = layers(q.x * 1.3 + 17.0, q.y);
        float cA = (X1 - CX0) / (CX1 - CX0);
        if (uReveal[5] >= cA) {
          float d = length(vec2(q.x - FZ, q.y - CY));
          if (d < CRO + 0.075 && q.y < CY + 0.04) col = bedding(q);
          if (d < CRO) {
            if (d > CRI) return pipeWall(q, d, CRI, CRO, C_PIPE_C);
            if (q.y < CLEVEL && uFlow[5] >= cA) return section(vec2(q.x * 3.0, q.y), CLEVEL, 7.0);
            open = true;
          }
        }
        return col;
      }

      void main() {
        vec3 n = normalize(vN);
        vec3 col;
        bool open = false;
        if (!gl_FrontFacing) {
          col = C_DEEP * 0.35;
        } else if (n.z > 0.5) {
          col = frontFace(vW.xy, open);
          col *= mix(0.74, 1.0, smoothstep(Y0, 0.0, vW.y));
          col += ${v3("#8fb0c8", 0.28)} * (1.0 - smoothstep(0.0, 0.012, -vW.y));
          col += ${v3("#8fb0c8", 0.14)} * (1.0 - smoothstep(0.0, 0.012, X1 - vW.x));
        } else if (n.x > 0.5) {
          col = sideFace(vec2(vW.z, vW.y), open) * 0.6;
          col += ${v3("#8fb0c8", 0.12)} * (1.0 - smoothstep(0.0, 0.012, FZ - vW.z));
        } else {
          col = C_ASPH * 0.5;
        }
        if (open) discard;
        gl_FragColor = vec4(col * uDim, 1.0);
        ${COLORSPACE}
      }
    `,
  });
}

/** Замын гадаргуу, хашлага, явган зам, зүлэг. uSurface — зүүнээс баруун тийш "дуусгалт"; гудамжны гэрлийн толбо. */
export function surfaceMaterial(U: SewerUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uDim: U.uDim,
      uSurface: U.uSurface,
      uMarks: U.uMarks,
      uActive: U.uActive,
      uBreath: U.uBreath,
      uLit: U.uLit,
    },
    vertexShader: WORLD_VERTEX,
    fragmentShader: /* glsl */ `
      uniform float uDim;
      uniform float uSurface;
      uniform float uMarks;
      uniform float uActive;
      uniform float uBreath;
      uniform float uLit[${LITS}];
      varying vec3 vW;
      varying vec3 vN;
      ${NOISE}
      ${LAYOUT}
      const float ROADZ = ${f(STREET.roadZ)};
      const float CURBZ = ${f(STREET.curbZ)};
      const float WALKZ = ${f(STREET.walkZ)};
      const float HOUSE_Z = ${f(HOUSE_Z)};
      const float LAMPX[2] = ${arr(LAMPS.map((l) => l.x))};
      const float LAMPZ[2] = ${arr(LAMPS.map((l) => l.z + 0.19))};
      const float DOOR[3] = ${arr(HOUSES.map((h) => h.x + h.door))};
      const vec3 C_BARE = ${v3("#3b352c")};
      const vec3 C_ROAD = ${v3("#262c33")};
      const vec3 C_MARK = ${v3("#dfe6ea")};
      const vec3 C_CURB = ${v3("#7a828a")};
      const vec3 C_PAVE = ${v3("#59616a")};
      const vec3 C_LAWN = ${v3("#22392f")};
      const vec3 C_WARM = ${v3("#ffc780")};
      const vec3 C_TEAL = ${v3("#5fe3b8")};

      void main() {
        vec3 n = normalize(vN);
        vec2 q = vW.xz;
        float sweep = smoothstep(0.0, 0.35, mix(X0 - 0.4, X1 + 0.4, uSurface) - vW.x);
        vec3 bare = C_BARE * (0.8 + 0.25 * vnoise(q * 11.0));
        vec3 fin;
        float top = step(0.5, n.y);
        if (top > 0.5) {
          if (vW.y < 0.01) {
            fin = C_ROAD * (0.88 + 0.16 * vnoise(q * 34.0) + 0.1 * (hash21(floor(q * 320.0)) - 0.5));
            float dash = step(fract((q.x - X0) / 0.46), 0.55) * step(FZ - 0.034, q.y);
            float edgeLine = 1.0 - smoothstep(0.004, 0.008, abs(q.y - (ROADZ + 0.05)));
            fin = mix(fin, C_MARK, clamp(dash + edgeLine * 0.55, 0.0, 1.0) * uMarks);
          } else if (q.y > CURBZ) {
            fin = C_CURB * (0.9 + 0.1 * vnoise(q * 50.0));
          } else if (q.y > WALKZ) {
            vec2 t = fract(q * 8.5);
            float grout = min(min(t.x, 1.0 - t.x), min(t.y, 1.0 - t.y));
            fin = C_PAVE * (0.86 + 0.16 * hash21(floor(q * 8.5))) * mix(0.7, 1.0, smoothstep(0.03, 0.08, grout));
          } else {
            fin = C_LAWN * (0.72 + 0.36 * vnoise(q * 15.0) + 0.12 * vnoise(q * 70.0));
            for (int i = 0; i < 3; i++) {
              if (abs(q.x - DOOR[i]) < 0.065 && q.y > HOUSE_Z - 0.01) {
                vec2 t = fract(q * vec2(14.0, 9.0));
                float grout = min(min(t.x, 1.0 - t.x), min(t.y, 1.0 - t.y));
                fin = C_PAVE * 0.95 * mix(0.72, 1.0, smoothstep(0.04, 0.1, grout));
              }
            }
          }
          fin *= 0.86;
        } else if (n.z > 0.5) {
          fin = C_CURB * 0.72;
        } else {
          fin = C_BARE * 0.7;
        }
        vec3 col = mix(bare, fin, sweep);

        // гудамжны гэрлийн дулаан толбо, цонхны тусгал
        for (int k = 0; k < 2; k++) {
          vec2 d = (q - vec2(LAMPX[k], LAMPZ[k])) * vec2(1.0, 1.25);
          float pool = pow(max(1.0 - length(d) / 0.62, 0.0), 2.0);
          col += C_WARM * pool * 0.3 * uLit[3 + k] * (1.0 + 0.03 * uBreath) * top;
        }
        for (int i = 0; i < 3; i++) {
          vec2 d = (q - vec2(HX[i], HOUSE_Z + 0.16)) * vec2(0.8, 1.7);
          float s = pow(max(1.0 - length(d) / 0.5, 0.0), 2.0);
          col += C_WARM * s * 0.1 * uLit[i] * top;
        }
        // бүрэн ажиллагаа: засварын худгийн тагны эргэн тойрон нарийн цагираг
        float r = length(q - vec2(MHX, FZ));
        col += C_TEAL * (1.0 - smoothstep(0.0, 0.012, abs(r - 0.29))) * uActive * (0.5 + 0.2 * uBreath) * top;
        // огтлолын урд ирмэг
        col += ${v3("#8fb0c8", 0.22)} * (1.0 - smoothstep(0.0, 0.01, FZ - q.y)) * top;
        gl_FragColor = vec4(col * uDim, 1.0);
        ${COLORSPACE}
      }
    `,
  });
}

const GROW_VERTEX_HEAD = /* glsl */ `
  attribute float aGroup;
  attribute vec3 aBase;
  uniform float uGrow[${GROUPS}];
  /** Бүлгийн өсөлт: суурь цэгээс босоо чиглэлд "босно" (g = 0 үед зурахгүй) */
  vec3 grow(vec3 pos, out float g) {
    g = uGrow[int(aGroup + 0.5)];
    float s = mix(0.9, 1.0, g);
    return aBase + (pos - aBase) * vec3(s, g, s);
  }
`;

/** Байшин, мод, гэрлийн шон, таг: vertex color + хээ (aMat), procedural гэрэл */
export function bodyMaterial(U: SewerUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: { uDim: U.uDim, uGrow: U.uGrow },
    vertexShader: /* glsl */ `
      ${GROW_VERTEX_HEAD}
      attribute vec3 aColor;
      attribute float aMat;
      varying vec3 vW;
      varying vec3 vN;
      varying vec3 vCol;
      varying float vMat;
      varying float vH;
      void main() {
        float g;
        vec3 p = grow(position, g);
        vH = position.y - aBase.y;
        vW = p;
        vN = normal;
        vCol = aColor;
        vMat = aMat;
        gl_Position = g < 0.002 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uDim;
      varying vec3 vW;
      varying vec3 vN;
      varying vec3 vCol;
      varying float vMat;
      varying float vH;
      ${NOISE}
      ${LIGHT}
      void main() {
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        vec3 v = normalize(cameraPosition - vW);
        vec3 alb = vCol;
        int m = int(vMat + 0.5);
        if (m == 0) {
          alb *= 0.9 + 0.1 * smoothstep(0.0, 0.2, fract(vH * 38.0));
          alb *= 0.94 + 0.08 * vnoise(vW.xz * 20.0 + vW.y * 7.0);
        } else if (m == 1) {
          alb *= 0.76 + 0.24 * smoothstep(0.0, 0.3, fract(vW.y * 44.0));
          alb *= 0.88 + 0.16 * hash21(floor(vec2(vW.x + vW.z, vW.y) * vec2(30.0, 44.0)));
        } else if (m == 2) {
          alb *= 0.82 + 0.18 * step(0.5, fract(vW.x * 70.0));
        } else if (m == 3) {
          alb *= 0.62 + 0.62 * vnoise(vW.xz * 24.0 + vW.y * 16.0);
        } else if (m == 6) {
          vec2 t = abs(fract(vW.xz * 36.0) - 0.5);
          alb *= 0.72 + 0.4 * step(t.x + t.y, 0.3);
        } else if (m == 7) {
          alb *= 0.9 + 0.12 * vnoise(vW.xy * 40.0 + vW.z * 20.0);
        }
        vec3 col = shade(alb, n, v);
        if (m == 5 || m == 6) col += ${v3("#dce8f2", 0.35)} * spec(n, v, 36.0);
        if (m == 1) col += ${v3("#9fb8cc", 0.08)} * spec(n, v, 12.0);
        gl_FragColor = vec4(col * uDim, 1.0);
        ${COLORSPACE}
      }
    `,
  });
}

/** Цонх (хүрээ, салаатай), хаалганы ба гудамжны гэрэл: uLit-ээр асна (ambient — маш бага "амьсгал") */
export function emissiveMaterial(U: SewerUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: { uDim: U.uDim, uGrow: U.uGrow, uLit: U.uLit, uBreath: U.uBreath },
    vertexShader: /* glsl */ `
      ${GROW_VERTEX_HEAD}
      attribute vec3 aColor;
      attribute float aLit;
      attribute float aMat;
      uniform float uLit[${LITS}];
      varying vec2 vUv;
      varying vec3 vCol;
      varying float vLit;
      varying float vMat;
      void main() {
        float g;
        vec3 p = grow(position, g);
        vUv = uv;
        vCol = aColor;
        vLit = uLit[int(aLit + 0.5)];
        vMat = aMat;
        gl_Position = g < 0.002 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uDim;
      uniform float uBreath;
      varying vec2 vUv;
      varying vec3 vCol;
      varying float vLit;
      varying float vMat;
      void main() {
        float lit = vLit * (1.0 + 0.04 * uBreath);
        vec3 col;
        if (vMat < 0.5) {
          vec2 u = vUv;
          float frame = step(u.x, 0.1) + step(0.9, u.x) + step(u.y, 0.1) + step(0.9, u.y);
          float mull = (1.0 - step(0.035, abs(u.x - 0.5))) + (1.0 - step(0.03, abs(u.y - 0.6)));
          vec3 dark = mix(${v3("#0a1420")}, ${v3("#1d3044")}, u.y);
          vec3 warm = vCol * (0.72 + 0.34 * (1.0 - u.y));
          col = mix(dark, warm, lit);
          col = mix(col, ${v3("#b9c3cc", 0.55)} * uDim, clamp(frame + mull, 0.0, 1.0));
        } else {
          col = mix(${v3("#1c232b")}, vCol, lit);
        }
        gl_FragColor = vec4(col, 1.0);
        ${COLORSPACE}
      }
    `,
  });
}

/** Гэрлийн зөөлөн толбо (additive) — postprocessing bloom-гүйгээр */
export function glowMaterial(U: SewerUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: { uLit: U.uLit, uBreath: U.uBreath },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aLit;
      uniform float uLit[${LITS}];
      varying vec2 vUv;
      varying vec3 vCol;
      varying float vLit;
      void main() {
        vUv = uv;
        vCol = aColor;
        vLit = uLit[int(aLit + 0.5)];
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uBreath;
      varying vec2 vUv;
      varying vec3 vCol;
      varying float vLit;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float a = pow(max(1.0 - r, 0.0), 2.4) * vLit * (0.92 + 0.08 * uBreath);
        gl_FragColor = vec4(vCol * 0.5, a);
        ${COLORSPACE}
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/**
 * Огтлолын ард байгаа гадаргуу: хоолой (дотор тал, муфтын заадас, нойтон зурвас), худгийн бетон
 * (цагирагийн заадас, гаргалгааны нүх), ган шат, коллекторын гадна тал. aAlong > reveal үед зурахгүй.
 * Айлын босоо холболтын дотор тал дээр бохир усны нимгэн урсгал (фронт — uFlow).
 */
export function interiorMaterial(U: SewerUniforms) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uDim: U.uDim,
      uPhase: U.uPhase,
      uShimmer: U.uShimmer,
      uDetail: U.uDetail,
      uActive: U.uActive,
      uReveal: U.uReveal,
      uFlow: U.uFlow,
    },
    vertexShader: /* glsl */ `
      attribute float aElem;
      attribute float aAlong;
      attribute float aMat;
      uniform float uReveal[${ELEMENTS}];
      uniform float uFlow[${ELEMENTS}];
      varying vec3 vW;
      varying vec3 vN;
      varying float vA;
      varying float vR;
      varying float vF;
      varying float vMat;
      varying float vElem;
      void main() {
        int e = int(aElem + 0.5);
        vA = aAlong;
        vR = uReveal[e];
        vF = uFlow[e];
        vMat = aMat;
        vElem = aElem;
        vW = position;
        vN = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uDim;
      uniform float uPhase;
      uniform float uShimmer;
      uniform float uDetail;
      uniform float uActive;
      varying vec3 vW;
      varying vec3 vN;
      varying float vA;
      varying float vR;
      varying float vF;
      varying float vMat;
      varying float vElem;
      ${NOISE}
      ${LAYOUT}
      ${WASTE}
      ${LIGHT}
      const vec3 C_PIPE_IN = ${v3("#2a343d")};
      const vec3 C_GRIME = ${v3("#243a30")};
      const vec3 C_CONC_IN = ${v3("#4a535b")};
      const vec3 C_HOLE = ${v3("#05090c")};
      const vec3 C_STEEL = ${v3("#a3b0bb")};
      const vec3 C_EXT = ${v3("#3a4148")};
      const vec3 C_RIM = ${v3("#56606a")};
      const vec3 C_TEAL = ${v3("#5fe3b8")};

      void main() {
        if (vR < 0.0005 || vA > vR + 0.0005) discard;
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        vec3 v = normalize(cameraPosition - vW);
        int m = int(vMat + 0.5);
        int e = int(vElem + 0.5);
        float light = 0.4 + 0.6 * max(dot(n, ${dirGlsl(-0.25, 0.5, 1.0)}), 0.0);
        vec3 col;
        if (m == 0) {
          col = C_PIPE_IN * (0.84 + 0.16 * vnoise(vW.xy * 24.0 + vW.z * 9.0));
          if (e == 3 || e == 5) {
            float x0 = e == 3 ? MX0 : CX0;
            float u = abs(fract((vW.x - x0) / JOINT) - 0.5) * JOINT;
            col *= 0.55 + 0.45 * smoothstep(0.005, 0.012, u);
            float lv = e == 3 ? mainLevel(vW.x) : CLEVEL;
            float wet = step(vA, vF) * step(0.0005, vF);
            float band = smoothstep(lv + 0.045, lv, vW.y) * step(lv - 0.003, vW.y);
            col = mix(col, C_GRIME, band * 0.75 * wet);
            col += W_HI * 0.06 * wet * smoothstep(lv + 0.1, lv, vW.y);
          }
          if (e < 3 && vA < vF) {
            float s = vnoise(vec2(vW.x * 70.0, vA * 26.0 - uPhase * 3.2));
            col = mix(col, wasteColor(vA * 3.0, vW.x * 1.5), 0.8);
            col += W_HI * smoothstep(0.6, 0.95, s) * 0.3;
            light = max(light, 0.85);
          }
          col += ${v3("#bcd2e0", 0.1)} * spec(n, v, 24.0);
        } else if (m == 1 || m == 4) {
          col = C_CONC_IN * (0.8 + 0.14 * vnoise(vW.xy * 18.0 + vW.z * 5.0) + 0.07 * hash21(floor(vW.xy * 190.0)));
          if (m == 4) col *= 0.78;
          if (e == 4) {
            float rl = fract((vW.y - CY) / 0.3);
            col *= 0.7 + 0.3 * smoothstep(0.0, 0.05, min(rl, 1.0 - rl));
            float d = length(vec2(vW.y - MY, vW.z - FZ));
            if (vW.x < MHX - MHRI * 0.5 && d < MRI + 0.02) col = d < MRI ? C_HOLE : C_RIM * 0.6;
            // нойтон толбо: гаралтаас доош
            float wetLine = (1.0 - smoothstep(0.0, 0.06, abs(vW.z - (FZ - 0.05)))) * step(vW.y, MY) * step(MHX, vW.x + MHRI * 0.8);
            col = mix(col, C_GRIME, wetLine * 0.35 * step(0.999, vF));
            col *= mix(1.0, 0.72, smoothstep(-0.2, -1.6, vW.y));
            col += C_TEAL * 0.05 * uActive;
          }
          if (e < 3) {
            if (n.z > 0.5) {
              float d = length(vec2(vW.x - HX[e], vW.y - LAT_Y));
              if (d < LAT_R + 0.012) col = d < LAT_R ? C_HOLE : C_RIM;
            }
            if (m == 4) {
              float d = length(vec2(vW.x - HX[e], vW.z - FZ));
              if (d < HPRI) col = C_HOLE;
            }
          }
        } else if (m == 2) {
          col = C_STEEL * 0.8 + ${v3("#e6f0f8", 0.5)} * spec(n, v, 30.0);
          light = max(light, 0.75);
        } else if (m == 3) {
          col = C_EXT * (0.8 + 0.2 * vnoise(vW.xy * 12.0 + vW.z * 7.0));
          col = shade(col, n, v) + ${v3("#dce8f2", 0.25)} * spec(n, v, 30.0);
          light = 1.0;
        } else {
          col = C_RIM * (0.86 + 0.14 * vnoise(vW.xy * 40.0));
          light = 1.0;
        }
        col *= light;
        // огтлолоос гүн рүү (ар тал руу) бараан — зөөлөн AO
        if (m != 3 && m != 5) col *= mix(1.0, 0.6, smoothstep(0.0, 0.28, FZ - vW.z));
        gl_FragColor = vec4(col * uDim, 1.0);
        ${COLORSPACE}
      }
    `,
  });
}

/**
 * Бохир усны гадаргуу: гол шугам (түвшин нь айлын холболт бүрийн дараа нэмэгдэнэ — vertex shader),
 * коллектор, худаг доторх уналт, айлын худгийн дусал урсгал, коллекторын огтлол.
 * aAlong > uFlow үед зурахгүй: урсгалын фронт гэрэлтэй "толгой"-той урагшилна.
 */
export function waterMaterial(U: SewerUniforms) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uDim: U.uDim,
      uPhase: U.uPhase,
      uShimmer: U.uShimmer,
      uDetail: U.uDetail,
      uActive: U.uActive,
      uFlow: U.uFlow,
    },
    vertexShader: /* glsl */ `
      attribute float aElem;
      attribute float aAlong;
      attribute float aAcross;
      attribute float aKind;
      uniform float uFlow[${ELEMENTS}];
      varying vec3 vW;
      varying float vA;
      varying float vF;
      varying float vKind;
      varying float vAcross;
      ${LAYOUT}
      void main() {
        vec3 p = position;
        if (aKind < 0.5) {
          float lv = mainLevel(p.x);
          float dy = lv - MY;
          float c = sqrt(max(MRI * MRI - dy * dy, 0.0)) - 0.004;
          p.y = lv;
          p.z = FZ - c * (1.0 - aAcross);
        }
        vW = p;
        vA = aAlong;
        vF = uFlow[int(aElem + 0.5)];
        vKind = aKind;
        vAcross = aAcross;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uDim;
      uniform float uPhase;
      uniform float uShimmer;
      uniform float uDetail;
      uniform float uActive;
      uniform float uFlow[${ELEMENTS}];
      varying vec3 vW;
      varying float vA;
      varying float vF;
      varying float vKind;
      varying float vAcross;
      ${NOISE}
      ${LAYOUT}
      ${WASTE}
      void main() {
        if (vF < 0.0005 || vA > vF) discard;
        int k = int(vKind + 0.5);
        float head = (1.0 - smoothstep(0.0, 0.05, vF - vA)) * step(vF, 0.999);
        vec3 col;
        if (k <= 1) {
          col = wasteColor(vW.x, vW.z);
          float sh = vnoise(vec2(vW.x * 26.0 - uPhase * 2.4 + uShimmer * 0.7, vW.z * 70.0));
          col += W_HI * pow(sh, 5.0) * 0.32;
          col *= mix(0.72, 1.0, vAcross);
          // урсгалын чиглэл: бүдэг ">" сум урагшилна
          float ch = fract((vW.x - abs(vAcross - 0.5) * 0.18) * 1.8 - uPhase * 0.55);
          col += W_HI * smoothstep(0.0, 0.05, ch) * (1.0 - smoothstep(0.09, 0.2, ch)) * 0.1;
          float fn = vnoise(vec2(vW.x * 60.0 - uPhase * 4.0, vW.z * 60.0));
          if (k == 0) {
            for (int i = 0; i < 3; i++) {
              float on = step(0.999, uFlow[i]);
              float d = abs(vW.x - HX[i] - 0.02);
              col = mix(col, C_FOAM, (1.0 - smoothstep(0.0, 0.08, d)) * on * (0.3 + 0.35 * fn));
            }
          } else {
            float d = abs(vW.x - DROP_X1);
            col = mix(col, C_FOAM, (1.0 - smoothstep(0.0, 0.14, d)) * step(0.999, uFlow[4]) * (0.3 + 0.4 * fn));
          }
        } else if (k == 2) {
          col = wasteColor(vA * 1.6, vAcross * 0.25);
          float s = vnoise(vec2(vAcross * 5.0, vA * 18.0 - uPhase * 5.0));
          col = mix(col, C_FOAM, 0.16 + 0.22 * s);
          col *= 0.8 + 0.3 * (1.0 - abs(vAcross - 0.5) * 2.0);
        } else {
          float depth = CLEVEL - vW.y;
          col = wasteColor(vW.x, vW.y * 0.6 + 7.0) * mix(1.0, 0.5, smoothstep(0.0, 0.15, depth));
          col += W_HI * (1.0 - smoothstep(0.0, 0.01, depth)) * 0.55;
        }
        col += W_HI * head * 0.45;
        col *= 1.0 + 0.12 * uActive;
        gl_FragColor = vec4(col * uDim, 1.0);
        ${COLORSPACE}
      }
    `,
  });
}

/** Блокийн доорх зөөлөн сүүдэр (дөрвөлжин уусалт) — бодит цагийн сүүдэргүйгээр газарт суулгана */
export function slabShadowMaterial() {
  const cx = (SLAB.x0 + SLAB.x1) / 2;
  const cz = (FACE_Z + SLAB.z0) / 2;
  return new THREE.ShaderMaterial({
    vertexShader: WORLD_VERTEX,
    fragmentShader: /* glsl */ `
      varying vec3 vW;
      varying vec3 vN;
      float sdBox(vec2 p, vec2 b) {
        vec2 d = abs(p) - b;
        return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
      }
      void main() {
        float s = sdBox(vW.xz - vec2(${f(cx)}, ${f(cz)}), vec2(${f((SLAB.x1 - SLAB.x0) / 2)}, ${f((FACE_Z - SLAB.z0) / 2)}));
        float a = (1.0 - smoothstep(-0.05, 0.6, s)) * 0.6;
        gl_FragColor = vec4(0.0, 0.01, 0.03, a);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}
