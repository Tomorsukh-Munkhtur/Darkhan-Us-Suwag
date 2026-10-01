import { easeOutCubic, seg } from "../journey/utils/ease";

/**
 * Цэвэрлэх байгууламжийн 3D загварын координат (нэгж ≈ 12 м). y = 0 — талбайн гадаргуу.
 * Одоогийн SVG-ийн (480×330) байрлалыг хадгална: зүүн том сав (cx150 r98), баруун жижиг сав (cx350 r74, бага зэрэг
 * хойно), хооронд нь богино суваг, баруун савнаас урагш → баруун тийш гарах хоолой, баруун доод буланд гол,
 * зүүн дээд буланд удирдлагын байр. SVG px → дэлхий: (x − 250) / 98, (y − 170) / 98.
 * three.js import хийхгүй — wrapper эхний bundle-д авч болно.
 */
export const PLINTH = { x0: -2.55, x1: 2.55, z0: -1.64, z1: 1.52, y0: -0.26 } as const;

export type Tank = { x: number; z: number; r: number; wall: number; top: number; floor: number; level: number };
/** Зүүн сав: бохир ус (тунгаах / биологийн цэвэрлэгээ) */
export const TANK_L: Tank = { x: -1.02, z: 0.02, r: 1.0, wall: 0.07, top: 0.17, floor: -0.34, level: 0.14 };
/** Баруун сав: дараагийн шат — цэвэршсэн ус */
export const TANK_R: Tank = { x: 1.2, z: -0.2, r: 0.76, wall: 0.06, top: 0.17, floor: -0.3, level: 0.105 };
export const TANKS = [TANK_L, TANK_R] as const;

/** Гүүр-хусуурын (rotating bridge scraper) эхний өнцөг ба ambient эргэлтийн хурд (рад/с) — маш удаан */
export const ARM_BASE = [-1.95, -1.2] as const;
export const ARM_SPEED = [0.05, 0.068] as const;
/** Scroll-той холбоотой бага эргэлт (детерминистик) — LOW-д ч scroll хийхэд хөдөлнө */
export const ARM_SCROLL = 0.9;

/** Хоёр савыг холбох ил суваг (зүүн савны ирмэгээс баруун савны ирмэг хүртэл) */
const dx = TANK_R.x - TANK_L.x;
const dz = TANK_R.z - TANK_L.z;
const dl = Math.hypot(dx, dz);
export const CH_DIR = [dx / dl, dz / dl] as const;
export const CHANNEL = {
  a: [TANK_L.x + CH_DIR[0] * (TANK_L.r + 0.01), TANK_L.z + CH_DIR[1] * (TANK_L.r + 0.01)] as const,
  b: [TANK_R.x - CH_DIR[0] * (TANK_R.r + 0.01), TANK_R.z - CH_DIR[1] * (TANK_R.r + 0.01)] as const,
  half: 0.055,
  wall: 0.03,
  bottom: 0.075,
  top: 0.17,
  level: 0.13,
};

/** Гол (баруун урд буланг огтолно): нуман тууз, төв нь талбайн гадна */
export const RIVER = { cx: 3.4, cz: 2.3, R: 1.55, half: 0.18, y: -0.05, bed: -0.14 } as const;

/** Гаргалгаа: баруун савны урд ирмэгийн худаг → урагш → 90° эргэж → баруун тийш → голын эрэг (толгой хана) */
export const OUTLET = (() => {
  const z0 = TANK_R.z + TANK_R.r + TANK_R.wall;
  const zRun = 1.22;
  const bend = 0.22;
  // голын ойрын эрэг (төвөөс R + half) хүрэх x — толгой ханын өмнө зогсоно
  const bank = RIVER.R + RIVER.half;
  const xBank = RIVER.cx - Math.sqrt(bank * bank - (zRun - RIVER.cz) ** 2);
  return { x: TANK_R.x, z0, chamberZ: z0 + 0.08, y: 0.085, r: 0.045, zRun, bend, xEnd: xBank + 0.03, xBank };
})();

export const BUILDING = { x: -2.0, z: -1.19, w: 0.62, d: 0.38, h: 0.3 } as const;
export const LAMPS = [
  { x: 0.2, z: -0.5 },
  { x: 1.66, z: 0.88 },
  { x: -1.52, z: -0.98 },
] as const;
/** SVG-ийн бутнуудын байрлал (зүүн урд, дээд дунд, баруун дээд, баруун дунд) */
export const BUSHES = [
  { x: -2.24, z: 1.3, r: 0.13 },
  { x: -2.0, z: 1.43, r: 0.1 },
  { x: 0.12, z: -1.24, r: 0.12 },
  { x: 2.12, z: -1.2, r: 0.14 },
  { x: 2.28, z: 0.3, r: 0.1 },
  { x: -0.12, z: 1.36, r: 0.09 },
] as const;

