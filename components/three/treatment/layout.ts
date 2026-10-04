import { easeOutCubic, seg } from "../journey/utils/ease";

/**
 * Цэвэрлэх байгууламжийн 3D загварын координат (нэгж ≈ 12 м). y = 0 — талбайн гадаргуу.
 * Гурван дугуй сав зүүнээс баруун тийш урсгалын дарааллаар (бага зэрэг зигзаг): зүүн том сав (биологийн
 * цэвэрлэгээ), дунд сав (анхдагч тунгаагуур, бага зэрэг хойно), баруун жижиг сав (эцсийн тунгаагуур).
 * Хооронд нь богино сувгууд, баруун савнаас урагш → баруун тийш гарах хоолой, баруун доод буланд гол,
 * зүүн дээд буланд удирдлагын байр.
 * three.js import хийхгүй — wrapper эхний bundle-д авч болно.
 */
export const PLINTH = { x0: -2.8, x1: 2.8, z0: -1.64, z1: 1.52, y0: -0.26 } as const;

export type Tank = { x: number; z: number; r: number; wall: number; top: number; floor: number; level: number };
/** Зүүн сав: бохир ус (тунгаах / биологийн цэвэрлэгээ) */
export const TANK_L: Tank = { x: -1.62, z: 0.06, r: 0.78, wall: 0.07, top: 0.17, floor: -0.34, level: 0.14 };
/** Дунд сав: анхдагч тунгаагуур — ус цэвэршиж эхэлнэ (ногоон-цэнхэр) */
export const TANK_M: Tank = { x: 0.165, z: -0.24, r: 0.66, wall: 0.06, top: 0.17, floor: -0.32, level: 0.12 };
/** Баруун сав: эцсийн шат — цэвэршсэн ус */
export const TANK_R: Tank = { x: 1.73, z: -0.02, r: 0.56, wall: 0.06, top: 0.17, floor: -0.3, level: 0.105 };
export const TANKS = [TANK_L, TANK_M, TANK_R] as const;
export type TankIndex = 0 | 1 | 2;

/** Гүүр-хусуурын (rotating bridge scraper) эхний өнцөг ба ambient эргэлтийн хурд (рад/с) — маш удаан */
export const ARM_BASE = [-1.95, -0.75, -1.25] as const;
export const ARM_SPEED = [0.05, 0.06, 0.068] as const;
/** Scroll-той холбоотой бага эргэлт (детерминистик) — LOW-д ч scroll хийхэд хөдөлнө */
export const ARM_SCROLL = 0.9;

/** Хоёр савыг холбох ил суваг (эхний савны ирмэгээс дараагийн савны ирмэг хүртэл) */
function channelBetween(from: Tank, to: Tank) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dl = Math.hypot(dx, dz);
  const dir = [dx / dl, dz / dl] as const;
  return {
    dir,
    a: [from.x + dir[0] * (from.r + 0.01), from.z + dir[1] * (from.r + 0.01)] as const,
    b: [to.x - dir[0] * (to.r + 0.01), to.z - dir[1] * (to.r + 0.01)] as const,
    half: 0.055,
    wall: 0.03,
    bottom: 0.075,
    top: 0.17,
    level: (from.level + to.level) / 2,
  };
}
export type Channel = ReturnType<typeof channelBetween>;
/** зүүн → дунд, дунд → баруун */
export const CHANNELS = [channelBetween(TANK_L, TANK_M), channelBetween(TANK_M, TANK_R)] as const;

/** Гол (баруун урд буланг огтолно): нуман тууз, төв нь талбайн гадна */
export const RIVER = { cx: 3.65, cz: 2.3, R: 1.55, half: 0.18, y: -0.05, bed: -0.14 } as const;

/** Гаргалгаа: баруун савны урд ирмэгийн худаг → урагш → 90° эргэж → баруун тийш → голын эрэг (толгой хана) */
export const OUTLET = (() => {
  const z0 = TANK_R.z + TANK_R.r + TANK_R.wall;
  const zRun = 1.22;
  const bend = 0.2;
  // голын ойрын эрэг (төвөөс R + half) хүрэх x — толгой ханын өмнө зогсоно
  const bank = RIVER.R + RIVER.half;
  const xBank = RIVER.cx - Math.sqrt(bank * bank - (zRun - RIVER.cz) ** 2);
  return { x: TANK_R.x, z0, chamberZ: z0 + 0.08, y: 0.085, r: 0.045, zRun, bend, xEnd: xBank + 0.03, xBank };
})();

export const BUILDING = { x: -2.22, z: -1.19, w: 0.62, d: 0.38, h: 0.3 } as const;
export const LAMPS = [
  { x: -0.72, z: -0.62 },
  { x: 1.45, z: 0.86 },
  { x: -1.4, z: -0.98 },
  { x: 0.98, z: -0.72 },
] as const;
/** Зүлэгний толбо (ирмэг нь noise): зүүн урд, урд дунд, баруун дээд, хойд дунд хоёр, урд баруун */
export const GRASS = [
  { x: -2.5, z: 1.36, r: 0.5 },
  { x: -0.05, z: 1.4, r: 0.3 },
  { x: 2.45, z: -1.2, r: 0.4 },
  { x: 1.05, z: -1.08, r: 0.2 },
  { x: -0.75, z: -1.12, r: 0.22 },
  { x: 0.95, z: 0.75, r: 0.26 },
] as const;
/** Бутнууд (зүлэгний толбон дээр) */
export const BUSHES = [
  { x: -2.46, z: 1.3, r: 0.13 },
  { x: -2.2, z: 1.43, r: 0.1 },
  { x: -0.75, z: -1.16, r: 0.12 },
  { x: 2.4, z: -1.18, r: 0.14 },
  { x: 1.06, z: -1.08, r: 0.1 },
  { x: -0.04, z: 1.36, r: 0.09 },
  { x: 0.98, z: 0.7, r: 0.1 },
] as const;

