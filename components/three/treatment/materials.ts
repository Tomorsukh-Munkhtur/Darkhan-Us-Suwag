import * as THREE from "three";
import { NOISE } from "../journey/materials/glsl";
import { BUILDING, GRASS, GROUPS, LAMPS, LITS, OUTLET, PLINTH, RIVER, TANKS } from "./layout";

/**
 * Цэвэрлэх байгууламжийн shader-үүд. Бүгд ShaderMaterial (procedural гэрэл, хээ; текстургүй), tone mapping-гүй.
 * Хуваалцсан uniform нэг объект — кадр бүр нэг удаа бичихэд бүх материал шинэчлэгдэнэ.
 * Өнгөний утга: бохир ус — ногоон/teal, цэвэршсэн ус — цэнхэр/cyan, бетон — сэрүүн саарал, гэрэл — зөөлөн цагаан.
 */
const f = (n: number) => n.toFixed(4);
const v3 = (hex: string, k = 1) => {
  const c = new THREE.Color(hex);
  return `vec3(${f(c.r * k)}, ${f(c.g * k)}, ${f(c.b * k)})`;
};
const arr = (xs: readonly number[]) => `float[${xs.length}](${xs.map(f).join(", ")})`;
const arr2 = (xs: readonly (readonly [number, number])[]) => `vec2[${xs.length}](${xs.map(([x, y]) => `vec2(${f(x)}, ${f(y)})`).join(", ")})`;
const dirGlsl = (x: number, y: number, z: number) => {
  const v = new THREE.Vector3(x, y, z).normalize();
  return `vec3(${f(v.x)}, ${f(v.y)}, ${f(v.z)})`;
};

export type TreatmentUniforms = ReturnType<typeof createTreatmentUniforms>;

export function createTreatmentUniforms() {
  return {
    uDim: { value: 1 },
    uPhase: { value: 0 },
    uShimmer: { value: 0 },
    uBreath: { value: 0 },
    uDetail: { value: 1 },
    uActive: { value: 0 },
    uGrow: { value: new Array<number>(GROUPS).fill(0) },
    uLit: { value: new Array<number>(LITS).fill(0) },
    uSpin: { value: [0, 0, 0] },
    uLevel: { value: TANKS.map((t) => t.floor) },
    uFill: { value: [0, 0, 0] },
    uActiveL: { value: 0 },
    uClean: { value: [0, 0] },
    uChannel: { value: [0, 0] },
    uOutlet: { value: 0 },
    uCascade: { value: 0 },
  };
}

const LAYOUT = /* glsl */ `
  const float X0 = ${f(PLINTH.x0)};
  const float X1 = ${f(PLINTH.x1)};
  const float Z0 = ${f(PLINTH.z0)};
  const float Z1 = ${f(PLINTH.z1)};
  const float Y0 = ${f(PLINTH.y0)};
  const vec2 TC[3] = ${arr2(TANKS.map((t) => [t.x, t.z] as const))};
  const float T_R[3] = ${arr(TANKS.map((t) => t.r))};
  const float T_RO[3] = ${arr(TANKS.map((t) => t.r + t.wall))};
  const float T_FLOOR[3] = ${arr(TANKS.map((t) => t.floor))};
  const float T_TOP = ${f(TANKS[0].top)};
  const vec2 RC = vec2(${f(RIVER.cx)}, ${f(RIVER.cz)});
  const float RR = ${f(RIVER.R)};
  const float RH = ${f(RIVER.half)};
  const float RY = ${f(RIVER.y)};
  const float RBED = ${f(RIVER.bed)};
  const vec2 OUTFALL = vec2(${f(OUTLET.xEnd + 0.1)}, ${f(OUTLET.zRun)});
  const vec2 BLD = vec2(${f(BUILDING.x)}, ${f(BUILDING.z)});
  const vec2 BLD_HALF = vec2(${f(BUILDING.w / 2)}, ${f(BUILDING.d / 2)});
  const int LAMP_N = ${LAMPS.length};
  const float LAMPX[${LAMPS.length}] = ${arr(LAMPS.map((l) => l.x))};
  const float LAMPZ[${LAMPS.length}] = ${arr(LAMPS.map((l) => l.z))};
  float riverD(vec2 q) { return abs(length(q - RC) - RR) - RH; }
  float segD(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
  }
`;