// Өсөлтийн бүлэг (uGrow)
export const G = { tankL: 0, tankR: 1, pivotL: 2, pivotR: 3, armL: 4, armR: 5, channel: 6, outlet: 7, building: 8, lamps: 9, bushes: 10 } as const;
export const GROUPS = 11;
// Гэрэл (uLit): 0 байрны цонх, 1 гэрэлтүүлэг, 2 эргэлтийн хөтлүүрийн "ажиллаж байна" LED
export const LITS = 3;

/**
 * Progress (0 → 1) → бүх төлөв. Цэвэр функц: цаг ашиглахгүй, буцааж гүйлгэхэд яг урвуу.
 *   0.00–0.10  талбай бараан, барилга байгууламжгүй
 *   0.10–0.30  бетон савнууд, төвийн тулгуур, гүүр, суваг, хоолой, байр босно; гэрэл асна
 *   0.30–0.50  зүүн сав дүүрч, бохир ус (ногоон-цэнхэр) идэвхжинэ
 *   0.50–0.70  холбох сувгаар урсгал явж, баруун сав дүүрнэ
 *   0.70–0.90  баруун савны ус цэвэршиж (цэнхэр), цагираг долгио гарна
 *   0.84–1.00  гаргалгааны хоолойгоор цэвэршсэн ус гол руу; бүрэн ажиллагаа
 */
export type TreatmentState = {
  dim: number;
  grow: number[];
  lit: number[];
  /** савны усны түвшин (дэлхийн y) */
  level: [number, number];
  /** дүүргэлт 0..1 (0 — ус харагдахгүй) */
  fill: [number, number];
  /** зүүн сав: түүхий → идэвхтэй бохир ус */
  activeL: number;
  /** баруун сав: ногоон-цэнхэр → цэвэр цэнхэр */
  clean: number;
  channel: number;
  outlet: number;
  cascade: number;
  active: number;
};

export function createTreatmentState(): TreatmentState {
  return {
    dim: 0,
    grow: new Array(GROUPS).fill(0),
    lit: new Array(LITS).fill(0),
    level: [TANK_L.floor, TANK_R.floor],
    fill: [0, 0],
    activeL: 0,
    clean: 0,
    channel: 0,
    outlet: 0,
    cascade: 0,
    active: 0,
  };
}

const ramp = (p: number, a: number, b: number) => easeOutCubic(seg(p, a, b));
const smooth = (p: number, a: number, b: number) => {
  const t = seg(p, a, b);
  return t * t * (3 - 2 * t);
};

export function treatmentState(p: number, s: TreatmentState): TreatmentState {
  s.dim = 0.38 + 0.62 * ramp(p, 0.02, 0.28);
  const g = s.grow;
  g[G.tankL] = ramp(p, 0.1, 0.22);
  g[G.tankR] = ramp(p, 0.13, 0.25);
  g[G.building] = ramp(p, 0.11, 0.21);
  g[G.pivotL] = ramp(p, 0.16, 0.26);
  g[G.pivotR] = ramp(p, 0.18, 0.28);
  g[G.channel] = ramp(p, 0.18, 0.27);
  g[G.outlet] = ramp(p, 0.2, 0.29);
  g[G.armL] = ramp(p, 0.21, 0.3);
  g[G.armR] = ramp(p, 0.23, 0.3);
  g[G.lamps] = ramp(p, 0.14, 0.24);
  g[G.bushes] = ramp(p, 0.12, 0.26);
  s.lit[0] = seg(p, 0.22, 0.3);
  s.lit[1] = seg(p, 0.24, 0.3);
  s.lit[2] = seg(p, 0.9, 0.97);

  s.fill[0] = smooth(p, 0.3, 0.44);
  s.fill[1] = smooth(p, 0.56, 0.74);
  s.level[0] = TANK_L.floor + (TANK_L.level - TANK_L.floor) * s.fill[0];
  s.level[1] = TANK_R.floor + (TANK_R.level - TANK_R.floor) * s.fill[1];
  s.activeL = smooth(p, 0.36, 0.5);
  s.channel = seg(p, 0.5, 0.62);
  s.clean = smooth(p, 0.7, 0.88);
  s.outlet = seg(p, 0.84, 0.95);
  s.cascade = seg(p, 0.94, 0.98);
  s.active = ramp(p, 0.9, 1);
  return s;
}

/** Гүүрний өнцөг: суурь + scroll (детерминистик) + ambient (зөвхөн чимэглэл, LOW-д 0) */
export const armAngle = (i: 0 | 1, p: number, t: number) => ARM_BASE[i] + p * ARM_SCROLL + t * ARM_SPEED[i];