// Өсөлтийн бүлэг (uGrow). Савны бүлэг = савны индекс (0..2) — body shader дотор хананд үүнийг ашиглана.
export const G = {
  tank: [0, 1, 2],
  pivot: [3, 4, 5],
  arm: [6, 7, 8],
  channel: [9, 10],
  outlet: 11,
  building: 12,
  lamps: 13,
  bushes: 14,
} as const;
export const GROUPS = 15;
// Гэрэл (uLit): 0 байрны цонх, 1 гэрэлтүүлэг, 2 эргэлтийн хөтлүүрийн "ажиллаж байна" LED
export const LITS = 3;

/**
 * Progress (0 → 1) → бүх төлөв. Цэвэр функц: цаг ашиглахгүй, буцааж гүйлгэхэд яг урвуу.
 *   0.00–0.10  талбай бараан, барилга байгууламжгүй
 *   0.10–0.30  бетон савнууд, төвийн тулгуур, гүүр, суваг, хоолой, байр босно; гэрэл асна
 *   0.30–0.48  зүүн сав дүүрч, бохир ус (ногоон) идэвхжинэ
 *   0.44–0.70  эхний сувгаар урсгал явж, дунд сав дүүрнэ; ус ногоон-цэнхэр болж эхэлнэ
 *   0.62–0.88  хоёр дахь сувгаар урсгал явж, баруун сав дүүрнэ; ус цэвэршиж (цэнхэр), цагираг долгио гарна
 *   0.84–1.00  гаргалгааны хоолойгоор цэвэршсэн ус гол руу; бүрэн ажиллагаа
 */
export type TreatmentState = {
  dim: number;
  grow: number[];
  lit: number[];
  /** савны усны түвшин (дэлхийн y) */
  level: [number, number, number];
  /** дүүргэлт 0..1 (0 — ус харагдахгүй) */
  fill: [number, number, number];
  /** зүүн сав: түүхий → идэвхтэй бохир ус */
  activeL: number;
  /** цэвэршилт: [дунд сав — ногоон → ногоон-цэнхэр, баруун сав — ногоон-цэнхэр → цэвэр цэнхэр] */
  clean: [number, number];
  /** сувгийн урсгалын фронт: [зүүн → дунд, дунд → баруун] */
  channel: [number, number];
  outlet: number;
  cascade: number;
  active: number;
};

export function createTreatmentState(): TreatmentState {
  return {
    dim: 0,
    grow: new Array(GROUPS).fill(0),
    lit: new Array(LITS).fill(0),
    level: [TANK_L.floor, TANK_M.floor, TANK_R.floor],
    fill: [0, 0, 0],
    activeL: 0,
    clean: [0, 0],
    channel: [0, 0],
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
  for (let i = 0; i < 3; i++) {
    g[G.tank[i]] = ramp(p, 0.1 + 0.02 * i, 0.22 + 0.02 * i);
    g[G.pivot[i]] = ramp(p, 0.16 + 0.015 * i, 0.26 + 0.015 * i);
    g[G.arm[i]] = ramp(p, 0.21 + 0.01 * i, 0.3);
  }
  g[G.building] = ramp(p, 0.11, 0.21);
  g[G.channel[0]] = ramp(p, 0.18, 0.27);
  g[G.channel[1]] = ramp(p, 0.19, 0.28);
  g[G.outlet] = ramp(p, 0.2, 0.29);
  g[G.lamps] = ramp(p, 0.14, 0.24);
  g[G.bushes] = ramp(p, 0.12, 0.26);
  s.lit[0] = seg(p, 0.22, 0.3);
  s.lit[1] = seg(p, 0.24, 0.3);
  s.lit[2] = seg(p, 0.9, 0.97);

  s.fill[0] = smooth(p, 0.3, 0.42);
  s.fill[1] = smooth(p, 0.5, 0.62);
  s.fill[2] = smooth(p, 0.68, 0.8);
  for (let i = 0; i < 3; i++) {
    const t = TANKS[i];
    s.level[i] = t.floor + (t.level - t.floor) * s.fill[i];
  }
  s.activeL = smooth(p, 0.34, 0.48);
  s.channel[0] = seg(p, 0.44, 0.54);
  s.clean[0] = smooth(p, 0.56, 0.7);
  s.channel[1] = seg(p, 0.62, 0.72);
  s.clean[1] = smooth(p, 0.74, 0.88);
  s.outlet = seg(p, 0.84, 0.95);
  s.cascade = seg(p, 0.94, 0.98);
  s.active = ramp(p, 0.9, 1);
  return s;
}

/** Гүүрний өнцөг: суурь + scroll (детерминистик) + ambient (зөвхөн чимэглэл, LOW-д 0) */
export const armAngle = (i: TankIndex, p: number, t: number) => ARM_BASE[i] + p * ARM_SCROLL + t * ARM_SPEED[i];