const LIGHT = /* glsl */ `
  const vec3 KEY_DIR = ${dirGlsl(-0.4, 0.85, 0.35)};
  const vec3 KEY_COL = ${v3("#cdd9e8", 0.9)};
  const vec3 SKY = ${v3("#5f7896", 0.95)};
  const vec3 GROUND = ${v3("#1a2330", 0.8)};
  const vec3 RIM_DIR = ${dirGlsl(0.6, 0.35, -0.7)};
  const vec3 RIM_COL = ${v3("#3f8fb8", 0.35)};
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

/** Цэвэр ус (гол, цэвэршсэн) ба бохир ус (teal) — хуваалцсан өнгө */
const WATER_COLORS = /* glsl */ `
  const vec3 RAW_DEEP = ${v3("#2c3526")};
  const vec3 RAW_MID = ${v3("#56603c")};
  const vec3 W_DEEP = ${v3("#0a302b")};
  const vec3 W_MID = ${v3("#1a5f4f")};
  const vec3 W_HI = ${v3("#6fe0b5")};
  const vec3 C_DEEP = ${v3("#0b3d6a")};
  const vec3 C_MID = ${v3("#1b6fa6")};
  const vec3 C_HI = ${v3("#8fe0ff")};
  const vec3 R_DEEP = ${v3("#0d3550")};
  const vec3 R_MID = ${v3("#236a94")};
  const vec3 FOAM = ${v3("#d6f1ea")};
`;

/**
 * Савны цэвэршилт (0 — бохир ногоон, 1 — цэвэр цэнхэр): зүүн сав 0, дунд сав 0 → MID, баруун сав MID → 1.
 * uClean[0] — дунд сав, uClean[1] — баруун сав.
 */
const TANK_CLEAN = /* glsl */ `
  uniform float uClean[2];
  const float MID_CLEAN = 0.5;
  float tankClean(int k) {
    return k == 0 ? 0.0 : k == 1 ? MID_CLEAN * uClean[0] : MID_CLEAN + (1.0 - MID_CLEAN) * uClean[1];
  }
`;

// ---------------------------------------------------------------------------------------------

/**
 * Талбайн суурь (plinth). Дээд тал: бетон хавтан (заадастай), савны эргэн тойрны явган зам, үйлчилгээний зам,
 * зүлэг, голын эрэг; гол нь нүх (discard). Хажуу тал: бетон/хайрга/хөрс, голын огтлол.
 */
export function groundMaterial(U: TreatmentUniforms) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uDim: U.uDim, uLit: U.uLit },
    vertexShader: WORLD_VERTEX,
    fragmentShader: /* glsl */ `
      uniform float uDim;
      uniform float uLit[${LITS}];
      varying vec3 vW;
      varying vec3 vN;
      ${NOISE}
      ${LAYOUT}
      ${WATER_COLORS}
      const vec3 C_GROUND = ${v3("#34404b")};
      const vec3 C_APRON = ${v3("#4d5863")};
      const vec3 C_ROAD = ${v3("#232a31")};
      const vec3 C_MARK = ${v3("#c9d2d8")};
      const vec3 C_GRASS = ${v3("#22392f")};
      const vec3 C_EARTH = ${v3("#2f2a24")};
      const vec3 C_GRAVEL = ${v3("#4f5155")};
      const vec3 C_SOIL = ${v3("#3e3429")};
      const vec3 C_WARM = ${v3("#ffe0b0")};
      const vec3 C_COOL = ${v3("#bfe4ff")};

      vec3 topFace(vec2 q, out bool open) {
        open = false;
        float rd = riverD(q);
        if (rd < 0.0) {
          open = true;
          return vec3(0.0);
        }
        vec3 col = C_GROUND * (0.86 + 0.12 * vnoise(q * 6.0) + 0.06 * hash21(floor(q * 240.0)));
        vec2 jt = abs(fract(q * 2.5) - 0.5);
        col *= mix(0.8, 1.0, smoothstep(0.0, 0.012, 0.5 - max(jt.x, jt.y)));
        // арын үйлчилгээний зам
        if (q.y < Z0 + 0.24) {
          col = C_ROAD * (0.88 + 0.14 * vnoise(q * 30.0));
          float dash = step(fract(q.x * 2.2), 0.5) * (1.0 - smoothstep(0.004, 0.008, abs(q.y - (Z0 + 0.12))));
          col = mix(col, C_MARK * 0.8, dash);
        }
        // савны эргэн тойрны явган зам + хананы ёроолын сүүдэр
        float da = 1e3;
        for (int k = 0; k < 3; k++) da = min(da, length(q - TC[k]) - T_RO[k]);
        if (da < 0.17) col = C_APRON * (0.88 + 0.1 * vnoise(q * 22.0)) * mix(0.8, 1.0, smoothstep(0.004, 0.012, abs(da - 0.165)));
        // явган замууд: байр → зүүн сав, байр → зам, дунд сав → зам
        vec2 door = BLD + vec2(0.18, BLD_HALF.y);
        float pd = min(segD(q, door, TC[0] - vec2(0.0, T_R[0] - 0.08)), segD(q, door, vec2(BLD.x + 0.7, Z0 + 0.24)));
        pd = min(pd, segD(q, vec2(TC[1].x + 0.1, TC[1].y - 0.4), vec2(TC[1].x + 0.1, Z0 + 0.24)));
        if (pd < 0.045) col = C_APRON * (0.9 + 0.1 * vnoise(q * 30.0));
        // зүлэг (ирмэг нь noise) + голын эргийн ургамал
        float gr = rd - 0.1;
        ${GRASS.map((g) => `gr = min(gr, length(q - vec2(${f(g.x)}, ${f(g.z)})) - ${f(g.r)});`).join("\n        ")}
        gr += (vnoise(q * 7.0) - 0.5) * 0.12;
        if (gr < 0.0 || length(q - RC) < RR) col = C_GRASS * (0.7 + 0.45 * vnoise(q * 18.0) + 0.12 * vnoise(q * 60.0));
        col = mix(col, C_EARTH, 1.0 - smoothstep(0.0, 0.035, rd));
        col *= mix(0.55, 1.0, smoothstep(0.0, 0.06, da));
        // гэрэлтүүлгийн толбо, байрны цонхны тусгал
        for (int k = 0; k < LAMP_N; k++) {
          float pool = pow(max(1.0 - length(q - vec2(LAMPX[k], LAMPZ[k])) / 0.5, 0.0), 2.0);
          col += C_WARM * pool * 0.2 * uLit[1];
        }
        vec2 bd = (q - BLD - vec2(-0.05, BLD_HALF.y + 0.1)) * vec2(0.9, 1.8);
        col += C_COOL * pow(max(1.0 - length(bd) / 0.35, 0.0), 2.0) * 0.08 * uLit[0];
        return col * 0.9;
      }

      vec3 sideFace(vec3 w, out bool open) {
        open = false;
        float rd = riverD(w.xz);
        if (rd < 0.0) {
          if (w.y > RY) {
            open = true;
            return vec3(0.0);
          }
          if (w.y > RBED) {
            float d = RY - w.y;
            return mix(R_MID, R_DEEP, smoothstep(0.0, RY - RBED, d)) + ${v3("#8fd0f0", 0.3)} * (1.0 - smoothstep(0.0, 0.008, d));
          }
        }
        vec3 col;
        float y = w.y + (vnoise(vec2(w.x + w.z, 3.0) * 3.0) - 0.5) * 0.012;
        float g = hash21(floor(vec2(w.x + w.z, w.y) * 160.0));
        if (y > -0.035) col = C_APRON * (0.9 + 0.12 * g);
        else if (y > -0.09) col = C_GRAVEL * (0.75 + 0.35 * g);
        else col = C_SOIL * (0.8 + 0.3 * vnoise(vec2(w.x + w.z, w.y) * 12.0)) * (0.9 + 0.14 * g);
        col *= 0.8 + 0.2 * smoothstep(0.0, 0.01, min(abs(y + 0.035), abs(y + 0.09)));
        return col;
      }

      void main() {
        vec3 n = normalize(vN);
        vec3 col;
        bool open = false;
        if (!gl_FrontFacing) {
          col = C_SOIL * 0.35;
        } else if (n.y > 0.5) {
          col = topFace(vW.xz, open);
        } else if (n.z > 0.5 || n.x > 0.5) {
          col = sideFace(vW, open) * (n.z > 0.5 ? 0.72 : 0.56);
          col += ${v3("#8fb0c8", 0.18)} * (1.0 - smoothstep(0.0, 0.01, -vW.y));
        } else {
          col = C_SOIL * 0.4;
        }
        if (open) discard;
        gl_FragColor = vec4(col * uDim, 1.0);
        ${COLORSPACE}
      }
    `,
  });
}

/**
 * Бүтээц: бетон сав (хана, ирмэг, дотор хана — усны шугамын бараан зурвас), металл гүүр/хашлага,
 * байр, бут, гаргалгааны хоолой (дотор нь цэвэршсэн усны cyan импульс урагшилна).
 * Бүлэг бүр "босно" (uGrow); гүүрнүүд савны төвийг тойрон эргэнэ (uSpin).
 */
export function bodyMaterial(U: TreatmentUniforms) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uDim: U.uDim,
      uGrow: U.uGrow,
      uSpin: U.uSpin,
      uLevel: U.uLevel,
      uFill: U.uFill,
      uActiveL: U.uActiveL,
      uClean: U.uClean,
      uOutlet: U.uOutlet,
      uPhase: U.uPhase,
      uActive: U.uActive,
    },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aGroup;
      attribute vec3 aBase;
      attribute float aMat;
      attribute float aSpin;
      attribute float aAlong;
      uniform float uGrow[${GROUPS}];
      uniform float uSpin[3];
      varying vec3 vW;
      varying vec3 vN;
      varying vec3 vCol;
      varying float vMat;
      varying float vAlong;
      varying float vGroup;
      ${LAYOUT}
      void main() {
        float g = uGrow[int(aGroup + 0.5)];
        float s = mix(0.9, 1.0, g);
        vec3 p = aBase + (position - aBase) * vec3(s, g, s);
        vec3 n = normal;
        int sp = int(aSpin + 0.5);
        if (sp > 0) {
          float a = uSpin[sp - 1];
          vec2 c = TC[sp - 1];
          float cs = cos(a);
          float sn = sin(a);
          vec2 d = p.xz - c;
          p.xz = c + vec2(d.x * cs - d.y * sn, d.x * sn + d.y * cs);
          n.xz = vec2(n.x * cs - n.z * sn, n.x * sn + n.z * cs);
        }
        vW = p;
        vN = n;
        vCol = aColor;
        vMat = aMat;
        vAlong = aAlong;
        vGroup = aGroup;
        gl_Position = g < 0.002 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uDim;
      uniform float uLevel[3];
      uniform float uFill[3];
      uniform float uActiveL;
      uniform float uOutlet;
      uniform float uPhase;
      uniform float uActive;
      varying vec3 vW;
      varying vec3 vN;
      varying vec3 vCol;
      varying float vMat;
      varying float vAlong;
      varying float vGroup;
      ${NOISE}
      ${LAYOUT}
      ${LIGHT}
      ${TANK_CLEAN}
      const vec3 C_CYAN = ${v3("#6fd8ff")};
      void main() {
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        vec3 v = normalize(cameraPosition - vW);
        vec3 alb = vCol;
        int m = int(vMat + 0.5);
        float sk = 0.0;
        float spw = 30.0;
        if (m == 0) {
          alb *= 0.86 + 0.12 * vnoise(vW.xz * 26.0 + vW.y * 9.0) + 0.05 * hash21(floor(vW.xy * 200.0 + vW.z * 90.0));
          alb *= 0.92 + 0.08 * smoothstep(0.0, 0.2, fract(vW.y * 22.0));
        } else if (m == 1) {
          alb *= 0.9 + 0.1 * vnoise(vW.xz * 40.0);
        } else if (m == 2) {
          // савны дотор хана: гүн рүү бараан, усны шугамын дээр бараан ногоон/цэнхэр зурвас
          int t = int(vGroup + 0.5);
          alb *= mix(0.4, 1.0, smoothstep(T_FLOOR[t], T_TOP, vW.y));
          float lv = uLevel[t];
          float band = smoothstep(lv + 0.035, lv, vW.y) * step(0.002, uFill[t]);
          vec3 grime = mix(${v3("#2c4034")}, ${v3("#2b4556")}, tankClean(t));
          alb = mix(alb, grime, band * 0.8);
        } else if (m == 4) {
          sk = 0.45;
        } else if (m == 5) {
          sk = 0.3;
          spw = 20.0;
        } else if (m == 6) {
          vec2 gq = fract(vW.xz * 70.0);
          alb *= 0.7 + 0.35 * step(0.3, min(gq.x, gq.y));
          sk = 0.12;
        } else if (m == 7) {
          alb *= 0.9 + 0.1 * step(0.08, fract(vW.x * 14.0 + vW.z * 14.0));
        } else if (m == 9) {
          alb *= 0.62 + 0.62 * vnoise(vW.xz * 30.0 + vW.y * 20.0);
        } else if (m == 10) {
          sk = 0.4;
          spw = 24.0;
        }
        vec3 col = shade(alb, n, v);
        col += ${v3("#dce8f2")} * sk * spec(n, v, spw);
        // гаргалгааны хоолой: цэвэршсэн усны импульс урсгалын чиглэлд (фронт — uOutlet)
        if (m == 10 && vAlong > 0.0 && vAlong < uOutlet) {
          float x = fract(vAlong * 14.0 - uPhase * 0.9);
          float pulse = smoothstep(0.0, 0.06, x) * (1.0 - smoothstep(0.1, 0.26, x));
          float head = 1.0 - smoothstep(0.0, 0.05, uOutlet - vAlong);
          col += C_CYAN * (0.12 + pulse * 0.55 + head * 0.5 * step(uOutlet, 0.999)) * (0.6 + 0.4 * max(n.y, 0.0));
        }
        gl_FragColor = vec4(col * uDim, 1.0);
        ${COLORSPACE}
      }
    `,
  });
}

/** Цонх (цайвар цэнхэр), гэрэлтүүлэг (зөөлөн цагаан), хөтлүүрийн LED (cyan) — uLit-ээр асна */
export function emissiveMaterial(U: TreatmentUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: { uDim: U.uDim, uGrow: U.uGrow, uLit: U.uLit, uSpin: U.uSpin, uBreath: U.uBreath },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aLit;
      attribute float aGroup;
      attribute vec3 aBase;
      attribute float aMat;
      attribute float aSpin;
      uniform float uGrow[${GROUPS}];
      uniform float uLit[${LITS}];
      uniform float uSpin[3];
      varying vec2 vUv;
      varying vec3 vCol;
      varying float vLit;
      varying float vMat;
      ${LAYOUT}
      void main() {
        float g = uGrow[int(aGroup + 0.5)];
        float s = mix(0.9, 1.0, g);
        vec3 p = aBase + (position - aBase) * vec3(s, g, s);
        int sp = int(aSpin + 0.5);
        if (sp > 0) {
          float a = uSpin[sp - 1];
          vec2 c = TC[sp - 1];
          vec2 d = p.xz - c;
          p.xz = c + vec2(d.x * cos(a) - d.y * sin(a), d.x * sin(a) + d.y * cos(a));
        }
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
          float frame = step(vUv.x, 0.08) + step(0.92, vUv.x) + step(vUv.y, 0.12) + step(0.88, vUv.y) + (1.0 - step(0.03, abs(vUv.x - 0.5)));
          col = mix(mix(${v3("#0a1420")}, ${v3("#1d3044")}, vUv.y), vCol * (0.7 + 0.3 * vUv.y), lit);
          col = mix(col, ${v3("#9aa6b1", 0.5)} * uDim, clamp(frame, 0.0, 1.0));
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
export function glowMaterial(U: TreatmentUniforms) {
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
        gl_FragColor = vec4(vCol * 0.45, a);
        ${COLORSPACE}
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/**
 * Ус. Зүүн сав — бохир ус: дүүрэх үед бараан (түүхий), идэвхжихэд ногоон-teal, эргэлдэх урсгал, гүүрний араас
 * хөөс. Дунд сав — ногоон-teal-аас хагас цэвэршинэ, баруун сав — цэвэр цэнхэр рүү (tankClean), төвөөс цагираг
 * долгио, хальхын cyan тодотгол. Сувгууд — фронттой урсгал (дараагийн сав руу цэнхэршинэ). Гол — нуман урсгал, гаргалгааны доорх цагираг. Гаргалгааны унах урсгал.
 */
export function waterMaterial(U: TreatmentUniforms) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uDim: U.uDim,
      uPhase: U.uPhase,
      uShimmer: U.uShimmer,
      uDetail: U.uDetail,
      uActive: U.uActive,
      uSpin: U.uSpin,
      uLevel: U.uLevel,
      uFill: U.uFill,
      uActiveL: U.uActiveL,
      uClean: U.uClean,
      uChannel: U.uChannel,
      uCascade: U.uCascade,
    },
    vertexShader: /* glsl */ `
      attribute float aKind;
      attribute float aAlong;
      attribute float aAcross;
      uniform float uLevel[3];
      varying vec3 vW;
      varying float vKind;
      varying float vA;
      varying float vC;
      void main() {
        vec3 p = position;
        if (aKind < 2.5) p.y = uLevel[int(aKind + 0.5)];
        vW = p;
        vKind = aKind;
        vA = aAlong;
        vC = aAcross;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uDim;
      uniform float uPhase;
      uniform float uShimmer;
      uniform float uDetail;
      uniform float uActive;
      uniform float uSpin[3];
      uniform float uFill[3];
      uniform float uActiveL;
      uniform float uChannel[2];
      uniform float uCascade;
      varying vec3 vW;
      varying float vKind;
      varying float vA;
      varying float vC;
      ${NOISE}
      ${LAYOUT}
      ${WATER_COLORS}
      ${TANK_CLEAN}
      const float TAU = 6.2831853;

      /** Гадаргуугийн гялбаа, тэнгэрийн тусгал (ар тал руу), key гэрлийн цэгэн тусгал */
      vec3 surfaceLight(vec2 q, float scale) {
        float g1 = vnoise(q * 26.0 + vec2(uShimmer * 0.5, -uShimmer * 0.35) + uPhase * 0.25);
        float g2 = uDetail > 0.5 ? vnoise(q * 57.0 - vec2(uShimmer * 0.8, uShimmer * 0.45)) : g1;
        return ${v3("#cfe8f5")} * smoothstep(0.8, 0.98, g1 * 0.6 + g2 * 0.4) * 0.22 * scale;
      }

      vec3 tank(int k) {
        vec2 c = TC[k];
        float R = T_R[k];
        float cl = tankClean(k);
        vec2 d = vW.xz - c;
        float r = length(d) / R;
        float th = atan(d.y, d.x);
        float arm = uSpin[k];
        float behind = mod(arm - th, TAU);
        // бохир ус (түүхий → идэвхтэй)
        // эргэлдэх урсгал: координатыг радиусаас хамааран мушгина (спираль), фаз нь scroll + ambient
        float sw = uPhase * 0.35 + uShimmer * 0.04;
        float ang = sw + r * 2.4;
        vec2 q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * (d / R);
        float n1 = vnoise(q * 7.0 + 3.0);
        float n2 = uDetail > 0.5 ? vnoise(q * 17.0 + 9.0) : n1;
        float swirl = smoothstep(0.55, 0.9, n1 * 0.6 + n2 * 0.4);
        vec3 raw = mix(RAW_DEEP, RAW_MID, 0.4 + 0.4 * n1);
        vec3 act = mix(W_DEEP, W_MID, 0.3 + 0.35 * n1 + 0.15 * r) + W_HI * swirl * 0.08;
        vec3 waste = mix(raw, act, k == 0 ? uActiveL : 1.0);
        float wake = exp(-behind * 2.2) * smoothstep(0.08, 0.2, r) * (1.0 - smoothstep(0.92, 1.0, r));
        float foamEdge = smoothstep(0.86, 1.0, r) * (0.4 + 0.6 * n2);
        float foam = (wake * (0.45 + 0.55 * n2) * 0.45 + foamEdge * 0.12) * (k == 0 ? uActiveL : 1.0 - cl);
        waste = mix(waste, FOAM * 0.7, clamp(foam, 0.0, 1.0) * 0.45);
        if (k == 0) {
          // feed well-ийн доторх үймээн
          waste = mix(waste, FOAM * 0.7, (1.0 - smoothstep(0.26, 0.3, r)) * 0.18 * (0.5 + 0.5 * n2) * uActiveL);
        }
        vec3 col = waste;
        if (k > 0) {
          // цэвэр ус: төвөөс гадагш цагираг долгио, хальхын (weir) тод цагираг
          float rr = r * R;
          float rings = (0.5 + 0.5 * sin(rr * 44.0 - uPhase * 3.0 - uShimmer * 1.4)) * exp(-rr * 2.2) * smoothstep(0.08, 0.16, r);
          vec3 clean = mix(C_DEEP, C_MID, 0.28 + 0.3 * n1 + 0.25 * r) + C_HI * rings * 0.12;
          float weir = 1.0 - smoothstep(0.004, 0.012, abs(rr - (R - 0.07)));
          clean += C_HI * weir * 0.25;
          clean = mix(clean, FOAM, wake * 0.12 * (0.4 + 0.6 * n2));
          col = mix(waste, clean, cl);
        }
        // төв гүн (налуу ёроол) бараан, хана руу цайвар; тэнгэрийн тусгал ар тал руу
        col *= mix(0.72, 1.0, smoothstep(0.0, 0.8, r));
        col += ${v3("#6d8fb0")} * 0.12 * smoothstep(0.2, -0.9, d.y / R);
        col += surfaceLight(vW.xz, k == 0 ? 0.5 + 0.5 * uActiveL : 1.0);
        return col * (1.0 + 0.12 * uActive);
      }

      void main() {
        int k = int(vKind + 0.5);
        vec3 col;
        if (k <= 2) {
          if (uFill[k] < 0.002) discard;
          col = tank(k);
        } else if (k <= 4) {
          // суваг: эх савны өнгөнөөс дараагийн сав руу бага зэрэг цэнхэршинэ
          int ci = k - 3;
          float front = uChannel[ci];
          if (front < 0.001 || vA > front) discard;
          float cl = tankClean(ci) + vA * 0.25;
          vec3 hi = mix(W_HI, C_HI, cl);
          float s = vA * 0.36;
          float n1 = vnoise(vec2(s * 22.0 - uPhase * 3.0, vC * 5.0));
          float n2 = vnoise(vec2(s * 55.0 - uPhase * 4.4 + uShimmer * 0.5, vC * 11.0 + 4.0));
          col = mix(W_DEEP, W_MID, 0.45 + 0.4 * n1) + W_HI * smoothstep(0.6, 0.95, n1 * 0.55 + n2 * 0.45) * 0.3;
          col = mix(col, mix(C_DEEP, C_MID, 0.5 + 0.4 * n1), cl);
          float ch = fract((vA * 0.36 - abs(vC - 0.5) * 0.05) * 18.0 - uPhase * 1.4);
          col += hi * smoothstep(0.0, 0.06, ch) * (1.0 - smoothstep(0.1, 0.24, ch)) * 0.14;
          col += hi * (1.0 - smoothstep(0.0, 0.08, front - vA)) * 0.4 * step(front, 0.999);
          col += surfaceLight(vW.xz, 0.8);
        } else if (k == 5) {
          if (vW.x > X1 || vW.z > Z1) discard;
          vec2 d = vW.xz - RC;
          float th = atan(d.y, d.x);
          float s = th * RR;
          float t = length(d) - RR;
          float n1 = vnoise(vec2(s * 5.0 + uPhase * 0.8, t * 22.0));
          col = mix(R_DEEP, R_MID, 0.4 + 0.4 * n1);
          col += ${v3("#8fd0f0")} * smoothstep(0.62, 0.95, n1) * 0.1;
          col *= mix(1.0, 0.8, smoothstep(0.0, RH, abs(t)));
          // гаргалгааны доорх цагираг (цэвэршсэн ус гол руу орно)
          float od = length(vW.xz - OUTFALL);
          float rings = (0.5 + 0.5 * sin(od * 70.0 - uPhase * 5.0 - uShimmer * 2.0)) * exp(-od * 9.0);
          col += C_HI * rings * 0.35 * uCascade;
          col = mix(col, FOAM, (1.0 - smoothstep(0.0, 0.05, od)) * 0.5 * uCascade);
          col += surfaceLight(vW.xz, 0.7);
        } else {
          if (uCascade < 0.001 || vA > uCascade) discard;
          float n = vnoise(vec2(vW.z * 60.0, vA * 10.0 - uPhase * 6.0));
          col = mix(C_MID, FOAM, 0.35 + 0.35 * n);
        }
        gl_FragColor = vec4(col * uDim, 1.0);
        ${COLORSPACE}
      }
    `,
  });
}

/** Суурийн доорх зөөлөн сүүдэр */
export function plinthShadowMaterial() {
  const cx = (PLINTH.x0 + PLINTH.x1) / 2;
  const cz = (PLINTH.z0 + PLINTH.z1) / 2;
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
        float s = sdBox(vW.xz - vec2(${f(cx)}, ${f(cz)}), vec2(${f((PLINTH.x1 - PLINTH.x0) / 2)}, ${f((PLINTH.z1 - PLINTH.z0) / 2)}));
        float a = (1.0 - smoothstep(-0.05, 0.55, s)) * 0.6;
        gl_FragColor = vec4(0.0, 0.01, 0.03, a);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}
